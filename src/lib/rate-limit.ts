/**
 * Rate limiting middleware for API routes and tracking endpoints
 *
 * Uses the sliding window rate limiter from redis.ts.
 * Apply to /r/[slug] (click tracking) and /api/postback (conversions)
 * to prevent abuse and protect against DDoS.
 */
import { NextRequest, NextResponse } from "next/server";
import { rateLimiters } from "@/lib/redis";

// ==========================================
// TYPES
// ==========================================

interface RateLimitConfig {
  /** Rate limiter function from redis.ts */
  limiter: (identifier: string) => Promise<{ allowed: boolean; remaining: number; resetAt: number }>;
  /** How to identify the requester */
  identifierType: "ip" | "header";
  /** Header name if identifierType is "header" */
  headerName?: string;
}

// ==========================================
// RATE LIMIT CONFIGS PER ROUTE
// ==========================================

const ROUTE_CONFIGS: Record<string, RateLimitConfig> = {
  /** Click tracking: 30 clicks per IP per minute */
  "/r/": {
    limiter: rateLimiters.clickTracking,
    identifierType: "ip",
  },
  /** Postback API: 100 requests per IP per minute */
  "/api/postback": {
    limiter: rateLimiters.postback,
    identifierType: "ip",
  },
  /** Auth endpoints: 5 attempts per IP per 15 min */
  "/api/auth": {
    limiter: rateLimiters.auth,
    identifierType: "ip",
  },
};

// ==========================================
// HELPERS
// ==========================================

/**
 * Extract client IP from request headers
 * Handles Vercel, Cloudflare, and standard proxies
 */
function getClientIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    req.headers.get("cf-connecting-ip") ||
    req.ip ||
    "unknown"
  );
}

/**
 * Get identifier for rate limiting based on config
 */
function getIdentifier(req: NextRequest, config: RateLimitConfig): string {
  if (config.identifierType === "header" && config.headerName) {
    return req.headers.get(config.headerName) || getClientIp(req);
  }
  return getClientIp(req);
}

/**
 * Find matching rate limit config for a given pathname
 */
function findConfig(pathname: string): RateLimitConfig | null {
  for (const [route, config] of Object.entries(ROUTE_CONFIGS)) {
    if (pathname.startsWith(route)) {
      return config;
    }
  }
  return null;
}

// ==========================================
// MIDDLEWARE
// ==========================================

/**
 * Apply rate limiting to a request.
 * Returns null if allowed, or a 429 Response if rate limited.
 *
 * Usage in API route:
 * ```ts
 * import { applyRateLimit } from "@/lib/rate-limit";
 *
 * export async function GET(req: NextRequest) {
 *   const rateLimited = await applyRateLimit(req);
 *   if (rateLimited) return rateLimited;
 *   // ... handle request
 * }
 * ```
 */
export async function applyRateLimit(
  req: NextRequest,
): Promise<NextResponse | null> {
  const config = findConfig(req.nextUrl.pathname);
  if (!config) return null;

  const identifier = getIdentifier(req, config);

  try {
    const result = await config.limiter(identifier);

    if (!result.allowed) {
      return NextResponse.json(
        {
          error: "Too many requests",
          message: "Rate limit exceeded. Please try again later.",
          retryAfter: Math.ceil((result.resetAt - Date.now()) / 1000),
        },
        {
          status: 429,
          headers: {
            "Retry-After": String(Math.ceil((result.resetAt - Date.now()) / 1000)),
            "X-RateLimit-Limit": "see config",
            "X-RateLimit-Remaining": String(result.remaining),
            "X-RateLimit-Reset": String(result.resetAt),
          },
        },
      );
    }

    // Allowed — return null (caller proceeds normally)
    return null;
  } catch (error) {
    // If Redis is down, fail open (allow the request)
    console.error("[rate-limit] Redis error, failing open:", error);
    return null;
  }
}

/**
 * Rate limit for authenticated API routes using user ID
 *
 * Usage:
 * ```ts
 * const rateLimited = await applyUserRateLimit(session.user.id);
 * if (rateLimited) return rateLimited;
 * ```
 */
export async function applyUserRateLimit(
  userId: string,
): Promise<NextResponse | null> {
  try {
    const result = await rateLimiters.api(userId);

    if (!result.allowed) {
      return NextResponse.json(
        {
          error: "Too many requests",
          message: "API rate limit exceeded. Please slow down.",
          retryAfter: Math.ceil((result.resetAt - Date.now()) / 1000),
        },
        {
          status: 429,
          headers: {
            "Retry-After": String(Math.ceil((result.resetAt - Date.now()) / 1000)),
            "X-RateLimit-Remaining": String(result.remaining),
            "X-RateLimit-Reset": String(result.resetAt),
          },
        },
      );
    }

    return null;
  } catch (error) {
    console.error("[rate-limit] Redis error, failing open:", error);
    return null;
  }
}

/**
 * Rate limit for withdrawal requests (3 per hour)
 */
export async function applyWithdrawalRateLimit(
  userId: string,
): Promise<NextResponse | null> {
  try {
    const result = await rateLimiters.withdrawal(userId);

    if (!result.allowed) {
      return NextResponse.json(
        {
          error: "Too many withdrawal requests",
          message: "You can only request 3 withdrawals per hour. Please try again later.",
          retryAfter: Math.ceil((result.resetAt - Date.now()) / 1000),
        },
        {
          status: 429,
          headers: {
            "Retry-After": String(Math.ceil((result.resetAt - Date.now()) / 1000)),
          },
        },
      );
    }

    return null;
  } catch (error) {
    console.error("[rate-limit] Redis error, failing open:", error);
    return null;
  }
}
