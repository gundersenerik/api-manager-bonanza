'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Sidebar } from '@/components/layout/Sidebar'
import { PageTransition } from '@/components/layout/PageTransition'

// Konami code: up up down down left right left right b a
const KONAMI = ['ArrowUp','ArrowUp','ArrowDown','ArrowDown','ArrowLeft','ArrowRight','ArrowLeft','ArrowRight','b','a']

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const [userEmail, setUserEmail] = useState<string | null>(null)
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
      setUserEmail(user?.email || null)
    })

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUserEmail(session?.user?.email || null)
      if (event === 'SIGNED_OUT') {
        router.push('/login')
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
    <div className={`min-h-screen bg-ink-950 bg-grid-texture transition-all duration-500 ${disco ? 'disco-mode' : ''}`}>
      <Sidebar
        userEmail={userEmail}
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
  )
}
