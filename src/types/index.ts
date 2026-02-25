// ============================================
// SWUSH API Types (from their API)
// ============================================

export interface SwushRound {
  index: number
  start: string
  tradeCloses: string
  end: string
  isVerified: number
  state: 'Pending' | 'CurrentOpen' | 'Ended' | 'EndedLastest'
}

export interface SwushElement {
  elementId: number
  imageUrl: string
  url: string
  shortName: string
  fullName: string
  teamName: string
  popularity: number
  trend: number
  growth: number
  totalGrowth: number
  value: number
}

export interface SwushUserteam {
  id: number
  name: string
  key: string
  score: number
  rank: number
  roundScore: number
  roundRank: number
  roundJump: number
  injured: number
  suspended: number
  lineupElementIds?: number[]
}

export interface SwushUser {
  id: number
  name: string
  key: string
  email: string
  externalId: string
  permissions: string[]
  injured: number
  suspended: number
  userteams: SwushUserteam[]
}

export interface SwushGameResponse {
  gameId: number
  tournamentId: number
  gameKey: string
  userteamsCount: number
  competitionsCount: number
  currentRoundIndex: number
  rounds: SwushRound[]
  elements?: {
    byGrowth: SwushElement[]
    byTotalGrowth: SwushElement[]
    byPopularity: SwushElement[]
    byTrend: SwushElement[]
    byTrendReverse: SwushElement[]
  }
  competitions: any[]
}

export interface SwushUsersResponse {
  functionVersion: string
  subsiteKey: string
  gameId: number
  gameKey: string
  gameUrl: string
  roundsTotal: number
  roundIndex: number
  roundState: string
  usersTotal: number
  pageSizeMax: number
  pages: number
  page: number
  pageSize: number
  users: SwushUser[]
}

// ============================================
// Database Types (Supabase)
// ============================================

export interface Game {
  id: string
  game_key: string
  name: string
  sport_type: 'FOOTBALL' | 'HOCKEY' | 'F1' | 'OTHER'
  subsite_key: string
  is_active: boolean
  current_round: number
  total_rounds: number
  round_state: string | null
  next_trade_deadline: string | null
  current_round_start: string | null
  current_round_end: string | null
  sync_interval_minutes: number
  last_synced_at: string | null
  swush_game_id: number | null
  game_url: string | null
  users_total: number
  created_at: string
  updated_at: string
}

export interface Element {
  id: string
  game_id: string
  element_id: number
  short_name: string
  full_name: string
  team_name: string
  image_url: string | null
  popularity: number
  trend: number
  growth: number
  total_growth: number
  value: number
  is_injured: boolean
  is_suspended: boolean
  updated_at: string
}

export interface UserGameStats {
  id: string
  external_id: string
  game_id: string
  swush_user_id: number
  team_name: string
  score: number
  rank: number
  round_score: number
  round_rank: number
  round_jump: number
  injured_count: number
  suspended_count: number
  lineup_element_ids: number[]
  synced_at: string
  created_at: string
  updated_at: string
}

export interface SyncLog {
  id: string
  game_id: string
  sync_type: 'manual' | 'scheduled'
  status: 'started' | 'completed' | 'failed'
  users_synced: number
  elements_synced: number
  error_message: string | null
  started_at: string
  completed_at: string | null
}

export interface GameTrigger {
  id: string
  game_id: string
  trigger_type: 'deadline_reminder_24h' | 'round_started' | 'round_ended'
  braze_campaign_id: string
  is_active: boolean
  last_triggered_at: string | null
  last_triggered_round: number | null
  created_at: string
}

export interface TriggerLog {
  id: string
  game_id: string
  trigger_id: string
  trigger_type: string
  round_index: number
  status: 'triggered' | 'failed' | 'skipped'
  braze_response: any | null
  error_message: string | null
  triggered_at: string
}

// ============================================
// API Response Types (for Braze)
// ============================================

export interface BrazeUserResponse {
  user: {
    team_name: string
    rank: number
    score: number
    round_score: number
    round_rank: number
    position_change: number
    percentile: number
    injured_count: number
    suspended_count: number
  }
  game: {
    name: string
    current_round: number
    total_rounds: number
    round_state: string
    trade_deadline: string | null
    days_until_deadline: number | null
  }
  lineup: {
    name: string
    team: string
    trend: number
    value: number
    growth: number
    is_injured: boolean
    is_suspended: boolean
  }[]
  alerts: {
    injured_players: string[]
    suspended_players: string[]
    top_performer: { name: string; trend: number } | null
    worst_performer: { name: string; trend: number } | null
  }
  trending: {
    hot: { name: string; team: string; trend: number }[]
    falling: { name: string; team: string; trend: number }[]
  }
  round_intro?: string | null
}

// ============================================
// App User / RBAC Types
// ============================================

export type AppUserRole = 'user' | 'admin'

export interface AppUser {
  id: string
  email: string
  role: AppUserRole
  auth_user_id: string | null
  invited_by: string | null
  display_name: string | null
  is_active: boolean
  last_login_at: string | null
  created_at: string
  updated_at: string
}

// ============================================
// Round Intro Types
// ============================================

export interface GenerationMetadata {
  attempts: number
  validation: {
    valid: boolean
    warnings: string[]
    errors: string[]
  }
  articles_count: number
  trending_players_count: number
  sport_type: string
  temperature: number
  latency_ms: number
}

export interface RoundIntro {
  id: string
  game_id: string
  round_number: number
  intro_text: string
  articles_used: VespaArticleRef[]
  vespa_query: string | null
  model_used: string | null
  generation_metadata: GenerationMetadata | null
  generated_at: string
  created_at: string
  updated_at: string
}

export interface VespaArticle {
  article_id: string
  title: string
  content: string
  created_date: number
  relevance: number
}

export interface VespaArticleRef {
  article_id: string
  title: string
  relevance: number
}

// ============================================
// Activity Log Types
// ============================================

export type ActivityEntityType = 'game' | 'trigger' | 'user' | 'settings' | 'sync' | 'round_intro'

export interface ActivityLogEntry {
  id: string
  actor_id: string | null
  actor_email: string | null
  action: string
  entity_type: ActivityEntityType
  entity_id: string | null
  entity_name: string | null
  metadata: Record<string, unknown>
  created_at: string
}

/**
 * Unified activity feed item (combines sync_logs, trigger_logs, activity_log)
 */
export interface ActivityFeedItem {
  id: string
  type: 'sync' | 'trigger' | 'admin_action'
  action: string
  description: string
  entity_type: ActivityEntityType
  entity_id: string | null
  entity_name: string | null
  game_id: string | null
  game_name: string | null
  severity: 'info' | 'success' | 'warning' | 'error'
  actor: string | null
  metadata: Record<string, unknown>
  timestamp: string
}

// ============================================
// Analytics Types
// ============================================

export interface AnalyticsTimePoint {
  date: string
  value: number
}

export interface AnalyticsGameSeries {
  game_id: string
  game_name: string
  game_key: string
  sport_type: string
  data: AnalyticsTimePoint[]
}

export interface SyncHealthPoint {
  date: string
  success: number
  failed: number
  total: number
  success_rate: number
}

export interface SyncDurationPoint {
  date: string
  avg_duration_ms: number
  min_duration_ms: number
  max_duration_ms: number
  count: number
}

export interface TriggerTimelinePoint {
  date: string
  triggered: number
  failed: number
  skipped: number
}

export interface GameComparisonMetric {
  game_id: string
  game_name: string
  game_key: string
  sport_type: string
  total_users: number
  syncs_count: number
  sync_failures: number
  avg_sync_duration_ms: number
  triggers_fired: number
  trigger_failures: number
}

export interface AnalyticsResponse {
  time_range: '7d' | '30d' | 'all'
  user_trends: AnalyticsGameSeries[]
  sync_health: SyncHealthPoint[]
  sync_duration: SyncDurationPoint[]
  trigger_timeline: TriggerTimelinePoint[]
  game_comparison: GameComparisonMetric[]
}

// ============================================
// Notification Types
// ============================================

export type NotificationEventType =
  | 'sync_failure'
  | 'sync_recovered'
  | 'trigger_failure'
  | 'trigger_fired'
  | 'round_started'
  | 'round_ended'
  | 'season_ended'

export type NotificationSeverity = 'info' | 'warning' | 'error'

export type NotificationChannel = 'in_app' | 'slack' | 'email'

export interface Notification {
  id: string
  user_id: string
  event_type: NotificationEventType
  title: string
  message: string
  severity: NotificationSeverity
  game_id: string | null
  game_name: string | null
  metadata: Record<string, unknown>
  is_read: boolean
  created_at: string
}

export interface NotificationPreference {
  id: string
  user_id: string
  event_type: NotificationEventType
  in_app: boolean
  slack: boolean
  email: boolean
  muted_game_ids: string[]
  created_at: string
  updated_at: string
}

export interface NotificationEvent {
  event_type: NotificationEventType
  title: string
  message: string
  severity: NotificationSeverity
  game_id?: string
  game_name?: string
  metadata?: Record<string, unknown>
}

// ============================================
// API Response Types (for Braze)
// ============================================

export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
  timestamp: string
}
