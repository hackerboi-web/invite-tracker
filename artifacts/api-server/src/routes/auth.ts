import { Router, type IRouter } from "express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { exchangeCode, getDiscordUser, getAvatarUrl } from "../lib/discord-api";
import { logger } from "../lib/logger";

const router: IRouter = Router();

const DISCORD_OAUTH_URL = "https://discord.com/api/oauth2/authorize";
const SCOPES = ["identify", "guilds"].join("%20");

router.get("/auth/discord", (_req, res): void => {
  if (!process.env.DISCORD_CLIENT_ID || !process.env.DISCORD_REDIRECT_URI) {
    res.status(500).json({ error: "Discord OAuth not configured. Check your .env file." });
    return;
  }
  const url = `${DISCORD_OAUTH_URL}?client_id=${process.env.DISCORD_CLIENT_ID}&redirect_uri=${encodeURIComponent(process.env.DISCORD_REDIRECT_URI)}&response_type=code&scope=${SCOPES}`;
  res.redirect(url);
});

router.get("/auth/discord/callback", async (req, res): Promise<void> => {
  const code = Array.isArray(req.query.code) ? req.query.code[0] : req.query.code;
  if (!code || typeof code !== "string") {
    res.redirect("/?error=no_code");
    return;
  }

  try {
    const tokenData = await exchangeCode(code);
    const discordUser = await getDiscordUser(tokenData.access_token);

    const tokenExpiresAt = new Date(Date.now() + tokenData.expires_in * 1000);

    await db
      .insert(usersTable)
      .values({
        id: discordUser.id,
        username: discordUser.username,
        discriminator: discordUser.discriminator || "0",
        avatar: discordUser.avatar,
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token,
        tokenExpiresAt,
      })
      .onConflictDoUpdate({
        target: usersTable.id,
        set: {
          username: discordUser.username,
          discriminator: discordUser.discriminator || "0",
          avatar: discordUser.avatar,
          accessToken: tokenData.access_token,
          refreshToken: tokenData.refresh_token,
          tokenExpiresAt,
        },
      });

    req.session.userId = discordUser.id;
    req.session.accessToken = tokenData.access_token;

    req.log.info({ userId: discordUser.id }, "User authenticated via Discord OAuth");
    res.redirect("/dashboard");
  } catch (err) {
    req.log.error({ err }, "Discord OAuth callback failed");
    res.redirect("/?error=auth_failed");
  }
});

router.get("/auth/me", async (req, res): Promise<void> => {
  if (!req.session.userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, req.session.userId));

  if (!user) {
    req.session.destroy(() => {});
    res.status(401).json({ error: "User not found" });
    return;
  }

  res.json({
    id: user.id,
    username: user.username,
    discriminator: user.discriminator,
    avatar: user.avatar,
    avatarUrl: getAvatarUrl(user.id, user.avatar),
  });
});

router.post("/auth/logout", (req, res): void => {
  req.session.destroy(() => {
    res.json({ success: true, message: "Logged out" });
  });
});

export default router;
