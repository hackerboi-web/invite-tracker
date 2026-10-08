import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, EmbedBuilder } from 'discord.js';
import { client } from '../bot.js';
import { refreshInviteCache } from '../services/inviteCache.js';
import { db } from '../database/client.js';
import { logger } from '../utils/logger.js';

export const data = new SlashCommandBuilder()
  .setName('sync')
  .setDescription('Force sync invites with Discord')
  .addSubcommand(subcommand =>
    subcommand
      .setName('invites')
      .setDescription('Sync all invites for this server')
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('stats')
      .setDescription('Recalculate statistics for this server')
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.guild) {
    await interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });
    return;
  }
  
  const subcommand = interaction.options.getSubcommand();
  const guildId = interaction.guild.id;
  
  await interaction.deferReply({ ephemeral: true });
  
  try {
    if (subcommand === 'invites') {
      await refreshInviteCache(guildId, client);
      const invites = await db.invites.getByGuild(guildId);
      
      const embed = new EmbedBuilder()
        .setTitle('✅ Invite Sync Complete')
        .setDescription(`Synced **${invites.length}** invites for ${interaction.guild.name}`)
        .setColor(0x57F287)
        .setTimestamp();
      
      await interaction.editReply({ embeds: [embed] });
      
    } else if (subcommand === 'stats') {
      const invites = await db.invites.getByGuild(guildId);
      const joinEvents = await db.joinEvents.getByGuild(guildId);
      
      const uniqueInviters = new Set(joinEvents.map(e => e.inviter_id).filter(Boolean)).size;
      const totalJoins = joinEvents.length;
      const totalInvites = invites.length;
      
      let topInviterId: string | null = null;
      let topInviterCount = 0;
      
      const inviterCounts = new Map<string, number>();
      for (const event of joinEvents) {
        if (event.inviter_id) {
          const count = (inviterCounts.get(event.inviter_id) || 0) + 1;
          inviterCounts.set(event.inviter_id, count);
          if (count > topInviterCount) {
            topInviterCount = count;
            topInviterId = event.inviter_id;
          }
        }
      }
      
      await db.guildStats.upsert({
        guild_id: guildId,
        name: interaction.guild.name,
        total_invites: totalInvites,
        total_joins: totalJoins,
        unique_inviters: uniqueInviters,
        top_inviter_id: topInviterId,
        top_inviter_count: topInviterCount
      });
      
      const embed = new EmbedBuilder()
        .setTitle('✅ Stats Recalculated')
        .setDescription(`Updated statistics for ${interaction.guild.name}`)
        .addFields(
          { name: '📨 Total Invites', value: totalInvites.toString(), inline: true },
          { name: '📥 Total Joins', value: totalJoins.toString(), inline: true },
          { name: '👥 Unique Inviters', value: uniqueInviters.toString(), inline: true },
          { name: '🏆 Top Inviter', value: topInviterId ? `<@${topInviterId}> (${topInviterCount})` : 'None', inline: true }
        )
        .setColor(0x57F287)
        .setTimestamp();
      
      await interaction.editReply({ embeds: [embed] });
    }
  } catch (error) {
    logger.error(`Error in /sync command: ${error}`);
    await interaction.editReply({ content: 'An error occurred during sync.' });
  }
}