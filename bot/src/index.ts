import { startBot } from './bot.js';
import { startPublicAPI } from './endpoints/public-api.js';
import { startInternalAPI } from './endpoints/internal-api.js';
import { logger } from './utils/logger.js';
import { validateConfig } from './config.js';

async function main(): Promise<void> {
  try {
    validateConfig();
    logger.info('Starting Invite Tracker Bot...');
    
    await startBot();
    logger.info('Discord bot connected');
    
    await startPublicAPI();
    logger.info('Public API started');
    
    await startInternalAPI();
    logger.info('Internal API started');
    
    logger.info('All services started successfully');
  } catch (error) {
    logger.error(`Failed to start: ${error}`);
    process.exit(1);
  }
}

process.on('unhandledRejection', (reason) => {
  logger.error(`Unhandled rejection: ${reason}`);
});

process.on('uncaughtException', (error) => {
  logger.error(`Uncaught exception: ${error}`);
  process.exit(1);
});

main();