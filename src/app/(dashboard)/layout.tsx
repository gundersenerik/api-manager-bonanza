'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  LayoutDashboard,
  Gamepad2,
  RefreshCw,
  Settings,
  LogOut,
  User,
} from 'lucide-react'

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Games', href: '/dashboard/games', icon: Gamepad2 },
  { name: 'Sync Logs', href: '/dashboard/sync-logs', icon: RefreshCw },
  { name: 'Settings', href: '/dashboard/settings', icon: Settings },
]

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const router = useRouter()
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [signingOut, setSigningOut] = useState(false)

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
    <div className="min-h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="fixed inset-y-0 left-0 w-64 bg-white border-r border-gray-200">
        {/* Logo */}
        <div className="flex items-center h-16 px-6 border-b border-gray-200">
          <Gamepad2 className="w-8 h-8 text-red-600" />
          <span className="ml-2 text-xl font-bold text-gray-900">
            SWUSH Manager
          </span>
        </div>

        {/* Navigation */}
        <nav className="flex flex-col gap-1 p-4">
          {navigation.map((item) => {
            const isActive = pathname === item.href || pathname?.startsWith(item.href + '/')
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-red-50 text-red-700'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                }`}
              >
                <item.icon className="w-5 h-5" />
                {item.name}
              </Link>
            )
          })}
        </nav>

        {/* User & Sign Out */}
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-200">
          {userEmail && (
            <div className="flex items-center gap-2 mb-3 px-2">
              <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                <User className="w-4 h-4 text-gray-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {userEmail}
                </p>
              </div>
            </div>
          )}
          <button
            onClick={handleSignOut}
            disabled={signingOut}
            className="flex items-center gap-2 w-full px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900 rounded-lg transition-colors disabled:opacity-50"
          >
            <LogOut className="w-4 h-4" />
            {signingOut ? 'Signing out...' : 'Sign out'}
          </button>
          <div className="mt-3 text-xs text-gray-500 px-2">
            Aftonbladet Fantasy Integration
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="pl-64">
        <div className="p-8">
          {children}
        </div>
      </main>
    </div>
  )
}
