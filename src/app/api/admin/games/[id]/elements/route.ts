import { jsonResponse, errorResponse, requireAdminAuth } from '@/lib/api-auth'
import { supabaseAdmin } from '@/lib/supabase/server'
import { log } from '@/lib/logger'

export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/games/[id]/elements
 * Browse all elements (players) for a game with search, sort, filter, pagination.
 *
 * Query params:
 * - search: string (filters by short_name, full_name, or team_name)
 * - sort_by: 'trend' | 'growth' | 'total_growth' | 'value' | 'popularity' | 'full_name' (default: 'trend')
 * - sort_order: 'asc' | 'desc' (default: 'desc')
 * - team: string (filter by team_name, exact match)
 * - status: 'all' | 'injured' | 'suspended' | 'active' (default: 'all')
 * - limit: number (default 50, max 200)
 * - offset: number (default 0)
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

    const search = url.searchParams.get('search') || ''
    const sortBy = url.searchParams.get('sort_by') || 'trend'
    const sortOrder = url.searchParams.get('sort_order') || 'desc'
    const team = url.searchParams.get('team') || ''
    const status = url.searchParams.get('status') || 'all'
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 200)
    const offset = parseInt(url.searchParams.get('offset') || '0')

    const admin = supabaseAdmin()

    // Verify game exists
    const { data: game, error: gameError } = await admin
      .from('games')
      .select('id, name, game_key')
      .eq('id', id)
      .single()

    if (gameError || !game) {
      return errorResponse('Game not found', 404)
    }

    // Validate sort_by field
    const validSortFields = ['trend', 'growth', 'total_growth', 'value', 'popularity', 'full_name', 'team_name']
    const safeSortBy = validSortFields.includes(sortBy) ? sortBy : 'trend'
    const safeSortOrder = sortOrder === 'asc'

    // Build query
    let query = admin
      .from('elements')
      .select('*', { count: 'exact' })
      .eq('game_id', id)

    // Search filter (case-insensitive)
    if (search) {
      query = query.or(`full_name.ilike.%${search}%,short_name.ilike.%${search}%,team_name.ilike.%${search}%`)
    }

    // Team filter
    if (team) {
      query = query.eq('team_name', team)
    }

    // Status filter
    if (status === 'injured') {
      query = query.eq('is_injured', true)
    } else if (status === 'suspended') {
      query = query.eq('is_suspended', true)
    } else if (status === 'active') {
      query = query.eq('is_injured', false).eq('is_suspended', false)
    }

    // Sort and paginate
    query = query
      .order(safeSortBy, { ascending: safeSortOrder })
      .range(offset, offset + limit - 1)

    const { data: elements, error, count } = await query

    if (error) {
      log.api.error({ err: error }, 'Failed to fetch elements')
      return errorResponse('Failed to fetch elements', 500)
    }

    // Get unique team names for filter dropdown
    const { data: teams } = await admin
      .from('elements')
      .select('team_name')
      .eq('game_id', id)
      .not('team_name', 'is', null)
      .order('team_name')

    const uniqueTeams = [...new Set((teams || []).map((t: { team_name: string }) => t.team_name))].filter(Boolean)

    // Aggregate stats
    const { data: statsData } = await admin
      .from('elements')
      .select('is_injured, is_suspended')
      .eq('game_id', id)

    const totalElements = count || 0
    const injuredCount = (statsData || []).filter((e: { is_injured: boolean }) => e.is_injured).length
    const suspendedCount = (statsData || []).filter((e: { is_suspended: boolean }) => e.is_suspended).length

    return jsonResponse({
      success: true,
      data: {
        elements: elements || [],
        game: {
          id: game.id,
          name: game.name,
          game_key: game.game_key,
        },
        teams: uniqueTeams,
        stats: {
          total: totalElements,
          injured: injuredCount,
          suspended: suspendedCount,
          active: totalElements - injuredCount - suspendedCount,
        },
        pagination: {
          total: totalElements,
          limit,
          offset,
          has_more: offset + limit < totalElements,
        },
      },
    }, 200, { cache: false })
  } catch (error) {
    log.api.error({ err: error }, 'Elements endpoint failed')
    return errorResponse('Failed to load elements', 500)
  }
}
