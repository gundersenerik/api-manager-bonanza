'use client'

import { useState, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Sparkles,
  FileText,
  RotateCw,
  XCircle,
  ChevronDown,
  ChevronUp,
  Copy,
  Check,
  Pencil,
  Save,
  X,
  Clock,
  ChevronLeft,
  ChevronRight,
  History,
  Type,
} from 'lucide-react'
import { RoundIntro } from '@/types'
import { useAuth } from '@/contexts/AuthContext'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'

interface RoundIntroSectionProps {
  gameId: string
  currentRound: number
  totalRounds: number
}

interface IntroHistoryItem {
  id: string
  round_number: number
  intro_text: string
  articles_used: { article_id: string; title: string; relevance: number }[]
  model_used: string | null
  generated_at: string
  created_at: string
  updated_at: string
}

export function RoundIntroSection({ gameId, currentRound, totalRounds }: RoundIntroSectionProps) {
  const { isAdmin } = useAuth()

  // Core intro state
  const [roundIntro, setRoundIntro] = useState<RoundIntro | null>(null)
  const [introLoading, setIntroLoading] = useState(false)
  const [introGenerating, setIntroGenerating] = useState(false)
  const [introError, setIntroError] = useState<string | null>(null)
  const [showArticleSources, setShowArticleSources] = useState(false)

  // Round selector
  const [selectedRound, setSelectedRound] = useState<number>(currentRound)

  // Edit mode
  const [isEditing, setIsEditing] = useState(false)
  const [editText, setEditText] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  // History panel
  const [showHistory, setShowHistory] = useState(false)
  const [history, setHistory] = useState<IntroHistoryItem[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)

  // Copy
  const [copied, setCopied] = useState(false)

  // Fetch intro for a specific round
  const fetchRoundIntro = useCallback(async (round: number) => {
    setIntroLoading(true)
    setIntroError(null)
    try {
      const res = await fetch(`/api/admin/games/${gameId}/round-intro?round=${round}`)
      const data = await res.json()
      if (data.success && data.data) {
        setRoundIntro(data.data)
      } else {
        setRoundIntro(null)
      }
    } catch (error) {
      console.error('Failed to fetch round intro:', error)
      setRoundIntro(null)
    } finally {
      setIntroLoading(false)
    }
  }, [gameId])

  // Fetch history
  const fetchHistory = useCallback(async () => {
    setHistoryLoading(true)
    try {
      const res = await fetch(`/api/admin/games/${gameId}/round-intro/history`)
      const data = await res.json()
      if (data.success && data.data) {
        setHistory(data.data)
      }
    } catch (error) {
      console.error('Failed to fetch intro history:', error)
    } finally {
      setHistoryLoading(false)
    }
  }, [gameId])

  // Initial load
  useEffect(() => {
    fetchRoundIntro(selectedRound)
  }, [selectedRound, fetchRoundIntro])

  // Generate intro
  const handleGenerateIntro = async () => {
    setIntroGenerating(true)
    setIntroError(null)
    try {
      const res = await fetch(`/api/admin/games/${gameId}/round-intro`, {
        method: 'POST',
      })
      const data = await res.json()
      if (data.success && data.data) {
        setRoundIntro(data.data)
        setSelectedRound(data.data.round_number)
        // Refresh history if open
        if (showHistory) fetchHistory()
      } else {
        setIntroError(data.error || 'Failed to generate intro')
      }
    } catch (error) {
      console.error('Failed to generate round intro:', error)
      setIntroError(error instanceof Error ? error.message : 'Network error')
    } finally {
      setIntroGenerating(false)
    }
  }

  // Save edited text
  const handleSaveEdit = async () => {
    if (!roundIntro) return
    setSaving(true)
    setSaveError(null)
    try {
      const res = await fetch(`/api/admin/games/${gameId}/round-intro?round=${roundIntro.round_number}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ intro_text: editText }),
      })
      const data = await res.json()
      if (data.success && data.data) {
        setRoundIntro(data.data)
        setIsEditing(false)
        // Refresh history if open
        if (showHistory) fetchHistory()
      } else {
        setSaveError(data.error || 'Failed to save')
      }
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Network error')
    } finally {
      setSaving(false)
    }
  }

  // Enter edit mode
  const handleStartEdit = () => {
    if (!roundIntro) return
    setEditText(roundIntro.intro_text)
    setIsEditing(true)
    setSaveError(null)
  }

  // Cancel edit
  const handleCancelEdit = () => {
    setIsEditing(false)
    setEditText('')
    setSaveError(null)
  }

  // Copy text
  const handleCopy = async () => {
    if (!roundIntro) return
    try {
      await navigator.clipboard.writeText(roundIntro.intro_text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback
    }
  }

  // Round navigation
  const canGoBack = selectedRound > 1
  const canGoForward = selectedRound < currentRound
  const isCurrentRound = selectedRound === currentRound

  // Word/char counts
  const wordCount = roundIntro
    ? roundIntro.intro_text.trim().split(/\s+/).filter(Boolean).length
    : 0
  const charCount = roundIntro ? roundIntro.intro_text.length : 0
  const editWordCount = editText.trim().split(/\s+/).filter(Boolean).length
  const editCharCount = editText.length

  // Toggle history panel
  const handleToggleHistory = () => {
    if (!showHistory) {
      fetchHistory()
    }
    setShowHistory(!showHistory)
  }

  return (
    <Card className="mb-8 overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-ink-600/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-solar" />
            <h2 className="text-lg font-heading font-semibold text-ink-50">Omgångsintro</h2>
          </div>
          <div className="flex items-center gap-2">
            {/* History toggle */}
            <Button
              variant="ghost"
              size="sm"
              icon={History}
              onClick={handleToggleHistory}
            >
              Historik
            </Button>
            {/* Generate / Regenerate (admin, current round only) */}
            {isAdmin && isCurrentRound && (
              <Button
                variant="ghost"
                size="sm"
                icon={roundIntro ? RotateCw : Sparkles}
                onClick={handleGenerateIntro}
                disabled={introGenerating}
              >
                {introGenerating ? 'Genererar...' : roundIntro ? 'Regenerera' : 'Generera intro'}
              </Button>
            )}
          </div>
        </div>

        {/* Round selector */}
        <div className="flex items-center gap-3 mt-3">
          <div className="flex items-center gap-1">
            <button
              onClick={() => setSelectedRound((r) => Math.max(1, r - 1))}
              disabled={!canGoBack || introLoading}
              className="p-1 rounded-lg text-ink-400 hover:text-ink-200 hover:bg-ink-700/40 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <select
              value={selectedRound}
              onChange={(e) => setSelectedRound(Number(e.target.value))}
              className="bg-ink-800/60 border border-ink-600/30 rounded-lg px-3 py-1.5 text-sm text-ink-200 font-medium focus:outline-none focus:ring-1 focus:ring-electric/30 appearance-none cursor-pointer text-center min-w-[130px]"
            >
              {Array.from({ length: currentRound }, (_, i) => i + 1)
                .reverse()
                .map((round) => (
                  <option key={round} value={round}>
                    Omgång {round}{round === currentRound ? ' (aktuell)' : ''}
                  </option>
                ))}
            </select>

            <button
              onClick={() => setSelectedRound((r) => Math.min(currentRound, r + 1))}
              disabled={!canGoForward || introLoading}
              className="p-1 rounded-lg text-ink-400 hover:text-ink-200 hover:bg-ink-700/40 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Round badge */}
          {roundIntro && (
            <Badge color={isCurrentRound ? 'ocean' : 'ink'}>
              {isCurrentRound ? 'Aktuell omgång' : `Omgång ${selectedRound}`}
            </Badge>
          )}

          {/* Total rounds indicator */}
          <span className="text-xs text-ink-500">
            av {totalRounds} omgångar totalt
          </span>
        </div>
      </div>

      <div className="p-6">
        {/* Loading state */}
        {introLoading && !roundIntro && (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-2 border-ink-600 border-t-ocean" />
          </div>
        )}

        {/* Generating skeleton */}
        <AnimatePresence>
          {introGenerating && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-3 mb-4"
            >
              <div className="flex items-center gap-2 text-sm text-solar">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                >
                  <Sparkles className="w-4 h-4" />
                </motion.div>
                <span>AI genererar omgångsintro...</span>
              </div>
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-4 bg-ink-700/40 rounded animate-pulse" style={{ width: `${100 - i * 15}%` }} />
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Error state */}
        {introError && (
          <div className="p-4 bg-punch/10 border border-punch/20 rounded-xl mb-4">
            <div className="flex items-start gap-2">
              <XCircle className="w-4 h-4 text-punch mt-0.5 flex-shrink-0" />
              <p className="text-sm text-punch">{introError}</p>
            </div>
          </div>
        )}

        {/* Save error */}
        {saveError && (
          <div className="p-3 bg-punch/10 border border-punch/20 rounded-xl mb-4">
            <p className="text-sm text-punch">{saveError}</p>
          </div>
        )}

        {/* Intro content */}
        {roundIntro && !introGenerating ? (
          <div className="space-y-4">
            {/* Edit mode */}
            {isEditing ? (
              <div className="space-y-3">
                <textarea
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  className="w-full min-h-[160px] p-4 bg-ink-800/60 border border-ink-600/30 rounded-xl text-ink-200 text-sm leading-relaxed resize-y focus:outline-none focus:ring-2 focus:ring-electric/30 font-sans"
                  placeholder="Skriv omgångsintro..."
                />
                {/* Edit word/char count */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 text-xs text-ink-500">
                    <span className="flex items-center gap-1">
                      <Type className="w-3 h-3" />
                      {editWordCount} ord
                    </span>
                    <span>{editCharCount} tecken</span>
                    {editWordCount > 150 && (
                      <span className="text-solar">⚠ Rekommenderat max: 150 ord</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={X}
                      onClick={handleCancelEdit}
                      disabled={saving}
                    >
                      Avbryt
                    </Button>
                    <Button
                      variant="primary"
                      size="sm"
                      icon={Save}
                      onClick={handleSaveEdit}
                      disabled={saving || editText.trim().length === 0}
                    >
                      {saving ? 'Sparar...' : 'Spara'}
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <>
                {/* Read-only content */}
                <div className="prose prose-invert prose-sm max-w-none">
                  {roundIntro.intro_text.split('\n').map((paragraph, i) => (
                    paragraph.trim() ? <p key={i} className="text-ink-200 leading-relaxed">{paragraph}</p> : null
                  ))}
                </div>

                {/* Action buttons row */}
                <div className="flex items-center gap-2 pt-1">
                  {isAdmin && (
                    <button
                      onClick={handleStartEdit}
                      className="inline-flex items-center gap-1.5 text-xs text-ink-400 hover:text-ink-200 px-2 py-1 rounded-lg hover:bg-ink-700/30 transition-colors"
                    >
                      <Pencil className="w-3 h-3" />
                      Redigera
                    </button>
                  )}
                  <button
                    onClick={handleCopy}
                    className="inline-flex items-center gap-1.5 text-xs text-ink-400 hover:text-ink-200 px-2 py-1 rounded-lg hover:bg-ink-700/30 transition-colors"
                  >
                    {copied ? <Check className="w-3 h-3 text-mint" /> : <Copy className="w-3 h-3" />}
                    {copied ? 'Kopierat!' : 'Kopiera text'}
                  </button>
                </div>
              </>
            )}

            {/* Meta info + word count */}
            {!isEditing && (
              <div className="flex items-center flex-wrap gap-x-4 gap-y-1 text-xs text-ink-500 pt-2 border-t border-ink-600/20">
                <span>Genererad: {new Date(roundIntro.generated_at).toLocaleString('sv-SE')}</span>
                {roundIntro.model_used && <span>{roundIntro.model_used}</span>}
                <span className="flex items-center gap-1">
                  <Type className="w-3 h-3" />
                  {wordCount} ord / {charCount} tecken
                </span>
              </div>
            )}

            {/* Article sources */}
            {!isEditing && roundIntro.articles_used && roundIntro.articles_used.length > 0 && (
              <div>
                <button
                  onClick={() => setShowArticleSources(!showArticleSources)}
                  className="inline-flex items-center gap-1.5 text-xs text-ink-400 hover:text-ink-200 transition-colors"
                >
                  <FileText className="w-3.5 h-3.5" />
                  {showArticleSources ? 'Dölj' : 'Visa'} artikelkällor ({roundIntro.articles_used.length})
                  {showArticleSources ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                </button>
                <AnimatePresence>
                  {showArticleSources && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="mt-2 space-y-1.5">
                        {roundIntro.articles_used.map((article, i) => (
                          <div
                            key={article.article_id || i}
                            className="flex items-start gap-2 text-xs py-1.5 px-3 bg-ink-700/20 rounded-lg"
                          >
                            <span className="text-ink-500 font-mono mt-0.5">{(article.relevance ?? 0).toFixed(2)}</span>
                            <span className="text-ink-300">{article.title}</span>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}
          </div>
        ) : !introLoading && !introGenerating && (
          <div className="text-center py-8 text-ink-500">
            <Sparkles className="w-8 h-8 mx-auto mb-3 opacity-30" />
            <p>Ingen omgångsintro genererad för omgång {selectedRound}.</p>
            {isAdmin && isCurrentRound && (
              <p className="text-sm mt-1">Klicka &quot;Generera intro&quot; för att skapa en AI-genererad omgångspreview.</p>
            )}
          </div>
        )}
      </div>

      {/* History panel */}
      <AnimatePresence>
        {showHistory && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden border-t border-ink-600/20"
          >
            <div className="px-6 py-4">
              <div className="flex items-center gap-2 mb-3">
                <Clock className="w-4 h-4 text-ink-400" />
                <h3 className="text-sm font-semibold text-ink-200">Intro-historik</h3>
                <Badge color="ink">{history.length} omgångar</Badge>
              </div>

              {historyLoading ? (
                <div className="flex items-center justify-center py-6">
                  <div className="animate-spin rounded-full h-5 w-5 border-2 border-ink-600 border-t-ocean" />
                </div>
              ) : history.length === 0 ? (
                <p className="text-xs text-ink-500 py-4 text-center">Inga intros genererade ännu.</p>
              ) : (
                <div className="space-y-1.5 max-h-[300px] overflow-y-auto scrollbar-thin">
                  {history.map((item) => {
                    const isSelected = item.round_number === selectedRound
                    const preview = item.intro_text.substring(0, 100).replace(/\n/g, ' ')
                    return (
                      <button
                        key={item.id}
                        onClick={() => {
                          setSelectedRound(item.round_number)
                          setShowHistory(false)
                        }}
                        className={`w-full text-left px-3 py-2.5 rounded-xl transition-all text-xs ${
                          isSelected
                            ? 'bg-electric/10 ring-1 ring-electric/20 text-electric-300'
                            : 'hover:bg-ink-700/30 text-ink-300'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold">
                              Omgång {item.round_number}
                            </span>
                            {item.round_number === currentRound && (
                              <Badge color="ocean" className="text-[10px] py-0 px-1.5">aktuell</Badge>
                            )}
                          </div>
                          <span className="text-ink-500">
                            {new Date(item.generated_at).toLocaleDateString('sv-SE')}
                          </span>
                        </div>
                        <p className="text-ink-400 truncate">{preview}...</p>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  )
}
