/**
 * Privacy Policy — /privacy
 *
 * Privacy policy adapted for a CPA streaming marketplace.
 * Covers: data collection, tracking, third-party sharing,
 * cookies, and user rights.
 */
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy — StreamCPA",
  description: "Privacy Policy for StreamCPA, the CPA marketplace for streamers.",
};

export default function PrivacyPage() {
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
          <h1>Privacy Policy</h1>
          <p className="text-muted-foreground">
            Last updated: March 2026
          </p>

          <h2>1. Information We Collect</h2>

          <h3>1.1 Account Information</h3>
          <p>When you register, we collect:</p>
          <ul>
            <li>Name and email address</li>
            <li>Streaming platform username and channel URL</li>
            <li>Business name and website (for brands)</li>
            <li>Payment information (processed securely via Stripe)</li>
          </ul>

          <h3>1.2 Tracking Data</h3>
          <p>
            When end users click affiliate links, we collect:
          </p>
          <ul>
            <li>IP address (hashed and stored for fraud detection)</li>
            <li>User agent / browser information</li>
            <li>Referring URL</li>
            <li>Geographic location (country/region level)</li>
            <li>Timestamp of the click</li>
          </ul>

          <h3>1.3 Conversion Data</h3>
          <p>
            When brands report conversions via postback, we receive:
          </p>
          <ul>
            <li>Click ID (to match the originating click)</li>
            <li>Conversion amount</li>
            <li>Transaction or order reference (no personal buyer data)</li>
          </ul>

          <h3>1.4 Usage Data</h3>
          <p>
            We automatically collect platform usage data including pages visited,
            features used, and interaction patterns to improve the service.
          </p>

          <h2>2. How We Use Your Information</h2>
          <ul>
            <li>Provide and operate the Platform</li>
            <li>Track clicks and attribute conversions accurately</li>
            <li>Detect and prevent fraud</li>
            <li>Process payments and payouts</li>
            <li>Send transactional emails (payout confirmations, account alerts)</li>
            <li>Generate aggregate analytics for campaigns</li>
            <li>Improve the Platform and develop new features</li>
          </ul>

          <h2>3. Data Sharing</h2>
          <p>We share data only in these circumstances:</p>
          <ul>
            <li>
              <strong>Brands and Streamers:</strong> Campaign performance data
              (clicks, conversions, earnings) is shared between the parties
              involved in a campaign. No personal data of end users is shared.
            </li>
            <li>
              <strong>Payment Processors:</strong> Stripe processes all payments.
              We share only the minimum data required for transactions.
            </li>
            <li>
              <strong>Fraud Prevention:</strong> We may share anonymized fraud
              signals with industry partners to combat click fraud.
            </li>
            <li>
              <strong>Legal Requirements:</strong> We may disclose information
              when required by law, court order, or government request.
            </li>
          </ul>
          <p>
            We do <strong>not</strong> sell personal information to third parties.
          </p>

          <h2>4. Cookies and Tracking</h2>
          <p>StreamCPA uses cookies for:</p>
          <ul>
            <li>
              <strong>Authentication:</strong> Session cookies to keep you
              logged in.
            </li>
            <li>
              <strong>Affiliate Tracking:</strong> First-party cookies to
              attribute conversions to the correct affiliate link. These cookies
              expire after 30 days.
            </li>
            <li>
              <strong>Analytics:</strong> Anonymous usage analytics to improve
              the Platform.
            </li>
          </ul>
          <p>
            We do not use third-party advertising cookies or cross-site
            tracking.
          </p>

          <h2>5. Data Security</h2>
          <p>
            We implement industry-standard security measures including:
          </p>
          <ul>
            <li>TLS encryption for all data in transit</li>
            <li>Encrypted storage for sensitive data at rest</li>
            <li>IP address hashing for click data</li>
            <li>Role-based access controls</li>
            <li>Regular security audits</li>
          </ul>

          <h2>6. Data Retention</h2>
          <ul>
            <li>
              <strong>Account data:</strong> Retained while your account is
              active, deleted within 30 days of account closure.
            </li>
            <li>
              <strong>Click and conversion data:</strong> Retained for 24 months
              for reporting and fraud analysis, then anonymized.
            </li>
            <li>
              <strong>Financial records:</strong> Retained for 7 years as
              required by tax and financial regulations.
            </li>
          </ul>

          <h2>7. Your Rights</h2>
          <p>You have the right to:</p>
          <ul>
            <li>Access your personal data</li>
            <li>Correct inaccurate information</li>
            <li>Request deletion of your account and data</li>
            <li>Export your data in a portable format</li>
            <li>Opt out of non-essential communications</li>
          </ul>
          <p>
            To exercise these rights, contact{" "}
            <a href="mailto:privacy@streamcpa.com">privacy@streamcpa.com</a>.
          </p>

          <h2>8. International Data Transfers</h2>
          <p>
            StreamCPA operates from the United States. If you are accessing the
            Platform from outside the US, your data may be transferred to and
            processed in the US. We ensure appropriate safeguards are in place
            for international transfers.
          </p>

          <h2>9. Children&apos;s Privacy</h2>
          <p>
            StreamCPA is not intended for users under 18 years of age. We do not
            knowingly collect data from minors.
          </p>

          <h2>10. Changes to This Policy</h2>
          <p>
            We may update this policy periodically. We will notify registered
            users of material changes via email. Continued use of the Platform
            after changes constitutes acceptance.
          </p>

          <h2>11. Contact</h2>
          <p>
            For privacy questions or data requests, contact us at{" "}
            <a href="mailto:privacy@streamcpa.com">privacy@streamcpa.com</a>.
          </p>
        </div>
      </main>
    </div>
  );
}
