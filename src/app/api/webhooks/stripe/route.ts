/**
 * Stripe Webhook — POST /api/webhooks/stripe
 *
 * Handles Stripe events for payment processing:
 *   - checkout.session.completed (deposit funded)
 *   - checkout.session.expired (deposit cancelled)
 *   - charge.refunded (deposit reversed)
 *   - payment_intent.payment_failed (payment error)
 *
 * Uses raw body for signature verification (required by Stripe).
 */
import { NextRequest, NextResponse } from "next/server";
import { constructWebhookEvent, handleWebhookEvent } from "@/lib/stripe";

export async function POST(req: NextRequest) {
  const signature = req.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json(
      { error: "Missing stripe-signature header" },
      { status: 400 },
    );
  }

  try {
    // 1. Get raw body for signature verification
    const body = await req.text();

    // 2. Verify signature and parse event
    const event = constructWebhookEvent(body, signature);

    // 3. Process the event
    const result = await handleWebhookEvent(event);

    console.log(
      `[stripe-webhook] ${event.type}: ${result.handled ? result.action : "not handled"}`,
    );

    return NextResponse.json(
      { received: true, handled: result.handled, action: result.action },
      { status: 200 },
    );
  } catch (error: any) {
    console.error("[stripe-webhook] Error:", error.message);

    // Stripe sends invalid signatures during testing
    if (error.message.includes("signature")) {
      return NextResponse.json(
        { error: "Invalid webhook signature" },
        { status: 400 },
      );
    }

    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 500 },
    );
  }
}
