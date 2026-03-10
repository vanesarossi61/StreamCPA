/**
 * Streamer — Settings page
 * Route: /streamer/settings
 *
 * Manage payment methods (PayPal/Wise), profile info,
 * notification preferences, and Twitch sync.
 */
"use client";

import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/components/ui/use-toast";
import {
  Settings,
  CreditCard,
  User,
  RefreshCw,
  Save,
  Loader2,
  CheckCircle2,
  Tv2,
  Mail,
  Globe,
} from "lucide-react";

export default function StreamerSettingsPage() {
  const { toast } = useToast();

  const { data: profile, isLoading, refetch } = trpc.streamer.getProfile.useQuery();

  // Payment form state
  const [paypalEmail, setPaypalEmail] = useState("");
  const [wiseEmail, setWiseEmail] = useState("");
  const [preferredPayout, setPreferredPayout] = useState<"paypal" | "wise">("paypal");

  // Profile form state
  const [bio, setBio] = useState("");
  const [country, setCountry] = useState("");

  // Populate forms when data loads
  useEffect(() => {
    if (profile) {
      setPaypalEmail(profile.paypalEmail || "");
      setWiseEmail(profile.wiseEmail || "");
      setPreferredPayout(profile.preferredPayout || "paypal");
      setBio(profile.bio || "");
      setCountry(profile.country || "");
    }
  }, [profile]);

  const updatePayment = trpc.streamer.updatePaymentInfo.useMutation({
    onSuccess: () => {
      toast({ title: "Payment info updated!" });
      refetch();
    },
    onError: (err) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const updateProfile = trpc.streamer.updateProfile.useMutation({
    onSuccess: () => {
      toast({ title: "Profile updated!" });
      refetch();
    },
    onError: (err) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const syncTwitch = trpc.streamer.syncTwitch.useMutation({
    onSuccess: (data) => {
      toast({
        title: "Twitch synced!",
        description: `${data.displayName} - ${data.followers} followers`,
      });
      refetch();
    },
    onError: (err) => {
      toast({ title: "Sync failed", description: err.message, variant: "destructive" });
    },
  });

  const handleSavePayment = () => {
    updatePayment.mutate({
      paypalEmail: paypalEmail || null,
      wiseEmail: wiseEmail || null,
      preferredPayout,
    });
  };

  const handleSaveProfile = () => {
    updateProfile.mutate({
      bio: bio || undefined,
      country: country || undefined,
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
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">Manage your profile and payment preferences.</p>
      </div>

      {/* Twitch Profile Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Tv2 className="h-5 w-5" /> Twitch Profile
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16">
                <AvatarImage src={profile?.twitchAvatar || ""} />
                <AvatarFallback>
                  {profile?.twitchDisplayName?.[0] || "S"}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="text-lg font-semibold">
                  {profile?.twitchDisplayName || "Not connected"}
                </p>
                <p className="text-sm text-muted-foreground">
                  @{profile?.twitchUsername || "-"}
                </p>
                <div className="mt-1 flex items-center gap-3 text-sm">
                  <span>{profile?.twitchFollowers?.toLocaleString() || 0} followers</span>
                  <span>&middot;</span>
                  <span>{profile?.avgViewers || 0} avg viewers</span>
                  <span>&middot;</span>
                  <Badge variant="outline">Score: {profile?.streamerScore || 0}</Badge>
                </div>
              </div>
            </div>
            <Button
              variant="outline"
              onClick={() => syncTwitch.mutate()}
              disabled={syncTwitch.isLoading}
              className="gap-2"
            >
              {syncTwitch.isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              Sync Twitch
            </Button>
          </div>
          {profile?.lastSyncAt && (
            <p className="mt-3 text-xs text-muted-foreground">
              Last synced: {new Date(profile.lastSyncAt).toLocaleString()}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Payment Methods */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" /> Payment Methods
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="paypal" className="flex items-center gap-2">
                <Mail className="h-4 w-4" /> PayPal Email
              </Label>
              <Input
                id="paypal"
                type="email"
                placeholder="you@example.com"
                value={paypalEmail}
                onChange={(e) => setPaypalEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="wise" className="flex items-center gap-2">
                <Globe className="h-4 w-4" /> Wise Email
              </Label>
              <Input
                id="wise"
                type="email"
                placeholder="you@example.com"
                value={wiseEmail}
                onChange={(e) => setWiseEmail(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Preferred Payment Method</Label>
            <Select
              value={preferredPayout}
              onValueChange={(v) => setPreferredPayout(v as "paypal" | "wise")}
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="paypal">PayPal</SelectItem>
                <SelectItem value="wise">Wise</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Separator />

          <Button
            onClick={handleSavePayment}
            disabled={updatePayment.isLoading}
            className="gap-2"
          >
            {updatePayment.isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Save Payment Info
          </Button>
        </CardContent>
      </Card>

      {/* Profile Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" /> Profile
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="bio">Bio</Label>
            <Textarea
              id="bio"
              placeholder="Tell brands about yourself and your content..."
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              maxLength={500}
              rows={4}
            />
            <p className="text-xs text-muted-foreground">{bio.length}/500 characters</p>
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

          <Separator />

          <Button
            onClick={handleSaveProfile}
            disabled={updateProfile.isLoading}
            className="gap-2"
          >
            {updateProfile.isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Save Profile
          </Button>
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
              <span className="text-muted-foreground">Email</span>
              <span>{profile?.user.email}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Status</span>
              <Badge variant={profile?.status === "ACTIVE" ? "success" : "warning"}>
                {profile?.status}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Active Links</span>
              <span>{profile?._count.affiliateLinks || 0}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Approved Conversions</span>
              <span>{profile?._count.conversions || 0}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
