import { Router, type IRouter } from "express";
import { db, guildsTable, inviteStatsTable } from "@workspace/db";
import { eq, and, count } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";
import { getUserGuilds, getBotGuilds, getGuildIconUrl, hasManageGuild } from "../lib/discord-api";
import {
  GetGuildParams,
  GetGuildSettingsParams,
  UpdateGuildSettingsParams,
  UpdateGuildSettingsBody,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/guilds", requireAuth, async (req, res): Promise<void> => {
  const accessToken = req.session.accessToken!;

  const [userGuilds, botGuilds] = await Promise.all([
    getUserGuilds(accessToken),
    getBotGuilds().catch(() => [] as typeof botGuilds),
  ]);

  const botGuildIds = new Set(botGuilds.map((g) => g.id));

  const dbGuilds = await db.select().from(guildsTable);
  const dbGuildMap = new Map(dbGuilds.map((g) => [g.id, g]));

  const guilds = userGuilds
    .filter((g) => botGuildIds.has(g.id))
    .map((g) => ({
      id: g.id,
      name: g.name,
      icon: g.icon,
      iconUrl: getGuildIconUrl(g.id, g.icon),
      premiumTier: dbGuildMap.get(g.id)?.premiumTier ?? 0,
      memberCount: g.approximate_member_count ?? null,
      isAdmin: hasManageGuild(g.permissions),
    }));

  res.json(guilds);
});

router.get("/guilds/:guildId", requireAuth, async (req, res): Promise<void> => {
  const params = GetGuildParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [guild] = await db
    .select()
    .from(guildsTable)
    .where(eq(guildsTable.id, params.data.guildId));

  if (!guild) {
    res.status(404).json({ error: "Guild not found or bot not in server" });
    return;
  }

  const [inviterCountResult] = await db
    .select({ count: count() })
    .from(inviteStatsTable)
    .where(eq(inviteStatsTable.guildId, params.data.guildId));

  const [totalInvitesResult] = await db
    .select({ total: count() })
    .from(inviteStatsTable)
    .where(eq(inviteStatsTable.guildId, params.data.guildId));

  res.json({
    id: guild.id,
    name: guild.name,
    icon: guild.icon,
    iconUrl: getGuildIconUrl(guild.id, guild.icon),
    premiumTier: guild.premiumTier,
    memberCount: null,
    isAdmin: true,
    totalInvites: totalInvitesResult?.total ?? 0,
    totalMembers: inviterCountResult?.count ?? 0,
    activeTrackers: inviterCountResult?.count ?? 0,
  });
});

router.get("/guilds/:guildId/settings", requireAuth, async (req, res): Promise<void> => {
  const params = GetGuildSettingsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [guild] = await db
    .select()
    .from(guildsTable)
    .where(eq(guildsTable.id, params.data.guildId));

  if (!guild) {
    res.status(404).json({ error: "Guild not found" });
    return;
  }

  res.json({
    guildId: guild.id,
    joinMessage: guild.joinMessage,
    leaveMessage: guild.leaveMessage,
    joinChannelId: guild.joinChannelId,
    leaveChannelId: guild.leaveChannelId,
    fakeThreshold: guild.fakeThreshold,
    trackFakeInvites: guild.trackFakeInvites,
    trackLeaves: guild.trackLeaves,
    embedColor: guild.embedColor,
    embedImage: guild.embedImage,
  });
});

router.put("/guilds/:guildId/settings", requireAuth, async (req, res): Promise<void> => {
  const params = UpdateGuildSettingsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const body = UpdateGuildSettingsBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const [guild] = await db
    .select()
    .from(guildsTable)
    .where(eq(guildsTable.id, params.data.guildId));

  if (!guild) {
    res.status(404).json({ error: "Guild not found" });
    return;
  }

  const updates: Partial<typeof guildsTable.$inferInsert> = {};
  if (body.data.joinMessage !== undefined) updates.joinMessage = body.data.joinMessage;
  if (body.data.leaveMessage !== undefined) updates.leaveMessage = body.data.leaveMessage;
  if (body.data.joinChannelId !== undefined) updates.joinChannelId = body.data.joinChannelId;
  if (body.data.leaveChannelId !== undefined) updates.leaveChannelId = body.data.leaveChannelId;
  if (body.data.fakeThreshold !== undefined && body.data.fakeThreshold !== null) {
    updates.fakeThreshold = body.data.fakeThreshold;
  }
  if (body.data.trackFakeInvites !== undefined && body.data.trackFakeInvites !== null) {
    updates.trackFakeInvites = body.data.trackFakeInvites;
  }
  if (body.data.trackLeaves !== undefined && body.data.trackLeaves !== null) {
    updates.trackLeaves = body.data.trackLeaves;
  }
  if (body.data.embedColor !== undefined) updates.embedColor = body.data.embedColor;
  if (body.data.embedImage !== undefined) updates.embedImage = body.data.embedImage;

  const [updated] = await db
    .update(guildsTable)
    .set(updates)
    .where(eq(guildsTable.id, params.data.guildId))
    .returning();

  res.json({
    guildId: updated.id,
    joinMessage: updated.joinMessage,
    leaveMessage: updated.leaveMessage,
    joinChannelId: updated.joinChannelId,
    leaveChannelId: updated.leaveChannelId,
    fakeThreshold: updated.fakeThreshold,
    trackFakeInvites: updated.trackFakeInvites,
    trackLeaves: updated.trackLeaves,
    embedColor: updated.embedColor,
    embedImage: updated.embedImage,
  });
});

export default router;
