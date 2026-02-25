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

    // Sync ALL due games in one cron run (runs every 4 hours).
    // With page size 5000, each game uses ~3 API calls.
    // Budget: 6 runs × 3 games × 3 calls = 54/day (well under 100 limit).
    log.cron.info({
      gamesDue: gamesDue.length,
      games: gamesDue.map(g => ({ key: g.game_key, name: g.name })),
    }, `Syncing ${gamesDue.length} due games`)

    const results: Array<{
      gameKey: string
      success: boolean
      usersSynced: number
      elementsSynced: number
      error?: string
    }> = []

    for (let i = 0; i < gamesDue.length; i++) {
      const game = gamesDue[i]!

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
    }

    const jobDuration = Date.now() - jobStartTime
    const successCount = results.filter(r => r.success).length
    const totalUsers = results.reduce((sum, r) => sum + r.usersSynced, 0)
    const totalElements = results.reduce((sum, r) => sum + r.elementsSynced, 0)
    const allSuccess = successCount === results.length

    log.cron.info({
      gamesSynced: successCount,
      gamesFailed: results.length - successCount,
      totalUsers,
      totalElements,
      durationMs: jobDuration,
      results,
    }, `Sync job completed: ${successCount}/${results.length} games synced`)

    return jsonResponse({
      success: allSuccess,
      message: allSuccess
        ? `Synced ${successCount} games successfully`
        : `Synced ${successCount}/${results.length} games (${results.length - successCount} failed)`,
      gamesSynced: successCount,
      gamesDueTotal: gamesDue.length,
      usersSynced: totalUsers,
      elementsSynced: totalElements,
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
