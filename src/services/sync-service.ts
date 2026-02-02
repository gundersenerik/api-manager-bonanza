import { supabaseAdmin } from '@/lib/supabase/server'
import { createSwushClient } from './swush-client'
import { log } from '@/lib/logger'
import {
  Game,
  SwushElement,
  SwushUser,
  SwushRound,
} from '@/types'

// Configuration constants
const BATCH_SIZE = 100 // Number of items to upsert in a single batch
const GAME_BASE_URL = process.env.GAME_BASE_URL || 'https://manager.aftonbladet.se/se'

interface SyncResult {
  success: boolean
  gamesSynced?: number
  elementsSynced?: number
  usersSynced?: number
  error?: string
}

interface SyncLogEntry {
  gameId: string
  syncType: 'manual' | 'scheduled'
  status: 'started' | 'completed' | 'failed'
  usersSynced: number
  elementsSynced: number
  errorMessage?: string
}

/**
 * Sync Service
 * Handles syncing data from SWUSH API to Supabase
 */
export class SyncService {
  private get supabase() {
    return supabaseAdmin()
  }
  private get swush() {
    return createSwushClient()
  }

  /**
   * Create a sync log entry
   */
  private async createSyncLog(entry: SyncLogEntry): Promise<string | null> {
    const { data, error } = await this.supabase
      .from('sync_logs')
      .insert({
        game_id: entry.gameId,
        sync_type: entry.syncType,
        status: entry.status,
        users_synced: entry.usersSynced,
        elements_synced: entry.elementsSynced,
        error_message: entry.errorMessage,
        started_at: new Date().toISOString(),
      })
      .select('id')
      .single()

    if (error) {
      log.sync.error({ err: error }, 'Failed to create sync log')
      return null
    }

    return data.id
  }

  /**
   * Update a sync log entry
   */
  private async updateSyncLog(
    logId: string,
    updates: Partial<SyncLogEntry> & { completedAt?: string }
  ): Promise<void> {
    const { error } = await this.supabase
      .from('sync_logs')
      .update({
        status: updates.status,
        users_synced: updates.usersSynced,
        elements_synced: updates.elementsSynced,
        error_message: updates.errorMessage,
        completed_at: updates.completedAt,
      })
      .eq('id', logId)

    if (error) {
      log.sync.error({ err: error }, 'Failed to update sync log')
    }
  }

  /**
   * Find the current round from rounds array
   */
  private findCurrentRound(rounds: SwushRound[]): SwushRound | null {
    return rounds.find(r => r.state === 'CurrentOpen') || null
  }

  /**
   * Sync game details from SWUSH
   */
  async syncGameDetails(game: Game): Promise<SyncResult> {
    log.sync.info({ gameKey: game.game_key }, 'Syncing game details')

    const response = await this.swush.getGame(game.subsite_key, game.game_key)

    if (response.error || !response.data) {
      return { success: false, error: response.error || 'Failed to fetch game' }
    }

    const swushGame = response.data
    const currentRound = this.findCurrentRound(swushGame.rounds)

    const { error } = await this.supabase
      .from('games')
      .update({
        swush_game_id: swushGame.gameId,
        current_round: swushGame.currentRoundIndex,
        total_rounds: swushGame.rounds.length,
        round_state: currentRound?.state || null,
        next_trade_deadline: currentRound?.tradeCloses || null,
        users_total: swushGame.userteamsCount,
        game_url: `${GAME_BASE_URL}/${game.game_key}`,
        last_synced_at: new Date().toISOString(),
      })
      .eq('id', game.id)

    if (error) {
      log.sync.error({ err: error }, 'Failed to update game')
      return { success: false, error: error.message }
    }

    return { success: true, gamesSynced: 1 }
  }

  /**
   * Sync all elements (players) for a game
   */
  async syncElements(game: Game): Promise<SyncResult> {
    log.sync.info({ gameKey: game.game_key }, 'Syncing elements')

    const response = await this.swush.getElements(game.subsite_key, game.game_key)

    if (response.error || !response.data) {
      return { success: false, error: response.error || 'Failed to fetch elements' }
    }

    const elements = response.data
    let syncedCount = 0

    // Upsert elements in batches
    for (let i = 0; i < elements.length; i += BATCH_SIZE) {
      const batch = elements.slice(i, i + BATCH_SIZE)

      const upsertData = batch.map((el: SwushElement) => ({
        game_id: game.id,
        element_id: el.elementId,
        short_name: el.shortName,
        full_name: el.fullName,
        team_name: el.teamName || '',
        image_url: el.imageUrl,
        popularity: el.popularity,
        trend: el.trend,
        growth: el.growth,
        total_growth: el.totalGrowth,
        value: el.value,
        updated_at: new Date().toISOString(),
      }))

      const { error } = await this.supabase
        .from('elements')
        .upsert(upsertData, {
          onConflict: 'game_id,element_id',
        })

      if (error) {
        log.sync.error({ err: error }, 'Failed to upsert elements batch')
        continue
      }

      syncedCount += batch.length
    }

    log.sync.info({ count: syncedCount }, 'Synced elements')
    return { success: true, elementsSynced: syncedCount }
  }

  /**
   * Sync all users for a game
   */
  async syncUsers(
    game: Game,
    onProgress?: (current: number, total: number) => void
  ): Promise<SyncResult> {
    log.sync.info({ gameKey: game.game_key }, 'Syncing users')

    const response = await this.swush.getAllUsers(
      game.subsite_key,
      game.game_key,
      onProgress
    )

    if (response.error || !response.data) {
      return { success: false, error: response.error || 'Failed to fetch users' }
    }

    const users = response.data.users
    let syncedCount = 0

    // Upsert users in batches
    for (let i = 0; i < users.length; i += BATCH_SIZE) {
      const batch = users.slice(i, i + BATCH_SIZE)

      const upsertData = batch
        .filter((user: SwushUser) => user.externalId) // Only sync users with external ID
        .map((user: SwushUser) => {
          const userteam = user.userteams?.[0] // Get primary team

          return {
            external_id: user.externalId,
            game_id: game.id,
            swush_user_id: user.id,
            team_name: userteam?.name ?? user.name,
            score: userteam?.score ?? 0,
            rank: userteam?.rank ?? null,
            round_score: userteam?.roundScore ?? 0,
            round_rank: userteam?.roundRank ?? null,
            round_jump: userteam?.roundJump ?? 0,
            injured_count: user.injured ?? 0,
            suspended_count: user.suspended ?? 0,
            lineup_element_ids: userteam?.lineupElementIds ?? [],
            synced_at: new Date().toISOString(),
          }
        })

      if (upsertData.length === 0) continue

      const { error } = await this.supabase
        .from('user_game_stats')
        .upsert(upsertData, {
          onConflict: 'external_id,game_id',
        })

      if (error) {
        log.sync.error({ err: error }, 'Failed to upsert users batch')
        continue
      }

      syncedCount += upsertData.length
    }

    log.sync.info({ count: syncedCount }, 'Synced users')
    return { success: true, usersSynced: syncedCount }
  }

  /**
   * Run a full sync for a game (game details + elements + users)
   */
  async syncGame(
    game: Game,
    syncType: 'manual' | 'scheduled' = 'manual'
  ): Promise<SyncResult> {
    log.sync.info({ gameKey: game.game_key }, 'Starting full sync')

    // Create sync log
    const logId = await this.createSyncLog({
      gameId: game.id,
      syncType,
      status: 'started',
      usersSynced: 0,
      elementsSynced: 0,
    })

    try {
      // Sync game details
      const gameResult = await this.syncGameDetails(game)
      if (!gameResult.success) {
        throw new Error(gameResult.error)
      }

      // Sync elements
      const elementsResult = await this.syncElements(game)
      if (!elementsResult.success) {
        throw new Error(elementsResult.error)
      }

      // Sync users
      const usersResult = await this.syncUsers(game)
      if (!usersResult.success) {
        throw new Error(usersResult.error)
      }

      // Update sync log
      if (logId) {
        await this.updateSyncLog(logId, {
          status: 'completed',
          elementsSynced: elementsResult.elementsSynced || 0,
          usersSynced: usersResult.usersSynced || 0,
          completedAt: new Date().toISOString(),
        })
      }

      log.sync.info({ gameKey: game.game_key }, 'Completed sync')

      return {
        success: true,
        gamesSynced: 1,
        elementsSynced: elementsResult.elementsSynced,
        usersSynced: usersResult.usersSynced,
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      log.sync.error({ gameKey: game.game_key, error: errorMessage }, 'Failed sync')

      // Update sync log with error
      if (logId) {
        await this.updateSyncLog(logId, {
          status: 'failed',
          errorMessage,
          completedAt: new Date().toISOString(),
        })
      }

      return { success: false, error: errorMessage }
    }
  }

  /**
   * Sync all active games
   */
  async syncAllActiveGames(syncType: 'manual' | 'scheduled' = 'scheduled'): Promise<SyncResult> {
    log.sync.info('Starting sync for all active games')

    const { data: games, error } = await this.supabase
      .from('games')
      .select('*')
      .eq('is_active', true)

    if (error) {
      log.sync.error({ err: error }, 'Failed to fetch games')
      return { success: false, error: error.message }
    }

    if (!games || games.length === 0) {
      log.sync.info('No active games to sync')
      return { success: true, gamesSynced: 0 }
    }

    let totalGames = 0
    let totalElements = 0
    let totalUsers = 0

    for (const game of games) {
      const result = await this.syncGame(game as Game, syncType)
      if (result.success) {
        totalGames++
        totalElements += result.elementsSynced || 0
        totalUsers += result.usersSynced || 0
      }
    }

    log.sync.info({ totalGames }, 'Completed sync for all games')

    return {
      success: true,
      gamesSynced: totalGames,
      elementsSynced: totalElements,
      usersSynced: totalUsers,
    }
  }

  /**
   * Get games that need syncing based on their sync interval
   */
  async getGamesDueForSync(): Promise<Game[]> {
    const { data: games, error } = await this.supabase
      .from('games')
      .select('*')
      .eq('is_active', true)

    if (error || !games) {
      log.sync.error({ err: error }, 'Failed to fetch games for sync check')
      return []
    }

    const now = new Date()

    return games.filter((game: Game) => {
      if (!game.last_synced_at) return true // Never synced

      const lastSync = new Date(game.last_synced_at)
      const minutesSinceSync = (now.getTime() - lastSync.getTime()) / (1000 * 60)

      return minutesSinceSync >= game.sync_interval_minutes
    })
  }
}

// Export singleton instance
export const syncService = new SyncService()
