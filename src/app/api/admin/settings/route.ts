import { NextRequest } from 'next/server'
import { jsonResponse, requireAdmin } from '@/lib/api-auth'

/**
 * GET /api/admin/settings
 * Retrieve application settings (masked by default, reveal with ?reveal=true for admins)
 */
export async function GET(request: NextRequest) {
  // Only admins can view settings
  const result = await requireAdmin()
  if (result instanceof Response) return result

  const { searchParams } = new URL(request.url)
  const reveal = searchParams.get('reveal') === 'true'

  const mask = (value: string | undefined) => {
    if (!value) return ''
    if (reveal) return value
    return '••••••••' + value.slice(-4)
  }

  const settings = {
    swush_api_key: mask(process.env.SWUSH_API_KEY),
    swush_api_base_url: process.env.SWUSH_API_BASE_URL || '',
    braze_api_key: mask(process.env.BRAZE_API_KEY),
    braze_api_token: mask(process.env.BRAZE_API_TOKEN),
    braze_rest_endpoint: process.env.BRAZE_REST_ENDPOINT || '',
    default_sync_interval: parseInt(process.env.DEFAULT_SYNC_INTERVAL || '30'),
  }

  return jsonResponse({
    success: true,
    data: settings,
    message: 'Settings are configured via environment variables for security',
  }, 200, { cache: false })
}

/**
 * PUT /api/admin/settings
 * Note: In production, settings should be managed via environment variables
 * This endpoint exists for documentation purposes
 */
export async function PUT() {
  // Only admins can modify settings
  const result = await requireAdmin()
  if (result instanceof Response) return result

  return jsonResponse({
    success: true,
    message: 'Settings should be configured via environment variables in Vercel dashboard',
  })
}
