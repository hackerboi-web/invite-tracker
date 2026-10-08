import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, MessageFlags } from 'discord.js';
import { db } from '../database/client.js';
import { logger } from '../utils/logger.js';

export const data = new SlashCommandBuilder()
  .setName('register')
  .setDescription('Register a bot for API access to this server\'s invite data')
  .addSubcommand(subcommand =>
    subcommand
      .setName('bot')
      .setDescription('Register a bot by ID')
      .addStringOption(option =>
        option.setName('bot_id')
          .setDescription('The Discord user ID of the bot to register')
          .setRequired(true)
      )
      .addStringOption(option =>
        option.setName('name')
          .setDescription('A name for this bot registration')
          .setRequired(true)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('list')
      .setDescription('List registered bots for this server')
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('revoke')
      .setDescription('Revoke API access for a registered bot')
      .addStringOption(option =>
        option.setName('api_key')
          .setDescription('The API key to revoke')
          .setRequired(true)
      )
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

const pendingRegistrations = new Map<string, { botId: string; name: string; guildId: string; userId: string }>();

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.guild) {
    await interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });
    return;
  }
  
  const subcommand = interaction.options.getSubcommand();
  const guildId = interaction.guild.id;
  
  try {
    if (subcommand === 'bot') {
      const botId = interaction.options.getString('bot_id', true);
      const name = interaction.options.getString('name', true);
      
      if (!/^\d{17,20}$/.test(botId)) {
        await interaction.reply({ content: 'Invalid bot ID format.', ephemeral: true });
        return;
      }
      
      const member = await interaction.guild.members.fetch(botId).catch(() => null);
      if (!member) {
        await interaction.reply({ content: 'Bot not found in this server.', ephemeral: true });
        return;
      }
      
      if (!member.user.bot) {
        await interaction.reply({ content: 'The provided ID is not a bot.', ephemeral: true });
        return;
      }
      
      const embed = new EmbedBuilder()
        .setTitle('🤖 Register Bot for API Access')
        .setDescription(`Register **${member.user.tag}** (${name}) for API access to invite data?`)
        .addFields(
          { name: 'Bot ID', value: botId, inline: true },
          { name: 'Name', value: name, inline: true }
        )
        .setColor(0x5865F2)
        .setTimestamp();
      
      const row = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
          new ButtonBuilder()
            .setCustomId(`register:confirm:${botId}:${name}`)
            .setLabel('Confirm Register')
            .setStyle(ButtonStyle.Success),
          new ButtonBuilder()
            .setCustomId('register:cancel')
            .setLabel('Cancel')
            .setStyle(ButtonStyle.Danger)
        );
      
      const registrationId = Math.random().toString(36).substring(2, 10);
      pendingRegistrations.set(registrationId, { botId, name, guildId, userId: interaction.user.id });
      
      setTimeout(() => pendingRegistrations.delete(registrationId), 5 * 60 * 1000);
      
      await interaction.reply({ embeds: [embed], components: [row], flags: MessageFlags.Ephemeral });
      
    } else if (subcommand === 'list') {
      const bots = await db.registeredBots.list();
      
      if (bots.length === 0) {
        await interaction.reply({ content: 'No bots registered for API access.', ephemeral: true });
        return;
      }
      
      const embed = new EmbedBuilder()
        .setTitle('🤖 Registered Bots')
        .setDescription('Bots with API access to invite data:')
        .setColor(0x5865F2)
        .setTimestamp();
      
      for (const bot of bots) {
        embed.addFields({
          name: `${bot.name} (${bot.bot_id})`,
          value: `API Key: \`${bot.api_key}\`\nPermissions: ${bot.permissions.join(', ')}\nCreated: <t:${Math.floor(new Date(bot.created_at).getTime() / 1000)}:R>`
        });
      }
      
      await interaction.reply({ embeds: [embed], ephemeral: true });
      
    } else if (subcommand === 'revoke') {
      const apiKey = interaction.options.getString('api_key', true);
      
      await db.registeredBots.revoke(apiKey);
      
      const embed = new EmbedBuilder()
        .setTitle('✅ Access Revoked')
        .setDescription('API access has been revoked for the specified key.')
        .setColor(0xED4245)
        .setTimestamp();
      
      await interaction.reply({ embeds: [embed], ephemeral: true });
    }
  } catch (error) {
    logger.error(`Error in /register command: ${error}`);
    await interaction.reply({ content: 'An error occurred.', ephemeral: true });
  }
}

export async function handleRegisterButton(interaction: import('discord.js').ButtonInteraction): Promise<void> {
  if (!interaction.customId.startsWith('register:')) return;
  
  const parts = interaction.customId.split(':');
  if (parts.length < 2) return;
  
  const action = parts[1];
  
  if (action === 'cancel') {
    await interaction.update({ content: 'Registration cancelled.', embeds: [], components: [] });
    return;
  }
  
  if (action === 'confirm') {
    const [, , botId, name] = parts;
    const registrationId = Array.from(pendingRegistrations.entries())
      .find(([, v]) => v.botId === botId && v.name === name)?.[0];
    
    if (!registrationId) {
      await interaction.update({ content: 'Registration expired or invalid.', embeds: [], components: [] });
      return;
    }
    
    const pending = pendingRegistrations.get(registrationId)!;
    if (pending.userId !== interaction.user.id) {
      await interaction.reply({ content: 'Only the command author can confirm.', flags: MessageFlags.Ephemeral });
      return;
    }
    
    try {
      const apiKey = generateApiKey();
      await db.registeredBots.create({
        name: pending.name,
        bot_id: pending.botId,
        api_key: apiKey,
        permissions: ['read_invites']
      });
      
      pendingRegistrations.delete(registrationId);
      
      const embed = new EmbedBuilder()
        .setTitle('✅ Bot Registered Successfully')
        .setDescription(`**${pending.name}** now has API access to invite data.`)
        .addFields(
          { name: 'Bot ID', value: pending.botId, inline: true },
          { name: 'API Key', value: `\`${apiKey}\``, inline: false }
        )
        .setColor(0x57F287)
        .setFooter({ text: 'Save this API key securely. It will not be shown again.' });
      
      await interaction.update({ embeds: [embed], components: [] });
    } catch (error) {
      logger.error(`Error confirming registration: ${error}`);
      await interaction.update({ content: 'Failed to register bot.', embeds: [], components: [] });
    }
  }
}

function generateApiKey(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = 'itb_';
  for (let i = 0; i < 32; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}