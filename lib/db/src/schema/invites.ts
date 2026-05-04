import { pgTable, text, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const inviteCodesTable = pgTable("invite_codes", {
  guildId: text("guild_id").notNull(),
  code: text("code").notNull(),
  inviterId: text("inviter_id"),
  uses: integer("uses").notNull().default(0),
  maxUses: integer("max_uses"),
  isVanity: boolean("is_vanity").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
});

export const insertInviteCodeSchema = createInsertSchema(inviteCodesTable);
export type InsertInviteCode = z.infer<typeof insertInviteCodeSchema>;
export type InviteCode = typeof inviteCodesTable.$inferSelect;

export const memberJoinsTable = pgTable("member_joins", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  guildId: text("guild_id").notNull(),
  userId: text("user_id").notNull(),
  username: text("username").notNull(),
  avatar: text("avatar"),
  inviterId: text("inviter_id"),
  inviterName: text("inviter_name"),
  inviteCode: text("invite_code"),
  joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
  leftAt: timestamp("left_at", { withTimezone: true }),
  isFake: boolean("is_fake").notNull().default(false),
  accountAgeDays: integer("account_age_days"),
});

export const insertMemberJoinSchema = createInsertSchema(memberJoinsTable);
export type InsertMemberJoin = z.infer<typeof insertMemberJoinSchema>;
export type MemberJoin = typeof memberJoinsTable.$inferSelect;

export const inviteStatsTable = pgTable("invite_stats", {
  guildId: text("guild_id").notNull(),
  userId: text("user_id").notNull(),
  username: text("username").notNull(),
  avatar: text("avatar"),
  regular: integer("regular").notNull().default(0),
  leftCount: integer("left_count").notNull().default(0),
  fake: integer("fake").notNull().default(0),
  bonus: integer("bonus").notNull().default(0),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertInviteStatsSchema = createInsertSchema(inviteStatsTable);
export type InsertInviteStats = z.infer<typeof insertInviteStatsSchema>;
export type InviteStats = typeof inviteStatsTable.$inferSelect;
