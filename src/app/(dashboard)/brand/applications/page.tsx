/**
 * Brand — Applications Management page
 * Route: /brand/applications
 *
 * View and manage streamer applications across all campaigns.
 * Filter by campaign, status, and sort by score/followers.
 */
"use client";

import { useState } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { useToast } from "@/components/ui/use-toast";
import { formatNumber, cn } from "@/lib/utils";
import {
  Users,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  FileText,
  Filter,
  Inbox,
} from "lucide-react";

const STATUS_CONFIG: Record<string, { variant: any; label: string; icon: any }> = {
  PENDING: { variant: "warning", label: "Pending", icon: Clock },
  APPROVED: { variant: "success", label: "Approved", icon: CheckCircle2 },
  REJECTED: { variant: "destructive", label: "Rejected", icon: XCircle },
  WITHDRAWN: { variant: "secondary", label: "Withdrawn", icon: FileText },
};

export default function BrandApplicationsPage() {
  const { toast } = useToast();
  const [filterCampaign, setFilterCampaign] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [confirmAction, setConfirmAction] = useState<{
    type: "approve" | "reject";
    applicationId: string;
    streamerName: string;
  } | null>(null);

  const { data: applications, isLoading, refetch } =
    trpc.campaign.getAllApplications.useQuery();
  const { data: campaigns } = trpc.campaign.listMyCampaigns.useQuery();

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

  // Filter applications
  const filteredApps = applications?.filter((app) => {
    if (filterCampaign !== "all" && app.campaignId !== filterCampaign) return false;
    if (filterStatus !== "all" && app.status !== filterStatus) return false;
    return true;
  });

  // Stats
  const pendingCount = applications?.filter((a) => a.status === "PENDING").length || 0;
  const approvedCount = applications?.filter((a) => a.status === "APPROVED").length || 0;
  const totalCount = applications?.length || 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Applications</h1>
        <p className="text-muted-foreground">
          Manage streamer applications across all your campaigns.
        </p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-3 pt-6">
            <div className="rounded-lg bg-brand-orange/10 p-2">
              <Clock className="h-5 w-5 text-brand-orange" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Pending Review</p>
              <p className="text-2xl font-bold">{pendingCount}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 pt-6">
            <div className="rounded-lg bg-brand-green/10 p-2">
              <CheckCircle2 className="h-5 w-5 text-brand-green" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Approved</p>
              <p className="text-2xl font-bold">{approvedCount}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 pt-6">
            <div className="rounded-lg bg-primary/10 p-2">
              <Users className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Applications</p>
              <p className="text-2xl font-bold">{totalCount}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <Filter className="h-4 w-4 text-muted-foreground" />
        <Select value={filterCampaign} onValueChange={setFilterCampaign}>
          <SelectTrigger className="w-[250px]">
            <SelectValue placeholder="All Campaigns" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Campaigns</SelectItem>
            {campaigns?.campaigns?.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="PENDING">Pending</SelectItem>
            <SelectItem value="APPROVED">Approved</SelectItem>
            <SelectItem value="REJECTED">Rejected</SelectItem>
            <SelectItem value="WITHDRAWN">Withdrawn</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Applications Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : !filteredApps?.length ? (
            <div className="flex flex-col items-center py-16">
              <Inbox className="h-12 w-12 text-muted-foreground" />
              <p className="mt-4 text-lg font-medium">No applications found</p>
              <p className="text-sm text-muted-foreground">
                {filterCampaign !== "all" || filterStatus !== "all"
                  ? "Try adjusting your filters."
                  : "Applications will appear here when streamers apply to your campaigns."}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Streamer</TableHead>
                  <TableHead>Campaign</TableHead>
                  <TableHead className="text-right">Followers</TableHead>
                  <TableHead className="text-right">Avg Viewers</TableHead>
                  <TableHead className="text-right">Score</TableHead>
                  <TableHead>Applied</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredApps.map((app) => {
                  const statusConfig = STATUS_CONFIG[app.status] || STATUS_CONFIG.PENDING;
                  const StatusIcon = statusConfig.icon;

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
                            <p className="font-medium">
                              {app.streamer.twitchDisplayName || "Unknown"}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              @{app.streamer.twitchUsername}
                              {app.streamer.country && ` · ${app.streamer.country}`}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Link
                          href={`/brand/campaigns/${app.campaignId}`}
                          className="font-medium text-primary hover:underline"
                        >
                          {app.campaign.name}
                        </Link>
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
                      <TableCell className="text-center">
                        <Badge variant={statusConfig.variant}>
                          <StatusIcon className="mr-1 h-3 w-3" />
                          {statusConfig.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {app.status === "PENDING" && (
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              size="sm"
                              onClick={() =>
                                setConfirmAction({
                                  type: "approve",
                                  applicationId: app.id,
                                  streamerName:
                                    app.streamer.twitchDisplayName || "Streamer",
                                })
                              }
                              className="gap-1 h-7 text-xs"
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
                                  streamerName:
                                    app.streamer.twitchDisplayName || "Streamer",
                                })
                              }
                              className="gap-1 h-7 text-xs"
                            >
                              <XCircle className="h-3 w-3" /> Reject
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

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
                " They will receive an affiliate link for the campaign."}
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
