/**
 * Brand — Settings page
 * Route: /brand/settings
 *
 * Edit company profile, logo, contact info, and notification preferences.
 */
"use client";

import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import {
  Building2,
  Globe,
  Mail,
  Phone,
  Save,
  Loader2,
  ImageIcon,
  Shield,
  Settings,
} from "lucide-react";

export default function BrandSettingsPage() {
  const { toast } = useToast();
  const { data: profile, isLoading, refetch } = trpc.brand.getProfile.useQuery();

  const [companyName, setCompanyName] = useState("");
  const [website, setWebsite] = useState("");
  const [description, setDescription] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [logo, setLogo] = useState("");
  const [country, setCountry] = useState("");
  const [industry, setIndustry] = useState("");

  useEffect(() => {
    if (profile) {
      setCompanyName(profile.companyName || "");
      setWebsite(profile.website || "");
      setDescription(profile.description || "");
      setContactEmail(profile.contactEmail || "");
      setContactPhone(profile.contactPhone || "");
      setLogo(profile.logo || "");
      setCountry(profile.country || "");
      setIndustry(profile.industry || "");
    }
  }, [profile]);

  const updateProfile = trpc.brand.updateProfile.useMutation({
    onSuccess: () => {
      toast({ title: "Profile updated!" });
      refetch();
    },
    onError: (err) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const handleSave = () => {
    updateProfile.mutate({
      companyName,
      website: website || undefined,
      description: description || undefined,
      contactEmail: contactEmail || undefined,
      contactPhone: contactPhone || undefined,
      logo: logo || undefined,
      country: country || undefined,
      industry: industry || undefined,
    });
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Brand Settings</h1>
        <p className="text-muted-foreground">Manage your company profile and account settings.</p>
      </div>

      {/* Verification Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" /> Verification Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">
                {profile?.status === "ACTIVE"
                  ? "Your brand is verified and active. You can create campaigns."
                  : profile?.status === "PENDING_VERIFICATION"
                    ? "Your brand is pending verification. An admin will review your profile."
                    : `Status: ${profile?.status}`}
              </p>
            </div>
            <Badge
              variant={
                profile?.status === "ACTIVE"
                  ? "success"
                  : profile?.status === "PENDING_VERIFICATION"
                    ? "warning"
                    : "destructive"
              }
            >
              {profile?.status?.replace("_", " ")}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Company Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" /> Company Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="company-name">Company Name *</Label>
              <Input
                id="company-name"
                placeholder="Acme Corp"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="industry">Industry</Label>
              <Input
                id="industry"
                placeholder="Gaming, iGaming, E-commerce..."
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Company Description</Label>
            <Textarea
              id="description"
              placeholder="Tell streamers about your company and products..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={1000}
              rows={4}
            />
            <p className="text-xs text-muted-foreground">{description.length}/1000 characters</p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="website" className="flex items-center gap-2">
                <Globe className="h-4 w-4" /> Website
              </Label>
              <Input
                id="website"
                type="url"
                placeholder="https://example.com"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="country">Country (ISO Code)</Label>
              <Input
                id="country"
                placeholder="US"
                value={country}
                onChange={(e) => setCountry(e.target.value.toUpperCase())}
                maxLength={2}
                className="w-[100px]"
              />
            </div>
          </div>

          <Separator />

          <div className="space-y-2">
            <Label htmlFor="logo" className="flex items-center gap-2">
              <ImageIcon className="h-4 w-4" /> Logo URL
            </Label>
            <Input
              id="logo"
              type="url"
              placeholder="https://example.com/logo.png"
              value={logo}
              onChange={(e) => setLogo(e.target.value)}
            />
            {logo && (
              <div className="mt-2">
                <img
                  src={logo}
                  alt="Logo preview"
                  className="h-16 w-16 rounded-lg border object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = "none";
                  }}
                />
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Contact Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" /> Contact Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="contact-email" className="flex items-center gap-2">
                <Mail className="h-4 w-4" /> Contact Email
              </Label>
              <Input
                id="contact-email"
                type="email"
                placeholder="campaigns@company.com"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contact-phone" className="flex items-center gap-2">
                <Phone className="h-4 w-4" /> Phone
              </Label>
              <Input
                id="contact-phone"
                type="tel"
                placeholder="+1 (555) 123-4567"
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Account Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" /> Account
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Account Email</span>
              <span>{profile?.user?.email}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Active Campaigns</span>
              <span>{profile?._count?.campaigns || 0}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Escrow Balance</span>
              <span className="font-medium text-brand-green">
                {formatCurrency(profile?.escrowBalance || 0)}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={updateProfile.isLoading} className="gap-2">
          {updateProfile.isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          Save Changes
        </Button>
      </div>
    </div>
  );
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}
