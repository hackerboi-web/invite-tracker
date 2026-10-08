import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from '../config.js';
import type {
  TrackedInvite,
  JoinEvent,
  RegisteredBot,
  GuildStats,
  DashboardSession
} from '../types/index.js';

let supabase: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient {
  if (!supabase) {
    if (!config.supabase.url || !config.supabase.serviceKey) {
      throw new Error('Supabase configuration missing');
    }
    supabase = createClient(config.supabase.url, config.supabase.serviceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
  }
  return supabase;
}

export async function testConnection(): Promise<boolean> {
  try {
    const client = getSupabaseClient();
    const { error } = await client.from('tracked_invites').select('id').limit(1);
    return !error;
  } catch {
    return false;
  }
}

export const db = {
  invites: {
    async upsert(invite: Omit<TrackedInvite, 'id' | 'created_at' | 'deleted_at'>): Promise<TrackedInvite | null> {
      const client = getSupabaseClient();
      const { data, error } = await client
        .from('tracked_invites')
        .upsert(invite, { onConflict: 'guild_id,code' })
        .select()
        .single();
      if (error) throw error;
      return data;
    },

    async getByGuild(guildId: string): Promise<TrackedInvite[]> {
      const client = getSupabaseClient();
      const { data, error } = await client
        .from('tracked_invites')
        .select('*')
        .eq('guild_id', guildId)
        .is('deleted_at', null)
        .order('uses', { ascending: false });
      if (error) throw error;
      return data || [];
    },

    async getByCode(guildId: string, code: string): Promise<TrackedInvite | null> {
      const client = getSupabaseClient();
      const { data, error } = await client
        .from('tracked_invites')
        .select('*')
        .eq('guild_id', guildId)
        .eq('code', code)
        .is('deleted_at', null)
        .single();
      if (error && error.code !== 'PGRST116') throw error;
      return data;
    },

    async markDeleted(guildId: string, code: string): Promise<void> {
      const client = getSupabaseClient();
      const { error } = await client
        .from('tracked_invites')
        .update({ deleted_at: new Date().toISOString() })
        .eq('guild_id', guildId)
        .eq('code', code);
      if (error) throw error;
    },

    async updateUses(guildId: string, code: string, uses: number): Promise<void> {
      const client = getSupabaseClient();
      const { error } = await client
        .from('tracked_invites')
        .update({ uses })
        .eq('guild_id', guildId)
        .eq('code', code);
      if (error) throw error;
    }
  },

  joinEvents: {
    async insert(event: Omit<JoinEvent, 'id' | 'created_at'>): Promise<JoinEvent | null> {
      const client = getSupabaseClient();
      const { data, error } = await client
        .from('join_events')
        .insert(event)
        .select()
        .single();
      if (error) throw error;
      return data;
    },

    async getByGuild(guildId: string, startTime?: string, endTime?: string, limit = 100): Promise<JoinEvent[]> {
      const client = getSupabaseClient();
      let query = client
        .from('join_events')
        .select('*')
        .eq('guild_id', guildId)
        .order('joined_at', { ascending: false })
        .limit(limit);

      if (startTime) query = query.gte('joined_at', startTime);
      if (endTime) query = query.lte('joined_at', endTime);

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },

    async getByInviteCode(guildId: string, inviteCode: string): Promise<JoinEvent[]> {
      const client = getSupabaseClient();
      const { data, error } = await client
        .from('join_events')
        .select('*')
        .eq('guild_id', guildId)
        .eq('invite_code', inviteCode)
        .order('joined_at', { ascending: false });
      if (error) throw error;
      return data || [];
    }
  },

  registeredBots: {
    async create(bot: Omit<RegisteredBot, 'id' | 'created_at' | 'revoked_at'>): Promise<RegisteredBot | null> {
      const client = getSupabaseClient();
      const { data, error } = await client
        .from('registered_bots')
        .insert(bot)
        .select()
        .single();
      if (error) throw error;
      return data;
    },

    async getByApiKey(apiKey: string): Promise<RegisteredBot | null> {
      const client = getSupabaseClient();
      const { data, error } = await client
        .from('registered_bots')
        .select('*')
        .eq('api_key', apiKey)
        .is('revoked_at', null)
        .single();
      if (error && error.code !== 'PGRST116') throw error;
      return data;
    },

    async getByBotId(botId: string): Promise<RegisteredBot | null> {
      const client = getSupabaseClient();
      const { data, error } = await client
        .from('registered_bots')
        .select('*')
        .eq('bot_id', botId)
        .is('revoked_at', null)
        .single();
      if (error && error.code !== 'PGRST116') throw error;
      return data;
    },

    async revoke(apiKey: string): Promise<void> {
      const client = getSupabaseClient();
      const { error } = await client
        .from('registered_bots')
        .update({ revoked_at: new Date().toISOString() })
        .eq('api_key', apiKey);
      if (error) throw error;
    },

    async list(): Promise<RegisteredBot[]> {
      const client = getSupabaseClient();
      const { data, error } = await client
        .from('registered_bots')
        .select('*')
        .is('revoked_at', null)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    }
  },

  guildStats: {
    async upsert(stats: Omit<GuildStats, 'last_updated'>): Promise<GuildStats | null> {
      const client = getSupabaseClient();
      const { data, error } = await client
        .from('guild_stats')
        .upsert({ ...stats, last_updated: new Date().toISOString() }, { onConflict: 'guild_id' })
        .select()
        .single();
      if (error) throw error;
      return data;
    },

    async get(guildId: string): Promise<GuildStats | null> {
      const client = getSupabaseClient();
      const { data, error } = await client
        .from('guild_stats')
        .select('*')
        .eq('guild_id', guildId)
        .single();
      if (error && error.code !== 'PGRST116') throw error;
      return data;
    }
  },

  dashboardSessions: {
    async create(session: Omit<DashboardSession, 'id' | 'created_at'>): Promise<DashboardSession | null> {
      const client = getSupabaseClient();
      const { data, error } = await client
        .from('dashboard_sessions')
        .insert(session)
        .select()
        .single();
      if (error) throw error;
      return data;
    },

    async getByAccessToken(token: string): Promise<DashboardSession | null> {
      const client = getSupabaseClient();
      const { data, error } = await client
        .from('dashboard_sessions')
        .select('*')
        .eq('access_token', token)
        .gt('expires_at', new Date().toISOString())
        .single();
      if (error && error.code !== 'PGRST116') throw error;
      return data;
    },

    async deleteExpired(): Promise<number> {
      const client = getSupabaseClient();
      const { error, count } = await client
        .from('dashboard_sessions')
        .delete()
        .lt('expires_at', new Date().toISOString());
      if (error) throw error;
      return count || 0;
    }
  }
};