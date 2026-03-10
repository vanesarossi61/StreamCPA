/**
 * Create Campaign — multi-step form for brands
 * Route: /brand/campaigns/new
 */
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";
import { Loader2, ArrowRight, ArrowLeft, CheckCircle2, Megaphone, DollarSign, Target, Settings } from "lucide-react";

const STEPS = [
  { id: 1, label: "Basic Info", icon: Megaphone },
  { id: 2, label: "CPA & Budget", icon: DollarSign },
  { id: 3, label: "Targeting", icon: Target },
  { id: 4, label: "Settings", icon: Settings },
];

const CONVERSION_TYPES = [
  { value: "SALE", label: "Sale", desc: "User makes a purchase" },
  { value: "LEAD", label: "Lead", desc: "User fills out a form" },
  { value: "INSTALL", label: "Install", desc: "User installs an app" },
  { value: "SIGNUP", label: "Signup", desc: "User creates an account" },
  { value: "DEPOSIT", label: "Deposit", desc: "User makes a deposit" },
  { value: "SUBSCRIPTION", label: "Subscription", desc: "User subscribes" },
];

const CATEGORIES = [
  "Gaming", "Software", "VPN", "E-commerce", "Health", "Finance",
  "Education", "Entertainment", "Mobile Apps", "Fashion", "Food", "Travel",
];

const COUNTRIES = [
  { code: "US", name: "United States" }, { code: "GB", name: "United Kingdom" },
  { code: "CA", name: "Canada" }, { code: "DE", name: "Germany" },
  { code: "FR", name: "France" }, { code: "ES", name: "Spain" },
  { code: "BR", name: "Brazil" }, { code: "MX", name: "Mexico" },
  { code: "AR", name: "Argentina" }, { code: "JP", name: "Japan" },
  { code: "KR", name: "South Korea" }, { code: "AU", name: "Australia" },
];

export default function NewCampaignPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [step, setStep] = useState(1);

  // Form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [shortDescription, setShortDescription] = useState("");
  const [landingUrl, setLandingUrl] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [conversionType, setConversionType] = useState<string>("SALE");
  const [payoutPerConversion, setPayoutPerConversion] = useState<number>(5);
  const [totalBudget, setTotalBudget] = useState<number>(500);
  const [dailyBudget, setDailyBudget] = useState<number | undefined>(undefined);
  const [categories, setCategories] = useState<string[]>([]);
  const [countries, setCountries] = useState<string[]>([]);
  const [minFollowers, setMinFollowers] = useState(0);
  const [minAvgViewers, setMinAvgViewers] = useState(0);
  const [approvalMode, setApprovalMode] = useState<"AUTO" | "MANUAL">("AUTO");
  const [maxStreamers, setMaxStreamers] = useState<number | undefined>(undefined);
  const [attributionWindow, setAttributionWindow] = useState(30);

  const createCampaign = trpc.campaign.create.useMutation({
    onSuccess: (data) => {
      toast({ title: "Campaign created!", description: "You can now activate it." });
      router.push("/brand/campaigns");
    },
    onError: (err) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  function handleSubmit() {
    createCampaign.mutate({
      name,
      description,
      shortDescription: shortDescription || undefined,
      landingUrl,
      imageUrl: imageUrl || undefined,
      conversionType: conversionType as any,
      payoutPerConversion,
      totalBudget,
      dailyBudget,
      categories,
      countries,
      minFollowers,
      minAvgViewers,
      approvalMode,
      maxStreamers,
      attributionWindow,
    });
  }

  function toggleCategory(cat: string) {
    setCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat].slice(0, 5),
    );
  }

  function toggleCountry(code: string) {
    setCountries((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code],
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 py-4">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Create Campaign</h1>
        <p className="text-muted-foreground">Set up your CPA offer in a few steps.</p>
      </div>

      {/* Progress */}
      <div className="flex items-center gap-2">
        {STEPS.map((s, i) => (
          <div key={s.id} className="flex items-center gap-2">
            <div
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-full text-xs font-medium",
                step > s.id ? "bg-brand-green text-white"
                  : step === s.id ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground",
              )}
            >
              {step > s.id ? <CheckCircle2 className="h-4 w-4" /> : s.id}
            </div>
            <span className={cn("hidden text-sm sm:inline", step >= s.id ? "text-foreground" : "text-muted-foreground")}>
              {s.label}
            </span>
            {i < STEPS.length - 1 && (
              <div className={cn("mx-1 h-px w-6", step > s.id ? "bg-brand-green" : "bg-border")} />
            )}
          </div>
        ))}
      </div>

      {/* Step 1: Basic Info */}
      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Basic Information</CardTitle>
            <CardDescription>What are you promoting?</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Campaign Name *</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. NordVPN Summer Sale" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="shortDesc">Short Description</Label>
              <Input id="shortDesc" value={shortDescription} onChange={(e) => setShortDescription(e.target.value)} placeholder="One-liner for the marketplace card" maxLength={200} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="desc">Full Description *</Label>
              <textarea id="desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Detailed description of the offer, what streamers should know..." className="flex min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="url">Landing Page URL *</Label>
              <Input id="url" type="url" value={landingUrl} onChange={(e) => setLandingUrl(e.target.value)} placeholder="https://yourproduct.com/offer" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="image">Campaign Image URL</Label>
              <Input id="image" type="url" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://..." />
            </div>
            <div className="flex justify-end">
              <Button onClick={() => setStep(2)} disabled={!name || !description || !landingUrl}>
                Next <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 2: CPA & Budget */}
      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle>CPA Model & Budget</CardTitle>
            <CardDescription>How do you pay streamers?</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label>Conversion Type *</Label>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {CONVERSION_TYPES.map((ct) => (
                  <button key={ct.value} type="button" onClick={() => setConversionType(ct.value)}
                    className={cn("rounded-lg border p-3 text-left transition-all",
                      conversionType === ct.value ? "border-primary bg-primary/5" : "hover:border-primary/50")}>
                    <p className="text-sm font-medium">{ct.label}</p>
                    <p className="text-xs text-muted-foreground">{ct.desc}</p>
                  </button>
                ))}
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="payout">Payout per Conversion (USD) *</Label>
                <Input id="payout" type="number" step="0.01" min="0.01" value={payoutPerConversion} onChange={(e) => setPayoutPerConversion(Number(e.target.value))} />
                <p className="text-xs text-muted-foreground">StreamCPA takes 20% fee. You pay ${(payoutPerConversion * 1.25).toFixed(2)} total per conversion.</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="budget">Total Budget (USD) *</Label>
                <Input id="budget" type="number" min="10" value={totalBudget} onChange={(e) => setTotalBudget(Number(e.target.value))} />
                <p className="text-xs text-muted-foreground">~{Math.floor(totalBudget / (payoutPerConversion * 1.25))} estimated conversions</p>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="dailyBudget">Daily Budget (USD, optional)</Label>
              <Input id="dailyBudget" type="number" min="1" value={dailyBudget || ""} onChange={(e) => setDailyBudget(e.target.value ? Number(e.target.value) : undefined)} placeholder="No daily limit" />
            </div>
            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(1)}><ArrowLeft className="mr-2 h-4 w-4" /> Back</Button>
              <Button onClick={() => setStep(3)}>Next <ArrowRight className="ml-2 h-4 w-4" /></Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Targeting */}
      {step === 3 && (
        <Card>
          <CardHeader>
            <CardTitle>Targeting</CardTitle>
            <CardDescription>Who should promote your offer?</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label>Categories</Label>
              <div className="flex flex-wrap gap-2">
                {CATEGORIES.map((cat) => (
                  <button key={cat} type="button" onClick={() => toggleCategory(cat)}
                    className={cn("rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                      categories.includes(cat) ? "border-primary bg-primary/10 text-primary" : "hover:border-primary/50")}>
                    {cat}
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">Leave empty for all categories</p>
            </div>
            <div className="space-y-2">
              <Label>Target Countries</Label>
              <div className="flex flex-wrap gap-2">
                {COUNTRIES.map((c) => (
                  <button key={c.code} type="button" onClick={() => toggleCountry(c.code)}
                    className={cn("rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                      countries.includes(c.code) ? "border-primary bg-primary/10 text-primary" : "hover:border-primary/50")}>
                    {c.name}
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">Leave empty for global</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="minFollowers">Min. Followers</Label>
                <Input id="minFollowers" type="number" min="0" value={minFollowers} onChange={(e) => setMinFollowers(Number(e.target.value))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="minViewers">Min. Avg Viewers</Label>
                <Input id="minViewers" type="number" min="0" value={minAvgViewers} onChange={(e) => setMinAvgViewers(Number(e.target.value))} />
              </div>
            </div>
            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(2)}><ArrowLeft className="mr-2 h-4 w-4" /> Back</Button>
              <Button onClick={() => setStep(4)}>Next <ArrowRight className="ml-2 h-4 w-4" /></Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 4: Settings & Confirm */}
      {step === 4 && (
        <Card>
          <CardHeader>
            <CardTitle>Settings & Review</CardTitle>
            <CardDescription>Final settings before creating your campaign.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label>Streamer Approval</Label>
              <div className="grid grid-cols-2 gap-3">
                <button type="button" onClick={() => setApprovalMode("AUTO")}
                  className={cn("rounded-lg border p-3 text-left", approvalMode === "AUTO" ? "border-primary bg-primary/5" : "")}>
                  <p className="text-sm font-medium">Auto-approve</p>
                  <p className="text-xs text-muted-foreground">Any qualifying streamer joins instantly</p>
                </button>
                <button type="button" onClick={() => setApprovalMode("MANUAL")}
                  className={cn("rounded-lg border p-3 text-left", approvalMode === "MANUAL" ? "border-primary bg-primary/5" : "")}>
                  <p className="text-sm font-medium">Manual review</p>
                  <p className="text-xs text-muted-foreground">You approve each streamer</p>
                </button>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="maxStreamers">Max Streamers (optional)</Label>
                <Input id="maxStreamers" type="number" min="1" value={maxStreamers || ""} onChange={(e) => setMaxStreamers(e.target.value ? Number(e.target.value) : undefined)} placeholder="Unlimited" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="attribution">Attribution Window (days)</Label>
                <Input id="attribution" type="number" min="1" max="90" value={attributionWindow} onChange={(e) => setAttributionWindow(Number(e.target.value))} />
              </div>
            </div>

            {/* Summary */}
            <div className="rounded-lg border bg-muted/50 p-4 space-y-2 text-sm">
              <h4 className="font-semibold">Campaign Summary</h4>
              <div className="grid grid-cols-2 gap-1">
                <span className="text-muted-foreground">Name:</span><span className="font-medium">{name}</span>
                <span className="text-muted-foreground">Type:</span><span>{conversionType}</span>
                <span className="text-muted-foreground">Payout:</span><span className="text-brand-green">${payoutPerConversion}</span>
                <span className="text-muted-foreground">Budget:</span><span>${totalBudget}</span>
                <span className="text-muted-foreground">Approval:</span><span>{approvalMode === "AUTO" ? "Instant" : "Manual"}</span>
              </div>
            </div>

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(3)}><ArrowLeft className="mr-2 h-4 w-4" /> Back</Button>
              <Button onClick={handleSubmit} disabled={createCampaign.isPending}>
                {createCampaign.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create Campaign
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
