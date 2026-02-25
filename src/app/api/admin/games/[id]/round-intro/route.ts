import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import { jsonResponse, errorResponse, requireRole, requireAdmin } from '@/lib/api-auth'
import { generateRoundIntro, getRoundIntro } from '@/services/round-intro-service'
import { z } from 'zod'

interface RouteContext {
  params: Promise<{ id: string }>
}

/**
 * GET /api/admin/games/:id/round-intro
 * Fetch the stored round intro for the current (or specified) round
 */
export async function GET(request: NextRequest, { params }: RouteContext) {
  // Any invited user can view round intros
  const result = await requireRole('user')
  if (result instanceof Response) return result

  const { id } = await params

  // Optional round number from query params
  const roundParam = request.nextUrl.searchParams.get('round')
  const roundNumber = roundParam ? parseInt(roundParam, 10) : undefined

  try {
    const intro = await getRoundIntro(id, roundNumber)

    if (!intro) {
      return jsonResponse({
        success: true,
        data: null,
        message: 'No round intro found for this game/round',
      })
    }

    return jsonResponse({
      success: true,
      data: {
        id: intro.id,
        round_number: intro.round_number,
        intro_text: intro.intro_text,
        articles_used: intro.articles_used,
        vespa_query: intro.vespa_query,
        model_used: intro.model_used,
        generated_at: intro.generated_at,
      },
    })
  } catch (error) {
    return errorResponse('Failed to fetch round intro', 500)
  }
}

/**
 * POST /api/admin/games/:id/round-intro
 * Generate a new round intro (admin only)
 */
export async function POST(_request: NextRequest, { params }: RouteContext) {
  // Only admins can generate intros
  const result = await requireAdmin()
  if (result instanceof Response) return result

  const { id } = await params
  const supabase = supabaseAdmin()

  try {
    // Verify game exists
    const { data: game, error: gameError } = await supabase
      .from('games')
      .select('id, name, current_round')
      .eq('id', id)
      .single()

    if (gameError || !game) {
      return errorResponse('Game not found', 404)
    }

    // Generate the intro
    const intro = await generateRoundIntro(id)

    if (!intro) {
      return errorResponse('Failed to generate round intro. Check server logs for details.', 500)
    }

    return jsonResponse(
      {
        success: true,
        data: {
          id: intro.id,
          round_number: intro.round_number,
          intro_text: intro.intro_text,
          articles_used: intro.articles_used,
          vespa_query: intro.vespa_query,
          model_used: intro.model_used,
          generated_at: intro.generated_at,
        },
        message: `Round intro generated for ${game.name} round ${intro.round_number}`,
      },
      201,
      { cache: false }
    )
  } catch (error) {
    return errorResponse('Failed to generate round intro', 500)
  }
}

const UpdateIntroSchema = z.object({
  intro_text: z.string().min(1, 'Intro text cannot be empty').max(5000, 'Intro text too long'),
})

/**
 * PUT /api/admin/games/:id/round-intro
 * Edit an existing round intro's text (admin only).
 *
 * Body:
 * - intro_text: string — the new intro text
 *
 * Query params:
 * - round: number — the round number to edit (required)
 */
export async function PUT(request: NextRequest, { params }: RouteContext) {
  const result = await requireAdmin()
  if (result instanceof Response) return result

  const { id: gameId } = await params
  const supabase = supabaseAdmin()

  try {
    const body = await request.json()
    const { intro_text } = UpdateIntroSchema.parse(body)

    const roundParam = request.nextUrl.searchParams.get('round')
    if (!roundParam) {
      return errorResponse('Query param "round" is required', 400)
    }
    const roundNumber = parseInt(roundParam, 10)
    if (isNaN(roundNumber)) {
      return errorResponse('Invalid round number', 400)
    }

    // Update the intro text
    const { data: updated, error } = await supabase
      .from('round_intros')
      .update({
        intro_text,
        updated_at: new Date().toISOString(),
      })
      .eq('game_id', gameId)
      .eq('round_number', roundNumber)
      .select()
      .single()

    if (error || !updated) {
      return errorResponse('Round intro not found or update failed', 404)
    }

    return jsonResponse({
      success: true,
      data: {
        id: updated.id,
        round_number: updated.round_number,
        intro_text: updated.intro_text,
        articles_used: updated.articles_used,
        vespa_query: updated.vespa_query,
        model_used: updated.model_used,
        generated_at: updated.generated_at,
      },
      message: `Round intro updated for round ${roundNumber}`,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse(`Validation error: ${error.errors[0]?.message ?? 'Invalid input'}`, 400)
    }
    return errorResponse('Failed to update round intro', 500)
  }
}
