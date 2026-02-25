'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  LayoutDashboard,
  Gamepad2,
  RefreshCw,
  Settings,
  LogOut,
  User,
  Users,
  Sparkles,
  Shield,
} from 'lucide-react'
import type { AppUserRole } from '@/types'

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, adminOnly: false },
  { name: 'Games', href: '/dashboard/games', icon: Gamepad2, adminOnly: false },
  { name: 'Sync Logs', href: '/dashboard/sync-logs', icon: RefreshCw, adminOnly: false },
  { name: 'Users', href: '/dashboard/users', icon: Users, adminOnly: true },
  { name: 'Settings', href: '/dashboard/settings', icon: Settings, adminOnly: true },
]

interface SidebarProps {
  userEmail: string | null
  userRole: AppUserRole | null
  onSignOut: () => void
  signingOut: boolean
}

export function Sidebar({ userEmail, userRole, onSignOut, signingOut }: SidebarProps) {
  const pathname = usePathname()
  const [logoClicks, setLogoClicks] = useState(0)
  const [logoWiggle, setLogoWiggle] = useState(false)
  const isAdmin = userRole === 'admin'
  const visibleNavigation = navigation.filter(item => !item.adminOnly || isAdmin)

  const handleLogoClick = () => {
    const next = logoClicks + 1
    setLogoClicks(next)
    if (next >= 3) {
      setLogoWiggle(true)
      setLogoClicks(0)
      setTimeout(() => setLogoWiggle(false), 600)
    }
  }

  return (
    <aside className="fixed inset-y-0 left-0 w-64 bg-ink-900/80 backdrop-blur-xl border-r border-ink-600/30 z-30">
      {/* Logo */}
      <div
        className="flex items-center h-16 px-6 border-b border-ink-600/30 cursor-pointer select-none"
        onClick={handleLogoClick}
      >
        <motion.div
          animate={logoWiggle ? { rotate: [0, -5, 5, -3, 3, 0] } : {}}
          transition={{ duration: 0.5 }}
        >
          <div className="w-9 h-9 rounded-xl bg-gradient-primary flex items-center justify-center shadow-lg shadow-electric/20">
            <Gamepad2 className="w-5 h-5 text-white" />
          </div>
        </motion.div>
        <span className="ml-3 text-lg font-heading font-bold text-gradient-primary">
          SWUSH
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex flex-col gap-1 p-4">
        {visibleNavigation.map((item) => {
          const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname?.startsWith(item.href + '/'))
            || (item.href === '/dashboard' && pathname === '/dashboard')
          return (
            <Link
              key={item.name}
              href={item.href}
              className="relative"
            >
              <div
                className={`relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                  isActive
                    ? 'text-electric-300'
                    : 'text-ink-400 hover:text-ink-200 hover:bg-ink-700/40'
                }`}
              >
                {isActive && (
                  <motion.div
                    layoutId="nav-active"
                    className="absolute inset-0 bg-electric/10 rounded-xl ring-1 ring-electric/20"
                    transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                  />
                )}
                {isActive && (
                  <motion.div
                    layoutId="nav-bar"
                    className="absolute left-0 top-1.5 bottom-1.5 w-[3px] bg-electric rounded-full"
                    transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                  />
                )}
                <item.icon className="w-5 h-5 relative z-10" />
                <span className="relative z-10">{item.name}</span>
              </div>
            </Link>
          )
        })}
      </nav>

      {/* User & Sign Out */}
      <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-ink-600/30">
        {userEmail && (
          <div className="flex items-center gap-2.5 mb-3 px-2">
            <div className="w-8 h-8 bg-ink-700 rounded-full flex items-center justify-center ring-2 ring-electric/20">
              <User className="w-4 h-4 text-ink-300" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-ink-200 truncate">
                {userEmail}
              </p>
              {userRole && (
                <div className="flex items-center gap-1 mt-0.5">
                  {isAdmin && <Shield className="w-3 h-3 text-electric-400" />}
                  <span className={`text-xs ${isAdmin ? 'text-electric-400' : 'text-ink-500'}`}>
                    {userRole}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
        <button
          onClick={onSignOut}
          disabled={signingOut}
          className="group flex items-center gap-2 w-full px-3 py-2 text-sm font-medium text-ink-400 hover:text-ink-200 hover:bg-ink-700/40 rounded-xl transition-all disabled:opacity-50"
        >
          <LogOut className="w-4 h-4 transition-transform group-hover:rotate-[-15deg]" />
          {signingOut ? 'Signing out...' : 'Sign out'}
        </button>
        <div className="mt-3 flex items-center gap-1.5 text-xs text-ink-600 px-2">
          <Sparkles className="w-3 h-3" />
          Aftonbladet Fantasy
        </div>
      </div>
    </aside>
  )
}
