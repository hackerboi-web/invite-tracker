import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ButtonInteraction,
  ComponentType,
  MessageFlags
} from 'discord.js';
import { client } from '../bot.js';
import { db } from '../database/client.js';
import type { TrackedInvite, JoinEvent, GuildStats } from '../types/index.js';

// Components V2 flags
export const COMPONENTS_V2_FLAG = 32768;
export const EPHEMERAL_FLAG = 64;
export const COMPONENTS_V2_EPHEMERAL = COMPONENTS_V2_FLAG + EPHEMERAL_FLAG; // 32832

export interface PaginationState {
  page: number;
  totalPages: number;
  guildId: string;
  type: 'invites' | 'joins' | 'stats';
  userId: string;
}

const paginationStates = new Map<string, PaginationState>();

export function createInviteEmbed(
  invites: TrackedInvite[],
  guildId: string,
  page: number,
  pageSize: number,
  stateId: string,
  totalPages: number
): EmbedBuilder {
  const start = page * pageSize;
  const end = start + pageSize;
  const pageInvites = invites.slice(start, end);
  
  const guild = client.guilds.cache.get(guildId);
  const guildName = guild?.name || 'Unknown Guild';
  
  const embed = new EmbedBuilder()
    .setTitle(`📋 Invites for ${guildName}`)
    .setColor(0x5865F2)
    .setTimestamp();
  
  if (pageInvites.length === 0) {
    embed.setDescription('No invites found for this server.');
  } else {
    const lines = pageInvites.map((invite, index) => {
      const inviter = invite.creator_tag ? `by **${invite.creator_tag}**` : 'by *Unknown*';
      const typeIcon = invite.invite_type === 'vanity' ? '🔗' : invite.invite_type === 'temp' ? '⏱️' : '📨';
      const expires = invite.expires_at ? `\n   Expires: <t:${Math.floor(new Date(invite.expires_at).getTime() / 1000)}:R>` : '';
      return `${start + index + 1}. ${typeIcon} **${invite.code}** ${inviter}\n   Uses: **${invite.uses}**${invite.max_uses > 0 ? `/${invite.max_uses}` : ''}${expires}`;
    });
    embed.setDescription(lines.join('\n\n'));
  }
  
  embed.setFooter({ text: `Page ${page + 1}/${totalPages} • ${invites.length} total invites` });
  
  // Components V2: components attached to embed
  (embed as any).components = [createPaginationButtons(stateId, page, totalPages)];
  
  return embed;
}

export function createJoinEventsEmbed(
  events: JoinEvent[],
  guildId: string,
  page: number,
  pageSize: number,
  stateId: string,
  totalPages: number
): EmbedBuilder {
  const start = page * pageSize;
  const end = start + pageSize;
  const pageEvents = events.slice(start, end);
  
  const guild = client.guilds.cache.get(guildId);
  const guildName = guild?.name || 'Unknown Guild';
  
  const embed = new EmbedBuilder()
    .setTitle(`📥 Recent Joins for ${guildName}`)
    .setColor(0x57F287)
    .setTimestamp();
  
  if (pageEvents.length === 0) {
    embed.setDescription('No join events found for this server.');
  } else {
    const lines = pageEvents.map((event, index) => {
      const inviter = event.inviter_tag ? `via **${event.inviter_tag}** (${event.invite_code})` : `via *${event.invite_code}* (Unknown)`;
      const time = `<t:${Math.floor(new Date(event.joined_at).getTime() / 1000)}:R>`;
      return `${start + index + 1}. **${event.username}** joined ${inviter}\n   ${time}`;
    });
    embed.setDescription(lines.join('\n\n'));
  }
  
  embed.setFooter({ text: `Page ${page + 1}/${totalPages} • ${events.length} total joins` });
  
  // Components V2: components attached to embed
  (embed as any).components = [createPaginationButtons(stateId, page, totalPages)];
  
  return embed;
}

export function createStatsEmbed(stats: GuildStats | null, guildId: string): EmbedBuilder {
  const guild = client.guilds.cache.get(guildId);
  const guildName = guild?.name || 'Unknown Guild';
  
  const embed = new EmbedBuilder()
    .setTitle(`📊 Stats for ${guildName}`)
    .setColor(0xFEE75C)
    .setTimestamp();
  
  if (!stats) {
    embed.setDescription('No stats available yet. Invite tracking will populate this over time.');
  } else {
    const topInviter = stats.top_inviter_id 
      ? `<@${stats.top_inviter_id}> (${stats.top_inviter_count} invites)`
      : 'None yet';
    
    embed.addFields(
      { name: '📨 Total Invites Tracked', value: stats.total_invites.toString(), inline: true },
      { name: '📥 Total Joins', value: stats.total_joins.toString(), inline: true },
      { name: '👥 Unique Inviters', value: stats.unique_inviters.toString(), inline: true },
      { name: '🏆 Top Inviter', value: topInviter, inline: true }
    );
  }
  
  // Components V2 flag (even without components)
  return embed;
}

export function createPaginationButtons(stateId: string, currentPage: number, totalPages: number): ActionRowBuilder<ButtonBuilder> {
  const row = new ActionRowBuilder<ButtonBuilder>();
  
  row.addComponents(
    new ButtonBuilder()
      .setCustomId(`pagination:${stateId}:first`)
      .setLabel('⏮️ First')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(currentPage === 0),
    new ButtonBuilder()
      .setCustomId(`pagination:${stateId}:prev`)
      .setLabel('◀️ Previous')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(currentPage === 0),
    new ButtonBuilder()
      .setCustomId(`pagination:${stateId}:next`)
      .setLabel('Next ▶️')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(currentPage >= totalPages - 1),
    new ButtonBuilder()
      .setCustomId(`pagination:${stateId}:last`)
      .setLabel('Last ⏭️')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(currentPage >= totalPages - 1)
  );
  
  return row;
}

export function createStateId(): string {
  return Math.random().toString(36).substring(2, 10);
}

export function storePaginationState(state: PaginationState): string {
  const stateId = createStateId();
  paginationStates.set(stateId, state);
  
  setTimeout(() => {
    paginationStates.delete(stateId);
  }, 5 * 60 * 1000);
  
  return stateId;
}

export function getPaginationState(stateId: string): PaginationState | undefined {
  return paginationStates.get(stateId);
}

export async function handlePaginationInteraction(interaction: ButtonInteraction): Promise<void> {
  if (!interaction.customId.startsWith('pagination:')) return;
  
  const parts = interaction.customId.split(':');
  if (parts.length !== 3) return;
  
  const [, stateId, action] = parts;
  const state = getPaginationState(stateId);
  
  if (!state) {
    await interaction.reply({
      content: 'This pagination has expired. Please run the command again.',
      flags: EPHEMERAL_FLAG
    });
    return;
  }
  
  if (state.userId !== interaction.user.id) {
    await interaction.reply({
      content: 'Only the command author can use these buttons.',
      flags: EPHEMERAL_FLAG
    });
    return;
  }
  
  let newPage = state.page;
  switch (action) {
    case 'first': newPage = 0; break;
    case 'prev': newPage = Math.max(0, state.page - 1); break;
    case 'next': newPage = Math.min(state.totalPages - 1, state.page + 1); break;
    case 'last': newPage = state.totalPages - 1; break;
  }
  
  if (newPage === state.page) return;
  
  state.page = newPage;
  
  let embed;
  
  if (state.type === 'invites') {
    const invites = await db.invites.getByGuild(state.guildId);
    embed = createInviteEmbed(invites, state.guildId, newPage, 10, stateId, state.totalPages);
  } else if (state.type === 'joins') {
    const events = await db.joinEvents.getByGuild(state.guildId);
    embed = createJoinEventsEmbed(events, state.guildId, newPage, 10, stateId, state.totalPages);
  }
  
  if (embed) {
    await interaction.update({ 
      embeds: [embed], 
      flags: COMPONENTS_V2_FLAG 
    });
  }
}