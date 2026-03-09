/**
 * Email — Transactional emails via Resend
 *
 * Templates for all StreamCPA email communications:
 *   - Welcome (streamer + brand onboarding)
 *   - Application status (approved/rejected)
 *   - Payout notifications (sent/failed)
 *   - Fraud alerts (admin)
 *   - Generic notification wrapper
 *
 * Uses Resend SDK for reliable delivery with automatic retries.
 */
import { Resend } from "resend";

// ==========================================
// CLIENT
// ==========================================

const resend = new Resend(process.env.RESEND_API_KEY!);
const FROM = process.env.EMAIL_FROM || "StreamCPA <noreply@streamcpa.com>";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

// ==========================================
// SEND EMAIL
// ==========================================

interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
}

export async function sendEmail({ to, subject, html, replyTo }: SendEmailParams) {
  try {
    const result = await resend.emails.send({
      from: FROM,
      to,
      subject,
      html,
      reply_to: replyTo,
    });
    return { success: true, id: result.data?.id };
  } catch (error: any) {
    console.error("[email] Failed to send:", error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Send email to multiple recipients (BCC style — individual sends)
 */
export async function sendBulkEmail(
  recipients: string[],
  subject: string,
  html: string,
) {
  const results = await Promise.allSettled(
    recipients.map((to) => sendEmail({ to, subject, html })),
  );

  const sent = results.filter((r) => r.status === "fulfilled").length;
  const failed = results.filter((r) => r.status === "rejected").length;

  return { sent, failed, total: recipients.length };
}

// ==========================================
// EMAIL TEMPLATES
// ==========================================

function baseLayout(content: string): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#7c3aed,#6d28d9);padding:24px 32px;">
              <h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:700;">StreamCPA</h1>
            </td>
          </tr>
          <!-- Content -->
          <tr>
            <td style="padding:32px;">
              ${content}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:16px 32px;background-color:#fafafa;border-top:1px solid #e4e4e7;">
              <p style="margin:0;color:#a1a1aa;font-size:12px;line-height:1.5;">
                StreamCPA — Affiliate Marketing for Streamers<br/>
                <a href="${APP_URL}" style="color:#7c3aed;text-decoration:none;">streamcpa.com</a> |
                <a href="${APP_URL}/terms" style="color:#7c3aed;text-decoration:none;">Terms</a> |
                <a href="${APP_URL}/privacy" style="color:#7c3aed;text-decoration:none;">Privacy</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function ctaButton(text: string, url: string): string {
  return `
  <table cellpadding="0" cellspacing="0" style="margin:24px 0;">
    <tr>
      <td style="background-color:#7c3aed;border-radius:8px;padding:12px 28px;">
        <a href="${url}" style="color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;display:inline-block;">${text}</a>
      </td>
    </tr>
  </table>`;
}

// ---- Template builders ----

export const emailTemplates = {
  /**
   * Welcome email for new streamers
   */
  welcomeStreamer(params: { name: string }) {
    return baseLayout(`
      <h2 style="margin:0 0 16px;color:#18181b;font-size:22px;">Welcome to StreamCPA!</h2>
      <p style="color:#3f3f46;line-height:1.6;margin:0 0 16px;">
        Hey ${params.name}, you're all set to start earning from your streams.
      </p>
      <p style="color:#3f3f46;line-height:1.6;margin:0 0 16px;">
        Here's how it works:
      </p>
      <ol style="color:#3f3f46;line-height:1.8;padding-left:20px;margin:0 0 16px;">
        <li>Browse campaigns in the <strong>Marketplace</strong></li>
        <li>Apply to campaigns that fit your audience</li>
        <li>Get your unique affiliate link</li>
        <li>Share it with your viewers and earn per conversion</li>
      </ol>
      <p style="color:#3f3f46;line-height:1.6;margin:0 0 8px;">
        Complete your profile to unlock more opportunities.
      </p>
      ${ctaButton("Complete Your Profile", `${APP_URL}/streamer/settings`)}
    `);
  },

  /**
   * Welcome email for new brands
   */
  welcomeBrand(params: { name: string; companyName: string }) {
    return baseLayout(`
      <h2 style="margin:0 0 16px;color:#18181b;font-size:22px;">Welcome to StreamCPA!</h2>
      <p style="color:#3f3f46;line-height:1.6;margin:0 0 16px;">
        Hi ${params.name}, thanks for registering ${params.companyName} on StreamCPA.
      </p>
      <p style="color:#3f3f46;line-height:1.6;margin:0 0 16px;">
        Our team will review your account shortly. Once verified, you'll be able to:
      </p>
      <ul style="color:#3f3f46;line-height:1.8;padding-left:20px;margin:0 0 16px;">
        <li>Create CPA campaigns with custom payout structures</li>
        <li>Access our network of verified streamers</li>
        <li>Track conversions in real-time with fraud protection</li>
        <li>Only pay for actual results</li>
      </ul>
      <p style="color:#3f3f46;line-height:1.6;margin:0 0 8px;">
        While you wait, you can start setting up your first campaign draft.
      </p>
      ${ctaButton("Go to Dashboard", `${APP_URL}/brand`)}
    `);
  },

  /**
   * Application status update
   */
  applicationStatus(params: {
    name: string;
    campaignName: string;
    status: "approved" | "rejected";
    message?: string;
  }) {
    const isApproved = params.status === "approved";
    const statusColor = isApproved ? "#16a34a" : "#dc2626";
    const statusText = isApproved ? "Approved" : "Rejected";

    return baseLayout(`
      <h2 style="margin:0 0 16px;color:#18181b;font-size:22px;">Application ${statusText}</h2>
      <p style="color:#3f3f46;line-height:1.6;margin:0 0 16px;">
        Hey ${params.name}, your application to <strong>${params.campaignName}</strong> has been
        <span style="color:${statusColor};font-weight:600;">${statusText.toLowerCase()}</span>.
      </p>
      ${isApproved ? `
        <p style="color:#3f3f46;line-height:1.6;margin:0 0 8px;">
          Your affiliate link is ready. Head to your dashboard to grab it and start promoting!
        </p>
        ${ctaButton("View Your Links", `${APP_URL}/streamer/links`)}
      ` : `
        <p style="color:#3f3f46;line-height:1.6;margin:0 0 16px;">
          ${params.message || "The brand has decided not to move forward at this time. Don't worry — there are plenty of other campaigns to explore!"}
        </p>
        ${ctaButton("Browse Campaigns", `${APP_URL}/streamer/marketplace`)}
      `}
    `);
  },

  /**
   * Payout notification
   */
  payoutNotification(params: {
    name: string;
    amount: number;
    method: string;
    status: "completed" | "failed";
    failureReason?: string;
  }) {
    const isCompleted = params.status === "completed";

    return baseLayout(`
      <h2 style="margin:0 0 16px;color:#18181b;font-size:22px;">
        Payout ${isCompleted ? "Sent" : "Failed"}
      </h2>
      <p style="color:#3f3f46;line-height:1.6;margin:0 0 16px;">
        Hey ${params.name},
      </p>
      ${isCompleted ? `
        <div style="background-color:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:20px;margin:0 0 16px;">
          <p style="margin:0 0 4px;color:#166534;font-size:14px;">Amount Sent</p>
          <p style="margin:0;color:#166534;font-size:28px;font-weight:700;">$${params.amount.toFixed(2)}</p>
          <p style="margin:4px 0 0;color:#166534;font-size:13px;">via ${params.method === "paypal" ? "PayPal" : "Wise"}</p>
        </div>
        <p style="color:#3f3f46;line-height:1.6;margin:0 0 8px;">
          The funds should appear in your ${params.method === "paypal" ? "PayPal" : "Wise"} account within 1-3 business days.
        </p>
      ` : `
        <div style="background-color:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:20px;margin:0 0 16px;">
          <p style="margin:0 0 4px;color:#991b1b;font-size:14px;">Payout Failed</p>
          <p style="margin:0;color:#991b1b;font-size:20px;font-weight:700;">$${params.amount.toFixed(2)}</p>
          ${params.failureReason ? `<p style="margin:8px 0 0;color:#991b1b;font-size:13px;">Reason: ${params.failureReason}</p>` : ""}
        </div>
        <p style="color:#3f3f46;line-height:1.6;margin:0 0 8px;">
          Please check your payout settings and ensure your ${params.method === "paypal" ? "PayPal" : "Wise"} email is correct. We'll retry automatically.
        </p>
      `}
      ${ctaButton("View Earnings", `${APP_URL}/streamer/earnings`)}
    `);
  },

  /**
   * Fraud alert (admin)
   */
  fraudAlert(params: {
    conversionId: string;
    campaignName: string;
    streamerName: string;
    fraudScore: number;
    signals: Array<{ rule: string; description: string }>;
  }) {
    const signalRows = params.signals
      .map(
        (s) =>
          `<tr><td style="padding:6px 12px;border-bottom:1px solid #e4e4e7;font-size:13px;color:#3f3f46;">${s.rule}</td><td style="padding:6px 12px;border-bottom:1px solid #e4e4e7;font-size:13px;color:#3f3f46;">${s.description}</td></tr>`,
      )
      .join("");

    return baseLayout(`
      <h2 style="margin:0 0 16px;color:#dc2626;font-size:22px;">Fraud Alert</h2>
      <p style="color:#3f3f46;line-height:1.6;margin:0 0 16px;">
        A conversion has been flagged for review with a fraud score of <strong style="color:#dc2626;">${params.fraudScore}/100</strong>.
      </p>
      <div style="background-color:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:16px;margin:0 0 16px;">
        <p style="margin:0 0 4px;color:#3f3f46;font-size:13px;"><strong>Campaign:</strong> ${params.campaignName}</p>
        <p style="margin:0 0 4px;color:#3f3f46;font-size:13px;"><strong>Streamer:</strong> ${params.streamerName}</p>
        <p style="margin:0;color:#3f3f46;font-size:13px;"><strong>Conversion ID:</strong> ${params.conversionId}</p>
      </div>
      <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 16px;border:1px solid #e4e4e7;border-radius:8px;overflow:hidden;">
        <tr style="background-color:#f4f4f5;">
          <th style="padding:8px 12px;text-align:left;font-size:12px;color:#71717a;font-weight:600;">Rule</th>
          <th style="padding:8px 12px;text-align:left;font-size:12px;color:#71717a;font-weight:600;">Description</th>
        </tr>
        ${signalRows}
      </table>
      ${ctaButton("Review in Admin Panel", `${APP_URL}/admin/fraud`)}
    `);
  },

  /**
   * Generic notification email
   */
  notification(params: {
    name: string;
    title: string;
    message: string;
    ctaText?: string;
    ctaUrl?: string;
  }) {
    return baseLayout(`
      <h2 style="margin:0 0 16px;color:#18181b;font-size:22px;">${params.title}</h2>
      <p style="color:#3f3f46;line-height:1.6;margin:0 0 16px;">
        Hey ${params.name},
      </p>
      <p style="color:#3f3f46;line-height:1.6;margin:0 0 16px;">
        ${params.message}
      </p>
      ${params.ctaText && params.ctaUrl ? ctaButton(params.ctaText, params.ctaUrl) : ""}
    `);
  },

  /**
   * Brand verification approved
   */
  brandVerified(params: { name: string; companyName: string }) {
    return baseLayout(`
      <h2 style="margin:0 0 16px;color:#18181b;font-size:22px;">Account Verified!</h2>
      <p style="color:#3f3f46;line-height:1.6;margin:0 0 16px;">
        Great news, ${params.name}! <strong>${params.companyName}</strong> has been verified on StreamCPA.
      </p>
      <p style="color:#3f3f46;line-height:1.6;margin:0 0 16px;">
        You can now:
      </p>
      <ul style="color:#3f3f46;line-height:1.8;padding-left:20px;margin:0 0 16px;">
        <li>Publish campaigns and start receiving applications</li>
        <li>Fund your escrow balance via credit card</li>
        <li>Access real-time conversion tracking</li>
      </ul>
      ${ctaButton("Create Your First Campaign", `${APP_URL}/brand/campaigns/new`)}
    `);
  },
};
