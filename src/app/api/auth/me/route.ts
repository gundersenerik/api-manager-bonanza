import { getAppUser, jsonResponse, errorResponse } from '@/lib/api-auth'

export async function GET() {
  const appUser = await getAppUser()
  if (!appUser) {
    return errorResponse('Not authorized', 401)
  }

  return jsonResponse({
    success: true,
    data: {
      id: appUser.id,
      email: appUser.email,
      role: appUser.role,
      display_name: appUser.display_name,
    },
  }, 200, { cache: false })
}
