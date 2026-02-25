import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard'

  if (code) {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          },
        },
      }
    )

    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      // Get the authenticated user
      const { data: { user } } = await supabase.auth.getUser()

      if (!user?.email) {
        await supabase.auth.signOut()
        return NextResponse.redirect(`${origin}/login?error=no_email`)
      }

      // Check app_users using service role (bypasses RLS)
      const adminClient = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { autoRefreshToken: false, persistSession: false } }
      )

      const { data: appUser } = await adminClient
        .from('app_users')
        .select('*')
        .eq('email', user.email.toLowerCase())
        .eq('is_active', true)
        .single()

      if (!appUser) {
        // Not invited - sign out and reject
        await supabase.auth.signOut()
        return NextResponse.redirect(`${origin}/login?error=not_invited`)
      }

      // Link auth_user_id on first login, or update last_login
      if (!appUser.auth_user_id) {
        await adminClient
          .from('app_users')
          .update({
            auth_user_id: user.id,
            display_name: user.user_metadata?.full_name || user.email,
            last_login_at: new Date().toISOString(),
          })
          .eq('id', appUser.id)
      } else {
        await adminClient
          .from('app_users')
          .update({ last_login_at: new Date().toISOString() })
          .eq('id', appUser.id)
      }

      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback_error`)
}
