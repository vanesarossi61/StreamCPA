"use client";

import { useState } from "react";
import { api } from "@/lib/trpc";
import { DataTable, StatusBadge } from "@/components/dashboard/data-table";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatsGrid, MoneyStatCard, CountStatCard } from "@/components/dashboard/stats-cards";
import { TimeSeriesChart } from "@/components/dashboard/charts";
import { PayoutConfigForm, WithdrawForm } from "@/components/dashboard/payout-form";

// ==========================================
// Types
// ==========================================

type PayoutStatus = "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED" | "CANCELLED";
type PayoutMethod = "PAYPAL" | "WISE" | "BANK_TRANSFER";

interface PayoutRow {
  id: string;
  amount: number;
  fee: number;
  net: number;
  method: PayoutMethod;
  status: PayoutStatus;
  reference: string | null;
  createdAt: string;
  processedAt: string | null;
}

interface PayoutStats {
  totalEarned: number;
  totalPaid: number;
  pendingBalance: number;
  availableBalance: number;
  nextPayoutDate: string | null;
  payoutMethod: PayoutMethod | null;
  payoutEmail: string | null;
}

// ==========================================
// Payout History Chart
// ==========================================

function PayoutHistoryChart({ payouts }: { payouts: PayoutRow[] }) {
  // Aggregate by month
  const monthlyData = payouts
    .filter((p) => p.status === "COMPLETED")
    .reduce<Record<string, number>>((acc, p) => {
      const month = new Date(p.createdAt).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
      });
      acc[month] = (acc[month] || 0) + p.net;
      return acc;
    }, {});

  const chartData = Object.entries(monthlyData)
    .map(([date, value]) => ({ date, value }))
    .slice(-12); // Last 12 months

  if (chartData.length < 2) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">Payout History</CardTitle>
      </CardHeader>
      <CardContent>
        <TimeSeriesChart
          data={chartData}
          height={200}
          color="#22c55e"
          label="Net Payout"
        />
      </CardContent>
    </Card>
  );
}

// ==========================================
// Main Page
// ==========================================

export default function StreamerPayoutsPage() {
  const [page, setPage] = useState(1);
  const [showConfig, setShowConfig] = useState(false);
  const [showWithdraw, setShowWithdraw] = useState(false);

  const { data: statsData } = api.streamer.getPayoutStats.useQuery();
  const { data: payoutsData, isLoading, refetch } = api.streamer.listPayouts.useQuery({
    page,
    limit: 20,
  });

  const stats = (statsData ?? {
    totalEarned: 0,
    totalPaid: 0,
    pendingBalance: 0,
    availableBalance: 0,
    nextPayoutDate: null,
    payoutMethod: null,
    payoutEmail: null,
  }) as PayoutStats;

  const payouts = (payoutsData?.payouts ?? []) as PayoutRow[];
  const total = payoutsData?.total ?? 0;

  const columns = [
    {
      key: "createdAt" as const,
      header: "Date",
      sortable: true,
      render: (row: PayoutRow) =>
        new Date(row.createdAt).toLocaleDateString(),
    },
    {
      key: "amount" as const,
      header: "Gross",
      sortable: true,
      render: (row: PayoutRow) => `$${row.amount.toFixed(2)}`,
    },
    {
      key: "fee" as const,
      header: "Fee",
      render: (row: PayoutRow) =>
        row.fee > 0 ? `-$${row.fee.toFixed(2)}` : "--",
    },
    {
      key: "net" as const,
      header: "Net",
      sortable: true,
      render: (row: PayoutRow) => (
        <span className="font-semibold text-green-600">
          ${row.net.toFixed(2)}
        </span>
      ),
    },
    {
      key: "method" as const,
      header: "Method",
      render: (row: PayoutRow) => (
        <StatusBadge
          status={row.method}
          map={{
            PAYPAL: "info",
            WISE: "success",
            BANK_TRANSFER: "default",
          }}
        />
      ),
    },
    {
      key: "status" as const,
      header: "Status",
      render: (row: PayoutRow) => (
        <StatusBadge
          status={row.status}
          map={{
            PENDING: "warning",
            PROCESSING: "info",
            COMPLETED: "success",
            FAILED: "error",
            CANCELLED: "default",
          }}
        />
      ),
    },
    {
      key: "reference" as const,
      header: "Reference",
      render: (row: PayoutRow) => (
        <span className="font-mono text-xs text-muted-foreground">
          {row.reference || "--"}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Payouts</h1>
          <p className="text-muted-foreground">
            Your earnings, withdrawal history, and payout settings
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowConfig(true)}>
            Payout Settings
          </Button>
          <Button
            onClick={() => setShowWithdraw(true)}
            disabled={stats.availableBalance < 50}
          >
            Withdraw ${stats.availableBalance.toFixed(2)}
          </Button>
        </div>
      </div>

      {/* Balance overview */}
      <StatsGrid columns={4}>
        <MoneyStatCard title="Total Earned" value={stats.totalEarned} />
        <MoneyStatCard title="Total Paid Out" value={stats.totalPaid} />
        <MoneyStatCard title="Pending" value={stats.pendingBalance} />
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Available</p>
            <p className="text-2xl font-bold text-green-600">
              ${stats.availableBalance.toFixed(2)}
            </p>
            {stats.availableBalance < 50 && (
              <p className="text-xs text-muted-foreground">
                Min $50 to withdraw
              </p>
            )}
            {stats.nextPayoutDate && (
              <p className="text-xs text-muted-foreground">
                Next payout:{" "}
                {new Date(stats.nextPayoutDate).toLocaleDateString()}
              </p>
            )}
          </CardContent>
        </Card>
      </StatsGrid>

      {/* Payout method info */}
      {stats.payoutMethod ? (
        <Card>
          <CardContent className="flex items-center justify-between py-3">
            <div className="flex items-center gap-3">
              <StatusBadge
                status={stats.payoutMethod}
                map={{
                  PAYPAL: "info",
                  WISE: "success",
                  BANK_TRANSFER: "default",
                }}
              />
              <span className="text-sm">{stats.payoutEmail}</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowConfig(true)}
            >
              Change
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="py-4">
            <p className="font-medium text-amber-800">
              No payout method configured
            </p>
            <p className="text-sm text-amber-700">
              Set up PayPal or Wise to receive your earnings.
            </p>
            <Button
              size="sm"
              className="mt-2"
              onClick={() => setShowConfig(true)}
            >
              Configure Now
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Config modal (inline) */}
      {showConfig && (
        <Card className="border-2 border-blue-200">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Payout Settings</CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowConfig(false)}
            >
              Close
            </Button>
          </CardHeader>
          <CardContent>
            <PayoutConfigForm
              initialMethod={stats.payoutMethod || undefined}
              initialEmail={stats.payoutEmail || undefined}
              onSave={async (method, email) => {
                // Call tRPC mutation to save payout config
                console.log("Save payout config:", method, email);
                setShowConfig(false);
              }}
            />
          </CardContent>
        </Card>
      )}

      {/* Withdraw modal (inline) */}
      {showWithdraw && (
        <Card className="border-2 border-green-200">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Request Withdrawal</CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowWithdraw(false)}
            >
              Close
            </Button>
          </CardHeader>
          <CardContent>
            <WithdrawForm
              availableBalance={stats.availableBalance}
              method={stats.payoutMethod || "PAYPAL"}
              onSubmit={async (amount) => {
                // Call tRPC mutation to request withdrawal
                console.log("Withdraw:", amount);
                setShowWithdraw(false);
                refetch();
              }}
            />
          </CardContent>
        </Card>
      )}

      {/* Chart */}
      <PayoutHistoryChart payouts={payouts} />

      {/* Payouts table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Transaction History</CardTitle>
          <CardDescription>
            {total} total transactions
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable
            data={payouts}
            columns={columns}
            pageSize={20}
            loading={isLoading}
          />
        </CardContent>
      </Card>

      {/* Pagination */}
      {total > 20 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Page {page} of {Math.ceil(total / 20)}
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
              disabled={page >= Math.ceil(total / 20)}
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
