import { createUserServerClient } from '@/lib/supabase/server'
import { log } from '@/lib/logger'

/**
 * Verify admin authentication for protected routes
 * Returns the user if authenticated, null otherwise
 */
export async function verifyAdminAuth(): Promise<{ id: string; email?: string } | null> {
  try {
    const supabase = await createUserServerClient()
    const { data: { user }, error } = await supabase.auth.getUser()

    if (error || !user) {
      log.auth.warn({ reason: error?.message || 'No user' }, 'Admin auth failed')
      return null
    }

    return { id: user.id, email: user.email }
  } catch (error) {
    log.auth.error({ err: error }, 'Admin auth error')
    return null
  }
}

/**
 * Middleware helper to require admin authentication
 * Returns an error response if not authenticated, null if authenticated
 */
export async function requireAdminAuth(): Promise<Response | null> {
  const user = await verifyAdminAuth()
  if (!user) {
    return errorResponse('Unauthorized', 401)
  }
  return null
}

/**
 * API response helpers
 */
interface JsonResponseOptions {
  /** Cache duration in seconds. Set to false to disable caching. Default: 300 (5 min) */
  cache?: number | false
}

export function jsonResponse(
  data: unknown,
  status: number = 200,
  options: JsonResponseOptions = {}
) {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  }

  // Add cache headers unless explicitly disabled
  if (options.cache !== false) {
    const maxAge = typeof options.cache === 'number' ? options.cache : 300
    headers['Cache-Control'] = `public, max-age=${maxAge}`
  } else {
    headers['Cache-Control'] = 'no-store'
  }

  return Response.json(data, { status, headers })
}

export function errorResponse(message: string, status: number = 400) {
  return Response.json(
    {
      success: false,
      error: message,
      timestamp: new Date().toISOString(),
    },
    { status }
  )
}
