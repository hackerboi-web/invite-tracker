import { pgTable, text, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const guildsTable = pgTable("guilds", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  icon: text("icon"),
  joinMessage: text("join_message"),
  leaveMessage: text("leave_message"),
  joinChannelId: text("join_channel_id"),
  leaveChannelId: text("leave_channel_id"),
  fakeThreshold: integer("fake_threshold").notNull().default(7),
  trackFakeInvites: boolean("track_fake_invites").notNull().default(true),
  trackLeaves: boolean("track_leaves").notNull().default(true),
  embedColor: text("embed_color"),
  embedImage: text("embed_image"),
  premiumTier: integer("premium_tier").notNull().default(0),
  premiumExpiresAt: timestamp("premium_expires_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertGuildSchema = createInsertSchema(guildsTable).omit({ createdAt: true, updatedAt: true });
export type InsertGuild = z.infer<typeof insertGuildSchema>;
export type Guild = typeof guildsTable.$inferSelect;
