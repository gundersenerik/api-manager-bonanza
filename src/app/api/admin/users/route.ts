import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import { jsonResponse, errorResponse, requireAdmin } from '@/lib/api-auth'
import { z } from 'zod'
import type { AppUser } from '@/types'

const InviteUserSchema = z.object({
  email: z.string().email(),
  role: z.enum(['user', 'admin']).default('user'),
})

/**
 * GET /api/admin/users
 * List all app users
 */
export async function GET() {
  const result = await requireAdmin()
  if (result instanceof Response) return result

  const supabase = supabaseAdmin()

  try {
    const { data: users, error } = await supabase
      .from('app_users')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      return errorResponse(error.message, 500)
    }

    return jsonResponse({
      success: true,
      data: users,
    }, 200, { cache: false })
  } catch {
    return errorResponse('Failed to fetch users', 500)
  }
}

/**
 * POST /api/admin/users
 * Invite a new user
 */
export async function POST(request: NextRequest) {
  const result = await requireAdmin()
  if (result instanceof Response) return result
  const adminUser = result as AppUser

  const supabase = supabaseAdmin()

  try {
    const body = await request.json()
    const validated = InviteUserSchema.parse(body)
    const email = validated.email.toLowerCase()

    // Check if user already exists
    const { data: existing } = await supabase
      .from('app_users')
      .select('id, is_active')
      .eq('email', email)
      .single()

    if (existing) {
      if (!existing.is_active) {
        // Reactivate deactivated user
        const { data: reactivated, error } = await supabase
          .from('app_users')
          .update({ is_active: true, role: validated.role })
          .eq('id', existing.id)
          .select()
          .single()

        if (error) return errorResponse(error.message, 500)

        return jsonResponse({
          success: true,
          data: reactivated,
          message: 'User reactivated',
        })
      }
      return errorResponse('User with this email already exists', 400)
    }

    const { data: user, error } = await supabase
      .from('app_users')
      .insert({
        email,
        role: validated.role,
        invited_by: adminUser.id,
        is_active: true,
      })
      .select()
      .single()

    if (error) {
      return errorResponse(error.message, 500)
    }

    return jsonResponse({
      success: true,
      data: user,
      message: 'User invited successfully',
    }, 201)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse(`Validation error: ${error.errors[0]?.message ?? 'Invalid input'}`, 400)
    }
    return errorResponse('Failed to invite user', 500)
  }
}
