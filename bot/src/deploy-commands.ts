import { REST, Routes } from 'discord.js';
import { config } from './config.js';

const commandData = [
  {
    name: 'invites',
    description: 'View invite leaderboard and statistics for this server',
    default_member_permissions: '0x20',
    options: [
      { name: 'leaderboard', description: 'Show the invite leaderboard', type: 1 },
      { name: 'joins', description: 'Show recent join events', type: 1 }
    ]
  },
  {
    name: 'stats',
    description: 'View invite statistics for this server',
    default_member_permissions: '0x20'
  },
  {
    name: 'sync',
    description: 'Force sync invites with Discord',
    default_member_permissions: '0x8',
    options: [
      { name: 'invites', description: 'Sync all invites for this server', type: 1 },
      { name: 'stats', description: 'Recalculate statistics for this server', type: 1 }
    ]
  },
  {
    name: 'register',
    description: 'Register a bot for API access to this server\'s invite data',
    default_member_permissions: '0x8',
    options: [
      {
        name: 'bot',
        description: 'Register a bot by ID',
        type: 1,
        options: [
          { name: 'bot_id', description: 'The Discord user ID of the bot to register', type: 3, required: true },
          { name: 'name', description: 'A name for this bot registration', type: 3, required: true }
        ]
      },
      { name: 'list', description: 'List registered bots for this server', type: 1 },
      { name: 'revoke', description: 'Revoke API access for a registered bot', type: 1, options: [
        { name: 'api_key', description: 'The API key to revoke', type: 3, required: true }
      ]}
    ]
  }
];

async function deployCommands(): Promise<void> {
  if (!config.discord.token || !config.discord.clientId) {
    throw new Error('Missing Discord token or client ID');
  }
  
  const rest = new REST({ version: '10' }).setToken(config.discord.token);
  
  try {
    console.log('Started refreshing application (/) commands...');
    
    await rest.put(Routes.applicationCommands(config.discord.clientId), { body: commandData });
    
    console.log('Successfully reloaded application (/) commands.');
  } catch (error) {
    console.error('Error deploying commands:', error);
    throw error;
  }
}

deployCommands().catch(console.error);