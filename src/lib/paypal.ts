/**
 * PayPal — Payout client for StreamCPA
 *
 * Uses PayPal Payouts API to send money to streamers.
 * Supports batch and individual payouts.
 *
 * Auth: Client Credentials (server-to-server)
 * API: PayPal REST v1 (Payouts)
 */

// ==========================================
// TYPES
// ==========================================

export interface PayoutRequest {
  email: string;
  amount: number;
  currency?: string;
  note?: string;
}

export interface PayoutResult {
  payoutBatchId: string;
  status: string;
}

export interface PayoutStatus {
  batchId: string;
  status: "PENDING" | "PROCESSING" | "SUCCESS" | "DENIED" | "CANCELED";
  items: Array<{
    payoutItemId: string;
    transactionStatus: string;
    amount: number;
    recipientEmail: string;
  }>;
}

// ==========================================
// TOKEN MANAGEMENT
// ==========================================

const PAYPAL_BASE = process.env.PAYPAL_MODE === "live"
  ? "https://api-m.paypal.com"
  : "https://api-m.sandbox.paypal.com";

let cachedToken: { token: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
    return cachedToken.token;
  }

  const credentials = Buffer.from(
    `${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_SECRET}`,
  ).toString("base64");

  const response = await fetch(`${PAYPAL_BASE}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  if (!response.ok) {
    throw new Error(`PayPal auth error: ${response.status}`);
  }

  const data = await response.json();
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };

  return cachedToken.token;
}

// ==========================================
// API HELPERS
// ==========================================

async function paypalFetch<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  const token = await getAccessToken();

  const response = await fetch(`${PAYPAL_BASE}${endpoint}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(
      `PayPal API error: ${response.status} - ${errorBody}`,
    );
  }

  return response.json();
}

// ==========================================
// PUBLIC FUNCTIONS
// ==========================================

/**
 * Create a PayPal payout to a streamer's email.
 * Uses the Payouts API (batch of 1).
 */
export async function createPayPalPayout(
  request: PayoutRequest,
): Promise<PayoutResult> {
  const { email, amount, currency = "USD", note } = request;

  if (amount < 1) throw new Error("Minimum payout amount is $1");
  if (amount > 20_000) throw new Error("Maximum single payout is $20,000");

  const senderBatchId = `SCP_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  const data = await paypalFetch<any>("/v1/payments/payouts", {
    method: "POST",
    body: JSON.stringify({
      sender_batch_header: {
        sender_batch_id: senderBatchId,
        email_subject: "You have a payout from StreamCPA!",
        email_message: note || "Your earnings have been sent.",
      },
      items: [
        {
          recipient_type: "EMAIL",
          amount: {
            value: amount.toFixed(2),
            currency,
          },
          receiver: email,
          note: note || `StreamCPA payout - ${senderBatchId}`,
          sender_item_id: senderBatchId,
        },
      ],
    }),
  });

  return {
    payoutBatchId: data.batch_header?.payout_batch_id || senderBatchId,
    status: data.batch_header?.batch_status || "PENDING",
  };
}

/**
 * Check the status of a payout batch
 */
export async function getPayPalPayoutStatus(
  batchId: string,
): Promise<PayoutStatus> {
  const data = await paypalFetch<any>(
    `/v1/payments/payouts/${encodeURIComponent(batchId)}`,
  );

  return {
    batchId: data.batch_header.payout_batch_id,
    status: data.batch_header.batch_status,
    items: (data.items || []).map((item: any) => ({
      payoutItemId: item.payout_item_id,
      transactionStatus: item.transaction_status,
      amount: parseFloat(item.payout_item.amount.value),
      recipientEmail: item.payout_item.receiver,
    })),
  };
}
