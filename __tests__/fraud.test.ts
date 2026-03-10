/**
 * Fraud Detection Engine — Unit Tests
 *
 * Tests the fraud scoring system with mocked DB and Redis.
 * Covers click fraud analysis, conversion fraud, and admin utilities.
 */
import { describe, it, expect, vi } from "vitest";
import "./setup";
import { mockDb } from "./setup";

// Import after mocks are set up
import { analyzeClick, analyzeConversion, getFraudSummary } from "@/lib/fraud";

describe("analyzeClick", () => {
  const baseParams = {
    ipHash: "abc123hash",
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0",
    affiliateLinkId: "link_1",
    streamerId: "streamer_1",
    campaignId: "campaign_1",
    country: "US",
    referer: "https://twitch.tv/nightowl_gg",
  };

  it("should return low fraud score for a clean click", async () => {
    // No duplicate IPs, no velocity issues, valid UA
    mockDb.click.count.mockResolvedValue(0);
    mockDb.click.groupBy.mockResolvedValue([]);
    mockDb.campaign.findUnique.mockResolvedValue({
      countries: ["US", "CA"],
      remainingBudget: 5000,
      status: "ACTIVE",
    });

    const result = await analyzeClick(baseParams);

    expect(result.totalScore).toBeLessThan(40);
    expect(result.recommendation).toBe("approve");
    expect(result.blocked).toBe(false);
  });

  it("should flag duplicate IPs from same link", async () => {
    // 3 previous clicks from same IP on same link
    mockDb.click.count.mockResolvedValue(3);
    mockDb.click.groupBy.mockResolvedValue([]);
    mockDb.campaign.findUnique.mockResolvedValue({
      countries: ["US"],
      remainingBudget: 5000,
      status: "ACTIVE",
    });

    const result = await analyzeClick(baseParams);

    expect(result.totalScore).toBeGreaterThan(0);
    const dupeSignal = result.signals.find(
      (s) => s.rule === "duplicate_ip" || s.rule === "duplicate_ip_heavy",
    );
    expect(dupeSignal).toBeDefined();
  });

  it("should score critical for heavy duplicate IP abuse", async () => {
    // 10 clicks from same IP — should get heavy penalty
    mockDb.click.count.mockResolvedValue(10);
    mockDb.click.groupBy.mockResolvedValue([]);
    mockDb.campaign.findUnique.mockResolvedValue({
      countries: [],
      remainingBudget: 5000,
      status: "ACTIVE",
    });

    const result = await analyzeClick(baseParams);

    const heavySignal = result.signals.find(
      (s) => s.rule === "duplicate_ip_heavy",
    );
    expect(heavySignal).toBeDefined();
    expect(heavySignal?.severity).toBe("critical");
  });

  it("should detect bot user agents", async () => {
    mockDb.click.count.mockResolvedValue(0);
    mockDb.click.groupBy.mockResolvedValue([]);
    mockDb.campaign.findUnique.mockResolvedValue({
      countries: [],
      remainingBudget: 5000,
      status: "ACTIVE",
    });

    const result = await analyzeClick({
      ...baseParams,
      userAgent: "python-requests/2.28.0",
    });

    const botSignal = result.signals.find((s) => s.rule === "bot_ua");
    expect(botSignal).toBeDefined();
    expect(botSignal?.score).toBe(50);
    expect(botSignal?.severity).toBe("critical");
  });

  it("should flag missing user agent", async () => {
    mockDb.click.count.mockResolvedValue(0);
    mockDb.click.groupBy.mockResolvedValue([]);
    mockDb.campaign.findUnique.mockResolvedValue({
      countries: [],
      remainingBudget: 5000,
      status: "ACTIVE",
    });

    const result = await analyzeClick({
      ...baseParams,
      userAgent: null,
    });

    const uaSignal = result.signals.find((s) => s.rule === "missing_ua");
    expect(uaSignal).toBeDefined();
    expect(uaSignal?.score).toBe(20);
  });

  it("should detect geographic mismatch", async () => {
    mockDb.click.count.mockResolvedValue(0);
    mockDb.click.groupBy.mockResolvedValue([]);
    mockDb.campaign.findUnique.mockResolvedValue({
      countries: ["US", "CA"],
      remainingBudget: 5000,
      status: "ACTIVE",
    });

    const result = await analyzeClick({
      ...baseParams,
      country: "RU",
    });

    const geoSignal = result.signals.find((s) => s.rule === "geo_mismatch");
    expect(geoSignal).toBeDefined();
    expect(geoSignal?.score).toBe(15);
  });

  it("should detect click farm behavior", async () => {
    mockDb.click.count.mockResolvedValue(0);
    // IP clicked 12 different streamers' links
    mockDb.click.groupBy.mockResolvedValue(
      Array.from({ length: 12 }, (_, i) => ({ streamerId: `s_${i}` })),
    );
    mockDb.campaign.findUnique.mockResolvedValue({
      countries: [],
      remainingBudget: 5000,
      status: "ACTIVE",
    });

    const result = await analyzeClick(baseParams);

    const farmSignal = result.signals.find((s) => s.rule === "click_farm");
    expect(farmSignal).toBeDefined();
    expect(farmSignal?.severity).toBe("critical");
  });

  it("should flag exhausted campaign budget", async () => {
    mockDb.click.count.mockResolvedValue(0);
    mockDb.click.groupBy.mockResolvedValue([]);
    mockDb.campaign.findUnique.mockResolvedValue({
      countries: [],
      remainingBudget: 0,
      status: "ACTIVE",
    });

    const result = await analyzeClick(baseParams);

    const budgetSignal = result.signals.find(
      (s) => s.rule === "budget_exhausted",
    );
    expect(budgetSignal).toBeDefined();
  });

  it("should recommend reject when score exceeds threshold", async () => {
    // Bot UA (50) + heavy duplicate (40) = 90 -> reject
    mockDb.click.count.mockResolvedValue(10);
    mockDb.click.groupBy.mockResolvedValue([]);
    mockDb.campaign.findUnique.mockResolvedValue({
      countries: [],
      remainingBudget: 5000,
      status: "ACTIVE",
    });

    const result = await analyzeClick({
      ...baseParams,
      userAgent: "selenium/4.0",
    });

    expect(result.recommendation).toBe("reject");
    expect(result.totalScore).toBeGreaterThanOrEqual(80);
  });
});

describe("analyzeConversion", () => {
  const baseParams = {
    clickId: "click_1",
    clickFraudScore: 0,
    timeSinceClickMs: 60_000, // 1 minute
    conversionValue: 5.0,
    campaignId: "campaign_1",
    streamerId: "streamer_1",
    ipHash: "abc123hash",
  };

  it("should return low score for clean conversion", async () => {
    mockDb.conversion.count.mockResolvedValue(1);

    const result = await analyzeConversion(baseParams);

    expect(result.totalScore).toBeLessThan(40);
    expect(result.recommendation).toBe("approve");
    expect(result.blocked).toBe(false); // conversions are never blocked
  });

  it("should inherit click fraud score", async () => {
    mockDb.conversion.count.mockResolvedValue(0);

    const result = await analyzeConversion({
      ...baseParams,
      clickFraudScore: 60,
    });

    const inheritedSignal = result.signals.find(
      (s) => s.rule === "inherited_click_fraud",
    );
    expect(inheritedSignal).toBeDefined();
    expect(inheritedSignal?.score).toBe(30); // 60 * 0.5
  });

  it("should flag instant conversions", async () => {
    mockDb.conversion.count.mockResolvedValue(0);

    const result = await analyzeConversion({
      ...baseParams,
      timeSinceClickMs: 3000, // 3 seconds
    });

    const instantSignal = result.signals.find(
      (s) => s.rule === "instant_conversion",
    );
    expect(instantSignal).toBeDefined();
    expect(instantSignal?.score).toBe(35);
  });

  it("should flag high conversion velocity", async () => {
    // First call for velocity check, second for IP check
    mockDb.conversion.count
      .mockResolvedValueOnce(25) // velocity: 25 conversions in 1h
      .mockResolvedValueOnce(1); // IP: 1 conversion

    const result = await analyzeConversion(baseParams);

    const velocitySignal = result.signals.find(
      (s) => s.rule === "conversion_velocity",
    );
    expect(velocitySignal).toBeDefined();
    expect(velocitySignal?.score).toBe(30);
  });

  it("should never block conversions (only flag)", async () => {
    // Even with high fraud score, blocked should be false
    mockDb.conversion.count.mockResolvedValue(30);

    const result = await analyzeConversion({
      ...baseParams,
      clickFraudScore: 70,
      timeSinceClickMs: 2000,
    });

    expect(result.blocked).toBe(false);
  });
});

describe("getFraudSummary", () => {
  it("should return admin dashboard fraud metrics", async () => {
    mockDb.click.count
      .mockResolvedValueOnce(15) // highRiskClicks
      .mockResolvedValueOnce(3); // blockedToday
    mockDb.conversion.count.mockResolvedValue(5); // underReviewConversions

    const summary = await getFraudSummary();

    expect(summary.highRiskClicks).toBe(15);
    expect(summary.underReviewConversions).toBe(5);
    expect(summary.blockedToday).toBe(3);
    expect(summary.thresholds).toHaveProperty("REJECT");
    expect(summary.thresholds).toHaveProperty("REVIEW");
    expect(summary.thresholds).toHaveProperty("BLOCK");
  });
});
