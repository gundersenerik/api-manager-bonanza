import { VespaArticle } from '@/types'
import { log } from '@/lib/logger'

const VESPA_URL = 'https://fd3a8d34.a23fbc3b.z.vespa-app.cloud/'
const VESPA_TIMEOUT_MS = 15000

/**
 * Vespa Article Search Client
 * Searches Aftonbladet articles in Vespa vector DB
 */
export async function searchArticles(
  query: string,
  hits: number = 5
): Promise<VespaArticle[]> {
  const token = process.env.VESPA_TOKEN

  if (!token) {
    log.api.warn('VESPA_TOKEN not configured, skipping article search')
    return []
  }

  try {
    // Search within the last 7 days
    const oneWeekAgoSec = Math.floor((Date.now() - 7 * 24 * 60 * 60 * 1000) / 1000)

    const queryParams = new URLSearchParams({
      yql: `select article_id, title, content, created_date from articles where userQuery() and newsroom contains 'ab' and language contains 'sv' and created_date >= ${oneWeekAgoSec}`,
      query: query,
      hits: String(hits),
    })

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), VESPA_TIMEOUT_MS)

    const response = await fetch(`${VESPA_URL}search/?${queryParams.toString()}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      log.api.error(`Vespa search failed with status ${response.status}`)
      return []
    }

    const results = await response.json()

    const articles: VespaArticle[] =
      results.root?.children?.map((hit: any) => ({
        article_id: hit.fields.article_id,
        title: hit.fields.title,
        content: hit.fields.content || '',
        created_date: hit.fields.created_date,
        relevance: hit.relevance,
      })) || []

    log.api.info(`Vespa returned ${articles.length} articles for query: "${query.substring(0, 60)}..."`)
    return articles
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      log.api.error('Vespa search timeout')
    } else {
      log.api.error({ err: error }, 'Vespa search failed')
    }
    return []
  }
}
