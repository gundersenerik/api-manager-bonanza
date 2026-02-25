import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import { jsonResponse, errorResponse, requireAdmin } from '@/lib/api-auth'
import { log } from '@/lib/logger'
import { Game, GameTrigger } from '@/types'
import { z } from 'zod'

interface RouteContext {
  params: Promise<{ id: string }>
}

const FireTriggerSchema = z.object({
  trigger_id: z.string().uuid(),
  dry_run: z.boolean().default(false),
})

/**
 * POST /api/admin/games/:id/triggers/fire
 * Manually fire (or dry-run) a trigger for a game.
 *
 * Body:
 * - trigger_id: UUID of the trigger to fire
 * - dry_run: boolean — if true, returns what WOULD be sent without actually calling Braze
 */
export async function POST(request: NextRequest, { params }: RouteContext) {
  const result = await requireAdmin()
  if (result instanceof Response) return result

  const supabase = supabaseAdmin()
  const { id: gameId } = await params

  try {
    const body = await request.json()
    const { trigger_id, dry_run } = FireTriggerSchema.parse(body)

    // Fetch game
    const { data: game, error: gameError } = await supabase
      .from('games')
      .select('*')
      .eq('id', gameId)
      .single()

    if (gameError || !game) {
      return errorResponse('Game not found', 404)
    }

    // Fetch trigger
    const { data: trigger, error: triggerError } = await supabase
      .from('game_triggers')
      .select('*')
      .eq('id', trigger_id)
      .eq('game_id', gameId)
      .single()

    if (triggerError || !trigger) {
      return errorResponse('Trigger not found', 404)
    }

    // Build the trigger properties that would be sent to Braze
    const triggerProperties = {
      game_key: (game as Game).game_key,
      game_name: (game as Game).name,
      current_round: (game as Game).current_round,
      total_rounds: (game as Game).total_rounds,
      trade_deadline: (game as Game).next_trade_deadline,
      trigger_type: (trigger as GameTrigger).trigger_type,
    }

    // For round_started triggers, try to include round intro
    let roundIntroText: string | null = null
    if ((trigger as GameTrigger).trigger_type === 'round_started') {
      try {
        const { getRoundIntro } = await import('@/services/round-intro-service')
        const intro = await getRoundIntro((game as Game).id, (game as Game).current_round)
        if (intro) {
          roundIntroText = intro.intro_text
        }
      } catch {
        // Non-blocking
      }
    }

    const fullProperties = {
      ...triggerProperties,
      ...(roundIntroText ? { round_intro: roundIntroText } : {}),
    }

    // If dry run, just return what would be sent
    if (dry_run) {
      return jsonResponse({
        success: true,
        data: {
          mode: 'dry_run',
          campaign_id: (trigger as GameTrigger).braze_campaign_id,
          trigger_properties: fullProperties,
          braze_payload: {
            campaign_id: (trigger as GameTrigger).braze_campaign_id,
            trigger_properties: fullProperties,
            broadcast: true,
          },
        },
        message: 'Dry run — no campaign was sent',
      })
    }

    // Actually fire the trigger via Braze API
    const brazeUrl = process.env.BRAZE_REST_ENDPOINT
    const brazeKey = process.env.BRAZE_API_KEY

    if (!brazeUrl || !brazeKey) {
      // Log as skipped
      await logManualFire(supabase, gameId, trigger_id, (trigger as GameTrigger).trigger_type, (game as Game).current_round, 'skipped', null, 'No Braze credentials configured')

      return jsonResponse({
        success: true,
        data: {
          mode: 'live',
          status: 'skipped',
          reason: 'No Braze credentials configured',
          trigger_properties: fullProperties,
        },
        message: 'Trigger skipped — no Braze credentials',
      })
    }

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 30000)

    const response = await fetch(`${brazeUrl}/campaigns/trigger/send`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${brazeKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        campaign_id: (trigger as GameTrigger).braze_campaign_id,
        trigger_properties: fullProperties,
        broadcast: true,
      }),
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    let brazeData: Record<string, unknown>
    try {
      brazeData = await response.json()
    } catch {
      brazeData = { message: 'Non-JSON response from Braze' }
    }

    const fired = response.ok

    // Log the manual trigger execution
    await logManualFire(
      supabase,
      gameId,
      trigger_id,
      (trigger as GameTrigger).trigger_type,
      (game as Game).current_round,
      fired ? 'triggered' : 'failed',
      brazeData,
      fired ? null : (brazeData.message as string) || 'Braze API error'
    )

    // Update last_triggered fields on the trigger
    if (fired) {
      await supabase
        .from('game_triggers')
        .update({
          last_triggered_at: new Date().toISOString(),
          last_triggered_round: (game as Game).current_round,
        })
        .eq('id', trigger_id)
    }

    log.braze.info({ gameId, triggerId: trigger_id, fired, dry_run: false }, 'Manual trigger fire')

    return jsonResponse({
      success: fired,
      data: {
        mode: 'live',
        status: fired ? 'triggered' : 'failed',
        braze_response: brazeData,
        trigger_properties: fullProperties,
      },
      message: fired ? 'Campaign triggered successfully' : 'Campaign trigger failed',
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse(`Validation error: ${error.errors[0]?.message ?? 'Invalid input'}`, 400)
    }
    log.braze.error({ err: error }, 'Manual trigger fire failed')
    return errorResponse('Failed to fire trigger', 500)
  }
}

async function logManualFire(
  supabase: ReturnType<typeof supabaseAdmin>,
  gameId: string,
  triggerId: string,
  triggerType: string,
  roundIndex: number,
  status: 'triggered' | 'failed' | 'skipped',
  brazeResponse: Record<string, unknown> | null,
  errorMessage: string | null,
) {
  try {
    await supabase
      .from('trigger_logs')
      .insert({
        game_id: gameId,
        trigger_id: triggerId,
        trigger_type: triggerType,
        round_index: roundIndex,
        status,
        braze_response: brazeResponse,
        error_message: errorMessage,
      })
  } catch (err) {
    log.braze.warn({ err }, 'Failed to log manual trigger fire')
  }
}
