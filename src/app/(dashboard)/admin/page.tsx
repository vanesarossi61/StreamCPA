/**
 * Admin Dashboard — platform overview with metrics, fraud queue, payouts, user search
 * Route: /admin
 */
"use client";

import { useState } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import {
  Users,
  Building2,
  Tv2,
  BarChart3,
  AlertTriangle,
  DollarSign,
  Search,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowRight,
  Loader2,
  ShieldAlert,
  Banknote,
  TrendingUp,
  Activity,
} from "lucide-react";

// ==========================================
// MAIN ADMIN DASHBOARD
// ==========================================

export default function AdminDashboardPage() {
  const [activeTab, setActiveTab] = useState<
    "overview" | "fraud" | "payouts" | "users"
  >("overview");

  const tabs = [
    { id: "overview" as const, label: "Overview", icon: BarChart3 },
    { id: "fraud" as const, label: "Fraud Queue", icon: ShieldAlert },
    { id: "payouts" as const, label: "Payouts", icon: Banknote },
    { id: "users" as const, label: "Users", icon: Users },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Admin Dashboard</h1>
        <p className="text-muted-foreground">
          Platform management and oversight.
        </p>
      </div>

      {/* Tab navigation */}
      <div className="flex gap-1 rounded-lg bg-muted p-1">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === "overview" && <OverviewTab />}
      {activeTab === "fraud" && <FraudQueueTab />}
      {activeTab === "payouts" && <PayoutsTab />}
      {activeTab === "users" && <UsersTab />}
    </div>
  );
}

// ==========================================
// OVERVIEW TAB — Platform metrics
// ==========================================

function OverviewTab() {
  const { data: stats, isLoading } = trpc.admin.getStats.useQuery();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!stats) return null;

  const metrics = [
    {
      label: "Total Users",
      value: stats.totalUsers,
      icon: Users,
      color: "text-blue-500",
    },
    {
      label: "Active Streamers",
      value: stats.totalStreamers,
      icon: Tv2,
      color: "text-violet-500",
    },
    {
      label: "Active Brands",
      value: stats.totalBrands,
      icon: Building2,
      color: "text-emerald-500",
    },
    {
      label: "Pending Brands",
      value: stats.pendingBrands,
      icon: Clock,
      color: "text-amber-500",
      link: "/admin/brands",
    },
    {
      label: "Total Campaigns",
      value: stats.totalCampaigns,
      icon: BarChart3,
      color: "text-blue-500",
    },
    {
      label: "Active Campaigns",
      value: stats.activeCampaigns,
      icon: Activity,
      color: "text-emerald-500",
    },
    {
      label: "Approved Conversions",
      value: stats.totalConversions,
      icon: TrendingUp,
      color: "text-violet-500",
    },
    {
      label: "Completed Payouts",
      value: stats.totalPayouts,
      icon: DollarSign,
      color: "text-emerald-500",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Metric cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {metrics.map((m) => (
          <Card key={m.label}>
            <CardContent className="flex items-center gap-4 pt-6">
              <div className={`rounded-lg bg-muted p-3 ${m.color}`}>
                <m.icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold">{m.value.toLocaleString()}</p>
                <p className="text-sm text-muted-foreground">{m.label}</p>
              </div>
              {m.link && (
                <Link href={m.link} className="ml-auto">
                  <ArrowRight className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                </Link>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quick actions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Quick Actions</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Link href="/admin/brands">
            <Button variant="outline" size="sm" className="gap-2">
              <Building2 className="h-4 w-4" />
              Review Brands
              {stats.pendingBrands > 0 && (
                <span className="rounded-full bg-amber-500 px-2 py-0.5 text-xs text-white">
                  {stats.pendingBrands}
                </span>
              )}
            </Button>
          </Link>
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => {
              /* scroll to fraud tab */
            }}
          >
            <ShieldAlert className="h-4 w-4" />
            Fraud Review
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => {
              /* scroll to payouts tab */
            }}
          >
            <Banknote className="h-4 w-4" />
            Process Payouts
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

// ==========================================
// FRAUD QUEUE TAB — Suspicious conversions
// ==========================================

function FraudQueueTab() {
  const { toast } = useToast();
  const [page, setPage] = useState(1);

  const { data, isLoading, refetch } =
    trpc.tracking.getPendingConversions.useQuery({
      status: "UNDER_REVIEW",
      page,
      limit: 15,
    });

  const reviewConversion = trpc.tracking.reviewConversion.useMutation({
    onSuccess: (_, variables) => {
      toast({
        title:
          variables.status === "APPROVED"
            ? "Conversion approved"
            : "Conversion rejected",
      });
      refetch();
    },
    onError: (err) => {
      toast({
        title: "Error",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {data?.total || 0} conversions under review
        </p>
      </div>

      {!data?.conversions?.length ? (
        <Card>
          <CardContent className="flex flex-col items-center py-12">
            <CheckCircle2 className="h-12 w-12 text-emerald-500" />
            <p className="mt-4 text-lg font-medium">Queue is clear</p>
            <p className="text-sm text-muted-foreground">
              No conversions flagged for review.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {data.conversions.map((conv: any) => (
            <Card key={conv.id}>
              <CardContent className="pt-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-amber-500" />
                      <span className="font-medium">
                        {conv.campaign?.name || "Unknown Campaign"}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Streamer:{" "}
                      <strong>
                        {conv.streamer?.twitchDisplayName || "Unknown"}
                      </strong>{" "}
                      | Payout: <strong>${conv.payout?.toFixed(2)}</strong> |
                      Fraud Score:{" "}
                      <strong
                        className={
                          conv.fraudScore >= 70
                            ? "text-red-500"
                            : conv.fraudScore >= 40
                              ? "text-amber-500"
                              : "text-emerald-500"
                        }
                      >
                        {conv.fraudScore}
                      </strong>
                    </p>
                    {conv.click?.flagReason && (
                      <p className="text-xs text-red-500">
                        Flag: {conv.click.flagReason}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      IP: {conv.click?.ipHash?.slice(0, 12)}... | Country:{" "}
                      {conv.click?.country || "N/A"} |{" "}
                      {new Date(conv.createdAt).toLocaleString()}
                    </p>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() =>
                        reviewConversion.mutate({
                          conversionId: conv.id,
                          status: "APPROVED",
                        })
                      }
                      disabled={reviewConversion.isPending}
                      className="gap-1"
                    >
                      <CheckCircle2 className="h-3 w-3" />
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() =>
                        reviewConversion.mutate({
                          conversionId: conv.id,
                          status: "REJECTED",
                          note: "Manual review rejection",
                        })
                      }
                      disabled={reviewConversion.isPending}
                      className="gap-1"
                    >
                      <XCircle className="h-3 w-3" />
                      Reject
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Pagination */}
      {data && data.pages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
          >
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {page} of {data.pages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.min(data.pages, p + 1))}
            disabled={page === data.pages}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}

// ==========================================
// PAYOUTS TAB — Pending withdrawals
// ==========================================

function PayoutsTab() {
  const { toast } = useToast();

  const { data: pendingPayouts, isLoading, refetch } =
    trpc.payout.getPendingPayouts.useQuery();

  const processPayout = trpc.payout.processPayout.useMutation({
    onSuccess: (result) => {
      toast({
        title: "Payout processed",
        description: `Transaction ID: ${result.externalId}`,
      });
      refetch();
    },
    onError: (err) => {
      toast({
        title: "Payout failed",
        description: err.message,
        variant: "destructive",
      });
      refetch();
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const totalPending =
    pendingPayouts?.reduce((sum: number, p: any) => sum + p.amount, 0) || 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {pendingPayouts?.length || 0} pending payouts | Total: $
          {totalPending.toFixed(2)}
        </p>
      </div>

      {!pendingPayouts?.length ? (
        <Card>
          <CardContent className="flex flex-col items-center py-12">
            <CheckCircle2 className="h-12 w-12 text-emerald-500" />
            <p className="mt-4 text-lg font-medium">No pending payouts</p>
            <p className="text-sm text-muted-foreground">
              All withdrawals have been processed.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {pendingPayouts.map((payout: any) => (
            <Card key={payout.id}>
              <CardContent className="pt-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <DollarSign className="h-4 w-4 text-emerald-500" />
                      <span className="text-lg font-bold">
                        ${payout.amount.toFixed(2)}
                      </span>
                      <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium uppercase">
                        {payout.method}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Streamer:{" "}
                      <strong>
                        {payout.streamer?.twitchDisplayName ||
                          payout.streamer?.user?.name ||
                          "Unknown"}
                      </strong>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {payout.method === "paypal"
                        ? `PayPal: ${payout.streamer?.paypalEmail}`
                        : `Wise: ${payout.streamer?.wiseEmail}`}{" "}
                      | Requested: {new Date(payout.requestedAt).toLocaleString()}
                    </p>
                  </div>

                  <Button
                    size="sm"
                    onClick={() =>
                      processPayout.mutate({ payoutId: payout.id })
                    }
                    disabled={processPayout.isPending}
                    className="gap-2"
                  >
                    {processPayout.isPending ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Banknote className="h-3 w-3" />
                    )}
                    Process Payout
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ==========================================
// USERS TAB — Search and manage users
// ==========================================

function UsersTab() {
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<string | undefined>(undefined);
  const [page, setPage] = useState(1);

  const { data, isLoading } = trpc.admin.listUsers.useQuery({
    page,
    limit: 15,
    role: roleFilter as any,
    search: searchQuery || undefined,
  });

  const roleColors: Record<string, string> = {
    STREAMER: "bg-violet-100 text-violet-700 dark:bg-violet-900 dark:text-violet-300",
    BRAND: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
    ADMIN: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
  };

  return (
    <div className="space-y-4">
      {/* Search and filters */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by name or email..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setPage(1);
            }}
            className="pl-9"
          />
        </div>
        <div className="flex gap-2">
          {["All", "STREAMER", "BRAND", "ADMIN"].map((role) => (
            <Button
              key={role}
              variant={
                (role === "All" && !roleFilter) || roleFilter === role
                  ? "default"
                  : "outline"
              }
              size="sm"
              onClick={() => {
                setRoleFilter(role === "All" ? undefined : role);
                setPage(1);
              }}
            >
              {role === "All"
                ? "All"
                : role.charAt(0) + role.slice(1).toLowerCase()}
            </Button>
          ))}
        </div>
      </div>

      {/* Results count */}
      <p className="text-sm text-muted-foreground">
        {data?.total || 0} users found
      </p>

      {/* User table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : !data?.users?.length ? (
        <Card>
          <CardContent className="flex flex-col items-center py-12">
            <Search className="h-12 w-12 text-muted-foreground" />
            <p className="mt-4 text-lg font-medium">No users found</p>
            <p className="text-sm text-muted-foreground">
              Try adjusting your search or filters.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-left font-medium">User</th>
                <th className="px-4 py-3 text-left font-medium">Role</th>
                <th className="px-4 py-3 text-left font-medium">Details</th>
                <th className="px-4 py-3 text-left font-medium">Status</th>
                <th className="px-4 py-3 text-left font-medium">Joined</th>
              </tr>
            </thead>
            <tbody>
              {data.users.map((user: any) => (
                <tr
                  key={user.id}
                  className="border-b last:border-0 hover:bg-muted/30"
                >
                  <td className="px-4 py-3">
                    <div>
                      <p className="font-medium">{user.name || "—"}</p>
                      <p className="text-xs text-muted-foreground">
                        {user.email}
                      </p>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${roleColors[user.role] || "bg-muted"}`}
                    >
                      {user.role}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {user.streamer && (
                      <span>
                        @{user.streamer.twitchUsername} | Score:{" "}
                        {user.streamer.streamerScore}
                      </span>
                    )}
                    {user.brand && <span>{user.brand.companyName}</span>}
                    {!user.streamer && !user.brand && <span>—</span>}
                  </td>
                  <td className="px-4 py-3">
                    {user.isActive ? (
                      <span className="flex items-center gap-1 text-emerald-500">
                        <CheckCircle2 className="h-3 w-3" /> Active
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-red-500">
                        <XCircle className="h-3 w-3" /> Disabled
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {new Date(user.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {data && data.pages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
          >
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {page} of {data.pages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.min(data.pages, p + 1))}
            disabled={page === data.pages}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
