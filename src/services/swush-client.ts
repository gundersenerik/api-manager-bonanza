import {
  SwushGameResponse,
  SwushUsersResponse,
  SwushElement,
} from '@/types'
import { log } from '@/lib/logger'

// Configuration constants
const DEFAULT_TIMEOUT_MS = 30000 // 30 seconds
const RATE_LIMIT_DELAY_MS = 100 // Delay between paginated requests to avoid rate limiting
const MAX_PAGE_SIZE = 10 // SWUSH API maximum page size
const MAX_RETRIES = 3 // Number of retries for failed requests
const RETRY_BASE_DELAY_MS = 1000 // Base delay for exponential backoff (1s, 2s, 4s)

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
        log.swush.error({
          url,
          status: response.status,
          durationMs,
          responseBody: errorText.substring(0, 500),
        }, `[SWUSH] HTTP error ${response.status}`)
        return {
          data: null,
          error: `HTTP ${response.status}: ${response.statusText}`,
          status: response.status,
          url,
          durationMs,
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
   * Make a request with retry logic and exponential backoff
   * Retries on transient failures (5xx, timeouts, network errors)
   */
  private async requestWithRetry<T>(
    endpoint: string,
    maxRetries: number = MAX_RETRIES
  ): Promise<SwushApiResponse<T>> {
    let lastResponse: SwushApiResponse<T> | null = null

    for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
      const response = await this.request<T>(endpoint)

      // Success - return immediately
      if (response.data && !response.error) {
        return response
      }

      lastResponse = response

      // Don't retry on client errors (4xx) except 408 (timeout) and 429 (rate limit)
      const isClientError = response.status >= 400 && response.status < 500
      const isRetryableClientError = response.status === 408 || response.status === 429

      if (isClientError && !isRetryableClientError) {
        log.swush.warn(`[SWUSH] Non-retryable error ${response.status} on attempt ${attempt}`)
        return response
      }

      // If we have more attempts, wait and retry
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
   */
  async getElements(subsiteKey: string, gameKey: string): Promise<SwushApiResponse<SwushElement[]>> {
    return this.requestWithRetry<SwushElement[]>(
      `/season/subsites/${subsiteKey}/games/${gameKey}/elements`
    )
  }

  /**
   * Get users for a game (paginated) - with retry logic
   */
  async getUsers(
    subsiteKey: string,
    gameKey: string,
    page: number = 1,
    pageSize: number = MAX_PAGE_SIZE,
    includeUserteams: boolean = true
  ): Promise<SwushApiResponse<SwushUsersResponse>> {
    // SWUSH API has a maximum page size limit
    const actualPageSize = Math.min(pageSize, MAX_PAGE_SIZE)
    return this.requestWithRetry<SwushUsersResponse>(
      `/season/subsites/${subsiteKey}/games/${gameKey}/users?includeUserteams=${includeUserteams}&includeLineups=false&page=${page}&pageSize=${actualPageSize}`
    )
  }

  /**
   * Get all users for a game (handles pagination automatically)
   * Warning: This can be slow for games with many users
   */
  async getAllUsers(
    subsiteKey: string,
    gameKey: string,
    onProgress?: (page: number, totalPages: number) => void
  ): Promise<SwushApiResponse<SwushUsersResponse>> {
    // First request to get total pages
    const firstResponse = await this.getUsers(subsiteKey, gameKey, 1, MAX_PAGE_SIZE)

    if (firstResponse.error || !firstResponse.data) {
      return firstResponse
    }

    const totalPages = firstResponse.data.pages
    const allUsers = [...firstResponse.data.users]

    onProgress?.(1, totalPages)

    // Fetch remaining pages
    for (let page = 2; page <= totalPages; page++) {
      const response = await this.getUsers(subsiteKey, gameKey, page, MAX_PAGE_SIZE)

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
