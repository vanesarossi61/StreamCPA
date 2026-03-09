/**
 * Wise (TransferWise) — Payout client for StreamCPA
 *
 * Uses Wise API v3 for international transfers to streamers.
 * Supports email-based transfers in multiple currencies.
 *
 * Flow: Create Quote -> Create Recipient -> Create Transfer -> Fund Transfer
 */

// ==========================================
// TYPES
// ==========================================

export interface WiseTransferRequest {
  email: string;
  amount: number;
  currency?: string;
  reference?: string;
}

export interface WiseTransferResult {
  transferId: string;
  status: string;
  quoteId: string;
}

export interface WiseTransferStatus {
  transferId: string;
  status: "incoming_payment_waiting" | "incoming_payment_initiated" | "processing" | "funds_converted" | "outgoing_payment_sent" | "bounced_back" | "cancelled";
  sourceAmount: number;
  targetAmount: number;
  sourceCurrency: string;
  targetCurrency: string;
  createdAt: string;
}

// ==========================================
// API CLIENT
// ==========================================

const WISE_BASE = process.env.WISE_MODE === "live"
  ? "https://api.transferwise.com"
  : "https://api.sandbox.transferwise.tech";

async function wiseFetch<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(`${WISE_BASE}${endpoint}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${process.env.WISE_API_TOKEN}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Wise API error: ${response.status} - ${errorBody}`);
  }

  return response.json();
}

/**
 * Get the Wise profile ID (business profile)
 */
async function getProfileId(): Promise<string> {
  const profiles = await wiseFetch<any[]>("/v2/profiles");
  const business = profiles.find((p) => p.type === "BUSINESS");
  if (!business) throw new Error("No Wise business profile found");
  return business.id;
}

// ==========================================
// PUBLIC FUNCTIONS
// ==========================================

/**
 * Create a Wise transfer to a streamer's email.
 * Full flow: Quote -> Recipient -> Transfer -> Fund
 */
export async function createWiseTransfer(
  request: WiseTransferRequest,
): Promise<WiseTransferResult> {
  const { email, amount, currency = "USD", reference } = request;

  if (amount < 1) throw new Error("Minimum transfer amount is $1");
  if (amount > 20_000) throw new Error("Maximum single transfer is $20,000");

  const profileId = await getProfileId();

  // Step 1: Create quote
  const quote = await wiseFetch<any>("/v3/profiles/" + profileId + "/quotes", {
    method: "POST",
    body: JSON.stringify({
      sourceCurrency: "USD",
      targetCurrency: currency,
      sourceAmount: amount,
      targetAmount: null,
      payOut: "BALANCE",
    }),
  });

  // Step 2: Create recipient (email-based)
  const recipient = await wiseFetch<any>("/v1/accounts", {
    method: "POST",
    body: JSON.stringify({
      profile: profileId,
      accountHolderName: email.split("@")[0], // Best effort name
      currency,
      type: "email",
      details: { email },
    }),
  });

  // Step 3: Create transfer
  const transfer = await wiseFetch<any>("/v1/transfers", {
    method: "POST",
    body: JSON.stringify({
      targetAccount: recipient.id,
      quoteUuid: quote.id,
      customerTransactionId: reference || `SCP_${Date.now()}`,
      details: {
        reference: reference || "StreamCPA Payout",
        transferPurpose: "verification.transfers.purpose.pay.bills",
        sourceOfFunds: "verification.source.of.funds.other",
      },
    }),
  });

  // Step 4: Fund the transfer from Wise balance
  await wiseFetch<any>(
    `/v3/profiles/${profileId}/transfers/${transfer.id}/payments`,
    {
      method: "POST",
      body: JSON.stringify({
        type: "BALANCE",
      }),
    },
  );

  return {
    transferId: transfer.id.toString(),
    status: transfer.status,
    quoteId: quote.id,
  };
}

/**
 * Get the status of a Wise transfer
 */
export async function getWiseTransferStatus(
  transferId: string,
): Promise<WiseTransferStatus> {
  const transfer = await wiseFetch<any>(`/v1/transfers/${transferId}`);

  return {
    transferId: transfer.id.toString(),
    status: transfer.status,
    sourceAmount: transfer.sourceValue,
    targetAmount: transfer.targetValue,
    sourceCurrency: transfer.sourceCurrency,
    targetCurrency: transfer.targetCurrency,
    createdAt: transfer.created,
  };
}
