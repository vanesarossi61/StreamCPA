/**
 * CSRF Protection for StreamCPA
 *
 * Implements double-submit cookie pattern:
 * 1. Server sets a random CSRF token in a cookie (httpOnly: false so JS can read)
 * 2. Client sends the token back in X-CSRF-Token header on every mutation
 * 3. Server verifies cookie value === header value
 *
 * This works because:
 * - An attacker can't read another domain's cookies (same-origin policy)
 * - An attacker can't set custom headers on cross-origin requests
 *
 * tRPC mutations go through POST, so we validate on all POST/PUT/PATCH/DELETE.
 * GET/HEAD/OPTIONS are exempt (safe methods).
 */
import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";

// ==========================================
// Config
// ==========================================

const CSRF_COOKIE_NAME = "__Host-csrf" as const;
const CSRF_HEADER_NAME = "x-csrf-token" as const;
const CSRF_TOKEN_LENGTH = 32; // 256-bit token
const CSRF_COOKIE_MAX_AGE = 60 * 60 * 24; // 24 hours

/** Routes exempt from CSRF validation */
const CSRF_EXEMPT_PATHS = [
  "/api/auth",       // NextAuth handles its own CSRF
  "/api/postback",   // External postback from ad networks (uses API key auth)
  "/api/stripe",     // Stripe webhooks (uses signature verification)
  "/api/cron",       // Cron jobs (uses bearer token)
];

/** Safe HTTP methods that don't need CSRF protection */
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

// ==========================================
// Token generation
// ==========================================

/**
 * Generate a cryptographically random CSRF token
 */
export function generateCsrfToken(): string {
  return randomBytes(CSRF_TOKEN_LENGTH).toString("hex");
}

// ==========================================
// Middleware helpers
// ==========================================

/**
 * Check if a request path is exempt from CSRF validation
 */
function isExempt(pathname: string): boolean {
  return CSRF_EXEMPT_PATHS.some((path) => pathname.startsWith(path));
}

/**
 * Validate CSRF token: compare cookie value with header value.
 * Uses timing-safe comparison to prevent timing attacks.
 */
function validateCsrfToken(cookieValue: string, headerValue: string): boolean {
  if (!cookieValue || !headerValue) return false;
  if (cookieValue.length !== headerValue.length) return false;

  // Timing-safe comparison
  const a = Buffer.from(cookieValue);
  const b = Buffer.from(headerValue);

  if (a.length !== b.length) return false;

  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a[i]! ^ b[i]!;
  }
  return mismatch === 0;
}

// ==========================================
// CSRF Middleware
// ==========================================

/**
 * Apply CSRF protection to a request.
 *
 * Returns:
 * - null if the request is valid (proceed)
 * - NextResponse with 403 if CSRF validation fails
 * - NextResponse with Set-Cookie if a new token needs to be issued
 *
 * Usage in middleware.ts:
 * ```ts
 * const csrfResult = applyCsrfProtection(request);
 * if (csrfResult) return csrfResult;
 * ```
 */
export function applyCsrfProtection(
  request: NextRequest,
): NextResponse | null {
  const { pathname } = request.nextUrl;
  const method = request.method;

  // Skip CSRF for exempt paths
  if (isExempt(pathname)) return null;

  // Skip CSRF for safe methods, but ensure cookie is set
  if (SAFE_METHODS.has(method)) {
    const existingToken = request.cookies.get(CSRF_COOKIE_NAME)?.value;
    if (!existingToken) {
      // Issue a new CSRF cookie on the response
      const response = NextResponse.next();
      const token = generateCsrfToken();
      response.cookies.set(CSRF_COOKIE_NAME, token, {
        httpOnly: false,  // JS must be able to read it
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        path: "/",
        maxAge: CSRF_COOKIE_MAX_AGE,
      });
      return response;
    }
    return null;
  }

  // Mutating method — validate CSRF token
  const cookieToken = request.cookies.get(CSRF_COOKIE_NAME)?.value;
  const headerToken = request.headers.get(CSRF_HEADER_NAME);

  if (!cookieToken || !headerToken) {
    return NextResponse.json(
      {
        error: "CSRF validation failed",
        message: "Missing CSRF token. Refresh the page and try again.",
      },
      { status: 403 },
    );
  }

  if (!validateCsrfToken(cookieToken, headerToken)) {
    return NextResponse.json(
      {
        error: "CSRF validation failed",
        message: "Invalid CSRF token. Refresh the page and try again.",
      },
      { status: 403 },
    );
  }

  // Token is valid — rotate on every successful mutation for extra safety
  const response = NextResponse.next();
  const newToken = generateCsrfToken();
  response.cookies.set(CSRF_COOKIE_NAME, newToken, {
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: CSRF_COOKIE_MAX_AGE,
  });

  return response;
}

// ==========================================
// Client-side helper (for tRPC / fetch calls)
// ==========================================

/**
 * Read the CSRF token from the cookie (client-side).
 * Use this in your tRPC httpBatchLink headers or fetch calls.
 *
 * ```ts
 * // In trpc.ts client setup:
 * headers() {
 *   return {
 *     "x-csrf-token": getCsrfToken() ?? "",
 *   };
 * }
 * ```
 */
export function getCsrfToken(): string | null {
  if (typeof document === "undefined") return null;

  const match = document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${CSRF_COOKIE_NAME}=`));

  return match ? match.split("=")[1] ?? null : null;
}

// ==========================================
// Security headers helper
// ==========================================

/**
 * Apply security headers to a response.
 * Call this in middleware to set headers on every response.
 */
export function applySecurityHeaders(response: NextResponse): NextResponse {
  // Prevent clickjacking
  response.headers.set("X-Frame-Options", "DENY");

  // Prevent MIME type sniffing
  response.headers.set("X-Content-Type-Options", "nosniff");

  // Enable XSS filter (legacy browsers)
  response.headers.set("X-XSS-Protection", "1; mode=block");

  // Referrer policy — don't leak full URL to third parties
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");

  // Permissions policy — disable unnecessary browser features
  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  );

  // Strict Transport Security (only in production)
  if (process.env.NODE_ENV === "production") {
    response.headers.set(
      "Strict-Transport-Security",
      "max-age=63072000; includeSubDomains; preload",
    );
  }

  return response;
}
