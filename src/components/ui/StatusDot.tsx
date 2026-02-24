interface StatusDotProps {
  active: boolean
  size?: 'sm' | 'md'
  className?: string
}

export function StatusDot({ active, size = 'md', className = '' }: StatusDotProps) {
  const sizeClass = size === 'sm' ? 'w-2 h-2' : 'w-2.5 h-2.5'

  return (
    <span className={`relative inline-flex ${className}`}>
      {active && (
        <span
          className={`absolute inline-flex ${sizeClass} rounded-full bg-mint opacity-40 animate-ping`}
        />
      )}
      <span
        className={`relative inline-flex ${sizeClass} rounded-full ${
          active ? 'bg-mint shadow-sm shadow-mint/50' : 'bg-ink-600'
        }`}
      />
    </span>
  )
}

type SyncStatus = 'completed' | 'failed' | 'started' | 'running'

export function SyncStatusDot({ status }: { status: SyncStatus }) {
  const config: Record<SyncStatus, { color: string; pulse: boolean }> = {
    completed: { color: 'bg-mint shadow-mint/50', pulse: false },
    failed: { color: 'bg-punch shadow-punch/50', pulse: true },
    started: { color: 'bg-ocean shadow-ocean/50', pulse: true },
    running: { color: 'bg-ocean shadow-ocean/50', pulse: true },
  }

  const { color, pulse } = config[status] || config.started

  return (
    <span className="relative inline-flex">
      {pulse && (
        <span className={`absolute inline-flex w-2.5 h-2.5 rounded-full ${color} opacity-40 animate-ping`} />
      )}
      <span className={`relative inline-flex w-2.5 h-2.5 rounded-full shadow-sm ${color}`} />
    </span>
  )
}
