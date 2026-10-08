import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const schema = `
-- Bot registrations for API access
CREATE TABLE IF NOT EXISTS registered_bots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  bot_id BIGINT NOT NULL,
  api_key TEXT NOT NULL,
  permissions JSONB DEFAULT '["read_invites"]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  revoked_at TIMESTAMPTZ,
  UNIQUE(bot_id)
);

-- Invites being tracked
CREATE TABLE IF NOT EXISTS tracked_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id BIGINT NOT NULL,
  code TEXT NOT NULL,
  creator_id BIGINT,
  creator_tag TEXT,
  uses INT DEFAULT 0,
  max_uses INT DEFAULT 0,
  expires_at TIMESTAMPTZ,
  temporary BOOLEAN DEFAULT FALSE,
  invite_type TEXT DEFAULT 'normal',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  UNIQUE(guild_id, code)
);

-- Join events (invite -> user join)
CREATE TABLE IF NOT EXISTS join_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id BIGINT NOT NULL,
  user_id BIGINT NOT NULL,
  username TEXT NOT NULL,
  invite_code TEXT NOT NULL,
  inviter_id BIGINT,
  inviter_tag TEXT,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Stats snapshots (cached for dashboard)
CREATE TABLE IF NOT EXISTS guild_stats (
  guild_id BIGINT PRIMARY KEY,
  name TEXT NOT NULL,
  total_invites INT DEFAULT 0,
  total_joins INT DEFAULT 0,
  unique_inviters INT DEFAULT 0,
  top_inviter_id BIGINT,
  top_inviter_count INT,
  last_updated TIMESTAMPTZ DEFAULT NOW()
);

-- Dashboard sessions (user auth)
CREATE TABLE IF NOT EXISTS dashboard_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  discord_user_id BIGINT NOT NULL,
  discord_username TEXT NOT NULL,
  discord_avatar TEXT,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_join_events_guild_time ON join_events(guild_id, joined_at DESC);
CREATE INDEX IF NOT EXISTS idx_join_events_invite ON join_events(invite_code);
CREATE INDEX IF NOT EXISTS idx_tracked_invites_guild ON tracked_invites(guild_id);
CREATE INDEX IF NOT EXISTS idx_tracked_invites_deleted ON tracked_invites(deleted_at) WHERE deleted_at IS NOT NULL;
`;

async function pushSchema(): Promise<void> {
  console.log('Pushing schema to Supabase...');
  
  const statements = schema.split(';').filter(s => s.trim());
  
  for (const statement of statements) {
    const trimmed = statement.trim();
    if (!trimmed) continue;
    
    try {
      const { error } = await supabase.rpc('exec_sql', { sql: trimmed });
      if (error) {
        console.error(`Error executing: ${trimmed.substring(0, 100)}...`);
        console.error(error);
      } else {
        console.log(`✓ Executed: ${trimmed.substring(0, 80)}...`);
      }
    } catch (err) {
      console.error(`Exception executing: ${trimmed.substring(0, 100)}...`);
      console.error(err);
    }
  }
  
  console.log('Schema push complete.');
}

pushSchema().catch(console.error);