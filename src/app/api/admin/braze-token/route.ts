import { jsonResponse, errorResponse, requireAdminAuth } from '@/lib/api-auth'

export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/braze-token
 * Returns the Braze Connected Content token for authenticated admins.
 * Used by the dashboard to build Connected Content snippets.
 */
export async function GET() {
  const authError = await requireAdminAuth()
  if (authError) return authError

  const token = process.env.BRAZE_API_TOKEN
  if (!token) {
    return errorResponse('BRAZE_API_TOKEN not configured', 500)
  }

  return jsonResponse({ success: true, token }, 200, { cache: false })
}
