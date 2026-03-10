/**
 * Environment variable validation with Zod
 * Fails fast at runtime if required vars are missing
 *
 * Usage: import { env } from "@/lib/env"
 */
import { z } from "zod";

const serverSchema = z.object({
  // Database
  DATABASE_URL: z.string().url(),
  DATABASE_URL_DIRECT: z.string().url().optional(),

  // NextAuth
  NEXTAUTH_URL: z.string().url(),
  NEXTAUTH_SECRET: z.string().min(32),

  // Twitch OAuth
  TWITCH_CLIENT_ID: z.string().min(1),
  TWITCH_CLIENT_SECRET: z.string().min(1),

  // Stripe
  STRIPE_SECRET_KEY: z.string().startsWith("sk_"),
  STRIPE_WEBHOOK_SECRET: z.string().startsWith("whsec_"),

  // Upstash Redis
  UPSTASH_REDIS_REST_URL: z.string().url(),
  UPSTASH_REDIS_REST_TOKEN: z.string().min(1),

  // Resend
  RESEND_API_KEY: z.string().startsWith("re_"),
  EMAIL_FROM: z.string().min(1).default("StreamCPA <noreply@streamcpa.com>"),

  // PayPal
  PAYPAL_CLIENT_ID: z.string().min(1).optional(),
  PAYPAL_CLIENT_SECRET: z.string().min(1).optional(),
  PAYPAL_MODE: z.enum(["sandbox", "live"]).default("sandbox"),

  // Wise
  WISE_API_KEY: z.string().min(1).optional(),
  WISE_PROFILE_ID: z.string().min(1).optional(),

  // Platform config
  PLATFORM_FEE_PERCENT: z
    .string()
    .transform((v) => parseInt(v, 10))
    .pipe(z.number().min(0).max(100))
    .default("20"),

  // Inngest (optional)
  INNGEST_EVENT_KEY: z.string().min(1).optional(),
  INNGEST_SIGNING_KEY: z.string().min(1).optional(),
});

const clientSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().startsWith("pk_").optional(),
  NEXT_PUBLIC_TRACKING_DOMAIN: z.string().url().optional(),
});

/**
 * Skip validation during build phase.
 * Next.js runs module-level code at build time for static analysis,
 * but server env vars are not available then. We validate lazily
 * so the build succeeds and validation runs at actual runtime.
 */
const isBuildPhase =
  process.env.NODE_ENV === "production" && !process.env.NEXTAUTH_SECRET;

// ---- Validate server-side env ----
const serverEnv = (): z.infer<typeof serverSchema> => {
  if (isBuildPhase) {
    // Return empty proxy during build -- values won't be used
    return new Proxy({} as z.infer<typeof serverSchema>, {
      get(_, prop) {
        return process.env[prop as string] ?? "";
      },
    });
  }

  const parsed = serverSchema.safeParse(process.env);
  if (!parsed.success) {
    console.error(
      "Invalid server environment variables:",
      parsed.error.flatten().fieldErrors
    );
    throw new Error("Invalid server environment variables");
  }
  return parsed.data;
};

// ---- Validate client-side env ----
const clientEnv = () => {
  const parsed = clientSchema.safeParse({
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY:
      process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
    NEXT_PUBLIC_TRACKING_DOMAIN: process.env.NEXT_PUBLIC_TRACKING_DOMAIN,
  });
  if (!parsed.success) {
    if (isBuildPhase) {
      return {} as z.infer<typeof clientSchema>;
    }
    console.error(
      "Invalid client environment variables:",
      parsed.error.flatten().fieldErrors
    );
    throw new Error("Invalid client environment variables");
  }
  return parsed.data;
};

/**
 * Validated environment variables.
 * Use `env.DATABASE_URL`, `env.STRIPE_SECRET_KEY`, etc.
 * Validates at runtime (skipped during build phase).
 */
export const env = {
  ...serverEnv(),
  ...clientEnv(),
};

export type ServerEnv = z.infer<typeof serverSchema>;
export type ClientEnv = z.infer<typeof clientSchema>;
