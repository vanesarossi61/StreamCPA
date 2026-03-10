/**
 * Seed script — populates the database with realistic test data
 * Run: npx prisma db seed  (or npm run db:seed)
 *
 * Creates:
 *   - 1 admin user
 *   - 5 streamers (with Twitch profiles, varied scores)
 *   - 3 brands (1 active, 1 pending, 1 rejected)
 *   - 4 campaigns (different types, budgets, statuses)
 *   - Applications, affiliate links, clicks, conversions
 *   - Payouts, deposits, notifications
 */
import { PrismaClient } from "@prisma/client";
import { createHash, randomUUID } from "crypto";

const prisma = new PrismaClient();

function hashPassword(password: string): string {
  return createHash("sha256").update(password).digest("hex");
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

async function main() {
  console.log("Seeding database...\n");

  // ==========================================
  // CLEAN EXISTING DATA (in correct order)
  // ==========================================

  console.log("Cleaning existing data...");
  await prisma.notification.deleteMany();
  await prisma.conversion.deleteMany();
  await prisma.click.deleteMany();
  await prisma.affiliateLink.deleteMany();
  await prisma.campaignApplication.deleteMany();
  await prisma.campaignMaterial.deleteMany();
  await prisma.payout.deleteMany();
  await prisma.deposit.deleteMany();
  await prisma.campaign.deleteMany();
  await prisma.streamer.deleteMany();
  await prisma.brand.deleteMany();
  await prisma.session.deleteMany();
  await prisma.account.deleteMany();
  await prisma.verificationToken.deleteMany();
  await prisma.user.deleteMany();

  // ==========================================
  // ADMIN USER
  // ==========================================

  console.log("Creating admin user...");
  const admin = await prisma.user.create({
    data: {
      name: "Admin",
      email: "admin@streamcpa.com",
      hashedPassword: hashPassword("admin123456"),
      role: "ADMIN",
      isActive: true,
      emailVerified: daysAgo(90),
    },
  });

  // ==========================================
  // STREAMERS
  // ==========================================

  console.log("Creating streamers...");

  const streamerData = [
    {
      name: "NightOwl_GG",
      email: "nightowl@example.com",
      twitchId: "100001",
      twitchUsername: "nightowl_gg",
      twitchDisplayName: "NightOwl_GG",
      twitchAvatar: "https://static-cdn.jtvnw.net/jtv_user_pictures/placeholder-1.png",
      twitchFollowers: 45200,
      avgViewers: 890,
      mainCategory: "Just Chatting",
      bio: "Night-time variety streamer. Love chatting with my community and trying new games.",
      country: "US",
      categories: ["Just Chatting", "Variety", "IRL"],
      languages: ["en"],
      streamerScore: 72,
      balanceAvailable: 145.50,
      balancePending: 32.00,
      totalEarned: 1280.00,
    },
    {
      name: "PixelQueen",
      email: "pixelqueen@example.com",
      twitchId: "100002",
      twitchUsername: "pixelqueen",
      twitchDisplayName: "PixelQueen",
      twitchAvatar: "https://static-cdn.jtvnw.net/jtv_user_pictures/placeholder-2.png",
      twitchFollowers: 128500,
      avgViewers: 2400,
      mainCategory: "Fortnite",
      bio: "Competitive FPS player. Top 500 in multiple games. Streaming daily!",
      country: "GB",
      categories: ["Fortnite", "Valorant", "Apex Legends"],
      languages: ["en"],
      streamerScore: 88,
      balanceAvailable: 520.00,
      balancePending: 85.00,
      totalEarned: 4750.00,
    },
    {
      name: "ElStreamador",
      email: "elstreamador@example.com",
      twitchId: "100003",
      twitchUsername: "elstreamador",
      twitchDisplayName: "ElStreamador",
      twitchAvatar: "https://static-cdn.jtvnw.net/jtv_user_pictures/placeholder-3.png",
      twitchFollowers: 67800,
      avgViewers: 1100,
      mainCategory: "League of Legends",
      bio: "Streamer hispano. LoL, Minecraft y mucho humor.",
      country: "ES",
      categories: ["League of Legends", "Minecraft", "Just Chatting"],
      languages: ["es", "en"],
      streamerScore: 76,
      balanceAvailable: 88.00,
      balancePending: 15.00,
      totalEarned: 920.00,
    },
    {
      name: "CozyGamer_",
      email: "cozygamer@example.com",
      twitchId: "100004",
      twitchUsername: "cozygamer_",
      twitchDisplayName: "CozyGamer_",
      twitchAvatar: "https://static-cdn.jtvnw.net/jtv_user_pictures/placeholder-4.png",
      twitchFollowers: 15300,
      avgViewers: 210,
      mainCategory: "Stardew Valley",
      bio: "Cozy games, chill vibes. Come relax with us!",
      country: "CA",
      categories: ["Stardew Valley", "Animal Crossing", "Cozy Games"],
      languages: ["en", "fr"],
      streamerScore: 48,
      balanceAvailable: 22.00,
      balancePending: 5.00,
      totalEarned: 185.00,
    },
    {
      name: "TechBroLive",
      email: "techbro@example.com",
      twitchId: "100005",
      twitchUsername: "techbrolive",
      twitchDisplayName: "TechBroLive",
      twitchAvatar: "https://static-cdn.jtvnw.net/jtv_user_pictures/placeholder-5.png",
      twitchFollowers: 89400,
      avgViewers: 1600,
      mainCategory: "Science & Technology",
      bio: "Tech reviews, coding streams, and building cool stuff on stream.",
      country: "DE",
      categories: ["Science & Technology", "Software and Game Development", "Just Chatting"],
      languages: ["en", "de"],
      streamerScore: 81,
      balanceAvailable: 310.00,
      balancePending: 45.00,
      totalEarned: 2100.00,
    },
  ];

  const streamers = [];
  for (const s of streamerData) {
    const user = await prisma.user.create({
      data: {
        name: s.name,
        email: s.email,
        hashedPassword: hashPassword("streamer123"),
        role: "STREAMER",
        isActive: true,
        emailVerified: daysAgo(randomInt(30, 120)),
        image: s.twitchAvatar,
      },
    });

    const streamer = await prisma.streamer.create({
      data: {
        userId: user.id,
        twitchId: s.twitchId,
        twitchUsername: s.twitchUsername,
        twitchDisplayName: s.twitchDisplayName,
        twitchAvatar: s.twitchAvatar,
        twitchFollowers: s.twitchFollowers,
        avgViewers: s.avgViewers,
        mainCategory: s.mainCategory,
        bio: s.bio,
        country: s.country,
        categories: s.categories,
        languages: s.languages,
        streamerScore: s.streamerScore,
        status: "ACTIVE",
        onboardingStep: 3,
        termsAcceptedAt: daysAgo(randomInt(15, 90)),
        lastSyncAt: daysAgo(1),
        paypalEmail: s.email,
        preferredPayout: "paypal",
        balanceAvailable: s.balanceAvailable,
        balancePending: s.balancePending,
        totalEarned: s.totalEarned,
      },
    });

    streamers.push({ user, streamer });
  }

  // ==========================================
  // BRANDS
  // ==========================================

  console.log("Creating brands...");

  const brandData = [
    {
      name: "GameFuel Inc.",
      email: "contact@gamefuel.gg",
      companyName: "GameFuel Inc.",
      website: "https://gamefuel.gg",
      industry: "Gaming Peripherals",
      description: "Premium gaming energy drinks and supplements. Fuel your stream!",
      contactName: "Sarah Chen",
      contactEmail: "sarah@gamefuel.gg",
      status: "ACTIVE" as const,
      escrowBalance: 5000.00,
      totalSpent: 12400.00,
    },
    {
      name: "CloudVPN Pro",
      email: "partners@cloudvpn.io",
      companyName: "CloudVPN Pro",
      website: "https://cloudvpn.io",
      industry: "Software / VPN",
      description: "Fast, secure VPN for gamers. Zero-lag connections worldwide.",
      contactName: "Mike Johnson",
      contactEmail: "mike@cloudvpn.io",
      status: "ACTIVE" as const,
      escrowBalance: 8500.00,
      totalSpent: 6200.00,
    },
    {
      name: "SketchPad",
      email: "hello@sketchpad.app",
      companyName: "SketchPad App",
      website: "https://sketchpad.app",
      industry: "Creative Software",
      description: "Digital drawing app for creators. Free tier with premium features.",
      contactName: "Luna Park",
      contactEmail: "luna@sketchpad.app",
      status: "PENDING_VERIFICATION" as const,
      escrowBalance: 0,
      totalSpent: 0,
    },
  ];

  const brands = [];
  for (const b of brandData) {
    const user = await prisma.user.create({
      data: {
        name: b.name,
        email: b.email,
        hashedPassword: hashPassword("brand123456"),
        role: "BRAND",
        isActive: true,
        emailVerified: daysAgo(randomInt(30, 180)),
      },
    });

    const brand = await prisma.brand.create({
      data: {
        userId: user.id,
        companyName: b.companyName,
        website: b.website,
        industry: b.industry,
        description: b.description,
        contactName: b.contactName,
        contactEmail: b.contactEmail,
        status: b.status,
        verifiedAt: b.status === "ACTIVE" ? daysAgo(randomInt(20, 60)) : null,
        escrowBalance: b.escrowBalance,
        totalSpent: b.totalSpent,
      },
    });

    brands.push({ user, brand });
  }

  // ==========================================
  // CAMPAIGNS
  // ==========================================

  console.log("Creating campaigns...");

  const campaignData = [
    {
      brandIndex: 0, // GameFuel
      name: "GameFuel Summer Promo",
      slug: "gamefuel-summer-promo",
      description:
        "Promote GameFuel energy drinks to your gaming audience. Share your unique link and earn $3.50 for every sale through your channel. Perfect for Just Chatting and gaming streams.",
      shortDescription: "Earn $3.50 per sale promoting GameFuel energy drinks",
      landingUrl: "https://gamefuel.gg/summer?ref=streamcpa",
      conversionType: "SALE" as const,
      payoutPerConversion: 3.50,
      platformFee: 0.70,
      totalBudget: 10000,
      remainingBudget: 6200,
      spent: 3800,
      categories: ["Just Chatting", "Variety", "FPS"],
      countries: ["US", "CA", "GB"],
      minFollowers: 1000,
      minAvgViewers: 50,
      autoApprove: false,
      status: "ACTIVE" as const,
    },
    {
      brandIndex: 0, // GameFuel
      name: "GameFuel Creator Bundle",
      slug: "gamefuel-creator-bundle",
      description:
        "Exclusive creator bundle — fans get 20% off their first order when using your link. You earn $5 per completed purchase. Limited to top-tier streamers.",
      shortDescription: "Earn $5 per sale with exclusive 20% discount for fans",
      landingUrl: "https://gamefuel.gg/creator-bundle?ref=streamcpa",
      conversionType: "SALE" as const,
      payoutPerConversion: 5.00,
      platformFee: 1.00,
      totalBudget: 5000,
      remainingBudget: 4200,
      spent: 800,
      categories: ["Just Chatting", "Variety"],
      countries: [],
      minFollowers: 10000,
      minAvgViewers: 200,
      autoApprove: false,
      status: "ACTIVE" as const,
    },
    {
      brandIndex: 1, // CloudVPN
      name: "CloudVPN Gamer Plan",
      slug: "cloudvpn-gamer-plan",
      description:
        "Promote CloudVPN to gamers who want zero-lag connections. $8 per signup — no purchase needed, just a free trial registration. Great conversion rates!",
      shortDescription: "Earn $8 per free trial signup for CloudVPN",
      landingUrl: "https://cloudvpn.io/gamer?ref=streamcpa",
      conversionType: "SIGNUP" as const,
      payoutPerConversion: 8.00,
      platformFee: 1.60,
      totalBudget: 15000,
      remainingBudget: 9800,
      spent: 5200,
      categories: ["FPS", "Battle Royale", "Competitive"],
      countries: ["US", "CA", "GB", "DE", "FR", "ES"],
      minFollowers: 500,
      minAvgViewers: 25,
      autoApprove: true,
      status: "ACTIVE" as const,
    },
    {
      brandIndex: 1, // CloudVPN
      name: "CloudVPN Annual Deal",
      slug: "cloudvpn-annual-deal",
      description:
        "Premium campaign — $15 per annual subscription sale. Higher payout, higher commitment. Only for streamers with proven conversion track records.",
      shortDescription: "$15 per annual subscription — premium payout",
      landingUrl: "https://cloudvpn.io/annual?ref=streamcpa",
      conversionType: "SUBSCRIPTION" as const,
      payoutPerConversion: 15.00,
      platformFee: 3.00,
      totalBudget: 8000,
      remainingBudget: 8000,
      spent: 0,
      categories: [],
      countries: [],
      minFollowers: 5000,
      minAvgViewers: 100,
      autoApprove: false,
      status: "PAUSED" as const,
    },
  ];

  const campaigns = [];
  for (const c of campaignData) {
    const campaign = await prisma.campaign.create({
      data: {
        brandId: brands[c.brandIndex].brand.id,
        name: c.name,
        slug: c.slug,
        description: c.description,
        shortDescription: c.shortDescription,
        landingUrl: c.landingUrl,
        conversionType: c.conversionType,
        payoutPerConversion: c.payoutPerConversion,
        platformFee: c.platformFee,
        totalBudget: c.totalBudget,
        remainingBudget: c.remainingBudget,
        spent: c.spent,
        categories: c.categories,
        countries: c.countries,
        minFollowers: c.minFollowers,
        minAvgViewers: c.minAvgViewers,
        autoApprove: c.autoApprove,
        status: c.status,
        publishedAt: daysAgo(randomInt(5, 45)),
      },
    });

    campaigns.push(campaign);
  }

  // ==========================================
  // APPLICATIONS & AFFILIATE LINKS
  // ==========================================

  console.log("Creating applications and affiliate links...");

  // PixelQueen approved for GameFuel Summer + CloudVPN Gamer
  // NightOwl approved for CloudVPN Gamer (auto-approve)
  // ElStreamador pending for GameFuel Summer
  // TechBroLive approved for CloudVPN Gamer

  const applications = [
    { streamerIdx: 1, campaignIdx: 0, status: "APPROVED" as const },
    { streamerIdx: 1, campaignIdx: 2, status: "APPROVED" as const },
    { streamerIdx: 0, campaignIdx: 2, status: "APPROVED" as const },
    { streamerIdx: 2, campaignIdx: 0, status: "PENDING" as const },
    { streamerIdx: 4, campaignIdx: 2, status: "APPROVED" as const },
    { streamerIdx: 3, campaignIdx: 2, status: "APPROVED" as const },
  ];

  const affiliateLinks = [];
  for (const app of applications) {
    const streamer = streamers[app.streamerIdx].streamer;
    const campaign = campaigns[app.campaignIdx];

    await prisma.campaignApplication.create({
      data: {
        campaignId: campaign.id,
        streamerId: streamer.id,
        status: app.status,
        reviewedAt: app.status !== "PENDING" ? daysAgo(randomInt(1, 20)) : null,
      },
    });

    // Create affiliate link for approved applications
    if (app.status === "APPROVED") {
      const slug = `${campaign.slug.slice(0, 4)}${streamer.twitchUsername.slice(0, 4)}${randomInt(10, 99)}`;
      const link = await prisma.affiliateLink.create({
        data: {
          slug,
          campaignId: campaign.id,
          streamerId: streamer.id,
          targetUrl: campaign.landingUrl,
          isActive: true,
          totalClicks: randomInt(50, 800),
          totalConversions: randomInt(2, 30),
          totalEarnings: 0, // will be calculated from conversions
        },
      });
      affiliateLinks.push({ link, streamer, campaign, streamerIdx: app.streamerIdx });
    }
  }

  // ==========================================
  // CLICKS & CONVERSIONS
  // ==========================================

  console.log("Creating clicks and conversions...");

  const countries = ["US", "CA", "GB", "DE", "FR", "ES", "BR", "AU"];
  const devices = ["desktop", "mobile", "tablet"];

  for (const al of affiliateLinks) {
    const numClicks = randomInt(20, 60);
    const clickIds: string[] = [];

    for (let i = 0; i < numClicks; i++) {
      const isFlagged = Math.random() < 0.08; // 8% flagged
      const click = await prisma.click.create({
        data: {
          affiliateLinkId: al.link.id,
          campaignId: al.campaign.id,
          streamerId: al.streamer.id,
          clickId: randomUUID(),
          ipHash: createHash("sha256")
            .update(`192.168.${randomInt(1, 255)}.${randomInt(1, 255)}`)
            .digest("hex"),
          country: countries[randomInt(0, countries.length - 1)],
          device: devices[randomInt(0, devices.length - 1)],
          userAgent: "Mozilla/5.0 (seed data)",
          referer: `https://twitch.tv/${al.streamer.twitchUsername}`,
          flagged: isFlagged,
          fraudScore: isFlagged ? randomInt(50, 95) : randomInt(0, 20),
          flagReason: isFlagged ? "Suspicious pattern detected" : null,
          createdAt: daysAgo(randomInt(0, 30)),
        },
      });
      clickIds.push(click.id);
    }

    // Create conversions for some clicks
    const numConversions = randomInt(2, Math.min(8, numClicks));
    for (let i = 0; i < numConversions; i++) {
      const clickId = clickIds[randomInt(0, clickIds.length - 1)];
      const fraudScore = Math.random() < 0.1 ? randomInt(50, 90) : randomInt(0, 15);
      const status =
        fraudScore >= 50
          ? "UNDER_REVIEW"
          : Math.random() < 0.9
            ? "APPROVED"
            : "PENDING";

      await prisma.conversion.create({
        data: {
          clickId,
          affiliateLinkId: al.link.id,
          campaignId: al.campaign.id,
          streamerId: al.streamer.id,
          externalId: `ext_${randomUUID().slice(0, 8)}`,
          payout: al.campaign.payoutPerConversion,
          platformFee: al.campaign.platformFee,
          totalAmount: al.campaign.payoutPerConversion + al.campaign.platformFee,
          status,
          fraudScore,
          reviewedAt: status === "APPROVED" ? daysAgo(randomInt(0, 10)) : null,
          reviewedBy: status === "APPROVED" ? admin.id : null,
          createdAt: daysAgo(randomInt(0, 25)),
        },
      });
    }
  }

  // ==========================================
  // DEPOSITS (brand)
  // ==========================================

  console.log("Creating deposits...");

  await prisma.deposit.create({
    data: {
      brandId: brands[0].brand.id,
      amount: 10000,
      stripeSessionId: "cs_test_gamefuel_001",
      stripePaymentIntentId: "pi_test_gamefuel_001",
      status: "COMPLETED",
      createdAt: daysAgo(60),
    },
  });

  await prisma.deposit.create({
    data: {
      brandId: brands[1].brand.id,
      amount: 15000,
      stripeSessionId: "cs_test_cloudvpn_001",
      stripePaymentIntentId: "pi_test_cloudvpn_001",
      status: "COMPLETED",
      createdAt: daysAgo(45),
    },
  });

  // ==========================================
  // PAYOUTS (streamer)
  // ==========================================

  console.log("Creating payouts...");

  await prisma.payout.create({
    data: {
      streamerId: streamers[1].streamer.id,
      amount: 200.00,
      method: "paypal",
      status: "COMPLETED",
      externalId: "PP_BATCH_001",
      requestedAt: daysAgo(14),
      processedAt: daysAgo(12),
      periodStart: daysAgo(44),
      periodEnd: daysAgo(14),
    },
  });

  await prisma.payout.create({
    data: {
      streamerId: streamers[0].streamer.id,
      amount: 75.00,
      method: "paypal",
      status: "PENDING",
      requestedAt: daysAgo(2),
      periodStart: daysAgo(32),
      periodEnd: daysAgo(2),
    },
  });

  // ==========================================
  // NOTIFICATIONS
  // ==========================================

  console.log("Creating notifications...");

  const notifs = [
    {
      userId: streamers[1].user.id,
      type: "CONVERSION" as const,
      title: "New conversion!",
      message: "You earned $8.00 from CloudVPN Gamer Plan",
      link: "/streamer",
    },
    {
      userId: streamers[0].user.id,
      type: "APPLICATION" as const,
      title: "Application approved",
      message: "You've been approved for CloudVPN Gamer Plan",
      link: "/streamer/offers",
    },
    {
      userId: brands[0].user.id,
      type: "APPLICATION" as const,
      title: "New application",
      message: "ElStreamador applied to GameFuel Summer Promo",
      link: "/brand/campaigns",
    },
    {
      userId: streamers[1].user.id,
      type: "PAYOUT" as const,
      title: "Payout sent!",
      message: "Your $200.00 payout via PayPal has been processed",
      link: "/streamer",
      readAt: daysAgo(10),
    },
    {
      userId: admin.id,
      type: "SYSTEM" as const,
      title: "New brand pending verification",
      message: "SketchPad App submitted for verification",
      link: "/admin/brands",
    },
  ];

  for (const n of notifs) {
    await prisma.notification.create({
      data: {
        userId: n.userId,
        type: n.type,
        title: n.title,
        message: n.message,
        link: n.link,
        readAt: (n as any).readAt || null,
        metadata: {},
      },
    });
  }

  // ==========================================
  // SUMMARY
  // ==========================================

  console.log("\n--- Seed Complete ---");
  console.log(`  Admin:       1 (admin@streamcpa.com / admin123456)`);
  console.log(`  Streamers:   ${streamers.length} (password: streamer123)`);
  console.log(`  Brands:      ${brands.length} (password: brand123456)`);
  console.log(`  Campaigns:   ${campaigns.length}`);
  console.log(`  Aff. Links:  ${affiliateLinks.length}`);
  console.log(`  Notifications: ${notifs.length}`);
  console.log("\nTest accounts:");
  console.log("  admin@streamcpa.com (Admin)");
  console.log("  nightowl@example.com (Streamer - mid tier)");
  console.log("  pixelqueen@example.com (Streamer - top tier)");
  console.log("  contact@gamefuel.gg (Brand - active)");
  console.log("  hello@sketchpad.app (Brand - pending verification)");
  console.log("");
}

main()
  .catch((e) => {
    console.error("Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
