import { Router, type IRouter } from "express";
import { db, inviteStatsTable, memberJoinsTable } from "@workspace/db";
import { eq, and, desc, count, sql } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";
import { getAvatarUrl } from "../lib/discord-api";
import {
  GetLeaderboardParams,
  GetLeaderboardQueryParams,
  GetGuildStatsParams,
  GetGuildMembersParams,
  GetGuildMembersQueryParams,
  GetUserInviteStatsParams,
  AdjustBonusInvitesParams,
  AdjustBonusInvitesBody,
  ResetUserInvitesParams,
  ResetUserInvitesBody,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/guilds/:guildId/leaderboard", requireAuth, async (req, res): Promise<void> => {
  const params = GetLeaderboardParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const query = GetLeaderboardQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  const page = query.data.page ?? 1;
  const limit = query.data.limit ?? 10;
  const offset = (page - 1) * limit;

  const entries = await db
    .select()
    .from(inviteStatsTable)
    .where(eq(inviteStatsTable.guildId, params.data.guildId))
    .orderBy(
      desc(
        sql`(${inviteStatsTable.regular} + ${inviteStatsTable.bonus} - ${inviteStatsTable.fake} - ${inviteStatsTable.leftCount})`,
      ),
    )
    .limit(limit)
    .offset(offset);

  const [totalResult] = await db
    .select({ count: count() })
    .from(inviteStatsTable)
    .where(eq(inviteStatsTable.guildId, params.data.guildId));

  const leaderboard = entries.map((e, i) => ({
    rank: offset + i + 1,
    userId: e.userId,
    username: e.username,
    avatar: e.avatar,
    avatarUrl: getAvatarUrl(e.userId, e.avatar),
    regular: e.regular,
    bonus: e.bonus,
    fake: e.fake,
    left: e.leftCount,
    total: e.regular + e.bonus - e.fake - e.leftCount,
  }));

  res.json({
    entries: leaderboard,
    total: totalResult?.count ?? 0,
    page,
    limit,
  });
});

router.get("/guilds/:guildId/stats", requireAuth, async (req, res): Promise<void> => {
  const params = GetGuildStatsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const guildId = params.data.guildId;

  const [joins, leaves, fakes, topInviterRow] = await Promise.all([
    db
      .select({ count: count() })
      .from(memberJoinsTable)
      .where(eq(memberJoinsTable.guildId, guildId)),
    db
      .select({ count: count() })
      .from(memberJoinsTable)
      .where(and(eq(memberJoinsTable.guildId, guildId), sql`${memberJoinsTable.leftAt} IS NOT NULL`)),
    db
      .select({ count: count() })
      .from(memberJoinsTable)
      .where(and(eq(memberJoinsTable.guildId, guildId), eq(memberJoinsTable.isFake, true))),
    db
      .select({
        username: inviteStatsTable.username,
        total: sql<number>`(${inviteStatsTable.regular} + ${inviteStatsTable.bonus} - ${inviteStatsTable.fake} - ${inviteStatsTable.leftCount})`,
      })
      .from(inviteStatsTable)
      .where(eq(inviteStatsTable.guildId, guildId))
      .orderBy(
        desc(
          sql`(${inviteStatsTable.regular} + ${inviteStatsTable.bonus} - ${inviteStatsTable.fake} - ${inviteStatsTable.leftCount})`,
        ),
      )
      .limit(1),
  ]);

  const totalJoins = joins[0]?.count ?? 0;
  const totalLeaves = leaves[0]?.count ?? 0;
  const totalFake = fakes[0]?.count ?? 0;

  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return d.toISOString().split("T")[0];
  });

  const trendRows = await db
    .select({
      date: sql<string>`DATE(${memberJoinsTable.joinedAt})`,
      type: memberJoinsTable.leftAt,
    })
    .from(memberJoinsTable)
    .where(
      and(
        eq(memberJoinsTable.guildId, guildId),
        sql`${memberJoinsTable.joinedAt} >= NOW() - INTERVAL '7 days'`,
      ),
    );

  const trendMap = new Map<string, { joins: number; leaves: number }>();
  for (const date of last7Days) {
    trendMap.set(date, { joins: 0, leaves: 0 });
  }
  for (const row of trendRows) {
    const key = row.date;
    const entry = trendMap.get(key);
    if (entry) {
      entry.joins++;
      if (row.type !== null) entry.leaves++;
    }
  }

  const joinsTrend = last7Days.map((date) => ({
    date,
    joins: trendMap.get(date)?.joins ?? 0,
    leaves: trendMap.get(date)?.leaves ?? 0,
  }));

  const recentJoins = await db
    .select()
    .from(memberJoinsTable)
    .where(eq(memberJoinsTable.guildId, guildId))
    .orderBy(desc(memberJoinsTable.joinedAt))
    .limit(10);

  const recentActivity = recentJoins.map((m) => ({
    type: m.leftAt ? "leave" : "join",
    userId: m.userId,
    username: m.username,
    inviterId: m.inviterId,
    inviterName: m.inviterName,
    timestamp: (m.leftAt ?? m.joinedAt).toISOString(),
    isFake: m.isFake,
  }));

  res.json({
    totalJoins,
    totalLeaves,
    totalFake,
    netGrowth: totalJoins - totalLeaves,
    topInviter: topInviterRow[0]?.username ?? null,
    topInviterCount: topInviterRow[0]?.total ?? null,
    joinsTrend,
    recentActivity,
  });
});

router.get("/guilds/:guildId/members", requireAuth, async (req, res): Promise<void> => {
  const params = GetGuildMembersParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const query = GetGuildMembersQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  const page = query.data.page ?? 1;
  const limit = query.data.limit ?? 20;
  const offset = (page - 1) * limit;

  const [members, totalResult] = await Promise.all([
    db
      .select()
      .from(memberJoinsTable)
      .where(eq(memberJoinsTable.guildId, params.data.guildId))
      .orderBy(desc(memberJoinsTable.joinedAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: count() })
      .from(memberJoinsTable)
      .where(eq(memberJoinsTable.guildId, params.data.guildId)),
  ]);

  res.json({
    members: members.map((m) => ({
      id: m.id,
      userId: m.userId,
      username: m.username,
      avatar: m.avatar,
      inviterId: m.inviterId,
      inviterName: m.inviterName,
      inviteCode: m.inviteCode,
      joinedAt: m.joinedAt.toISOString(),
      leftAt: m.leftAt?.toISOString() ?? null,
      isFake: m.isFake,
      accountAgeDays: m.accountAgeDays,
    })),
    total: totalResult[0]?.count ?? 0,
    page,
    limit,
  });
});

router.get("/guilds/:guildId/invites/user/:userId", requireAuth, async (req, res): Promise<void> => {
  const params = GetUserInviteStatsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [stats] = await db
    .select()
    .from(inviteStatsTable)
    .where(
      and(
        eq(inviteStatsTable.guildId, params.data.guildId),
        eq(inviteStatsTable.userId, params.data.userId),
      ),
    );

  const invitedMembers = await db
    .select()
    .from(memberJoinsTable)
    .where(
      and(
        eq(memberJoinsTable.guildId, params.data.guildId),
        eq(memberJoinsTable.inviterId, params.data.userId),
      ),
    )
    .orderBy(desc(memberJoinsTable.joinedAt))
    .limit(20);

  const allStats = await db
    .select()
    .from(inviteStatsTable)
    .where(eq(inviteStatsTable.guildId, params.data.guildId))
    .orderBy(
      desc(
        sql`(${inviteStatsTable.regular} + ${inviteStatsTable.bonus} - ${inviteStatsTable.fake} - ${inviteStatsTable.leftCount})`,
      ),
    );

  const rank = allStats.findIndex((s) => s.userId === params.data.userId) + 1;

  res.json({
    userId: params.data.userId,
    username: stats?.username ?? "Unknown",
    avatar: stats?.avatar ?? null,
    regular: stats?.regular ?? 0,
    bonus: stats?.bonus ?? 0,
    fake: stats?.fake ?? 0,
    left: stats?.leftCount ?? 0,
    total: stats ? stats.regular + stats.bonus - stats.fake - stats.leftCount : 0,
    rank: rank > 0 ? rank : null,
    invitedMembers: invitedMembers.map((m) => ({
      id: m.id,
      userId: m.userId,
      username: m.username,
      avatar: m.avatar,
      inviterId: m.inviterId,
      inviterName: m.inviterName,
      inviteCode: m.inviteCode,
      joinedAt: m.joinedAt.toISOString(),
      leftAt: m.leftAt?.toISOString() ?? null,
      isFake: m.isFake,
      accountAgeDays: m.accountAgeDays,
    })),
  });
});

router.post("/guilds/:guildId/invites/bonus", requireAuth, async (req, res): Promise<void> => {
  const params = AdjustBonusInvitesParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const body = AdjustBonusInvitesBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const existing = await db
    .select()
    .from(inviteStatsTable)
    .where(
      and(
        eq(inviteStatsTable.guildId, params.data.guildId),
        eq(inviteStatsTable.userId, body.data.userId),
      ),
    );

  let updated;
  if (existing.length === 0) {
    [updated] = await db
      .insert(inviteStatsTable)
      .values({
        guildId: params.data.guildId,
        userId: body.data.userId,
        username: "Unknown",
        bonus: Math.max(0, body.data.amount),
      })
      .returning();
  } else {
    [updated] = await db
      .update(inviteStatsTable)
      .set({
        bonus: sql`GREATEST(0, ${inviteStatsTable.bonus} + ${body.data.amount})`,
      })
      .where(
        and(
          eq(inviteStatsTable.guildId, params.data.guildId),
          eq(inviteStatsTable.userId, body.data.userId),
        ),
      )
      .returning();
  }

  res.json({
    userId: updated.userId,
    username: updated.username,
    avatar: updated.avatar,
    regular: updated.regular,
    bonus: updated.bonus,
    fake: updated.fake,
    left: updated.leftCount,
    total: updated.regular + updated.bonus - updated.fake - updated.leftCount,
    rank: null,
    invitedMembers: [],
  });
});

router.post("/guilds/:guildId/invites/reset", requireAuth, async (req, res): Promise<void> => {
  const params = ResetUserInvitesParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const body = ResetUserInvitesBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const updates: Partial<typeof inviteStatsTable.$inferInsert> = {};
  if (body.data.type === "all" || body.data.type === "regular") updates.regular = 0;
  if (body.data.type === "all" || body.data.type === "bonus") updates.bonus = 0;
  if (body.data.type === "all" || body.data.type === "fake") updates.fake = 0;
  if (body.data.type === "all" || body.data.type === "left") updates.leftCount = 0;

  await db
    .update(inviteStatsTable)
    .set(updates)
    .where(
      and(
        eq(inviteStatsTable.guildId, params.data.guildId),
        eq(inviteStatsTable.userId, body.data.userId),
      ),
    );

  res.json({ success: true, message: `Invites reset for user ${body.data.userId}` });
});

export default router;
