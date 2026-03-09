"use client";

import { useRouter } from "next/navigation";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/dashboard/data-table";
import { cn } from "@/lib/utils";

// ==========================================
// Types
// ==========================================

interface CampaignCardProps {
  campaign: {
    id: string;
    slug: string;
    name: string;
    shortDescription?: string | null;
    description: string;
    imageUrl?: string | null;
    conversionType: string;
    payoutPerConversion: number;
    categories: string[];
    countries: string[];
    status: string;
    totalBudget: number;
    remainingBudget: number;
    brand: {
      companyName: string;
      logo?: string | null;
      industry?: string | null;
    };
    _count?: {
      applications?: number;
    };
  };
  variant?: "marketplace" | "streamer" | "brand";
  onClick?: () => void;
  className?: string;
}

interface CampaignCardSkeletonProps {
  className?: string;
}

// ==========================================
// CampaignCard
// ==========================================

export function CampaignCard({
  campaign,
  variant = "marketplace",
  onClick,
  className,
}: CampaignCardProps) {
  const router = useRouter();
  const budgetPercent =
    campaign.totalBudget > 0
      ? ((campaign.totalBudget - campaign.remainingBudget) / campaign.totalBudget) * 100
      : 0;

  const handleClick = () => {
    if (onClick) {
      onClick();
    } else {
      router.push(`/marketplace/${campaign.slug}`);
    }
  };

  return (
    <Card
      className={cn(
        "group overflow-hidden transition-all hover:shadow-md cursor-pointer",
        className
      )}
      onClick={handleClick}
    >
      {/* Image / Header */}
      <div className="relative h-36 bg-gradient-to-br from-primary/10 to-primary/5 overflow-hidden">
        {campaign.imageUrl ? (
          <img
            src={campaign.imageUrl}
            alt={campaign.name}
            className="w-full h-full object-cover transition-transform group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className="text-4xl font-bold text-primary/20">
              {campaign.name.charAt(0).toUpperCase()}
            </span>
          </div>
        )}

        {/* Status badge overlay */}
        {variant !== "marketplace" && (
          <div className="absolute top-2 right-2">
            <StatusBadge status={campaign.status} />
          </div>
        )}

        {/* Conversion type badge */}
        <div className="absolute bottom-2 left-2">
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-background/90 backdrop-blur-sm text-foreground">
            {formatConversionType(campaign.conversionType)}
          </span>
        </div>
      </div>

      <CardContent className="p-4 space-y-3">
        {/* Brand info */}
        <div className="flex items-center gap-2">
          {campaign.brand.logo ? (
            <img
              src={campaign.brand.logo}
              alt={campaign.brand.companyName}
              className="w-5 h-5 rounded-full object-cover"
            />
          ) : (
            <div className="w-5 h-5 rounded-full bg-muted flex items-center justify-center">
              <span className="text-[10px] font-medium">
                {campaign.brand.companyName.charAt(0)}
              </span>
            </div>
          )}
          <span className="text-xs text-muted-foreground truncate">
            {campaign.brand.companyName}
          </span>
        </div>

        {/* Name + description */}
        <div>
          <h3 className="font-semibold text-sm leading-tight line-clamp-1 group-hover:text-primary transition-colors">
            {campaign.name}
          </h3>
          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
            {campaign.shortDescription || campaign.description}
          </p>
        </div>

        {/* Categories */}
        {campaign.categories.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {campaign.categories.slice(0, 3).map((cat) => (
              <span
                key={cat}
                className="inline-flex px-1.5 py-0.5 rounded text-[10px] bg-muted text-muted-foreground"
              >
                {cat}
              </span>
            ))}
            {campaign.categories.length > 3 && (
              <span className="text-[10px] text-muted-foreground py-0.5">
                +{campaign.categories.length - 3}
              </span>
            )}
          </div>
        )}

        {/* Payout highlight */}
        <div className="flex items-center justify-between pt-1">
          <div>
            <p className="text-lg font-bold text-primary">
              ${campaign.payoutPerConversion.toFixed(2)}
            </p>
            <p className="text-[10px] text-muted-foreground">per conversion</p>
          </div>
          {campaign._count?.applications != null && (
            <div className="text-right">
              <p className="text-sm font-medium">
                {campaign._count.applications}
              </p>
              <p className="text-[10px] text-muted-foreground">streamers</p>
            </div>
          )}
        </div>

        {/* Budget bar (brand variant) */}
        {variant === "brand" && (
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Budget used</span>
              <span>{budgetPercent.toFixed(0)}%</span>
            </div>
            <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
              <div
                className={cn(
                  "h-full rounded-full transition-all",
                  budgetPercent > 90
                    ? "bg-red-500"
                    : budgetPercent > 70
                    ? "bg-amber-500"
                    : "bg-primary"
                )}
                style={{ width: `${Math.min(budgetPercent, 100)}%` }}
              />
            </div>
          </div>
        )}
      </CardContent>

      {/* Footer actions */}
      {variant === "marketplace" && (
        <CardFooter className="px-4 pb-4 pt-0">
          <Button className="w-full" size="sm" onClick={(e) => e.stopPropagation()}>
            Apply Now
          </Button>
        </CardFooter>
      )}

      {variant === "streamer" && (
        <CardFooter className="px-4 pb-4 pt-0 gap-2">
          <Button variant="outline" size="sm" className="flex-1" onClick={(e) => e.stopPropagation()}>
            Get Link
          </Button>
          <Button variant="ghost" size="sm" onClick={(e) => e.stopPropagation()}>
            Stats
          </Button>
        </CardFooter>
      )}

      {variant === "brand" && (
        <CardFooter className="px-4 pb-4 pt-0 gap-2">
          <Button variant="outline" size="sm" className="flex-1" onClick={(e) => e.stopPropagation()}>
            Edit
          </Button>
          <Button variant="ghost" size="sm" onClick={(e) => e.stopPropagation()}>
            View
          </Button>
        </CardFooter>
      )}
    </Card>
  );
}

// ==========================================
// Campaign card grid
// ==========================================

interface CampaignGridProps {
  children: React.ReactNode;
  className?: string;
}

export function CampaignGrid({ children, className }: CampaignGridProps) {
  return (
    <div
      className={cn(
        "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4",
        className
      )}
    >
      {children}
    </div>
  );
}

// ==========================================
// Skeleton
// ==========================================

export function CampaignCardSkeleton({ className }: CampaignCardSkeletonProps) {
  return (
    <Card className={cn("overflow-hidden", className)}>
      <div className="h-36 bg-muted animate-pulse" />
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-full bg-muted animate-pulse" />
          <div className="h-3 w-20 bg-muted animate-pulse rounded" />
        </div>
        <div className="space-y-1.5">
          <div className="h-4 w-3/4 bg-muted animate-pulse rounded" />
          <div className="h-3 w-full bg-muted animate-pulse rounded" />
          <div className="h-3 w-2/3 bg-muted animate-pulse rounded" />
        </div>
        <div className="flex gap-1">
          <div className="h-4 w-12 bg-muted animate-pulse rounded" />
          <div className="h-4 w-14 bg-muted animate-pulse rounded" />
        </div>
        <div className="flex justify-between pt-1">
          <div className="h-7 w-16 bg-muted animate-pulse rounded" />
          <div className="h-5 w-10 bg-muted animate-pulse rounded" />
        </div>
      </CardContent>
      <CardFooter className="px-4 pb-4 pt-0">
        <div className="h-9 w-full bg-muted animate-pulse rounded" />
      </CardFooter>
    </Card>
  );
}

export function CampaignGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <CampaignGrid>
      {Array.from({ length: count }).map((_, i) => (
        <CampaignCardSkeleton key={i} />
      ))}
    </CampaignGrid>
  );
}

// ==========================================
// Helpers
// ==========================================

function formatConversionType(type: string): string {
  const map: Record<string, string> = {
    SALE: "CPS",
    LEAD: "CPL",
    INSTALL: "CPI",
    SIGNUP: "CPA",
    DEPOSIT: "CPA",
    SUBSCRIPTION: "CPS",
    PURCHASE: "CPS",
    CUSTOM: "Custom",
  };
  return map[type] || type;
}
