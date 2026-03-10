/**
 * Cron: Payout Calculation — POST /api/cron/payouts
 *
 * Runs daily (or weekly) via Vercel Cron or external scheduler.
 * Triggers batch payout calculation for all eligible streamers.
 *
 * Protected by CRON_SECRET to prevent unauthorized execution.
 *
 * Vercel cron config (vercel.json):
 * {
 *   "crons": [{
 *     "path": "/api/cron/payouts",
 *     "schedule": "0 6 * * 1"  // Every Monday at 6 AM UTC
 *   }]
 * }
 */
import { NextRequest, NextResponse } from "next/server";
import { inngest } from "@/lib/inngest";

// ==========================================
// AUTH VALIDATION
// ==========================================

function validateCronAuth(req: NextRequest): boolean {
  // Vercel Cron sends this header automatically
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    console.warn("[cron/payouts] CRON_SECRET not set — allowing in development");
    return process.env.NODE_ENV === "development";
  }

  return authHeader === `Bearer ${cronSecret}`;
}

// ==========================================
// ROUTE HANDLER
// ==========================================

export async function POST(req: NextRequest) {
  // 1. Validate authorization
  if (!validateCronAuth(req)) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 },
    );
  }

  try {
    // 2. Determine payout period
    //    Default: last 7 days (weekly payouts)
    const now = new Date();
    const periodEnd = new Date(now);
    periodEnd.setHours(0, 0, 0, 0); // Start of today

    const periodStart = new Date(periodEnd);
    periodStart.setDate(periodStart.getDate() - 7); // 7 days ago

    // Allow custom period via query params
    const params = req.nextUrl.searchParams;
    const customStart = params.get("start");
    const customEnd = params.get("end");

    const start = customStart ? new Date(customStart) : periodStart;
    const end = customEnd ? new Date(customEnd) : periodEnd;

    // Validate dates
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return NextResponse.json(
        { error: "Invalid date parameters" },
        { status: 400 },
      );
    }

    if (start >= end) {
      return NextResponse.json(
        { error: "Start date must be before end date" },
        { status: 400 },
      );
    }

    // 3. Trigger batch payout calculation via Inngest
    await inngest.send({
      name: "payout/batch-calculate",
      data: {
        periodStart: start.toISOString(),
        periodEnd: end.toISOString(),
      },
    });

    console.log(
      `[cron/payouts] Triggered batch payout for period: ${start.toISOString()} - ${end.toISOString()}`,
    );

    return NextResponse.json(
      {
        ok: true,
        message: "Payout calculation triggered",
        period: {
          start: start.toISOString(),
          end: end.toISOString(),
        },
      },
      { status: 200 },
    );
  } catch (error: any) {
    console.error("[cron/payouts] Error:", error);
    return NextResponse.json(
      { error: "Failed to trigger payout calculation" },
      { status: 500 },
    );
  }
}

// Also support GET for Vercel Cron (which uses GET by default)
export async function GET(req: NextRequest) {
  return POST(req);
}
