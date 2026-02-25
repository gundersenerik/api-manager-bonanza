import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import { jsonResponse, errorResponse, requireRole } from '@/lib/api-auth'

interface RouteContext {
  params: Promise<{ id: string }>
}

/**
 * GET /api/admin/games/:id/triggers/history
 * Get trigger execution history for a game.
 *
 * Query params:
 * - trigger_id: optional — filter by specific trigger
 * - limit: number (default 20, max 100)
 */
export async function GET(request: NextRequest, { params }: RouteContext) {
  const result = await requireRole('user')
  if (result instanceof Response) return result

  const supabase = supabaseAdmin()
  const { id: gameId } = await params

  try {
    const { searchParams } = new URL(request.url)
    const triggerId = searchParams.get('trigger_id')
    const limit = Math.min(Number(searchParams.get('limit') || '20'), 100)

    let query = supabase
      .from('trigger_logs')
      .select('*')
      .eq('game_id', gameId)
      .order('triggered_at', { ascending: false })
      .limit(limit)

    if (triggerId) {
      query = query.eq('trigger_id', triggerId)
    }

    const { data: logs, error } = await query

    if (error) {
      return errorResponse(error.message, 500)
    }

    return jsonResponse({
      success: true,
      data: logs || [],
    })
  } catch (error) {
    return errorResponse('Failed to fetch trigger history', 500)
  }
}
