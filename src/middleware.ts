/**
 * Next.js Middleware — Route protection, RBAC, CSRF, security headers
 *
 * Execution order:
 * 1. Security headers (on every response)
 * 2. Public route check (skip auth for public paths)
 * 3. Authentication check (redirect to login if no token)
 * 4. CSRF validation (on mutating requests)
 * 5. Role-based access control (STREAMER/BRAND/ADMIN routing)
 * 6. Status-based redirects (onboarding, pending verification, banned)
 */
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { applyCsrfProtection, applySecurityHeaders } from "@/lib/csrf";

// ==========================================
// Route Configuration
// ==========================================

/** Routes that don't require authentication */
const PUBLIC_ROUTES = new Set([
  "/",
  "/login",
  "/register",
  "/terms",
  "/privacy",
  "/leaderboard",
  "/marketplace",
]);

/** Path prefixes that are always public */
const PUBLIC_PREFIXES = [
  "/r/",             // tracking redirects
  "/api/postback",   // conversion postbacks from ad networks
  "/api/stripe",     // Stripe webhooks
  "/api/cron",       // cron jobs
  "/api/auth",       // NextAuth endpoints
  "/marketplace/",   // campaign detail pages
  "/_next",          // Next.js internals
  "/favicon",
  "/images",
  "/fonts",
];

/** Role -> allowed dashboard route prefixes */
const ROLE_ROUTES: Record<string, string[]> = {
  STREAMER: ["/streamer", "/onboarding", "/marketplace", "/settings"],
  BRAND: ["/brand", "/settings"],
  ADMIN: ["/admin", "/streamer", "/brand", "/settings", "/marketplace"],
};

/** Default dashboard per role */
const ROLE_DASHBOARD: Record<string, string> = {
  STREAMER: "/streamer",
  BRAND: "/brand",
  ADMIN: "/admin",
};

// ==========================================
// Helpers
// ==========================================

function isPublicRoute(pathname: string): boolean {
  if (PUBLIC_ROUTES.has(pathname)) return true;
  return PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

function isDashboardRoute(pathname: string): boolean {
  return (
    pathname.startsWith("/streamer") ||
    pathname.startsWith("/brand") ||
    pathname.startsWith("/admin") ||
    pathname.startsWith("/onboarding") ||
    pathname.startsWith("/settings")
  );
}

// ==========================================
// Middleware
// ==========================================

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // -----------------------------------------
  // 1. Public routes — allow immediately
  // -----------------------------------------
  if (isPublicRoute(pathname)) {
    const response = NextResponse.next();
    applySecurityHeaders(response);
    return response;
  }

  // -----------------------------------------
  // 2. Authentication check
  // -----------------------------------------
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  });

  if (!token) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    const response = NextResponse.redirect(loginUrl);
    applySecurityHeaders(response);
    return response;
  }

  // -----------------------------------------
  // 3. CSRF validation (mutating requests)
  // -----------------------------------------
  const csrfResult = applyCsrfProtection(request);
  if (csrfResult) {
    applySecurityHeaders(csrfResult);
    return csrfResult;
  }

  // -----------------------------------------
  // 4. Extract user info from token
  // -----------------------------------------
  const userRole = (token.role as string) || "STREAMER";
  const isBanned = token.banned === true;
  const streamerStatus = token.streamerStatus as string | undefined;
  const brandStatus = token.brandStatus as string | undefined;

  // -----------------------------------------
  // 5. Banned user check
  // -----------------------------------------
  if (isBanned && !pathname.startsWith("/api")) {
    // Banned users can only access /banned page
    if (pathname !== "/banned") {
      const response = NextResponse.redirect(new URL("/banned", request.url));
      applySecurityHeaders(response);
      return response;
    }
  }

  // -----------------------------------------
  // 6. Status-based redirects
  // -----------------------------------------

  // Streamer needs onboarding
  if (
    userRole === "STREAMER" &&
    streamerStatus === "ONBOARDING" &&
    !pathname.startsWith("/onboarding") &&
    !pathname.startsWith("/api")
  ) {
    const response = NextResponse.redirect(
      new URL("/onboarding/streamer", request.url),
    );
    applySecurityHeaders(response);
    return response;
  }

  // Brand pending verification
  if (
    userRole === "BRAND" &&
    brandStatus === "PENDING_VERIFICATION" &&
    !pathname.startsWith("/brand/pending") &&
    !pathname.startsWith("/onboarding") &&
    !pathname.startsWith("/api")
  ) {
    const response = NextResponse.redirect(
      new URL("/brand/pending", request.url),
    );
    applySecurityHeaders(response);
    return response;
  }

  // -----------------------------------------
  // 7. Role-based access control
  // -----------------------------------------
  if (isDashboardRoute(pathname)) {
    const allowedPrefixes = ROLE_ROUTES[userRole] || [];
    const hasAccess = allowedPrefixes.some((prefix) =>
      pathname.startsWith(prefix),
    );

    if (!hasAccess) {
      const redirectTo = ROLE_DASHBOARD[userRole] || "/";
      const response = NextResponse.redirect(
        new URL(redirectTo, request.url),
      );
      applySecurityHeaders(response);
      return response;
    }
  }

  // -----------------------------------------
  // 8. Redirect authenticated users away from auth pages
  // -----------------------------------------
  if (pathname === "/login" || pathname === "/register") {
    const redirectTo = ROLE_DASHBOARD[userRole] || "/";
    const response = NextResponse.redirect(
      new URL(redirectTo, request.url),
    );
    applySecurityHeaders(response);
    return response;
  }

  // -----------------------------------------
  // 9. All checks passed — proceed
  // -----------------------------------------
  const response = NextResponse.next();
  applySecurityHeaders(response);
  return response;
}

// ==========================================
// Matcher config
// ==========================================

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico
     * - Static assets (svg, png, jpg, etc.)
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff|woff2|ttf|eot)$).*)",
  ],
};
