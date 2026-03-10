/**
 * Test Setup — Vitest configuration and shared mocks
 *
 * Mocks external dependencies (Redis, Prisma, Resend) so unit tests
 * run fast without any infrastructure.
 *
 * Usage: import { mockDb, mockRedis, resetAllMocks } from "./__tests__/setup";
 */
import { vi, beforeEach } from "vitest";

// ==========================================
// PRISMA MOCK
// ==========================================

const createMockModel = () => ({
  findUnique: vi.fn(),
  findUniqueOrThrow: vi.fn(),
  findFirst: vi.fn(),
  findMany: vi.fn(),
  create: vi.fn(),
  createMany: vi.fn(),
  update: vi.fn(),
  updateMany: vi.fn(),
  delete: vi.fn(),
  deleteMany: vi.fn(),
  count: vi.fn().mockResolvedValue(0),
  aggregate: vi.fn().mockResolvedValue({ _sum: {}, _count: 0 }),
  groupBy: vi.fn().mockResolvedValue([]),
});

export const mockDb = {
  user: createMockModel(),
  account: createMockModel(),
  session: createMockModel(),
  streamer: createMockModel(),
  brand: createMockModel(),
  campaign: createMockModel(),
  campaignMaterial: createMockModel(),
  campaignApplication: createMockModel(),
  affiliateLink: createMockModel(),
  click: createMockModel(),
  conversion: createMockModel(),
  deposit: createMockModel(),
  payout: createMockModel(),
  notification: createMockModel(),
  $transaction: vi.fn((args: any[]) => Promise.all(args)),
  $queryRaw: vi.fn(),
};

vi.mock("@/lib/db", () => ({ db: mockDb }));

// ==========================================
// REDIS MOCK
// ==========================================

export const mockRedis = {
  get: vi.fn().mockResolvedValue(null),
  set: vi.fn().mockResolvedValue("OK"),
  setex: vi.fn().mockResolvedValue("OK"),
  del: vi.fn().mockResolvedValue(1),
  keys: vi.fn().mockResolvedValue([]),
  hget: vi.fn().mockResolvedValue(null),
  hgetall: vi.fn().mockResolvedValue({}),
  hincrby: vi.fn().mockResolvedValue(1),
  expire: vi.fn().mockResolvedValue(1),
  pexpire: vi.fn().mockResolvedValue(1),
  pipeline: vi.fn(() => ({
    zremrangebyscore: vi.fn().mockReturnThis(),
    zadd: vi.fn().mockReturnThis(),
    zcard: vi.fn().mockReturnThis(),
    pexpire: vi.fn().mockReturnThis(),
    hincrby: vi.fn().mockReturnThis(),
    expire: vi.fn().mockReturnThis(),
    exec: vi.fn().mockResolvedValue([0, 1, 1, 1]),
  })),
  zadd: vi.fn(),
  zremrangebyscore: vi.fn(),
  zcard: vi.fn().mockResolvedValue(0),
};

vi.mock("@upstash/redis", () => ({
  Redis: vi.fn(() => mockRedis),
}));

// Override the actual redis module to use our mock
vi.mock("@/lib/redis", async () => {
  const actual = await vi.importActual<typeof import("@/lib/redis")>("@/lib/redis");
  return {
    ...actual,
    redis: mockRedis,
    // Keep the actual functions but they'll use mockRedis internally
    getCounter: vi.fn().mockResolvedValue(0),
    incrementCounter: vi.fn().mockResolvedValue(1),
    acquireLock: vi.fn().mockResolvedValue(async () => {}),
  };
});

// ==========================================
// RESET HELPER
// ==========================================

export function resetAllMocks() {
  vi.clearAllMocks();

  // Reset DB mocks to defaults
  Object.values(mockDb).forEach((model) => {
    if (typeof model === "object" && model !== null) {
      Object.values(model).forEach((fn) => {
        if (typeof fn === "function" && "mockReset" in fn) {
          (fn as any).mockReset();
        }
      });
    }
  });

  // Re-set defaults
  mockDb.$transaction.mockImplementation((args: any[]) => Promise.all(args));
}

// Auto-reset before each test
beforeEach(() => {
  resetAllMocks();
});
