"use client";

import { useState } from "react";
import { api } from "@/lib/trpc";
import { DataTable, StatusBadge } from "@/components/dashboard/data-table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatsGrid, CountStatCard, MoneyStatCard } from "@/components/dashboard/stats-cards";

// ==========================================
// Types
// ==========================================

type CampaignStatus = "DRAFT" | "PENDING" | "ACTIVE" | "PAUSED" | "ENDED" | "REJECTED";

interface CampaignRow {
  id: string;
  name: string;
  slug: string;
  status: CampaignStatus;
  payoutAmount: number;
  budget: number;
  spent: number;
  category: string | null;
  createdAt: string;
  brand: {
    name: string | null;
    email: string;
  };
  _count: {
    links: number;
    conversions: number;
  };
}

// ==========================================
// Campaign Detail / Moderation Panel
// ==========================================

function CampaignModerationPanel({
  campaign,
  onClose,
  onApprove,
  onReject,
  onPause,
  isLoading,
}: {
  campaign: CampaignRow;
  onClose: () => void;
  onApprove: (id: string) => void;
  onReject: (id: string, reason: string) => void;
  onPause: (id: string) => void;
  isLoading: boolean;
}) {
  const [rejectReason, setRejectReason] = useState("");
  const [showRejectForm, setShowRejectForm] = useState(false);

  const budgetUsedPct = campaign.budget > 0
    ? Math.round((campaign.spent / campaign.budget) * 100)
    : 0;

  return (
    <Card className="border-2 border-blue-200">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-lg">{campaign.name}</CardTitle>
          <p className="text-sm text-muted-foreground">
            by {campaign.brand.name || campaign.brand.email} &middot;{" "}
            {campaign.category || "Uncategorized"}
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={onClose}>
          Close
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
          <div>
            <p className="text-xs text-muted-foreground">Status</p>
            <StatusBadge
              status={campaign.status}
              map={{
                DRAFT: "default",
                PENDING: "warning",
                ACTIVE: "success",
                PAUSED: "info",
                ENDED: "default",
                REJECTED: "error",
              }}
            />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">CPA</p>
            <p className="font-semibold">${campaign.payoutAmount}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Budget</p>
            <p className="font-semibold">
              ${campaign.spent.toLocaleString()} / ${campaign.budget.toLocaleString()}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Budget Used</p>
            <p className="font-semibold">{budgetUsedPct}%</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Links / Conv</p>
            <p className="font-semibold">
              {campaign._count.links} / {campaign._count.conversions}
            </p>
          </div>
        </div>

        <div className="text-xs text-muted-foreground">
          Created {new Date(campaign.createdAt).toLocaleDateString()}
        </div>

        {/* Moderation actions */}
        <div className="flex flex-wrap gap-2">
          {campaign.status === "PENDING" && (
            <Button
              size="sm"
              onClick={() => onApprove(campaign.id)}
              disabled={isLoading}
            >
              Approve
            </Button>
          )}

          {campaign.status === "ACTIVE" && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPause(campaign.id)}
              disabled={isLoading}
            >
              Pause Campaign
            </Button>
          )}

          {!showRejectForm &&
            ["PENDING", "ACTIVE"].includes(campaign.status) && (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setShowRejectForm(true)}
              >
                Reject
              </Button>
            )}

          {showRejectForm && (
            <div className="flex w-full items-center gap-2">
              <Input
                placeholder="Rejection reason..."
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                className="flex-1"
              />
              <Button
                variant="destructive"
                size="sm"
                onClick={() => {
                  onReject(campaign.id, rejectReason);
                  setShowRejectForm(false);
                  setRejectReason("");
                }}
                disabled={!rejectReason.trim() || isLoading}
              >
                Confirm
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowRejectForm(false)}
              >
                Cancel
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ==========================================
// Main Page
// ==========================================

export default function AdminCampaignsPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<CampaignStatus | "ALL">("ALL");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<CampaignRow | null>(null);

  const { data, isLoading, refetch } = api.admin.listCampaigns.useQuery({
    page,
    limit: 25,
    search: search || undefined,
    status: statusFilter === "ALL" ? undefined : statusFilter,
  });

  const approveMutation = api.admin.approveCampaign.useMutation({
    onSuccess: () => {
      refetch();
      setSelected(null);
    },
  });

  const rejectMutation = api.admin.rejectCampaign.useMutation({
    onSuccess: () => {
      refetch();
      setSelected(null);
    },
  });

  const pauseMutation = api.admin.pauseCampaign.useMutation({
    onSuccess: () => {
      refetch();
      setSelected(null);
    },
  });

  const campaigns = (data?.campaigns ?? []) as CampaignRow[];
  const total = data?.total ?? 0;

  const totalBudget = campaigns.reduce((s, c) => s + c.budget, 0);
  const totalSpent = campaigns.reduce((s, c) => s + c.spent, 0);
  const pendingCount = campaigns.filter((c) => c.status === "PENDING").length;

  const columns = [
    {
      key: "name" as const,
      header: "Campaign",
      sortable: true,
      render: (row: CampaignRow) => (
        <button
          className="font-medium text-blue-600 hover:underline"
          onClick={() => setSelected(row)}
        >
          {row.name}
        </button>
      ),
    },
    {
      key: "brand" as const,
      header: "Brand",
      render: (row: CampaignRow) => row.brand.name || row.brand.email,
    },
    {
      key: "status" as const,
      header: "Status",
      render: (row: CampaignRow) => (
        <StatusBadge
          status={row.status}
          map={{
            DRAFT: "default",
            PENDING: "warning",
            ACTIVE: "success",
            PAUSED: "info",
            ENDED: "default",
            REJECTED: "error",
          }}
        />
      ),
    },
    {
      key: "payoutAmount" as const,
      header: "CPA",
      sortable: true,
      render: (row: CampaignRow) => `$${row.payoutAmount}`,
    },
    {
      key: "spent" as const,
      header: "Spent / Budget",
      render: (row: CampaignRow) =>
        `$${row.spent.toLocaleString()} / $${row.budget.toLocaleString()}`,
    },
    {
      key: "_count" as const,
      header: "Links / Conv",
      render: (row: CampaignRow) =>
        `${row._count.links} / ${row._count.conversions}`,
    },
    {
      key: "createdAt" as const,
      header: "Created",
      sortable: true,
      render: (row: CampaignRow) =>
        new Date(row.createdAt).toLocaleDateString(),
    },
  ];

  const statuses: (CampaignStatus | "ALL")[] = [
    "ALL",
    "PENDING",
    "ACTIVE",
    "PAUSED",
    "ENDED",
    "REJECTED",
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Campaign Moderation</h1>
        <p className="text-muted-foreground">
          Review, approve, reject, or pause campaigns
        </p>
      </div>

      {/* Stats */}
      <StatsGrid columns={4}>
        <CountStatCard title="Total Campaigns" value={total} />
        <CountStatCard title="Pending Review" value={pendingCount} />
        <MoneyStatCard title="Total Budget" value={totalBudget} />
        <MoneyStatCard title="Total Spent" value={totalSpent} />
      </StatsGrid>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <Input
          placeholder="Search campaigns..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          className="sm:max-w-xs"
        />
        <div className="flex flex-wrap gap-2">
          {statuses.map((s) => (
            <Button
              key={s}
              variant={statusFilter === s ? "default" : "outline"}
              size="sm"
              onClick={() => {
                setStatusFilter(s);
                setPage(1);
              }}
            >
              {s === "ALL" ? "All" : s.charAt(0) + s.slice(1).toLowerCase()}
            </Button>
          ))}
        </div>
      </div>

      {/* Moderation panel */}
      {selected && (
        <CampaignModerationPanel
          campaign={selected}
          onClose={() => setSelected(null)}
          onApprove={(id) => approveMutation.mutate({ campaignId: id })}
          onReject={(id, reason) =>
            rejectMutation.mutate({ campaignId: id, reason })
          }
          onPause={(id) => pauseMutation.mutate({ campaignId: id })}
          isLoading={
            approveMutation.isPending ||
            rejectMutation.isPending ||
            pauseMutation.isPending
          }
        />
      )}

      {/* Table */}
      <DataTable
        data={campaigns}
        columns={columns}
        pageSize={25}
        searchable={false}
        loading={isLoading}
      />

      {/* Pagination */}
      {total > 25 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Page {page} of {Math.ceil(total / 25)}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= Math.ceil(total / 25)}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
