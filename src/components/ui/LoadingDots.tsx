export function LoadingDots({ className = '' }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 ${className}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-electric animate-dot-pulse dot-1" />
      <span className="w-1.5 h-1.5 rounded-full bg-ocean animate-dot-pulse dot-2" />
      <span className="w-1.5 h-1.5 rounded-full bg-mint animate-dot-pulse dot-3" />
    </span>
  )
}

export function LoadingScreen({ message = 'Loading...' }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
      <LoadingDots />
      <p className="text-sm text-ink-400">{message}</p>
    </div>
  )
}
