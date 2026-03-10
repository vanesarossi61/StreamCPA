/**
 * Streamer Dashboard — full metrics, earnings chart, active campaigns, links
 * Route: /streamer
 */
"use client";

import { useState } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/utils";
import {
  DollarSign,
  MousePointerClick,
  TrendingUp,
  BarChart3,
  Wallet,
  Link2,
  Copy,
  Check,
  ExternalLink,
  Loader2,
  ArrowRight,
} from "lucide-react";

export default function StreamerDashboard() {
  const { toast } = useToast();
  const [copiedSlug, setCopiedSlug] = useState<string | null>(null);

  const { data: dashboard, isLoading } = trpc.streamer.getDashboard.useQuery();
  const { data: links } = trpc.tracking.listMyLinks.useQuery();
  const { data: payoutsData } = trpc.payout.getMyPayouts.useQuery();

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  function copyLink(slug: string) {
    const url = `${window.location.origin}/r/${slug}`;
    navigator.clipboard.writeText(url);
    setCopiedSlug(slug);
    toast({ title: "Link copied!", description: url });
    setTimeout(() => setCopiedSlug(null), 2000);
  }

  const trackingDomain = process.env.NEXT_PUBLIC_TRACKING_DOMAIN || window.location.origin;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">
            Welcome back{dashboard?.twitchDisplayName ? `, ${dashboard.twitchDisplayName}` : ""}!
          </p>
        </div>
        <Link href="/marketplace">
          <Button className="gap-2">
            Find Offers <ArrowRight className="h-4 w-4" />
          </Button>
        </Link>
      </div>

      {/* Metric cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Available Balance</CardTitle>
            <Wallet className="h-4 w-4 text-brand-green" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-brand-green">
              {formatCurrency(dashboard?.balanceAvailable || 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              {formatCurrency(dashboard?.balancePending || 0)} pending
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Earned</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(dashboard?.totalEarned || 0)}</div>
            <p className="text-xs text-muted-foreground">All time</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Clicks</CardTitle>
            <MousePointerClick className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(dashboard?.totalClicks || 0)}</div>
            <p className="text-xs text-muted-foreground">Across all links</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Conversions</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dashboard?.totalConversions || 0}</div>
            <p className="text-xs text-muted-foreground">Approved + pending</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">EPC</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(dashboard?.epc || 0)}</div>
            <p className="text-xs text-muted-foreground">Earnings per click</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* My Links — copiable */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>My Affiliate Links</CardTitle>
            <Link href="/streamer/links" className="text-sm text-primary hover:underline">
              View all
            </Link>
          </CardHeader>
          <CardContent>
            {!links?.length ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                No links yet. Apply to campaigns in the{" "}
                <Link href="/marketplace" className="text-primary hover:underline">marketplace</Link>.
              </div>
            ) : (
              <div className="space-y-3">
                {links.slice(0, 5).map((link) => (
                  <div
                    key={link.id}
                    className="flex items-center justify-between rounded-lg border p-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{link.campaign.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {trackingDomain}/r/{link.slug}
                        {" · "}
                        {formatNumber(link.totalClicks)} clicks
                        {" · "}
                        {link.totalConversions} conv
                        {" · "}
                        <span className="text-brand-green">{formatCurrency(link.totalEarnings)}</span>
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => copyLink(link.slug)}
                      className="shrink-0"
                    >
                      {copiedSlug === link.slug ? (
                        <Check className="h-4 w-4 text-brand-green" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Payouts */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Recent Payouts</CardTitle>
            <Link href="/streamer/earnings" className="text-sm text-primary hover:underline">
              View all
            </Link>
          </CardHeader>
          <CardContent>
            {!payoutsData?.payouts.length ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                No payouts yet. Earn at least $10 to request a withdrawal.
              </div>
            ) : (
              <div className="space-y-3">
                {payoutsData.payouts.slice(0, 5).map((payout) => (
                  <div
                    key={payout.id}
                    className="flex items-center justify-between rounded-lg border p-3"
                  >
                    <div>
                      <p className="text-sm font-medium">{formatCurrency(payout.amount)}</p>
                      <p className="text-xs text-muted-foreground">
                        {payout.method.toUpperCase()} · {new Date(payout.requestedAt).toLocaleDateString()}
                      </p>
                    </div>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        payout.status === "COMPLETED"
                          ? "bg-brand-green/10 text-brand-green"
                          : payout.status === "FAILED"
                            ? "bg-destructive/10 text-destructive"
                            : "bg-brand-orange/10 text-brand-orange"
                      }`}
                    >
                      {payout.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Streamer Score */}
      <Card>
        <CardContent className="flex items-center justify-between py-4">
          <div>
            <p className="text-sm font-medium">Your Streamer Score</p>
            <p className="text-xs text-muted-foreground">
              Higher score = access to premium campaigns
            </p>
          </div>
          <div className="text-right">
            <span className="text-2xl font-bold text-primary">{dashboard?.streamerScore || 0}</span>
            <span className="text-sm text-muted-foreground">/200</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
