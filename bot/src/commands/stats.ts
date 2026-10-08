import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits } from 'discord.js';
import { db } from '../database/client.js';
import { createStatsEmbed } from '../utils/components.js';
import { logger } from '../utils/logger.js';

export const data = new SlashCommandBuilder()
  .setName('stats')
  .setDescription('View invite statistics for this server')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild);

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.guild) {
    await interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });
    return;
  }
  
  const guildId = interaction.guild.id;
  
  await interaction.deferReply({ ephemeral: false });
  
  try {
    const stats = await db.guildStats.get(guildId);
    const embed = createStatsEmbed(stats, guildId);
    
    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    logger.error(`Error in /stats command: ${error}`);
    await interaction.editReply({ content: 'An error occurred while fetching stats.' });
  }
}