import { Client, Events, Interaction, ButtonInteraction, ChatInputCommandInteraction } from 'discord.js';
import { client } from '../bot.js';
import { execute as invitesExecute } from './invites.js';
import { execute as statsExecute } from './stats.js';
import { execute as syncExecute } from './sync.js';
import { execute as registerExecute, handleRegisterButton } from './register.js';
import { handlePaginationInteraction } from '../utils/components.js';
import { logger } from '../utils/logger.js';

const commands = new Map([
  ['invites', invitesExecute],
  ['stats', statsExecute],
  ['sync', syncExecute],
  ['register', registerExecute]
]);

client.on(Events.InteractionCreate, async (interaction: Interaction) => {
  if (interaction.isChatInputCommand()) {
    const command = commands.get(interaction.commandName);
    if (command) {
      try {
        await command(interaction);
      } catch (error) {
        logger.error(`Error executing command ${interaction.commandName}: ${error}`);
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp({ content: 'An error occurred while executing this command.', ephemeral: true });
        } else {
          await interaction.reply({ content: 'An error occurred while executing this command.', ephemeral: true });
        }
      }
    }
  } else if (interaction.isButton()) {
    if (interaction.customId.startsWith('pagination:')) {
      await handlePaginationInteraction(interaction);
    } else if (interaction.customId.startsWith('register:')) {
      await handleRegisterButton(interaction);
    }
  }
});

export { commands };