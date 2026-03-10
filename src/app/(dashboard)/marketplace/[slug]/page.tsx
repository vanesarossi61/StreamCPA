/**
 * Campaign detail page — full info + apply button
 * Route: /marketplace/[slug]
 */
"use client";

import { useParams, useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { useSession } from "next-auth/react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { formatCurrency, formatNumber, timeAgo } from "@/lib/utils";
import {
  ArrowLeft,
  DollarSign,
  Users,
  Globe,
  Calendar,
  Target,
  Clock,
  CheckCircle2,
  Loader2,
  ExternalLink,
  Shield,
  Zap,
} from "lucide-react";

export default function CampaignDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { data: session } = useSession();
  const { toast } = useToast();
  const [applyMessage, setApplyMessage] = useState("");

  const slug = params.slug as string;

  const { data: campaign, isLoading } = trpc.campaign.getBySlug.useQuery(
    { slug },
    { enabled: !!slug },
  );

  const { data: myApplication } = trpc.campaign.getMyApplication.useQuery(
    { campaignId: campaign?.id || "" },
    { enabled: !!campaign?.id && session?.user?.role === "STREAMER" },
  );

  const apply = trpc.campaign.apply.useMutation({
    onSuccess: (data) => {
      toast({
        title: data.autoApproved ? "You're in!" : "Application submitted!",
        description: data.autoApproved
          ? "Your affiliate link is ready. Check 'My Offers'."
          : "The brand will review your application.",
      });
    },
    onError: (err) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="py-16 text-center">
        <p className="text-lg font-medium">Campaign not found</p>
        <Button variant="link" onClick={() => router.push("/marketplace")}>
          Back to Marketplace
        </Button>
      </div>
    );
  }

  const isStreamer = session?.user?.role === "STREAMER";
  const hasApplied = !!myApplication;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Back button */}
      <Button variant="ghost" size="sm" onClick={() => router.push("/marketplace")}>
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to Marketplace
      </Button>

      {/* Hero */}
      <div className="space-y-4">
        {campaign.imageUrl && (
          <div className="aspect-[3/1] overflow-hidden rounded-lg">
            <img src={campaign.imageUrl} alt={campaign.name} className="h-full w-full object-cover" />
          </div>
        )}

        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-3xl font-bold">{campaign.name}</h1>
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                {campaign.conversionType}
              </span>
            </div>
            <p className="mt-1 text-muted-foreground">
              by {campaign.brand.companyName}
              {campaign.brand.website && (
                <a
                  href={campaign.brand.website}
                  target="_blank"
                  rel="noopener"
                  className="ml-2 inline-flex items-center gap-1 text-primary hover:underline"
                >
                  <ExternalLink className="h-3 w-3" />
                  Website
                </a>
              )}
            </p>
          </div>

          {/* Payout badge */}
          <div className="flex flex-col items-center rounded-lg border bg-brand-green/10 px-6 py-3">
            <span className="text-xs text-muted-foreground">Payout per conversion</span>
            <span className="text-2xl font-bold text-brand-green">
              {formatCurrency(campaign.payoutPerConversion)}
            </span>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main content */}
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>About this Campaign</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-wrap text-sm leading-relaxed">{campaign.description}</p>
            </CardContent>
          </Card>

          {/* Materials */}
          {campaign.materials.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Promotional Materials</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {campaign.materials.map((material) => (
                    <div key={material.id} className="flex items-center justify-between rounded-lg border p-3">
                      <div>
                        <p className="text-sm font-medium">{material.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {material.type}{material.dimensions && ` - ${material.dimensions}`}
                        </p>
                      </div>
                      <Button variant="outline" size="sm" asChild>
                        <a href={material.content} target="_blank" rel="noopener">
                          View
                        </a>
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Apply card */}
          {isStreamer && (
            <Card>
              <CardContent className="pt-6">
                {hasApplied ? (
                  <div className="flex flex-col items-center text-center">
                    <CheckCircle2 className="h-8 w-8 text-brand-green" />
                    <p className="mt-2 font-medium">
                      {myApplication?.status === "APPROVED"
                        ? "You're accepted!"
                        : myApplication?.status === "PENDING"
                          ? "Application pending"
                          : `Status: ${myApplication?.status}`}
                    </p>
                    {myApplication?.status === "APPROVED" && (
                      <Button size="sm" className="mt-3" onClick={() => router.push("/streamer/links")}>
                        Get your link
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3">
                    <textarea
                      value={applyMessage}
                      onChange={(e) => setApplyMessage(e.target.value)}
                      placeholder="Optional message to the brand..."
                      className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      maxLength={500}
                    />
                    <Button
                      className="w-full"
                      onClick={() => apply.mutate({ campaignId: campaign.id, message: applyMessage || undefined })}
                      disabled={apply.isPending}
                    >
                      {apply.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      {campaign.approvalMode === "AUTO" ? "Join Campaign" : "Apply Now"}
                    </Button>
                    {campaign.approvalMode === "AUTO" && (
                      <p className="text-center text-xs text-muted-foreground">
                        <Zap className="mr-1 inline h-3 w-3" />
                        Instant approval
                      </p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Campaign details */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Campaign Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-muted-foreground">
                  <Target className="h-4 w-4" /> Type
                </span>
                <span className="font-medium">{campaign.conversionType}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-muted-foreground">
                  <DollarSign className="h-4 w-4" /> Payout
                </span>
                <span className="font-medium text-brand-green">
                  {formatCurrency(campaign.payoutPerConversion)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-muted-foreground">
                  <Clock className="h-4 w-4" /> Attribution
                </span>
                <span className="font-medium">{campaign.attributionWindow} days</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-muted-foreground">
                  <Users className="h-4 w-4" /> Streamers
                </span>
                <span className="font-medium">{campaign._count.applications} active</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-muted-foreground">
                  <Shield className="h-4 w-4" /> Approval
                </span>
                <span className="font-medium">
                  {campaign.approvalMode === "AUTO" ? "Instant" : "Manual review"}
                </span>
              </div>
              {campaign.categories.length > 0 && (
                <div className="border-t pt-3">
                  <p className="mb-2 text-xs text-muted-foreground">Categories</p>
                  <div className="flex flex-wrap gap-1">
                    {campaign.categories.map((cat) => (
                      <span key={cat} className="rounded bg-secondary px-1.5 py-0.5 text-xs">{cat}</span>
                    ))}
                  </div>
                </div>
              )}
              {campaign.countries.length > 0 && (
                <div className="border-t pt-3">
                  <p className="mb-2 text-xs text-muted-foreground">Target countries</p>
                  <div className="flex flex-wrap gap-1">
                    {campaign.countries.map((co) => (
                      <span key={co} className="rounded bg-secondary px-1.5 py-0.5 text-xs">{co}</span>
                    ))}
                  </div>
                </div>
              )}
              {(campaign.minFollowers > 0 || campaign.minAvgViewers > 0) && (
                <div className="border-t pt-3">
                  <p className="mb-2 text-xs text-muted-foreground">Requirements</p>
                  {campaign.minFollowers > 0 && (
                    <p className="text-xs">Min. {formatNumber(campaign.minFollowers)} followers</p>
                  )}
                  {campaign.minAvgViewers > 0 && (
                    <p className="text-xs">Min. {formatNumber(campaign.minAvgViewers)} avg viewers</p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
