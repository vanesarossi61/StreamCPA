"use client";

import { useState } from "react";
import { api } from "@/lib/trpc";
import { StatsGrid, CountStatCard, PercentStatCard } from "@/components/dashboard/stats-cards";
import { FraudCaseCard, FraudCaseList } from "@/components/dashboard/fraud-case";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DonutChart } from "@/components/dashboard/charts";

// ==========================================
// Types
// ==========================================

type FraudVerdict = "PENDING" | "CONFIRMED_FRAUD" | "FALSE_POSITIVE" | "UNDER_REVIEW";

interface FraudCase {
  id: string;
  clickId: string;
  conversionId: string | null;
  streamerName: string;
  campaignName: string;
  brandName: string;
  fraudScore: number;
  flagReason: string;
  verdict: FraudVerdict;
  ip: string;
  userAgent: string;
  country: string | null;
  createdAt: string;
  revenue: number;
}

// ==========================================
// Main Page
// ==========================================

export default function AdminFraudPage() {
  const [verdictFilter, setVerdictFilter] = useState<FraudVerdict | "ALL">("ALL");
  const [minScore, setMinScore] = useState(50);
  const [page, setPage] = useState(1);

  const { data, isLoading, refetch } = api.admin.listFraudCases.useQuery({
    page,
    limit: 20,
    verdict: verdictFilter === "ALL" ? undefined : verdictFilter,
    minFraudScore: minScore,
  });

  const resolveMutation = api.admin.resolveFraudCase.useMutation({
    onSuccess: () => refetch(),
  });

  const cases = (data?.cases ?? []) as FraudCase[];
  const total = data?.total ?? 0;
  const stats = data?.stats ?? {
    totalFlagged: 0,
    confirmedFraud: 0,
    falsePositives: 0,
    pending: 0,
    revenueAtRisk: 0,
  };

  const fraudRate =
    stats.totalFlagged > 0
      ? Math.round((stats.confirmedFraud / stats.totalFlagged) * 100)
      : 0;

  // Donut chart data
  const donutData = [
    { name: "Confirmed", value: stats.confirmedFraud, color: "#ef4444" },
    { name: "False Positive", value: stats.falsePositives, color: "#22c55e" },
    { name: "Pending", value: stats.pending, color: "#f59e0b" },
  ].filter((d) => d.value > 0);

  const verdicts: (FraudVerdict | "ALL")[] = [
    "ALL",
    "PENDING",
    "UNDER_REVIEW",
    "CONFIRMED_FRAUD",
    "FALSE_POSITIVE",
  ];

  const verdictLabels: Record<string, string> = {
    ALL: "All",
    PENDING: "Pending",
    UNDER_REVIEW: "Under Review",
    CONFIRMED_FRAUD: "Confirmed Fraud",
    FALSE_POSITIVE: "False Positive",
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Fraud Detection Center</h1>
        <p className="text-muted-foreground">
          Review flagged clicks and conversions, resolve fraud cases
        </p>
      </div>

      {/* Stats overview */}
      <div className="grid gap-4 md:grid-cols-5">
        <StatsGrid columns={4} className="md:col-span-4">
          <CountStatCard title="Total Flagged" value={stats.totalFlagged} />
          <CountStatCard title="Confirmed Fraud" value={stats.confirmedFraud} />
          <CountStatCard title="Pending Review" value={stats.pending} />
          <PercentStatCard title="Fraud Rate" value={fraudRate} />
        </StatsGrid>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            {donutData.length > 0 ? (
              <DonutChart data={donutData} height={120} />
            ) : (
              <p className="text-sm text-muted-foreground">No data</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Revenue at risk banner */}
      {stats.revenueAtRisk > 0 && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="flex items-center justify-between py-3">
            <div>
              <p className="font-semibold text-red-700">
                ${stats.revenueAtRisk.toLocaleString()} Revenue at Risk
              </p>
              <p className="text-sm text-red-600">
                From {stats.pending} unresolved cases
              </p>
            </div>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => {
                setVerdictFilter("PENDING");
                setPage(1);
              }}
            >
              Review Pending
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex flex-wrap gap-2">
          {verdicts.map((v) => (
            <Button
              key={v}
              variant={verdictFilter === v ? "default" : "outline"}
              size="sm"
              onClick={() => {
                setVerdictFilter(v);
                setPage(1);
              }}
            >
              {verdictLabels[v]}
            </Button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-muted-foreground whitespace-nowrap">
            Min Score:
          </label>
          <Input
            type="number"
            min={0}
            max={100}
            value={minScore}
            onChange={(e) => setMinScore(Number(e.target.value))}
            className="w-20"
          />
        </div>
      </div>

      {/* Fraud cases list */}
      {isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="h-32" />
            </Card>
          ))}
        </div>
      ) : cases.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No fraud cases match your filters.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {cases.map((c) => (
            <FraudCaseCard
              key={c.id}
              caseData={{
                id: c.id,
                fraudScore: c.fraudScore,
                status: c.verdict === "PENDING" ? "OPEN" : c.verdict === "UNDER_REVIEW" ? "INVESTIGATING" : c.verdict === "CONFIRMED_FRAUD" ? "CONFIRMED" : "DISMISSED",
                flagReason: c.flagReason,
                revenue: c.revenue,
                createdAt: c.createdAt,
                streamer: c.streamerName,
                campaign: c.campaignName,
                ip: c.ip,
                country: c.country || "Unknown",
              }}
              onResolve={(id, verdict) => {
                const verdictMap: Record<string, string> = {
                  confirm: "CONFIRMED_FRAUD",
                  dismiss: "FALSE_POSITIVE",
                  review: "UNDER_REVIEW",
                };
                resolveMutation.mutate({
                  caseId: id,
                  verdict: verdictMap[verdict] || verdict,
                });
              }}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      {total > 20 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {(page - 1) * 20 + 1}-{Math.min(page * 20, total)} of{" "}
            {total} cases
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
