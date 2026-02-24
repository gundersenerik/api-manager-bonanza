'use client'

import { forwardRef, type InputHTMLAttributes, type SelectHTMLAttributes } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, className = '', id, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, '-')
    return (
      <div className="space-y-1.5">
        {label && (
          <label htmlFor={inputId} className="block text-sm font-medium text-ink-200">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={`
            w-full px-4 py-2.5 bg-ink-700/50 text-ink-50 placeholder:text-ink-500
            border border-ink-600/50 rounded-xl
            focus:outline-none focus:ring-2 focus:ring-electric/50 focus:border-electric/50
            transition-all duration-200
            ${error ? 'border-punch/50 ring-1 ring-punch/30' : ''}
            ${className}
          `}
          {...props}
        />
        {error && (
          <p className="text-xs text-punch-400">{error}</p>
        )}
      </div>
    )
  }
)

Input.displayName = 'Input'

interface SelectInputProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  error?: string
}

export const SelectInput = forwardRef<HTMLSelectElement, SelectInputProps>(
  ({ label, error, className = '', id, children, ...props }, ref) => {
    const selectId = id || label?.toLowerCase().replace(/\s+/g, '-')
    return (
      <div className="space-y-1.5">
        {label && (
          <label htmlFor={selectId} className="block text-sm font-medium text-ink-200">
            {label}
          </label>
        )}
        <select
          ref={ref}
          id={selectId}
          className={`
            w-full px-4 py-2.5 bg-ink-700/50 text-ink-50
            border border-ink-600/50 rounded-xl
            focus:outline-none focus:ring-2 focus:ring-electric/50 focus:border-electric/50
            transition-all duration-200
            ${error ? 'border-punch/50 ring-1 ring-punch/30' : ''}
            ${className}
          `}
          {...props}
        >
          {children}
        </select>
        {error && (
          <p className="text-xs text-punch-400">{error}</p>
        )}
      </div>
    )
  }
)

SelectInput.displayName = 'SelectInput'
