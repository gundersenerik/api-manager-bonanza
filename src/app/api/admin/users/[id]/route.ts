import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import { jsonResponse, errorResponse, requireAdmin } from '@/lib/api-auth'
import { z } from 'zod'
import type { AppUser } from '@/types'

interface RouteContext {
  params: Promise<{ id: string }>
}

const UpdateUserSchema = z.object({
  role: z.enum(['user', 'admin']).optional(),
  is_active: z.boolean().optional(),
})

/**
 * PUT /api/admin/users/:id
 * Update a user's role or active status
 */
export async function PUT(request: NextRequest, { params }: RouteContext) {
  const result = await requireAdmin()
  if (result instanceof Response) return result
  const adminUser = result as AppUser

  const supabase = supabaseAdmin()
  const { id } = await params

  try {
    const body = await request.json()
    const validated = UpdateUserSchema.parse(body)

    // Prevent self-demotion
    if (id === adminUser.id && validated.role && validated.role !== 'admin') {
      return errorResponse('Cannot demote yourself', 400)
    }

    // Prevent self-deactivation
    if (id === adminUser.id && validated.is_active === false) {
      return errorResponse('Cannot deactivate yourself', 400)
    }

    // If demoting the last admin, block it
    if (validated.role === 'user') {
      const { count } = await supabase
        .from('app_users')
        .select('*', { count: 'exact', head: true })
        .eq('role', 'admin')
        .eq('is_active', true)

      if (count !== null && count <= 1) {
        // Check if the target user is currently an admin
        const { data: targetUser } = await supabase
          .from('app_users')
          .select('role')
          .eq('id', id)
          .single()

        if (targetUser?.role === 'admin') {
          return errorResponse('Cannot demote the last admin', 400)
        }
      }
    }

    const { data: user, error } = await supabase
      .from('app_users')
      .update(validated)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      return errorResponse(error.message, 500)
    }

    if (!user) {
      return errorResponse('User not found', 404)
    }

    return jsonResponse({
      success: true,
      data: user,
      message: 'User updated successfully',
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse(`Validation error: ${error.errors[0]?.message ?? 'Invalid input'}`, 400)
    }
    return errorResponse('Failed to update user', 500)
  }
}

/**
 * DELETE /api/admin/users/:id
 * Soft-delete a user (set is_active = false)
 */
export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  const result = await requireAdmin()
  if (result instanceof Response) return result
  const adminUser = result as AppUser

  const { id } = await params

  // Prevent self-deletion
  if (id === adminUser.id) {
    return errorResponse('Cannot deactivate yourself', 400)
  }

  const supabase = supabaseAdmin()

  try {
    // Check if this is the last admin
    const { data: targetUser } = await supabase
      .from('app_users')
      .select('role')
      .eq('id', id)
      .single()

    if (!targetUser) {
      return errorResponse('User not found', 404)
    }

    if (targetUser.role === 'admin') {
      const { count } = await supabase
        .from('app_users')
        .select('*', { count: 'exact', head: true })
        .eq('role', 'admin')
        .eq('is_active', true)

      if (count !== null && count <= 1) {
        return errorResponse('Cannot deactivate the last admin', 400)
      }
    }

    const { error } = await supabase
      .from('app_users')
      .update({ is_active: false })
      .eq('id', id)

    if (error) {
      return errorResponse(error.message, 500)
    }

    return jsonResponse({
      success: true,
      message: 'User deactivated successfully',
    })
  } catch {
    return errorResponse('Failed to deactivate user', 500)
  }
}
