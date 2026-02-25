'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  RefreshCw,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { SyncStatusDot } from '@/components/ui/StatusDot'
import { CodeBlock } from '@/components/ui/CodeBlock'
import { EmptyState } from '@/components/ui/EmptyState'
import { PageHeader } from '@/components/layout/PageHeader'
import { LoadingScreen } from '@/components/ui/LoadingDots'
import { ExportButton } from '@/components/ui/ExportButton'
import { exportCsv, exportJson } from '@/lib/csv-export'

interface SyncLog {
  id: string
  game_id: string
  trigger_type: string
  status: string
  elements_synced: number
  users_synced: number
  error_message: string | null
  started_at: string
  completed_at: string | null
  game?: {
    name: string
    game_key: string
  }
}

const triggerColors: Record<string, 'electric' | 'ocean' | 'solar' | 'ink'> = {
  manual: 'electric',
  scheduled: 'ocean',
  webhook: 'solar',
}

const syncLogCsvColumns = [
  { header: 'Status', accessor: (row: SyncLog) => row.status },
  { header: 'Game', accessor: (row: SyncLog) => row.game?.name || 'Unknown' },
  { header: 'Game Key', accessor: (row: SyncLog) => row.game?.game_key || '' },
  { header: 'Trigger', accessor: (row: SyncLog) => row.trigger_type },
  { header: 'Elements Synced', accessor: (row: SyncLog) => row.elements_synced },
  { header: 'Users Synced', accessor: (row: SyncLog) => row.users_synced },
  { header: 'Error', accessor: (row: SyncLog) => row.error_message || '' },
  { header: 'Started At', accessor: (row: SyncLog) => row.started_at },
  { header: 'Completed At', accessor: (row: SyncLog) => row.completed_at || '' },
]

export default function SyncLogsPage() {
  const [logs, setLogs] = useState<SyncLog[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedLog, setExpandedLog] = useState<string | null>(null)

  useEffect(() => {
    fetchLogs()
  }, [])

  const fetchLogs = async () => {
    try {
      const res = await fetch('/api/admin/sync-logs')
      const data = await res.json()
      if (data.success) {
        setLogs(data.data || [])
      }
    } catch (error) {
      console.error('Failed to fetch sync logs:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-'
    return new Date(dateString).toLocaleString('sv-SE')
  }

  const formatDuration = (start: string, end: string | null) => {
    if (!end) return 'In progress...'
    const durationMs = new Date(end).getTime() - new Date(start).getTime()
    if (durationMs < 1000) return `${durationMs}ms`
    if (durationMs < 60000) return `${(durationMs / 1000).toFixed(1)}s`
    return `${(durationMs / 60000).toFixed(1)}m`
  }

  const getDurationColor = (start: string, end: string | null) => {
    if (!end) return 'text-ocean'
    const durationMs = new Date(end).getTime() - new Date(start).getTime()
    if (durationMs < 2000) return 'text-mint'
    if (durationMs < 30000) return 'text-ink-300'
    return 'text-solar'
  }

  if (loading) {
    return <LoadingScreen message="Loading sync logs..." />
  }

  return (
    <div>
      <PageHeader
        title="Sync Logs"
        description="View synchronization history across all games"
        actions={
          <div className="flex items-center gap-2">
            {logs.length > 0 && (
              <ExportButton
                onExportCsv={() => exportCsv(logs, syncLogCsvColumns, 'sync-logs')}
                onExportJson={() => exportJson(logs, 'sync-logs')}
              />
            )}
            <Button
              variant="ghost"
              icon={RefreshCw}
              size="sm"
              onClick={() => { setLoading(true); fetchLogs() }}
            >
              Refresh
            </Button>
          </div>
        }
      />

      {logs.length === 0 ? (
        <Card>
          <div className="p-8">
            <EmptyState
              icon={RefreshCw}
              title="No sync logs yet"
              description="Sync logs will appear here when games are synchronized"
            />
          </div>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-ink-600/30 bg-ink-800/80">
                  <th className="px-6 py-3.5 text-left text-xs font-medium text-ink-400 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3.5 text-left text-xs font-medium text-ink-400 uppercase tracking-wider">
                    Game
                  </th>
                  <th className="px-6 py-3.5 text-left text-xs font-medium text-ink-400 uppercase tracking-wider">
                    Trigger
                  </th>
                  <th className="px-6 py-3.5 text-left text-xs font-medium text-ink-400 uppercase tracking-wider">
                    Synced
                  </th>
                  <th className="px-6 py-3.5 text-left text-xs font-medium text-ink-400 uppercase tracking-wider">
                    Duration
                  </th>
                  <th className="px-6 py-3.5 text-left text-xs font-medium text-ink-400 uppercase tracking-wider">
                    Started
                  </th>
                  <th className="px-6 py-3.5 w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-600/20">
                {logs.map((log, index) => (
                  <motion.tr
                    key={log.id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.03, duration: 0.3 }}
                  >
                    <td className="px-6 py-4" colSpan={7}>
                      <div className={`${log.status === 'failed' ? 'bg-punch/5 -mx-6 -my-4 px-6 py-4' : ''}`}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-6 flex-1 min-w-0">
                            {/* Status */}
                            <div className="flex items-center gap-2 w-28 flex-shrink-0">
                              <SyncStatusDot status={log.status as 'completed' | 'failed' | 'running'} />
                              <Badge color={
                                log.status === 'completed' ? 'mint'
                                : log.status === 'failed' ? 'punch'
                                : 'ocean'
                              }>
                                {log.status}
                              </Badge>
                            </div>

                            {/* Game */}
                            <div className="min-w-0 w-48 flex-shrink-0">
                              <div className="font-medium text-ink-50 truncate">
                                {log.game?.name || 'Unknown Game'}
                              </div>
                              <div className="text-xs text-ink-500 font-mono truncate">
                                {log.game?.game_key}
                              </div>
                            </div>

                            {/* Trigger */}
                            <div className="w-24 flex-shrink-0">
                              <Badge color={triggerColors[log.trigger_type] || 'ink'}>
                                {log.trigger_type}
                              </Badge>
                            </div>

                            {/* Synced */}
                            <div className="text-sm text-ink-200 w-40 flex-shrink-0">
                              {log.elements_synced} elements, {log.users_synced} users
                            </div>

                            {/* Duration */}
                            <div className={`text-sm font-mono w-20 flex-shrink-0 ${getDurationColor(log.started_at, log.completed_at)}`}>
                              {formatDuration(log.started_at, log.completed_at)}
                            </div>

                            {/* Started */}
                            <div className="text-sm text-ink-400 flex-shrink-0">
                              {formatDate(log.started_at)}
                            </div>
                          </div>

                          {/* Expand */}
                          <div className="ml-4 flex-shrink-0">
                            {log.error_message && (
                              <motion.button
                                whileHover={{ scale: 1.1 }}
                                whileTap={{ scale: 0.9 }}
                                onClick={() => setExpandedLog(expandedLog === log.id ? null : log.id)}
                                className="p-1 text-ink-500 hover:text-ink-200 transition-colors"
                              >
                                {expandedLog === log.id ? (
                                  <ChevronUp className="w-5 h-5" />
                                ) : (
                                  <ChevronDown className="w-5 h-5" />
                                )}
                              </motion.button>
                            )}
                          </div>
                        </div>

                        {/* Error expansion */}
                        <AnimatePresence>
                          {expandedLog === log.id && log.error_message && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.2 }}
                              className="overflow-hidden"
                            >
                              <div className="mt-3">
                                <CodeBlock code={log.error_message} showCopy={false} />
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  )
}
