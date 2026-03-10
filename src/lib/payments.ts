/**
 * Payment integrations — Stripe (brand deposits), PayPal & Wise (streamer payouts)
 */

// ==========================================
// STRIPE — Brand deposits (escrow)
// ==========================================

interface CreateCheckoutParams {
  brandId: string;
  amount: number; // USD cents
  stripeCustomerId?: string;
  successUrl: string;
  cancelUrl: string;
}

/**
 * Create a Stripe Checkout session for brand deposit
 */
export async function createStripeCheckout(params: CreateCheckoutParams) {
  // Dynamic import to avoid loading Stripe on every request
  const Stripe = (await import("stripe")).default;
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: "2023-10-16",
  });

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer: params.stripeCustomerId || undefined,
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: {
            name: "StreamCPA Campaign Deposit",
            description: "Funds for CPA campaign payouts",
          },
          unit_amount: params.amount, // in cents
        },
        quantity: 1,
      },
    ],
    metadata: {
      brandId: params.brandId,
    },
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
  });

  return session;
}

/**
 * Create or retrieve a Stripe customer for a brand
 */
export async function getOrCreateStripeCustomer(email: string, companyName: string) {
  const Stripe = (await import("stripe")).default;
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: "2023-10-16",
  });

  // Search for existing customer
  const existing = await stripe.customers.list({ email, limit: 1 });
  if (existing.data.length > 0) {
    return existing.data[0];
  }

  // Create new customer
  return stripe.customers.create({
    email,
    name: companyName,
    metadata: { source: "streamcpa" },
  });
}

// ==========================================
// PAYPAL — Streamer payouts
// ==========================================

interface PayPalPayoutParams {
  email: string;
  amount: number; // USD
  payoutId: string; // our internal payout ID
  note?: string;
}

/**
 * Get PayPal access token
 */
async function getPayPalToken(): Promise<string> {
  const mode = process.env.PAYPAL_MODE === "live" ? "api" : "api-m.sandbox";
  const res = await fetch(`https://${mode}.paypal.com/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(
        `${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`,
      ).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  if (!res.ok) throw new Error("Failed to get PayPal token");
  const data = await res.json();
  return data.access_token;
}

/**
 * Send PayPal payout to streamer
 */
export async function sendPayPalPayout(params: PayPalPayoutParams) {
  const token = await getPayPalToken();
  const mode = process.env.PAYPAL_MODE === "live" ? "api" : "api-m.sandbox";

  const res = await fetch(`https://${mode}.paypal.com/v1/payments/payouts`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      sender_batch_header: {
        sender_batch_id: `streamcpa_${params.payoutId}_${Date.now()}`,
        email_subject: "You have a payout from StreamCPA!",
        email_message: "Your StreamCPA earnings are here.",
      },
      items: [
        {
          recipient_type: "EMAIL",
          amount: {
            value: params.amount.toFixed(2),
            currency: "USD",
          },
          receiver: params.email,
          note: params.note || "StreamCPA earnings payout",
          sender_item_id: params.payoutId,
        },
      ],
    }),
  });

  if (!res.ok) {
    const error = await res.json();
    throw new Error(`PayPal payout failed: ${JSON.stringify(error)}`);
  }

  const data = await res.json();
  return {
    batchId: data.batch_header.payout_batch_id,
    status: data.batch_header.batch_status,
  };
}

// ==========================================
// WISE — International payouts
// ==========================================

interface WisePayoutParams {
  email: string;
  amount: number; // USD
  payoutId: string;
  recipientName: string;
}

/**
 * Send Wise payout to streamer
 */
export async function sendWisePayout(params: WisePayoutParams) {
  const baseUrl = "https://api.transferwise.com";
  const headers = {
    Authorization: `Bearer ${process.env.WISE_API_TOKEN}`,
    "Content-Type": "application/json",
  };

  // Step 1: Create a quote
  const quoteRes = await fetch(`${baseUrl}/v3/profiles/${process.env.WISE_PROFILE_ID}/quotes`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      sourceCurrency: "USD",
      targetCurrency: "USD",
      sourceAmount: params.amount,
      targetAmount: null,
      payOut: "BALANCE",
    }),
  });

  if (!quoteRes.ok) throw new Error("Wise quote creation failed");
  const quote = await quoteRes.json();

  // Step 2: Create recipient
  const recipientRes = await fetch(`${baseUrl}/v1/accounts`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      currency: "USD",
      type: "email",
      profile: process.env.WISE_PROFILE_ID,
      accountHolderName: params.recipientName,
      details: { email: params.email },
    }),
  });

  if (!recipientRes.ok) throw new Error("Wise recipient creation failed");
  const recipient = await recipientRes.json();

  // Step 3: Create transfer
  const transferRes = await fetch(`${baseUrl}/v1/transfers`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      targetAccount: recipient.id,
      quoteUuid: quote.id,
      customerTransactionId: `streamcpa_${params.payoutId}`,
      details: {
        reference: `StreamCPA payout ${params.payoutId}`,
      },
    }),
  });

  if (!transferRes.ok) throw new Error("Wise transfer creation failed");
  const transfer = await transferRes.json();

  // Step 4: Fund the transfer
  const fundRes = await fetch(
    `${baseUrl}/v3/profiles/${process.env.WISE_PROFILE_ID}/transfers/${transfer.id}/payments`,
    {
      method: "POST",
      headers,
      body: JSON.stringify({ type: "BALANCE" }),
    },
  );

  if (!fundRes.ok) throw new Error("Wise transfer funding failed");

  return {
    transferId: transfer.id.toString(),
    status: transfer.status,
  };
}
