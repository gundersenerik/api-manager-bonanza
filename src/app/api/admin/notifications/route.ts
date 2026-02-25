import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import { jsonResponse, errorResponse, requireRole, getAppUser } from '@/lib/api-auth'
import { notificationService } from '@/services/notification-service'

export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/notifications
 * List notifications for the current user
 *
 * Query params:
 * - limit: number (default 50, max 100)
 * - unread_only: boolean (default false)
 * - event_type: filter by event type
 */
export async function GET(request: NextRequest) {
  const result = await requireRole('user')
  if (result instanceof Response) return result

  const appUser = await getAppUser()
  if (!appUser) return errorResponse('User profile not found', 403)

  try {
    const admin = supabaseAdmin()
    const { searchParams } = new URL(request.url)
    const limit = Math.min(Number(searchParams.get('limit') || '50'), 100)
    const unreadOnly = searchParams.get('unread_only') === 'true'
    const eventType = searchParams.get('event_type')

    let query = admin
      .from('notifications')
      .select('*')
      .eq('user_id', appUser.id)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (unreadOnly) {
      query = query.eq('is_read', false)
    }

    if (eventType) {
      query = query.eq('event_type', eventType)
    }

    const { data: notifications, error } = await query

    if (error) {
      return errorResponse(error.message, 500)
    }

    return jsonResponse({
      success: true,
      data: notifications || [],
    })
  } catch {
    return errorResponse('Failed to fetch notifications', 500)
  }
}

/**
 * PUT /api/admin/notifications
 * Mark notifications as read
 *
 * Body:
 * - notification_ids?: string[] — specific IDs to mark (omit for all)
 */
export async function PUT(request: NextRequest) {
  const result = await requireRole('user')
  if (result instanceof Response) return result

  const appUser = await getAppUser()
  if (!appUser) return errorResponse('User profile not found', 403)

  try {
    const body = await request.json()
    const notificationIds = body.notification_ids as string[] | undefined

    await notificationService.markAsRead(appUser.id, notificationIds)

    return jsonResponse({
      success: true,
      message: notificationIds?.length
        ? `Marked ${notificationIds.length} notification(s) as read`
        : 'Marked all notifications as read',
    })
  } catch {
    return errorResponse('Failed to mark notifications as read', 500)
  }
}

/**
 * DELETE /api/admin/notifications
 * Delete old notifications (admin only, for cleanup)
 *
 * Query params:
 * - older_than_days: number (default 30)
 */
export async function DELETE(request: NextRequest) {
  const result = await requireRole('admin')
  if (result instanceof Response) return result

  try {
    const admin = supabaseAdmin()
    const { searchParams } = new URL(request.url)
    const days = Number(searchParams.get('older_than_days') || '30')

    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - days)

    const { error, count } = await admin
      .from('notifications')
      .delete({ count: 'exact' })
      .lt('created_at', cutoff.toISOString())
      .eq('is_read', true)

    if (error) {
      return errorResponse(error.message, 500)
    }

    return jsonResponse({
      success: true,
      message: `Deleted ${count || 0} read notifications older than ${days} days`,
    })
  } catch {
    return errorResponse('Failed to cleanup notifications', 500)
  }
}
