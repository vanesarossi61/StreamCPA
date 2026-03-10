/**
 * Streamer — Earnings history + withdrawal requests
 * Route: /streamer/earnings
 *
 * Shows earnings breakdown by campaign, conversion history table,
 * balance summary, and withdrawal request flow.
 */
"use client";

import { useState } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/components/ui/use-toast";
import { formatCurrency, cn } from "@/lib/utils";
import {
  DollarSign,
  Wallet,
  Clock,
  TrendingUp,
  ArrowUpRight,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  Banknote,
  Download,
} from "lucide-react";

const STATUS_MAP: Record<string, { variant: any; label: string; icon: any }> = {
  APPROVED: { variant: "success", label: "Approved", icon: CheckCircle2 },
  PENDING: { variant: "warning", label: "Pending", icon: Clock },
  UNDER_REVIEW: { variant: "warning", label: "Under Review", icon: AlertTriangle },
  REJECTED: { variant: "destructive", label: "Rejected", icon: XCircle },
};

const PAYOUT_STATUS: Record<string, { variant: any; label: string }> = {
  PENDING: { variant: "warning", label: "Pending" },
  PROCESSING: { variant: "info", label: "Processing" },
  COMPLETED: { variant: "success", label: "Completed" },
  FAILED: { variant: "destructive", label: "Failed" },
};

export default function StreamerEarningsPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<"conversions" | "payouts">("conversions");
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawMethod, setWithdrawMethod] = useState<"paypal" | "wise">("paypal");

  const { data: dashboard } = trpc.streamer.getDashboard.useQuery();
  const { data: conversions, isLoading: loadingConversions } =
    trpc.campaign.getMyConversions.useQuery();
  const { data: payoutsData, isLoading: loadingPayouts } =
    trpc.payout.getMyPayouts.useQuery();

  const requestWithdrawal = trpc.payout.requestWithdrawal.useMutation({
    onSuccess: () => {
      toast({ title: "Withdrawal requested!", description: "Your payout is being processed." });
      setWithdrawOpen(false);
      setWithdrawAmount("");
    },
    onError: (err) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const handleWithdraw = () => {
    const amount = parseFloat(withdrawAmount);
    if (isNaN(amount) || amount < 10) {
      toast({ title: "Minimum withdrawal is $10", variant: "destructive" });
      return;
    }
    requestWithdrawal.mutate({ amount, method: withdrawMethod });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Earnings</h1>
          <p className="text-muted-foreground">Track your income and request withdrawals.</p>
        </div>
        <Dialog open={withdrawOpen} onOpenChange={setWithdrawOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Download className="h-4 w-4" /> Withdraw
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Request Withdrawal</DialogTitle>
              <DialogDescription>
                Available balance: {formatCurrency(dashboard?.balanceAvailable || 0)}.
                Minimum withdrawal: $10.00.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="amount">Amount (USD)</Label>
                <Input
                  id="amount"
                  type="number"
                  min="10"
                  step="0.01"
                  max={dashboard?.balanceAvailable || 0}
                  placeholder="50.00"
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Payment Method</Label>
                <Select
                  value={withdrawMethod}
                  onValueChange={(v) => setWithdrawMethod(v as "paypal" | "wise")}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="paypal">PayPal</SelectItem>
                    <SelectItem value="wise">Wise</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="rounded-md bg-muted p-3 text-sm text-muted-foreground">
                <p>Payouts are processed within 1-3 business days.</p>
                <p>Make sure your payment email is configured in Settings.</p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setWithdrawOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleWithdraw}
                disabled={requestWithdrawal.isLoading}
              >
                {requestWithdrawal.isLoading && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Request Withdrawal
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Balance Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="flex items-center gap-3 pt-6">
            <div className="rounded-lg bg-brand-green/10 p-2">
              <Wallet className="h-5 w-5 text-brand-green" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Available</p>
              <p className="text-2xl font-bold text-brand-green">
                {formatCurrency(dashboard?.balanceAvailable || 0)}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 pt-6">
            <div className="rounded-lg bg-brand-orange/10 p-2">
              <Clock className="h-5 w-5 text-brand-orange" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Pending</p>
              <p className="text-2xl font-bold">
                {formatCurrency(dashboard?.balancePending || 0)}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 pt-6">
            <div className="rounded-lg bg-primary/10 p-2">
              <TrendingUp className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Earned</p>
              <p className="text-2xl font-bold">
                {formatCurrency(dashboard?.totalEarned || 0)}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 pt-6">
            <div className="rounded-lg bg-primary/10 p-2">
              <DollarSign className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">EPC</p>
              <p className="text-2xl font-bold">
                ${(dashboard?.epc || 0).toFixed(2)}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-1 rounded-lg bg-muted p-1 w-fit">
        <button
          onClick={() => setActiveTab("conversions")}
          className={cn(
            "rounded-md px-4 py-2 text-sm font-medium transition-colors",
            activeTab === "conversions"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          Conversions
        </button>
        <button
          onClick={() => setActiveTab("payouts")}
          className={cn(
            "rounded-md px-4 py-2 text-sm font-medium transition-colors",
            activeTab === "payouts"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          Payout History
        </button>
      </div>

      {/* Conversions Tab */}
      {activeTab === "conversions" && (
        <Card>
          <CardContent className="p-0">
            {loadingConversions ? (
              <div className="flex justify-center py-16">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : !conversions?.length ? (
              <div className="flex flex-col items-center py-16">
                <TrendingUp className="h-12 w-12 text-muted-foreground" />
                <p className="mt-4 text-lg font-medium">No conversions yet</p>
                <p className="text-sm text-muted-foreground">
                  Share your affiliate links to start earning.
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Campaign</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Payout</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                    <TableHead className="text-right">Fraud Score</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {conversions.map((conv) => {
                    const status = STATUS_MAP[conv.status] || STATUS_MAP.PENDING;
                    const StatusIcon = status.icon;
                    return (
                      <TableRow key={conv.id}>
                        <TableCell className="text-muted-foreground">
                          {new Date(conv.createdAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{conv.campaign.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {conv.campaign.brand.companyName}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{conv.conversionType}</Badge>
                        </TableCell>
                        <TableCell className="text-right font-medium text-brand-green">
                          {formatCurrency(conv.payout)}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant={status.variant}>
                            <StatusIcon className="mr-1 h-3 w-3" />
                            {status.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <span
                            className={cn(
                              "text-sm",
                              conv.fraudScore >= 70
                                ? "text-destructive"
                                : conv.fraudScore >= 40
                                  ? "text-brand-orange"
                                  : "text-muted-foreground",
                            )}
                          >
                            {conv.fraudScore}
                          </span>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {/* Payouts Tab */}
      {activeTab === "payouts" && (
        <Card>
          <CardContent className="p-0">
            {loadingPayouts ? (
              <div className="flex justify-center py-16">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : !payoutsData?.payouts?.length ? (
              <div className="flex flex-col items-center py-16">
                <Banknote className="h-12 w-12 text-muted-foreground" />
                <p className="mt-4 text-lg font-medium">No payouts yet</p>
                <p className="text-sm text-muted-foreground">
                  Request a withdrawal when your available balance reaches $10.
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                    <TableHead>Processed</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payoutsData.payouts.map((payout) => {
                    const status = PAYOUT_STATUS[payout.status] || PAYOUT_STATUS.PENDING;
                    return (
                      <TableRow key={payout.id}>
                        <TableCell className="text-muted-foreground">
                          {new Date(payout.requestedAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(payout.amount)}
                        </TableCell>
                        <TableCell className="capitalize">{payout.method}</TableCell>
                        <TableCell className="text-center">
                          <Badge variant={status.variant}>{status.label}</Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {payout.processedAt
                            ? new Date(payout.processedAt).toLocaleDateString()
                            : "-"}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
