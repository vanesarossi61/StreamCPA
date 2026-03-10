/**
 * Rate Limiting — Unit Tests
 *
 * Tests the rate limiting middleware with mocked Redis.
 * Covers all pre-configured limiters and edge cases.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import "./setup";
import { mockRedis } from "./setup";

import { rateLimit, rateLimiters } from "@/lib/redis";

describe("rateLimit", () => {
  beforeEach(() => {
    // Reset pipeline mock with controllable exec results
    mockRedis.pipeline.mockReturnValue({
      zremrangebyscore: vi.fn().mockReturnThis(),
      zadd: vi.fn().mockReturnThis(),
      zcard: vi.fn().mockReturnThis(),
      pexpire: vi.fn().mockReturnThis(),
      exec: vi.fn().mockResolvedValue([0, 1, 1, 1]), // default: count=1 (allowed)
    });
  });

  it("should allow requests within the limit", async () => {
    const result = await rateLimit("test:user1", 10, 60_000);

    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(9); // 10 - 1
    expect(result.resetAt).toBeGreaterThan(Date.now());
  });

  it("should block requests exceeding the limit", async () => {
    // Simulate 11 requests in window (count = 11, limit = 10)
    mockRedis.pipeline.mockReturnValue({
      zremrangebyscore: vi.fn().mockReturnThis(),
      zadd: vi.fn().mockReturnThis(),
      zcard: vi.fn().mockReturnThis(),
      pexpire: vi.fn().mockReturnThis(),
      exec: vi.fn().mockResolvedValue([0, 1, 11, 1]),
    });

    const result = await rateLimit("test:user1", 10, 60_000);

    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it("should return 0 remaining when at exact limit", async () => {
    mockRedis.pipeline.mockReturnValue({
      zremrangebyscore: vi.fn().mockReturnThis(),
      zadd: vi.fn().mockReturnThis(),
      zcard: vi.fn().mockReturnThis(),
      pexpire: vi.fn().mockReturnThis(),
      exec: vi.fn().mockResolvedValue([0, 1, 10, 1]),
    });

    const result = await rateLimit("test:user1", 10, 60_000);

    expect(result.allowed).toBe(true); // 10 <= 10
    expect(result.remaining).toBe(0);
  });

  it("should include correct resetAt timestamp", async () => {
    const windowMs = 60_000;
    const before = Date.now();

    const result = await rateLimit("test:user1", 10, windowMs);

    const after = Date.now();
    expect(result.resetAt).toBeGreaterThanOrEqual(before + windowMs);
    expect(result.resetAt).toBeLessThanOrEqual(after + windowMs);
  });
});

describe("rateLimiters", () => {
  beforeEach(() => {
    mockRedis.pipeline.mockReturnValue({
      zremrangebyscore: vi.fn().mockReturnThis(),
      zadd: vi.fn().mockReturnThis(),
      zcard: vi.fn().mockReturnThis(),
      pexpire: vi.fn().mockReturnThis(),
      exec: vi.fn().mockResolvedValue([0, 1, 1, 1]),
    });
  });

  it("clickTracking: should allow 30 clicks per IP per minute", async () => {
    const result = await rateLimiters.clickTracking("192.168.1.1");

    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(29);
  });

  it("postback: should allow 100 requests per IP per minute", async () => {
    const result = await rateLimiters.postback("192.168.1.1");

    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(99);
  });

  it("auth: should allow 5 attempts per email per 15 min", async () => {
    const result = await rateLimiters.auth("user@example.com");

    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(4);
  });

  it("api: should allow 60 requests per user per minute", async () => {
    const result = await rateLimiters.api("user_123");

    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(59);
  });

  it("withdrawal: should allow 3 requests per user per hour", async () => {
    const result = await rateLimiters.withdrawal("user_123");

    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(2);
  });

  it("clickTracking: should block after 30 clicks", async () => {
    mockRedis.pipeline.mockReturnValue({
      zremrangebyscore: vi.fn().mockReturnThis(),
      zadd: vi.fn().mockReturnThis(),
      zcard: vi.fn().mockReturnThis(),
      pexpire: vi.fn().mockReturnThis(),
      exec: vi.fn().mockResolvedValue([0, 1, 31, 1]),
    });

    const result = await rateLimiters.clickTracking("192.168.1.1");

    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it("auth: should block after 5 attempts", async () => {
    mockRedis.pipeline.mockReturnValue({
      zremrangebyscore: vi.fn().mockReturnThis(),
      zadd: vi.fn().mockReturnThis(),
      zcard: vi.fn().mockReturnThis(),
      pexpire: vi.fn().mockReturnThis(),
      exec: vi.fn().mockResolvedValue([0, 1, 6, 1]),
    });

    const result = await rateLimiters.auth("user@example.com");

    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });
});
