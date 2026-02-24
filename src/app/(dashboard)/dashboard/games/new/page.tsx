'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, Rocket, AlertCircle } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { PageHeader } from '@/components/layout/PageHeader'

const sportTypes = [
  { value: 'FOOTBALL', label: 'Football', emoji: '\u26BD' },
  { value: 'HOCKEY', label: 'Hockey', emoji: '\uD83C\uDFD2' },
  { value: 'F1', label: 'F1', emoji: '\uD83C\uDFCE\uFE0F' },
  { value: 'OTHER', label: 'Other', emoji: '\uD83C\uDFC6' },
]

const syncIntervals = [
  { value: 15, label: '15m' },
  { value: 30, label: '30m' },
  { value: 60, label: '1h' },
  { value: 120, label: '2h' },
  { value: 360, label: '6h' },
  { value: 720, label: '12h' },
  { value: 1440, label: '24h' },
]

export default function NewGamePage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [formData, setFormData] = useState({
    game_key: '',
    name: '',
    sport_type: 'FOOTBALL',
    subsite_key: 'aftonbladet',
    sync_interval_minutes: 60,
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/admin/games', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      const data = await res.json()

      if (!data.success) {
        throw new Error(data.error || 'Failed to create game')
      }

      router.push(`/dashboard/games/${data.data.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <div className="mb-6">
        <Link
          href="/dashboard/games"
          className="inline-flex items-center gap-2 text-ink-400 hover:text-ink-200 transition-colors group mb-4"
        >
          <motion.span
            className="inline-block"
            whileHover={{ x: -3 }}
            transition={{ type: 'spring', stiffness: 400, damping: 15 }}
          >
            <ArrowLeft className="w-4 h-4" />
          </motion.span>
          Back to Games
        </Link>
        <PageHeader
          title="Add New Game"
          description="Configure a new SWUSH fantasy game integration"
        />
      </div>

      <div className="max-w-2xl">
        <Card>
          <form onSubmit={handleSubmit} className="p-6">
            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mb-6"
                >
                  <div className="p-4 bg-punch/10 border border-punch/20 rounded-xl flex items-center gap-3">
                    <AlertCircle className="w-5 h-5 text-punch flex-shrink-0" />
                    <p className="text-punch text-sm">{error}</p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="space-y-8">
              {/* Game Key */}
              <div>
                <Input
                  label="Game Key"
                  required
                  placeholder="e.g., ab-champions-manager-2025-2026"
                  value={formData.game_key}
                  onChange={(e) => setFormData({ ...formData, game_key: e.target.value })}
                />
                <p className="mt-1.5 text-xs text-ink-500">
                  The game key from SWUSH API (e.g., ab-premier-manager-2025-2026)
                </p>
              </div>

              {/* Display Name */}
              <Input
                label="Display Name"
                required
                placeholder="e.g., Champions Manager 2025-2026"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />

              {/* Sport Type Tiles */}
              <div>
                <label className="block text-sm font-medium text-ink-200 mb-3">
                  Sport Type
                </label>
                <div className="grid grid-cols-4 gap-3">
                  {sportTypes.map((sport) => (
                    <motion.button
                      key={sport.value}
                      type="button"
                      onClick={() => setFormData({ ...formData, sport_type: sport.value })}
                      className={`relative flex flex-col items-center gap-2 p-4 rounded-xl transition-all duration-200 ${
                        formData.sport_type === sport.value
                          ? 'bg-electric/15 ring-2 ring-electric/50'
                          : 'bg-ink-700/30 ring-1 ring-ink-600/30 hover:bg-ink-700/50 hover:ring-ink-500/40'
                      }`}
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.97 }}
                    >
                      {formData.sport_type === sport.value && (
                        <motion.div
                          layoutId="sport-indicator"
                          className="absolute inset-0 rounded-xl bg-electric/10"
                          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                        />
                      )}
                      <span className="text-2xl relative z-10">{sport.emoji}</span>
                      <span className={`text-sm font-medium relative z-10 ${
                        formData.sport_type === sport.value ? 'text-electric' : 'text-ink-300'
                      }`}>
                        {sport.label}
                      </span>
                    </motion.button>
                  ))}
                </div>
              </div>

              {/* Subsite Key */}
              <div>
                <Input
                  label="Subsite Key"
                  value={formData.subsite_key}
                  onChange={(e) => setFormData({ ...formData, subsite_key: e.target.value })}
                />
                <p className="mt-1.5 text-xs text-ink-500">
                  Usually &quot;aftonbladet&quot; for Aftonbladet games
                </p>
              </div>

              {/* Sync Interval Pills */}
              <div>
                <label className="block text-sm font-medium text-ink-200 mb-3">
                  Sync Interval
                </label>
                <div className="flex flex-wrap gap-2">
                  {syncIntervals.map((interval) => (
                    <motion.button
                      key={interval.value}
                      type="button"
                      onClick={() => setFormData({ ...formData, sync_interval_minutes: interval.value })}
                      className={`relative px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
                        formData.sync_interval_minutes === interval.value
                          ? 'bg-ocean/15 text-ocean ring-1 ring-ocean/40'
                          : 'bg-ink-700/30 text-ink-300 ring-1 ring-ink-600/30 hover:bg-ink-700/50 hover:text-ink-200'
                      }`}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      {formData.sync_interval_minutes === interval.value && (
                        <motion.div
                          layoutId="interval-indicator"
                          className="absolute inset-0 rounded-full bg-ocean/10"
                          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                        />
                      )}
                      <span className="relative z-10">{interval.label}</span>
                    </motion.button>
                  ))}
                </div>
                <p className="mt-2 text-xs text-ink-500">
                  How often the game data syncs from SWUSH API
                </p>
              </div>
            </div>

            <div className="mt-10 flex items-center justify-end gap-4">
              <Link
                href="/dashboard/games"
                className="px-4 py-2 text-ink-400 hover:text-ink-200 transition-colors text-sm font-medium"
              >
                Cancel
              </Link>
              <Button
                type="submit"
                disabled={loading}
                icon={loading ? undefined : Rocket}
              >
                {loading ? 'Creating...' : 'Create Game'}
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </div>
  )
}
