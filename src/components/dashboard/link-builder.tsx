"use client";

import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

// ==========================================
// Types
// ==========================================

interface AffiliateLink {
  id: string;
  slug: string;
  campaignId: string;
  campaignName: string;
  url: string; // The full tracking URL
  originalUrl: string; // The landing page URL
  totalClicks: number;
  totalConversions: number;
  earnings: number;
  isActive: boolean;
  createdAt: string;
}

interface LinkBuilderProps {
  links: AffiliateLink[];
  baseUrl?: string; // e.g. "https://streamcpa.com/r/"
  onGenerateLink?: (campaignId: string) => Promise<AffiliateLink>;
  onToggleLink?: (linkId: string, active: boolean) => Promise<void>;
  loading?: boolean;
  className?: string;
}

interface LinkRowProps {
  link: AffiliateLink;
  onToggle?: (linkId: string, active: boolean) => Promise<void>;
}

// ==========================================
// LinkBuilder — Main component
// ==========================================

export function LinkBuilder({
  links,
  baseUrl = "/r/",
  onGenerateLink,
  onToggleLink,
  loading,
  className,
}: LinkBuilderProps) {
  const [filter, setFilter] = useState("");

  const filtered = links.filter(
    (l) =>
      l.campaignName.toLowerCase().includes(filter.toLowerCase()) ||
      l.slug.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <div className={cn("space-y-4", className)}>
      {/* Search */}
      <div className="flex items-center gap-3">
        <Input
          placeholder="Search links..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="max-w-xs h-9"
        />
        <span className="text-sm text-muted-foreground">
          {filtered.length} link{filtered.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Links list */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <LinkRowSkeleton key={i} />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <div className="flex flex-col items-center gap-2 text-muted-foreground">
              <svg className="w-10 h-10" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
              </svg>
              <p className="text-sm">No affiliate links yet</p>
              <p className="text-xs">Apply to campaigns to generate tracking links</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((link) => (
            <LinkRow key={link.id} link={link} onToggle={onToggleLink} />
          ))}
        </div>
      )}
    </div>
  );
}

// ==========================================
// LinkRow — Single link card
// ==========================================

function LinkRow({ link, onToggle }: LinkRowProps) {
  const [copied, setCopied] = useState(false);
  const [toggling, setToggling] = useState(false);

  const copyToClipboard = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(link.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      const textarea = document.createElement("textarea");
      textarea.value = link.url;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [link.url]);

  const handleToggle = async () => {
    if (!onToggle) return;
    setToggling(true);
    try {
      await onToggle(link.id, !link.isActive);
    } finally {
      setToggling(false);
    }
  };

  const epc = link.totalClicks > 0 ? link.earnings / link.totalClicks : 0;
  const cvr = link.totalClicks > 0 ? (link.totalConversions / link.totalClicks) * 100 : 0;

  return (
    <Card className={cn(!link.isActive && "opacity-60")}>
      <CardContent className="p-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          {/* Link info */}
          <div className="flex-1 min-w-0 space-y-1">
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-medium truncate">
                {link.campaignName}
              </h4>
              <span
                className={cn(
                  "inline-flex h-1.5 w-1.5 rounded-full",
                  link.isActive ? "bg-emerald-500" : "bg-gray-400"
                )}
              />
            </div>
            {/* URL with copy */}
            <div className="flex items-center gap-2">
              <code className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded truncate max-w-md">
                {link.url}
              </code>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 shrink-0"
                onClick={copyToClipboard}
              >
                {copied ? (
                  <svg className="w-3.5 h-3.5 text-emerald-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                ) : (
                  <svg className="w-3.5 h-3.5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect width="14" height="14" x="8" y="8" rx="2" />
                    <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
                  </svg>
                )}
              </Button>
            </div>
          </div>

          {/* Stats */}
          <div className="flex items-center gap-4 text-center shrink-0">
            <div>
              <p className="text-sm font-medium">{link.totalClicks.toLocaleString()}</p>
              <p className="text-[10px] text-muted-foreground">Clicks</p>
            </div>
            <div>
              <p className="text-sm font-medium">{link.totalConversions.toLocaleString()}</p>
              <p className="text-[10px] text-muted-foreground">Conv</p>
            </div>
            <div>
              <p className="text-sm font-medium">{cvr.toFixed(1)}%</p>
              <p className="text-[10px] text-muted-foreground">CVR</p>
            </div>
            <div>
              <p className="text-sm font-medium">${epc.toFixed(2)}</p>
              <p className="text-[10px] text-muted-foreground">EPC</p>
            </div>
            <div>
              <p className="text-sm font-semibold text-primary">${link.earnings.toFixed(2)}</p>
              <p className="text-[10px] text-muted-foreground">Earned</p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1 shrink-0">
            <Button
              variant="ghost"
              size="sm"
              className="h-8"
              onClick={handleToggle}
              disabled={toggling}
            >
              {link.isActive ? "Pause" : "Enable"}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ==========================================
// Standalone copy link component
// ==========================================

interface CopyLinkProps {
  url: string;
  label?: string;
  className?: string;
}

export function CopyLink({ url, label, className }: CopyLinkProps) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={cn("flex items-center gap-2", className)}>
      {label && <Label className="text-sm shrink-0">{label}</Label>}
      <div className="flex items-center gap-1 flex-1 min-w-0">
        <Input
          value={url}
          readOnly
          className="h-8 text-xs font-mono"
          onClick={(e) => (e.target as HTMLInputElement).select()}
        />
        <Button variant="outline" size="sm" className="h-8 shrink-0" onClick={copy}>
          {copied ? "Copied!" : "Copy"}
        </Button>
      </div>
    </div>
  );
}

// ==========================================
// Skeleton
// ==========================================

function LinkRowSkeleton() {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-4">
          <div className="flex-1 space-y-2">
            <div className="h-4 w-32 bg-muted animate-pulse rounded" />
            <div className="h-3 w-48 bg-muted animate-pulse rounded" />
          </div>
          <div className="flex gap-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="text-center">
                <div className="h-4 w-8 bg-muted animate-pulse rounded mx-auto" />
                <div className="h-2 w-6 bg-muted animate-pulse rounded mx-auto mt-1" />
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
