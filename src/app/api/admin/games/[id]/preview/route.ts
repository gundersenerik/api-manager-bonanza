import { jsonResponse, errorResponse, requireAdminAuth } from '@/lib/api-auth'
import { supabaseAdmin } from '@/lib/supabase/server'
import { log } from '@/lib/logger'

export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/games/[id]/preview?external_id=699590
 * Admin proxy that calls the Connected Content endpoint internally
 * and returns the full response for preview/testing purposes.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = await requireAdminAuth()
  if (authError) return authError

  try {
    const { id } = await params
    const url = new URL(request.url)
    const externalId = url.searchParams.get('external_id')

    if (!externalId) {
      return errorResponse('external_id query parameter is required', 400)
    }

    const admin = supabaseAdmin()

    // Get the game to find game_key
    const { data: game, error: gameError } = await admin
      .from('games')
      .select('game_key, name')
      .eq('id', id)
      .single()

    if (gameError || !game) {
      return errorResponse('Game not found', 404)
    }

    // Build the internal Connected Content URL
    const brazeToken = process.env.BRAZE_API_TOKEN
    if (!brazeToken) {
      return errorResponse('Braze API token not configured', 500)
    }

    // Call the Connected Content endpoint internally
    const baseUrl = url.origin
    const connectedContentUrl = `${baseUrl}/api/v1/users/${encodeURIComponent(externalId)}/games/${game.game_key}?token=${brazeToken}`

    const start = performance.now()
    const response = await fetch(connectedContentUrl, {
      headers: {
        'Accept': 'application/json',
      },
    })
    const latencyMs = Math.round(performance.now() - start)

    const responseBody = await response.json()

    return jsonResponse({
      success: true,
      data: {
        request: {
          url: `/api/v1/users/${externalId}/games/${game.game_key}`,
          game_name: game.name,
          game_key: game.game_key,
          external_id: externalId,
        },
        response: {
          status: response.status,
          latency_ms: latencyMs,
          headers: {
            'cache-control': response.headers.get('cache-control'),
            'x-ratelimit-remaining': response.headers.get('x-ratelimit-remaining'),
          },
          body: responseBody,
        },
      },
    }, 200, { cache: false })
  } catch (error) {
    log.api.error({ err: error }, 'Preview endpoint failed')
    return errorResponse('Preview request failed', 500)
  }
}
