'use client'

import { useEffect, useState } from 'react'
import {
  Save,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  ExternalLink,
} from 'lucide-react'

interface SettingsData {
  swush_api_key: string
  swush_api_base_url: string
  braze_api_key: string
  braze_rest_endpoint: string
  default_sync_interval: number
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<SettingsData>({
    swush_api_key: '',
    swush_api_base_url: 'https://season.swush.com/v1/partner',
    braze_api_key: '',
    braze_rest_endpoint: 'https://rest.fra-02.braze.eu',
    default_sync_interval: 30,
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testingSwush, setTestingSwush] = useState(false)
  const [testingBraze, setTestingBraze] = useState(false)
  const [swushStatus, setSwushStatus] = useState<'success' | 'error' | null>(null)
  const [brazeStatus, setBrazeStatus] = useState<'success' | 'error' | null>(null)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    fetchSettings()
  }, [])

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
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to save settings' })
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to save settings' })
    } finally {
      setSaving(false)
    }
  }

  const testSwushConnection = async () => {
    setTestingSwush(true)
    setSwushStatus(null)

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
    } catch (error) {
      setSwushStatus('error')
    } finally {
      setTestingSwush(false)
    }
  }

  const testBrazeConnection = async () => {
    setTestingBraze(true)
    setBrazeStatus(null)

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
    } catch (error) {
      setBrazeStatus('error')
    } finally {
      setTestingBraze(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
          <p className="mt-1 text-gray-500">
            Configure API integrations and default behaviors
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50"
        >
          {saving ? (
            <RefreshCw className="w-4 h-4 animate-spin" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </div>

      {message && (
        <div className={`mb-6 p-4 rounded-lg flex items-center gap-3 ${
          message.type === 'success' ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
        }`}>
          {message.type === 'success' ? (
            <CheckCircle className="w-5 h-5 text-green-600" />
          ) : (
            <AlertCircle className="w-5 h-5 text-red-600" />
          )}
          <p className={message.type === 'success' ? 'text-green-700' : 'text-red-700'}>
            {message.text}
          </p>
        </div>
      )}

      <div className="space-y-8">
        {/* SWUSH API Settings */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">SWUSH Partner API</h2>
              <p className="text-sm text-gray-500">
                Configure your SWUSH Partner API credentials
              </p>
            </div>
            <button
              onClick={testSwushConnection}
              disabled={testingSwush || !settings.swush_api_key}
              className="inline-flex items-center gap-2 px-3 py-1.5 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
            >
              {testingSwush ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : swushStatus === 'success' ? (
                <CheckCircle className="w-4 h-4 text-green-500" />
              ) : swushStatus === 'error' ? (
                <AlertCircle className="w-4 h-4 text-red-500" />
              ) : null}
              Test Connection
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                API Base URL
              </label>
              <input
                type="text"
                value={settings.swush_api_base_url}
                onChange={(e) => setSettings(prev => ({ ...prev, swush_api_base_url: e.target.value }))}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                placeholder="https://season.swush.com/v1/partner"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                API Key
              </label>
              <input
                type="password"
                value={settings.swush_api_key}
                onChange={(e) => setSettings(prev => ({ ...prev, swush_api_key: e.target.value }))}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                placeholder="Enter your SWUSH Partner API key"
              />
            </div>
          </div>
        </div>

        {/* Braze API Settings */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Braze API</h2>
              <p className="text-sm text-gray-500">
                Configure Braze for campaign triggers
              </p>
            </div>
            <button
              onClick={testBrazeConnection}
              disabled={testingBraze || !settings.braze_api_key}
              className="inline-flex items-center gap-2 px-3 py-1.5 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
            >
              {testingBraze ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : brazeStatus === 'success' ? (
                <CheckCircle className="w-4 h-4 text-green-500" />
              ) : brazeStatus === 'error' ? (
                <AlertCircle className="w-4 h-4 text-red-500" />
              ) : null}
              Test Connection
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                REST API Endpoint
              </label>
              <input
                type="text"
                value={settings.braze_rest_endpoint}
                onChange={(e) => setSettings(prev => ({ ...prev, braze_rest_endpoint: e.target.value }))}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                placeholder="https://rest.fra-02.braze.eu"
              />
              <p className="mt-1 text-xs text-gray-500">
                <a href="https://www.braze.com/docs/api/basics/" target="_blank" rel="noopener noreferrer" className="text-red-600 hover:underline inline-flex items-center gap-1">
                  Find your endpoint <ExternalLink className="w-3 h-3" />
                </a>
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                API Key
              </label>
              <input
                type="password"
                value={settings.braze_api_key}
                onChange={(e) => setSettings(prev => ({ ...prev, braze_api_key: e.target.value }))}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                placeholder="Enter your Braze API key"
              />
            </div>
          </div>
        </div>

        {/* Default Settings */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-6">Default Settings</h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Default Sync Interval (minutes)
              </label>
              <input
                type="number"
                min="5"
                max="1440"
                value={settings.default_sync_interval}
                onChange={(e) => setSettings(prev => ({ ...prev, default_sync_interval: parseInt(e.target.value) || 30 }))}
                className="w-32 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
              />
              <p className="mt-1 text-xs text-gray-500">
                How often new games sync by default (5-1440 minutes)
              </p>
            </div>
          </div>
        </div>

        {/* Environment Info */}
        <div className="bg-gray-50 rounded-xl p-6">
          <h3 className="font-semibold text-gray-900 mb-3">Environment Variables</h3>
          <p className="text-sm text-gray-600 mb-4">
            These settings are stored securely. You can also configure them via environment variables:
          </p>
          <pre className="bg-gray-800 text-gray-100 p-4 rounded-lg text-sm overflow-x-auto">
{`SWUSH_API_KEY=your-swush-api-key
SWUSH_API_BASE_URL=https://season.swush.com/v1/partner
BRAZE_API_KEY=your-braze-api-key
BRAZE_REST_ENDPOINT=https://rest.fra-02.braze.eu`}
          </pre>
        </div>
      </div>
    </div>
  )
}
