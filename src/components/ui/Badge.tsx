import { type LucideIcon } from 'lucide-react'

type BadgeColor = 'electric' | 'mint' | 'punch' | 'solar' | 'ocean' | 'ink'

interface BadgeProps {
  color?: BadgeColor
  icon?: LucideIcon
  children: React.ReactNode
  className?: string
}

const colorMap: Record<BadgeColor, string> = {
  electric: 'bg-electric/15 text-electric-300 ring-electric/20',
  mint: 'bg-mint/15 text-mint-300 ring-mint/20',
  punch: 'bg-punch/15 text-punch-300 ring-punch/20',
  solar: 'bg-solar/15 text-solar-300 ring-solar/20',
  ocean: 'bg-ocean/15 text-ocean-300 ring-ocean/20',
  ink: 'bg-ink-700/50 text-ink-300 ring-ink-600/30',
}

export function Badge({ color = 'ink', icon: Icon, children, className = '' }: BadgeProps) {
  return (
    <span
      className={`
        inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium
        rounded-lg ring-1 ${colorMap[color]} ${className}
      `}
    >
      {Icon && <Icon className="w-3 h-3" />}
      {children}
    </span>
  )
}

// Sport-specific badges with custom icons
const sportConfig: Record<string, { color: BadgeColor; label: string }> = {
  FOOTBALL: { color: 'mint', label: 'Football' },
  HOCKEY: { color: 'ocean', label: 'Hockey' },
  F1: { color: 'punch', label: 'F1' },
  OTHER: { color: 'ink', label: 'Other' },
}

export function SportBadge({ sport }: { sport: string }) {
  const config = (sport in sportConfig
    ? sportConfig[sport as keyof typeof sportConfig]
    : sportConfig.OTHER) as { color: BadgeColor; label: string }
  return (
    <Badge color={config.color}>
      {config.label}
    </Badge>
  )
}
