'use client'

import { useState, useCallback, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  Play,
  Zap,
  User,
  Trophy,
  Shield,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Clock,
  Copy,
  Check,
  ChevronDown,
  ChevronRight,
  Gamepad2,
  Users,
  Layers,
  Sparkles,
  Heart,
  XCircle,
} from 'lucide-react'
import { Game, BrazeUserResponse } from '@/types'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { CopyButton } from '@/components/ui/CopyButton'
import { PageHeader } from '@/components/layout/PageHeader'

interface PreviewResponse {
  request: {
    url: string
    game_name: string
    game_key: string
    external_id: string
  }
  response: {
    status: number
    latency_ms: number
    headers: Record<string, string | null>
    body: {
      success: boolean
      data?: BrazeUserResponse
      error?: string
      timestamp?: string
    }
  }
}

interface CollapsibleSectionProps {
  title: string
  icon: React.ReactNode
  defaultOpen?: boolean
  badge?: string
  children: React.ReactNode
}

function CollapsibleSection({ title, icon, defaultOpen = false, badge, children }: CollapsibleSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen)

  return (
    <div className="border border-ink-600/20 rounded-xl overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center gap-2 px-4 py-3 bg-ink-800/40 hover:bg-ink-800/60 transition-colors text-left"
      >
        <span className="text-ink-400">{icon}</span>
        <span className="text-sm font-medium text-ink-200 flex-1">{title}</span>
        {badge && <Badge color="ocean">{badge}</Badge>}
        {isOpen ? (
          <ChevronDown className="w-4 h-4 text-ink-500" />
        ) : (
          <ChevronRight className="w-4 h-4 text-ink-500" />
        )}
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="p-4 border-t border-ink-600/20">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function DataRow({ label, value, highlight }: { label: string; value: React.ReactNode; highlight?: boolean }) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-xs text-ink-400">{label}</span>
      <span className={`text-sm font-mono ${highlight ? 'text-electric-300' : 'text-ink-200'}`}>
        {value}
      </span>
    </div>
  )
}

export default function ConnectedContentPreviewPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()

  const [game, setGame] = useState<Game | null>(null)
  const [externalId, setExternalId] = useState('')
  const [loading, setLoading] = useState(false)
  const [gameLoading, setGameLoading] = useState(true)
  const [result, setResult] = useState<PreviewResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [rawJsonOpen, setRawJsonOpen] = useState(false)
  const [copiedJson, setCopiedJson] = useState(false)

  // Fetch game details
  const fetchGame = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/games/${params.id}`)
      const data = await res.json()
      if (data.success) {
        setGame(data.data.game)
      }
    } catch (err) {
      console.error('Failed to fetch game:', err)
    } finally {
      setGameLoading(false)
    }
  }, [params.id])

  useEffect(() => {
    fetchGame()
  }, [fetchGame])

  const handleTest = async () => {
    if (!externalId.trim()) {
      setError('Please enter an external ID')
      return
    }

    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const res = await fetch(
        `/api/admin/games/${params.id}/preview?external_id=${encodeURIComponent(externalId.trim())}`
      )
      const data = await res.json()

      if (data.success) {
        setResult(data.data)
      } else {
        setError(data.error || 'Preview request failed')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error')
    } finally {
      setLoading(false)
    }
  }

  const handleCopyFullJson = async () => {
    if (!result) return
    try {
      await navigator.clipboard.writeText(JSON.stringify(result.response.body, null, 2))
      setCopiedJson(true)
      setTimeout(() => setCopiedJson(false), 2000)
    } catch {
      // fallback
    }
  }

  const responseData = result?.response?.body?.data
  const isSuccess = result?.response?.status === 200 && result?.response?.body?.success

  if (gameLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-ink-600 border-t-electric" />
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Back link */}
      <button
        onClick={() => router.push(`/dashboard/games/${params.id}`)}
        className="flex items-center gap-1.5 text-sm text-ink-400 hover:text-ink-200 transition-colors mb-4"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to {game?.name || 'game'}
      </button>

      <PageHeader
        title="Connected Content Preview"
        description={`Test the Braze Connected Content API for ${game?.name || 'this game'}. Enter a user's external ID to see exactly what Braze receives.`}
      />

      {/* Test Input */}
      <Card className="mb-6">
        <div className="p-6">
          <div className="flex items-start gap-3">
            <div className="flex-1">
              <label className="block text-sm font-medium text-ink-200 mb-2">
                External ID
              </label>
              <div className="flex gap-3">
                <input
                  type="text"
                  value={externalId}
                  onChange={(e) => setExternalId(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleTest()}
                  placeholder="e.g. 699590 or sdrn:schibsted.com:user:699590"
                  className="flex-1 bg-ink-800/50 text-ink-100 placeholder-ink-500 px-4 py-2.5 rounded-xl ring-1 ring-ink-600/30 focus:ring-2 focus:ring-electric/40 focus:outline-none text-sm font-mono transition-all"
                />
                <Button
                  onClick={handleTest}
                  disabled={loading || !externalId.trim()}
                  icon={loading ? undefined : Play}
                  variant="primary"
                >
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white/30 border-t-white" />
                      Testing...
                    </span>
                  ) : (
                    'Test API'
                  )}
                </Button>
              </div>
              <p className="text-xs text-ink-500 mt-1.5">
                The user&apos;s Schibsted ID — numeric or full URN format. This calls the same endpoint Braze uses.
              </p>
            </div>
          </div>

          {/* Request URL preview */}
          {game && externalId.trim() && (
            <div className="mt-4 px-4 py-2.5 bg-ink-950 rounded-xl ring-1 ring-ink-600/20">
              <div className="flex items-center gap-2 text-xs text-ink-500 mb-1">
                <Zap className="w-3.5 h-3.5" />
                Request URL
              </div>
              <code className="text-sm font-mono text-ocean-300">
                /api/v1/users/{externalId.trim()}/games/{game.game_key}
              </code>
            </div>
          )}
        </div>
      </Card>

      {/* Error Display */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            <Card className="mb-6 border-punch/20">
              <div className="p-4 flex items-start gap-3">
                <XCircle className="w-5 h-5 text-punch flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-punch">Request Failed</p>
                  <p className="text-sm text-ink-300 mt-1">{error}</p>
                </div>
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Results */}
      <AnimatePresence>
        {result && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            {/* Response Meta */}
            <Card>
              <div className="px-6 py-4 flex items-center justify-between border-b border-ink-600/20">
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${
                    isSuccess ? 'bg-mint' : 'bg-punch'
                  }`} />
                  <span className="text-sm font-medium text-ink-200">
                    HTTP {result.response.status}
                  </span>
                  <Badge color={isSuccess ? 'mint' : 'punch'}>
                    {isSuccess ? 'Success' : 'Error'}
                  </Badge>
                </div>
                <div className="flex items-center gap-4 text-xs text-ink-500">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    {result.response.latency_ms}ms
                  </span>
                  {result.response.headers['x-ratelimit-remaining'] && (
                    <span>
                      Rate limit: {result.response.headers['x-ratelimit-remaining']} remaining
                    </span>
                  )}
                </div>
              </div>
            </Card>

            {/* Structured Data View */}
            {isSuccess && responseData && (
              <div className="space-y-3">
                {/* User Stats */}
                <CollapsibleSection
                  title="User Stats"
                  icon={<User className="w-4 h-4" />}
                  defaultOpen
                  badge={responseData.user?.team_name || undefined}
                >
                  <div className="grid grid-cols-2 gap-x-6 gap-y-0.5">
                    <DataRow label="Team Name" value={responseData.user?.team_name || '—'} highlight />
                    <DataRow label="Overall Rank" value={`#${responseData.user?.rank || '—'}`} />
                    <DataRow label="Total Score" value={responseData.user?.score ?? '—'} />
                    <DataRow label="Round Score" value={responseData.user?.round_score ?? '—'} />
                    <DataRow label="Round Rank" value={`#${responseData.user?.round_rank || '—'}`} />
                    <DataRow label="Position Change" value={
                      <span className={
                        (responseData.user?.position_change ?? 0) > 0 ? 'text-mint' :
                        (responseData.user?.position_change ?? 0) < 0 ? 'text-punch' : ''
                      }>
                        {(responseData.user?.position_change ?? 0) > 0 ? '+' : ''}{responseData.user?.position_change ?? 0}
                      </span>
                    } />
                    <DataRow label="Percentile" value={`${responseData.user?.percentile ?? '—'}%`} />
                    <DataRow label="Injured Players" value={
                      <span className={(responseData.user?.injured_count ?? 0) > 0 ? 'text-punch' : ''}>
                        {responseData.user?.injured_count ?? 0}
                      </span>
                    } />
                    <DataRow label="Suspended Players" value={
                      <span className={(responseData.user?.suspended_count ?? 0) > 0 ? 'text-solar' : ''}>
                        {responseData.user?.suspended_count ?? 0}
                      </span>
                    } />
                  </div>
                </CollapsibleSection>

                {/* Game Info */}
                <CollapsibleSection
                  title="Game Info"
                  icon={<Gamepad2 className="w-4 h-4" />}
                  defaultOpen
                >
                  <div className="grid grid-cols-2 gap-x-6 gap-y-0.5">
                    <DataRow label="Game Name" value={responseData.game?.name || '—'} />
                    <DataRow label="Current Round" value={`${responseData.game?.current_round ?? '—'} / ${responseData.game?.total_rounds ?? '—'}`} />
                    <DataRow label="Round State" value={
                      <Badge color={
                        responseData.game?.round_state === 'CurrentOpen' ? 'mint' :
                        responseData.game?.round_state === 'Ended' ? 'ink' : 'ocean'
                      }>
                        {responseData.game?.round_state || '—'}
                      </Badge>
                    } />
                    <DataRow label="Trade Deadline" value={
                      responseData.game?.trade_deadline
                        ? new Date(responseData.game.trade_deadline).toLocaleString('sv-SE')
                        : '—'
                    } />
                    <DataRow label="Days Until Deadline" value={
                      responseData.game?.days_until_deadline != null
                        ? `${responseData.game.days_until_deadline} days`
                        : '—'
                    } />
                  </div>
                </CollapsibleSection>

                {/* Alerts */}
                <CollapsibleSection
                  title="Alerts"
                  icon={<AlertTriangle className="w-4 h-4" />}
                  badge={
                    ((responseData.alerts?.injured_players?.length || 0) + (responseData.alerts?.suspended_players?.length || 0)) > 0
                      ? `${(responseData.alerts?.injured_players?.length || 0) + (responseData.alerts?.suspended_players?.length || 0)} alerts`
                      : undefined
                  }
                >
                  <div className="space-y-3">
                    {/* Injured players */}
                    <div>
                      <span className="text-xs text-ink-400 block mb-1">Injured Players</span>
                      {responseData.alerts?.injured_players?.length ? (
                        <div className="flex flex-wrap gap-1.5">
                          {responseData.alerts.injured_players.map((name, i) => (
                            <Badge key={i} color="punch">{name}</Badge>
                          ))}
                        </div>
                      ) : (
                        <span className="text-xs text-ink-500">None</span>
                      )}
                    </div>

                    {/* Suspended players */}
                    <div>
                      <span className="text-xs text-ink-400 block mb-1">Suspended Players</span>
                      {responseData.alerts?.suspended_players?.length ? (
                        <div className="flex flex-wrap gap-1.5">
                          {responseData.alerts.suspended_players.map((name, i) => (
                            <Badge key={i} color="solar">{name}</Badge>
                          ))}
                        </div>
                      ) : (
                        <span className="text-xs text-ink-500">None</span>
                      )}
                    </div>

                    {/* Top/Worst performer */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <span className="text-xs text-ink-400 block mb-1">Top Performer</span>
                        {responseData.alerts?.top_performer ? (
                          <div className="flex items-center gap-2">
                            <Trophy className="w-4 h-4 text-solar" />
                            <span className="text-sm text-ink-200">{responseData.alerts.top_performer.name}</span>
                            <span className="text-xs text-mint font-mono">+{responseData.alerts.top_performer.trend}</span>
                          </div>
                        ) : (
                          <span className="text-xs text-ink-500">—</span>
                        )}
                      </div>
                      <div>
                        <span className="text-xs text-ink-400 block mb-1">Worst Performer</span>
                        {responseData.alerts?.worst_performer ? (
                          <div className="flex items-center gap-2">
                            <TrendingDown className="w-4 h-4 text-punch" />
                            <span className="text-sm text-ink-200">{responseData.alerts.worst_performer.name}</span>
                            <span className="text-xs text-punch font-mono">{responseData.alerts.worst_performer.trend}</span>
                          </div>
                        ) : (
                          <span className="text-xs text-ink-500">—</span>
                        )}
                      </div>
                    </div>
                  </div>
                </CollapsibleSection>

                {/* Trending */}
                <CollapsibleSection
                  title="Trending Players"
                  icon={<TrendingUp className="w-4 h-4" />}
                >
                  <div className="grid grid-cols-2 gap-4">
                    {/* Hot */}
                    <div>
                      <div className="flex items-center gap-1.5 mb-2">
                        <TrendingUp className="w-3.5 h-3.5 text-mint" />
                        <span className="text-xs font-medium text-mint">Hot</span>
                      </div>
                      <div className="space-y-1">
                        {responseData.trending?.hot?.map((p, i) => (
                          <div key={i} className="flex items-center justify-between text-xs py-1 px-2 bg-ink-700/20 rounded-lg">
                            <span className="text-ink-200">{p.name} <span className="text-ink-500">({p.team})</span></span>
                            <span className="text-mint font-mono">+{p.trend}</span>
                          </div>
                        )) || <span className="text-xs text-ink-500">No data</span>}
                      </div>
                    </div>

                    {/* Falling */}
                    <div>
                      <div className="flex items-center gap-1.5 mb-2">
                        <TrendingDown className="w-3.5 h-3.5 text-punch" />
                        <span className="text-xs font-medium text-punch">Falling</span>
                      </div>
                      <div className="space-y-1">
                        {responseData.trending?.falling?.map((p, i) => (
                          <div key={i} className="flex items-center justify-between text-xs py-1 px-2 bg-ink-700/20 rounded-lg">
                            <span className="text-ink-200">{p.name} <span className="text-ink-500">({p.team})</span></span>
                            <span className="text-punch font-mono">{p.trend}</span>
                          </div>
                        )) || <span className="text-xs text-ink-500">No data</span>}
                      </div>
                    </div>
                  </div>
                </CollapsibleSection>

                {/* Lineup */}
                <CollapsibleSection
                  title="Lineup"
                  icon={<Users className="w-4 h-4" />}
                  badge={responseData.lineup ? `${responseData.lineup.length} players` : undefined}
                >
                  {responseData.lineup?.length ? (
                    <div className="rounded-xl ring-1 ring-ink-600/20 overflow-hidden">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="bg-ink-800/60">
                            <th className="px-3 py-2 text-left text-ink-400 font-medium">Player</th>
                            <th className="px-3 py-2 text-left text-ink-400 font-medium">Team</th>
                            <th className="px-3 py-2 text-right text-ink-400 font-medium">Trend</th>
                            <th className="px-3 py-2 text-right text-ink-400 font-medium">Value</th>
                            <th className="px-3 py-2 text-right text-ink-400 font-medium">Growth</th>
                            <th className="px-3 py-2 text-center text-ink-400 font-medium">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-ink-600/10">
                          {responseData.lineup.map((player, i) => (
                            <tr key={i} className="hover:bg-ink-700/20 transition-colors">
                              <td className="px-3 py-2 text-ink-200 font-medium">{player.name}</td>
                              <td className="px-3 py-2 text-ink-400">{player.team}</td>
                              <td className={`px-3 py-2 text-right font-mono ${
                                player.trend > 0 ? 'text-mint' : player.trend < 0 ? 'text-punch' : 'text-ink-400'
                              }`}>
                                {player.trend > 0 ? '+' : ''}{player.trend}
                              </td>
                              <td className="px-3 py-2 text-right text-ink-300 font-mono">{player.value?.toLocaleString()}</td>
                              <td className={`px-3 py-2 text-right font-mono ${
                                player.growth > 0 ? 'text-mint' : player.growth < 0 ? 'text-punch' : 'text-ink-400'
                              }`}>
                                {player.growth > 0 ? '+' : ''}{player.growth}
                              </td>
                              <td className="px-3 py-2 text-center">
                                <div className="flex items-center justify-center gap-1">
                                  {player.is_injured && (
                                    <span title="Injured"><Heart className="w-3.5 h-3.5 text-punch" /></span>
                                  )}
                                  {player.is_suspended && (
                                    <span title="Suspended"><Shield className="w-3.5 h-3.5 text-solar" /></span>
                                  )}
                                  {!player.is_injured && !player.is_suspended && (
                                    <span className="text-ink-600">—</span>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <span className="text-xs text-ink-500">No lineup data</span>
                  )}
                </CollapsibleSection>

                {/* Round Intro */}
                {responseData.round_intro && (
                  <CollapsibleSection
                    title="AI Round Intro"
                    icon={<Sparkles className="w-4 h-4" />}
                  >
                    <div className="prose prose-invert prose-sm max-w-none">
                      {responseData.round_intro.split('\n').map((p, i) => (
                        p.trim() ? <p key={i} className="text-ink-200 leading-relaxed text-sm">{p}</p> : null
                      ))}
                    </div>
                  </CollapsibleSection>
                )}

                {/* Liquid Variable Map */}
                <CollapsibleSection
                  title="Liquid Variable Map"
                  icon={<Layers className="w-4 h-4" />}
                >
                  <p className="text-xs text-ink-500 mb-3">
                    How each Liquid tag resolves for this user:
                  </p>
                  <div className="rounded-xl ring-1 ring-ink-600/20 overflow-hidden">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-ink-800/60">
                          <th className="px-3 py-2 text-left text-ink-400 font-medium">Liquid Tag</th>
                          <th className="px-3 py-2 text-left text-ink-400 font-medium">Value</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-ink-600/10">
                        {renderLiquidMappings(responseData).map(({ tag, value }, i) => (
                          <tr key={i} className="hover:bg-ink-700/20 transition-colors">
                            <td className="px-3 py-2">
                              <div className="flex items-center gap-1.5">
                                <code className="text-electric-300 font-mono">{tag}</code>
                                <CopyButton text={tag} size="sm" />
                              </div>
                            </td>
                            <td className="px-3 py-2 text-ink-200 font-mono">{value}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CollapsibleSection>
              </div>
            )}

            {/* Error response view */}
            {!isSuccess && result.response.body && (
              <Card className="border-punch/20">
                <div className="p-6">
                  <div className="flex items-start gap-3">
                    <XCircle className="w-5 h-5 text-punch flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-punch mb-2">
                        API returned error
                      </p>
                      <pre className="text-xs font-mono text-ink-300 bg-ink-950 rounded-xl p-4 overflow-x-auto">
                        {JSON.stringify(result.response.body, null, 2)}
                      </pre>
                    </div>
                  </div>
                </div>
              </Card>
            )}

            {/* Raw JSON Toggle */}
            <Card>
              <button
                onClick={() => setRawJsonOpen(!rawJsonOpen)}
                className="w-full flex items-center gap-2 px-6 py-4 text-left hover:bg-ink-800/20 transition-colors"
              >
                <span className="text-sm font-medium text-ink-300">Raw JSON Response</span>
                <div className="flex-1" />
                <button
                  onClick={(e) => { e.stopPropagation(); handleCopyFullJson() }}
                  className="p-1.5 rounded-lg text-ink-400 hover:text-ink-200 hover:bg-ink-700/50 transition-colors"
                  title="Copy full JSON"
                >
                  {copiedJson ? (
                    <Check className="w-4 h-4 text-mint" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </button>
                {rawJsonOpen ? (
                  <ChevronDown className="w-4 h-4 text-ink-500" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-ink-500" />
                )}
              </button>
              <AnimatePresence>
                {rawJsonOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="px-6 pb-4 border-t border-ink-600/20">
                      <pre className="mt-4 text-xs font-mono text-ink-300 bg-ink-950 rounded-xl p-4 overflow-x-auto max-h-[500px] overflow-y-auto">
                        {JSON.stringify(result.response.body, null, 2)}
                      </pre>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/**
 * Build a mapping of Liquid tags to their resolved values
 */
function renderLiquidMappings(data: BrazeUserResponse): { tag: string; value: string }[] {
  const mappings: { tag: string; value: string }[] = []

  // User stats
  if (data.user) {
    mappings.push(
      { tag: '{{response.data.user.team_name}}', value: data.user.team_name ?? '—' },
      { tag: '{{response.data.user.rank}}', value: String(data.user.rank ?? '—') },
      { tag: '{{response.data.user.score}}', value: String(data.user.score ?? '—') },
      { tag: '{{response.data.user.round_score}}', value: String(data.user.round_score ?? '—') },
      { tag: '{{response.data.user.round_rank}}', value: String(data.user.round_rank ?? '—') },
      { tag: '{{response.data.user.position_change}}', value: String(data.user.position_change ?? 0) },
      { tag: '{{response.data.user.percentile}}', value: String(data.user.percentile ?? '—') },
      { tag: '{{response.data.user.injured_count}}', value: String(data.user.injured_count ?? 0) },
      { tag: '{{response.data.user.suspended_count}}', value: String(data.user.suspended_count ?? 0) },
    )
  }

  // Game info
  if (data.game) {
    mappings.push(
      { tag: '{{response.data.game.name}}', value: data.game.name ?? '—' },
      { tag: '{{response.data.game.current_round}}', value: String(data.game.current_round ?? '—') },
      { tag: '{{response.data.game.total_rounds}}', value: String(data.game.total_rounds ?? '—') },
      { tag: '{{response.data.game.round_state}}', value: data.game.round_state ?? '—' },
      { tag: '{{response.data.game.trade_deadline}}', value: data.game.trade_deadline ?? '—' },
      { tag: '{{response.data.game.days_until_deadline}}', value: String(data.game.days_until_deadline ?? '—') },
    )
  }

  // Alerts
  if (data.alerts) {
    mappings.push(
      { tag: '{{response.data.alerts.injured_players}}', value: data.alerts.injured_players?.join(', ') || 'none' },
      { tag: '{{response.data.alerts.suspended_players}}', value: data.alerts.suspended_players?.join(', ') || 'none' },
      { tag: '{{response.data.alerts.top_performer.name}}', value: data.alerts.top_performer?.name ?? '—' },
      { tag: '{{response.data.alerts.top_performer.trend}}', value: String(data.alerts.top_performer?.trend ?? '—') },
      { tag: '{{response.data.alerts.worst_performer.name}}', value: data.alerts.worst_performer?.name ?? '—' },
    )
  }

  // Round intro
  if (data.round_intro) {
    mappings.push(
      { tag: '{{response.data.round_intro}}', value: data.round_intro.slice(0, 80) + (data.round_intro.length > 80 ? '...' : '') },
    )
  }

  return mappings
}
