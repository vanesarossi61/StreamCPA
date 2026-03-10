/**
 * Admin — Brand verification queue
 * Route: /admin/brands
 */
"use client";

import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { useState } from "react";
import {
  CheckCircle2,
  XCircle,
  Building2,
  Mail,
  Globe,
  Calendar,
  Loader2,
} from "lucide-react";

export default function AdminBrandsPage() {
  const { toast } = useToast();
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const { data: pendingBrands, refetch } = trpc.admin.getPendingBrands.useQuery();

  const approveBrand = trpc.admin.approveBrand.useMutation({
    onSuccess: () => {
      toast({ title: "Brand approved!" });
      refetch();
    },
    onError: (err) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const rejectBrand = trpc.admin.rejectBrand.useMutation({
    onSuccess: () => {
      toast({ title: "Brand rejected" });
      setRejectingId(null);
      setRejectReason("");
      refetch();
    },
    onError: (err) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Brand Verification</h1>
        <p className="text-muted-foreground">
          Review and approve brand applications.
          {pendingBrands && ` ${pendingBrands.length} pending.`}
        </p>
      </div>

      {!pendingBrands?.length && (
        <Card>
          <CardContent className="flex flex-col items-center py-12">
            <CheckCircle2 className="h-12 w-12 text-brand-green" />
            <p className="mt-4 text-lg font-medium">All caught up!</p>
            <p className="text-sm text-muted-foreground">No brands pending verification.</p>
          </CardContent>
        </Card>
      )}

      <div className="space-y-4">
        {pendingBrands?.map((brand) => (
          <Card key={brand.id}>
            <CardContent className="pt-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    <h3 className="text-lg font-semibold">{brand.companyName}</h3>
                  </div>
                  {brand.website && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Globe className="h-3 w-3" />
                      <a href={brand.website} target="_blank" rel="noopener" className="hover:underline">
                        {brand.website}
                      </a>
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Mail className="h-3 w-3" />
                    {brand.contactEmail || brand.user.email}
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar className="h-3 w-3" />
                    Applied {new Date(brand.createdAt).toLocaleDateString()}
                  </div>
                  {brand.description && (
                    <p className="text-sm text-muted-foreground mt-2">{brand.description}</p>
                  )}
                  {brand.industry && (
                    <span className="inline-block rounded-full bg-secondary px-2 py-0.5 text-xs font-medium">
                      {brand.industry}
                    </span>
                  )}
                </div>

                <div className="flex gap-2 sm:flex-col">
                  <Button
                    size="sm"
                    onClick={() => approveBrand.mutate({ brandId: brand.id })}
                    disabled={approveBrand.isPending}
                    className="gap-1"
                  >
                    {approveBrand.isPending ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <CheckCircle2 className="h-3 w-3" />
                    )}
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => setRejectingId(brand.id)}
                    className="gap-1"
                  >
                    <XCircle className="h-3 w-3" />
                    Reject
                  </Button>
                </div>
              </div>

              {/* Reject reason input */}
              {rejectingId === brand.id && (
                <div className="mt-4 flex gap-2 border-t pt-4">
                  <input
                    type="text"
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    placeholder="Reason for rejection (min. 10 chars)..."
                    className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
                  />
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() =>
                      rejectBrand.mutate({ brandId: brand.id, reason: rejectReason })
                    }
                    disabled={rejectReason.length < 10 || rejectBrand.isPending}
                  >
                    Confirm
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => { setRejectingId(null); setRejectReason(""); }}
                  >
                    Cancel
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
