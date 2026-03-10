"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

// ==========================================
// Types
// ==========================================

type PayoutMethod = "paypal" | "wise";

interface PayoutConfig {
  paypalEmail: string | null;
  wiseEmail: string | null;
  preferredPayout: PayoutMethod;
}

interface PayoutFormProps {
  config: PayoutConfig;
  onSave: (config: PayoutConfig) => Promise<void>;
  className?: string;
}

interface WithdrawFormProps {
  availableBalance: number;
  minPayout?: number;
  payoutConfig: PayoutConfig;
  onWithdraw: (amount: number, method: PayoutMethod) => Promise<void>;
  className?: string;
}

// ==========================================
// PayoutConfigForm — Set up PayPal / Wise
// ==========================================

export function PayoutConfigForm({ config, onSave, className }: PayoutFormProps) {
  const [form, setForm] = useState<PayoutConfig>(config);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    setError(null);
    // Validate preferred method has email
    if (form.preferredPayout === "paypal" && !form.paypalEmail) {
      setError("Please enter your PayPal email to use PayPal as preferred method");
      return;
    }
    if (form.preferredPayout === "wise" && !form.wiseEmail) {
      setError("Please enter your Wise email to use Wise as preferred method");
      return;
    }

    setSaving(true);
    try {
      await onSave(form);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err: any) {
      setError(err.message || "Failed to save payout settings");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className={cn(className)}>
      <CardHeader>
        <CardTitle className="text-base">Payout Settings</CardTitle>
        <CardDescription>
          Configure how you want to receive your earnings
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Preferred method selector */}
        <div className="space-y-2">
          <Label>Preferred Method</Label>
          <div className="grid grid-cols-2 gap-3">
            <MethodCard
              method="paypal"
              label="PayPal"
              description="Instant to most countries"
              selected={form.preferredPayout === "paypal"}
              onClick={() => setForm({ ...form, preferredPayout: "paypal" })}
              icon={
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M7.076 21.337H2.47a.641.641 0 0 1-.633-.74L4.944 2.196A.771.771 0 0 1 5.705 1.5h6.674c2.33 0 3.944.485 4.82 1.437.38.413.637.874.77 1.384.14.53.162 1.16.065 1.875l-.012.074v.066l.05.027c.403.21.729.468.981.776.296.363.49.805.58 1.316.092.527.085 1.155-.023 1.866-.124.814-.353 1.526-.685 2.115a4.34 4.34 0 0 1-1.09 1.347c-.444.37-.973.642-1.573.806-.582.16-1.24.24-1.955.24h-.464a.95.95 0 0 0-.94.803l-.035.184-.59 3.735-.028.15a.95.95 0 0 1-.94.803H7.076z" />
                </svg>
              }
            />
            <MethodCard
              method="wise"
              label="Wise"
              description="Low fees, best rates"
              selected={form.preferredPayout === "wise"}
              onClick={() => setForm({ ...form, preferredPayout: "wise" })}
              icon={
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
                </svg>
              }
            />
          </div>
        </div>

        {/* PayPal email */}
        <div className="space-y-2">
          <Label htmlFor="paypal-email">PayPal Email</Label>
          <Input
            id="paypal-email"
            type="email"
            placeholder="your@paypal.com"
            value={form.paypalEmail || ""}
            onChange={(e) =>
              setForm({ ...form, paypalEmail: e.target.value || null })
            }
          />
          <p className="text-xs text-muted-foreground">
            Must match your PayPal account email
          </p>
        </div>

        {/* Wise email */}
        <div className="space-y-2">
          <Label htmlFor="wise-email">Wise Email</Label>
          <Input
            id="wise-email"
            type="email"
            placeholder="your@wise.com"
            value={form.wiseEmail || ""}
            onChange={(e) =>
              setForm({ ...form, wiseEmail: e.target.value || null })
            }
          />
          <p className="text-xs text-muted-foreground">
            Must match your Wise account email
          </p>
        </div>

        {/* Error */}
        {error && (
          <p className="text-sm text-red-500 bg-red-500/10 px-3 py-2 rounded-md">
            {error}
          </p>
        )}

        {/* Save */}
        <Button onClick={handleSave} disabled={saving} className="w-full">
          {saving ? "Saving..." : saved ? "Saved!" : "Save Payout Settings"}
        </Button>
      </CardContent>
    </Card>
  );
}

// ==========================================
// MethodCard — Payment method selector
// ==========================================

function MethodCard({
  method,
  label,
  description,
  selected,
  onClick,
  icon,
}: {
  method: PayoutMethod;
  label: string;
  description: string;
  selected: boolean;
  onClick: () => void;
  icon: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all text-center",
        selected
          ? "border-primary bg-primary/5"
          : "border-muted hover:border-muted-foreground/30"
      )}
    >
      <div
        className={cn(
          "w-10 h-10 rounded-full flex items-center justify-center",
          selected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
        )}
      >
        {icon}
      </div>
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
    </button>
  );
}

// ==========================================
// WithdrawForm — Request a withdrawal
// ==========================================

export function WithdrawForm({
  availableBalance,
  minPayout = 10,
  payoutConfig,
  onWithdraw,
  className,
}: WithdrawFormProps) {
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<PayoutMethod>(payoutConfig.preferredPayout);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const parsedAmount = parseFloat(amount) || 0;
  const canWithdraw =
    parsedAmount >= minPayout &&
    parsedAmount <= availableBalance &&
    ((method === "paypal" && payoutConfig.paypalEmail) ||
      (method === "wise" && payoutConfig.wiseEmail));

  const handleSubmit = async () => {
    if (!canWithdraw) return;
    setError(null);
    setSubmitting(true);
    try {
      await onWithdraw(parsedAmount, method);
      setSuccess(true);
      setAmount("");
      setTimeout(() => setSuccess(false), 5000);
    } catch (err: any) {
      setError(err.message || "Withdrawal failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card className={cn(className)}>
      <CardHeader>
        <CardTitle className="text-base">Request Withdrawal</CardTitle>
        <CardDescription>
          Available balance:{" "}
          <span className="font-semibold text-foreground">
            ${availableBalance.toFixed(2)}
          </span>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Amount */}
        <div className="space-y-2">
          <Label htmlFor="amount">Amount (USD)</Label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
              $
            </span>
            <Input
              id="amount"
              type="number"
              min={minPayout}
              max={availableBalance}
              step="0.01"
              placeholder={minPayout.toFixed(2)}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="pl-7"
            />
          </div>
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Min: ${minPayout.toFixed(2)}</span>
            <button
              type="button"
              className="text-primary hover:underline"
              onClick={() => setAmount(availableBalance.toFixed(2))}
            >
              Withdraw all
            </button>
          </div>
        </div>

        {/* Method selector */}
        <div className="space-y-2">
          <Label>Payout Method</Label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setMethod("paypal")}
              disabled={!payoutConfig.paypalEmail}
              className={cn(
                "flex items-center gap-2 px-3 py-2 rounded-md border text-sm transition-all",
                method === "paypal"
                  ? "border-primary bg-primary/5 font-medium"
                  : "border-muted hover:border-muted-foreground/30",
                !payoutConfig.paypalEmail && "opacity-50 cursor-not-allowed"
              )}
            >
              PayPal
              {!payoutConfig.paypalEmail && (
                <span className="text-[10px] text-muted-foreground">(not set)</span>
              )}
            </button>
            <button
              type="button"
              onClick={() => setMethod("wise")}
              disabled={!payoutConfig.wiseEmail}
              className={cn(
                "flex items-center gap-2 px-3 py-2 rounded-md border text-sm transition-all",
                method === "wise"
                  ? "border-primary bg-primary/5 font-medium"
                  : "border-muted hover:border-muted-foreground/30",
                !payoutConfig.wiseEmail && "opacity-50 cursor-not-allowed"
              )}
            >
              Wise
              {!payoutConfig.wiseEmail && (
                <span className="text-[10px] text-muted-foreground">(not set)</span>
              )}
            </button>
          </div>
        </div>

        {/* Payout to */}
        {canWithdraw && (
          <div className="text-sm bg-muted/50 rounded-md p-3">
            <p className="text-muted-foreground">
              Sending <strong>${parsedAmount.toFixed(2)}</strong> via{" "}
              <strong>{method === "paypal" ? "PayPal" : "Wise"}</strong> to{" "}
              <strong>
                {method === "paypal"
                  ? payoutConfig.paypalEmail
                  : payoutConfig.wiseEmail}
              </strong>
            </p>
          </div>
        )}

        {/* Error / Success */}
        {error && (
          <p className="text-sm text-red-500 bg-red-500/10 px-3 py-2 rounded-md">
            {error}
          </p>
        )}
        {success && (
          <p className="text-sm text-emerald-600 bg-emerald-500/10 px-3 py-2 rounded-md">
            Withdrawal requested! You'll receive it within 1-3 business days.
          </p>
        )}

        {/* Submit */}
        <Button
          onClick={handleSubmit}
          disabled={!canWithdraw || submitting}
          className="w-full"
        >
          {submitting ? "Processing..." : "Request Withdrawal"}
        </Button>
      </CardContent>
    </Card>
  );
}
