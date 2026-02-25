import Anthropic from '@anthropic-ai/sdk'
import { supabaseAdmin } from '@/lib/supabase/server'
import { searchArticles } from '@/services/vespa-client'
import { Game, RoundIntro, VespaArticle, VespaArticleRef } from '@/types'
import { log } from '@/lib/logger'

const ANTHROPIC_MODEL = 'claude-sonnet-4-20250514'

// Sport-specific keywords for Vespa queries
const SPORT_KEYWORDS: Record<string, string> = {
  F1: 'Formel 1 F1 Grand Prix racing',
  FOOTBALL: 'fotboll',
  HOCKEY: 'hockey SHL',
  OTHER: 'sport',
}

/**
 * Build a Vespa search query from game context
 * Combines team names with sport-specific keywords
 */
function buildVespaQuery(game: Game, teamNames: string[]): string {
  const sportKeywords = SPORT_KEYWORDS[game.sport_type] || SPORT_KEYWORDS.OTHER

  // Take a subset of teams to keep the query focused
  const topTeams = teamNames.slice(0, 6).join(' ')

  return `${topTeams} ${sportKeywords}`.trim()
}

/**
 * Build the LLM system prompt for generating round intros
 */
function buildSystemPrompt(): string {
  return `Du är en sportjournalist som skriver för Aftonbladet. Din uppgift är att skriva en kort, engagerande omgångsintro för ett fantasyspel.

Regler:
- Skriv på svenska i Aftonbladets sportjournalistiska stil — kort, punchy, engagerande
- Använd korta meningar och ett levande språk
- Referera till aktuella händelser och storylines från de tillhandahållna artiklarna
- Nämn trendande spelare och intressanta matchups
- Inkludera omgångsnummer och deadline-info naturligt i texten
- Håll det till 2-3 stycken (max 150 ord)
- Hitta ALDRIG på fakta — använd bara information från de tillhandahållna artiklarna och spelardata
- Om inga relevanta artiklar finns, skriv en generell men engagerande intro baserad på spelardatan`
}

/**
 * Build the user prompt with game context and articles
 */
function buildUserPrompt(
  game: Game,
  articles: VespaArticle[],
  trendingPlayers: { name: string; team: string; trend: number }[]
): string {
  const parts: string[] = []

  // Game context
  parts.push(`## Spelinfo`)
  parts.push(`- Spel: ${game.name}`)
  parts.push(`- Sport: ${game.sport_type}`)
  parts.push(`- Omgång: ${game.current_round} av ${game.total_rounds}`)
  if (game.next_trade_deadline) {
    const deadline = new Date(game.next_trade_deadline)
    parts.push(`- Transferfönstret stänger: ${deadline.toLocaleDateString('sv-SE', { weekday: 'long', day: 'numeric', month: 'long' })} kl ${deadline.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })}`)
  }

  // Trending players
  if (trendingPlayers.length > 0) {
    parts.push(`\n## Trendande spelare (hetast just nu)`)
    for (const player of trendingPlayers) {
      parts.push(`- ${player.name} (${player.team}) — trend: ${player.trend > 0 ? '+' : ''}${player.trend}`)
    }
  }

  // Articles from Vespa
  if (articles.length > 0) {
    parts.push(`\n## Senaste Aftonbladet-artiklarna`)
    for (const article of articles) {
      const contentPreview = article.content.substring(0, 500).replace(/\n+/g, ' ')
      parts.push(`\n### ${article.title}`)
      parts.push(contentPreview)
    }
  } else {
    parts.push(`\n(Inga relevanta artiklar hittades denna vecka)`)
  }

  parts.push(`\nSkriv nu en engagerande omgångsintro baserad på ovanstående.`)

  return parts.join('\n')
}

/**
 * Generate a round intro using Vespa articles + Claude
 */
export async function generateRoundIntro(gameId: string): Promise<RoundIntro | null> {
  const supabase = supabaseAdmin()

  try {
    // 1. Fetch game
    const { data: game, error: gameError } = await supabase
      .from('games')
      .select('*')
      .eq('id', gameId)
      .single()

    if (gameError || !game) {
      log.api.error({ err: gameError }, 'Failed to fetch game for round intro')
      return null
    }

    // 2. Fetch distinct team names from elements
    const { data: teams } = await supabase
      .from('elements')
      .select('team_name')
      .eq('game_id', gameId)
      .not('team_name', 'is', null)

    const teamNames = [...new Set((teams || []).map((t: { team_name: string }) => t.team_name))]

    // 3. Build and execute Vespa query
    const vespaQuery = buildVespaQuery(game as Game, teamNames)
    log.api.info(`Vespa query for round intro: "${vespaQuery}"`)

    const articles = await searchArticles(vespaQuery, 5)

    // 4. Fetch trending players
    const { data: trendingElements } = await supabase
      .from('elements')
      .select('full_name, team_name, trend')
      .eq('game_id', gameId)
      .order('trend', { ascending: false })
      .limit(5)

    const trendingPlayers = (trendingElements || []).map((el: any) => ({
      name: el.full_name,
      team: el.team_name || '',
      trend: el.trend,
    }))

    // 5. Generate intro with Claude
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      log.api.error('ANTHROPIC_API_KEY not configured')
      return null
    }

    const anthropic = new Anthropic({ apiKey })

    const systemPrompt = buildSystemPrompt()
    const userPrompt = buildUserPrompt(game as Game, articles, trendingPlayers)

    const message = await anthropic.messages.create({
      model: ANTHROPIC_MODEL,
      max_tokens: 500,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    })

    const introText = message.content
      .filter((block) => block.type === 'text')
      .map((block) => block.text)
      .join('\n')

    if (!introText) {
      log.api.error('Claude returned empty response')
      return null
    }

    // 6. Build article references
    const articlesUsed: VespaArticleRef[] = articles.map((a) => ({
      article_id: a.article_id,
      title: a.title,
      relevance: a.relevance,
    }))

    // 7. Upsert into round_intros (replace if exists for same game + round)
    const { data: intro, error: upsertError } = await supabase
      .from('round_intros')
      .upsert(
        {
          game_id: gameId,
          round_number: game.current_round || 1,
          intro_text: introText,
          articles_used: articlesUsed,
          vespa_query: vespaQuery,
          model_used: ANTHROPIC_MODEL,
          generated_at: new Date().toISOString(),
        },
        { onConflict: 'game_id,round_number' }
      )
      .select()
      .single()

    if (upsertError) {
      log.api.error({ err: upsertError }, 'Failed to save round intro')
      return null
    }

    log.api.info(
      { gameId, round: game.current_round, articlesUsed: articles.length },
      'Round intro generated successfully'
    )

    return intro as RoundIntro
  } catch (error) {
    log.api.error({ err: error }, 'Failed to generate round intro')
    return null
  }
}

/**
 * Fetch a cached round intro from the database
 */
export async function getRoundIntro(
  gameId: string,
  roundNumber?: number
): Promise<RoundIntro | null> {
  const supabase = supabaseAdmin()

  try {
    let query = supabase
      .from('round_intros')
      .select('*')
      .eq('game_id', gameId)

    if (roundNumber !== undefined) {
      query = query.eq('round_number', roundNumber)
    } else {
      // Get the latest intro for this game
      query = query.order('round_number', { ascending: false }).limit(1)
    }

    const { data, error } = await query.single()

    if (error || !data) return null
    return data as RoundIntro
  } catch {
    return null
  }
}
