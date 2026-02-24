'use client'

import { motion, type HTMLMotionProps } from 'framer-motion'

interface CardProps extends HTMLMotionProps<'div'> {
  glow?: boolean
  hover?: boolean
  children: React.ReactNode
}

export function Card({ glow = false, hover = true, children, className = '', ...props }: CardProps) {
  return (
    <motion.div
      whileHover={hover ? { y: -2, transition: { duration: 0.2 } } : undefined}
      className={`
        relative bg-ink-800/60 backdrop-blur-xl rounded-2xl
        ring-1 ring-ink-600/30
        ${hover ? 'hover:ring-ink-600/50 hover:shadow-lg hover:shadow-ink-950/50' : ''}
        ${glow ? 'hover:shadow-electric/10 hover:ring-electric/20' : ''}
        transition-shadow
        ${className}
      `}
      {...props}
    >
      {children}
    </motion.div>
  )
}

export function CardHeader({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`px-6 py-4 border-b border-ink-600/30 ${className}`}>
      {children}
    </div>
  )
}

export function CardBody({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`p-6 ${className}`}>
      {children}
    </div>
  )
}
