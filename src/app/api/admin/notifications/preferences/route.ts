import { NextRequest } from 'next/server'
import { jsonResponse, errorResponse, requireRole, getAppUser } from '@/lib/api-auth'
import { notificationService } from '@/services/notification-service'
import type { NotificationEventType } from '@/types'

export const dynamic = 'force-dynamic'

const VALID_EVENT_TYPES: NotificationEventType[] = [
  'sync_failure', 'sync_recovered', 'trigger_failure', 'trigger_fired',
  'round_started', 'round_ended', 'season_ended',
]

/**
 * GET /api/admin/notifications/preferences
 * Returns the notification preferences for the current user
 */
export async function GET() {
  const result = await requireRole('user')
  if (result instanceof Response) return result

  const appUser = await getAppUser()
  if (!appUser) return errorResponse('User profile not found', 403)

  try {
    const preferences = await notificationService.getPreferences(appUser.id)

    return jsonResponse({
      success: true,
      data: preferences,
    })
  } catch {
    return errorResponse('Failed to fetch preferences', 500)
  }
}

/**
 * PUT /api/admin/notifications/preferences
 * Update notification preferences for a specific event type
 *
 * Body:
 * - event_type: NotificationEventType
 * - in_app?: boolean
 * - slack?: boolean
 * - email?: boolean
 */
export async function PUT(request: NextRequest) {
  const result = await requireRole('user')
  if (result instanceof Response) return result

  const appUser = await getAppUser()
  if (!appUser) return errorResponse('User profile not found', 403)

  try {
    const body = await request.json()
    const { event_type, in_app, slack, email } = body

    if (!event_type || !VALID_EVENT_TYPES.includes(event_type)) {
      return errorResponse(`Invalid event_type. Valid types: ${VALID_EVENT_TYPES.join(', ')}`, 400)
    }

    const channels: { in_app?: boolean; slack?: boolean; email?: boolean } = {}
    if (typeof in_app === 'boolean') channels.in_app = in_app
    if (typeof slack === 'boolean') channels.slack = slack
    if (typeof email === 'boolean') channels.email = email

    if (Object.keys(channels).length === 0) {
      return errorResponse('Provide at least one channel to update (in_app, slack, email)', 400)
    }

    await notificationService.updatePreference(appUser.id, event_type, channels)

    return jsonResponse({
      success: true,
      message: `Updated preferences for ${event_type}`,
    })
  } catch {
    return errorResponse('Failed to update preferences', 500)
  }
}
