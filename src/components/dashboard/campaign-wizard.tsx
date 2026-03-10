"use client";

import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

// ==========================================
// Types
// ==========================================

interface CampaignFormData {
  // Step 1: Basics
  name: string;
  description: string;
  shortDescription: string;
  landingUrl: string;
  imageUrl: string;
  // Step 2: CPA Config
  conversionType: string;
  payoutPerConversion: number;
  attributionWindow: number;
  // Step 3: Targeting
  categories: string[];
  countries: string[];
  minFollowers: number;
  minAvgViewers: number;
  // Step 4: Budget & Settings
  totalBudget: number;
  dailyBudget: number | null;
  approvalMode: "AUTO" | "MANUAL";
  maxStreamers: number | null;
  startDate: string;
  endDate: string;
}

interface CampaignWizardProps {
  initialData?: Partial<CampaignFormData>;
  onSubmit: (data: CampaignFormData) => Promise<void>;
  onSaveDraft?: (data: CampaignFormData) => Promise<void>;
  mode?: "create" | "edit";
  className?: string;
}

const STEPS = [
  { id: 1, title: "Basics", description: "Campaign name and landing page" },
  { id: 2, title: "CPA Config", description: "Conversion type and payout" },
  { id: 3, title: "Targeting", description: "Who can promote your campaign" },
  { id: 4, title: "Budget", description: "Budget limits and schedule" },
];

const CONVERSION_TYPES = [
  { value: "SALE", label: "Sale (CPS)" },
  { value: "LEAD", label: "Lead (CPL)" },
  { value: "INSTALL", label: "Install (CPI)" },
  { value: "SIGNUP", label: "Signup (CPA)" },
  { value: "DEPOSIT", label: "Deposit (CPA)" },
  { value: "SUBSCRIPTION", label: "Subscription (CPS)" },
];

const CATEGORIES = [
  "Gaming", "IRL", "Just Chatting", "Music", "Sports", "Creative",
  "Esports", "Education", "Science", "Technology", "Travel", "Food",
  "Fitness", "ASMR", "Crypto", "Finance", "Fashion", "Beauty",
];

const COUNTRIES = [
  { code: "US", name: "United States" }, { code: "GB", name: "United Kingdom" },
  { code: "CA", name: "Canada" }, { code: "DE", name: "Germany" },
  { code: "FR", name: "France" }, { code: "ES", name: "Spain" },
  { code: "BR", name: "Brazil" }, { code: "MX", name: "Mexico" },
  { code: "AR", name: "Argentina" }, { code: "AU", name: "Australia" },
  { code: "JP", name: "Japan" }, { code: "KR", name: "South Korea" },
];

const DEFAULT_DATA: CampaignFormData = {
  name: "",
  description: "",
  shortDescription: "",
  landingUrl: "",
  imageUrl: "",
  conversionType: "SIGNUP",
  payoutPerConversion: 5,
  attributionWindow: 30,
  categories: [],
  countries: [],
  minFollowers: 0,
  minAvgViewers: 0,
  totalBudget: 500,
  dailyBudget: null,
  approvalMode: "AUTO",
  maxStreamers: null,
  startDate: "",
  endDate: "",
};

// ==========================================
// CampaignWizard
// ==========================================

export function CampaignWizard({
  initialData,
  onSubmit,
  onSaveDraft,
  mode = "create",
  className,
}: CampaignWizardProps) {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<CampaignFormData>({ ...DEFAULT_DATA, ...initialData });
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const update = useCallback(
    <K extends keyof CampaignFormData>(key: K, value: CampaignFormData[K]) => {
      setForm((prev) => ({ ...prev, [key]: value }));
      setErrors((prev) => ({ ...prev, [key]: "" }));
    },
    []
  );

  const validateStep = (): boolean => {
    const errs: Record<string, string> = {};

    if (step === 1) {
      if (!form.name.trim()) errs.name = "Campaign name is required";
      if (form.name.length < 3) errs.name = "Name must be at least 3 characters";
      if (!form.landingUrl.trim()) errs.landingUrl = "Landing URL is required";
      try {
        new URL(form.landingUrl);
      } catch {
        if (form.landingUrl) errs.landingUrl = "Must be a valid URL";
      }
      if (!form.description.trim()) errs.description = "Description is required";
      if (form.description.length < 20) errs.description = "At least 20 characters";
    }

    if (step === 2) {
      if (form.payoutPerConversion <= 0) errs.payoutPerConversion = "Payout must be > $0";
      if (form.payoutPerConversion > 10000) errs.payoutPerConversion = "Max $10,000";
    }

    if (step === 4) {
      if (form.totalBudget < 10) errs.totalBudget = "Minimum budget is $10";
      if (form.dailyBudget && form.dailyBudget > form.totalBudget)
        errs.dailyBudget = "Daily budget cannot exceed total";
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const nextStep = () => {
    if (validateStep()) setStep((s) => Math.min(s + 1, 4));
  };

  const prevStep = () => setStep((s) => Math.max(s - 1, 1));

  const handleSubmit = async () => {
    if (!validateStep()) return;
    setSubmitting(true);
    try {
      await onSubmit(form);
    } catch (err: any) {
      setErrors({ submit: err.message || "Failed to create campaign" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveDraft = async () => {
    if (!onSaveDraft) return;
    setSubmitting(true);
    try {
      await onSaveDraft(form);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={cn("max-w-2xl mx-auto", className)}>
      {/* Step indicator */}
      <div className="flex items-center justify-between mb-8">
        {STEPS.map((s, i) => (
          <div key={s.id} className="flex items-center">
            <button
              onClick={() => s.id < step && setStep(s.id)}
              className={cn(
                "flex items-center gap-2",
                s.id < step && "cursor-pointer",
                s.id > step && "cursor-default"
              )}
            >
              <div
                className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors",
                  step === s.id
                    ? "bg-primary text-primary-foreground"
                    : s.id < step
                    ? "bg-primary/20 text-primary"
                    : "bg-muted text-muted-foreground"
                )}
              >
                {s.id < step ? (
                  <svg className="w-4 h-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                ) : (
                  s.id
                )}
              </div>
              <div className="hidden sm:block text-left">
                <p
                  className={cn(
                    "text-xs font-medium",
                    step === s.id ? "text-foreground" : "text-muted-foreground"
                  )}
                >
                  {s.title}
                </p>
              </div>
            </button>
            {i < STEPS.length - 1 && (
              <div
                className={cn(
                  "h-px flex-1 mx-3",
                  s.id < step ? "bg-primary/40" : "bg-muted"
                )}
              />
            )}
          </div>
        ))}
      </div>

      {/* Form card */}
      <Card>
        <CardHeader>
          <CardTitle>{STEPS[step - 1].title}</CardTitle>
          <CardDescription>{STEPS[step - 1].description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Step 1: Basics */}
          {step === 1 && (
            <>
              <FormField label="Campaign Name" error={errors.name}>
                <Input
                  value={form.name}
                  onChange={(e) => update("name", e.target.value)}
                  placeholder="e.g. Summer Gaming Signup Promo"
                />
              </FormField>
              <FormField label="Landing URL" error={errors.landingUrl}>
                <Input
                  value={form.landingUrl}
                  onChange={(e) => update("landingUrl", e.target.value)}
                  placeholder="https://your-product.com/signup"
                />
              </FormField>
              <FormField label="Short Description" error={errors.shortDescription}>
                <Input
                  value={form.shortDescription}
                  onChange={(e) => update("shortDescription", e.target.value)}
                  placeholder="One-liner shown in marketplace cards"
                  maxLength={200}
                />
              </FormField>
              <FormField label="Full Description" error={errors.description}>
                <textarea
                  value={form.description}
                  onChange={(e) => update("description", e.target.value)}
                  placeholder="Detailed campaign description, requirements, and any rules..."
                  rows={4}
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </FormField>
              <FormField label="Campaign Image URL (optional)">
                <Input
                  value={form.imageUrl}
                  onChange={(e) => update("imageUrl", e.target.value)}
                  placeholder="https://..."
                />
              </FormField>
            </>
          )}

          {/* Step 2: CPA Config */}
          {step === 2 && (
            <>
              <FormField label="Conversion Type">
                <Select
                  value={form.conversionType}
                  onValueChange={(v) => update("conversionType", v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CONVERSION_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
              <FormField label="Payout Per Conversion ($)" error={errors.payoutPerConversion}>
                <Input
                  type="number"
                  min={0.01}
                  max={10000}
                  step={0.01}
                  value={form.payoutPerConversion}
                  onChange={(e) => update("payoutPerConversion", parseFloat(e.target.value) || 0)}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Amount paid to streamer per approved conversion. Platform takes 20% fee on top.
                </p>
              </FormField>
              <FormField label="Attribution Window (days)">
                <Input
                  type="number"
                  min={1}
                  max={90}
                  value={form.attributionWindow}
                  onChange={(e) => update("attributionWindow", parseInt(e.target.value) || 30)}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Conversions are tracked for this many days after a click.
                </p>
              </FormField>
            </>
          )}

          {/* Step 3: Targeting */}
          {step === 3 && (
            <>
              <FormField label="Categories">
                <div className="flex flex-wrap gap-2">
                  {CATEGORIES.map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => {
                        const cats = form.categories.includes(cat)
                          ? form.categories.filter((c) => c !== cat)
                          : [...form.categories, cat];
                        update("categories", cats);
                      }}
                      className={cn(
                        "px-2.5 py-1 rounded-full text-xs font-medium border transition-colors",
                        form.categories.includes(cat)
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-muted text-muted-foreground hover:border-muted-foreground/30"
                      )}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Leave empty for all categories
                </p>
              </FormField>
              <FormField label="Countries">
                <div className="flex flex-wrap gap-2">
                  {COUNTRIES.map((c) => (
                    <button
                      key={c.code}
                      type="button"
                      onClick={() => {
                        const codes = form.countries.includes(c.code)
                          ? form.countries.filter((x) => x !== c.code)
                          : [...form.countries, c.code];
                        update("countries", codes);
                      }}
                      className={cn(
                        "px-2.5 py-1 rounded-full text-xs font-medium border transition-colors",
                        form.countries.includes(c.code)
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-muted text-muted-foreground hover:border-muted-foreground/30"
                      )}
                    >
                      {c.code} - {c.name}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Leave empty for worldwide
                </p>
              </FormField>
              <div className="grid grid-cols-2 gap-4">
                <FormField label="Min Followers">
                  <Input
                    type="number"
                    min={0}
                    value={form.minFollowers}
                    onChange={(e) => update("minFollowers", parseInt(e.target.value) || 0)}
                  />
                </FormField>
                <FormField label="Min Avg Viewers">
                  <Input
                    type="number"
                    min={0}
                    value={form.minAvgViewers}
                    onChange={(e) => update("minAvgViewers", parseInt(e.target.value) || 0)}
                  />
                </FormField>
              </div>
            </>
          )}

          {/* Step 4: Budget & Settings */}
          {step === 4 && (
            <>
              <FormField label="Total Budget ($)" error={errors.totalBudget}>
                <Input
                  type="number"
                  min={10}
                  step={1}
                  value={form.totalBudget}
                  onChange={(e) => update("totalBudget", parseFloat(e.target.value) || 0)}
                />
              </FormField>
              <FormField label="Daily Budget ($) — optional" error={errors.dailyBudget}>
                <Input
                  type="number"
                  min={1}
                  step={1}
                  value={form.dailyBudget ?? ""}
                  onChange={(e) =>
                    update("dailyBudget", e.target.value ? parseFloat(e.target.value) : null)
                  }
                  placeholder="No limit"
                />
              </FormField>
              <div className="grid grid-cols-2 gap-4">
                <FormField label="Start Date (optional)">
                  <Input
                    type="date"
                    value={form.startDate}
                    onChange={(e) => update("startDate", e.target.value)}
                  />
                </FormField>
                <FormField label="End Date (optional)">
                  <Input
                    type="date"
                    value={form.endDate}
                    onChange={(e) => update("endDate", e.target.value)}
                  />
                </FormField>
              </div>
              <FormField label="Approval Mode">
                <Select
                  value={form.approvalMode}
                  onValueChange={(v) => update("approvalMode", v as "AUTO" | "MANUAL")}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="AUTO">Auto-approve (streamers join instantly)</SelectItem>
                    <SelectItem value="MANUAL">Manual review (you approve each streamer)</SelectItem>
                  </SelectContent>
                </Select>
              </FormField>
              <FormField label="Max Streamers (optional)">
                <Input
                  type="number"
                  min={1}
                  value={form.maxStreamers ?? ""}
                  onChange={(e) =>
                    update("maxStreamers", e.target.value ? parseInt(e.target.value) : null)
                  }
                  placeholder="Unlimited"
                />
              </FormField>

              {/* Summary */}
              <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
                <h4 className="text-sm font-medium">Campaign Summary</h4>
                <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
                  <span className="text-muted-foreground">Name:</span>
                  <span className="font-medium">{form.name || "—"}</span>
                  <span className="text-muted-foreground">Type:</span>
                  <span className="font-medium">
                    {CONVERSION_TYPES.find((t) => t.value === form.conversionType)?.label}
                  </span>
                  <span className="text-muted-foreground">Payout:</span>
                  <span className="font-medium">${form.payoutPerConversion.toFixed(2)}</span>
                  <span className="text-muted-foreground">Budget:</span>
                  <span className="font-medium">${form.totalBudget.toFixed(2)}</span>
                  <span className="text-muted-foreground">Est. conversions:</span>
                  <span className="font-medium">
                    ~{Math.floor(form.totalBudget / (form.payoutPerConversion * 1.2))}
                  </span>
                </div>
              </div>
            </>
          )}

          {/* Global error */}
          {errors.submit && (
            <p className="text-sm text-red-500 bg-red-500/10 px-3 py-2 rounded-md">
              {errors.submit}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex items-center justify-between mt-6">
        <div>
          {step > 1 && (
            <Button variant="outline" onClick={prevStep}>
              Back
            </Button>
          )}
        </div>
        <div className="flex items-center gap-2">
          {onSaveDraft && (
            <Button variant="ghost" onClick={handleSaveDraft} disabled={submitting}>
              Save Draft
            </Button>
          )}
          {step < 4 ? (
            <Button onClick={nextStep}>Continue</Button>
          ) : (
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting
                ? "Creating..."
                : mode === "edit"
                ? "Update Campaign"
                : "Create Campaign"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

// ==========================================
// FormField helper
// ==========================================

function FormField({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm">{label}</Label>
      {children}
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}
