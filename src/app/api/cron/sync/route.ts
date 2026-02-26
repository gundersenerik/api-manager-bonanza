import { NextRequest } from 'next/server'
import { syncService } from '@/services/sync-service'
import { getRemainingBudget, BUDGET_EXHAUSTED_PREFIX } from '@/services/swush-client'
import { jsonResponse, errorResponse } from '@/lib/api-auth'
import { log } from '@/lib/logger'

// Force dynamic rendering to prevent build-time execution
export const dynamic = 'force-dynamic'

// Allow up to 5 minutes for large syncs (requires Vercel Pro; Hobby is capped at 60s)
export const maxDuration = 300

/**
 * POST /api/cron/sync
 *
 * Scheduled job to sync data from SWUSH for games due for sync
 * Protected by CRON_SECRET
 */
export async function POST(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return errorResponse('Unauthorized', 401)
  }

  const jobStartTime = Date.now()
  log.cron.info('Starting scheduled sync job')

  try {
    // Get games that are due for sync
    const gamesDue = await syncService.getGamesDueForSync()

    if (gamesDue.length === 0) {
      log.cron.info('No games due for sync')
      return jsonResponse({
        success: true,
        message: 'No games due for sync',
        gamesChecked: 0,
        gamesSynced: 0,
      })
    }

    // Sync all due games with circuit-breaker budget checks.
    // Each game uses: 1 (game details) + 1 (elements) + ceil(users / 5000) (user pages) API calls.
    // Event-driven scheduling: routine 1×/day + critical periods (30-min intervals near events).
    // Typical budget: ~14 routine + ~35 event-driven = ~49 calls/day (budget limit: 90).
    const remainingBudget = await getRemainingBudget()
    log.cron.info({
      gamesDue: gamesDue.length,
      remainingBudget,
      games: gamesDue.map(g => ({ key: g.game_key, name: g.name, usersTotal: g.users_total })),
    }, `Syncing ${gamesDue.length} due games (${remainingBudget} API calls remaining)`)

    const results: Array<{
      gameKey: string
      success: boolean
      usersSynced: number
      elementsSynced: number
      error?: string
      skipped?: boolean
    }> = []

    let budgetExhausted = false

    for (let i = 0; i < gamesDue.length; i++) {
      const game = gamesDue[i]!

      // Circuit breaker: check if we have enough budget for this game
      const estimatedCalls = 2 + Math.ceil((game.users_total || 5000) / 5000)
      const currentBudget = await getRemainingBudget()

      if (currentBudget < estimatedCalls) {
        log.cron.warn({
          gameKey: game.game_key,
          estimatedCalls,
          currentBudget,
        }, `Skipping game — insufficient budget (need ${estimatedCalls}, have ${currentBudget})`)
        results.push({
          gameKey: game.game_key,
          success: false,
          usersSynced: 0,
          elementsSynced: 0,
          error: `Skipped: insufficient budget (need ${estimatedCalls}, have ${currentBudget})`,
          skipped: true,
        })
        continue
      }

      // Add 2-second delay between games to respect 1 req/sec rate limit
      if (i > 0) {
        log.cron.debug(`Waiting 2s before syncing next game (${game.game_key})`)
        await new Promise(resolve => setTimeout(resolve, 2000))
      }

      const result = await syncService.syncGame(game, 'scheduled')
      results.push({
        gameKey: game.game_key,
        success: result.success,
        usersSynced: result.usersSynced || 0,
        elementsSynced: result.elementsSynced || 0,
        error: result.error,
      })

      // If a game sync returns budget exhaustion, stop the entire cron run
      if (!result.success && result.error?.includes(BUDGET_EXHAUSTED_PREFIX)) {
        log.cron.warn({
          gameKey: game.game_key,
          completedGames: i + 1,
          totalGames: gamesDue.length,
        }, 'Budget exhausted during sync — stopping cron run')
        budgetExhausted = true
        break
      }
    }

    const jobDuration = Date.now() - jobStartTime
    const successCount = results.filter(r => r.success).length
    const skippedCount = results.filter(r => r.skipped).length
    const totalUsers = results.reduce((sum, r) => sum + r.usersSynced, 0)
    const totalElements = results.reduce((sum, r) => sum + r.elementsSynced, 0)
    const finalBudget = await getRemainingBudget()
    const allSuccess = successCount === results.length

    log.cron.info({
      gamesSynced: successCount,
      gamesSkipped: skippedCount,
      gamesFailed: results.length - successCount - skippedCount,
      budgetExhausted,
      totalUsers,
      totalElements,
      remainingBudget: finalBudget,
      durationMs: jobDuration,
      results,
    }, `Sync job completed: ${successCount}/${results.length} games synced`)

    return jsonResponse({
      success: allSuccess,
      message: budgetExhausted
        ? `Budget exhausted — synced ${successCount}/${gamesDue.length} games before stopping`
        : allSuccess
          ? `Synced ${successCount} games successfully`
          : `Synced ${successCount}/${results.length} games (${results.length - successCount} failed)`,
      gamesSynced: successCount,
      gamesSkipped: skippedCount,
      gamesDueTotal: gamesDue.length,
      usersSynced: totalUsers,
      elementsSynced: totalElements,
      remainingBudget: finalBudget,
      durationMs: jobDuration,
      results,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    const jobDuration = Date.now() - jobStartTime
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    log.cron.error({
      err: error,
      durationMs: jobDuration,
      errorMessage,
    }, 'Sync job crashed')
    return errorResponse(`Sync job failed: ${errorMessage}`, 500)
  }
}

// Also support GET for easy testing
export async function GET(request: NextRequest) {
  return POST(request)
}
