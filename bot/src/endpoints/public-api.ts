import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { config } from '../config.js';
import { db } from '../database/client.js';
import { logger } from '../utils/logger.js';
import { z } from 'zod';

const app = express();

app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' }
}));
app.use(cors({
  origin: config.dashboard.url,
  credentials: true
}));
app.use(express.json());

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  message: { status: 'error', message: 'Too many requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => req.body?.api_key || req.ip || 'unknown'
});

const publicAPIRequestSchema = z.object({
  api_key: z.string().min(1),
  guild_id: z.string().regex(/^\d{17,20}$/),
  start_time: z.string().datetime().optional(),
  end_time: z.string().datetime().optional(),
  limit: z.number().int().min(1).max(500).optional().default(100)
});

async function verifyApiKey(apiKey: string, guildId: string): Promise<boolean> {
  const bot = await db.registeredBots.getByApiKey(apiKey);
  if (!bot) return false;
  
  const guild = await (await import('../bot.js')).client.guilds.fetch(guildId).catch(() => null);
  if (!guild) return false;
  
  const member = await guild.members.fetch(bot.bot_id).catch(() => null);
  return member !== null;
}

export async function startPublicAPI(): Promise<void> {
  app.post('/api/v1/invites', apiLimiter, async (req: Request, res: Response) => {
    const startTime = Date.now();
    
    try {
      const parseResult = publicAPIRequestSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({
          status: 'error',
          message: 'Invalid request format',
          errors: parseResult.error.flatten().fieldErrors
        });
      }
      
      const { api_key, guild_id, start_time, end_time, limit } = parseResult.data;
      
      const authorized = await verifyApiKey(api_key, guild_id);
      if (!authorized) {
        return res.status(403).json({
          status: 'error',
          message: 'Invalid API key or bot not in guild'
        });
      }
      
      const [invites, joinEvents] = await Promise.all([
        db.invites.getByGuild(guild_id),
        db.joinEvents.getByGuild(guild_id, start_time, end_time, limit)
      ]);
      
      const publicInvites = invites.map(invite => ({
        code: invite.code,
        creator_id: invite.creator_id || 'unknown',
        creator_tag: invite.creator_tag || 'Unknown',
        uses: invite.uses,
        max_uses: invite.max_uses,
        created_at: invite.created_at,
        expires_at: invite.expires_at,
        temporary: invite.temporary,
        type: invite.invite_type
      }));
      
      const publicJoinEvents = joinEvents.map(event => ({
        user_id: event.user_id,
        username: event.username,
        invite_code: event.invite_code,
        inviter_id: event.inviter_id,
        inviter_tag: event.inviter_tag,
        joined_at: event.joined_at
      }));
      
      const duration = Date.now() - startTime;
      logger.debug(`API request completed in ${duration}ms for guild ${guild_id}`);
      
      return res.json({
        status: 'success',
        guild_id,
        invites: publicInvites,
        join_events: publicJoinEvents
      });
      
    } catch (error) {
      logger.error(`Public API error: ${error}`);
      return res.status(500).json({
        status: 'error',
        message: 'Internal server error'
      });
    }
  });
  
  app.get('/api/v1/health', (req: Request, res: Response) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });
  
  const server = app.listen(config.api.port, () => {
    logger.info(`Public API listening on port ${config.api.port}`);
  });
  
  process.on('SIGTERM', () => server.close());
  process.on('SIGINT', () => server.close());
}