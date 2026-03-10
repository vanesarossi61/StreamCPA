/**
 * tRPC server configuration
 * Defines base procedures, context, and middleware
 */
import { TRPCError, initTRPC } from "@trpc/server";
import superjson from "superjson";
import { type Session } from "next-auth";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { type UserRole } from "@prisma/client";

/**
 * Context — available in every tRPC procedure
 */
interface CreateContextOptions {
  session: Session | null;
}

export const createTRPCContext = async () => {
  const session = await getServerSession(authOptions);
  return {
    session,
    db,
  };
};

export type Context = Awaited<ReturnType<typeof createTRPCContext>>;

/**
 * Initialize tRPC with superjson transformer
 */
const t = initTRPC.context<Context>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError: error.cause instanceof Error ? error.cause.message : null,
      },
    };
  },
});

/**
 * Router and procedure helpers
 */
export const createTRPCRouter = t.router;
export const publicProcedure = t.procedure;

/**
 * Middleware: require authentication
 */
const enforceAuth = t.middleware(({ ctx, next }) => {
  if (!ctx.session || !ctx.session.user) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "You must be logged in to access this resource",
    });
  }
  return next({
    ctx: {
      session: { ...ctx.session, user: ctx.session.user },
    },
  });
});

/**
 * Protected procedure — requires authentication
 */
export const protectedProcedure = t.procedure.use(enforceAuth);

/**
 * Middleware: require specific role(s)
 */
const enforceRole = (...roles: UserRole[]) =>
  t.middleware(({ ctx, next }) => {
    if (!ctx.session || !ctx.session.user) {
      throw new TRPCError({ code: "UNAUTHORIZED" });
    }
    if (!roles.includes(ctx.session.user.role)) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: `Access denied. Required role: ${roles.join(" or ")}`,
      });
    }
    return next({
      ctx: {
        session: { ...ctx.session, user: ctx.session.user },
      },
    });
  });

/**
 * Role-specific procedures
 */
export const streamerProcedure = t.procedure.use(enforceAuth).use(enforceRole("STREAMER"));
export const brandProcedure = t.procedure.use(enforceAuth).use(enforceRole("BRAND"));
export const adminProcedure = t.procedure.use(enforceAuth).use(enforceRole("ADMIN"));
