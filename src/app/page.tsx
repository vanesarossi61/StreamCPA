/**
 * Landing page — public home route
 * Full marketing page with hero, how it works, features, CTA
 * Redirects authenticated users to their dashboard
 */
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default async function HomePage() {
  const session = await getServerSession(authOptions);

  if (session?.user) {
    const role = session.user.role;
    if (role === "STREAMER") redirect("/streamer");
    if (role === "BRAND") redirect("/brand");
    if (role === "ADMIN") redirect("/admin");
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* ========== HEADER ========== */}
      <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <h1 className="text-xl font-bold tracking-tight">
            Stream<span className="text-primary">CPA</span>
          </h1>
          <nav className="hidden items-center gap-6 text-sm text-muted-foreground md:flex">
            <a href="#how-it-works" className="hover:text-foreground transition-colors">
              How it works
            </a>
            <a href="#streamers" className="hover:text-foreground transition-colors">
              For Streamers
            </a>
            <a href="#brands" className="hover:text-foreground transition-colors">
              For Brands
            </a>
          </nav>
          <div className="flex gap-2">
            <Link href="/login">
              <Button variant="ghost" size="sm">Sign in</Button>
            </Link>
            <Link href="/register">
              <Button size="sm">Get started</Button>
            </Link>
          </div>
        </div>
      </header>

      {/* ========== HERO ========== */}
      <section className="flex flex-col items-center px-6 pb-20 pt-24 text-center">
        <div className="inline-flex items-center gap-2 rounded-full border bg-muted/50 px-4 py-1.5 text-sm text-muted-foreground">
          <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
          Now in open beta
        </div>
        <h2 className="mt-6 max-w-3xl text-5xl font-bold tracking-tight sm:text-6xl lg:text-7xl">
          The CPA Marketplace
          <br />
          <span className="text-primary">Built for Streamers</span>
        </h2>
        <p className="mt-6 max-w-xl text-lg text-muted-foreground">
          Connect with brands, promote products your audience loves, and earn
          real money per conversion. No minimum followers. Transparent tracking.
          Bi-weekly payouts.
        </p>
        <div className="mt-10 flex flex-col gap-4 sm:flex-row">
          <Link href="/register">
            <Button size="lg" className="w-full px-8 sm:w-auto">
              Start earning
            </Button>
          </Link>
          <Link href="/register?role=brand">
            <Button size="lg" variant="outline" className="w-full px-8 sm:w-auto">
              Launch a campaign
            </Button>
          </Link>
        </div>

        {/* Key stats */}
        <div className="mt-20 grid grid-cols-2 gap-8 sm:grid-cols-4 sm:gap-12">
          {[
            { value: "0", label: "Min. followers" },
            { value: "20%", label: "Platform fee" },
            { value: "14 days", label: "Payout cycle" },
            { value: "$10", label: "Min. withdrawal" },
          ].map((stat) => (
            <div key={stat.label}>
              <p className="text-3xl font-bold text-primary">{stat.value}</p>
              <p className="mt-1 text-sm text-muted-foreground">{stat.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ========== HOW IT WORKS ========== */}
      <section id="how-it-works" className="border-t bg-muted/30 px-6 py-20">
        <div className="mx-auto max-w-5xl">
          <h3 className="text-center text-3xl font-bold tracking-tight">
            How it works
          </h3>
          <p className="mt-3 text-center text-muted-foreground">
            Three steps to start earning from your streams.
          </p>

          <div className="mt-14 grid gap-8 md:grid-cols-3">
            {[
              {
                step: "1",
                title: "Sign up & connect Twitch",
                desc: "Create your account, link your Twitch channel, and we auto-import your stats. Takes under 2 minutes.",
              },
              {
                step: "2",
                title: "Find & apply to campaigns",
                desc: "Browse the marketplace for CPA offers that match your audience. Apply with one click — some auto-approve instantly.",
              },
              {
                step: "3",
                title: "Share links & get paid",
                desc: "Get your unique tracking link, share it on stream or in your panels, and earn money for every conversion.",
              },
            ].map((item) => (
              <div
                key={item.step}
                className="relative rounded-xl border bg-background p-6"
              >
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-lg font-bold text-primary-foreground">
                  {item.step}
                </div>
                <h4 className="text-lg font-semibold">{item.title}</h4>
                <p className="mt-2 text-sm text-muted-foreground">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ========== FOR STREAMERS ========== */}
      <section id="streamers" className="px-6 py-20">
        <div className="mx-auto max-w-5xl">
          <div className="flex flex-col items-center text-center">
            <span className="rounded-full bg-violet-100 px-3 py-1 text-xs font-medium text-violet-700 dark:bg-violet-900 dark:text-violet-300">
              For Streamers
            </span>
            <h3 className="mt-4 text-3xl font-bold tracking-tight">
              Turn your audience into income
            </h3>
            <p className="mt-3 max-w-lg text-muted-foreground">
              No more flat-rate sponsorships. With CPA, you earn based on real
              results — the more your audience converts, the more you make.
            </p>
          </div>

          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[
              {
                title: "No follower minimums",
                desc: "Any streamer can join. Your Streamer Score helps brands find you, but everyone gets access to the marketplace.",
              },
              {
                title: "Real-time tracking",
                desc: "See clicks, conversions, and earnings update in real-time on your dashboard. Full transparency, always.",
              },
              {
                title: "Multiple payout methods",
                desc: "Cash out via PayPal or Wise. $10 minimum, 14-day payout cycle. No hidden fees on withdrawals.",
              },
              {
                title: "Anti-fraud protection",
                desc: "Our system protects your earnings from fraudulent clicks. Only real conversions count — no chargebacks on you.",
              },
              {
                title: "One-click link generation",
                desc: "Get your unique tracking link instantly. Works on stream overlays, panels, chat, social media — anywhere.",
              },
              {
                title: "Performance analytics",
                desc: "Detailed stats by campaign, country, device. Know exactly what works for your audience.",
              },
            ].map((f) => (
              <div key={f.title} className="rounded-lg border p-5">
                <h4 className="font-semibold">{f.title}</h4>
                <p className="mt-2 text-sm text-muted-foreground">{f.desc}</p>
              </div>
            ))}
          </div>

          <div className="mt-10 text-center">
            <Link href="/register">
              <Button size="lg" className="px-8">
                Join as a Streamer
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* ========== FOR BRANDS ========== */}
      <section id="brands" className="border-t bg-muted/30 px-6 py-20">
        <div className="mx-auto max-w-5xl">
          <div className="flex flex-col items-center text-center">
            <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-700 dark:bg-blue-900 dark:text-blue-300">
              For Brands
            </span>
            <h3 className="mt-4 text-3xl font-bold tracking-tight">
              Pay only for results
            </h3>
            <p className="mt-3 max-w-lg text-muted-foreground">
              Launch CPA campaigns and reach thousands of streamers. You set the
              payout, budget, and targeting — pay only when real conversions
              happen.
            </p>
          </div>

          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[
              {
                title: "CPA pricing model",
                desc: "Define your own payout per conversion. Sales, signups, installs, subscriptions — any conversion type.",
              },
              {
                title: "Smart targeting",
                desc: "Filter streamers by category, country, min followers, and avg viewers. Reach exactly the right audience.",
              },
              {
                title: "Escrow-based budget",
                desc: "Deposit funds via Stripe. Budget is held in escrow and only spent on verified conversions.",
              },
              {
                title: "S2S postback tracking",
                desc: "Server-to-server conversion tracking with click IDs. Integrate with your existing attribution stack.",
              },
              {
                title: "Application control",
                desc: "Review streamer applications manually or enable auto-approve for faster scaling.",
              },
              {
                title: "Performance dashboard",
                desc: "Track spend, conversions, CVR, and ROAS by streamer. Full visibility into campaign performance.",
              },
            ].map((f) => (
              <div key={f.title} className="rounded-lg border bg-background p-5">
                <h4 className="font-semibold">{f.title}</h4>
                <p className="mt-2 text-sm text-muted-foreground">{f.desc}</p>
              </div>
            ))}
          </div>

          <div className="mt-10 text-center">
            <Link href="/register?role=brand">
              <Button size="lg" variant="outline" className="px-8">
                Launch a Campaign
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* ========== FINAL CTA ========== */}
      <section className="px-6 py-20">
        <div className="mx-auto max-w-3xl rounded-2xl bg-primary px-8 py-16 text-center text-primary-foreground">
          <h3 className="text-3xl font-bold tracking-tight">
            Ready to monetize your stream?
          </h3>
          <p className="mt-4 text-primary-foreground/80">
            Join StreamCPA today. Free to sign up, no commitments, start earning
            from your very first campaign.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-4 sm:flex-row">
            <Link href="/register">
              <Button
                size="lg"
                variant="secondary"
                className="w-full px-8 sm:w-auto"
              >
                Create free account
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* ========== FOOTER ========== */}
      <footer className="border-t px-6 py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 text-sm text-muted-foreground sm:flex-row">
          <p>
            Stream<span className="font-semibold text-foreground">CPA</span>{" "}
            &copy; {new Date().getFullYear()}. All rights reserved.
          </p>
          <div className="flex gap-6">
            <a href="#" className="hover:text-foreground transition-colors">
              Terms
            </a>
            <a href="#" className="hover:text-foreground transition-colors">
              Privacy
            </a>
            <a
              href="mailto:support@streamcpa.com"
              className="hover:text-foreground transition-colors"
            >
              Contact
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
