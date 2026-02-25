'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  AlertTriangle,
  Bell,
  Check,
  CheckCircle,
  ChevronDown,
  Flag,
  Play,
  RefreshCw,
  Settings,
  Trophy,
  Zap,
} from 'lucide-react'
import type { Notification, NotificationEventType, NotificationSeverity } from '@/types'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { LoadingScreen } from '@/components/ui/LoadingDots'
import { Button } from '@/components/ui/Button'

// ---- Config ----

type TabView = 'feed' | 'preferences'

const EVENT_TYPES: { value: NotificationEventType; label: string }[] = [
  { value: 'sync_failure', label: 'Sync Failure' },
  { value: 'sync_recovered', label: 'Sync Recovered' },
  { value: 'trigger_failure', label: 'Trigger Failed' },
  { value: 'trigger_fired', label: 'Trigger Fired' },
  { value: 'round_started', label: 'Round Started' },
  { value: 'round_ended', label: 'Round Ended' },
  { value: 'season_ended', label: 'Season Ended' },
]

const eventConfig: Record<NotificationEventType, { icon: typeof Bell; label: string; description: string }> = {
  sync_failure:    { icon: AlertTriangle, label: 'Sync Failure', description: 'When a game sync fails' },
  sync_recovered:  { icon: CheckCircle,   label: 'Sync Recovered', description: 'When a sync recovers after failure' },
  trigger_failure: { icon: AlertTriangle, label: 'Trigger Failed', description: 'When a Braze trigger fails' },
  trigger_fired:   { icon: Zap,           label: 'Trigger Fired', description: 'When a Braze campaign is triggered' },
  round_started:   { icon: Play,          label: 'Round Started', description: 'When a new round begins' },
  round_ended:     { icon: Flag,          label: 'Round Ended', description: 'When a round ends' },
  season_ended:    { icon: Trophy,        label: 'Season Ended', description: 'When a game season ends' },
}

const severityConfig: Record<NotificationSeverity, { color: string; bg: string; dot: string; badge: 'ocean' | 'solar' | 'punch' }> = {
  info:    { color: 'text-ocean', bg: 'bg-ocean/10', dot: 'bg-ocean', badge: 'ocean' },
  warning: { color: 'text-solar', bg: 'bg-solar/10', dot: 'bg-solar', badge: 'solar' },
  error:   { color: 'text-punch', bg: 'bg-punch/10', dot: 'bg-punch', badge: 'punch' },
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

function groupByDate(items: Notification[]): { label: string; items: Notification[] }[] {
  const groups = new Map<string, Notification[]>()

  for (const item of items) {
    const date = new Date(item.created_at)
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)

    let key: string
    if (date.toDateString() === today.toDateString()) {
      key = 'Today'
    } else if (date.toDateString() === yesterday.toDateString()) {
      key = 'Yesterday'
    } else {
      key = date.toLocaleDateString('sv-SE', { weekday: 'long', month: 'short', day: 'numeric' })
    }

    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(item)
  }

  return Array.from(groups.entries()).map(([label, groupItems]) => ({ label, items: groupItems }))
}

// ---- Types ----

interface Preferences {
  [eventType: string]: { in_app: boolean; slack: boolean; email: boolean }
}

// ---- Component ----

export default function NotificationsPage() {
  const [tab, setTab] = useState<TabView>('feed')
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [unreadCount, setUnreadCount] = useState(0)

  // Filters
  const [severityFilter, setSeverityFilter] = useState<'all' | NotificationSeverity>('all')
  const [eventTypeFilter, setEventTypeFilter] = useState<'all' | NotificationEventType>('all')
  const [readFilter, setReadFilter] = useState<'all' | 'unread' | 'read'>('all')

  // Preferences
  const [preferences, setPreferences] = useState<Preferences>({})
  const [prefsLoading, setPrefsLoading] = useState(true)
  const [prefSaving, setPrefSaving] = useState<string | null>(null)

  // ---- Fetch notifications ----
  const fetchNotifications = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ limit: '100' })
      if (readFilter === 'unread') params.set('unread_only', 'true')
      if (eventTypeFilter !== 'all') params.set('event_type', eventTypeFilter)

      const res = await fetch(`/api/admin/notifications?${params.toString()}`)
      const data = await res.json()
      if (data.success) {
        setNotifications(data.data || [])
      }
    } catch {
      // Silently fail
    } finally {
      setLoading(false)
    }
  }, [readFilter, eventTypeFilter])

  const fetchUnreadCount = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/notifications/unread-count')
      const data = await res.json()
      if (data.success) setUnreadCount(data.data.count)
    } catch {
      // Silently fail
    }
  }, [])

  // ---- Fetch preferences ----
  const fetchPreferences = useCallback(async () => {
    setPrefsLoading(true)
    try {
      const res = await fetch('/api/admin/notifications/preferences')
      const data = await res.json()
      if (data.success) {
        setPreferences(data.data)
      }
    } catch {
      // Silently fail
    } finally {
      setPrefsLoading(false)
    }
  }, [])

  // ---- Actions ----
  const markAllRead = async () => {
    try {
      await fetch('/api/admin/notifications', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
      setUnreadCount(0)
    } catch {
      // Silently fail
    }
  }

  const markRead = async (id: string) => {
    try {
      await fetch('/api/admin/notifications', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notification_ids: [id] }),
      })
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n))
      setUnreadCount(prev => Math.max(0, prev - 1))
    } catch {
      // Silently fail
    }
  }

  const togglePreference = async (eventType: NotificationEventType, channel: 'in_app' | 'slack' | 'email') => {
    const current = preferences[eventType]
    if (!current) return

    const newValue = !current[channel]
    const savingKey = `${eventType}-${channel}`
    setPrefSaving(savingKey)

    // Optimistic update
    setPreferences(prev => {
      const updated = { ...prev }
      const current = prev[eventType]
      if (!current) return prev
      updated[eventType] = { in_app: current.in_app, slack: current.slack, email: current.email, [channel]: newValue }
      return updated
    })

    try {
      await fetch('/api/admin/notifications/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_type: eventType,
          [channel]: newValue,
        }),
      })
    } catch {
      // Revert on failure
      setPreferences(prev => {
        const reverted = { ...prev }
        const current = prev[eventType]
        if (!current) return prev
        reverted[eventType] = { in_app: current.in_app, slack: current.slack, email: current.email, [channel]: !newValue }
        return reverted
      })
    } finally {
      setPrefSaving(null)
    }
  }

  // ---- Effects ----
  useEffect(() => {
    fetchNotifications()
    fetchUnreadCount()
  }, [fetchNotifications, fetchUnreadCount])

  useEffect(() => {
    if (tab === 'preferences') {
      fetchPreferences()
    }
  }, [tab, fetchPreferences])

  // ---- Filtered data ----
  const filteredNotifications = notifications.filter(n => {
    if (severityFilter !== 'all' && n.severity !== severityFilter) return false
    if (readFilter === 'read' && !n.is_read) return false
    // unread_only is handled server-side, but double check for client-side filter
    if (readFilter === 'unread' && n.is_read) return false
    return true
  })

  const grouped = groupByDate(filteredNotifications)

  if (loading && tab === 'feed') {
    return <LoadingScreen message="Loading notifications..." />
  }

  return (
    <div>
      <PageHeader
        title="Notifications"
        description={unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
        actions={
          <div className="flex items-center gap-2">
            {tab === 'feed' && unreadCount > 0 && (
              <Button variant="ghost" size="sm" icon={Check} onClick={markAllRead}>
                Mark all read
              </Button>
            )}
            {tab === 'feed' && (
              <Button variant="ghost" size="sm" icon={RefreshCw} onClick={() => { fetchNotifications(); fetchUnreadCount() }}>
                Refresh
              </Button>
            )}
          </div>
        }
      />

      {/* Tab switcher */}
      <div className="flex items-center gap-1 mb-6 p-1 bg-ink-800/50 rounded-xl w-fit ring-1 ring-ink-600/30">
        {([
          { value: 'feed' as const, label: 'Feed', icon: Bell },
          { value: 'preferences' as const, label: 'Preferences', icon: Settings },
        ]).map(t => (
          <button
            key={t.value}
            onClick={() => setTab(t.value)}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all ${
              tab === t.value
                ? 'bg-electric/15 text-electric-300 ring-1 ring-electric/20'
                : 'text-ink-400 hover:text-ink-200'
            }`}
          >
            <t.icon className="w-4 h-4" />
            {t.label}
          </button>
        ))}
      </div>

      {/* ===================== FEED TAB ===================== */}
      {tab === 'feed' && (
        <>
          {/* Filters */}
          <Card className="p-4 mb-6">
            <div className="flex flex-wrap items-center gap-6">
              {/* Severity filter */}
              <div>
                <label className="text-xs font-medium text-ink-500 uppercase tracking-wider mb-2 block">Severity</label>
                <div className="flex items-center gap-1.5">
                  {([
                    { value: 'all' as const, label: 'All' },
                    { value: 'info' as const, label: 'Info' },
                    { value: 'warning' as const, label: 'Warning' },
                    { value: 'error' as const, label: 'Error' },
                  ]).map(opt => {
                    const config = opt.value !== 'all' ? severityConfig[opt.value] : null
                    return (
                      <button
                        key={opt.value}
                        onClick={() => setSeverityFilter(opt.value)}
                        className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5 ${
                          severityFilter === opt.value
                            ? 'bg-electric/15 text-electric-300 ring-1 ring-electric/20'
                            : 'text-ink-400 hover:text-ink-200 hover:bg-ink-700/30'
                        }`}
                      >
                        {config && <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />}
                        {opt.label}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Event type filter */}
              <div>
                <label className="text-xs font-medium text-ink-500 uppercase tracking-wider mb-2 block">Event</label>
                <div className="relative">
                  <select
                    value={eventTypeFilter}
                    onChange={(e) => setEventTypeFilter(e.target.value as 'all' | NotificationEventType)}
                    className="appearance-none bg-ink-700/50 text-sm text-ink-200 border border-ink-600/50 rounded-lg px-3 py-1.5 pr-8 focus:outline-none focus:ring-2 focus:ring-electric/50 focus:border-electric/50 transition-all cursor-pointer"
                  >
                    <option value="all">All Events</option>
                    {EVENT_TYPES.map(et => (
                      <option key={et.value} value={et.value}>{et.label}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-ink-500 pointer-events-none" />
                </div>
              </div>

              {/* Read status */}
              <div>
                <label className="text-xs font-medium text-ink-500 uppercase tracking-wider mb-2 block">Status</label>
                <div className="flex items-center gap-1.5">
                  {([
                    { value: 'all' as const, label: 'All' },
                    { value: 'unread' as const, label: 'Unread' },
                    { value: 'read' as const, label: 'Read' },
                  ]).map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => setReadFilter(opt.value)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                        readFilter === opt.value
                          ? 'bg-electric/15 text-electric-300 ring-1 ring-electric/20'
                          : 'text-ink-400 hover:text-ink-200 hover:bg-ink-700/30'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Clear */}
              {(severityFilter !== 'all' || eventTypeFilter !== 'all' || readFilter !== 'all') && (
                <div className="flex items-end">
                  <button
                    onClick={() => { setSeverityFilter('all'); setEventTypeFilter('all'); setReadFilter('all') }}
                    className="text-xs text-ink-500 hover:text-ink-300 transition-colors pb-1"
                  >
                    Clear all
                  </button>
                </div>
              )}
            </div>
          </Card>

          {/* Empty state */}
          {filteredNotifications.length === 0 && !loading && (
            <Card>
              <div className="p-8">
                <EmptyState
                  icon={Bell}
                  title="No notifications"
                  description={
                    severityFilter !== 'all' || eventTypeFilter !== 'all' || readFilter !== 'all'
                      ? 'No notifications match your filters. Try adjusting them.'
                      : 'Notifications will appear here when syncs fail, triggers fire, and rounds transition.'
                  }
                  action={
                    (severityFilter !== 'all' || eventTypeFilter !== 'all' || readFilter !== 'all') ? (
                      <Button variant="ghost" size="sm" onClick={() => { setSeverityFilter('all'); setEventTypeFilter('all'); setReadFilter('all') }}>
                        Clear filters
                      </Button>
                    ) : undefined
                  }
                />
              </div>
            </Card>
          )}

          {/* Notification feed */}
          {filteredNotifications.length > 0 && (
            <div className="space-y-8">
              {grouped.map((group) => (
                <div key={group.label}>
                  <div className="flex items-center gap-3 mb-4">
                    <h3 className="text-sm font-semibold text-ink-300">{group.label}</h3>
                    <div className="flex-1 h-px bg-ink-600/30" />
                    <span className="text-xs text-ink-500">{group.items.length}</span>
                  </div>

                  <div className="space-y-2">
                    {group.items.map((notif, idx) => {
                      const config = eventConfig[notif.event_type as NotificationEventType]
                      const Icon = config?.icon || Bell
                      const severity = severityConfig[notif.severity as NotificationSeverity] || severityConfig.info

                      return (
                        <motion.div
                          key={notif.id}
                          initial={{ opacity: 0, y: 4 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: Math.min(idx * 0.03, 0.3) }}
                        >
                          <Card className={`overflow-hidden transition-all ${!notif.is_read ? 'ring-1 ring-electric/15' : ''}`}>
                            <div className={`flex items-start gap-4 p-4 ${!notif.is_read ? 'bg-electric/5' : ''}`}>
                              {/* Icon */}
                              <div className={`flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center ${severity.bg}`}>
                                <Icon className={`w-5 h-5 ${severity.color}`} />
                              </div>

                              {/* Content */}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className={`text-sm font-medium ${!notif.is_read ? 'text-ink-100' : 'text-ink-300'}`}>
                                    {notif.title}
                                  </span>
                                  {!notif.is_read && (
                                    <span className="w-2 h-2 rounded-full bg-electric flex-shrink-0" />
                                  )}
                                  <Badge color={severity.badge}>
                                    {notif.severity}
                                  </Badge>
                                </div>
                                <p className="text-sm text-ink-400 mt-1 leading-relaxed">{notif.message}</p>
                                <div className="flex items-center gap-3 mt-2 flex-wrap">
                                  <span className="text-xs text-ink-500">{timeAgo(notif.created_at)}</span>
                                  <span className="text-xs text-ink-600">
                                    {new Date(notif.created_at).toLocaleString('sv-SE')}
                                  </span>
                                  {notif.game_name && (
                                    <span className="text-xs text-ink-500 bg-ink-700/40 px-2 py-0.5 rounded">
                                      {notif.game_name}
                                    </span>
                                  )}
                                  {config && (
                                    <span className="text-xs text-ink-500 bg-ink-700/40 px-2 py-0.5 rounded">
                                      {config.label}
                                    </span>
                                  )}
                                </div>
                              </div>

                              {/* Mark read button */}
                              {!notif.is_read && (
                                <button
                                  onClick={() => markRead(notif.id)}
                                  className="flex-shrink-0 mt-1 p-1.5 text-ink-500 hover:text-electric-400 hover:bg-electric/10 rounded-lg transition-all"
                                >
                                  <Check className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </Card>
                        </motion.div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ===================== PREFERENCES TAB ===================== */}
      {tab === 'preferences' && (
        <div>
          {prefsLoading ? (
            <div className="flex items-center justify-center py-16">
              <div className="animate-spin rounded-full h-6 w-6 border-2 border-ink-600 border-t-electric" />
            </div>
          ) : (
            <Card className="overflow-hidden">
              {/* Table header */}
              <div className="grid grid-cols-[1fr_100px_100px_100px] gap-4 px-6 py-3 border-b border-ink-600/30 bg-ink-800/50">
                <span className="text-xs font-medium text-ink-500 uppercase tracking-wider">Event Type</span>
                <span className="text-xs font-medium text-ink-500 uppercase tracking-wider text-center">In-App</span>
                <span className="text-xs font-medium text-ink-500 uppercase tracking-wider text-center">Slack</span>
                <span className="text-xs font-medium text-ink-500 uppercase tracking-wider text-center">Email</span>
              </div>

              {/* Rows */}
              {EVENT_TYPES.map((et) => {
                const config = eventConfig[et.value]
                const pref = preferences[et.value]
                const Icon = config.icon

                return (
                  <div
                    key={et.value}
                    className="grid grid-cols-[1fr_100px_100px_100px] gap-4 items-center px-6 py-4 border-b border-ink-600/20 hover:bg-ink-700/20 transition-colors"
                  >
                    {/* Event info */}
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-ink-700/40 flex items-center justify-center">
                        <Icon className="w-4 h-4 text-ink-300" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-ink-200">{config.label}</p>
                        <p className="text-xs text-ink-500">{config.description}</p>
                      </div>
                    </div>

                    {/* Channel toggles */}
                    {(['in_app', 'slack', 'email'] as const).map(channel => {
                      const isEnabled = pref?.[channel] ?? false
                      const isSaving = prefSaving === `${et.value}-${channel}`

                      return (
                        <div key={channel} className="flex justify-center">
                          <button
                            onClick={() => togglePreference(et.value, channel)}
                            disabled={isSaving}
                            className={`
                              relative w-11 h-6 rounded-full transition-all duration-200
                              ${isEnabled
                                ? 'bg-electric/30 ring-1 ring-electric/40'
                                : 'bg-ink-700/50 ring-1 ring-ink-600/30'
                              }
                              ${isSaving ? 'opacity-50' : 'cursor-pointer hover:ring-ink-500/50'}
                            `}
                          >
                            <motion.div
                              animate={{ x: isEnabled ? 20 : 2 }}
                              transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                              className={`
                                absolute top-1 w-4 h-4 rounded-full transition-colors
                                ${isEnabled ? 'bg-electric' : 'bg-ink-500'}
                              `}
                            />
                          </button>
                        </div>
                      )
                    })}
                  </div>
                )
              })}

              {/* Footer note */}
              <div className="px-6 py-3 bg-ink-800/30">
                <p className="text-xs text-ink-500">
                  Email notifications are not yet active. Slack notifications require a configured webhook URL.
                </p>
              </div>
            </Card>
          )}
        </div>
      )}
    </div>
  )
}
