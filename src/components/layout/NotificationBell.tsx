'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Bell,
  AlertTriangle,
  CheckCircle,
  Zap,
  Play,
  Flag,
  Trophy,
  X,
  Check,
  ExternalLink,
} from 'lucide-react'
import type { Notification, NotificationEventType, NotificationSeverity } from '@/types'

/** How often to poll for new notifications (ms) */
const POLL_INTERVAL = 30_000

const eventConfig: Record<NotificationEventType, { icon: typeof Bell; label: string }> = {
  sync_failure:    { icon: AlertTriangle, label: 'Sync Failure' },
  sync_recovered:  { icon: CheckCircle,   label: 'Sync Recovered' },
  trigger_failure: { icon: AlertTriangle, label: 'Trigger Failed' },
  trigger_fired:   { icon: Zap,           label: 'Trigger Fired' },
  round_started:   { icon: Play,          label: 'Round Started' },
  round_ended:     { icon: Flag,          label: 'Round Ended' },
  season_ended:    { icon: Trophy,        label: 'Season Ended' },
}

const severityColors: Record<NotificationSeverity, string> = {
  info:    'text-ocean',
  warning: 'text-solar',
  error:   'text-punch',
}

function timeAgo(dateString: string): string {
  const now = new Date()
  const date = new Date(dateString)
  const minutes = Math.floor((now.getTime() - date.getTime()) / 60000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

export function NotificationBell() {
  const [unreadCount, setUnreadCount] = useState(0)
  const [isOpen, setIsOpen] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Fetch unread count (polling)
  const fetchUnreadCount = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/notifications/unread-count')
      const data = await res.json()
      if (data.success) {
        setUnreadCount(data.data.count)
      }
    } catch {
      // Silently fail — don't disrupt UX
    }
  }, [])

  // Fetch recent notifications for dropdown
  const fetchNotifications = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/notifications?limit=10')
      const data = await res.json()
      if (data.success) {
        setNotifications(data.data)
      }
    } catch {
      // Silently fail
    } finally {
      setLoading(false)
    }
  }, [])

  // Mark all as read
  const markAllRead = async () => {
    try {
      await fetch('/api/admin/notifications', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      setUnreadCount(0)
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
    } catch {
      // Silently fail
    }
  }

  // Mark single as read
  const markRead = async (id: string) => {
    try {
      await fetch('/api/admin/notifications', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notification_ids: [id] }),
      })
      setUnreadCount(prev => Math.max(0, prev - 1))
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n))
    } catch {
      // Silently fail
    }
  }

  // Poll for unread count
  useEffect(() => {
    fetchUnreadCount()
    const interval = setInterval(fetchUnreadCount, POLL_INTERVAL)
    return () => clearInterval(interval)
  }, [fetchUnreadCount])

  // Load notifications when dropdown opens
  useEffect(() => {
    if (isOpen) {
      fetchNotifications()
    }
  }, [isOpen, fetchNotifications])

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  return (
    <div ref={dropdownRef} className="relative">
      {/* Bell Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative flex items-center justify-center w-9 h-9 rounded-xl bg-ink-700/40 hover:bg-ink-700/60 ring-1 ring-ink-600/30 hover:ring-ink-600/50 transition-all"
      >
        <Bell className="w-4.5 h-4.5 text-ink-300" />
        <AnimatePresence>
          {unreadCount > 0 && (
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
              className="absolute -top-1.5 -right-1.5 flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold text-white bg-punch rounded-full ring-2 ring-ink-900"
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </motion.span>
          )}
        </AnimatePresence>
      </button>

      {/* Dropdown */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute left-0 mt-2 w-96 max-h-[480px] bg-ink-800/95 backdrop-blur-xl rounded-2xl ring-1 ring-ink-600/40 shadow-2xl shadow-ink-950/60 z-50 overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-ink-600/30">
              <h3 className="text-sm font-heading font-semibold text-ink-100">Notifications</h3>
              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <button
                    onClick={markAllRead}
                    className="flex items-center gap-1 text-xs text-electric-400 hover:text-electric-300 transition-colors"
                  >
                    <Check className="w-3 h-3" />
                    Mark all read
                  </button>
                )}
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1 text-ink-400 hover:text-ink-200 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Notification List */}
            <div className="overflow-y-auto max-h-[360px]">
              {loading && notifications.length === 0 ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-5 w-5 border-2 border-ink-600 border-t-electric" />
                </div>
              ) : notifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-ink-500">
                  <Bell className="w-8 h-8 mb-2 opacity-30" />
                  <p className="text-sm">No notifications yet</p>
                </div>
              ) : (
                notifications.map((notif) => {
                  const config = eventConfig[notif.event_type as NotificationEventType]
                  const Icon = config?.icon || Bell
                  const severityColor = severityColors[notif.severity as NotificationSeverity] || 'text-ink-400'

                  return (
                    <div
                      key={notif.id}
                      className={`relative px-4 py-3 border-b border-ink-600/20 hover:bg-ink-700/30 transition-colors ${
                        !notif.is_read ? 'bg-ink-700/20' : ''
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        {/* Icon */}
                        <div className={`mt-0.5 ${severityColor}`}>
                          <Icon className="w-4 h-4" />
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className={`text-sm font-medium ${!notif.is_read ? 'text-ink-100' : 'text-ink-300'}`}>
                              {notif.title}
                            </span>
                            {!notif.is_read && (
                              <span className="w-1.5 h-1.5 rounded-full bg-electric flex-shrink-0" />
                            )}
                          </div>
                          <p className="text-xs text-ink-400 mt-0.5 line-clamp-2">{notif.message}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-[10px] text-ink-500">{timeAgo(notif.created_at)}</span>
                            {notif.game_name && (
                              <span className="text-[10px] text-ink-500 bg-ink-700/40 px-1.5 py-0.5 rounded">
                                {notif.game_name}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Mark read button */}
                        {!notif.is_read && (
                          <button
                            onClick={() => markRead(notif.id)}
                            className="mt-1 p-1 text-ink-500 hover:text-electric-400 transition-colors"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })
              )}
            </div>

            {/* Footer */}
            <div className="px-4 py-2.5 border-t border-ink-600/30 bg-ink-800/50">
              <Link
                href="/dashboard/notifications"
                onClick={() => setIsOpen(false)}
                className="flex items-center justify-center gap-1.5 text-xs text-electric-400 hover:text-electric-300 transition-colors"
              >
                View all notifications
                <ExternalLink className="w-3 h-3" />
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
