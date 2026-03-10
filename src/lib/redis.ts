/**
 * Upstash Redis client — rate limiting, caching, and real-time counters
 *
 * Uses @upstash/redis for serverless-compatible Redis.
 * All keys are prefixed with "scp:" to namespace StreamCPA data.
 */
import { Redis } from "@upstash/redis";

// ==========================================
// CLIENT
// ==========================================

export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

const PREFIX = "scp:";

// ==========================================
// RATE LIMITING
// ==========================================

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number; // Unix timestamp ms
}

/**
 * Sliding window rate limiter
 * @param key - Unique identifier (e.g., IP, userId)
 * @param limit - Max requests in window
 * @param windowMs - Window size in milliseconds
 */
export async function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
): Promise<RateLimitResult> {
  const redisKey = `${PREFIX}rl:${key}`;
  const now = Date.now();
  const windowStart = now - windowMs;

  // Use a pipeline for atomicity
  const pipe = redis.pipeline();
  pipe.zremrangebyscore(redisKey, 0, windowStart); // Remove expired entries
  pipe.zadd(redisKey, { score: now, member: `${now}:${Math.random()}` }); // Add current request
  pipe.zcard(redisKey); // Count requests in window
  pipe.pexpire(redisKey, windowMs); // Set TTL

  const results = await pipe.exec();
  const count = results[2] as number;

  return {
    allowed: count <= limit,
    remaining: Math.max(0, limit - count),
    resetAt: now + windowMs,
  };
}

/**
 * Pre-configured rate limiters for common use cases
 */
export const rateLimiters = {
  /** Click tracking: 30 clicks per IP per minute */
  clickTracking: (ip: string) => rateLimit(`click:${ip}`, 30, 60_000),

  /** Postback API: 100 requests per IP per minute */
  postback: (ip: string) => rateLimit(`postback:${ip}`, 100, 60_000),

  /** Auth attempts: 5 per email per 15 minutes */
  auth: (email: string) => rateLimit(`auth:${email}`, 5, 15 * 60_000),

  /** API general: 60 requests per user per minute */
  api: (userId: string) => rateLimit(`api:${userId}`, 60, 60_000),

  /** Withdrawal requests: 3 per user per hour */
  withdrawal: (userId: string) => rateLimit(`withdraw:${userId}`, 3, 60 * 60_000),
};

// ==========================================
// CACHING
// ==========================================

/**
 * Get cached value or compute and cache it
 * @param key - Cache key
 * @param ttlSeconds - Time to live in seconds
 * @param compute - Function to compute value if not cached
 */
export async function cached<T>(
  key: string,
  ttlSeconds: number,
  compute: () => Promise<T>,
): Promise<T> {
  const redisKey = `${PREFIX}cache:${key}`;

  // Try cache first
  const cached = await redis.get<T>(redisKey);
  if (cached !== null && cached !== undefined) {
    return cached;
  }

  // Compute and cache
  const value = await compute();
  await redis.setex(redisKey, ttlSeconds, JSON.stringify(value));
  return value;
}

/**
 * Invalidate a cache key
 */
export async function invalidateCache(key: string): Promise<void> {
  await redis.del(`${PREFIX}cache:${key}`);
}

/**
 * Invalidate all cache keys matching a pattern
 */
export async function invalidateCachePattern(pattern: string): Promise<void> {
  const keys = await redis.keys(`${PREFIX}cache:${pattern}`);
  if (keys.length > 0) {
    await redis.del(...keys);
  }
}

// ==========================================
// REAL-TIME COUNTERS
// ==========================================

/**
 * Increment a counter (e.g., daily clicks for a campaign)
 * Auto-expires after 48 hours
 */
export async function incrementCounter(
  namespace: string,
  id: string,
  field: string = "count",
): Promise<number> {
  const key = `${PREFIX}counter:${namespace}:${id}`;
  const pipe = redis.pipeline();
  pipe.hincrby(key, field, 1);
  pipe.expire(key, 48 * 60 * 60); // 48h TTL
  const results = await pipe.exec();
  return results[0] as number;
}

/**
 * Get counter value
 */
export async function getCounter(
  namespace: string,
  id: string,
  field: string = "count",
): Promise<number> {
  const key = `${PREFIX}counter:${namespace}:${id}`;
  const value = await redis.hget<number>(key, field);
  return value || 0;
}

/**
 * Get multiple counter fields at once
 */
export async function getCounterAll(
  namespace: string,
  id: string,
): Promise<Record<string, number>> {
  const key = `${PREFIX}counter:${namespace}:${id}`;
  const data = await redis.hgetall<Record<string, number>>(key);
  return data || {};
}

// ==========================================
// SESSION / LOCK UTILITIES
// ==========================================

/**
 * Distributed lock — prevents concurrent processing of same resource
 * @param resource - Resource identifier
 * @param ttlMs - Lock TTL in milliseconds
 * @returns unlock function, or null if lock not acquired
 */
export async function acquireLock(
  resource: string,
  ttlMs: number = 10_000,
): Promise<(() => Promise<void>) | null> {
  const key = `${PREFIX}lock:${resource}`;
  const token = `${Date.now()}:${Math.random()}`;

  const acquired = await redis.set(key, token, {
    nx: true,
    px: ttlMs,
  });

  if (!acquired) return null;

  return async () => {
    // Only release if we still own the lock
    const current = await redis.get(key);
    if (current === token) {
      await redis.del(key);
    }
  };
}

/**
 * Store a temporary value (e.g., email verification codes)
 */
export async function setTempValue(
  key: string,
  value: string,
  ttlSeconds: number,
): Promise<void> {
  await redis.setex(`${PREFIX}temp:${key}`, ttlSeconds, value);
}

/**
 * Get and delete a temporary value (one-time use)
 */
export async function getTempValue(key: string): Promise<string | null> {
  const redisKey = `${PREFIX}temp:${key}`;
  const value = await redis.get<string>(redisKey);
  if (value) {
    await redis.del(redisKey);
  }
  return value;
}
