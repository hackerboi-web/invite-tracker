export interface TrackedInvite {
  id: string;
  guild_id: string;
  code: string;
  creator_id: string | null;
  creator_tag: string | null;
  uses: number;
  max_uses: number;
  expires_at: string | null;
  temporary: boolean;
  invite_type: 'normal' | 'vanity' | 'temp';
  created_at: string;
  deleted_at?: string | null;
}

export interface JoinEvent {
  id: string;
  guild_id: string;
  user_id: string;
  username: string;
  invite_code: string;
  inviter_id: string | null;
  inviter_tag: string | null;
  joined_at: string;
  created_at: string;
}

export interface RegisteredBot {
  id: string;
  name: string;
  bot_id: string;
  api_key: string;
  permissions: string[];
  created_at: string;
  revoked_at: string | null;
}

export interface GuildStats {
  guild_id: string;
  name: string;
  total_invites: number;
  total_joins: number;
  unique_inviters: number;
  top_inviter_id: string | null;
  top_inviter_count: number;
  last_updated: string;
}

export interface DashboardSession {
  id: string;
  discord_user_id: string;
  discord_username: string;
  discord_avatar: string | null;
  access_token: string;
  refresh_token: string | null;
  expires_at: string;
  created_at: string;
}

export interface PublicAPIRequest {
  api_key: string;
  guild_id: string;
  start_time?: string;
  end_time?: string;
  limit?: number;
}

export interface PublicAPIResponse {
  status: 'success' | 'error';
  message?: string;
  guild_id: string;
  invites: PublicInvite[];
  join_events: PublicJoinEvent[];
}

export interface PublicInvite {
  code: string;
  creator_id: string;
  creator_tag: string;
  uses: number;
  max_uses: number;
  created_at: string;
  expires_at: string | null;
  temporary: boolean;
  type: 'normal' | 'vanity' | 'temp';
}

export interface PublicJoinEvent {
  user_id: string;
  username: string;
  invite_code: string;
  inviter_id: string | null;
  inviter_tag: string | null;
  joined_at: string;
}

export interface InternalAPIResponse<T> {
  status: 'success' | 'error';
  message?: string;
  data?: T;
}

export interface GuildInvitesResponse {
  invites: TrackedInvite[];
  stats: GuildStats;
}

export interface GuildJoinEventsResponse {
  events: JoinEvent[];
  total: number;
}