/**
 * Marketplace — grid of active campaigns with filters
 * Route: /marketplace
 */
"use client";

import { useState } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { formatCurrency, formatNumber } from "@/lib/utils";
import {
  Search,
  SlidersHorizontal,
  DollarSign,
  Users,
  MousePointerClick,
  ArrowUpDown,
  Loader2,
  ShoppingBag,
} from "lucide-react";
import { cn } from "@/lib/utils";

const CONVERSION_TYPES = [
  { value: "", label: "All Types" },
  { value: "SALE", label: "Sale" },
  { value: "LEAD", label: "Lead" },
  { value: "INSTALL", label: "Install" },
  { value: "SIGNUP", label: "Signup" },
  { value: "DEPOSIT", label: "Deposit" },
  { value: "SUBSCRIPTION", label: "Subscription" },
];

const SORT_OPTIONS = [
  { value: "newest", label: "Newest" },
  { value: "payout", label: "Highest Payout" },
  { value: "epc", label: "Best EPC" },
];

export default function MarketplacePage() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [conversionType, setConversionType] = useState("");
  const [sortBy, setSortBy] = useState<"newest" | "payout" | "epc">("newest");
  const [page, setPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);

  const { data: categories } = trpc.campaign.getCategories.useQuery();

  const { data, isLoading } = trpc.campaign.listMarketplace.useQuery({
    search: search || undefined,
    category: category || undefined,
    conversionType: conversionType as any || undefined,
    sortBy,
    page,
    limit: 12,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Marketplace</h1>
        <p className="text-muted-foreground">Find campaigns to promote and start earning.</p>
      </div>

      {/* Search and filter bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search campaigns..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="pl-10"
          />
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
            className="gap-2"
          >
            <SlidersHorizontal className="h-4 w-4" />
            Filters
          </Button>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Expandable filters */}
      {showFilters && (
        <div className="flex flex-wrap gap-4 rounded-lg border bg-card p-4">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Category</label>
            <select
              value={category}
              onChange={(e) => { setCategory(e.target.value); setPage(1); }}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">All Categories</option>
              {categories?.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Conversion Type</label>
            <select
              value={conversionType}
              onChange={(e) => { setConversionType(e.target.value); setPage(1); }}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            >
              {CONVERSION_TYPES.map((ct) => (
                <option key={ct.value} value={ct.value}>{ct.label}</option>
              ))}
            </select>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => { setCategory(""); setConversionType(""); setSearch(""); }}
          >
            Clear filters
          </Button>
        </div>
      )}

      {/* Campaign grid */}
      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : !data?.campaigns.length ? (
        <Card>
          <CardContent className="flex flex-col items-center py-16">
            <ShoppingBag className="h-12 w-12 text-muted-foreground" />
            <p className="mt-4 text-lg font-medium">No campaigns found</p>
            <p className="text-sm text-muted-foreground">Try adjusting your filters.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {data.campaigns.map((campaign) => (
              <Link key={campaign.id} href={`/marketplace/${campaign.slug}`}>
                <Card className="h-full transition-all hover:border-primary/50 hover:shadow-md">
                  {/* Campaign image */}
                  {campaign.imageUrl && (
                    <div className="aspect-video overflow-hidden rounded-t-lg">
                      <img
                        src={campaign.imageUrl}
                        alt={campaign.name}
                        className="h-full w-full object-cover"
                      />
                    </div>
                  )}
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="font-semibold leading-tight">{campaign.name}</h3>
                        <p className="text-xs text-muted-foreground">
                          by {campaign.brand.companyName}
                        </p>
                      </div>
                      <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                        {campaign.conversionType}
                      </span>
                    </div>
                  </CardHeader>
                  <CardContent className="pb-2">
                    <p className="line-clamp-2 text-sm text-muted-foreground">
                      {campaign.shortDescription || campaign.description}
                    </p>
                  </CardContent>
                  <CardFooter className="flex items-center justify-between border-t pt-4">
                    <div className="flex items-center gap-1 text-sm font-semibold text-brand-green">
                      <DollarSign className="h-4 w-4" />
                      {formatCurrency(campaign.payoutPerConversion)}
                      <span className="text-xs font-normal text-muted-foreground">/conv</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        {campaign._count.applications}
                      </span>
                      {campaign.categories[0] && (
                        <span className="rounded bg-secondary px-1.5 py-0.5">
                          {campaign.categories[0]}
                        </span>
                      )}
                    </div>
                  </CardFooter>
                </Card>
              </Link>
            ))}
          </div>

          {/* Pagination */}
          {data.pages > 1 && (
            <div className="flex justify-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
              >
                Previous
              </Button>
              <span className="flex items-center px-3 text-sm text-muted-foreground">
                Page {page} of {data.pages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= data.pages}
                onClick={() => setPage(page + 1)}
              >
                Next
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
