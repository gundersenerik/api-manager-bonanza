'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Save,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  ExternalLink,
  Wifi,
  WifiOff,
  Gamepad2,
  Zap,
  Settings2,
  Eye,
  EyeOff,
} from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { CodeBlock } from '@/components/ui/CodeBlock'
import { PageHeader } from '@/components/layout/PageHeader'
import { LoadingScreen } from '@/components/ui/LoadingDots'
import { useAuth } from '@/contexts/AuthContext'

interface SettingsData {
  swush_api_key: string
  swush_api_base_url: string
  braze_api_key: string
  braze_api_token: string
  braze_rest_endpoint: string
  default_sync_interval: number
}

type TestStatus = 'idle' | 'testing' | 'success' | 'error'

export default function SettingsPage() {
  const { isAdmin } = useAuth()
  const router = useRouter()
  const [settings, setSettings] = useState<SettingsData>({
    swush_api_key: '',
    swush_api_base_url: '',
    braze_api_key: '',
    braze_api_token: '',
    braze_rest_endpoint: '',
    default_sync_interval: 30,
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [swushStatus, setSwushStatus] = useState<TestStatus>('idle')
  const [brazeStatus, setBrazeStatus] = useState<TestStatus>('idle')
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [revealed, setRevealed] = useState(false)
  const [revealing, setRevealing] = useState(false)

  useEffect(() => {
    if (isAdmin === false) {
      router.push('/dashboard')
      return
    }
    fetchSettings()
  }, [isAdmin, router])

  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/admin/settings')
      const data = await res.json()
      if (data.success && data.data) {
        setSettings(prev => ({ ...prev, ...data.data }))
      }
    } catch (error) {
      console.error('Failed to fetch settings:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleRevealToggle = async () => {
    if (revealed) {
      // Re-fetch masked values
      setRevealed(false)
      fetchSettings()
      return
    }
    setRevealing(true)
    try {
      const res = await fetch('/api/admin/settings?reveal=true')
      const data = await res.json()
      if (data.success && data.data) {
        setSettings(prev => ({ ...prev, ...data.data }))
        setRevealed(true)
      }
    } catch {
      setMessage({ type: 'error', text: 'Failed to reveal keys' })
    } finally {
      setRevealing(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    setMessage(null)

    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      })

      const data = await res.json()

      if (data.success) {
        setMessage({ type: 'success', text: 'Settings saved successfully' })
        setTimeout(() => setMessage(null), 3000)
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to save settings' })
      }
    } catch {
      setMessage({ type: 'error', text: 'Failed to save settings' })
    } finally {
      setSaving(false)
    }
  }

  const testSwushConnection = async () => {
    setSwushStatus('testing')
    try {
      const res = await fetch('/api/admin/settings/test-swush', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_key: settings.swush_api_key,
          base_url: settings.swush_api_base_url,
        }),
      })
      const data = await res.json()
      setSwushStatus(data.success ? 'success' : 'error')
      setTimeout(() => setSwushStatus('idle'), 3000)
    } catch {
      setSwushStatus('error')
      setTimeout(() => setSwushStatus('idle'), 3000)
    }
  }

  const testBrazeConnection = async () => {
    setBrazeStatus('testing')
    try {
      const res = await fetch('/api/admin/settings/test-braze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_key: settings.braze_api_key,
          endpoint: settings.braze_rest_endpoint,
        }),
      })
      const data = await res.json()
      setBrazeStatus(data.success ? 'success' : 'error')
      setTimeout(() => setBrazeStatus('idle'), 3000)
    } catch {
      setBrazeStatus('error')
      setTimeout(() => setBrazeStatus('idle'), 3000)
    }
  }

  const TestButton = ({ status, onClick, disabled }: { status: TestStatus; onClick: () => void; disabled: boolean }) => (
    <motion.button
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      disabled={disabled || status === 'testing'}
      className={`
        inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-300 disabled:cursor-not-allowed
        ${status === 'success'
          ? 'bg-mint/15 text-mint ring-1 ring-mint/30'
          : status === 'error'
          ? 'bg-punch/15 text-punch ring-1 ring-punch/30'
          : 'bg-ink-700/30 text-ink-300 ring-1 ring-ink-600/30 hover:bg-ink-700/50'
        }
      `}
    >
      <AnimatePresence mode="wait" initial={false}>
        {status === 'testing' ? (
          <motion.div key="testing" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
            <RefreshCw className="w-4 h-4 animate-spin" />
          </motion.div>
        ) : status === 'success' ? (
          <motion.div key="success" initial={{ scale: 0 }} animate={{ scale: [0, 1.3, 1] }} exit={{ scale: 0 }}>
            <Wifi className="w-4 h-4" />
          </motion.div>
        ) : status === 'error' ? (
          <motion.div key="error" initial={{ scale: 0 }} animate={{ scale: [0, 1.3, 1] }} exit={{ scale: 0 }}>
            <WifiOff className="w-4 h-4" />
          </motion.div>
        ) : (
          <motion.div key="idle" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
            <Wifi className="w-4 h-4" />
          </motion.div>
        )}
      </AnimatePresence>
      {status === 'testing' ? 'Testing...' : status === 'success' ? 'Connected!' : status === 'error' ? 'Failed' : 'Test Connection'}
    </motion.button>
  )

  if (loading) {
    return <LoadingScreen message="Loading settings..." />
  }

  const envVars = `SWUSH_API_KEY=your-swush-api-key
SWUSH_API_BASE_URL=https://season.swush.com/v1/partner
BRAZE_API_KEY=your-braze-api-key
BRAZE_REST_ENDPOINT=https://rest.fra-02.braze.eu`

  return (
    <div>
      <PageHeader
        title="Settings"
        description="Configure API integrations and default behaviors"
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRevealToggle}
              disabled={revealing}
            >
              {revealing ? (
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              ) : revealed ? (
                <EyeOff className="w-4 h-4 mr-2" />
              ) : (
                <Eye className="w-4 h-4 mr-2" />
              )}
              {revealing ? 'Revealing...' : revealed ? 'Hide Keys' : 'Reveal Keys'}
            </Button>
            <Button
              icon={Save}
              onClick={handleSave}
              disabled={saving}
              size="sm"
            >
              {saving ? 'Saving...' : 'Save Settings'}
            </Button>
          </div>
        }
      />

      <AnimatePresence>
        {message && (
          <motion.div
            initial={{ opacity: 0, y: -8, height: 0 }}
            animate={{ opacity: 1, y: 0, height: 'auto' }}
            exit={{ opacity: 0, y: -8, height: 0 }}
            className="mb-6"
          >
            <div className={`p-4 rounded-xl flex items-center gap-3 ${
              message.type === 'success'
                ? 'bg-mint/10 border border-mint/20'
                : 'bg-punch/10 border border-punch/20'
            }`}>
              {message.type === 'success' ? (
                <CheckCircle className="w-5 h-5 text-mint" />
              ) : (
                <AlertCircle className="w-5 h-5 text-punch" />
              )}
              <p className={message.type === 'success' ? 'text-mint' : 'text-punch'}>
                {message.text}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="space-y-6">
        {/* SWUSH API Settings */}
        <Card className="overflow-hidden">
          <div className="border-l-4 border-electric p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-electric/15">
                  <Gamepad2 className="w-5 h-5 text-electric" />
                </div>
                <div>
                  <h2 className="text-lg font-heading font-semibold text-ink-50">SWUSH Partner API</h2>
                  <p className="text-sm text-ink-400">Configure your SWUSH Partner API credentials</p>
                </div>
              </div>
              <TestButton
                status={swushStatus}
                onClick={testSwushConnection}
                disabled={!settings.swush_api_key}
              />
            </div>

            <div className="space-y-4">
              <Input
                label="API Base URL"
                value={settings.swush_api_base_url}
                onChange={(e) => setSettings(prev => ({ ...prev, swush_api_base_url: e.target.value }))}
                placeholder="https://season.swush.com/v1/partner"
              />
              <div>
                <label className="block text-sm font-medium text-ink-200 mb-1.5">API Key</label>
                <div className="flex items-center gap-2">
                  <input
                    type={revealed ? 'text' : 'password'}
                    value={settings.swush_api_key}
                    readOnly
                    className="flex-1 px-3 py-2 bg-ink-800/50 border border-ink-600/30 rounded-lg text-ink-200 font-mono text-sm focus:outline-none"
                  />
                </div>
              </div>
            </div>
          </div>
        </Card>

        {/* Braze API Settings */}
        <Card className="overflow-hidden">
          <div className="border-l-4 border-ocean p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-ocean/15">
                  <Zap className="w-5 h-5 text-ocean" />
                </div>
                <div>
                  <h2 className="text-lg font-heading font-semibold text-ink-50">Braze API</h2>
                  <p className="text-sm text-ink-400">Configure Braze for campaign triggers</p>
                </div>
              </div>
              <TestButton
                status={brazeStatus}
                onClick={testBrazeConnection}
                disabled={!settings.braze_api_key}
              />
            </div>

            <div className="space-y-4">
              <div>
                <Input
                  label="REST API Endpoint"
                  value={settings.braze_rest_endpoint}
                  onChange={(e) => setSettings(prev => ({ ...prev, braze_rest_endpoint: e.target.value }))}
                  placeholder="https://rest.fra-02.braze.eu"
                />
                <p className="mt-1 text-xs text-ink-500">
                  <a href="https://www.braze.com/docs/api/basics/" target="_blank" rel="noopener noreferrer" className="text-ocean hover:text-ocean-300 inline-flex items-center gap-1 transition-colors">
                    Find your endpoint <ExternalLink className="w-3 h-3" />
                  </a>
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-ink-200 mb-1.5">API Key</label>
                <input
                  type={revealed ? 'text' : 'password'}
                  value={settings.braze_api_key}
                  readOnly
                  className="w-full px-3 py-2 bg-ink-800/50 border border-ink-600/30 rounded-lg text-ink-200 font-mono text-sm focus:outline-none"
                />
              </div>
              {settings.braze_api_token && (
                <div>
                  <label className="block text-sm font-medium text-ink-200 mb-1.5">API Token (Connected Content)</label>
                  <input
                    type={revealed ? 'text' : 'password'}
                    value={settings.braze_api_token}
                    readOnly
                    className="w-full px-3 py-2 bg-ink-800/50 border border-ink-600/30 rounded-lg text-ink-200 font-mono text-sm focus:outline-none"
                  />
                </div>
              )}
            </div>
          </div>
        </Card>

        {/* Default Settings */}
        <Card className="overflow-hidden">
          <div className="border-l-4 border-mint p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 rounded-lg bg-mint/15">
                <Settings2 className="w-5 h-5 text-mint" />
              </div>
              <h2 className="text-lg font-heading font-semibold text-ink-50">Default Settings</h2>
            </div>

            <div>
              <Input
                label="Default Sync Interval (minutes)"
                type="number"
                min={5}
                max={1440}
                value={settings.default_sync_interval}
                onChange={(e) => setSettings(prev => ({ ...prev, default_sync_interval: parseInt(e.target.value) || 30 }))}
                className="w-32"
              />
              <p className="mt-1 text-xs text-ink-500">
                How often new games sync by default (5-1440 minutes)
              </p>
            </div>
          </div>
        </Card>

        {/* Environment Info */}
        <div className="bg-ink-900/50 rounded-xl p-6 ring-1 ring-ink-600/20">
          <h3 className="font-heading font-semibold text-ink-200 mb-3">Environment Variables</h3>
          <p className="text-sm text-ink-400 mb-4">
            These settings are stored securely. You can also configure them via environment variables:
          </p>
          <CodeBlock code={envVars} />
        </div>
      </div>
    </div>
  )
}
