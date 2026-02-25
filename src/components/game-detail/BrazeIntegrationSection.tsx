'use client'

import Link from 'next/link'
import { Code, Play } from 'lucide-react'
import { Game } from '@/types'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { CodeBlock, InlineCode } from '@/components/ui/CodeBlock'
import { CopyButton } from '@/components/ui/CopyButton'

const liquidTags = [
  { category: 'User Stats', tag: '{{response.data.user.team_name}}', description: 'User\'s team name' },
  { category: 'User Stats', tag: '{{response.data.user.rank}}', description: 'Current overall rank' },
  { category: 'User Stats', tag: '{{response.data.user.score}}', description: 'Total score' },
  { category: 'User Stats', tag: '{{response.data.user.round_score}}', description: 'Score for current round' },
  { category: 'User Stats', tag: '{{response.data.user.round_rank}}', description: 'Rank for current round' },
  { category: 'User Stats', tag: '{{response.data.user.position_change}}', description: 'Positions gained/lost this round' },
  { category: 'User Stats', tag: '{{response.data.user.percentile}}', description: 'User\'s percentile (0-100)' },
  { category: 'User Stats', tag: '{{response.data.user.injured_count}}', description: 'Number of injured players in lineup' },
  { category: 'User Stats', tag: '{{response.data.user.suspended_count}}', description: 'Number of suspended players in lineup' },
  { category: 'Game Info', tag: '{{response.data.game.name}}', description: 'Game display name' },
  { category: 'Game Info', tag: '{{response.data.game.current_round}}', description: 'Current round number' },
  { category: 'Game Info', tag: '{{response.data.game.total_rounds}}', description: 'Total number of rounds' },
  { category: 'Game Info', tag: '{{response.data.game.round_state}}', description: 'Current state (CurrentOpen, Ended, etc.)' },
  { category: 'Game Info', tag: '{{response.data.game.trade_deadline}}', description: 'Next trade deadline (ISO date)' },
  { category: 'Game Info', tag: '{{response.data.game.days_until_deadline}}', description: 'Days until next deadline' },
  { category: 'Alerts', tag: '{{response.data.alerts.injured_players}}', description: 'Array of injured player names' },
  { category: 'Alerts', tag: '{{response.data.alerts.suspended_players}}', description: 'Array of suspended player names' },
  { category: 'Alerts', tag: '{{response.data.alerts.top_performer.name}}', description: 'Best performing player in lineup' },
  { category: 'Alerts', tag: '{{response.data.alerts.top_performer.trend}}', description: 'Trend value of top performer' },
  { category: 'Alerts', tag: '{{response.data.alerts.worst_performer.name}}', description: 'Worst performing player in lineup' },
  { category: 'Trending', tag: '{{response.data.trending.hot}}', description: 'Array of top 5 trending players (name, team, trend)' },
  { category: 'Trending', tag: '{{response.data.trending.falling}}', description: 'Array of 5 falling players (name, team, trend)' },
  { category: 'Lineup', tag: '{{response.data.lineup}}', description: 'Array of lineup players with name, team, trend, value, growth, is_injured, is_suspended' },
  { category: 'AI Content', tag: '{{response.data.round_intro}}', description: 'AI-generated round intro text (Swedish, Aftonbladet style)' },
]

interface BrazeIntegrationSectionProps {
  game: Game
}

export function BrazeIntegrationSection({ game }: BrazeIntegrationSectionProps) {
  const apiBaseUrl = typeof window !== 'undefined' ? window.location.origin : ''
  const brazeToken = process.env.NEXT_PUBLIC_BRAZE_API_TOKEN || 'TOKEN_NOT_CONFIGURED'
  const connectedContentUrl = `${apiBaseUrl}/api/v1/users/{{$\{user_id}}}/games/${game.game_key}`
  const connectedContentString = `{% connected_content ${connectedContentUrl}?token=${brazeToken} :save response %}`

  const tagsByCategory = liquidTags.reduce<Record<string, typeof liquidTags>>((acc, tag) => {
    const category = tag.category
    if (!acc[category]) {
      acc[category] = []
    }
    acc[category]!.push(tag)
    return acc
  }, {})

  const exampleTemplate = `{% connected_content ${apiBaseUrl}/api/v1/users/{{$\{user_id}}}/games/${game.game_key}?token=${brazeToken} :save response %}

{% if response.success %}
  Hi! Your team "{{response.data.user.team_name}}" is ranked #{{response.data.user.rank}}!

  Current round: {{response.data.game.current_round}} of {{response.data.game.total_rounds}}
  Your score: {{response.data.user.score}} points

  {% if response.data.alerts.injured_players.size > 0 %}
    Warning: You have injured players: {{response.data.alerts.injured_players | join: ", "}}
  {% endif %}
{% endif %}`

  return (
    <Card className="mb-8 overflow-hidden">
      <div className="px-6 py-4 border-b border-ink-600/20 flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Code className="w-5 h-5 text-ocean" />
            <h2 className="text-lg font-heading font-semibold text-ink-50">Braze Integration</h2>
          </div>
          <p className="text-sm text-ink-400 mt-1">
            Use Connected Content in your Braze campaigns to personalize emails with game data.
          </p>
        </div>
        <Link href={`/dashboard/games/${game.id}/preview`}>
          <Button variant="ghost" size="sm" icon={Play}>
            Preview API
          </Button>
        </Link>
      </div>

      <div className="p-6 space-y-6">
        {/* API Endpoint */}
        <div>
          <label className="block text-sm font-medium text-ink-200 mb-2">
            API Endpoint
          </label>
          <div className="flex items-center gap-2">
            <div className="flex-1 bg-ink-700/30 px-4 py-2.5 rounded-xl ring-1 ring-ink-600/30 overflow-x-auto">
              <code className="text-sm font-mono text-ocean-300">{connectedContentUrl}</code>
            </div>
            <CopyButton text={connectedContentUrl} />
          </div>
          <p className="text-xs text-ink-500 mt-1.5">
            Replace <InlineCode>{'{{$'}{'{user_id}}}'}</InlineCode> with your Braze user identifier attribute
          </p>
        </div>

        {/* Connected Content String */}
        <div>
          <label className="block text-sm font-medium text-ink-200 mb-2">
            Connected Content String
          </label>
          <CodeBlock code={connectedContentString} />
          <p className="text-xs text-ink-500 mt-1.5">
            Paste this at the top of your Braze email template. The API token is included automatically.
          </p>
        </div>

        {/* Liquid Tags Table */}
        <div>
          <label className="block text-sm font-medium text-ink-200 mb-2">
            Available Liquid Tags
          </label>
          <div className="rounded-xl ring-1 ring-ink-600/30 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-ink-800/80 border-b border-ink-600/30">
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-ink-400 uppercase tracking-wider">Category</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-ink-400 uppercase tracking-wider">Liquid Tag</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-ink-400 uppercase tracking-wider">Description</th>
                  <th className="px-4 py-2.5 w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-600/20">
                {Object.entries(tagsByCategory).map(([category, tags]) =>
                  tags.map((item, idx) => (
                    <tr key={item.tag} className="hover:bg-ink-700/20 transition-colors">
                      {idx === 0 && (
                        <td
                          className="px-4 py-2 font-medium text-ink-200 bg-ink-800/40 align-top"
                          rowSpan={tags.length}
                        >
                          {category}
                        </td>
                      )}
                      <td className="px-4 py-2">
                        <InlineCode>{item.tag}</InlineCode>
                      </td>
                      <td className="px-4 py-2 text-ink-400">{item.description}</td>
                      <td className="px-4 py-2">
                        <CopyButton text={item.tag} size="sm" />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Example Template */}
        <div>
          <label className="block text-sm font-medium text-ink-200 mb-2">
            Example Email Template
          </label>
          <CodeBlock code={exampleTemplate} />
        </div>
      </div>
    </Card>
  )
}
