/**
 * Brand — Billing / Deposit Funds page
 * Route: /brand/billing
 *
 * Shows escrow balance, deposit history, deposit funds flow via Stripe,
 * and spending breakdown.
 */
"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
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
import { useToast } from "@/components/ui/use-toast";
import { formatCurrency, cn } from "@/lib/utils";
import {
  Wallet,
  DollarSign,
  CreditCard,
  TrendingDown,
  ArrowUpRight,
  Plus,
  Loader2,
  CheckCircle2,
  Clock,
  XCircle,
  ReceiptText,
} from "lucide-react";

const DEPOSIT_STATUS: Record<string, { variant: any; label: string; icon: any }> = {
  PENDING: { variant: "warning", label: "Pending", icon: Clock },
  COMPLETED: { variant: "success", label: "Completed", icon: CheckCircle2 },
  FAILED: { variant: "destructive", label: "Failed", icon: XCircle },
  REFUNDED: { variant: "secondary", label: "Refunded", icon: ReceiptText },
};

export default function BrandBillingPage() {
  const { toast } = useToast();
  const [depositOpen, setDepositOpen] = useState(false);
  const [depositAmount, setDepositAmount] = useState("");

  const { data: dashboard } = trpc.brand.getDashboard.useQuery();
  const { data: depositsData, isLoading } = trpc.payout.getMyDeposits.useQuery();

  const createDeposit = trpc.payout.createDeposit.useMutation({
    onSuccess: (data) => {
      // Redirect to Stripe Checkout
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      } else {
        toast({ title: "Deposit initiated!", description: "Processing your payment..." });
        setDepositOpen(false);
      }
    },
    onError: (err) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const handleDeposit = () => {
    const amount = parseFloat(depositAmount);
    if (isNaN(amount) || amount < 50) {
      toast({ title: "Minimum deposit is $50", variant: "destructive" });
      return;
    }
    createDeposit.mutate({ amount });
  };

  const deposits = depositsData?.deposits || [];
  const totalDeposited = deposits
    .filter((d) => d.status === "COMPLETED")
    .reduce((sum, d) => sum + d.amount, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Billing</h1>
          <p className="text-muted-foreground">Manage your escrow balance and deposit funds.</p>
        </div>
        <Dialog open={depositOpen} onOpenChange={setDepositOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" /> Deposit Funds
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Deposit Funds</DialogTitle>
              <DialogDescription>
                Add funds to your escrow balance. Minimum deposit: $50.00.
                You will be redirected to Stripe for secure payment.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="deposit-amount">Amount (USD)</Label>
                <Input
                  id="deposit-amount"
                  type="number"
                  min="50"
                  step="10"
                  placeholder="500.00"
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                />
              </div>
              <div className="flex gap-2">
                {[100, 250, 500, 1000].map((amount) => (
                  <Button
                    key={amount}
                    variant="outline"
                    size="sm"
                    onClick={() => setDepositAmount(amount.toString())}
                  >
                    ${amount}
                  </Button>
                ))}
              </div>
              <div className="rounded-md bg-muted p-3 text-sm text-muted-foreground">
                <p>Payments are processed securely via Stripe.</p>
                <p>Funds will be available in your escrow balance immediately after payment.</p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDepositOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleDeposit} disabled={createDeposit.isLoading} className="gap-2">
                {createDeposit.isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CreditCard className="h-4 w-4" />
                )}
                Pay with Stripe
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Balance Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-3 pt-6">
            <div className="rounded-lg bg-brand-green/10 p-2">
              <Wallet className="h-5 w-5 text-brand-green" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Escrow Balance</p>
              <p className="text-2xl font-bold text-brand-green">
                {formatCurrency(dashboard?.escrowBalance || 0)}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 pt-6">
            <div className="rounded-lg bg-primary/10 p-2">
              <ArrowUpRight className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Deposited</p>
              <p className="text-2xl font-bold">{formatCurrency(totalDeposited)}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 pt-6">
            <div className="rounded-lg bg-brand-orange/10 p-2">
              <TrendingDown className="h-5 w-5 text-brand-orange" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Spent</p>
              <p className="text-2xl font-bold">{formatCurrency(dashboard?.totalSpent || 0)}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Deposit History */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ReceiptText className="h-5 w-5" /> Deposit History
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : deposits.length === 0 ? (
            <div className="flex flex-col items-center py-16">
              <DollarSign className="h-12 w-12 text-muted-foreground" />
              <p className="mt-4 text-lg font-medium">No deposits yet</p>
              <p className="text-sm text-muted-foreground">
                Deposit funds to start running campaigns.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead>Transaction ID</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {deposits.map((deposit) => {
                  const status = DEPOSIT_STATUS[deposit.status] || DEPOSIT_STATUS.PENDING;
                  const StatusIcon = status.icon;
                  return (
                    <TableRow key={deposit.id}>
                      <TableCell className="text-muted-foreground">
                        {new Date(deposit.createdAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(deposit.amount)}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant={status.variant}>
                          <StatusIcon className="mr-1 h-3 w-3" />
                          {status.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground font-mono text-xs">
                        {deposit.stripeSessionId || "-"}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
