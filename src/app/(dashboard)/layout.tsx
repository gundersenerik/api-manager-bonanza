'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Sidebar } from '@/components/layout/Sidebar'
import { PageTransition } from '@/components/layout/PageTransition'
import { AuthProvider } from '@/contexts/AuthContext'
import type { AppUserRole } from '@/types'

// Konami code: up up down down left right left right b a
const KONAMI = ['ArrowUp','ArrowUp','ArrowDown','ArrowDown','ArrowLeft','ArrowRight','ArrowLeft','ArrowRight','b','a']

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [userRole, setUserRole] = useState<AppUserRole | null>(null)
  const [displayName, setDisplayName] = useState<string | null>(null)
  const [signingOut, setSigningOut] = useState(false)
  const [disco, setDisco] = useState(false)

  // Konami code easter egg
  const handleKonami = useCallback(() => {
    let seq: string[] = []
    const listener = (e: KeyboardEvent) => {
      seq = [...seq, e.key].slice(-KONAMI.length)
      if (seq.length === KONAMI.length && seq.every((k, i) => k === KONAMI[i])) {
        setDisco(prev => !prev)
        seq = []
      }
    }
    window.addEventListener('keydown', listener)
    return () => window.removeEventListener('keydown', listener)
  }, [])

  useEffect(() => {
    const cleanup = handleKonami()
    return cleanup
  }, [handleKonami])

  useEffect(() => {
    if (disco) {
      const timer = setTimeout(() => setDisco(false), 8000)
      return () => clearTimeout(timer)
    }
  }, [disco])

  useEffect(() => {
    const supabase = createClient()

    // Get initial user
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user?.email) {
        setUserEmail(user.email)
        // Fetch app user profile (role, display name)
        fetch('/api/auth/me')
          .then(res => res.json())
          .then(json => {
            if (json.success && json.data) {
              setUserRole(json.data.role)
              setDisplayName(json.data.display_name)
            } else {
              // User not in app_users — force sign out
              supabase.auth.signOut().then(() => router.push('/login?error=not_invited'))
            }
          })
          .catch(() => {
            // Network error fetching profile — sign out as safety measure
            supabase.auth.signOut().then(() => router.push('/login'))
          })
      }
    })

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        setUserEmail(null)
        setUserRole(null)
        setDisplayName(null)
        router.push('/login')
      } else if (session?.user?.email) {
        setUserEmail(session.user.email)
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [router])

  const handleSignOut = async () => {
    setSigningOut(true)
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <AuthProvider value={{ email: userEmail, role: userRole, displayName, isAdmin: userRole === 'admin' }}>
      <div className={`min-h-screen bg-ink-950 bg-grid-texture transition-all duration-500 ${disco ? 'disco-mode' : ''}`}>
        <Sidebar
          userEmail={userEmail}
          userRole={userRole}
          onSignOut={handleSignOut}
          signingOut={signingOut}
        />

        {/* Main content */}
        <main className="pl-64">
          <div className="p-8">
            <PageTransition>
              {children}
            </PageTransition>
          </div>
        </main>
      </div>
    </AuthProvider>
  )
}
