/**
 * Stripe — Payment processing for StreamCPA
 *
 * Handles:
 *   - Brand deposits via Checkout Sessions (escrow funding)
 *   - Webhook event processing
 *   - Refund management
 *
 * All monetary operations go through Stripe. Brand deposits fund
 * their escrow balance, which pays streamer commissions.
 */
import Stripe from "stripe";
import { db } from "@/lib/db";
import { inngest } from "@/lib/inngest";

// ==========================================
// CLIENT
// ==========================================

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2024-06-20",
  typescript: true,
});

// ==========================================
// CHECKOUT SESSIONS (Brand Deposits)
// ==========================================

interface CreateDepositSessionParams {
  brandId: string;
  userId: string;
  amount: number; // in dollars
  successUrl: string;
  cancelUrl: string;
}

/**
 * Create a Stripe Checkout Session for a brand to deposit funds.
 * Minimum deposit: $50. Funds go to escrow balance on success.
 */
export async function createDepositSession({
  brandId,
  userId,
  amount,
  successUrl,
  cancelUrl,
}: CreateDepositSessionParams) {
  if (amount < 50) {
    throw new Error("Minimum deposit is $50");
  }

  if (amount > 50_000) {
    throw new Error("Maximum single deposit is $50,000");
  }

  // Create deposit record in PENDING state
  const deposit = await db.deposit.create({
    data: {
      brandId,
      amount,
      status: "PENDING",
    },
  });

  // Create Stripe Checkout Session
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card"],
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: {
            name: "StreamCPA Escrow Deposit",
            description: `Fund your campaign balance with $${amount.toFixed(2)}`,
          },
          unit_amount: Math.round(amount * 100), // cents
        },
        quantity: 1,
      },
    ],
    metadata: {
      depositId: deposit.id,
      brandId,
      userId,
      type: "escrow_deposit",
    },
    success_url: `${successUrl}?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: cancelUrl,
    expires_after: 30 * 60, // 30 minutes
  });

  // Link Stripe session to deposit
  await db.deposit.update({
    where: { id: deposit.id },
    data: { stripeSessionId: session.id },
  });

  return {
    sessionId: session.id,
    sessionUrl: session.url,
    depositId: deposit.id,
  };
}

// ==========================================
// WEBHOOK HANDLING
// ==========================================

/**
 * Verify and parse a Stripe webhook event.
 * Call this from the webhook route handler.
 */
export function constructWebhookEvent(
  body: string | Buffer,
  signature: string,
): Stripe.Event {
  return stripe.webhooks.constructEvent(
    body,
    signature,
    process.env.STRIPE_WEBHOOK_SECRET!,
  );
}

/**
 * Handle Stripe webhook events.
 * Returns a summary of what was processed.
 */
export async function handleWebhookEvent(
  event: Stripe.Event,
): Promise<{ handled: boolean; action?: string }> {
  switch (event.type) {
    case "checkout.session.completed":
      return handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);

    case "checkout.session.expired":
      return handleCheckoutExpired(event.data.object as Stripe.Checkout.Session);

    case "charge.refunded":
      return handleChargeRefunded(event.data.object as Stripe.Charge);

    case "payment_intent.payment_failed":
      return handlePaymentFailed(event.data.object as Stripe.PaymentIntent);

    default:
      return { handled: false };
  }
}

// ---- Checkout completed: fund escrow ----

async function handleCheckoutCompleted(
  session: Stripe.Checkout.Session,
): Promise<{ handled: boolean; action: string }> {
  const { depositId, brandId, userId } = session.metadata || {};

  if (!depositId || !brandId || session.metadata?.type !== "escrow_deposit") {
    return { handled: false, action: "ignored — not an escrow deposit" };
  }

  const amountPaid = (session.amount_total || 0) / 100; // cents to dollars

  // Update deposit and brand balance atomically
  await db.$transaction([
    db.deposit.update({
      where: { id: depositId },
      data: {
        status: "COMPLETED",
        stripePaymentIntentId: session.payment_intent as string,
      },
    }),
    db.brand.update({
      where: { id: brandId },
      data: {
        escrowBalance: { increment: amountPaid },
      },
    }),
  ]);

  // Notify brand
  await inngest.send({
    name: "notification/send",
    data: {
      userId: userId!,
      type: "SYSTEM",
      title: "Deposit Successful",
      message: `$${amountPaid.toFixed(2)} has been added to your escrow balance.`,
      link: "/brand/billing",
      sendEmail: true,
    },
  });

  return { handled: true, action: `deposit_completed: $${amountPaid}` };
}

// ---- Checkout expired: mark deposit failed ----

async function handleCheckoutExpired(
  session: Stripe.Checkout.Session,
): Promise<{ handled: boolean; action: string }> {
  const { depositId } = session.metadata || {};

  if (!depositId) {
    return { handled: false, action: "ignored — no depositId" };
  }

  await db.deposit.update({
    where: { id: depositId },
    data: { status: "FAILED" },
  });

  return { handled: true, action: "deposit_expired" };
}

// ---- Charge refunded: reverse escrow funding ----

async function handleChargeRefunded(
  charge: Stripe.Charge,
): Promise<{ handled: boolean; action: string }> {
  // Find deposit by payment intent
  const paymentIntentId = charge.payment_intent as string;
  if (!paymentIntentId) return { handled: false, action: "no payment_intent" };

  const deposit = await db.deposit.findFirst({
    where: { stripePaymentIntentId: paymentIntentId },
  });

  if (!deposit) return { handled: false, action: "deposit not found" };

  const refundAmount = (charge.amount_refunded || 0) / 100;

  await db.$transaction([
    db.deposit.update({
      where: { id: deposit.id },
      data: { status: "REFUNDED" },
    }),
    db.brand.update({
      where: { id: deposit.brandId },
      data: {
        escrowBalance: { decrement: refundAmount },
      },
    }),
  ]);

  return { handled: true, action: `refunded: $${refundAmount}` };
}

// ---- Payment failed ----

async function handlePaymentFailed(
  paymentIntent: Stripe.PaymentIntent,
): Promise<{ handled: boolean; action: string }> {
  const depositId = paymentIntent.metadata?.depositId;
  if (!depositId) return { handled: false, action: "no depositId" };

  await db.deposit.update({
    where: { id: depositId },
    data: { status: "FAILED" },
  });

  return { handled: true, action: "payment_failed" };
}

// ==========================================
// UTILITIES
// ==========================================

/**
 * Get deposit status from Stripe (for verification)
 */
export async function getSessionStatus(sessionId: string) {
  const session = await stripe.checkout.sessions.retrieve(sessionId);
  return {
    status: session.status,
    paymentStatus: session.payment_status,
    amountTotal: (session.amount_total || 0) / 100,
  };
}

/**
 * Create a refund for a deposit
 */
export async function createRefund(depositId: string, reason?: string) {
  const deposit = await db.deposit.findUniqueOrThrow({
    where: { id: depositId },
  });

  if (!deposit.stripePaymentIntentId) {
    throw new Error("Deposit has no payment intent — cannot refund");
  }

  if (deposit.status !== "COMPLETED") {
    throw new Error(`Cannot refund deposit in status: ${deposit.status}`);
  }

  const refund = await stripe.refunds.create({
    payment_intent: deposit.stripePaymentIntentId,
    reason: "requested_by_customer",
    metadata: {
      depositId: deposit.id,
      brandId: deposit.brandId,
      reason: reason || "Brand requested refund",
    },
  });

  return {
    refundId: refund.id,
    status: refund.status,
    amount: (refund.amount || 0) / 100,
  };
}
