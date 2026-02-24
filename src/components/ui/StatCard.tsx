'use client'

import { useEffect, useState, useRef } from 'react'
import { motion, useInView } from 'framer-motion'
import { type LucideIcon } from 'lucide-react'

const colorGradients: Record<string, string> = {
  electric: 'from-electric to-purple-400',
  mint: 'from-mint to-cyan-400',
  ocean: 'from-ocean to-blue-400',
  solar: 'from-solar to-orange-400',
  punch: 'from-punch to-rose-400',
}

interface StatCardProps {
  label: string
  value: number
  icon: LucideIcon
  color?: string
  gradient?: string
  delay?: number
}

function useCountUp(end: number, duration: number = 600, inView: boolean = false) {
  const [count, setCount] = useState(0)
  const hasAnimated = useRef(false)

  useEffect(() => {
    if (!inView || hasAnimated.current) return
    hasAnimated.current = true

    const startTime = performance.now()
    const step = (currentTime: number) => {
      const elapsed = currentTime - startTime
      const progress = Math.min(elapsed / duration, 1)
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3)
      setCount(Math.round(eased * end))
      if (progress < 1) {
        requestAnimationFrame(step)
      }
    }
    requestAnimationFrame(step)
  }, [end, duration, inView])

  return count
}

export function StatCard({ label, value, icon: Icon, color, gradient, delay = 0 }: StatCardProps) {
  const resolvedGradient = gradient || (color && colorGradients[color]) || colorGradients.electric
  const ref = useRef<HTMLDivElement>(null)
  const isInView = useInView(ref, { once: true })
  const displayValue = useCountUp(value, 600, isInView)

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 20 }}
      animate={isInView ? { opacity: 1, y: 0 } : undefined}
      transition={{ duration: 0.4, delay, ease: 'easeOut' }}
      whileHover={{ y: -3, transition: { duration: 0.2 } }}
      className="relative bg-ink-800/60 backdrop-blur-xl rounded-2xl p-6 ring-1 ring-ink-600/30 hover:ring-ink-600/50 hover:shadow-lg hover:shadow-ink-950/50 transition-shadow"
    >
      <div className="flex items-center gap-4">
        <div className={`flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br ${resolvedGradient} shadow-lg`}>
          <Icon className="w-6 h-6 text-white" />
        </div>
        <div>
          <p className="text-2xl font-heading font-bold text-ink-50">
            {displayValue.toLocaleString()}
          </p>
          <p className="text-sm text-ink-400">{label}</p>
        </div>
      </div>
    </motion.div>
  )
}
