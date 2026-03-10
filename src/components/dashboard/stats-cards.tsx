"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

// ==========================================
// Types
// ==========================================

interface StatCardProps {
  title: string;
  value: string | number;
  description?: string;
  icon?: React.ReactNode;
  trend?: {
    value: number; // percentage change
    label?: string; // e.g. "vs last month"
  };
  className?: string;
  loading?: boolean;
}

interface StatsGridProps {
  children: React.ReactNode;
  columns?: 2 | 3 | 4;
  className?: string;
}

// ==========================================
// StatCard — Single KPI card
// ==========================================

export function StatCard({
  title,
  value,
  description,
  icon,
  trend,
  className,
  loading = false,
}: StatCardProps) {
  const isPositive = trend && trend.value >= 0;

  return (
    <Card className={cn("relative overflow-hidden", className)}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        {icon && (
          <div className="h-8 w-8 rounded-md bg-primary/10 flex items-center justify-center text-primary">
            {icon}
          </div>
        )}
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-2">
            <div className="h-7 w-24 bg-muted animate-pulse rounded" />
            <div className="h-4 w-32 bg-muted animate-pulse rounded" />
          </div>
        ) : (
          <>
            <div className="text-2xl font-bold tracking-tight">
              {typeof value === "number" ? formatValue(value) : value}
            </div>
            <div className="flex items-center gap-2 mt-1">
              {trend && (
                <span
                  className={cn(
                    "inline-flex items-center text-xs font-medium px-1.5 py-0.5 rounded-full",
                    isPositive
                      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                      : "bg-red-500/10 text-red-600 dark:text-red-400"
                  )}
                >
                  <TrendIcon direction={isPositive ? "up" : "down"} />
                  {Math.abs(trend.value).toFixed(1)}%
                </span>
              )}
              {(description || trend?.label) && (
                <p className="text-xs text-muted-foreground">
                  {description || trend?.label}
                </p>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ==========================================
// StatsGrid — Layout wrapper for stat cards
// ==========================================

export function StatsGrid({ children, columns = 4, className }: StatsGridProps) {
  return (
    <div
      className={cn(
        "grid gap-4",
        columns === 2 && "grid-cols-1 sm:grid-cols-2",
        columns === 3 && "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
        columns === 4 && "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4",
        className
      )}
    >
      {children}
    </div>
  );
}

// ==========================================
// Pre-built stat card variants
// ==========================================

interface MoneyStatProps {
  title: string;
  amount: number;
  currency?: string;
  trend?: { value: number; label?: string };
  loading?: boolean;
  className?: string;
}

export function MoneyStatCard({
  title,
  amount,
  currency = "$",
  trend,
  loading,
  className,
}: MoneyStatProps) {
  return (
    <StatCard
      title={title}
      value={`${currency}${formatMoney(amount)}`}
      trend={trend}
      loading={loading}
      className={className}
      icon={
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="12" x2="12" y1="2" y2="22" />
          <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
        </svg>
      }
    />
  );
}

interface PercentStatProps {
  title: string;
  value: number; // 0-100
  trend?: { value: number; label?: string };
  loading?: boolean;
  className?: string;
}

export function PercentStatCard({
  title,
  value,
  trend,
  loading,
  className,
}: PercentStatProps) {
  return (
    <StatCard
      title={title}
      value={`${value.toFixed(2)}%`}
      trend={trend}
      loading={loading}
      className={className}
      icon={
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="19" x2="5" y1="5" y2="19" />
          <circle cx="6.5" cy="6.5" r="2.5" />
          <circle cx="17.5" cy="17.5" r="2.5" />
        </svg>
      }
    />
  );
}

interface CountStatProps {
  title: string;
  count: number;
  description?: string;
  trend?: { value: number; label?: string };
  loading?: boolean;
  className?: string;
}

export function CountStatCard({
  title,
  count,
  description,
  trend,
  loading,
  className,
}: CountStatProps) {
  return (
    <StatCard
      title={title}
      value={count.toLocaleString()}
      description={description}
      trend={trend}
      loading={loading}
      className={className}
      icon={
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
        </svg>
      }
    />
  );
}

// ==========================================
// Helpers
// ==========================================

function TrendIcon({ direction }: { direction: "up" | "down" }) {
  if (direction === "up") {
    return (
      <svg className="w-3 h-3 mr-0.5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
        <polyline points="16 7 22 7 22 13" />
      </svg>
    );
  }
  return (
    <svg className="w-3 h-3 mr-0.5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 17 13.5 8.5 8.5 13.5 2 7" />
      <polyline points="16 17 22 17 22 11" />
    </svg>
  );
}

function formatValue(val: number): string {
  if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(1)}M`;
  if (val >= 1_000) return `${(val / 1_000).toFixed(1)}K`;
  return val.toLocaleString();
}

function formatMoney(amount: number): string {
  if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(2)}M`;
  if (amount >= 10_000) return `${(amount / 1_000).toFixed(1)}K`;
  return amount.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

// ==========================================
// Skeleton loader for stats grid
// ==========================================

export function StatsGridSkeleton({ count = 4 }: { count?: number }) {
  return (
    <StatsGrid columns={count as 2 | 3 | 4}>
      {Array.from({ length: count }).map((_, i) => (
        <StatCard key={i} title="" value="" loading />
      ))}
    </StatsGrid>
  );
}
