import { jsonResponse, errorResponse, requireRole, getAppUser } from '@/lib/api-auth'
import { notificationService } from '@/services/notification-service'

export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/notifications/unread-count
 * Returns the unread notification count for the current user.
 * Used by the NotificationBell component for polling.
 */
export async function GET() {
  const result = await requireRole('user')
  if (result instanceof Response) return result

  const appUser = await getAppUser()
  if (!appUser) return errorResponse('User profile not found', 403)

  try {
    const count = await notificationService.getUnreadCount(appUser.id)

    return jsonResponse({
      success: true,
      data: { count },
    })
  } catch {
    return errorResponse('Failed to fetch unread count', 500)
  }
}
