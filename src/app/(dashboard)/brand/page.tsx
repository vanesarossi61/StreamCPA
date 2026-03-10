/**
 * Brand Dashboard — spend, conversions, CVR, ROAS, streamer performance
 * Route: /brand
 */
"use client";

import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/utils";
import {
  DollarSign,
  Users,
  TrendingUp,
  Target,
  Wallet,
  Plus,
  Loader2,
  ArrowRight,
  Megaphone,
} from "lucide-react";

export default function BrandDashboard() {
  const { data: dashboard, isLoading } = trpc.brand.getDashboard.useQuery();
  const { data: campaigns } = trpc.campaign.listMyCampaigns.useQuery();

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const activeCampaigns = campaigns?.filter((c) => c.status === "ACTIVE") || [];
  const totalClicks = campaigns?.reduce((sum, c) => sum + c._count.clicks, 0) || 0;
  const totalConversions = campaigns?.reduce((sum, c) => sum + c._count.conversions, 0) || 0;
  const cvr = totalClicks > 0 ? totalConversions / totalClicks : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Brand Dashboard</h1>
          <p className="text-muted-foreground">
            {dashboard?.companyName ? `Welcome, ${dashboard.companyName}` : "Manage your campaigns"}
          </p>
        </div>
        <Link href="/brand/campaigns/new">
          <Button className="gap-2">
            <Plus className="h-4 w-4" /> New Campaign
          </Button>
        </Link>
      </div>

      {/* Metric cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Escrow Balance</CardTitle>
            <Wallet className="h-4 w-4 text-brand-green" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-brand-green">
              {formatCurrency(dashboard?.escrowBalance || 0)}
            </div>
            <Link href="/brand/billing" className="text-xs text-primary hover:underline">
              Add funds
            </Link>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Spent</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(dashboard?.totalSpent || 0)}</div>
            <p className="text-xs text-muted-foreground">All time</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Streamers</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dashboard?.activeStreamers || 0}</div>
            <p className="text-xs text-muted-foreground">Promoting your offers</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Conversions</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalConversions}</div>
            <p className="text-xs text-muted-foreground">
              {formatNumber(totalClicks)} clicks total
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">CVR</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatPercent(cvr)}</div>
            <p className="text-xs text-muted-foreground">Conversion rate</p>
          </CardContent>
        </Card>
      </div>

      {/* Active Campaigns */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Active Campaigns</CardTitle>
          <Link href="/brand/campaigns" className="text-sm text-primary hover:underline">
            View all ({campaigns?.length || 0})
          </Link>
        </CardHeader>
        <CardContent>
          {!activeCampaigns.length ? (
            <div className="flex flex-col items-center py-8 text-center">
              <Megaphone className="h-10 w-10 text-muted-foreground" />
              <p className="mt-3 text-sm text-muted-foreground">No active campaigns</p>
              <Link href="/brand/campaigns/new">
                <Button size="sm" className="mt-3">Create Campaign</Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {activeCampaigns.slice(0, 5).map((campaign) => {
                const campCvr = campaign._count.clicks > 0
                  ? campaign._count.conversions / campaign._count.clicks
                  : 0;
                const budgetUsed = campaign.totalBudget > 0
                  ? campaign.spent / campaign.totalBudget
                  : 0;

                return (
                  <div
                    key={campaign.id}
                    className="flex items-center justify-between rounded-lg border p-4"
                  >
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/brand/campaigns/${campaign.id}`}
                        className="font-medium hover:text-primary"
                      >
                        {campaign.name}
                      </Link>
                      <div className="mt-1 flex items-center gap-4 text-xs text-muted-foreground">
                        <span>{formatCurrency(campaign.payoutPerConversion)}/conv</span>
                        <span>{campaign._count.applications} streamers</span>
                        <span>{formatNumber(campaign._count.clicks)} clicks</span>
                        <span>{campaign._count.conversions} conv</span>
                        <span>CVR: {formatPercent(campCvr)}</span>
                      </div>
                      {/* Budget progress bar */}
                      <div className="mt-2 h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-secondary">
                        <div
                          className="h-full rounded-full bg-primary transition-all"
                          style={{ width: `${Math.min(budgetUsed * 100, 100)}%` }}
                        />
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {formatCurrency(campaign.spent)} / {formatCurrency(campaign.totalBudget)} budget used
                      </p>
                    </div>
                    <Link href={`/brand/campaigns/${campaign.id}`}>
                      <Button variant="ghost" size="sm">
                        <ArrowRight className="h-4 w-4" />
                      </Button>
                    </Link>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
