import { Guild, GuildMember, Invite } from 'discord.js';
import { client } from '../bot.js';
import { getCachedInvite, getInviteCache, updateCachedInvite } from './inviteCache.js';
import { logger } from '../utils/logger.js';

export async function findUsedInvite(guild: Guild, member: GuildMember): Promise<Invite | null> {
  try {
    const currentInvites = await guild.invites.fetch();
    const cache = getInviteCache(guild.id);
    
    for (const [code, invite] of currentInvites) {
      const cached = cache.get(code);
      const currentUses = invite.uses ?? 0;
      const cachedUses = cached?.uses ?? 0;
      
      if (cached && currentUses > cachedUses) {
        updateCachedInvite(guild.id, code, currentUses);
        return invite;
      }
    }
    
    return null;
  } catch (error) {
    logger.error(`Error finding used invite for ${guild.name}: ${error}`);
    return null;
  }
}

export async function getGuildInvites(guildId: string): Promise<Invite[]> {
  const guild = client.guilds.cache.get(guildId);
  if (!guild) return [];
  
  try {
    const invites = await guild.invites.fetch();
    return Array.from(invites.values());
  } catch {
    return [];
  }
}

export async function getInviteByCode(guildId: string, code: string): Promise<Invite | null> {
  const guild = client.guilds.cache.get(guildId);
  if (!guild) return null;
  
  try {
    const invites = await guild.invites.fetch();
    return invites.get(code) ?? null;
  } catch {
    return null;
  }
}