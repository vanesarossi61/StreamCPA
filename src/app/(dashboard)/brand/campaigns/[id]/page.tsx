/**
 * Brand — Campaign Detail page
 * Route: /brand/campaigns/[id]
 *
 * Shows campaign metrics, streamer applications (approve/reject),
 * active streamers with their performance, materials, and settings.
 */
"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/use-toast";
import { formatCurrency, formatNumber, cn } from "@/lib/utils";
import {
  ArrowLeft,
  BarChart3,
  MousePointerClick,
  TrendingUp,
  DollarSign,
  Users,
  CheckCircle2,
  XCircle,
  Clock,
  MoreVertical,
  Loader2,
  ExternalLink,
  Pause,
  Play,
  Trash2,
  Globe,
  Target,
  Calendar,
} from "lucide-react";

const CAMPAIGN_STATUS: Record<string, { variant: any; color: string }> = {
  DRAFT: { variant: "secondary", color: "text-muted-foreground" },
  ACTIVE: { variant: "success", color: "text-brand-green" },
  PAUSED: { variant: "warning", color: "text-brand-orange" },
  COMPLETED: { variant: "info", color: "text-blue-500" },
  CANCELLED: { variant: "destructive", color: "text-destructive" },
};

export default function CampaignDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { toast } = useToast();
  const [confirmAction, setConfirmAction] = useState<{
    type: "approve" | "reject";
    applicationId: string;
    streamerName: string;
  } | null>(null);

  const { data: campaign, isLoading, refetch } = trpc.campaign.getCampaignDetail.useQuery({ id });

  const reviewApp = trpc.campaign.reviewApplication.useMutation({
    onSuccess: (_, vars) => {
      toast({
        title: vars.status === "APPROVED" ? "Application approved!" : "Application rejected",
      });
      setConfirmAction(null);
      refetch();
    },
    onError: (err) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const updateStatus = trpc.campaign.updateStatus.useMutation({
    onSuccess: () => {
      toast({ title: "Campaign status updated" });
      refetch();
    },
    onError: (err) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="flex flex-col items-center py-20">
        <p className="text-lg font-medium">Campaign not found</p>
        <Link href="/brand/campaigns">
          <Button variant="outline" className="mt-4">
            Back to Campaigns
          </Button>
        </Link>
      </div>
    );
  }

  const budgetUsedPct =
    campaign.totalBudget > 0
      ? Math.round(((campaign.totalBudget - campaign.remainingBudget) / campaign.totalBudget) * 100)
      : 0;

  const statusInfo = CAMPAIGN_STATUS[campaign.status] || CAMPAIGN_STATUS.DRAFT;

  const pendingApps = campaign.applications.filter((a) => a.status === "PENDING");
  const approvedApps = campaign.applications.filter((a) => a.status === "APPROVED");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/brand/campaigns">
            <Button variant="ghost" size="sm" className="gap-2">
              <ArrowLeft className="h-4 w-4" /> Back
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold tracking-tight">{campaign.name}</h1>
              <Badge variant={statusInfo.variant}>{campaign.status}</Badge>
            </div>
            <p className="text-muted-foreground">{campaign.description}</p>
          </div>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {campaign.status === "ACTIVE" && (
              <DropdownMenuItem
                onClick={() => updateStatus.mutate({ campaignId: campaign.id, status: "PAUSED" })}
              >
                <Pause className="mr-2 h-4 w-4" /> Pause Campaign
              </DropdownMenuItem>
            )}
            {campaign.status === "PAUSED" && (
              <DropdownMenuItem
                onClick={() => updateStatus.mutate({ campaignId: campaign.id, status: "ACTIVE" })}
              >
                <Play className="mr-2 h-4 w-4" /> Resume Campaign
              </DropdownMenuItem>
            )}
            {(campaign.status === "DRAFT" || campaign.status === "PAUSED") && (
              <DropdownMenuItem
                onClick={() =>
                  updateStatus.mutate({ campaignId: campaign.id, status: "CANCELLED" })
                }
                className="text-destructive"
              >
                <Trash2 className="mr-2 h-4 w-4" /> Cancel Campaign
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Metrics Cards */}
      <div className="grid gap-4 md:grid-cols-5">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <MousePointerClick className="h-4 w-4" /> Clicks
            </div>
            <p className="text-2xl font-bold">{formatNumber(campaign.totalClicks)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <TrendingUp className="h-4 w-4" /> Conversions
            </div>
            <p className="text-2xl font-bold">{formatNumber(campaign.totalConversions)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <BarChart3 className="h-4 w-4" /> CVR
            </div>
            <p className="text-2xl font-bold">
              {campaign.totalClicks > 0
                ? ((campaign.totalConversions / campaign.totalClicks) * 100).toFixed(1)
                : "0.0"}
              %
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <DollarSign className="h-4 w-4" /> Spent
            </div>
            <p className="text-2xl font-bold">{formatCurrency(campaign.spent)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Users className="h-4 w-4" /> Streamers
            </div>
            <p className="text-2xl font-bold">{approvedApps.length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Budget Progress */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Budget Usage</span>
            <span className="text-sm text-muted-foreground">
              {formatCurrency(campaign.spent)} / {formatCurrency(campaign.totalBudget)}
            </span>
          </div>
          <Progress value={budgetUsedPct} className="h-3" />
          <div className="flex items-center justify-between mt-2">
            <span className="text-xs text-muted-foreground">{budgetUsedPct}% used</span>
            <span className="text-xs text-muted-foreground">
              {formatCurrency(campaign.remainingBudget)} remaining
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Campaign Details */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="pt-6 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Payout/Conv</span>
              <span className="font-medium">{formatCurrency(campaign.payoutPerConversion)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Platform Fee</span>
              <span className="font-medium">{(campaign.platformFee * 100).toFixed(0)}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Conv. Type</span>
              <Badge variant="outline">{campaign.conversionType}</Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Attribution Window</span>
              <span className="font-medium">{campaign.attributionWindow}h</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Target URL</span>
              <a
                href={campaign.targetUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-primary hover:underline truncate max-w-[200px]"
              >
                {new URL(campaign.targetUrl).hostname}
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Min Followers</span>
              <span className="font-medium">{formatNumber(campaign.minFollowers)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Auto-Approve</span>
              <Badge variant={campaign.autoApprove ? "success" : "secondary"}>
                {campaign.autoApprove ? "Yes" : "No"}
              </Badge>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Countries</span>
              <span className="font-medium">
                {campaign.countries.length > 0 ? campaign.countries.join(", ") : "Global"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Categories</span>
              <span className="font-medium">
                {campaign.categories.length > 0 ? campaign.categories.join(", ") : "All"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Created</span>
              <span className="font-medium">
                {new Date(campaign.createdAt).toLocaleDateString()}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs: Applications & Active Streamers */}
      <Tabs defaultValue="applications">
        <TabsList>
          <TabsTrigger value="applications">
            Applications
            {pendingApps.length > 0 && (
              <Badge variant="warning" className="ml-2">
                {pendingApps.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="streamers">Active Streamers ({approvedApps.length})</TabsTrigger>
        </TabsList>

        {/* Pending Applications */}
        <TabsContent value="applications">
          <Card>
            <CardContent className="p-0">
              {pendingApps.length === 0 ? (
                <div className="flex flex-col items-center py-12">
                  <Clock className="h-10 w-10 text-muted-foreground" />
                  <p className="mt-4 text-sm text-muted-foreground">No pending applications</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Streamer</TableHead>
                      <TableHead className="text-right">Followers</TableHead>
                      <TableHead className="text-right">Avg Viewers</TableHead>
                      <TableHead className="text-right">Score</TableHead>
                      <TableHead>Applied</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendingApps.map((app) => (
                      <TableRow key={app.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="h-8 w-8">
                              <AvatarImage src={app.streamer.twitchAvatar || ""} />
                              <AvatarFallback>
                                {app.streamer.twitchDisplayName?.[0] || "S"}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-medium">{app.streamer.twitchDisplayName}</p>
                              <p className="text-xs text-muted-foreground">
                                @{app.streamer.twitchUsername}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          {formatNumber(app.streamer.twitchFollowers)}
                        </TableCell>
                        <TableCell className="text-right">{app.streamer.avgViewers}</TableCell>
                        <TableCell className="text-right">
                          <Badge variant="outline">{app.streamer.streamerScore}</Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {new Date(app.appliedAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              size="sm"
                              onClick={() =>
                                setConfirmAction({
                                  type: "approve",
                                  applicationId: app.id,
                                  streamerName: app.streamer.twitchDisplayName || "Streamer",
                                })
                              }
                              className="gap-1"
                            >
                              <CheckCircle2 className="h-3 w-3" /> Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                setConfirmAction({
                                  type: "reject",
                                  applicationId: app.id,
                                  streamerName: app.streamer.twitchDisplayName || "Streamer",
                                })
                              }
                              className="gap-1"
                            >
                              <XCircle className="h-3 w-3" /> Reject
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Active Streamers */}
        <TabsContent value="streamers">
          <Card>
            <CardContent className="p-0">
              {approvedApps.length === 0 ? (
                <div className="flex flex-col items-center py-12">
                  <Users className="h-10 w-10 text-muted-foreground" />
                  <p className="mt-4 text-sm text-muted-foreground">
                    No active streamers yet
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Streamer</TableHead>
                      <TableHead className="text-right">Clicks</TableHead>
                      <TableHead className="text-right">Conversions</TableHead>
                      <TableHead className="text-right">CVR</TableHead>
                      <TableHead className="text-right">Earnings</TableHead>
                      <TableHead className="text-right">Score</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {approvedApps.map((app) => {
                      const clicks = app.affiliateLink?.totalClicks || 0;
                      const convs = app.affiliateLink?.totalConversions || 0;
                      const cvr = clicks > 0 ? ((convs / clicks) * 100).toFixed(1) : "0.0";
                      return (
                        <TableRow key={app.id}>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <Avatar className="h-8 w-8">
                                <AvatarImage src={app.streamer.twitchAvatar || ""} />
                                <AvatarFallback>
                                  {app.streamer.twitchDisplayName?.[0] || "S"}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <p className="font-medium">{app.streamer.twitchDisplayName}</p>
                                <p className="text-xs text-muted-foreground">
                                  {formatNumber(app.streamer.twitchFollowers)} followers
                                </p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {formatNumber(clicks)}
                          </TableCell>
                          <TableCell className="text-right font-medium">{convs}</TableCell>
                          <TableCell className="text-right">{cvr}%</TableCell>
                          <TableCell className="text-right font-medium text-brand-green">
                            {formatCurrency(app.affiliateLink?.totalEarnings || 0)}
                          </TableCell>
                          <TableCell className="text-right">
                            <Badge variant="outline">{app.streamer.streamerScore}</Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Confirm Dialog */}
      <Dialog open={!!confirmAction} onOpenChange={() => setConfirmAction(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {confirmAction?.type === "approve" ? "Approve" : "Reject"} Application
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to {confirmAction?.type}{" "}
              <strong>{confirmAction?.streamerName}</strong>&apos;s application?
              {confirmAction?.type === "approve" &&
                " They will receive an affiliate link for this campaign."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmAction(null)}>
              Cancel
            </Button>
            <Button
              variant={confirmAction?.type === "approve" ? "default" : "destructive"}
              disabled={reviewApp.isLoading}
              onClick={() => {
                if (!confirmAction) return;
                reviewApp.mutate({
                  applicationId: confirmAction.applicationId,
                  status: confirmAction.type === "approve" ? "APPROVED" : "REJECTED",
                });
              }}
            >
              {reviewApp.isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {confirmAction?.type === "approve" ? "Approve" : "Reject"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
