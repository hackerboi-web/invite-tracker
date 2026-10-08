import { Client, GatewayIntentBits, Events, Invite, GuildMember, Partials, Guild } from 'discord.js';
import { config } from './config.js';
import { getSupabaseClient, testConnection } from './database/client.js';
import { db } from './database/client.js';
import { refreshInviteCache } from './services/inviteCache.js';
import { findUsedInvite } from './services/inviteTracker.js';
import { logger } from './utils/logger.js';
import { validateConfig } from './config.js';
import './commands/index.js';

export const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildInvites,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ],
  partials: [Partials.GuildMember]
});

const inviteCreateHandler = async (invite: Invite) => {
  if (!invite.guild || !invite.code) return;
  
  try {
    await db.invites.upsert({
      guild_id: invite.guild.id,
      code: invite.code,
      creator_id: invite.inviter?.id || null,
      creator_tag: invite.inviter?.tag || null,
      uses: invite.uses ?? 0,
      max_uses: invite.maxUses ?? 0,
      expires_at: invite.expiresAt?.toISOString() || null,
      temporary: invite.temporary ?? false,
      invite_type: getInviteType(invite)
    });
    
    await refreshInviteCache(invite.guild.id, client);
    logger.info(`Invite created: ${invite.code} in ${invite.guild.name}`);
  } catch (error) {
    logger.error(`Failed to track invite create: ${error}`);
  }
};

const inviteDeleteHandler = async (invite: Invite) => {
  if (!invite.guild || !invite.code) return;
  
  try {
    await db.invites.markDeleted(invite.guild.id, invite.code);
    await refreshInviteCache(invite.guild.id, client);
    logger.info(`Invite deleted: ${invite.code} in ${invite.guild.name}`);
  } catch (error) {
    logger.error(`Failed to track invite delete: ${error}`);
  }
};

const guildMemberAddHandler = async (member: GuildMember) => {
  if (!member.guild) return;
  
  try {
    const usedInvite = await findUsedInvite(member.guild, member);
    
    if (usedInvite) {
      await db.joinEvents.insert({
        guild_id: member.guild.id,
        user_id: member.id,
        username: member.user.tag,
        invite_code: usedInvite.code,
        inviter_id: usedInvite.inviter?.id || null,
        inviter_tag: usedInvite.inviter?.tag || null,
        joined_at: new Date().toISOString()
      });
      
      await db.invites.updateUses(member.guild.id, usedInvite.code, usedInvite.uses ?? 0);
      await refreshInviteCache(member.guild.id, client);
      
      logger.info(`${member.user.tag} joined ${member.guild.name} via ${usedInvite.code}`);
    } else {
      await db.joinEvents.insert({
        guild_id: member.guild.id,
        user_id: member.id,
        username: member.user.tag,
        invite_code: 'unknown',
        inviter_id: null,
        inviter_tag: null,
        joined_at: new Date().toISOString()
      });
      logger.info(`${member.user.tag} joined ${member.guild.name} via unknown invite`);
    }
  } catch (error) {
    logger.error(`Failed to track member join: ${error}`);
  }
};

function getInviteType(invite: Invite): 'normal' | 'vanity' | 'temp' {
  if (invite.temporary) return 'temp';
  const guild = invite.guild as Guild | null;
  if (invite.maxUses === 0 && invite.maxAge === 0 && invite.inviter?.id === guild?.ownerId) return 'vanity';
  return 'normal';
}

client.once(Events.ClientReady, async () => {
  logger.info(`Logged in as ${client.user?.tag}`);
  
  for (const guild of client.guilds.cache.values()) {
    await refreshInviteCache(guild.id, client);
  }
  
  logger.info(`Tracking invites for ${client.guilds.cache.size} guilds`);
});

client.on(Events.InviteCreate, inviteCreateHandler);
client.on(Events.InviteDelete, inviteDeleteHandler);
client.on(Events.GuildMemberAdd, guildMemberAddHandler);

client.on(Events.GuildCreate, async (guild) => {
  await refreshInviteCache(guild.id, client);
  logger.info(`Joined new guild: ${guild.name} (${guild.id})`);
});

client.on(Events.GuildDelete, (guild) => {
  logger.info(`Left guild: ${guild.name} (${guild.id})`);
});

client.on(Events.Error, (error) => {
  logger.error(`Discord client error: ${error}`);
});

export async function startBot(): Promise<void> {
  validateConfig();
  
  const connected = await testConnection();
  if (!connected) {
    throw new Error('Failed to connect to Supabase');
  }
  
  await client.login(config.discord.token);
}