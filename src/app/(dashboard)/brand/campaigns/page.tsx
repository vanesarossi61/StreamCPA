/**
 * Brand — My Campaigns list with status management
 * Route: /brand/campaigns
 */
"use client";

import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { formatCurrency, formatNumber } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { Plus, Megaphone, Play, Pause, Users, MousePointerClick, TrendingUp, Loader2, DollarSign } from "lucide-react";

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-muted text-muted-foreground",
  ACTIVE: "bg-brand-green/10 text-brand-green",
  PAUSED: "bg-brand-orange/10 text-brand-orange",
  COMPLETED: "bg-secondary text-secondary-foreground",
  CANCELLED: "bg-destructive/10 text-destructive",
};

export default function BrandCampaignsPage() {
  const { toast } = useToast();
  const { data: campaigns, isLoading, refetch } = trpc.campaign.listMyCampaigns.useQuery();

  const updateStatus = trpc.campaign.updateStatus.useMutation({
    onSuccess: () => { refetch(); toast({ title: "Campaign updated!" }); },
    onError: (err) => { toast({ title: "Error", description: err.message, variant: "destructive" }); },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">My Campaigns</h1>
          <p className="text-muted-foreground">Create and manage your CPA campaigns.</p>
        </div>
        <Link href="/brand/campaigns/new">
          <Button className="gap-2"><Plus className="h-4 w-4" /> New Campaign</Button>
        </Link>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : !campaigns?.length ? (
        <Card>
          <CardContent className="flex flex-col items-center py-16">
            <Megaphone className="h-12 w-12 text-muted-foreground" />
            <p className="mt-4 text-lg font-medium">No campaigns yet</p>
            <p className="text-sm text-muted-foreground mb-4">Create your first CPA campaign to start reaching streamers.</p>
            <Link href="/brand/campaigns/new"><Button>Create Campaign</Button></Link>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {campaigns.map((campaign) => (
            <Card key={campaign.id}>
              <CardContent className="pt-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Link href={`/brand/campaigns/${campaign.id}`} className="text-lg font-semibold hover:text-primary">
                        {campaign.name}
                      </Link>
                      <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", STATUS_COLORS[campaign.status])}>
                        {campaign.status}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1"><DollarSign className="h-3 w-3" />{formatCurrency(campaign.payoutPerConversion)}/conv</span>
                      <span className="flex items-center gap-1"><Users className="h-3 w-3" />{campaign._count.applications} streamers</span>
                      <span className="flex items-center gap-1"><MousePointerClick className="h-3 w-3" />{formatNumber(campaign._count.clicks)} clicks</span>
                      <span className="flex items-center gap-1"><TrendingUp className="h-3 w-3" />{campaign._count.conversions} conversions</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>Budget: {formatCurrency(campaign.spent)} / {formatCurrency(campaign.totalBudget)}</span>
                      <span>|</span>
                      <span>{campaign.conversionType}</span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {campaign.status === "DRAFT" && (
                      <Button size="sm" onClick={() => updateStatus.mutate({ id: campaign.id, status: "ACTIVE" })} className="gap-1">
                        <Play className="h-3 w-3" /> Activate
                      </Button>
                    )}
                    {campaign.status === "ACTIVE" && (
                      <Button size="sm" variant="outline" onClick={() => updateStatus.mutate({ id: campaign.id, status: "PAUSED" })} className="gap-1">
                        <Pause className="h-3 w-3" /> Pause
                      </Button>
                    )}
                    {campaign.status === "PAUSED" && (
                      <Button size="sm" onClick={() => updateStatus.mutate({ id: campaign.id, status: "ACTIVE" })} className="gap-1">
                        <Play className="h-3 w-3" /> Resume
                      </Button>
                    )}
                    <Link href={`/brand/campaigns/${campaign.id}`}>
                      <Button size="sm" variant="ghost">View</Button>
                    </Link>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
