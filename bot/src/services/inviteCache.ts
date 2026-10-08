import { Invite, Client } from 'discord.js';
import { logger } from '../utils/logger.js';

interface CachedInvite {
  code: string;
  uses: number;
  inviter?: Invite['inviter'];
}

const inviteCaches = new Map<string, Map<string, CachedInvite>>();

export function getInviteCache(guildId: string): Map<string, CachedInvite> {
  if (!inviteCaches.has(guildId)) {
    inviteCaches.set(guildId, new Map());
  }
  return inviteCaches.get(guildId)!;
}

export async function refreshInviteCache(guildId: string, client: Client): Promise<void> {
  try {
    const guild = client.guilds.cache.get(guildId);
    if (!guild) return;

    const invites = await guild.invites.fetch();
    const cache = getInviteCache(guildId);
    
    cache.clear();
    for (const [code, invite] of invites) {
      cache.set(code, {
        code,
        uses: invite.uses ?? 0,
        inviter: invite.inviter ?? undefined
      });
    }
    
    logger.debug(`Refreshed invite cache for ${guild.name}: ${cache.size} invites`);
  } catch (error) {
    logger.error(`Failed to refresh invite cache for ${guildId}: ${error}`);
  }
}

export function getCachedInvite(guildId: string, code: string): CachedInvite | undefined {
  return getInviteCache(guildId).get(code);
}

export function updateCachedInvite(guildId: string, code: string, uses: number): void {
  const cache = getInviteCache(guildId);
  const existing = cache.get(code);
  if (existing) {
    existing.uses = uses;
  }
}