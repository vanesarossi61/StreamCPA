/**
 * Brand onboarding — company profile + verification submission
 * Route: /onboarding/brand
 */
"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, Building2, Clock, CheckCircle2 } from "lucide-react";

const INDUSTRIES = [
  "Gaming & Esports", "Software & SaaS", "VPN & Security", "Crypto & Finance",
  "E-commerce", "Health & Supplements", "Fashion & Apparel", "Food & Beverage",
  "Education", "Entertainment", "Mobile Apps", "iGaming & Casino", "Other",
];

export default function BrandOnboarding() {
  const { data: session } = useSession();
  const router = useRouter();
  const { toast } = useToast();

  const [companyName, setCompanyName] = useState("");
  const [website, setWebsite] = useState("");
  const [industry, setIndustry] = useState("");
  const [description, setDescription] = useState("");
  const [contactName, setContactName] = useState(session?.user?.name || "");
  const [contactEmail, setContactEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);

  // Check current brand status
  const { data: brand } = trpc.brand.getProfile.useQuery(undefined, {
    enabled: !!session?.user,
    retry: false,
  });

  const updateProfile = trpc.brand.updateProfile.useMutation();
  const submitVerification = trpc.brand.submitForVerification.useMutation();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    try {
      // Update profile first
      await updateProfile.mutateAsync({
        companyName,
        website: website || undefined,
        industry: industry || undefined,
        description: description || undefined,
        contactName,
        contactEmail,
      });

      // Submit for verification
      await submitVerification.mutateAsync();

      setSubmitted(true);
      toast({
        title: "Application submitted!",
        description: "We'll review your account within 24-48 hours.",
      });
    } catch (err: any) {
      toast({
        title: "Submission failed",
        description: err.message || "Please try again",
        variant: "destructive",
      });
    }
  }

  // Already submitted or verified
  if (submitted || brand?.status === "PENDING_VERIFICATION") {
    return (
      <div className="mx-auto max-w-lg py-16">
        <Card>
          <CardContent className="flex flex-col items-center py-12 text-center">
            <Clock className="h-16 w-16 text-brand-orange" />
            <h2 className="mt-6 text-2xl font-bold">Account Under Review</h2>
            <p className="mt-2 text-muted-foreground">
              Our team is reviewing your application. You&apos;ll receive an email
              once your account is verified, typically within 24-48 hours.
            </p>
            <Button variant="outline" className="mt-6" onClick={() => router.push("/")}>
              Go to Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (brand?.status === "ACTIVE") {
    router.push("/brand");
    return null;
  }

  return (
    <div className="mx-auto max-w-2xl py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Set Up Your Brand Account</h1>
        <p className="mt-2 text-muted-foreground">
          Tell us about your company so we can verify your account.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            Company Information
          </CardTitle>
          <CardDescription>
            This information will be visible to streamers when they browse your campaigns.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="companyName">Company Name *</Label>
                <Input
                  id="companyName"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="Acme Corp"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="website">Website</Label>
                <Input
                  id="website"
                  type="url"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  placeholder="https://example.com"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="industry">Industry</Label>
              <select
                id="industry"
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="">Select industry</option>
                {INDUSTRIES.map((ind) => (
                  <option key={ind} value={ind}>{ind}</option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Company Description</Label>
              <textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What does your company do? What products/services would you promote through streamers?"
                className="flex min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                maxLength={1000}
              />
            </div>

            <div className="border-t pt-6">
              <h3 className="text-sm font-semibold mb-4">Contact Information</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="contactName">Contact Name *</Label>
                  <Input
                    id="contactName"
                    value={contactName}
                    onChange={(e) => setContactName(e.target.value)}
                    placeholder="John Doe"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contactEmail">Contact Email *</Label>
                  <Input
                    id="contactEmail"
                    type="email"
                    value={contactEmail}
                    onChange={(e) => setContactEmail(e.target.value)}
                    placeholder="john@acme.com"
                    required
                  />
                </div>
              </div>
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={updateProfile.isPending || submitVerification.isPending}
            >
              {(updateProfile.isPending || submitVerification.isPending) && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Submit for Verification
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
