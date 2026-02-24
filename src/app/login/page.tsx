'use client'

import { useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { motion } from 'framer-motion'
import { AlertCircle, Loader2, Gamepad2 } from 'lucide-react'

function LoginForm() {
  const searchParams = useSearchParams()
  const redirectTo = searchParams.get('redirectTo') || '/dashboard'
  const urlError = searchParams.get('error')

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(
    urlError === 'auth_callback_error' ? 'Authentication failed. Please try again.' : null
  )

  const handleGoogleLogin = async () => {
    setLoading(true)
    setError(null)

    const supabase = createClient()

    const { error: authError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(redirectTo)}`,
      },
    })

    if (authError) {
      setError(authError.message)
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-ink-950 py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Animated gradient orbs */}
      <motion.div
        className="absolute top-1/4 -left-32 w-96 h-96 bg-electric/20 rounded-full blur-[128px]"
        animate={{
          x: [0, 30, -20, 0],
          y: [0, -20, 30, 0],
          scale: [1, 1.1, 0.95, 1],
        }}
        transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute bottom-1/4 -right-32 w-96 h-96 bg-ocean/15 rounded-full blur-[128px]"
        animate={{
          x: [0, -25, 15, 0],
          y: [0, 25, -15, 0],
          scale: [1, 0.95, 1.1, 1],
        }}
        transition={{ duration: 15, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-punch/10 rounded-full blur-[100px]"
        animate={{
          scale: [1, 1.2, 1],
          opacity: [0.3, 0.5, 0.3],
        }}
        transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
      />

      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="max-w-md w-full space-y-8 relative z-10"
      >
        {/* Glass card */}
        <div className="bg-ink-800/60 backdrop-blur-2xl rounded-3xl p-8 ring-1 ring-ink-600/30 shadow-2xl">
          <div className="text-center mb-8">
            {/* Logo */}
            <motion.div
              className="flex justify-center mb-6"
              whileHover={{ rotate: [0, -5, 5, -3, 3, 0] }}
              transition={{ duration: 0.5 }}
            >
              <div className="w-16 h-16 rounded-2xl bg-gradient-primary flex items-center justify-center shadow-lg shadow-electric/30">
                <Gamepad2 className="w-9 h-9 text-white" />
              </div>
            </motion.div>
            <h2 className="text-3xl font-heading font-bold text-gradient-primary">
              SWUSH
            </h2>
            <p className="mt-2 text-sm text-ink-400">
              Sign in with your Schibsted account
            </p>
          </div>

          <div className="space-y-6">
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-punch/10 border border-punch/20 rounded-xl p-4 flex items-start gap-3"
              >
                <AlertCircle className="w-5 h-5 text-punch flex-shrink-0 mt-0.5" />
                <p className="text-sm text-punch/90">{error}</p>
              </motion.div>
            )}

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleGoogleLogin}
              disabled={loading}
              className="w-full flex items-center justify-center gap-3 py-3.5 px-4 rounded-xl bg-ink-700/50 text-sm font-medium text-ink-50 hover:bg-ink-700 ring-1 ring-ink-600/50 hover:ring-electric/30 focus:outline-none focus:ring-2 focus:ring-electric/50 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin text-electric-400" />
              ) : (
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                    fill="#4285F4"
                  />
                  <path
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    fill="#34A853"
                  />
                  <path
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    fill="#FBBC05"
                  />
                  <path
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    fill="#EA4335"
                  />
                </svg>
              )}
              {loading ? 'Redirecting...' : 'Sign in with Google'}
            </motion.button>

            <p className="text-center text-xs text-ink-600">
              Contact your administrator if you need access
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-ink-950">
        <Loader2 className="w-8 h-8 animate-spin text-electric-400" />
      </div>
    }>
      <LoginForm />
    </Suspense>
  )
}
