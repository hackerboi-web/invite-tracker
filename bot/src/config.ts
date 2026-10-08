import dotenv from 'dotenv';
dotenv.config();

export const config = {
  discord: {
    token: process.env.DISCORD_TOKEN || '',
    clientId: process.env.DISCORD_CLIENT_ID || '',
    clientSecret: process.env.DISCORD_CLIENT_SECRET || ''
  },
  supabase: {
    url: process.env.SUPABASE_URL || '',
    serviceKey: process.env.SUPABASE_SERVICE_KEY || ''
  },
  api: {
    port: parseInt(process.env.BOT_PORT || '3001', 10),
    internalKey: process.env.INTERNAL_API_KEY || '',
    secret: process.env.API_SECRET || ''
  },
  dashboard: {
    url: process.env.DASHBOARD_URL || 'http://localhost:5000'
  },
  env: process.env.NODE_ENV || 'development'
};

export function validateConfig(): void {
  const required = [
    { key: 'DISCORD_TOKEN', value: config.discord.token },
    { key: 'DISCORD_CLIENT_ID', value: config.discord.clientId },
    { key: 'SUPABASE_URL', value: config.supabase.url },
    { key: 'SUPABASE_SERVICE_KEY', value: config.supabase.serviceKey },
    { key: 'INTERNAL_API_KEY', value: config.api.internalKey }
  ];

  const missing = required.filter(r => !r.value);
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.map(m => m.key).join(', ')}`);
  }
}