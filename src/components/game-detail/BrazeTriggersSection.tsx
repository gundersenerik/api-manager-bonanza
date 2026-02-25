'use client'

import { useState, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Bell,
  Plus,
  Trash2,
  Play,
  FlaskConical,
  ChevronDown,
  ChevronUp,
  Clock,
  CheckCircle2,
  XCircle,
  SkipForward,
  Power,
  Copy,
  Check,
} from 'lucide-react'
import { GameTrigger, TriggerLog } from '@/types'
import { useAuth } from '@/contexts/AuthContext'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Input, SelectInput } from '@/components/ui/Input'

interface BrazeTriggersSectionProps {
  gameId: string
  triggers: GameTrigger[]
  onTriggerChange: () => void
}

const getTriggerTypeName = (type: string) => {
  switch (type) {
    case 'deadline_reminder_24h': return '24h Deadline Reminder'
    case 'round_started': return 'Round Started'
    case 'round_ended': return 'Round Ended'
    default: return type
  }
}

const getTriggerTypeDescription = (type: string) => {
  switch (type) {
    case 'deadline_reminder_24h': return 'Fires ~24h before trade deadline closes'
    case 'round_started': return 'Fires when a new round opens for trading'
    case 'round_ended': return 'Fires when round scoring is finalized'
    default: return ''
  }
}

const formatDate = (dateString: string | null) => {
  if (!dateString) return 'Never'
  return new Date(dateString).toLocaleString('sv-SE')
}

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'triggered': return CheckCircle2
    case 'failed': return XCircle
    case 'skipped': return SkipForward
    default: return Clock
  }
}

const getStatusColor = (status: string) => {
  switch (status) {
    case 'triggered': return 'text-mint'
    case 'failed': return 'text-punch'
    case 'skipped': return 'text-solar'
    default: return 'text-ink-400'
  }
}

export function BrazeTriggersSection({ gameId, triggers, onTriggerChange }: BrazeTriggersSectionProps) {
  const { isAdmin } = useAuth()
  const [showTriggerForm, setShowTriggerForm] = useState(false)
  const [triggerForm, setTriggerForm] = useState({
    trigger_type: 'deadline_reminder_24h',
    braze_campaign_id: '',
  })

  // Per-trigger expanded state for history
  const [expandedTriggers, setExpandedTriggers] = useState<Set<string>>(new Set())
  const [triggerHistory, setTriggerHistory] = useState<Record<string, TriggerLog[]>>({})
  const [historyLoading, setHistoryLoading] = useState<Set<string>>(new Set())

  // Dry-run / fire state
  const [dryRunResult, setDryRunResult] = useState<{ triggerId: string; data: Record<string, unknown> } | null>(null)
  const [firing, setFiring] = useState<string | null>(null)
  const [fireResult, setFireResult] = useState<{ triggerId: string; success: boolean; message: string } | null>(null)
  const [toggling, setToggling] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const handleAddTrigger = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const res = await fetch(`/api/admin/games/${gameId}/triggers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(triggerForm),
      })
      const data = await res.json()
      if (data.success) {
        setShowTriggerForm(false)
        setTriggerForm({ trigger_type: 'deadline_reminder_24h', braze_campaign_id: '' })
        onTriggerChange()
      }
    } catch (error) {
      console.error('Failed to add trigger:', error)
    }
  }

  const handleDeleteTrigger = async (triggerId: string) => {
    if (!confirm('Are you sure you want to delete this trigger?')) return
    try {
      await fetch(`/api/admin/games/${gameId}/triggers?trigger_id=${triggerId}`, {
        method: 'DELETE',
      })
      onTriggerChange()
    } catch (error) {
      console.error('Failed to delete trigger:', error)
    }
  }

  const handleToggleActive = async (trigger: GameTrigger) => {
    setToggling(trigger.id)
    try {
      const res = await fetch(`/api/admin/games/${gameId}/triggers`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trigger_id: trigger.id,
          is_active: !trigger.is_active,
        }),
      })
      const data = await res.json()
      if (data.success) {
        onTriggerChange()
      }
    } catch (error) {
      console.error('Failed to toggle trigger:', error)
    } finally {
      setToggling(null)
    }
  }

  const fetchTriggerHistory = useCallback(async (triggerId: string) => {
    setHistoryLoading((prev) => new Set(prev).add(triggerId))
    try {
      const res = await fetch(`/api/admin/games/${gameId}/triggers/history?trigger_id=${triggerId}&limit=10`)
      const data = await res.json()
      if (data.success) {
        setTriggerHistory((prev) => ({ ...prev, [triggerId]: data.data }))
      }
    } catch (error) {
      console.error('Failed to fetch trigger history:', error)
    } finally {
      setHistoryLoading((prev) => {
        const next = new Set(prev)
        next.delete(triggerId)
        return next
      })
    }
  }, [gameId])

  const toggleHistory = (triggerId: string) => {
    setExpandedTriggers((prev) => {
      const next = new Set(prev)
      if (next.has(triggerId)) {
        next.delete(triggerId)
      } else {
        next.add(triggerId)
        // Fetch history if not already loaded
        if (!triggerHistory[triggerId]) {
          fetchTriggerHistory(triggerId)
        }
      }
      return next
    })
  }

  const handleDryRun = async (triggerId: string) => {
    setFiring(triggerId)
    setFireResult(null)
    setDryRunResult(null)
    try {
      const res = await fetch(`/api/admin/games/${gameId}/triggers/fire`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trigger_id: triggerId, dry_run: true }),
      })
      const data = await res.json()
      if (data.success) {
        setDryRunResult({ triggerId, data: data.data })
      } else {
        setFireResult({ triggerId, success: false, message: data.error || 'Dry run failed' })
      }
    } catch (error) {
      setFireResult({ triggerId, success: false, message: 'Network error' })
    } finally {
      setFiring(null)
    }
  }

  const handleManualFire = async (triggerId: string) => {
    if (!confirm('Are you sure you want to fire this trigger NOW? This will send a real campaign to Braze.')) return
    setFiring(triggerId)
    setFireResult(null)
    setDryRunResult(null)
    try {
      const res = await fetch(`/api/admin/games/${gameId}/triggers/fire`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trigger_id: triggerId, dry_run: false }),
      })
      const data = await res.json()
      setFireResult({
        triggerId,
        success: data.success,
        message: data.message || (data.success ? 'Campaign sent' : 'Failed'),
      })
      if (data.success) {
        onTriggerChange()
        // Refresh history if expanded
        if (expandedTriggers.has(triggerId)) {
          fetchTriggerHistory(triggerId)
        }
      }
    } catch (error) {
      setFireResult({ triggerId, success: false, message: 'Network error' })
    } finally {
      setFiring(null)
    }
  }

  const handleCopyPayload = (data: Record<string, unknown>) => {
    navigator.clipboard.writeText(JSON.stringify(data, null, 2))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // Clear fire/dry-run results after 8 seconds
  useEffect(() => {
    if (fireResult) {
      const t = setTimeout(() => setFireResult(null), 8000)
      return () => clearTimeout(t)
    }
  }, [fireResult])

  return (
    <Card className="mb-8 overflow-hidden">
      <div className="px-6 py-4 border-b border-ink-600/20 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bell className="w-5 h-5 text-solar" />
          <h2 className="text-lg font-heading font-semibold text-ink-50">Braze Triggers</h2>
          {triggers.length > 0 && (
            <span className="text-xs text-ink-500 ml-1">
              {triggers.filter((t) => t.is_active).length}/{triggers.length} active
            </span>
          )}
        </div>
        {isAdmin && (
          <Button
            variant="ghost"
            size="sm"
            icon={Plus}
            onClick={() => setShowTriggerForm(!showTriggerForm)}
          >
            Add Trigger
          </Button>
        )}
      </div>

      {/* Add trigger form */}
      <AnimatePresence>
        {showTriggerForm && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <form onSubmit={handleAddTrigger} className="p-6 border-b border-ink-600/20 bg-ink-800/40">
              <div className="grid grid-cols-2 gap-4">
                <SelectInput
                  label="Trigger Type"
                  value={triggerForm.trigger_type}
                  onChange={(e) => setTriggerForm({ ...triggerForm, trigger_type: e.target.value })}
                >
                  <option value="deadline_reminder_24h">24h Deadline Reminder</option>
                  <option value="round_started">Round Started</option>
                  <option value="round_ended">Round Ended</option>
                </SelectInput>
                <Input
                  label="Braze Campaign ID"
                  required
                  placeholder="campaign_id_here"
                  value={triggerForm.braze_campaign_id}
                  onChange={(e) => setTriggerForm({ ...triggerForm, braze_campaign_id: e.target.value })}
                />
              </div>
              <div className="mt-4 flex gap-2">
                <Button type="submit" size="sm">Add Trigger</Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowTriggerForm(false)}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Triggers list */}
      <div className="divide-y divide-ink-600/20">
        {triggers.length === 0 ? (
          <div className="p-6 text-center text-ink-500">
            No triggers configured. Add a trigger to automate Braze campaigns.
          </div>
        ) : (
          triggers.map((trigger, index) => (
            <motion.div
              key={trigger.id}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              {/* Trigger row */}
              <div className="p-5 flex items-start justify-between hover:bg-ink-700/10 transition-colors">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-ink-50">
                      {getTriggerTypeName(trigger.trigger_type)}
                    </span>
                    {!trigger.is_active && (
                      <Badge color="ink">Paused</Badge>
                    )}
                  </div>
                  <div className="text-sm text-ink-500 mt-0.5">
                    {getTriggerTypeDescription(trigger.trigger_type)}
                  </div>
                  <div className="text-sm text-ink-400 font-mono mt-1">
                    {trigger.braze_campaign_id}
                  </div>
                  {trigger.last_triggered_at && (
                    <div className="text-xs text-ink-500 mt-1">
                      Last fired: {formatDate(trigger.last_triggered_at)} (Round {trigger.last_triggered_round})
                    </div>
                  )}
                </div>

                {/* Action buttons */}
                <div className="flex items-center gap-2 ml-4 flex-shrink-0">
                  {/* History toggle */}
                  <button
                    onClick={() => toggleHistory(trigger.id)}
                    className="flex items-center gap-1 px-2 py-1.5 text-xs text-ink-400 hover:text-ink-200 hover:bg-ink-700/40 rounded-lg transition-colors"
                  >
                    <Clock className="w-3.5 h-3.5" />
                    History
                    {expandedTriggers.has(trigger.id) ? (
                      <ChevronUp className="w-3 h-3" />
                    ) : (
                      <ChevronDown className="w-3 h-3" />
                    )}
                  </button>

                  {isAdmin && (
                    <>
                      {/* Dry run */}
                      <button
                        onClick={() => handleDryRun(trigger.id)}
                        disabled={firing === trigger.id}
                        className="flex items-center gap-1 px-2 py-1.5 text-xs text-ocean-400 hover:text-ocean-300 hover:bg-ocean/10 rounded-lg transition-colors disabled:opacity-50"
                      >
                        <FlaskConical className="w-3.5 h-3.5" />
                        Test
                      </button>

                      {/* Manual fire */}
                      <button
                        onClick={() => handleManualFire(trigger.id)}
                        disabled={firing === trigger.id}
                        className="flex items-center gap-1 px-2 py-1.5 text-xs text-solar hover:text-solar/80 hover:bg-solar/10 rounded-lg transition-colors disabled:opacity-50"
                      >
                        <Play className="w-3.5 h-3.5" />
                        Fire
                      </button>

                      {/* Toggle active */}
                      <button
                        onClick={() => handleToggleActive(trigger)}
                        disabled={toggling === trigger.id}
                        className={`p-1.5 rounded-lg transition-colors disabled:opacity-50 ${
                          trigger.is_active
                            ? 'text-mint hover:text-mint/70 hover:bg-mint/10'
                            : 'text-ink-500 hover:text-ink-300 hover:bg-ink-700/40'
                        }`}
                      >
                        <Power className="w-4 h-4" />
                      </button>

                      {/* Delete */}
                      <motion.button
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => handleDeleteTrigger(trigger.id)}
                        className="p-1.5 text-ink-500 hover:text-punch transition-colors rounded-lg hover:bg-punch/10"
                      >
                        <Trash2 className="w-4 h-4" />
                      </motion.button>
                    </>
                  )}
                </div>
              </div>

              {/* Fire result banner */}
              <AnimatePresence>
                {fireResult && fireResult.triggerId === trigger.id && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className={`mx-5 mb-3 p-3 rounded-xl text-sm flex items-center gap-2 ${
                      fireResult.success
                        ? 'bg-mint/10 border border-mint/20 text-mint'
                        : 'bg-punch/10 border border-punch/20 text-punch'
                    }`}>
                      {fireResult.success ? (
                        <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                      ) : (
                        <XCircle className="w-4 h-4 flex-shrink-0" />
                      )}
                      {fireResult.message}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Dry run result */}
              <AnimatePresence>
                {dryRunResult && dryRunResult.triggerId === trigger.id && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="mx-5 mb-3 p-4 bg-ocean/5 border border-ocean/20 rounded-xl">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2 text-sm font-medium text-ocean-300">
                          <FlaskConical className="w-4 h-4" />
                          Dry Run Preview
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleCopyPayload(dryRunResult.data)}
                            className="flex items-center gap-1 px-2 py-1 text-xs text-ink-400 hover:text-ink-200 bg-ink-700/40 hover:bg-ink-700/60 rounded transition-colors"
                          >
                            {copied ? <Check className="w-3 h-3 text-mint" /> : <Copy className="w-3 h-3" />}
                            {copied ? 'Copied' : 'Copy'}
                          </button>
                          <button
                            onClick={() => setDryRunResult(null)}
                            className="text-xs text-ink-500 hover:text-ink-300 transition-colors"
                          >
                            Dismiss
                          </button>
                        </div>
                      </div>
                      <pre className="text-xs text-ink-300 bg-ink-900/60 rounded-lg p-3 overflow-x-auto max-h-64 font-mono">
                        {JSON.stringify(dryRunResult.data, null, 2)}
                      </pre>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Trigger history */}
              <AnimatePresence>
                {expandedTriggers.has(trigger.id) && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="mx-5 mb-4 border border-ink-600/20 rounded-xl overflow-hidden">
                      <div className="px-4 py-2.5 bg-ink-800/60 border-b border-ink-600/20 text-xs font-medium text-ink-400">
                        Execution History (last 10)
                      </div>
                      {historyLoading.has(trigger.id) ? (
                        <div className="p-4 text-center">
                          <div className="animate-spin rounded-full h-5 w-5 border-2 border-ink-600 border-t-ocean mx-auto" />
                        </div>
                      ) : (
                        <div className="divide-y divide-ink-600/10">
                          {(!triggerHistory[trigger.id] || triggerHistory[trigger.id]?.length === 0) ? (
                            <div className="p-4 text-center text-xs text-ink-500">
                              No execution history yet
                            </div>
                          ) : (
                            triggerHistory[trigger.id]?.map((log) => {
                              const StatusIcon = getStatusIcon(log.status)
                              return (
                                <div
                                  key={log.id}
                                  className="px-4 py-2.5 flex items-center gap-3 text-xs hover:bg-ink-700/10 transition-colors"
                                >
                                  <StatusIcon className={`w-3.5 h-3.5 flex-shrink-0 ${getStatusColor(log.status)}`} />
                                  <span className={`font-medium capitalize ${getStatusColor(log.status)}`}>
                                    {log.status}
                                  </span>
                                  <span className="text-ink-400">Round {log.round_index}</span>
                                  <span className="text-ink-500 ml-auto">
                                    {formatDate(log.triggered_at)}
                                  </span>
                                  {log.error_message && (
                                    <span className="text-punch/70 truncate max-w-[200px]">
                                      {log.error_message}
                                    </span>
                                  )}
                                </div>
                              )
                            })
                          )}
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))
        )}
      </div>
    </Card>
  )
}
