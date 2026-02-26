import {
  SwushGameResponse,
  SwushUsersResponse,
  SwushElement,
} from '@/types'
import { supabaseAdmin } from '@/lib/supabase/server'
import { log } from '@/lib/logger'

// Configuration constants
const DEFAULT_TIMEOUT_MS = 60000 // 60 seconds (5000-user pages can be large)
const RATE_LIMIT_DELAY_MS = 1100 // Just over 1 second — SWUSH allows max 1 req/sec
const MAX_PAGE_SIZE = 5000 // SWUSH API max page size (confirmed in Swagger docs)
const MAX_RETRIES = 3 // Number of retries for failed requests
const RETRY_BASE_DELAY_MS = 1000 // Base delay for exponential backoff (1s, 2s, 4s)
const MAX_429_RETRIES = 2 // Number of retries specifically for rate-limit 429s
const DEFAULT_429_WAIT_SECONDS = 30 // Default wait when no Retry-After header

// Daily request budget — SWUSH limits to 100 requests/day
const DAILY_BUDGET_LIMIT = 90 // Reserve 10 for manual syncs
const DAILY_BUDGET_WARN = 75 // Log warnings above this threshold

/** Error message prefix for client-side budget exhaustion (distinct from server 429) */
export const BUDGET_EXHAUSTED_PREFIX = 'BUDGET_EXHAUSTED:'

/**
 * Persistent daily API budget counter backed by Supabase.
 * Shared across all Vercel serverless instances — survives cold starts.
 */
const dailyBudget = {
  /** Increment counter atomically. Returns false if budget exhausted. */
  async consume(): Promise<boolean> {
    const today = new Date().toISOString().slice(0, 10)
    try {
      const db = supabaseAdmin()

      // Upsert today's row and increment atomically
      const { data, error } = await db.rpc('increment_api_budget', { budget_date: today })

      if (error) {
        // If the RPC doesn't exist yet, fall back to manual upsert
        log.swush.warn({ err: error }, '[SWUSH] Budget RPC failed, using upsert fallback')
        return this.consumeFallback(today)
      }

      const count = data as number
      if (count > DAILY_BUDGET_LIMIT) {
        log.swush.error({ count, limit: DAILY_BUDGET_LIMIT }, '[SWUSH] Daily budget exhausted')
        return false
      }
      if (count >= DAILY_BUDGET_WARN) {
        log.swush.warn({ count, limit: DAILY_BUDGET_LIMIT }, '[SWUSH] Daily budget running low')
      }
      return true
    } catch (err) {
      log.swush.error({ err }, '[SWUSH] Budget tracking error — allowing request')
      return true // Fail open: don't block syncs if budget tracking is broken
    }
  },

  /** Fallback if RPC is not yet deployed */
  async consumeFallback(today: string): Promise<boolean> {
    const db = supabaseAdmin()

    // Try to insert today's row (ignore conflict)
    await db.from('api_budget').upsert(
      { date: today, count: 0, updated_at: new Date().toISOString() },
      { onConflict: 'date', ignoreDuplicates: true }
    )

    // Read current count
    const { data, error } = await db
      .from('api_budget')
      .select('count')
      .eq('date', today)
      .single()

    if (error || !data) {
      log.swush.warn({ err: error }, '[SWUSH] Budget fallback failed — allowing request')
      return true
    }

    // Manually increment (not fully atomic but better than in-memory)
    const newCount = (data.count || 0) + 1
    await db.from('api_budget').update({ count: newCount, updated_at: new Date().toISOString() }).eq('date', today)

    if (newCount > DAILY_BUDGET_LIMIT) {
      log.swush.error({ count: newCount, limit: DAILY_BUDGET_LIMIT }, '[SWUSH] Daily budget exhausted')
      return false
    }
    if (newCount >= DAILY_BUDGET_WARN) {
      log.swush.warn({ count: newCount, limit: DAILY_BUDGET_LIMIT }, '[SWUSH] Daily budget running low')
    }
    return true
  },

  /** Get remaining budget for today */
  async getRemaining(): Promise<number> {
    const today = new Date().toISOString().slice(0, 10)
    try {
      const db = supabaseAdmin()
      const { data } = await db
        .from('api_budget')
        .select('count')
        .eq('date', today)
        .single()
      const used = data?.count || 0
      return Math.max(0, DAILY_BUDGET_LIMIT - used)
    } catch {
      return DAILY_BUDGET_LIMIT // Assume full budget if we can't read
    }
  },
}

interface SwushClientConfig {
  baseUrl: string
  apiKey: string
  timeout?: number
}

interface SwushApiResponse<T> {
  data: T | null
  error: string | null
  status: number
  /** The URL that was requested (for debugging) */
  url?: string
  /** How long the request took in ms */
  durationMs?: number
  /** Retry-After header value from rate limit responses (seconds) */
  retryAfterSeconds?: number
}

/**
 * Extract the root cause from a Node.js fetch error chain.
 * Node's fetch() throws TypeError("fetch failed") for ALL network errors,
 * hiding the real cause (DNS, TLS, connection reset, etc.) in error.cause.
 */
function extractErrorCause(error: Error): string {
  const parts: string[] = [error.message]

  let current: unknown = error.cause
  let depth = 0
  const MAX_DEPTH = 5 // Prevent infinite loops

  while (current && depth < MAX_DEPTH) {
    if (current instanceof Error) {
      // Include error code if available (e.g., ENOTFOUND, ECONNRESET, CERT_HAS_EXPIRED)
      const code = (current as NodeJS.ErrnoException).code
      if (code) {
        parts.push(`${code}: ${current.message}`)
      } else {
        parts.push(current.message)
      }
      current = current.cause
    } else if (typeof current === 'string') {
      parts.push(current)
      break
    } else {
      break
    }
    depth++
  }

  // Deduplicate — sometimes the same message appears at multiple levels
  const unique = [...new Set(parts)]
  return unique.join(' → ')
}

/**
 * SWUSH Partner API Client
 * Handles all communication with the SWUSH API
 */
export class SwushClient {
  private baseUrl: string
  private apiKey: string
  private timeout: number

  constructor(config: SwushClientConfig) {
    this.baseUrl = config.baseUrl
    this.apiKey = config.apiKey
    this.timeout = config.timeout || DEFAULT_TIMEOUT_MS
  }

  /**
   * Make a request to the SWUSH API
   */
  private async request<T>(endpoint: string): Promise<SwushApiResponse<T>> {
    // Check daily budget before making the request
    const budgetOk = await dailyBudget.consume()
    if (!budgetOk) {
      const remaining = await dailyBudget.getRemaining()
      const msg = `${BUDGET_EXHAUSTED_PREFIX} Daily API budget exhausted (${DAILY_BUDGET_LIMIT - remaining}/${DAILY_BUDGET_LIMIT} requests). Resets at midnight UTC.`
      log.swush.error({ remaining, limit: DAILY_BUDGET_LIMIT }, `[SWUSH] ${msg}`)
      return {
        data: null,
        error: msg,
        status: 429,
      }
    }

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), this.timeout)
    const url = `${this.baseUrl}${endpoint}`
    const startTime = Date.now()

    try {
      log.swush.debug({ url }, '[SWUSH] Fetching')

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'x-api-key': this.apiKey,
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0 (compatible; SWUSH-Manager/1.0)',
        },
        signal: controller.signal,
      })

      clearTimeout(timeoutId)
      const durationMs = Date.now() - startTime

      if (!response.ok) {
        const errorText = await response.text()

        // Capture Retry-After header for rate limit responses
        const retryAfterHeader = response.headers.get('Retry-After')
        const retryAfterSeconds = retryAfterHeader ? parseInt(retryAfterHeader, 10) : undefined

        log.swush.error({
          url,
          status: response.status,
          durationMs,
          retryAfterSeconds,
          responseBody: errorText.substring(0, 500),
        }, `[SWUSH] HTTP error ${response.status}`)
        return {
          data: null,
          error: `HTTP ${response.status}: ${response.statusText}`,
          status: response.status,
          url,
          durationMs,
          retryAfterSeconds,
        }
      }

      // Handle JSON parsing errors
      let data: T
      try {
        data = await response.json()
      } catch {
        log.swush.error({ url, durationMs }, '[SWUSH] Invalid JSON response')
        return {
          data: null,
          error: 'Invalid JSON response from SWUSH API',
          status: 500,
          url,
          durationMs,
        }
      }

      // Log slow requests
      if (durationMs > 5000) {
        log.swush.warn({ url, durationMs }, '[SWUSH] Slow request')
      }

      return {
        data,
        error: null,
        status: response.status,
        url,
        durationMs,
      }
    } catch (error) {
      clearTimeout(timeoutId)
      const durationMs = Date.now() - startTime

      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          log.swush.error({ url, durationMs, timeoutMs: this.timeout }, '[SWUSH] Request timeout')
          return {
            data: null,
            error: `Request timeout after ${this.timeout}ms for ${endpoint}`,
            status: 408,
            url,
            durationMs,
          }
        }

        // Extract the REAL error cause from Node.js fetch error chain
        const detailedError = extractErrorCause(error)
        log.swush.error({
          url,
          durationMs,
          errorName: error.name,
          errorMessage: error.message,
          errorCause: detailedError,
        }, `[SWUSH] Network error: ${detailedError}`)

        return {
          data: null,
          error: detailedError,
          status: 500,
          url,
          durationMs,
        }
      }

      log.swush.error({ url, durationMs, error }, '[SWUSH] Unknown error')
      return {
        data: null,
        error: 'Unknown error occurred',
        status: 500,
        url,
        durationMs,
      }
    }
  }

  /**
   * Make a request with retry logic and exponential backoff.
   * Retries on transient failures (5xx, timeouts, network errors).
   * Also retries 429 (rate limit) with Retry-After delay — but NOT budget exhaustion.
   */
  private async requestWithRetry<T>(
    endpoint: string,
    maxRetries: number = MAX_RETRIES
  ): Promise<SwushApiResponse<T>> {
    let lastResponse: SwushApiResponse<T> | null = null
    let rateLimitRetries = 0

    for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
      const response = await this.request<T>(endpoint)

      // Success - return immediately
      if (response.data && !response.error) {
        return response
      }

      lastResponse = response

      // Budget exhaustion (client-side) — never retry, fail immediately
      if (response.status === 429 && response.error?.startsWith(BUDGET_EXHAUSTED_PREFIX)) {
        log.swush.error({ endpoint }, '[SWUSH] Budget exhausted — cannot retry')
        return response
      }

      // Server 429 (rate limit) — wait for Retry-After and retry
      if (response.status === 429) {
        rateLimitRetries++
        if (rateLimitRetries > MAX_429_RETRIES) {
          log.swush.error({
            endpoint,
            rateLimitRetries,
          }, '[SWUSH] Rate limit retries exhausted — giving up')
          return response
        }

        const waitSeconds = response.retryAfterSeconds || DEFAULT_429_WAIT_SECONDS
        log.swush.warn({
          endpoint,
          rateLimitRetry: rateLimitRetries,
          maxRateLimitRetries: MAX_429_RETRIES,
          waitSeconds,
          retryAfterHeader: response.retryAfterSeconds,
        }, `[SWUSH] Rate limited (429) — waiting ${waitSeconds}s before retry ${rateLimitRetries}/${MAX_429_RETRIES}`)
        await new Promise(resolve => setTimeout(resolve, waitSeconds * 1000))
        // Don't consume a normal retry attempt for 429 — use separate counter
        continue
      }

      // Don't retry on other client errors (4xx) except 408 (timeout)
      const isClientError = response.status >= 400 && response.status < 500
      const isRetryableClientError = response.status === 408

      if (isClientError && !isRetryableClientError) {
        log.swush.warn(`[SWUSH] Non-retryable error ${response.status} on attempt ${attempt}`)
        return response
      }

      // If we have more attempts, wait and retry (exponential backoff for 5xx/timeout)
      if (attempt <= maxRetries) {
        const delay = RETRY_BASE_DELAY_MS * Math.pow(2, attempt - 1) // 1s, 2s, 4s
        log.swush.warn({
          endpoint,
          attempt,
          maxAttempts: maxRetries + 1,
          status: response.status,
          error: response.error,
          durationMs: response.durationMs,
          retryInMs: delay,
        }, `[SWUSH] Attempt ${attempt} failed, retrying in ${delay}ms`)
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }

    log.swush.error({
      endpoint,
      totalAttempts: maxRetries + 1,
      rateLimitRetries,
      lastStatus: lastResponse?.status,
      lastError: lastResponse?.error,
      lastDurationMs: lastResponse?.durationMs,
    }, `[SWUSH] All ${maxRetries + 1} attempts failed`)
    return lastResponse!
  }

  /**
   * Verify API key is valid
   */
  async verifyApiKey(): Promise<boolean> {
    const response = await this.request<{ message: string }>('/apikeycheck')
    return response.data?.message === 'Ok: Valid API Key'
  }

  /**
   * Get game details including rounds and top elements
   * Uses retry logic — game data is critical for sync
   */
  async getGame(subsiteKey: string, gameKey: string): Promise<SwushApiResponse<SwushGameResponse>> {
    return this.requestWithRetry<SwushGameResponse>(
      `/season/subsites/${subsiteKey}/games/${gameKey}`
    )
  }

  /**
   * Get all elements (players) for a game
   * Uses retry logic — element data is critical for sync
   * @param round - Optional round number. Defaults to latest ended round if omitted.
   */
  async getElements(subsiteKey: string, gameKey: string, round?: number): Promise<SwushApiResponse<SwushElement[]>> {
    const roundParam = round != null ? `?round=${round}` : ''
    return this.requestWithRetry<SwushElement[]>(
      `/season/subsites/${subsiteKey}/games/${gameKey}/elements${roundParam}`
    )
  }

  /**
   * Get users for a game (paginated) - with retry logic
   * @param round - Optional round number. Defaults to latest ended round if omitted.
   */
  async getUsers(
    subsiteKey: string,
    gameKey: string,
    page: number = 1,
    pageSize: number = MAX_PAGE_SIZE,
    includeUserteams: boolean = true,
    round?: number
  ): Promise<SwushApiResponse<SwushUsersResponse>> {
    // SWUSH API has a maximum page size limit
    const actualPageSize = Math.min(pageSize, MAX_PAGE_SIZE)
    const roundParam = round != null ? `&round=${round}` : ''
    return this.requestWithRetry<SwushUsersResponse>(
      `/season/subsites/${subsiteKey}/games/${gameKey}/users?includeUserteams=${includeUserteams}&includeLineups=true&page=${page}&pageSize=${actualPageSize}${roundParam}`
    )
  }

  /**
   * Get all users for a game (handles pagination automatically)
   * Warning: This can be slow for games with many users
   * @param round - Optional round number. Defaults to latest ended round if omitted.
   */
  async getAllUsers(
    subsiteKey: string,
    gameKey: string,
    onProgress?: (page: number, totalPages: number) => void,
    round?: number
  ): Promise<SwushApiResponse<SwushUsersResponse>> {
    // First request to get total pages
    const firstResponse = await this.getUsers(subsiteKey, gameKey, 1, MAX_PAGE_SIZE, true, round)

    if (firstResponse.error || !firstResponse.data) {
      return firstResponse
    }

    const totalPages = firstResponse.data.pages
    const allUsers = [...firstResponse.data.users]

    onProgress?.(1, totalPages)

    // Fetch remaining pages
    for (let page = 2; page <= totalPages; page++) {
      const response = await this.getUsers(subsiteKey, gameKey, page, MAX_PAGE_SIZE, true, round)

      if (response.error || !response.data) {
        log.swush.error(`[SWUSH] Failed to fetch page ${page}: ${response.error}`)
        continue
      }

      allUsers.push(...response.data.users)
      onProgress?.(page, totalPages)

      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY_MS))
    }

    return {
      data: {
        ...firstResponse.data,
        users: allUsers,
        page: 1,
        pages: 1,
      },
      error: null,
      status: 200,
    }
  }
}

/**
 * Create a SWUSH client instance with environment variables
 */
export function createSwushClient(): SwushClient {
  const baseUrl = process.env.SWUSH_API_BASE_URL
  const apiKey = process.env.SWUSH_API_KEY

  if (!baseUrl || !apiKey) {
    throw new Error('Missing SWUSH API environment variables (SWUSH_API_BASE_URL, SWUSH_API_KEY)')
  }

  return new SwushClient({
    baseUrl,
    apiKey,
    timeout: DEFAULT_TIMEOUT_MS,
  })
}

/**
 * Get remaining daily API budget.
 * Used by cron job to decide whether to start syncing a game.
 */
export async function getRemainingBudget(): Promise<number> {
  return dailyBudget.getRemaining()
}
