import express, { Request, Response } from 'express';
import { config } from '../config.js';
import { db } from '../database/client.js';
import { logger } from '../utils/logger.js';
import { z } from 'zod';

const app = express();
app.use(express.json());

function verifyInternalKey(req: Request, res: Response, next: () => void): Response | void {
  const apiKey = req.headers['x-internal-api-key'] as string;
  if (apiKey !== config.api.internalKey) {
    return res.status(403).json({ status: 'error', message: 'Invalid internal API key' });
  }
  next();
}

app.use(verifyInternalKey);

const guildParamsSchema = z.object({
  guildId: z.string().regex(/^\d{17,20}$/)
});

app.get('/api/internal/guilds', async (req: Request, res: Response) => {
  try {
    const guilds = (await import('../bot.js')).client.guilds.cache.map(g => ({
      id: g.id,
      name: g.name,
      icon: g.icon,
      memberCount: g.memberCount,
      ownerId: g.ownerId
    }));
    
    return res.json({ status: 'success', data: guilds });
  } catch (error) {
    logger.error(`Internal API /guilds error: ${error}`);
    return res.status(500).json({ status: 'error', message: 'Internal server error' });
  }
});

app.get('/api/internal/guilds/:guildId', async (req: Request, res: Response) => {
  try {
    const parseResult = guildParamsSchema.safeParse({ guildId: req.params.guildId });
    if (!parseResult.success) {
      return res.status(400).json({ status: 'error', message: 'Invalid guild ID' });
    }
    
    const { guildId } = parseResult.data;
    const [invites, stats, joinEvents] = await Promise.all([
      db.invites.getByGuild(guildId),
      db.guildStats.get(guildId),
      db.joinEvents.getByGuild(guildId, undefined, undefined, 50)
    ]);
    
    return res.json({
      status: 'success',
      data: {
        invites,
        stats,
        recentJoins: joinEvents
      }
    });
  } catch (error) {
    logger.error(`Internal API /guilds/:id error: ${error}`);
    return res.status(500).json({ status: 'error', message: 'Internal server error' });
  }
});

app.get('/api/internal/guilds/:guildId/invites', async (req: Request, res: Response) => {
  try {
    const parseResult = guildParamsSchema.safeParse({ guildId: req.params.guildId });
    if (!parseResult.success) {
      return res.status(400).json({ status: 'error', message: 'Invalid guild ID' });
    }
    
    const { guildId } = parseResult.data;
    const invites = await db.invites.getByGuild(guildId);
    return res.json({ status: 'success', data: invites });
  } catch (error) {
    logger.error(`Internal API /guilds/:id/invites error: ${error}`);
    return res.status(500).json({ status: 'error', message: 'Internal server error' });
  }
});

app.get('/api/internal/guilds/:guildId/join-events', async (req: Request, res: Response) => {
  try {
    const parseResult = guildParamsSchema.safeParse({ guildId: req.params.guildId });
    if (!parseResult.success) {
      return res.status(400).json({ status: 'error', message: 'Invalid guild ID' });
    }
    
    const { guildId } = parseResult.data;
    const startTime = req.query.start as string | undefined;
    const endTime = req.query.end as string | undefined;
    const limit = parseInt(req.query.limit as string || '100', 10);
    
    const events = await db.joinEvents.getByGuild(guildId, startTime, endTime, limit);
    return res.json({ status: 'success', data: events });
  } catch (error) {
    logger.error(`Internal API /guilds/:id/join-events error: ${error}`);
    return res.status(500).json({ status: 'error', message: 'Internal server error' });
  }
});

app.get('/api/internal/guilds/:guildId/stats', async (req: Request, res: Response) => {
  try {
    const parseResult = guildParamsSchema.safeParse({ guildId: req.params.guildId });
    if (!parseResult.success) {
      return res.status(400).json({ status: 'error', message: 'Invalid guild ID' });
    }
    
    const { guildId } = parseResult.data;
    const stats = await db.guildStats.get(guildId);
    return res.json({ status: 'success', data: stats });
  } catch (error) {
    logger.error(`Internal API /guilds/:id/stats error: ${error}`);
    return res.status(500).json({ status: 'error', message: 'Internal server error' });
  }
});

app.get('/api/internal/registered-bots', async (req: Request, res: Response) => {
  try {
    const bots = await db.registeredBots.list();
    return res.json({ status: 'success', data: bots });
  } catch (error) {
    logger.error(`Internal API /registered-bots error: ${error}`);
    return res.status(500).json({ status: 'error', message: 'Internal server error' });
  }
});

app.post('/api/internal/registered-bots', async (req: Request, res: Response) => {
  try {
    const schema = z.object({
      name: z.string().min(1).max(100),
      botId: z.string().regex(/^\d{17,20}$/),
      permissions: z.array(z.string()).default(['read_invites'])
    });
    
    const parseResult = schema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ status: 'error', message: 'Invalid request' });
    }
    
    const { name, botId, permissions } = parseResult.data;
    const apiKey = generateApiKey();
    
    const bot = await db.registeredBots.create({
      name,
      bot_id: botId,
      api_key: apiKey,
      permissions
    });
    
    return res.json({ status: 'success', data: { ...bot, api_key: apiKey } });
  } catch (error) {
    logger.error(`Internal API POST /registered-bots error: ${error}`);
    return res.status(500).json({ status: 'error', message: 'Internal server error' });
  }
});

app.delete('/api/internal/registered-bots/:apiKey', async (req: Request, res: Response) => {
  try {
    const { apiKey } = req.params;
    await db.registeredBots.revoke(apiKey);
    return res.json({ status: 'success', message: 'Bot access revoked' });
  } catch (error) {
    logger.error(`Internal API DELETE /registered-bots error: ${error}`);
    return res.status(500).json({ status: 'error', message: 'Internal server error' });
  }
});

function generateApiKey(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = 'itb_';
  for (let i = 0; i < 32; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export async function startInternalAPI(): Promise<void> {
  const port = config.api.port + 1;
  
  const server = app.listen(port, () => {
    logger.info(`Internal API listening on port ${port}`);
  });
  
  process.on('SIGTERM', () => server.close());
  process.on('SIGINT', () => server.close());
}