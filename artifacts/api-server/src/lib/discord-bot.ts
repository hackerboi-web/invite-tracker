import {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
  EmbedBuilder,
  type Interaction,
  type GuildMember,
  PermissionFlagsBits,
  type Invite,
  Collection,
} from "discord.js";
import { db, guildsTable, inviteStatsTable, memberJoinsTable, inviteCodesTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { logger } from "./logger";

export const discordClient = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildInvites,
    GatewayIntentBits.GuildMessages,
  ],
});

const inviteCache = new Collection<string, Collection<string, Invite>>();

const COMMANDS = [
  new SlashCommandBuilder()
    .setName("invites")
    .setDescription("Check your invite count or another user's")
    .addUserOption((o) => o.setName("user").setDescription("The user to check").setRequired(false)),

  new SlashCommandBuilder()
    .setName("leaderboard")
    .setDescription("Show the server invite leaderboard")
    .addIntegerOption((o) =>
      o.setName("page").setDescription("Page number").setMinValue(1).setRequired(false),
    ),

  new SlashCommandBuilder()
    .setName("inviteinfo")
    .setDescription("Get info about an invite code")
    .addStringOption((o) => o.setName("code").setDescription("Invite code").setRequired(true)),

  new SlashCommandBuilder()
    .setName("fake")
    .setDescription("Show fake invite stats for a user")
    .addUserOption((o) => o.setName("user").setDescription("The user to check").setRequired(false)),

  new SlashCommandBuilder()
    .setName("leaves")
    .setDescription("Show users who left the server and who invited them"),

  new SlashCommandBuilder()
    .setName("rank")
    .setDescription("Show your current rank on the leaderboard"),

  new SlashCommandBuilder()
    .setName("stats")
    .setDescription("Show overall server invite statistics"),

  new SlashCommandBuilder()
    .setName("bonus")
    .setDescription("Add or remove bonus invites for a user (Admin only)")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addUserOption((o) => o.setName("user").setDescription("Target user").setRequired(true))
    .addIntegerOption((o) =>
      o.setName("amount").setDescription("Amount to add (negative to remove)").setRequired(true),
    )
    .addStringOption((o) =>
      o.setName("reason").setDescription("Reason for adjustment").setRequired(false),
    ),

  new SlashCommandBuilder()
    .setName("reset")
    .setDescription("Reset a user's invites (Admin only)")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addUserOption((o) => o.setName("user").setDescription("Target user").setRequired(true))
    .addStringOption((o) =>
      o
        .setName("type")
        .setDescription("What to reset")
        .setRequired(false)
        .addChoices(
          { name: "All", value: "all" },
          { name: "Regular", value: "regular" },
          { name: "Bonus", value: "bonus" },
          { name: "Fake", value: "fake" },
          { name: "Left", value: "left" },
        ),
    ),

  new SlashCommandBuilder()
    .setName("setup")
    .setDescription("Initial bot setup for this server (Admin only)")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  new SlashCommandBuilder()
    .setName("config")
    .setDescription("Configure bot settings (Admin only)")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addStringOption((o) =>
      o
        .setName("setting")
        .setDescription("Setting to configure")
        .setRequired(true)
        .addChoices(
          { name: "Join Message", value: "join_message" },
          { name: "Leave Message", value: "leave_message" },
          { name: "Fake Threshold (days)", value: "fake_threshold" },
        ),
    )
    .addStringOption((o) =>
      o.setName("value").setDescription("New value").setRequired(true),
    ),

  new SlashCommandBuilder()
    .setName("premium")
    .setDescription("Check premium status for this server"),
];

async function getOrCreateGuild(guildId: string, guildName: string, guildIcon?: string | null) {
  const existing = await db.select().from(guildsTable).where(eq(guildsTable.id, guildId));
  if (existing.length > 0) return existing[0];

  const [guild] = await db
    .insert(guildsTable)
    .values({ id: guildId, name: guildName, icon: guildIcon ?? null })
    .returning();
  return guild;
}

async function getOrCreateStats(guildId: string, userId: string, username: string, avatar?: string | null) {
  const existing = await db
    .select()
    .from(inviteStatsTable)
    .where(and(eq(inviteStatsTable.guildId, guildId), eq(inviteStatsTable.userId, userId)));

  if (existing.length > 0) return existing[0];

  const [stats] = await db
    .insert(inviteStatsTable)
    .values({ guildId, userId, username, avatar: avatar ?? null })
    .returning();
  return stats;
}

function getTotalInvites(stats: typeof inviteStatsTable.$inferSelect) {
  return stats.regular + stats.bonus - stats.fake - stats.leftCount;
}

function getEmbedColor(guild: typeof guildsTable.$inferSelect | null): number {
  if (guild?.embedColor) {
    return parseInt(guild.embedColor.replace("#", ""), 16);
  }
  return 0x5865f2;
}

discordClient.once("ready", async () => {
  logger.info({ tag: discordClient.user?.tag }, "Discord bot logged in");

  if (!process.env.DISCORD_CLIENT_ID) {
    logger.warn("DISCORD_CLIENT_ID not set, skipping command registration");
    return;
  }

  const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN!);
  try {
    await rest.put(Routes.applicationCommands(process.env.DISCORD_CLIENT_ID), {
      body: COMMANDS.map((c) => c.toJSON()),
    });
    logger.info("Slash commands registered globally");
  } catch (err) {
    logger.error({ err }, "Failed to register slash commands");
  }

  for (const guild of discordClient.guilds.cache.values()) {
    try {
      const invites = await guild.invites.fetch();
      inviteCache.set(guild.id, invites as Collection<string, Invite>);
      await getOrCreateGuild(guild.id, guild.name, guild.icon);
      logger.info({ guildId: guild.id }, "Cached invites for guild");
    } catch (err) {
      logger.warn({ err, guildId: guild.id }, "Failed to cache invites for guild");
    }
  }
});

discordClient.on("guildCreate", async (guild) => {
  try {
    const invites = await guild.invites.fetch();
    inviteCache.set(guild.id, invites as Collection<string, Invite>);
    await getOrCreateGuild(guild.id, guild.name, guild.icon);
    logger.info({ guildId: guild.id }, "Bot joined new guild");
  } catch (err) {
    logger.warn({ err, guildId: guild.id }, "Failed to setup new guild");
  }
});

discordClient.on("guildDelete", (guild) => {
  inviteCache.delete(guild.id);
  logger.info({ guildId: guild.id }, "Bot removed from guild");
});

discordClient.on("inviteCreate", (invite) => {
  if (!invite.guild) return;
  const cached = inviteCache.get(invite.guild.id);
  if (cached) cached.set(invite.code, invite as Invite);
});

discordClient.on("inviteDelete", (invite) => {
  if (!invite.guild) return;
  const cached = inviteCache.get(invite.guild.id);
  if (cached) cached.delete(invite.code);
});

discordClient.on("guildMemberAdd", async (member: GuildMember) => {
  if (!member.guild) return;
  const guildId = member.guild.id;

  try {
    const guild = await getOrCreateGuild(guildId, member.guild.name, member.guild.icon);

    const newInvites = await member.guild.invites.fetch();
    const oldInvites = inviteCache.get(guildId) ?? new Collection<string, Invite>();

    let usedInvite: Invite | null = null;
    let inviterId: string | null = null;
    let inviterName: string | null = null;
    let inviteCode: string | null = null;

    for (const [code, invite] of newInvites.entries()) {
      const oldInvite = oldInvites.get(code);
      const oldUses = oldInvite?.uses ?? 0;
      const newUses = invite.uses ?? 0;
      if (newUses > oldUses) {
        usedInvite = invite as Invite;
        inviterId = invite.inviter?.id ?? null;
        inviterName = invite.inviter?.username ?? null;
        inviteCode = code;
        break;
      }
    }

    inviteCache.set(guildId, newInvites as Collection<string, Invite>);

    const accountCreated = member.user.createdAt;
    const accountAgeDays = Math.floor((Date.now() - accountCreated.getTime()) / (1000 * 60 * 60 * 24));
    const isFake = guild.trackFakeInvites && accountAgeDays < guild.fakeThreshold;

    await db.insert(memberJoinsTable).values({
      guildId,
      userId: member.id,
      username: member.user.username,
      avatar: member.user.avatar,
      inviterId,
      inviterName,
      inviteCode,
      isFake,
      accountAgeDays,
    });

    if (inviterId) {
      const inviterStats = await getOrCreateStats(
        guildId,
        inviterId,
        inviterName ?? "Unknown",
      );

      const update: Record<string, unknown> = {};
      if (isFake) {
        update.fake = inviterStats.fake + 1;
      } else {
        update.regular = inviterStats.regular + 1;
      }

      await db
        .update(inviteStatsTable)
        .set(update)
        .where(
          and(
            eq(inviteStatsTable.guildId, guildId),
            eq(inviteStatsTable.userId, inviterId),
          ),
        );
    }

    if (inviteCode) {
      await db
        .insert(inviteCodesTable)
        .values({
          guildId,
          code: inviteCode,
          inviterId,
          uses: usedInvite?.uses ?? 1,
        })
        .onConflictDoNothing();
    }

    if (guild.joinChannelId && guild.joinMessage) {
      const channel = member.guild.channels.cache.get(guild.joinChannelId);
      if (channel?.isTextBased()) {
        let message = guild.joinMessage
          .replace("{user}", `<@${member.id}>`)
          .replace("{username}", member.user.username)
          .replace("{server}", member.guild.name)
          .replace("{inviter}", inviterId ? `<@${inviterId}>` : "Unknown")
          .replace("{inviterName}", inviterName ?? "Unknown");

        if (inviterId) {
          const stats = await getOrCreateStats(guildId, inviterId, inviterName ?? "Unknown");
          const total = getTotalInvites(stats);
          message = message.replace("{count}", total.toString());
        }

        const embed = new EmbedBuilder()
          .setColor(getEmbedColor(guild))
          .setDescription(message)
          .setTimestamp();

        await channel.send({ embeds: [embed] });
      }
    }
  } catch (err) {
    logger.error({ err, guildId, userId: member.id }, "Error handling guildMemberAdd");
  }
});

discordClient.on("guildMemberRemove", async (member) => {
  if (!member.guild) return;
  const guildId = member.guild.id;

  try {
    const guild = await getOrCreateGuild(guildId, member.guild.name, member.guild.icon);

    if (!guild.trackLeaves) return;

    const joins = await db
      .select()
      .from(memberJoinsTable)
      .where(
        and(
          eq(memberJoinsTable.guildId, guildId),
          eq(memberJoinsTable.userId, member.id),
        ),
      );

    const lastJoin = joins.sort((a, b) => b.joinedAt.getTime() - a.joinedAt.getTime())[0];

    if (lastJoin) {
      await db
        .update(memberJoinsTable)
        .set({ leftAt: new Date() })
        .where(eq(memberJoinsTable.id, lastJoin.id));

      if (lastJoin.inviterId && !lastJoin.isFake) {
        const [inviterStats] = await db
          .select()
          .from(inviteStatsTable)
          .where(
            and(
              eq(inviteStatsTable.guildId, guildId),
              eq(inviteStatsTable.userId, lastJoin.inviterId),
            ),
          );

        if (inviterStats) {
          await db
            .update(inviteStatsTable)
            .set({ leftCount: inviterStats.leftCount + 1 })
            .where(
              and(
                eq(inviteStatsTable.guildId, guildId),
                eq(inviteStatsTable.userId, lastJoin.inviterId),
              ),
            );
        }
      }
    }

    if (guild.leaveChannelId && guild.leaveMessage) {
      const channel = member.guild.channels.cache.get(guild.leaveChannelId);
      if (channel?.isTextBased()) {
        const message = guild.leaveMessage
          .replace("{user}", `<@${member.id}>`)
          .replace("{username}", member.user?.username ?? "Unknown")
          .replace("{server}", member.guild.name)
          .replace("{inviter}", lastJoin?.inviterId ? `<@${lastJoin.inviterId}>` : "Unknown")
          .replace("{inviterName}", lastJoin?.inviterName ?? "Unknown");

        const embed = new EmbedBuilder()
          .setColor(0xff4444)
          .setDescription(message)
          .setTimestamp();

        await channel.send({ embeds: [embed] });
      }
    }
  } catch (err) {
    logger.error({ err, guildId, userId: member.id }, "Error handling guildMemberRemove");
  }
});

discordClient.on("interactionCreate", async (interaction: Interaction) => {
  if (!interaction.isChatInputCommand()) return;
  if (!interaction.guild) {
    await interaction.reply({ content: "This command can only be used in a server.", ephemeral: true });
    return;
  }

  const guildId = interaction.guild.id;
  const guild = await getOrCreateGuild(guildId, interaction.guild.name, interaction.guild.icon);
  const embedColor = getEmbedColor(guild);

  try {
    switch (interaction.commandName) {
      case "invites": {
        const targetUser = interaction.options.getUser("user") ?? interaction.user;
        const stats = await getOrCreateStats(guildId, targetUser.id, targetUser.username, targetUser.avatar);
        const total = getTotalInvites(stats);

        const embed = new EmbedBuilder()
          .setColor(embedColor)
          .setTitle(`${targetUser.username}'s Invites`)
          .setThumbnail(targetUser.displayAvatarURL())
          .addFields(
            { name: "Total", value: `**${total}**`, inline: true },
            { name: "Regular", value: `${stats.regular}`, inline: true },
            { name: "Bonus", value: `${stats.bonus}`, inline: true },
            { name: "Fake", value: `${stats.fake}`, inline: true },
            { name: "Left", value: `${stats.leftCount}`, inline: true },
          )
          .setTimestamp();

        await interaction.reply({ embeds: [embed] });
        break;
      }

      case "leaderboard": {
        const page = interaction.options.getInteger("page") ?? 1;
        const limit = 10;
        const offset = (page - 1) * limit;

        const entries = await db
          .select()
          .from(inviteStatsTable)
          .where(eq(inviteStatsTable.guildId, guildId))
          .orderBy()
          .limit(limit)
          .offset(offset);

        if (entries.length === 0) {
          await interaction.reply({
            content: "No invite data found for this server yet.",
            ephemeral: true,
          });
          break;
        }

        const lines = entries
          .map((e, i) => {
            const total = getTotalInvites(e);
            const medals = ["🥇", "🥈", "🥉"];
            const prefix = offset + i < 3 ? medals[offset + i] : `**${offset + i + 1}.**`;
            return `${prefix} <@${e.userId}> — **${total}** invites (${e.regular} regular, ${e.bonus} bonus, ${e.fake} fake, ${e.leftCount} left)`;
          })
          .join("\n");

        const embed = new EmbedBuilder()
          .setColor(embedColor)
          .setTitle(`${interaction.guild.name} Invite Leaderboard`)
          .setDescription(lines)
          .setFooter({ text: `Page ${page}` })
          .setTimestamp();

        await interaction.reply({ embeds: [embed] });
        break;
      }

      case "rank": {
        const stats = await getOrCreateStats(
          guildId,
          interaction.user.id,
          interaction.user.username,
          interaction.user.avatar,
        );
        const total = getTotalInvites(stats);

        const allStats = await db
          .select()
          .from(inviteStatsTable)
          .where(eq(inviteStatsTable.guildId, guildId));

        const sorted = allStats.sort((a, b) => getTotalInvites(b) - getTotalInvites(a));
        const rank = sorted.findIndex((s) => s.userId === interaction.user.id) + 1;

        const embed = new EmbedBuilder()
          .setColor(embedColor)
          .setTitle("Your Rank")
          .setDescription(
            `You are ranked **#${rank}** with **${total}** invites on this server.`,
          )
          .addFields(
            { name: "Regular", value: `${stats.regular}`, inline: true },
            { name: "Bonus", value: `${stats.bonus}`, inline: true },
            { name: "Fake", value: `${stats.fake}`, inline: true },
            { name: "Left", value: `${stats.leftCount}`, inline: true },
          )
          .setTimestamp();

        await interaction.reply({ embeds: [embed] });
        break;
      }

      case "fake": {
        const targetUser = interaction.options.getUser("user") ?? interaction.user;
        const stats = await getOrCreateStats(guildId, targetUser.id, targetUser.username);

        const fakeMembers = await db
          .select()
          .from(memberJoinsTable)
          .where(
            and(
              eq(memberJoinsTable.guildId, guildId),
              eq(memberJoinsTable.inviterId, targetUser.id),
              eq(memberJoinsTable.isFake, true),
            ),
          )
          .limit(10);

        const embed = new EmbedBuilder()
          .setColor(0xff6b6b)
          .setTitle(`${targetUser.username}'s Fake Invites`)
          .setDescription(
            fakeMembers.length > 0
              ? fakeMembers
                  .map((m) => `• <@${m.userId}> — Account age: ${m.accountAgeDays ?? "?"}d`)
                  .join("\n")
              : "No fake invites detected.",
          )
          .addFields({ name: "Total Fake", value: `${stats.fake}`, inline: true })
          .setFooter({ text: `Threshold: accounts < ${guild.fakeThreshold} days old` })
          .setTimestamp();

        await interaction.reply({ embeds: [embed] });
        break;
      }

      case "leaves": {
        const recentLeaves = await db
          .select()
          .from(memberJoinsTable)
          .where(and(eq(memberJoinsTable.guildId, guildId)))
          .limit(10);

        const leftMembers = recentLeaves.filter((m) => m.leftAt !== null);

        const embed = new EmbedBuilder()
          .setColor(0xffa500)
          .setTitle("Recent Members Who Left")
          .setDescription(
            leftMembers.length > 0
              ? leftMembers
                  .map(
                    (m) =>
                      `• **${m.username}** — invited by ${m.inviterName ? `<@${m.inviterId}>` : "Unknown"}`,
                  )
                  .join("\n")
              : "No recent leaves tracked.",
          )
          .setTimestamp();

        await interaction.reply({ embeds: [embed] });
        break;
      }

      case "stats": {
        const [joinCount, leaveCount, fakeCount] = await Promise.all([
          db.select().from(memberJoinsTable).where(eq(memberJoinsTable.guildId, guildId)),
          db
            .select()
            .from(memberJoinsTable)
            .where(and(eq(memberJoinsTable.guildId, guildId))),
          db
            .select()
            .from(memberJoinsTable)
            .where(and(eq(memberJoinsTable.guildId, guildId), eq(memberJoinsTable.isFake, true))),
        ]);

        const totalJoins = joinCount.length;
        const totalLeaves = joinCount.filter((m) => m.leftAt !== null).length;
        const totalFake = fakeCount.length;

        const embed = new EmbedBuilder()
          .setColor(embedColor)
          .setTitle(`${interaction.guild.name} Server Stats`)
          .addFields(
            { name: "Total Joins Tracked", value: `${totalJoins}`, inline: true },
            { name: "Total Leaves", value: `${totalLeaves}`, inline: true },
            { name: "Fake Invites", value: `${totalFake}`, inline: true },
            { name: "Net Growth", value: `${totalJoins - totalLeaves}`, inline: true },
            { name: "Premium Tier", value: `${["Free", "Silver", "Gold", "Diamond"][guild.premiumTier] ?? "Free"}`, inline: true },
          )
          .setTimestamp();

        await interaction.reply({ embeds: [embed] });
        break;
      }

      case "inviteinfo": {
        const code = interaction.options.getString("code", true);
        const invite = await interaction.guild.invites.fetch(code).catch(() => null);

        if (!invite) {
          await interaction.reply({ content: "Invite not found or expired.", ephemeral: true });
          break;
        }

        const embed = new EmbedBuilder()
          .setColor(embedColor)
          .setTitle(`Invite: discord.gg/${code}`)
          .addFields(
            { name: "Creator", value: invite.inviter ? `<@${invite.inviter.id}>` : "Unknown", inline: true },
            { name: "Uses", value: `${invite.uses ?? 0}/${invite.maxUses ?? "∞"}`, inline: true },
            { name: "Channel", value: invite.channel ? `<#${invite.channel.id}>` : "Unknown", inline: true },
            { name: "Expires", value: invite.expiresAt ? `<t:${Math.floor(invite.expiresAt.getTime() / 1000)}:R>` : "Never", inline: true },
            { name: "Temporary", value: invite.temporary ? "Yes" : "No", inline: true },
          )
          .setTimestamp();

        await interaction.reply({ embeds: [embed] });
        break;
      }

      case "bonus": {
        const targetUser = interaction.options.getUser("user", true);
        const amount = interaction.options.getInteger("amount", true);
        const reason = interaction.options.getString("reason");

        const stats = await getOrCreateStats(guildId, targetUser.id, targetUser.username, targetUser.avatar);
        const newBonus = Math.max(0, stats.bonus + amount);

        await db
          .update(inviteStatsTable)
          .set({ bonus: newBonus })
          .where(
            and(
              eq(inviteStatsTable.guildId, guildId),
              eq(inviteStatsTable.userId, targetUser.id),
            ),
          );

        const verb = amount >= 0 ? "Added" : "Removed";
        const embed = new EmbedBuilder()
          .setColor(amount >= 0 ? 0x00cc66 : 0xff4444)
          .setTitle(`Bonus Invites ${verb}`)
          .setDescription(
            `${verb} **${Math.abs(amount)}** bonus invite(s) ${amount >= 0 ? "to" : "from"} <@${targetUser.id}>${reason ? `\nReason: ${reason}` : ""}`,
          )
          .addFields({ name: "New Total Bonus", value: `${newBonus}`, inline: true })
          .setTimestamp();

        await interaction.reply({ embeds: [embed] });
        break;
      }

      case "reset": {
        const targetUser = interaction.options.getUser("user", true);
        const type = interaction.options.getString("type") ?? "all";

        const updates: Record<string, number> = {};
        if (type === "all" || type === "regular") updates.regular = 0;
        if (type === "all" || type === "bonus") updates.bonus = 0;
        if (type === "all" || type === "fake") updates.fake = 0;
        if (type === "all" || type === "left") updates.leftCount = 0;

        await db
          .update(inviteStatsTable)
          .set(updates)
          .where(
            and(
              eq(inviteStatsTable.guildId, guildId),
              eq(inviteStatsTable.userId, targetUser.id),
            ),
          );

        const embed = new EmbedBuilder()
          .setColor(0xff9900)
          .setTitle("Invites Reset")
          .setDescription(`Reset **${type}** invite(s) for <@${targetUser.id}>`)
          .setTimestamp();

        await interaction.reply({ embeds: [embed] });
        break;
      }

      case "setup": {
        await db
          .insert(guildsTable)
          .values({ id: guildId, name: interaction.guild.name, icon: interaction.guild.icon })
          .onConflictDoNothing();

        const embed = new EmbedBuilder()
          .setColor(0x00cc66)
          .setTitle("Bot Setup Complete!")
          .setDescription(
            `Invite Tracker is now active in **${interaction.guild.name}**!\n\n` +
              "Use \`/config\` to customize join/leave messages.\n" +
              "Add the bot to all servers and manage them from the dashboard.",
          )
          .addFields(
            { name: "Commands", value: "`/invites`, `/leaderboard`, `/rank`, `/stats`", inline: false },
            { name: "Admin Commands", value: "`/bonus`, `/reset`, `/config`", inline: false },
          )
          .setTimestamp();

        await interaction.reply({ embeds: [embed] });
        break;
      }

      case "config": {
        const setting = interaction.options.getString("setting", true);
        const value = interaction.options.getString("value", true);

        const updates: Partial<typeof guildsTable.$inferInsert> = {};
        if (setting === "join_message") updates.joinMessage = value;
        if (setting === "leave_message") updates.leaveMessage = value;
        if (setting === "fake_threshold") {
          const threshold = parseInt(value, 10);
          if (isNaN(threshold) || threshold < 0) {
            await interaction.reply({ content: "Invalid threshold value.", ephemeral: true });
            break;
          }
          updates.fakeThreshold = threshold;
        }

        await db.update(guildsTable).set(updates).where(eq(guildsTable.id, guildId));

        await interaction.reply({
          content: `✅ Updated \`${setting}\` successfully.`,
          ephemeral: true,
        });
        break;
      }

      case "premium": {
        const embed = new EmbedBuilder()
          .setColor(0xffd700)
          .setTitle("Premium Status")
          .setDescription(
            `**Current tier:** ${["Free", "Silver", "Gold", "Diamond"][guild.premiumTier] ?? "Free"}\n\n` +
              "Visit the dashboard to upgrade to Silver ($1.99/mo), Gold ($3.99/mo), or Diamond ($7.99/mo).",
          )
          .setTimestamp();

        await interaction.reply({ embeds: [embed] });
        break;
      }
    }
  } catch (err) {
    logger.error({ err, command: interaction.commandName }, "Error handling slash command");
    const errMsg = "An error occurred while processing that command.";
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({ content: errMsg, ephemeral: true });
    } else {
      await interaction.reply({ content: errMsg, ephemeral: true });
    }
  }
});

export async function startBot(): Promise<void> {
  if (!process.env.DISCORD_TOKEN) {
    logger.warn("DISCORD_TOKEN not set in .env — bot will not start. Add it to .env to enable.");
    return;
  }

  try {
    await discordClient.login(process.env.DISCORD_TOKEN);
  } catch (err) {
    logger.error({ err }, "Failed to login to Discord");
  }
}
