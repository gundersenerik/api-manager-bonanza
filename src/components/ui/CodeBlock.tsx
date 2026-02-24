'use client'

import { CopyButton } from './CopyButton'

interface CodeBlockProps {
  code: string
  language?: string
  showCopy?: boolean
  className?: string
}

export function CodeBlock({ code, showCopy = true, className = '' }: CodeBlockProps) {
  return (
    <div className={`relative group rounded-xl bg-ink-950 ring-1 ring-ink-600/30 overflow-hidden ${className}`}>
      {showCopy && (
        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <CopyButton text={code} size="sm" />
        </div>
      )}
      <pre className="p-4 overflow-x-auto text-sm font-mono text-ink-200 leading-relaxed">
        <code>{code}</code>
      </pre>
    </div>
  )
}

interface InlineCodeProps {
  children: React.ReactNode
  className?: string
}

export function InlineCode({ children, className = '' }: InlineCodeProps) {
  return (
    <code className={`px-1.5 py-0.5 bg-ink-700/50 text-electric-300 rounded-md text-sm font-mono ${className}`}>
      {children}
    </code>
  )
}
