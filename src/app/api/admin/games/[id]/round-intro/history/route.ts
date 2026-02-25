import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import { jsonResponse, errorResponse, requireRole } from '@/lib/api-auth'

interface RouteContext {
  params: Promise<{ id: string }>
}

/**
 * GET /api/admin/games/:id/round-intro/history
 * List all round intros for a game, ordered by round number descending.
 *
 * Query params:
 * - limit: number (default 50, max 100)
 */
export async function GET(request: NextRequest, { params }: RouteContext) {
  const result = await requireRole('user')
  if (result instanceof Response) return result

  const supabase = supabaseAdmin()
  const { id: gameId } = await params

  try {
    const { searchParams } = new URL(request.url)
    const limit = Math.min(Number(searchParams.get('limit') || '50'), 100)

    const { data: intros, error } = await supabase
      .from('round_intros')
      .select('id, round_number, intro_text, articles_used, model_used, generated_at, created_at, updated_at')
      .eq('game_id', gameId)
      .order('round_number', { ascending: false })
      .limit(limit)

    if (error) {
      return errorResponse(error.message, 500)
    }

    return jsonResponse({
      success: true,
      data: intros || [],
    })
  } catch (error) {
    return errorResponse('Failed to fetch round intro history', 500)
  }
}
