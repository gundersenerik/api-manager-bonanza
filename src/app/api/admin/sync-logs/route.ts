import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import { jsonResponse, errorResponse, requireRole } from '@/lib/api-auth'

/**
 * GET /api/admin/sync-logs
 * List all sync logs with game info
 */
export async function GET() {
  // Any invited user can view sync logs
  const result = await requireRole('user')
  if (result instanceof Response) return result

  const supabase = supabaseAdmin()

  try {
    const { data: logs, error } = await supabase
      .from('sync_logs')
      .select(`
        *,
        game:games(name, game_key)
      `)
      .order('started_at', { ascending: false })
      .limit(100)

    if (error) {
      return errorResponse(error.message, 500)
    }

    return jsonResponse({
      success: true,
      data: logs || [],
    })
  } catch (error) {
    return errorResponse('Failed to fetch sync logs', 500)
  }
}

/**
 * DELETE /api/admin/sync-logs
 * Clear sync logs. Optional ?gameId=xxx to clear for a specific game only.
 */
export async function DELETE(request: NextRequest) {
  const result = await requireRole('user')
  if (result instanceof Response) return result

  const supabase = supabaseAdmin()
  const gameId = request.nextUrl.searchParams.get('gameId')

  try {
    // Count first, then delete (Supabase delete doesn't reliably return count)
    let countQuery = supabase.from('sync_logs').select('id', { count: 'exact', head: true })
    if (gameId) {
      countQuery = countQuery.eq('game_id', gameId)
    }
    const { count } = await countQuery

    // Now delete
    let deleteQuery = supabase.from('sync_logs').delete()
    if (gameId) {
      deleteQuery = deleteQuery.eq('game_id', gameId)
    } else {
      // Delete all — Supabase requires a filter, so use an always-true condition
      deleteQuery = deleteQuery.gte('started_at', '1970-01-01')
    }
    const { error } = await deleteQuery

    if (error) {
      return errorResponse(error.message, 500)
    }

    return jsonResponse({
      success: true,
      message: `Cleared ${count ?? 0} sync logs${gameId ? ` for game ${gameId}` : ''}`,
      deletedCount: count ?? 0,
    })
  } catch (error) {
    return errorResponse('Failed to clear sync logs', 500)
  }
}
