import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits } from 'discord.js';
import { db } from '../database/client.js';
import { refreshInviteCache } from '../services/inviteCache.js';
import { createInviteEmbed, createJoinEventsEmbed, createPaginationButtons, storePaginationState } from '../utils/components.js';
import { logger } from '../utils/logger.js';

export const data = new SlashCommandBuilder()
  .setName('invites')
  .setDescription('View invite leaderboard and statistics for this server')
  .addSubcommand(subcommand =>
    subcommand
      .setName('leaderboard')
      .setDescription('Show the invite leaderboard')
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('joins')
      .setDescription('Show recent join events')
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild);

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.guild) {
    await interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });
    return;
  }
  
  const subcommand = interaction.options.getSubcommand();
  const guildId = interaction.guild.id;
  
  await interaction.deferReply({ ephemeral: false });
  
  try {
    if (subcommand === 'leaderboard') {
      const invites = await db.invites.getByGuild(guildId);
      
      if (invites.length === 0) {
        await interaction.editReply({ content: 'No invites tracked for this server yet.' });
        return;
      }
      
      const pageSize = 10;
      const totalPages = Math.ceil(invites.length / pageSize);
      
      const stateId = storePaginationState({
        page: 0,
        totalPages,
        guildId,
        type: 'invites',
        userId: interaction.user.id
      });
      
      const embed = createInviteEmbed(invites, guildId, 0, pageSize);
      const row = createPaginationButtons(stateId, 0, totalPages);
      
      await interaction.editReply({ embeds: [embed], components: [row] });
      
    } else if (subcommand === 'joins') {
      const events = await db.joinEvents.getByGuild(guildId);
      
      if (events.length === 0) {
        await interaction.editReply({ content: 'No join events recorded for this server yet.' });
        return;
      }
      
      const pageSize = 10;
      const totalPages = Math.ceil(events.length / pageSize);
      
      const stateId = storePaginationState({
        page: 0,
        totalPages,
        guildId,
        type: 'joins',
        userId: interaction.user.id
      });
      
      const embed = createJoinEventsEmbed(events, guildId, 0, pageSize);
      const row = createPaginationButtons(stateId, 0, totalPages);
      
      await interaction.editReply({ embeds: [embed], components: [row] });
    }
  } catch (error) {
    logger.error(`Error in /invites command: ${error}`);
    await interaction.editReply({ content: 'An error occurred while fetching invite data.' });
  }
}