/**
 * Streamer onboarding — 3-step wizard
 * Step 1: Connect Twitch & sync data
 * Step 2: Complete profile (bio, country, categories)
 * Step 3: Accept terms & activate
 */
"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import {
  Loader2,
  CheckCircle2,
  Tv,
  User,
  FileCheck,
  ArrowRight,
  ArrowLeft,
} from "lucide-react";
import { cn } from "@/lib/utils";

const STEPS = [
  { id: 1, label: "Connect Twitch", icon: Tv },
  { id: 2, label: "Your Profile", icon: User },
  { id: 3, label: "Accept Terms", icon: FileCheck },
];

const CATEGORIES = [
  "Just Chatting", "Gaming", "Music", "Art", "Sports", "Science & Technology",
  "Slots & Casino", "ASMR", "Food & Drink", "Travel & Outdoors",
  "Fitness & Health", "Education", "Software Development",
];

const COUNTRIES = [
  { code: "US", name: "United States" }, { code: "GB", name: "United Kingdom" },
  { code: "CA", name: "Canada" }, { code: "DE", name: "Germany" },
  { code: "FR", name: "France" }, { code: "ES", name: "Spain" },
  { code: "BR", name: "Brazil" }, { code: "MX", name: "Mexico" },
  { code: "AR", name: "Argentina" }, { code: "CL", name: "Chile" },
  { code: "CO", name: "Colombia" }, { code: "JP", name: "Japan" },
  { code: "KR", name: "South Korea" }, { code: "AU", name: "Australia" },
  { code: "IT", name: "Italy" }, { code: "PT", name: "Portugal" },
  { code: "NL", name: "Netherlands" }, { code: "SE", name: "Sweden" },
  { code: "PL", name: "Poland" }, { code: "RU", name: "Russia" },
];

export default function StreamerOnboarding() {
  const { data: session, update: updateSession } = useSession();
  const router = useRouter();
  const { toast } = useToast();

  const [currentStep, setCurrentStep] = useState(1);
  const [twitchData, setTwitchData] = useState<any>(null);
  const [bio, setBio] = useState("");
  const [country, setCountry] = useState("");
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);

  // Fetch current onboarding status
  const { data: onboarding } = trpc.streamer.getOnboardingStatus.useQuery(undefined, {
    enabled: !!session?.user,
  });

  // Mutations
  const syncTwitch = trpc.streamer.syncTwitch.useMutation({
    onSuccess: (data) => {
      setTwitchData(data);
      toast({ title: "Twitch connected!", description: `Welcome, ${data.displayName}!` });
    },
    onError: (err) => {
      toast({ title: "Sync failed", description: err.message, variant: "destructive" });
    },
  });

  const updateProfile = trpc.streamer.updateProfile.useMutation({
    onSuccess: () => {
      toast({ title: "Profile updated!" });
      setCurrentStep(3);
    },
    onError: (err) => {
      toast({ title: "Update failed", description: err.message, variant: "destructive" });
    },
  });

  const acceptTerms = trpc.streamer.acceptTerms.useMutation({
    onSuccess: async () => {
      toast({ title: "Welcome to StreamCPA!", description: "Your account is now active." });
      await updateSession({ onboardingComplete: true });
      router.push("/streamer");
      router.refresh();
    },
    onError: (err) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  // Resume from last step
  useEffect(() => {
    if (onboarding) {
      if (onboarding.twitchId && onboarding.onboardingStep >= 1) {
        setTwitchData({
          username: onboarding.twitchUsername,
          avatar: onboarding.twitchAvatar,
          followers: onboarding.twitchFollowers,
          avgViewers: onboarding.avgViewers,
        });
        if (onboarding.onboardingStep >= 2) {
          setBio(onboarding.bio || "");
          setCountry(onboarding.country || "");
          setSelectedCategories(onboarding.categories || []);
        }
        setCurrentStep(Math.min(onboarding.onboardingStep + 1, 3));
      }
    }
  }, [onboarding]);

  function toggleCategory(cat: string) {
    setSelectedCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat].slice(0, 5),
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8 py-8">
      {/* Progress bar */}
      <div className="space-y-4">
        <h1 className="text-3xl font-bold tracking-tight">Set up your account</h1>
        <div className="flex items-center gap-2">
          {STEPS.map((step, i) => (
            <div key={step.id} className="flex items-center gap-2">
              <div
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full text-xs font-medium",
                  currentStep > step.id
                    ? "bg-brand-green text-white"
                    : currentStep === step.id
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground",
                )}
              >
                {currentStep > step.id ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : (
                  step.id
                )}
              </div>
              <span
                className={cn(
                  "text-sm",
                  currentStep >= step.id ? "text-foreground" : "text-muted-foreground",
                )}
              >
                {step.label}
              </span>
              {i < STEPS.length - 1 && (
                <div className={cn(
                  "mx-2 h-px w-8",
                  currentStep > step.id ? "bg-brand-green" : "bg-border",
                )} />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Step 1: Connect Twitch */}
      {currentStep === 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Tv className="h-5 w-5 text-primary" />
              Connect Your Twitch Account
            </CardTitle>
            <CardDescription>
              We&apos;ll pull your channel data to match you with the best campaigns.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {twitchData ? (
              <div className="flex items-center gap-4 rounded-lg border bg-muted/50 p-4">
                {twitchData.avatar && (
                  <img src={twitchData.avatar} alt="" className="h-16 w-16 rounded-full" />
                )}
                <div>
                  <p className="font-semibold">{twitchData.displayName || twitchData.username}</p>
                  <p className="text-sm text-muted-foreground">
                    {(twitchData.followers || 0).toLocaleString()} followers
                    {twitchData.avgViewers > 0 && ` · ${twitchData.avgViewers} avg viewers`}
                  </p>
                  {twitchData.score !== undefined && (
                    <p className="mt-1 text-xs text-brand-green">
                      Streamer Score: {twitchData.score}/200
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-center py-6">
                <p className="text-sm text-muted-foreground mb-4">
                  Click below to sync your Twitch channel data
                </p>
              </div>
            )}

            <div className="flex gap-3">
              {!twitchData && (
                <Button
                  onClick={() => syncTwitch.mutate()}
                  disabled={syncTwitch.isPending}
                  className="flex-1"
                >
                  {syncTwitch.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Sync Twitch Data
                </Button>
              )}
              {twitchData && (
                <Button onClick={() => setCurrentStep(2)} className="flex-1">
                  Continue
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Profile */}
      {currentStep === 2 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5 text-primary" />
              Complete Your Profile
            </CardTitle>
            <CardDescription>
              Help brands understand who you are and what content you create.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="bio">Bio</Label>
              <textarea
                id="bio"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Tell brands about your stream, your audience, and what makes you unique..."
                className="flex min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                maxLength={500}
              />
              <p className="text-xs text-muted-foreground">{bio.length}/500</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="country">Country</Label>
              <select
                id="country"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="">Select your country</option>
                {COUNTRIES.map((c) => (
                  <option key={c.code} value={c.code}>{c.name}</option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label>Content Categories (up to 5)</Label>
              <div className="flex flex-wrap gap-2">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => toggleCategory(cat)}
                    className={cn(
                      "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                      selectedCategories.includes(cat)
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border hover:border-primary/50",
                    )}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setCurrentStep(1)}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
              <Button
                onClick={() =>
                  updateProfile.mutate({
                    bio: bio || undefined,
                    country: country || undefined,
                    categories: selectedCategories,
                  })
                }
                disabled={updateProfile.isPending}
                className="flex-1"
              >
                {updateProfile.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Continue
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Terms */}
      {currentStep === 3 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileCheck className="h-5 w-5 text-primary" />
              Accept Terms of Service
            </CardTitle>
            <CardDescription>
              Review and accept to activate your account.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="max-h-64 overflow-y-auto rounded-lg border bg-muted/30 p-4 text-sm">
              <h4 className="font-semibold mb-2">StreamCPA Terms of Service — Streamer Agreement</h4>
              <p className="mb-2">By using StreamCPA as a streamer/publisher, you agree to:</p>
              <ol className="list-decimal list-inside space-y-2 text-muted-foreground">
                <li>Only promote campaigns to genuine audiences through legitimate streaming activity.</li>
                <li>Not engage in click fraud, bot traffic, self-referrals, or any form of conversion manipulation.</li>
                <li>Disclose affiliate relationships to your audience as required by FTC guidelines.</li>
                <li>Accept that StreamCPA takes a 20% platform fee from each validated conversion.</li>
                <li>Accept a minimum payout threshold of $10 USD.</li>
                <li>Provide accurate payment information for receiving payouts.</li>
                <li>Accept that conversions are subject to a validation period and may be reversed if found fraudulent.</li>
                <li>Not share affiliate links in spam channels, bots, or non-streaming contexts without campaign approval.</li>
                <li>Accept that StreamCPA may suspend or terminate accounts that violate these terms.</li>
              </ol>
              <p className="mt-4 text-xs">
                Full terms available at streamcpa.io/terms. Last updated: March 2026.
              </p>
            </div>

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setCurrentStep(2)}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
              <Button
                onClick={() => acceptTerms.mutate()}
                disabled={acceptTerms.isPending}
                className="flex-1"
              >
                {acceptTerms.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                I Accept — Activate My Account
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
