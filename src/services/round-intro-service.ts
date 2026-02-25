import Anthropic from '@anthropic-ai/sdk'
import { supabaseAdmin } from '@/lib/supabase/server'
import { searchArticles } from '@/services/vespa-client'
import { Game, RoundIntro, VespaArticle, VespaArticleRef } from '@/types'
import { log } from '@/lib/logger'

const ANTHROPIC_MODEL = 'claude-sonnet-4-20250514'
const MAX_GENERATION_ATTEMPTS = 2

// ---------------------------------------------------------------------------
// League Configuration — sport-aware prompt settings
// ---------------------------------------------------------------------------

interface LeagueConfig {
  /** Injected into system prompt to guide tone and style */
  toneGuide: string
  /** 'spelare' for football/hockey, 'förare' for F1 */
  playerTerm: string
  /** What to emphasize when no Vespa articles are found */
  noArticleFallbackHint: string
}

const LEAGUE_CONFIG: Record<string, LeagueConfig> = {
  F1: {
    toneGuide:
      'Skriv med energi och fart. Fokusera på förardueller, strategier och banans egenskaper. Använd vedertagna racingtermer som pole position, depåstopp och stallorder. F1-fans vill ha spänning och taktisk analys.',
    playerTerm: 'förare',
    noArticleFallbackHint:
      'Fokusera på förarnas formkurvor och trenddata. Lyft fram intressanta dueller och vilka förare som sticker ut just nu.',
  },
  FOOTBALL: {
    toneGuide:
      'Skriv med känsla för fotboll. Lyft fram derbyn, formlag och nyckelmatcherna. Blanda taktisk skärpa med engagemang. Tänk "stormatch", "toppstrid", "bottenstrid", "guldrace".',
    playerTerm: 'spelare',
    noArticleFallbackHint:
      'Fokusera på spelarnas formkurvor, intressanta matchups och vilka lag som har momentum just nu.',
  },
  HOCKEY: {
    toneGuide:
      'Skriv med intensitet och tempo. Hockeyfans vill ha koll på kedjeförändringar, powerplay-spelare och formlag. Hockey är snabbt — din text ska vara det också.',
    playerTerm: 'spelare',
    noArticleFallbackHint:
      'Fokusera på spelarnas poängproduktion, trenddata och vilka kedjor som levererar.',
  },
  OTHER: {
    toneGuide: 'Skriv engagerande och informativt om tävlingen.',
    playerTerm: 'spelare',
    noArticleFallbackHint: 'Fokusera på de hetaste spelarna och aktuell data.',
  },
}

function getLeagueConfig(sportType: string): LeagueConfig {
  return LEAGUE_CONFIG[sportType] ?? LEAGUE_CONFIG.OTHER!
}

// ---------------------------------------------------------------------------
// Vespa query construction
// ---------------------------------------------------------------------------

/**
 * Build a Vespa search query from game context.
 * Uses game.name (which often contains the league, e.g. "Allsvenskan Fantasy 2025")
 * + top team/driver names. Vespa handles semantic matching — no generic keywords needed.
 */
function buildVespaQuery(game: Game, teamNames: string[]): string {
  const topTeams = teamNames.slice(0, 6).join(' ')
  return `${game.name} ${topTeams}`.trim()
}

// ---------------------------------------------------------------------------
// Prompt construction
// ---------------------------------------------------------------------------

/**
 * Build the LLM system prompt — sport-aware with XML extraction tags
 */
function buildSystemPrompt(game: Game): string {
  const config = getLeagueConfig(game.sport_type)

  return `Du är en sportjournalist som skriver för Aftonbladet. Din uppgift är att skriva en kort, engagerande omgångsintro för ett fantasyspel.

## Stil och ton
${config.toneGuide}

## Regler
- Skriv på svenska i Aftonbladets sportjournalistiska stil — kort, punchy, engagerande
- Använd korta meningar och ett levande språk
- Referera till aktuella händelser och storylines från de tillhandahållna artiklarna
- Nämn trendande ${config.playerTerm} och intressanta matchups
- Inkludera omgångsnummer och deadline-info naturligt i texten
- Håll det till 2-3 stycken, max 150 ord
- Hitta ALDRIG på fakta — använd bara information från de tillhandahållna artiklarna och ${config.playerTerm}datan
- Om inga relevanta artiklar finns tillgängliga: ${config.noArticleFallbackHint}

## Format
Svara ENBART med introtexten inuti XML-taggar:
<intro>
Din text här...
</intro>

Inget annat utanför taggarna.`
}

/**
 * Build the user prompt with game context and articles
 */
function buildUserPrompt(
  game: Game,
  articles: VespaArticle[],
  trendingPlayers: { name: string; team: string; trend: number }[]
): string {
  const config = getLeagueConfig(game.sport_type)
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

  // Trending players/drivers
  if (trendingPlayers.length > 0) {
    parts.push(`\n## Trendande ${config.playerTerm} (hetast just nu)`)
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
    parts.push(`\n(Inga relevanta artiklar hittades denna vecka — basera introt på ${config.playerTerm}data och omgångsinfo)`)
  }

  parts.push(`\nSkriv nu en engagerande omgångsintro baserad på ovanstående.`)

  return parts.join('\n')
}

// ---------------------------------------------------------------------------
// Output extraction & validation
// ---------------------------------------------------------------------------

interface IntroValidation {
  valid: boolean
  warnings: string[]
  errors: string[]
}

/**
 * Extract intro text from Claude's response.
 * Tries XML <intro> tags first, falls back to raw text for backwards compat.
 */
function extractIntroFromResponse(rawText: string): string | null {
  const match = rawText.match(/<intro>([\s\S]*?)<\/intro>/)
  if (match?.[1]) {
    return match[1].trim()
  }
  // Fallback: use raw text if no XML tags (backwards compatible)
  const trimmed = rawText.trim()
  return trimmed.length > 0 ? trimmed : null
}

/**
 * Structural validation of the generated intro.
 * Catches obvious problems (too short/long, English leakage) without over-engineering.
 */
function validateIntro(introText: string): IntroValidation {
  const warnings: string[] = []
  const errors: string[] = []

  const wordCount = introText.trim().split(/\s+/).filter(Boolean).length
  const paragraphs = introText.split(/\n\n+/).filter(p => p.trim())

  // Hard errors — would trigger retry
  if (wordCount < 30) errors.push(`För kort: ${wordCount} ord (minimum 30)`)
  if (wordCount > 200) errors.push(`För långt: ${wordCount} ord (maximum 200)`)

  // English leakage detection (common when LLMs switch language mid-response)
  const englishPatterns = /\b(the |and the|this is|with the|from the|that the|have been|for the|will be)\b/gi
  const englishMatches = introText.match(englishPatterns)
  if (englishMatches && englishMatches.length >= 3) {
    errors.push(`Misstänkt engelska i texten (${englishMatches.length} engelska fraser)`)
  }

  // Soft warnings — logged but won't trigger retry
  if (paragraphs.length < 2) warnings.push(`Bara ${paragraphs.length} stycke(n), förväntat 2-3`)
  if (paragraphs.length > 4) warnings.push(`${paragraphs.length} stycken, förväntat 2-3`)
  if (wordCount > 160) warnings.push(`${wordCount} ord (mål: max 150)`)

  return { valid: errors.length === 0, warnings, errors }
}

/**
 * Generate a round intro using Vespa articles + Claude.
 * Includes retry logic, structural validation, and generation metadata.
 */
export async function generateRoundIntro(gameId: string): Promise<RoundIntro | null> {
  const supabase = supabaseAdmin()
  const startTime = Date.now()

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

    // 5. Generate intro with Claude (with retry logic)
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      log.api.error('ANTHROPIC_API_KEY not configured')
      return null
    }

    const anthropic = new Anthropic({ apiKey })
    const systemPrompt = buildSystemPrompt(game as Game)
    const userPrompt = buildUserPrompt(game as Game, articles, trendingPlayers)

    let bestIntro: string | null = null
    let bestValidation: IntroValidation = { valid: false, warnings: [], errors: ['No attempts made'] }
    let attempts = 0

    for (let attempt = 1; attempt <= MAX_GENERATION_ATTEMPTS; attempt++) {
      attempts = attempt
      try {
        const message = await anthropic.messages.create({
          model: ANTHROPIC_MODEL,
          max_tokens: 400,
          temperature: 0.5,
          stop_sequences: ['</intro>'],
          system: systemPrompt,
          messages: [{ role: 'user', content: userPrompt }],
        })

        const rawText = message.content
          .filter((block) => block.type === 'text')
          .map((block) => block.text)
          .join('\n')

        const extracted = extractIntroFromResponse(rawText)
        if (!extracted) {
          log.api.warn({ attempt }, 'Claude returned empty or unparseable response')
          continue
        }

        const validation = validateIntro(extracted)

        if (validation.warnings.length > 0) {
          log.api.warn({ attempt, warnings: validation.warnings }, 'Intro validation warnings')
        }

        if (validation.valid) {
          bestIntro = extracted
          bestValidation = validation
          break
        }

        // Keep as fallback even if invalid — a real but imperfect intro beats null
        log.api.warn({ attempt, errors: validation.errors }, 'Intro failed validation, retrying')
        if (!bestIntro) {
          bestIntro = extracted
          bestValidation = validation
        }
      } catch (llmError) {
        log.api.error({ err: llmError, attempt }, 'Claude API call failed')
      }
    }

    if (!bestIntro) {
      log.api.error({ gameId, attempts }, 'All intro generation attempts failed')
      return null
    }

    const latencyMs = Date.now() - startTime

    // 6. Build article references
    const articlesUsed: VespaArticleRef[] = articles.map((a) => ({
      article_id: a.article_id,
      title: a.title,
      relevance: a.relevance,
    }))

    // 7. Build generation metadata
    const generationMetadata = {
      attempts,
      validation: {
        valid: bestValidation.valid,
        warnings: bestValidation.warnings,
        errors: bestValidation.errors,
      },
      articles_count: articles.length,
      trending_players_count: trendingPlayers.length,
      sport_type: (game as Game).sport_type,
      temperature: 0.5,
      latency_ms: latencyMs,
    }

    // 8. Upsert into round_intros (replace if exists for same game + round)
    const { data: intro, error: upsertError } = await supabase
      .from('round_intros')
      .upsert(
        {
          game_id: gameId,
          round_number: game.current_round || 1,
          intro_text: bestIntro,
          articles_used: articlesUsed,
          vespa_query: vespaQuery,
          model_used: ANTHROPIC_MODEL,
          generation_metadata: generationMetadata,
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
      {
        gameId,
        round: game.current_round,
        articlesUsed: articles.length,
        attempts,
        valid: bestValidation.valid,
        latencyMs,
      },
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
