-- ============================================
-- SWUSH Manager Database Schema
-- Run this in your Supabase SQL editor
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- GAMES TABLE
-- Stores fantasy game configurations
-- ============================================
CREATE TABLE IF NOT EXISTS games (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  game_key TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  sport_type TEXT NOT NULL DEFAULT 'OTHER' CHECK (sport_type IN ('FOOTBALL', 'HOCKEY', 'F1', 'OTHER')),
  subsite_key TEXT NOT NULL DEFAULT 'aftonbladet',
  is_active BOOLEAN NOT NULL DEFAULT true,
  current_round INTEGER DEFAULT 1,
  total_rounds INTEGER,
  round_state TEXT,
  next_trade_deadline TIMESTAMPTZ,
  current_round_start TIMESTAMPTZ,
  current_round_end TIMESTAMPTZ,
  sync_interval_minutes INTEGER NOT NULL DEFAULT 60,
  last_synced_at TIMESTAMPTZ,
  swush_game_id INTEGER,
  game_url TEXT,
  users_total INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_games_game_key ON games(game_key);
CREATE INDEX IF NOT EXISTS idx_games_is_active ON games(is_active);

-- ============================================
-- ELEMENTS TABLE
-- Cached player/element data from SWUSH
-- ============================================
CREATE TABLE IF NOT EXISTS elements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  element_id INTEGER NOT NULL,
  short_name TEXT NOT NULL,
  full_name TEXT NOT NULL,
  team_name TEXT,
  image_url TEXT,
  popularity DECIMAL DEFAULT 0,
  trend INTEGER DEFAULT 0,
  growth INTEGER DEFAULT 0,
  total_growth INTEGER DEFAULT 0,
  value INTEGER DEFAULT 0,
  is_injured BOOLEAN DEFAULT false,
  is_suspended BOOLEAN DEFAULT false,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(game_id, element_id)
);

-- Indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_elements_game_id ON elements(game_id);
CREATE INDEX IF NOT EXISTS idx_elements_element_id ON elements(element_id);
CREATE INDEX IF NOT EXISTS idx_elements_trend ON elements(trend DESC);

-- ============================================
-- USER_GAME_STATS TABLE
-- User stats per game (no PII except external_id)
-- ============================================
CREATE TABLE IF NOT EXISTS user_game_stats (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  external_id TEXT NOT NULL,
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  swush_user_id INTEGER NOT NULL,
  team_name TEXT,
  score INTEGER DEFAULT 0,
  rank INTEGER,
  round_score INTEGER DEFAULT 0,
  round_rank INTEGER,
  round_jump INTEGER DEFAULT 0,
  injured_count INTEGER DEFAULT 0,
  suspended_count INTEGER DEFAULT 0,
  lineup_element_ids INTEGER[] DEFAULT '{}',
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(external_id, game_id)
);

-- Indexes for faster lookups (especially for Braze queries)
CREATE INDEX IF NOT EXISTS idx_user_game_stats_external_id ON user_game_stats(external_id);
CREATE INDEX IF NOT EXISTS idx_user_game_stats_game_id ON user_game_stats(game_id);
CREATE INDEX IF NOT EXISTS idx_user_game_stats_lookup ON user_game_stats(external_id, game_id);

-- ============================================
-- API_KEYS TABLE
-- API keys for Braze authentication
-- ============================================
CREATE TABLE IF NOT EXISTS api_keys (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  key_hash TEXT NOT NULL,
  key_preview TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_api_keys_key_hash ON api_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_api_keys_is_active ON api_keys(is_active);

-- ============================================
-- SYNC_LOGS TABLE
-- Track sync operations for debugging
-- ============================================
CREATE TABLE IF NOT EXISTS sync_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  sync_type TEXT NOT NULL DEFAULT 'manual' CHECK (sync_type IN ('manual', 'scheduled')),
  status TEXT NOT NULL DEFAULT 'started' CHECK (status IN ('started', 'completed', 'failed')),
  users_synced INTEGER DEFAULT 0,
  elements_synced INTEGER DEFAULT 0,
  error_message TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_sync_logs_game_id ON sync_logs(game_id);
CREATE INDEX IF NOT EXISTS idx_sync_logs_started_at ON sync_logs(started_at DESC);

-- ============================================
-- GAME_TRIGGERS TABLE
-- Configure Braze campaign triggers per game
-- ============================================
CREATE TABLE IF NOT EXISTS game_triggers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  trigger_type TEXT NOT NULL CHECK (trigger_type IN ('deadline_reminder_24h', 'round_started', 'round_ended')),
  braze_campaign_id TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_triggered_at TIMESTAMPTZ,
  last_triggered_round INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(game_id, trigger_type)
);

CREATE INDEX IF NOT EXISTS idx_game_triggers_game_id ON game_triggers(game_id);
CREATE INDEX IF NOT EXISTS idx_game_triggers_is_active ON game_triggers(is_active);

-- ============================================
-- TRIGGER_LOGS TABLE
-- Track trigger executions
-- ============================================
CREATE TABLE IF NOT EXISTS trigger_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  trigger_id UUID NOT NULL REFERENCES game_triggers(id) ON DELETE CASCADE,
  trigger_type TEXT NOT NULL,
  round_index INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('triggered', 'failed', 'skipped')),
  braze_response JSONB,
  error_message TEXT,
  triggered_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_trigger_logs_game_id ON trigger_logs(game_id);
CREATE INDEX IF NOT EXISTS idx_trigger_logs_triggered_at ON trigger_logs(triggered_at DESC);

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply trigger to games table
DROP TRIGGER IF EXISTS update_games_updated_at ON games;
CREATE TRIGGER update_games_updated_at
  BEFORE UPDATE ON games
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Apply trigger to user_game_stats table
DROP TRIGGER IF EXISTS update_user_game_stats_updated_at ON user_game_stats;
CREATE TRIGGER update_user_game_stats_updated_at
  BEFORE UPDATE ON user_game_stats
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Apply trigger to elements table
DROP TRIGGER IF EXISTS update_elements_updated_at ON elements;
CREATE TRIGGER update_elements_updated_at
  BEFORE UPDATE ON elements
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

-- Enable RLS on all tables
ALTER TABLE games ENABLE ROW LEVEL SECURITY;
ALTER TABLE elements ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_game_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_triggers ENABLE ROW LEVEL SECURITY;
ALTER TABLE trigger_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Authenticated users (admin) can do everything
CREATE POLICY "Admin full access to games" ON games
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Admin full access to elements" ON elements
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Admin full access to user_game_stats" ON user_game_stats
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Admin full access to api_keys" ON api_keys
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Admin full access to sync_logs" ON sync_logs
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Admin full access to game_triggers" ON game_triggers
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Admin full access to trigger_logs" ON trigger_logs
  FOR ALL USING (auth.role() = 'authenticated');

-- Policy: Service role can do everything (for API routes)
CREATE POLICY "Service role full access to games" ON games
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Service role full access to elements" ON elements
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Service role full access to user_game_stats" ON user_game_stats
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Service role full access to api_keys" ON api_keys
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Service role full access to sync_logs" ON sync_logs
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Service role full access to game_triggers" ON game_triggers
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Service role full access to trigger_logs" ON trigger_logs
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- ============================================
-- APP_USERS TABLE
-- Invite-only access and role management
-- ============================================
CREATE TABLE IF NOT EXISTS app_users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  auth_user_id UUID UNIQUE,
  invited_by UUID,
  display_name TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_app_users_email ON app_users(email);
CREATE INDEX IF NOT EXISTS idx_app_users_auth_user_id ON app_users(auth_user_id);
CREATE INDEX IF NOT EXISTS idx_app_users_role ON app_users(role);

-- Apply trigger to app_users table
DROP TRIGGER IF EXISTS update_app_users_updated_at ON app_users;
CREATE TRIGGER update_app_users_updated_at
  BEFORE UPDATE ON app_users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- RLS for app_users
ALTER TABLE app_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read app_users" ON app_users
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Admins can manage app_users" ON app_users
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM app_users au
      WHERE au.auth_user_id = auth.uid()
      AND au.role = 'admin'
      AND au.is_active = true
    )
  );

CREATE POLICY "Service role full access to app_users" ON app_users
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- Helper functions for RLS
CREATE OR REPLACE FUNCTION is_app_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM app_users
    WHERE auth_user_id = auth.uid()
    AND role = 'admin'
    AND is_active = true
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION is_app_user()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM app_users
    WHERE auth_user_id = auth.uid()
    AND is_active = true
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ============================================
-- ROUND_INTROS TABLE
-- AI-generated round preview content
-- ============================================
CREATE TABLE IF NOT EXISTS round_intros (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  round_number INTEGER NOT NULL,
  intro_text TEXT NOT NULL,
  articles_used JSONB DEFAULT '[]'::jsonb,
  vespa_query TEXT,
  model_used TEXT,
  generation_metadata JSONB DEFAULT NULL,
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(game_id, round_number)
);

CREATE INDEX IF NOT EXISTS idx_round_intros_game_round ON round_intros(game_id, round_number);

ALTER TABLE round_intros ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access to round_intros" ON round_intros
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Authenticated can read round_intros" ON round_intros
  FOR SELECT USING (auth.role() = 'authenticated');

-- Apply trigger to round_intros table
DROP TRIGGER IF EXISTS update_round_intros_updated_at ON round_intros;
CREATE TRIGGER update_round_intros_updated_at
  BEFORE UPDATE ON round_intros
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- ACTIVITY_LOG TABLE
-- Audit trail for admin actions
-- ============================================
CREATE TABLE IF NOT EXISTS activity_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  actor_id UUID REFERENCES app_users(id) ON DELETE SET NULL,
  actor_email TEXT,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('game', 'trigger', 'user', 'settings', 'sync', 'round_intro')),
  entity_id TEXT,
  entity_name TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activity_log_created_at ON activity_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_log_entity_type ON activity_log(entity_type);
CREATE INDEX IF NOT EXISTS idx_activity_log_actor_id ON activity_log(actor_id);

ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access to activity_log" ON activity_log
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Admin full access to activity_log" ON activity_log
  FOR ALL USING (is_admin());

-- ============================================
-- NOTIFICATIONS TABLE
-- In-app notification feed for team members
-- ============================================
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN (
    'sync_failure', 'sync_recovered', 'trigger_failure', 'trigger_fired',
    'round_started', 'round_ended', 'season_ended'
  )),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'error')),
  game_id UUID REFERENCES games(id) ON DELETE SET NULL,
  game_name TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id, is_read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_game_id ON notifications(game_id);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access to notifications" ON notifications
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Users can read own notifications" ON notifications
  FOR SELECT USING (
    user_id IN (
      SELECT id FROM app_users WHERE auth_user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own notifications" ON notifications
  FOR UPDATE USING (
    user_id IN (
      SELECT id FROM app_users WHERE auth_user_id = auth.uid()
    )
  );

-- ============================================
-- NOTIFICATION_PREFERENCES TABLE
-- Per-user, per-event-type channel preferences
-- ============================================
CREATE TABLE IF NOT EXISTS notification_preferences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN (
    'sync_failure', 'sync_recovered', 'trigger_failure', 'trigger_fired',
    'round_started', 'round_ended', 'season_ended'
  )),
  in_app BOOLEAN NOT NULL DEFAULT TRUE,
  slack BOOLEAN NOT NULL DEFAULT TRUE,
  email BOOLEAN NOT NULL DEFAULT FALSE,
  muted_game_ids UUID[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, event_type)
);

CREATE INDEX IF NOT EXISTS idx_notification_prefs_user ON notification_preferences(user_id);

ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access to notification_preferences" ON notification_preferences
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Users can manage own preferences" ON notification_preferences
  FOR ALL USING (
    user_id IN (
      SELECT id FROM app_users WHERE auth_user_id = auth.uid()
    )
  );

-- Apply trigger to notification_preferences table
DROP TRIGGER IF EXISTS update_notification_preferences_updated_at ON notification_preferences;
CREATE TRIGGER update_notification_preferences_updated_at
  BEFORE UPDATE ON notification_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- DONE
-- ============================================
