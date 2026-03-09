/**
 * Terms of Service — /terms
 *
 * Base legal terms adapted for a CPA streaming marketplace.
 * Covers: user accounts, brand/streamer responsibilities,
 * payments, fraud policy, and liability limitations.
 */
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Service — StreamCPA",
  description: "Terms of Service for StreamCPA, the CPA marketplace for streamers.",
};

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4">
          <Link href="/" className="text-lg font-bold">
            StreamCPA
          </Link>
          <Link
            href="/"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            Back to home
          </Link>
        </div>
      </header>

      {/* Content */}
      <main className="mx-auto max-w-3xl px-4 py-12">
        <div className="prose prose-neutral dark:prose-invert max-w-none">
          <h1>Terms of Service</h1>
          <p className="text-muted-foreground">
            Last updated: March 2026
          </p>

          <h2>1. Acceptance of Terms</h2>
          <p>
            By accessing or using StreamCPA (&quot;the Platform&quot;), you agree to be
            bound by these Terms of Service. If you do not agree, do not use the
            Platform. We reserve the right to update these terms at any time.
            Continued use after changes constitutes acceptance.
          </p>

          <h2>2. Account Registration</h2>
          <p>
            You must provide accurate, complete information when creating an
            account. You are responsible for maintaining the security of your
            account credentials and for all activities under your account. You
            must be at least 18 years old to register.
          </p>
          <ul>
            <li>
              <strong>Streamers</strong> must provide valid payment information
              and verify their streaming channel.
            </li>
            <li>
              <strong>Brands</strong> must verify their business identity and
              maintain a positive deposit balance.
            </li>
          </ul>

          <h2>3. Platform Services</h2>
          <p>
            StreamCPA connects brands with streamers for cost-per-action (CPA)
            advertising campaigns. The Platform provides:
          </p>
          <ul>
            <li>Campaign creation and management for brands</li>
            <li>Affiliate link generation and tracking for streamers</li>
            <li>Click and conversion tracking</li>
            <li>Automated fraud detection</li>
            <li>Payment processing and payout management</li>
          </ul>

          <h2>4. Payments and Payouts</h2>
          <p>
            Brands fund their campaigns by depositing funds into their Platform
            balance. Streamers earn commissions based on verified conversions.
            Payouts are processed according to the following terms:
          </p>
          <ul>
            <li>Minimum payout threshold: $50 USD</li>
            <li>Payout processing: within 7 business days of request</li>
            <li>StreamCPA retains a platform fee (displayed at campaign creation)</li>
            <li>Earnings from flagged conversions are held pending review</li>
          </ul>

          <h2>5. Fraud Policy</h2>
          <p>
            StreamCPA employs automated fraud detection systems. The following
            activities are strictly prohibited and will result in account
            termination and forfeiture of earnings:
          </p>
          <ul>
            <li>Generating fake clicks or conversions</li>
            <li>Using bots, scripts, or automated tools to inflate metrics</li>
            <li>Click stuffing or cookie stuffing</li>
            <li>Misrepresenting traffic sources</li>
            <li>Using VPNs or proxies to manipulate geographic targeting</li>
            <li>Any form of incentivized traffic not disclosed to the brand</li>
          </ul>
          <p>
            We reserve the right to withhold payouts and reverse conversions
            flagged by our fraud detection system. Decisions are final after
            internal review.
          </p>

          <h2>6. Content Guidelines</h2>
          <p>
            Streamers must comply with all applicable laws and platform-specific
            guidelines (Twitch, YouTube, etc.) when promoting campaigns.
            Streamers must clearly disclose sponsored content as required by
            FTC guidelines and local regulations.
          </p>

          <h2>7. Limitation of Liability</h2>
          <p>
            StreamCPA is provided &quot;as is&quot; without warranties of any kind. We
            are not liable for indirect, incidental, or consequential damages
            arising from use of the Platform. Our total liability is limited to
            the fees paid by you in the 12 months preceding the claim.
          </p>

          <h2>8. Termination</h2>
          <p>
            Either party may terminate their account at any time. Upon
            termination:
          </p>
          <ul>
            <li>Pending payouts for verified conversions will be processed</li>
            <li>Brand deposit balances (minus pending obligations) will be refunded</li>
            <li>Access to the Platform dashboard and data will be revoked</li>
          </ul>

          <h2>9. Governing Law</h2>
          <p>
            These terms are governed by the laws of the State of Delaware, USA.
            Any disputes will be resolved through binding arbitration.
          </p>

          <h2>10. Contact</h2>
          <p>
            For questions about these terms, contact us at{" "}
            <a href="mailto:legal@streamcpa.com">legal@streamcpa.com</a>.
          </p>
        </div>
      </main>
    </div>
  );
}
