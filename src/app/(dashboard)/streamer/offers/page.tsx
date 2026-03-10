/**
 * Streamer — My Offers (campaigns I've applied to)
 * Route: /streamer/offers
 */
"use client";

import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { Megaphone, Loader2, CheckCircle2, Clock, XCircle, ExternalLink } from "lucide-react";

const STATUS_CONFIG: Record<string, { icon: any; color: string; label: string }> = {
  APPROVED: { icon: CheckCircle2, color: "text-brand-green", label: "Active" },
  PENDING: { icon: Clock, color: "text-brand-orange", label: "Pending Review" },
  REJECTED: { icon: XCircle, color: "text-destructive", label: "Rejected" },
  WITHDRAWN: { icon: XCircle, color: "text-muted-foreground", label: "Withdrawn" },
};

export default function StreamerOffersPage() {
  const { data: offers, isLoading } = trpc.campaign.listMyOffers.useQuery();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">My Offers</h1>
          <p className="text-muted-foreground">Campaigns you&apos;ve applied to and your active promotions.</p>
        </div>
        <Link href="/marketplace">
          <Button variant="outline" className="gap-2">
            <Megaphone className="h-4 w-4" /> Browse Marketplace
          </Button>
        </Link>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : !offers?.length ? (
        <Card>
          <CardContent className="flex flex-col items-center py-16">
            <Megaphone className="h-12 w-12 text-muted-foreground" />
            <p className="mt-4 text-lg font-medium">No offers yet</p>
            <p className="text-sm text-muted-foreground mb-4">Browse the marketplace to find campaigns to promote.</p>
            <Link href="/marketplace"><Button>Go to Marketplace</Button></Link>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {offers.map((offer) => {
            const status = STATUS_CONFIG[offer.status] || STATUS_CONFIG.PENDING;
            const StatusIcon = status.icon;

            return (
              <Card key={offer.id}>
                <CardContent className="flex items-center gap-4 py-4">
                  {/* Brand logo / placeholder */}
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                    {offer.campaign.brand.logo ? (
                      <img src={offer.campaign.brand.logo} alt="" className="h-10 w-10 rounded object-cover" />
                    ) : (
                      <Megaphone className="h-5 w-5 text-primary" />
                    )}
                  </div>

                  {/* Campaign info */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/marketplace/${offer.campaign.slug}`}
                        className="truncate font-medium hover:text-primary"
                      >
                        {offer.campaign.name}
                      </Link>
                      <div className={cn("flex items-center gap-1 text-xs font-medium", status.color)}>
                        <StatusIcon className="h-3 w-3" />
                        {status.label}
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {offer.campaign.brand.companyName} &middot; {offer.campaign.conversionType} &middot;{" "}
                      <span className="text-brand-green font-medium">
                        {formatCurrency(offer.campaign.payoutPerConversion)}/conv
                      </span>
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2">
                    {offer.status === "APPROVED" && (
                      <Link href="/streamer/links">
                        <Button size="sm" variant="outline" className="gap-1">
                          <ExternalLink className="h-3 w-3" /> My Link
                        </Button>
                      </Link>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
