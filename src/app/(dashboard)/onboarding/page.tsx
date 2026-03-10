/**
 * Onboarding router — redirects to the correct onboarding flow based on role
 * Route: /onboarding
 */
"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";

export default function OnboardingRouter() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "loading") return;

    if (!session?.user) {
      router.push("/login");
      return;
    }

    if (session.user.onboardingComplete) {
      // Already onboarded, redirect to dashboard
      const dest = session.user.role === "BRAND" ? "/brand" : "/streamer";
      router.push(dest);
      return;
    }

    // Redirect to role-specific onboarding
    if (session.user.role === "STREAMER") {
      router.push("/onboarding/streamer");
    } else if (session.user.role === "BRAND") {
      router.push("/onboarding/brand");
    } else {
      router.push("/admin");
    }
  }, [session, status, router]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
}
