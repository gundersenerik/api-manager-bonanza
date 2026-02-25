import { NextRequest } from 'next/server'
import { syncService } from '@/services/sync-service'
import { jsonResponse, errorResponse } from '@/lib/api-auth'
import { log } from '@/lib/logger'

// Force dynamic rendering to prevent build-time execution
export const dynamic = 'force-dynamic'

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

    // Only sync ONE game per cron run to spread load over time.
    // Cron runs every 15 min, so games naturally stagger ~15 min apart.
    const game = gamesDue[0]!  // Safe: we checked gamesDue.length > 0 above

    log.cron.info({
      gamesDue: gamesDue.length,
      syncing: { key: game.game_key, name: game.name },
      queued: gamesDue.slice(1).map(g => ({ key: g.game_key, name: g.name })),
    }, `Syncing 1 of ${gamesDue.length} due games`)

    const result = await syncService.syncGame(game, 'scheduled')
    const jobDuration = Date.now() - jobStartTime

    if (result.success) {
      log.cron.info({
        gameKey: game.game_key,
        usersSynced: result.usersSynced,
        elementsSynced: result.elementsSynced,
        durationMs: jobDuration,
        remainingGames: gamesDue.length - 1,
      }, 'Sync job completed successfully')
    } else {
      log.cron.warn({
        gameKey: game.game_key,
        error: result.error,
        durationMs: jobDuration,
        remainingGames: gamesDue.length - 1,
      }, 'Sync job completed with failure')
    }

    return jsonResponse({
      success: result.success,
      message: result.success
        ? `Synced ${game.game_key} successfully`
        : `Failed to sync ${game.game_key}: ${result.error}`,
      gamesSynced: result.success ? 1 : 0,
      gamesDueTotal: gamesDue.length,
      gamesRemaining: gamesDue.length - 1,
      usersSynced: result.usersSynced || 0,
      elementsSynced: result.elementsSynced || 0,
      durationMs: jobDuration,
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
