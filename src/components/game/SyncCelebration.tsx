'use client'

import { useEffect, useCallback, useRef } from 'react'
import confetti from 'canvas-confetti'

interface SyncCelebrationProps {
  trigger: boolean
}

export function SyncCelebration({ trigger }: SyncCelebrationProps) {
  const hasRun = useRef(false)

  const celebrate = useCallback(() => {
    const colors = ['#6C3AED', '#10B981', '#06B6D4', '#F59E0B', '#F43F5E']

    // First burst
    confetti({
      particleCount: 80,
      spread: 70,
      origin: { y: 0.6, x: 0.5 },
      colors,
      ticks: 150,
      gravity: 1.2,
      scalar: 0.9,
      shapes: ['circle', 'square'],
    })

    // Second burst with delay
    setTimeout(() => {
      confetti({
        particleCount: 40,
        spread: 100,
        origin: { y: 0.65, x: 0.45 },
        colors,
        ticks: 120,
        gravity: 1.5,
        scalar: 0.7,
      })
    }, 150)

    // Third small burst
    setTimeout(() => {
      confetti({
        particleCount: 30,
        spread: 90,
        origin: { y: 0.6, x: 0.55 },
        colors,
        ticks: 100,
        gravity: 1.8,
        scalar: 0.6,
      })
    }, 300)
  }, [])

  useEffect(() => {
    if (trigger && !hasRun.current) {
      hasRun.current = true
      celebrate()
    }
    if (!trigger) {
      hasRun.current = false
    }
  }, [trigger, celebrate])

  return null
}
