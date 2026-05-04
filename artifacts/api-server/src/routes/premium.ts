import { Router, type IRouter } from "express";
import { db, guildsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";
import { GetGuildPremiumParams } from "@workspace/api-zod";

const router: IRouter = Router();

const PREMIUM_PLANS = [
  {
    tier: 0,
    name: "Free",
    price: 0,
    currency: "USD",
    features: [
      "Invite tracking & attribution",
      "Basic leaderboard (top 10)",
      "Join/leave tracking",
      "Fake invite detection",
      "Basic slash commands",
      "Standard embeds",
    ],
    highlighted: false,
  },
  {
    tier: 1,
    name: "Silver",
    price: 1.99,
    currency: "USD",
    features: [
      "Everything in Free",
      "Extended leaderboard (top 50)",
      "Custom join/leave messages",
      "Message variables ({inviter}, {count}, {server})",
      "Invite history export",
      "Priority support (24h response)",
    ],
    highlighted: false,
  },
  {
    tier: 2,
    name: "Gold",
    price: 3.99,
    currency: "USD",
    features: [
      "Everything in Silver",
      "Image embeds in messages",
      "Full leaderboard (unlimited)",
      "Detailed analytics (30-day charts)",
      "Custom embed colors",
      "Vanity invite tracking",
      "Priority support (12h response)",
    ],
    highlighted: true,
  },
  {
    tier: 3,
    name: "Diamond",
    price: 7.99,
    currency: "USD",
    features: [
      "Everything in Gold",
      "Multi-server management",
      "Data export (CSV/JSON)",
      "API access for external integrations",
      "Custom bot status per server",
      "Invite rewards automation",
      "Priority support (2h response)",
      "Dedicated support agent",
    ],
    highlighted: false,
  },
];

const TIER_NAMES: Record<number, string> = {
  0: "Free",
  1: "Silver",
  2: "Gold",
  3: "Diamond",
};

router.get("/premium/plans", (_req, res): void => {
  res.json(PREMIUM_PLANS);
});

router.get("/guilds/:guildId/premium", requireAuth, async (req, res): Promise<void> => {
  const params = GetGuildPremiumParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [guild] = await db
    .select()
    .from(guildsTable)
    .where(eq(guildsTable.id, params.data.guildId));

  if (!guild) {
    res.json({
      tier: 0,
      tierName: "Free",
      expiresAt: null,
      isActive: true,
    });
    return;
  }

  const now = new Date();
  const isActive =
    guild.premiumTier === 0 ||
    (guild.premiumExpiresAt !== null && guild.premiumExpiresAt > now);

  res.json({
    tier: guild.premiumTier,
    tierName: TIER_NAMES[guild.premiumTier] ?? "Free",
    expiresAt: guild.premiumExpiresAt?.toISOString() ?? null,
    isActive,
  });
});

export default router;
