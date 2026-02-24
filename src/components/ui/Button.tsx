'use client'

import { forwardRef } from 'react'
import { motion, type HTMLMotionProps } from 'framer-motion'
import { Loader2, type LucideIcon } from 'lucide-react'

type ButtonVariant = 'primary' | 'ghost' | 'danger' | 'outline'

interface ButtonProps extends Omit<HTMLMotionProps<'button'>, 'children'> {
  variant?: ButtonVariant
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
  icon?: LucideIcon
  children: React.ReactNode
}

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    'bg-gradient-primary text-white shadow-lg shadow-electric/20 hover:shadow-electric/40 hover:brightness-110',
  ghost:
    'bg-transparent text-ink-200 hover:text-ink-50 hover:bg-ink-700/50',
  danger:
    'bg-punch/10 text-punch ring-1 ring-punch/30 hover:bg-punch/20',
  outline:
    'bg-transparent text-ink-200 ring-1 ring-ink-600 hover:ring-ink-400 hover:text-ink-50',
}

const sizeStyles = {
  sm: 'px-3 py-1.5 text-sm gap-1.5 rounded-lg',
  md: 'px-4 py-2 text-sm gap-2 rounded-xl',
  lg: 'px-6 py-3 text-base gap-2.5 rounded-xl',
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', loading, icon, children, disabled, className = '', ...props }, ref) => {
    return (
      <motion.button
        ref={ref}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.97 }}
        transition={{ type: 'spring', stiffness: 400, damping: 17 }}
        disabled={disabled || loading}
        className={`
          inline-flex items-center justify-center font-medium transition-all
          disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100
          ${variantStyles[variant]}
          ${sizeStyles[size]}
          ${className}
        `}
        {...props}
      >
        {loading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : icon ? (
          (() => { const Icon = icon; return <Icon className="w-4 h-4 flex-shrink-0" /> })()
        ) : null}
        {children}
      </motion.button>
    )
  }
)

Button.displayName = 'Button'
