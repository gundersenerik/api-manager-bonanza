'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { RefreshCw, ChevronDown, ChevronUp } from 'lucide-react'
import { SyncLog } from '@/types'
import { Card } from '@/components/ui/Card'
import { SyncStatusDot } from '@/components/ui/StatusDot'

interface SyncLogsSectionProps {
  syncLogs: SyncLog[]
}

const formatDate = (dateString: string | null) => {
  if (!dateString) return 'Never'
  return new Date(dateString).toLocaleString('sv-SE')
}

export function SyncLogsSection({ syncLogs }: SyncLogsSectionProps) {
  const [showAllLogs, setShowAllLogs] = useState(false)
  const visibleLogs = showAllLogs ? syncLogs : syncLogs.slice(0, 3)

  return (
    <Card className="overflow-hidden">
      <div className="px-6 py-4 border-b border-ink-600/20 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <RefreshCw className="w-5 h-5 text-electric" />
          <h2 className="text-lg font-heading font-semibold text-ink-50">Recent Sync Logs</h2>
        </div>
        {syncLogs.length > 3 && (
          <button
            onClick={() => setShowAllLogs(!showAllLogs)}
            className="inline-flex items-center gap-1 text-sm text-ink-400 hover:text-ink-200 transition-colors"
          >
            {showAllLogs ? (
              <>
                <ChevronUp className="w-4 h-4" />
                Show less
              </>
            ) : (
              <>
                <ChevronDown className="w-4 h-4" />
                Show all ({syncLogs.length})
              </>
            )}
          </button>
        )}
      </div>
      <div className="divide-y divide-ink-600/20">
        {visibleLogs.length === 0 ? (
          <div className="p-6 text-center text-ink-500">
            No sync logs yet. Trigger a sync to see logs here.
          </div>
        ) : (
          visibleLogs.map((log, index) => (
            <motion.div
              key={log.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: index * 0.03 }}
              className={`p-4 flex items-center justify-between ${
                log.status === 'failed' ? 'bg-punch/5' : ''
              }`}
            >
              <div className="flex items-center gap-3">
                <SyncStatusDot status={log.status as 'completed' | 'failed' | 'running'} />
                <div>
                  <div className="text-sm font-medium text-ink-200">
                    {log.sync_type === 'manual' ? 'Manual Sync' : 'Scheduled Sync'}
                  </div>
                  <div className="text-xs text-ink-500">
                    {formatDate(log.started_at)}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm text-ink-200">
                  {log.users_synced} users, {log.elements_synced} elements
                </div>
                {log.error_message && (
                  <div className="text-xs text-punch mt-0.5">{log.error_message}</div>
                )}
              </div>
            </motion.div>
          ))
        )}
      </div>
    </Card>
  )
}
