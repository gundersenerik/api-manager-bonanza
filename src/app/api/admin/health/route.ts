import { jsonResponse, errorResponse, requireAdminAuth } from '@/lib/api-auth'
import { supabaseAdmin } from '@/lib/supabase/server'
import { log } from '@/lib/logger'

export const dynamic = 'force-dynamic'

interface ServiceHealth {
  name: string
  status: 'healthy' | 'degraded' | 'down' | 'unconfigured'
  latency_ms: number | null
  last_checked: string
  message?: string
}

interface HealthResponse {
  services: ServiceHealth[]
  sync_stats: {
    failures_24h: number
    successes_24h: number
    total_24h: number
  }
  next_sync: {
    game_name: string
    game_key: string
    expected_at: string
    minutes_until: number
  } | null
}

/**
 * Ping SWUSH API health
 */
async function checkSwush(): Promise<ServiceHealth> {
  const apiKey = process.env.SWUSH_API_KEY
  const baseUrl = process.env.SWUSH_API_BASE_URL

  if (!apiKey || !baseUrl) {
    return {
      name: 'SWUSH API',
      status: 'unconfigured',
      latency_ms: null,
      last_checked: new Date().toISOString(),
      message: 'API credentials not configured',
    }
  }

  const start = performance.now()
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 10000)

    const response = await fetch(`${baseUrl}/apikeycheck`, {
      method: 'GET',
      headers: {
        'x-api-key': apiKey,
        Accept: 'application/json',
      },
      signal: controller.signal,
    })

    clearTimeout(timeout)
    const latency = Math.round(performance.now() - start)

    if (response.ok) {
      const data = await response.json()
      const isValid = data?.message === 'Ok: Valid API Key'
      return {
        name: 'SWUSH API',
        status: isValid ? 'healthy' : 'degraded',
        latency_ms: latency,
        last_checked: new Date().toISOString(),
        message: isValid ? undefined : 'Invalid API key response',
      }
    }

    return {
      name: 'SWUSH API',
      status: response.status >= 500 ? 'down' : 'degraded',
      latency_ms: latency,
      last_checked: new Date().toISOString(),
      message: `HTTP ${response.status}`,
    }
  } catch (error) {
    const latency = Math.round(performance.now() - start)
    return {
      name: 'SWUSH API',
      status: 'down',
      latency_ms: latency > 10000 ? null : latency,
      last_checked: new Date().toISOString(),
      message: error instanceof Error && error.name === 'AbortError'
        ? 'Request timeout (10s)'
        : error instanceof Error
          ? error.message
          : 'Connection failed',
    }
  }
}

/**
 * Ping Braze API health
 */
async function checkBraze(): Promise<ServiceHealth> {
  const apiKey = process.env.BRAZE_API_KEY
  const endpoint = process.env.BRAZE_REST_ENDPOINT || 'https://rest.fra-02.braze.eu'

  if (!apiKey) {
    return {
      name: 'Braze API',
      status: 'unconfigured',
      latency_ms: null,
      last_checked: new Date().toISOString(),
      message: 'API key not configured',
    }
  }

  const start = performance.now()
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 10000)

    // Use subscription status endpoint as a lightweight auth check
    const response = await fetch(`${endpoint}/subscription/status/get`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        subscription_group_id: 'test',
        external_id: ['test'],
      }),
      signal: controller.signal,
    })

    clearTimeout(timeout)
    const latency = Math.round(performance.now() - start)

    // 400 = auth works, bad request params (expected)
    // 200 = all good
    if (response.ok || response.status === 400) {
      return {
        name: 'Braze API',
        status: 'healthy',
        latency_ms: latency,
        last_checked: new Date().toISOString(),
      }
    }

    if (response.status === 401) {
      return {
        name: 'Braze API',
        status: 'degraded',
        latency_ms: latency,
        last_checked: new Date().toISOString(),
        message: 'Invalid API key',
      }
    }

    return {
      name: 'Braze API',
      status: response.status >= 500 ? 'down' : 'degraded',
      latency_ms: latency,
      last_checked: new Date().toISOString(),
      message: `HTTP ${response.status}`,
    }
  } catch (error) {
    const latency = Math.round(performance.now() - start)
    return {
      name: 'Braze API',
      status: 'down',
      latency_ms: latency > 10000 ? null : latency,
      last_checked: new Date().toISOString(),
      message: error instanceof Error && error.name === 'AbortError'
        ? 'Request timeout (10s)'
        : 'Connection failed',
    }
  }
}

/**
 * Ping Vespa health
 */
async function checkVespa(): Promise<ServiceHealth> {
  const token = process.env.VESPA_TOKEN

  if (!token) {
    return {
      name: 'Vespa',
      status: 'unconfigured',
      latency_ms: null,
      last_checked: new Date().toISOString(),
      message: 'Token not configured',
    }
  }

  const start = performance.now()
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 10000)

    // Lightweight search query to verify connectivity
    const queryParams = new URLSearchParams({
      yql: 'select article_id from articles where true limit 1',
      hits: '1',
    })

    const response = await fetch(
      `https://fd3a8d34.a23fbc3b.z.vespa-app.cloud/search/?${queryParams.toString()}`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
      }
    )

    clearTimeout(timeout)
    const latency = Math.round(performance.now() - start)

    if (response.ok) {
      return {
        name: 'Vespa',
        status: 'healthy',
        latency_ms: latency,
        last_checked: new Date().toISOString(),
      }
    }

    return {
      name: 'Vespa',
      status: response.status >= 500 ? 'down' : 'degraded',
      latency_ms: latency,
      last_checked: new Date().toISOString(),
      message: `HTTP ${response.status}`,
    }
  } catch (error) {
    const latency = Math.round(performance.now() - start)
    return {
      name: 'Vespa',
      status: 'down',
      latency_ms: latency > 10000 ? null : latency,
      last_checked: new Date().toISOString(),
      message: error instanceof Error && error.name === 'AbortError'
        ? 'Request timeout (10s)'
        : 'Connection failed',
    }
  }
}

/**
 * GET /api/admin/health
 * System health check — pings SWUSH, Braze, Vespa and gathers sync stats
 */
export async function GET() {
  const authError = await requireAdminAuth()
  if (authError) return authError

  try {
    // Run all health checks in parallel
    const [swush, braze, vespa] = await Promise.all([
      checkSwush(),
      checkBraze(),
      checkVespa(),
    ])

    const admin = supabaseAdmin()

    // Get sync failures in last 24h
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

    const [failuresResult, successesResult] = await Promise.all([
      admin
        .from('sync_logs')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'failed')
        .gte('started_at', twentyFourHoursAgo),
      admin
        .from('sync_logs')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'completed')
        .gte('started_at', twentyFourHoursAgo),
    ])

    const failures24h = failuresResult.count || 0
    const successes24h = successesResult.count || 0

    // Find the next game due for sync
    const { data: games } = await admin
      .from('games')
      .select('name, game_key, last_synced_at, sync_interval_minutes')
      .eq('is_active', true)
      .order('last_synced_at', { ascending: true, nullsFirst: true })

    let nextSync: HealthResponse['next_sync'] = null

    if (games && games.length > 0) {
      // Find which game is next due
      for (const game of games) {
        const lastSynced = game.last_synced_at ? new Date(game.last_synced_at) : new Date(0)
        const nextSyncTime = new Date(lastSynced.getTime() + game.sync_interval_minutes * 60 * 1000)
        const minutesUntil = Math.round((nextSyncTime.getTime() - Date.now()) / 60000)

        if (!nextSync || minutesUntil < nextSync.minutes_until) {
          nextSync = {
            game_name: game.name,
            game_key: game.game_key,
            expected_at: nextSyncTime.toISOString(),
            minutes_until: minutesUntil,
          }
        }
      }
    }

    const response: HealthResponse = {
      services: [swush, braze, vespa],
      sync_stats: {
        failures_24h: failures24h,
        successes_24h: successes24h,
        total_24h: failures24h + successes24h,
      },
      next_sync: nextSync,
    }

    return jsonResponse({ success: true, data: response }, 200, { cache: false })
  } catch (error) {
    log.api.error({ err: error }, 'Health check failed')
    return errorResponse('Health check failed', 500)
  }
}
