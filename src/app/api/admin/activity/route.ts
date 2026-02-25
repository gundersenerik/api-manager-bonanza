import { jsonResponse, errorResponse, requireAdminAuth } from '@/lib/api-auth'
import { supabaseAdmin } from '@/lib/supabase/server'
import { log } from '@/lib/logger'
import { ActivityFeedItem, ActivityEntityType } from '@/types'

export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/activity
 * Aggregated activity feed — merges sync_logs, trigger_logs, activity_log
 *
 * Query params:
 * - limit: number (default 50, max 200)
 * - offset: number (default 0)
 * - type: 'sync' | 'trigger' | 'admin_action' | 'all' (default 'all')
 * - game_id: UUID (optional, filter by game)
 * - severity: 'info' | 'success' | 'warning' | 'error' | 'all' (default 'all')
 */
export async function GET(request: Request) {
  const authError = await requireAdminAuth()
  if (authError) return authError

  try {
    const url = new URL(request.url)
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 200)
    const offset = parseInt(url.searchParams.get('offset') || '0')
    const typeFilter = url.searchParams.get('type') || 'all'
    const gameId = url.searchParams.get('game_id')
    const severityFilter = url.searchParams.get('severity') || 'all'

    const admin = supabaseAdmin()

    // Build queries for each source in parallel
    const results = await Promise.all([
      // 1. Sync logs → activity items
      typeFilter === 'all' || typeFilter === 'sync'
        ? fetchSyncActivity(admin, gameId)
        : Promise.resolve([]),

      // 2. Trigger logs → activity items
      typeFilter === 'all' || typeFilter === 'trigger'
        ? fetchTriggerActivity(admin, gameId)
        : Promise.resolve([]),

      // 3. Admin action logs → activity items
      typeFilter === 'all' || typeFilter === 'admin_action'
        ? fetchAdminActivity(admin, gameId)
        : Promise.resolve([]),
    ])

    // Merge and sort by timestamp descending
    let allItems: ActivityFeedItem[] = results.flat()

    // Filter by severity
    if (severityFilter !== 'all') {
      allItems = allItems.filter((item) => item.severity === severityFilter)
    }

    // Sort by timestamp descending (newest first)
    allItems.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

    // Paginate
    const total = allItems.length
    const paged = allItems.slice(offset, offset + limit)

    return jsonResponse({
      success: true,
      data: {
        items: paged,
        total,
        limit,
        offset,
        has_more: offset + limit < total,
      },
    }, 200, { cache: false })
  } catch (error) {
    log.api.error({ err: error }, 'Activity feed failed')
    return errorResponse('Failed to load activity feed', 500)
  }
}

async function fetchSyncActivity(admin: any, gameId: string | null): Promise<ActivityFeedItem[]> {
  let query = admin
    .from('sync_logs')
    .select('id, game_id, sync_type, status, users_synced, elements_synced, error_message, started_at, games(name, game_key)')
    .order('started_at', { ascending: false })
    .limit(100)

  if (gameId) {
    query = query.eq('game_id', gameId)
  }

  const { data, error } = await query
  if (error) {
    log.api.warn({ err: error }, 'Failed to fetch sync logs for activity')
    return []
  }

  return (data || []).map((row: SyncLogRow) => {
    const gameName = row.games?.name || 'Unknown game'
    const isManual = row.sync_type === 'manual'
    const status = row.status

    let action: string
    let description: string
    let severity: ActivityFeedItem['severity']

    if (status === 'completed') {
      action = 'sync_completed'
      description = `${isManual ? 'Manual' : 'Scheduled'} sync completed — ${row.users_synced} users, ${row.elements_synced} elements`
      severity = 'success'
    } else if (status === 'failed') {
      action = 'sync_failed'
      description = `${isManual ? 'Manual' : 'Scheduled'} sync failed${row.error_message ? `: ${row.error_message}` : ''}`
      severity = 'error'
    } else {
      action = 'sync_started'
      description = `${isManual ? 'Manual' : 'Scheduled'} sync started`
      severity = 'info'
    }

    return {
      id: `sync-${row.id}`,
      type: 'sync' as const,
      action,
      description,
      entity_type: 'sync' as ActivityEntityType,
      entity_id: row.id,
      entity_name: gameName,
      game_id: row.game_id,
      game_name: gameName,
      severity,
      actor: isManual ? 'Admin' : 'Cron',
      metadata: {
        sync_type: row.sync_type,
        users_synced: row.users_synced,
        elements_synced: row.elements_synced,
        game_key: row.games?.game_key,
      },
      timestamp: row.started_at,
    }
  })
}

async function fetchTriggerActivity(admin: any, gameId: string | null): Promise<ActivityFeedItem[]> {
  let query = admin
    .from('trigger_logs')
    .select('id, game_id, trigger_type, round_index, status, error_message, triggered_at, games(name, game_key)')
    .order('triggered_at', { ascending: false })
    .limit(100)

  if (gameId) {
    query = query.eq('game_id', gameId)
  }

  const { data, error } = await query
  if (error) {
    log.api.warn({ err: error }, 'Failed to fetch trigger logs for activity')
    return []
  }

  const triggerTypeLabels: Record<string, string> = {
    deadline_reminder_24h: 'Deadline Reminder',
    round_started: 'Round Started',
    round_ended: 'Round Ended',
  }

  return (data || []).map((row: TriggerLogRow) => {
    const gameName = row.games?.name || 'Unknown game'
    const triggerLabel = triggerTypeLabels[row.trigger_type] || row.trigger_type
    const status = row.status

    let action: string
    let description: string
    let severity: ActivityFeedItem['severity']

    if (status === 'triggered') {
      action = 'trigger_fired'
      description = `${triggerLabel} trigger fired for round ${row.round_index}`
      severity = 'success'
    } else if (status === 'failed') {
      action = 'trigger_failed'
      description = `${triggerLabel} trigger failed for round ${row.round_index}${row.error_message ? `: ${row.error_message}` : ''}`
      severity = 'error'
    } else {
      action = 'trigger_skipped'
      description = `${triggerLabel} trigger skipped for round ${row.round_index}`
      severity = 'info'
    }

    return {
      id: `trigger-${row.id}`,
      type: 'trigger' as const,
      action,
      description,
      entity_type: 'trigger' as ActivityEntityType,
      entity_id: row.id,
      entity_name: gameName,
      game_id: row.game_id,
      game_name: gameName,
      severity,
      actor: 'System',
      metadata: {
        trigger_type: row.trigger_type,
        round_index: row.round_index,
        game_key: row.games?.game_key,
      },
      timestamp: row.triggered_at,
    }
  })
}

async function fetchAdminActivity(admin: any, gameId: string | null): Promise<ActivityFeedItem[]> {
  let query = admin
    .from('activity_log')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100)

  if (gameId) {
    query = query.eq('entity_id', gameId).eq('entity_type', 'game')
  }

  const { data, error } = await query
  if (error) {
    // Table might not exist yet — gracefully degrade
    log.api.warn({ err: error }, 'Failed to fetch admin activity log')
    return []
  }

  return (data || []).map((row: AdminActivityRow) => ({
    id: `admin-${row.id}`,
    type: 'admin_action' as const,
    action: row.action,
    description: describeAdminAction(row),
    entity_type: row.entity_type as ActivityEntityType,
    entity_id: row.entity_id,
    entity_name: row.entity_name,
    game_id: row.entity_type === 'game' ? row.entity_id : null,
    game_name: row.entity_type === 'game' ? row.entity_name : null,
    severity: 'info' as const,
    actor: row.actor_email || 'Unknown',
    metadata: row.metadata || {},
    timestamp: row.created_at,
  }))
}

function describeAdminAction(row: AdminActivityRow): string {
  const name = row.entity_name || row.entity_id || 'item'
  switch (row.action) {
    case 'game_created': return `Created game "${name}"`
    case 'game_updated': return `Updated game "${name}"`
    case 'game_deleted': return `Deleted game "${name}"`
    case 'trigger_created': return `Created trigger for "${name}"`
    case 'trigger_updated': return `Updated trigger for "${name}"`
    case 'trigger_deleted': return `Deleted trigger for "${name}"`
    case 'user_invited': return `Invited user ${name}`
    case 'user_updated': return `Updated user ${name}`
    case 'user_deactivated': return `Deactivated user ${name}`
    case 'settings_updated': return `Updated ${name} settings`
    case 'round_intro_generated': return `Generated round intro for "${name}"`
    default: return `${row.action} on ${row.entity_type} "${name}"`
  }
}

// Row types for Supabase query results
interface SyncLogRow {
  id: string
  game_id: string
  sync_type: string
  status: string
  users_synced: number
  elements_synced: number
  error_message: string | null
  started_at: string
  games: { name: string; game_key: string } | null
}

interface TriggerLogRow {
  id: string
  game_id: string
  trigger_type: string
  round_index: number
  status: string
  error_message: string | null
  triggered_at: string
  games: { name: string; game_key: string } | null
}

interface AdminActivityRow {
  id: string
  actor_id: string | null
  actor_email: string | null
  action: string
  entity_type: string
  entity_id: string | null
  entity_name: string | null
  metadata: Record<string, unknown>
  created_at: string
}
