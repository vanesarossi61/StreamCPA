/**
 * Registration page — with role selector (Streamer vs Brand)
 * Route: /register
 */
"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, Tv, Building2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Role = "STREAMER" | "BRAND";

export default function RegisterPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isTwitchLoading, setIsTwitchLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selectedRole) return;
    setIsLoading(true);

    const formData = new FormData(e.currentTarget);
    const data = {
      name: formData.get("name") as string,
      email: formData.get("email") as string,
      password: formData.get("password") as string,
      role: selectedRole,
      companyName: formData.get("companyName") as string | undefined,
    };

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      const result = await res.json();

      if (!res.ok) {
        toast({
          title: "Registration failed",
          description: result.error || "Something went wrong",
          variant: "destructive",
        });
        return;
      }

      // Auto sign-in after registration
      const signInResult = await signIn("credentials", {
        email: data.email,
        password: data.password,
        redirect: false,
      });

      if (signInResult?.ok) {
        toast({ title: "Welcome to StreamCPA!", description: "Your account has been created." });
        router.push("/onboarding");
        router.refresh();
      }
    } catch {
      toast({
        title: "Error",
        description: "Something went wrong. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }

  function handleTwitchSignup() {
    setIsTwitchLoading(true);
    signIn("twitch", { callbackUrl: "/onboarding" });
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 px-4 py-8">
      <div className="w-full max-w-md space-y-6">
        {/* Logo */}
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight">
            Stream<span className="text-primary">CPA</span>
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">Create your account</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Sign up</CardTitle>
            <CardDescription>Select your account type to get started</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Role selector */}
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setSelectedRole("STREAMER")}
                className={cn(
                  "flex flex-col items-center gap-2 rounded-lg border-2 p-4 transition-all hover:border-primary/50",
                  selectedRole === "STREAMER"
                    ? "border-primary bg-primary/5"
                    : "border-border",
                )}
              >
                <Tv className={cn("h-8 w-8", selectedRole === "STREAMER" ? "text-primary" : "text-muted-foreground")} />
                <span className="text-sm font-medium">Streamer</span>
                <span className="text-xs text-muted-foreground">Promote & earn</span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedRole("BRAND")}
                className={cn(
                  "flex flex-col items-center gap-2 rounded-lg border-2 p-4 transition-all hover:border-primary/50",
                  selectedRole === "BRAND"
                    ? "border-primary bg-primary/5"
                    : "border-border",
                )}
              >
                <Building2 className={cn("h-8 w-8", selectedRole === "BRAND" ? "text-primary" : "text-muted-foreground")} />
                <span className="text-sm font-medium">Brand</span>
                <span className="text-xs text-muted-foreground">Launch campaigns</span>
              </button>
            </div>

            {/* Twitch shortcut for streamers */}
            {selectedRole === "STREAMER" && (
              <>
                <Button
                  variant="outline"
                  className="w-full gap-2 border-purple-500/30 hover:bg-purple-500/10"
                  onClick={handleTwitchSignup}
                  disabled={isTwitchLoading}
                >
                  {isTwitchLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z" />
                    </svg>
                  )}
                  Sign up with Twitch (Recommended)
                </Button>
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-card px-2 text-muted-foreground">Or use email</span>
                  </div>
                </div>
              </>
            )}

            {/* Registration form */}
            {selectedRole && (
              <form onSubmit={onSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">
                    {selectedRole === "BRAND" ? "Contact name" : "Display name"}
                  </Label>
                  <Input id="name" name="name" placeholder="John Doe" required disabled={isLoading} />
                </div>

                {selectedRole === "BRAND" && (
                  <div className="space-y-2">
                    <Label htmlFor="companyName">Company name</Label>
                    <Input
                      id="companyName"
                      name="companyName"
                      placeholder="Acme Corp"
                      required
                      disabled={isLoading}
                    />
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    placeholder="you@example.com"
                    required
                    disabled={isLoading}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    name="password"
                    type="password"
                    placeholder="Min. 8 characters"
                    minLength={8}
                    required
                    disabled={isLoading}
                  />
                </div>

                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Create account
                </Button>

                <p className="text-center text-xs text-muted-foreground">
                  By signing up, you agree to our{" "}
                  <Link href="/terms" className="underline hover:text-foreground">
                    Terms of Service
                  </Link>{" "}
                  and{" "}
                  <Link href="/privacy" className="underline hover:text-foreground">
                    Privacy Policy
                  </Link>
                </p>
              </form>
            )}
          </CardContent>
          <CardFooter className="flex justify-center">
            <p className="text-sm text-muted-foreground">
              Already have an account?{" "}
              <Link href="/login" className="font-medium text-primary hover:underline">
                Sign in
              </Link>
            </p>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
