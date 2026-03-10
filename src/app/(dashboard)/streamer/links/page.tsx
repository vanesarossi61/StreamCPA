/**
 * Streamer — My Affiliate Links with per-link analytics
 * Route: /streamer/links
 *
 * Shows all affiliate links with click/conversion metrics,
 * copy-to-clipboard, and link status management.
 */
"use client";

import { useState } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/components/ui/use-toast";
import { formatCurrency, formatNumber, cn } from "@/lib/utils";
import {
  LinkIcon,
  Copy,
  Check,
  ExternalLink,
  MousePointerClick,
  TrendingUp,
  DollarSign,
  Loader2,
  Search,
  ToggleLeft,
  ToggleRight,
  BarChart3,
} from "lucide-react";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

export default function StreamerLinksPage() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const { data: links, isLoading } = trpc.campaign.getMyLinks.useQuery();

  const toggleLink = trpc.campaign.toggleLink.useMutation({
    onSuccess: () => {
      toast({ title: "Link updated" });
    },
    onError: (err) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const copyToClipboard = async (slug: string, id: string) => {
    const url = `${APP_URL}/r/${slug}`;
    await navigator.clipboard.writeText(url);
    setCopiedId(id);
    toast({ title: "Link copied!", description: url });
    setTimeout(() => setCopiedId(null), 2000);
  };

  const filteredLinks = links?.filter(
    (link) =>
      link.campaign.name.toLowerCase().includes(search.toLowerCase()) ||
      link.slug.toLowerCase().includes(search.toLowerCase()),
  );

  // Summary stats
  const totalClicks = links?.reduce((sum, l) => sum + l.totalClicks, 0) || 0;
  const totalConversions = links?.reduce((sum, l) => sum + l.totalConversions, 0) || 0;
  const totalEarnings = links?.reduce((sum, l) => sum + l.totalEarnings, 0) || 0;
  const avgCVR =
    totalClicks > 0 ? ((totalConversions / totalClicks) * 100).toFixed(1) : "0.0";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">My Links</h1>
          <p className="text-muted-foreground">
            Manage your affiliate links and track performance.
          </p>
        </div>
        <Link href="/marketplace">
          <Button variant="outline" className="gap-2">
            <LinkIcon className="h-4 w-4" /> Browse Campaigns
          </Button>
        </Link>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="flex items-center gap-3 pt-6">
            <div className="rounded-lg bg-blue-500/10 p-2">
              <MousePointerClick className="h-5 w-5 text-blue-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Clicks</p>
              <p className="text-2xl font-bold">{formatNumber(totalClicks)}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 pt-6">
            <div className="rounded-lg bg-brand-green/10 p-2">
              <TrendingUp className="h-5 w-5 text-brand-green" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Conversions</p>
              <p className="text-2xl font-bold">{formatNumber(totalConversions)}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 pt-6">
            <div className="rounded-lg bg-brand-green/10 p-2">
              <DollarSign className="h-5 w-5 text-brand-green" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Earnings</p>
              <p className="text-2xl font-bold">{formatCurrency(totalEarnings)}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 pt-6">
            <div className="rounded-lg bg-brand-orange/10 p-2">
              <BarChart3 className="h-5 w-5 text-brand-orange" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Avg CVR</p>
              <p className="text-2xl font-bold">{avgCVR}%</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search by campaign or link..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Links Table */}
      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : !filteredLinks?.length ? (
        <Card>
          <CardContent className="flex flex-col items-center py-16">
            <LinkIcon className="h-12 w-12 text-muted-foreground" />
            <p className="mt-4 text-lg font-medium">No affiliate links yet</p>
            <p className="text-sm text-muted-foreground mb-4">
              Apply to campaigns in the marketplace to get your affiliate links.
            </p>
            <Link href="/marketplace">
              <Button>Browse Marketplace</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Campaign</TableHead>
                  <TableHead>Link</TableHead>
                  <TableHead className="text-right">Clicks</TableHead>
                  <TableHead className="text-right">Conversions</TableHead>
                  <TableHead className="text-right">CVR</TableHead>
                  <TableHead className="text-right">Earnings</TableHead>
                  <TableHead className="text-right">EPC</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLinks.map((link) => {
                  const cvr =
                    link.totalClicks > 0
                      ? ((link.totalConversions / link.totalClicks) * 100).toFixed(1)
                      : "0.0";
                  const epc =
                    link.totalClicks > 0
                      ? (link.totalEarnings / link.totalClicks).toFixed(2)
                      : "0.00";

                  return (
                    <TableRow key={link.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="flex h-8 w-8 items-center justify-center rounded bg-primary/10">
                            {link.campaign.brand.logo ? (
                              <img
                                src={link.campaign.brand.logo}
                                alt=""
                                className="h-6 w-6 rounded object-cover"
                              />
                            ) : (
                              <LinkIcon className="h-4 w-4 text-primary" />
                            )}
                          </div>
                          <div>
                            <Link
                              href={`/marketplace/${link.campaign.slug}`}
                              className="font-medium hover:text-primary"
                            >
                              {link.campaign.name}
                            </Link>
                            <p className="text-xs text-muted-foreground">
                              {link.campaign.brand.companyName} &middot;{" "}
                              {formatCurrency(link.campaign.payoutPerConversion)}/conv
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <code className="rounded bg-muted px-2 py-1 text-xs">
                          /r/{link.slug}
                        </code>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatNumber(link.totalClicks)}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {link.totalConversions}
                      </TableCell>
                      <TableCell className="text-right">{cvr}%</TableCell>
                      <TableCell className="text-right font-medium text-brand-green">
                        {formatCurrency(link.totalEarnings)}
                      </TableCell>
                      <TableCell className="text-right">${epc}</TableCell>
                      <TableCell className="text-center">
                        <Badge
                          variant={
                            link.isActive && link.campaign.status === "ACTIVE"
                              ? "success"
                              : "secondary"
                          }
                        >
                          {link.isActive && link.campaign.status === "ACTIVE"
                            ? "Active"
                            : link.campaign.status !== "ACTIVE"
                              ? "Campaign " + link.campaign.status.toLowerCase()
                              : "Paused"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => copyToClipboard(link.slug, link.id)}
                            className="h-8 w-8 p-0"
                          >
                            {copiedId === link.id ? (
                              <Check className="h-4 w-4 text-brand-green" />
                            ) : (
                              <Copy className="h-4 w-4" />
                            )}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() =>
                              toggleLink.mutate({
                                linkId: link.id,
                                isActive: !link.isActive,
                              })
                            }
                            className="h-8 w-8 p-0"
                          >
                            {link.isActive ? (
                              <ToggleRight className="h-4 w-4 text-brand-green" />
                            ) : (
                              <ToggleLeft className="h-4 w-4 text-muted-foreground" />
                            )}
                          </Button>
                          <a
                            href={`${APP_URL}/r/${link.slug}`}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <Button size="sm" variant="ghost" className="h-8 w-8 p-0">
                              <ExternalLink className="h-4 w-4" />
                            </Button>
                          </a>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
