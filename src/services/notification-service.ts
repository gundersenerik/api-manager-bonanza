import { supabaseAdmin } from '@/lib/supabase/server'
import { log } from '@/lib/logger'
import { alertService } from '@/services/alert-service'
import type { NotificationEvent, NotificationEventType, NotificationSeverity } from '@/types'

/**
 * Notification Service
 * Orchestrates event delivery across channels: in-app, Slack, and (future) email.
 * All events flow through `dispatch()` which checks per-user preferences.
 */

/** Default preferences for each event type when no user preference is stored */
const DEFAULT_PREFS: Record<NotificationEventType, { in_app: boolean; slack: boolean; email: boolean }> = {
  sync_failure:     { in_app: true,  slack: true,  email: false },
  sync_recovered:   { in_app: true,  slack: true,  email: false },
  trigger_failure:  { in_app: true,  slack: true,  email: false },
  trigger_fired:    { in_app: true,  slack: false, email: false },
  round_started:    { in_app: true,  slack: false, email: false },
  round_ended:      { in_app: true,  slack: false, email: false },
  season_ended:     { in_app: true,  slack: true,  email: false },
}

/** Severity emoji for Slack messages */
const severityEmoji: Record<NotificationSeverity, string> = {
  info: 'ℹ️',
  warning: '⚠️',
  error: '🚨',
}

class NotificationService {
  /**
   * Dispatch a notification event to all configured channels for all active users.
   * Checks per-user preferences and game-level muting before delivery.
   */
  async dispatch(event: NotificationEvent): Promise<void> {
    try {
      const admin = supabaseAdmin()

      // Get all active users
      const { data: users, error: usersError } = await admin
        .from('app_users')
        .select('id')
        .eq('is_active', true)

      if (usersError || !users?.length) {
        log.api.warn({ err: usersError }, 'No active users for notification dispatch')
        return
      }

      // Get preferences for all users for this event type
      const { data: prefs } = await admin
        .from('notification_preferences')
        .select('*')
        .eq('event_type', event.event_type)
        .in('user_id', users.map(u => u.id))

      const prefsMap = new Map(prefs?.map(p => [p.user_id, p]) || [])
      const defaults = DEFAULT_PREFS[event.event_type]

      // Process each user
      const inAppInserts: Array<{
        user_id: string
        event_type: string
        title: string
        message: string
        severity: string
        game_id: string | null
        game_name: string | null
        metadata: Record<string, unknown>
      }> = []

      let shouldSlack = false

      for (const user of users) {
        const userPref = prefsMap.get(user.id)
        const inApp = userPref ? userPref.in_app : defaults.in_app
        const slack = userPref ? userPref.slack : defaults.slack

        // Check if game is muted for this user
        if (event.game_id && userPref?.muted_game_ids?.includes(event.game_id)) {
          continue
        }

        // In-app notification
        if (inApp) {
          inAppInserts.push({
            user_id: user.id,
            event_type: event.event_type,
            title: event.title,
            message: event.message,
            severity: event.severity,
            game_id: event.game_id || null,
            game_name: event.game_name || null,
            metadata: event.metadata || {},
          })
        }

        // If any user has Slack enabled, we send one Slack message (it's a shared channel)
        if (slack) {
          shouldSlack = true
        }
      }

      // Batch insert in-app notifications
      if (inAppInserts.length > 0) {
        const { error: insertError } = await admin
          .from('notifications')
          .insert(inAppInserts)

        if (insertError) {
          log.api.error({ err: insertError }, 'Failed to insert in-app notifications')
        } else {
          log.api.info(
            { event: event.event_type, count: inAppInserts.length },
            'In-app notifications created'
          )
        }
      }

      // Slack notification (one message to the shared channel)
      if (shouldSlack && alertService.isConfigured()) {
        await this.sendSlackNotification(event)
      }
    } catch (error) {
      log.api.error({ err: error, event: event.event_type }, 'Notification dispatch failed')
    }
  }

  /**
   * Send a rich Slack notification using the existing alert webhook
   */
  private async sendSlackNotification(event: NotificationEvent): Promise<void> {
    const webhookUrl = process.env.ALERT_WEBHOOK_URL
    if (!webhookUrl) return

    const emoji = severityEmoji[event.severity]
    const gameLabel = event.game_name ? ` — ${event.game_name}` : ''

    const slackPayload = {
      text: `${emoji} ${event.title}${gameLabel}`,
      blocks: [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: `${emoji} ${event.title}`,
            emoji: true,
          },
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: event.message,
          },
        },
        ...(event.game_name ? [{
          type: 'context',
          elements: [{
            type: 'mrkdwn',
            text: `Game: *${event.game_name}* | ${new Date().toLocaleString('sv-SE')}`,
          }],
        }] : [{
          type: 'context',
          elements: [{
            type: 'mrkdwn',
            text: new Date().toLocaleString('sv-SE'),
          }],
        }]),
      ],
    }

    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(slackPayload),
      })

      if (!response.ok) {
        log.api.error({ status: response.status }, 'Slack notification failed')
      }
    } catch (error) {
      log.api.error({ err: error }, 'Error sending Slack notification')
    }
  }

  /**
   * Get unread notification count for a user
   */
  async getUnreadCount(userId: string): Promise<number> {
    const admin = supabaseAdmin()
    const { count, error } = await admin
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('is_read', false)

    if (error) {
      log.api.error({ err: error }, 'Failed to get unread count')
      return 0
    }

    return count || 0
  }

  /**
   * Mark notifications as read
   */
  async markAsRead(userId: string, notificationIds?: string[]): Promise<void> {
    const admin = supabaseAdmin()

    let query = admin
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', userId)

    if (notificationIds?.length) {
      query = query.in('id', notificationIds)
    } else {
      // Mark all as read
      query = query.eq('is_read', false)
    }

    const { error } = await query

    if (error) {
      log.api.error({ err: error }, 'Failed to mark notifications as read')
    }
  }

  /**
   * Get user preferences, with defaults for missing event types
   */
  async getPreferences(userId: string): Promise<Record<NotificationEventType, { in_app: boolean; slack: boolean; email: boolean }>> {
    const admin = supabaseAdmin()
    const { data: prefs } = await admin
      .from('notification_preferences')
      .select('*')
      .eq('user_id', userId)

    const result: Record<string, { in_app: boolean; slack: boolean; email: boolean }> = {}

    for (const [eventType, defaults] of Object.entries(DEFAULT_PREFS)) {
      const userPref = prefs?.find(p => p.event_type === eventType)
      result[eventType] = userPref
        ? { in_app: userPref.in_app, slack: userPref.slack, email: userPref.email }
        : { ...defaults }
    }

    return result as Record<NotificationEventType, { in_app: boolean; slack: boolean; email: boolean }>
  }

  /**
   * Update user preferences for a specific event type
   */
  async updatePreference(
    userId: string,
    eventType: NotificationEventType,
    channels: { in_app?: boolean; slack?: boolean; email?: boolean }
  ): Promise<void> {
    const admin = supabaseAdmin()

    const { error } = await admin
      .from('notification_preferences')
      .upsert(
        {
          user_id: userId,
          event_type: eventType,
          ...channels,
        },
        { onConflict: 'user_id,event_type' }
      )

    if (error) {
      log.api.error({ err: error }, 'Failed to update notification preference')
      throw error
    }
  }
}

// Export singleton
export const notificationService = new NotificationService()
