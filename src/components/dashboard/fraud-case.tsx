"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/dashboard/data-table";
import { cn } from "@/lib/utils";

// ==========================================
// Types
// ==========================================

interface FraudCase {
  id: string;
  type: "DUPLICATE_IP" | "BOT_DETECTED" | "GEO_MISMATCH" | "CLICK_FARM" | "SUSPICIOUS_PATTERN" | "MANUAL_REPORT";
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  status: "OPEN" | "INVESTIGATING" | "RESOLVED" | "DISMISSED";
  // Related entities
  clickId?: string;
  conversionId?: string;
  streamerId: string;
  streamerName: string;
  streamerAvatar?: string;
  campaignId: string;
  campaignName: string;
  // Details
  description: string;
  evidence: FraudEvidence[];
  amount?: number; // Potentially fraudulent amount
  // Timestamps
  detectedAt: string;
  resolvedAt?: string;
  resolvedBy?: string;
  resolution?: string;
}

interface FraudEvidence {
  type: "ip_address" | "user_agent" | "geo_data" | "timing" | "screenshot" | "pattern";
  label: string;
  value: string;
  flagged?: boolean;
}

interface FraudCaseCardProps {
  fraudCase: FraudCase;
  onResolve?: (id: string, resolution: string) => Promise<void>;
  onDismiss?: (id: string, reason: string) => Promise<void>;
  onInvestigate?: (id: string) => Promise<void>;
  expanded?: boolean;
  className?: string;
}

interface FraudCaseListProps {
  cases: FraudCase[];
  onResolve?: (id: string, resolution: string) => Promise<void>;
  onDismiss?: (id: string, reason: string) => Promise<void>;
  onInvestigate?: (id: string) => Promise<void>;
  loading?: boolean;
  className?: string;
}

// ==========================================
// FraudCaseCard
// ==========================================

export function FraudCaseCard({
  fraudCase,
  onResolve,
  onDismiss,
  onInvestigate,
  expanded: initialExpanded = false,
  className,
}: FraudCaseCardProps) {
  const [expanded, setExpanded] = useState(initialExpanded);
  const [resolving, setResolving] = useState(false);
  const [showResolveForm, setShowResolveForm] = useState(false);
  const [showDismissForm, setShowDismissForm] = useState(false);
  const [resolution, setResolution] = useState("");

  const severity = SEVERITY_CONFIG[fraudCase.severity];
  const typeLabel = FRAUD_TYPE_LABELS[fraudCase.type] || fraudCase.type;
  const isOpen = fraudCase.status === "OPEN" || fraudCase.status === "INVESTIGATING";

  const handleResolve = async () => {
    if (!onResolve || !resolution.trim()) return;
    setResolving(true);
    try {
      await onResolve(fraudCase.id, resolution);
      setShowResolveForm(false);
    } finally {
      setResolving(false);
    }
  };

  const handleDismiss = async () => {
    if (!onDismiss || !resolution.trim()) return;
    setResolving(true);
    try {
      await onDismiss(fraudCase.id, resolution);
      setShowDismissForm(false);
    } finally {
      setResolving(false);
    }
  };

  const handleInvestigate = async () => {
    if (!onInvestigate) return;
    setResolving(true);
    try {
      await onInvestigate(fraudCase.id);
    } finally {
      setResolving(false);
    }
  };

  return (
    <Card
      className={cn(
        "transition-all",
        isOpen && severity.borderClass,
        className
      )}
    >
      <CardContent className="p-4">
        {/* Header row */}
        <div className="flex items-start gap-3">
          {/* Severity indicator */}
          <div
            className={cn(
              "w-10 h-10 rounded-lg flex items-center justify-center shrink-0",
              severity.bgClass
            )}
          >
            <svg
              className={cn("w-5 h-5", severity.textClass)}
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
              <line x1="12" x2="12" y1="9" y2="13" />
              <line x1="12" x2="12.01" y1="17" y2="17" />
            </svg>
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="text-sm font-semibold">{typeLabel}</h4>
              <SeverityBadge severity={fraudCase.severity} />
              <StatusBadge status={fraudCase.status} />
            </div>
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
              {fraudCase.description}
            </p>
            <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                {fraudCase.streamerAvatar ? (
                  <img
                    src={fraudCase.streamerAvatar}
                    className="w-3.5 h-3.5 rounded-full"
                    alt=""
                  />
                ) : null}
                {fraudCase.streamerName}
              </span>
              <span>|</span>
              <span>{fraudCase.campaignName}</span>
              {fraudCase.amount && (
                <>
                  <span>|</span>
                  <span className="font-medium text-red-500">
                    ${fraudCase.amount.toFixed(2)}
                  </span>
                </>
              )}
              <span>|</span>
              <span>{formatTimeAgo(fraudCase.detectedAt)}</span>
            </div>
          </div>

          {/* Expand toggle */}
          <button
            onClick={() => setExpanded(!expanded)}
            className="p-1 rounded hover:bg-muted transition-colors shrink-0"
          >
            <svg
              className={cn(
                "w-4 h-4 text-muted-foreground transition-transform",
                expanded && "rotate-180"
              )}
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="m6 9 6 6 6-6" />
            </svg>
          </button>
        </div>

        {/* Expanded content */}
        {expanded && (
          <div className="mt-4 space-y-4">
            {/* Evidence */}
            <div>
              <h5 className="text-xs font-medium text-muted-foreground mb-2">
                Evidence
              </h5>
              <div className="space-y-1.5">
                {fraudCase.evidence.map((ev, i) => (
                  <div
                    key={i}
                    className={cn(
                      "flex items-center justify-between px-3 py-1.5 rounded text-xs",
                      ev.flagged
                        ? "bg-red-500/10 text-red-600 dark:text-red-400"
                        : "bg-muted"
                    )}
                  >
                    <span className="font-medium">{ev.label}</span>
                    <span className="font-mono text-right truncate max-w-[60%]">
                      {ev.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Resolution info (if resolved) */}
            {fraudCase.resolvedAt && (
              <div className="bg-muted/50 rounded-lg p-3">
                <p className="text-xs text-muted-foreground">
                  Resolved {formatTimeAgo(fraudCase.resolvedAt)}
                  {fraudCase.resolvedBy && ` by ${fraudCase.resolvedBy}`}
                </p>
                {fraudCase.resolution && (
                  <p className="text-sm mt-1">{fraudCase.resolution}</p>
                )}
              </div>
            )}

            {/* Actions (only for open cases) */}
            {isOpen && (
              <div className="space-y-3">
                {/* Resolve / Dismiss forms */}
                {(showResolveForm || showDismissForm) && (
                  <div className="space-y-2">
                    <textarea
                      value={resolution}
                      onChange={(e) => setResolution(e.target.value)}
                      placeholder={
                        showResolveForm
                          ? "Describe the resolution and actions taken..."
                          : "Reason for dismissing this case..."
                      }
                      rows={3}
                      className="w-full rounded-md border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    />
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant={showResolveForm ? "default" : "outline"}
                        onClick={showResolveForm ? handleResolve : handleDismiss}
                        disabled={resolving || !resolution.trim()}
                      >
                        {resolving
                          ? "Saving..."
                          : showResolveForm
                          ? "Confirm Resolution"
                          : "Confirm Dismiss"}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setShowResolveForm(false);
                          setShowDismissForm(false);
                          setResolution("");
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}

                {/* Action buttons */}
                {!showResolveForm && !showDismissForm && (
                  <div className="flex items-center gap-2">
                    {fraudCase.status === "OPEN" && onInvestigate && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleInvestigate}
                        disabled={resolving}
                      >
                        Investigate
                      </Button>
                    )}
                    {onResolve && (
                      <Button
                        size="sm"
                        onClick={() => {
                          setShowResolveForm(true);
                          setShowDismissForm(false);
                        }}
                      >
                        Resolve
                      </Button>
                    )}
                    {onDismiss && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-muted-foreground"
                        onClick={() => {
                          setShowDismissForm(true);
                          setShowResolveForm(false);
                        }}
                      >
                        Dismiss
                      </Button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ==========================================
// FraudCaseList — List with summary
// ==========================================

export function FraudCaseList({
  cases,
  onResolve,
  onDismiss,
  onInvestigate,
  loading,
  className,
}: FraudCaseListProps) {
  if (loading) {
    return (
      <div className={cn("space-y-3", className)}>
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-muted animate-pulse" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-40 bg-muted animate-pulse rounded" />
                  <div className="h-3 w-64 bg-muted animate-pulse rounded" />
                  <div className="h-3 w-48 bg-muted animate-pulse rounded" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (cases.length === 0) {
    return (
      <Card className={className}>
        <CardContent className="py-12 text-center">
          <div className="flex flex-col items-center gap-2 text-muted-foreground">
            <svg className="w-10 h-10" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
            <p className="text-sm">No fraud cases found</p>
            <p className="text-xs">All clear! No suspicious activity detected.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Summary stats
  const openCount = cases.filter((c) => c.status === "OPEN").length;
  const investigatingCount = cases.filter((c) => c.status === "INVESTIGATING").length;
  const criticalCount = cases.filter(
    (c) => c.severity === "CRITICAL" && (c.status === "OPEN" || c.status === "INVESTIGATING")
  ).length;
  const totalAmount = cases
    .filter((c) => c.status === "OPEN" || c.status === "INVESTIGATING")
    .reduce((sum, c) => sum + (c.amount || 0), 0);

  return (
    <div className={cn("space-y-4", className)}>
      {/* Summary bar */}
      <div className="flex items-center gap-4 text-sm">
        <span className="text-muted-foreground">
          <strong className="text-foreground">{openCount}</strong> open
        </span>
        <span className="text-muted-foreground">
          <strong className="text-foreground">{investigatingCount}</strong> investigating
        </span>
        {criticalCount > 0 && (
          <span className="text-red-500 font-medium">
            {criticalCount} critical
          </span>
        )}
        {totalAmount > 0 && (
          <span className="text-muted-foreground ml-auto">
            At risk: <strong className="text-red-500">${totalAmount.toFixed(2)}</strong>
          </span>
        )}
      </div>

      {/* Cases */}
      <div className="space-y-3">
        {cases.map((c) => (
          <FraudCaseCard
            key={c.id}
            fraudCase={c}
            onResolve={onResolve}
            onDismiss={onDismiss}
            onInvestigate={onInvestigate}
          />
        ))}
      </div>
    </div>
  );
}

// ==========================================
// SeverityBadge
// ==========================================

function SeverityBadge({ severity }: { severity: FraudCase["severity"] }) {
  const config = SEVERITY_CONFIG[severity];
  return (
    <span
      className={cn(
        "inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide",
        config.badgeClass
      )}
    >
      {severity}
    </span>
  );
}

// ==========================================
// Constants
// ==========================================

const SEVERITY_CONFIG = {
  LOW: {
    bgClass: "bg-blue-500/10",
    textClass: "text-blue-500",
    borderClass: "border-l-4 border-l-blue-500",
    badgeClass: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  },
  MEDIUM: {
    bgClass: "bg-amber-500/10",
    textClass: "text-amber-500",
    borderClass: "border-l-4 border-l-amber-500",
    badgeClass: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  },
  HIGH: {
    bgClass: "bg-orange-500/10",
    textClass: "text-orange-500",
    borderClass: "border-l-4 border-l-orange-500",
    badgeClass: "bg-orange-500/10 text-orange-600 dark:text-orange-400",
  },
  CRITICAL: {
    bgClass: "bg-red-500/10",
    textClass: "text-red-500",
    borderClass: "border-l-4 border-l-red-500",
    badgeClass: "bg-red-500/10 text-red-600 dark:text-red-400",
  },
};

const FRAUD_TYPE_LABELS: Record<string, string> = {
  DUPLICATE_IP: "Duplicate IP Detected",
  BOT_DETECTED: "Bot / Non-Human Traffic",
  GEO_MISMATCH: "Geographic Mismatch",
  CLICK_FARM: "Click Farm Pattern",
  SUSPICIOUS_PATTERN: "Suspicious Activity Pattern",
  MANUAL_REPORT: "Manual Fraud Report",
};

// ==========================================
// Helpers
// ==========================================

function formatTimeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}
