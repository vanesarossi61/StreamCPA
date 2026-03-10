/**
 * NextAuth.js — Authentication configuration
 *
 * Providers:
 *   - Twitch (primary for streamers)
 *   - Google (general)
 *   - Credentials (email + password for brands/admin)
 *
 * Strategy: JWT (stateless, edge-compatible)
 * Session: Extended with role, streamerStatus, brandStatus
 */
import NextAuth, { type NextAuthOptions, type Session, type User } from "next-auth";
import { type JWT } from "next-auth/jwt";
import TwitchProvider from "next-auth/providers/twitch";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { db } from "@/lib/db";
import { createHash } from "crypto";

// ==========================================
// HELPERS
// ==========================================

function hashPassword(password: string): string {
  return createHash("sha256").update(password).digest("hex");
}

// ==========================================
// AUTH OPTIONS
// ==========================================

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(db) as any,
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  pages: {
    signIn: "/login",
    signOut: "/login",
    error: "/login",
    newUser: "/onboarding",
  },
  providers: [
    // ---- Twitch (primary for streamers) ----
    TwitchProvider({
      clientId: process.env.TWITCH_CLIENT_ID!,
      clientSecret: process.env.TWITCH_CLIENT_SECRET!,
      authorization: {
        params: {
          scope: "openid user:read:email",
        },
      },
      profile(profile) {
        return {
          id: profile.sub,
          name: profile.preferred_username,
          email: profile.email,
          image: profile.picture,
        };
      },
    }),

    // ---- Google (general auth) ----
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
      allowDangerousEmailAccountLinking: true,
    }),

    // ---- Credentials (email + password for brands/admin) ----
    CredentialsProvider({
      name: "Email",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error("Email and password are required");
        }

        const user = await db.user.findUnique({
          where: { email: credentials.email.toLowerCase().trim() },
        });

        if (!user || !user.hashedPassword) {
          throw new Error("Invalid email or password");
        }

        const passwordMatch =
          hashPassword(credentials.password) === user.hashedPassword;

        if (!passwordMatch) {
          throw new Error("Invalid email or password");
        }

        if (!user.isActive) {
          throw new Error("Account has been suspended");
        }

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          image: user.image,
        };
      },
    }),
  ],

  callbacks: {
    // ---- Sign In: handle new Twitch users ----
    async signIn({ user, account, profile }) {
      if (account?.provider === "twitch") {
        // Check if this Twitch account already exists as a streamer
        const existingStreamer = await db.streamer.findUnique({
          where: { twitchId: account.providerAccountId },
        });

        if (!existingStreamer && user.id) {
          // New Twitch user — set role to STREAMER and create streamer profile
          await db.user.update({
            where: { id: user.id },
            data: { role: "STREAMER" },
          });

          await db.streamer.upsert({
            where: { userId: user.id },
            create: {
              userId: user.id,
              twitchId: account.providerAccountId,
              twitchUsername: (profile as any)?.preferred_username || null,
              twitchDisplayName: (profile as any)?.preferred_username || user.name,
              twitchAvatar: user.image || null,
              status: "ONBOARDING",
            },
            update: {
              twitchId: account.providerAccountId,
              twitchUsername: (profile as any)?.preferred_username || null,
              twitchDisplayName: (profile as any)?.preferred_username || user.name,
              twitchAvatar: user.image || null,
            },
          });
        }
      }
      return true;
    },

    // ---- JWT: enrich token with role + status ----
    async jwt({ token, user, trigger, session }): Promise<JWT> {
      // On sign-in, load user data
      if (user) {
        const dbUser = await db.user.findUnique({
          where: { id: user.id },
          include: {
            streamer: { select: { id: true, status: true } },
            brand: { select: { id: true, status: true } },
          },
        });

        if (dbUser) {
          token.role = dbUser.role;
          token.userId = dbUser.id;
          token.isActive = dbUser.isActive;

          if (dbUser.streamer) {
            token.streamerId = dbUser.streamer.id;
            token.streamerStatus = dbUser.streamer.status;
          }
          if (dbUser.brand) {
            token.brandId = dbUser.brand.id;
            token.brandStatus = dbUser.brand.status;
          }
        }
      }

      // On session update (e.g., after completing onboarding)
      if (trigger === "update" && session) {
        if (session.streamerStatus) token.streamerStatus = session.streamerStatus;
        if (session.brandStatus) token.brandStatus = session.brandStatus;
      }

      return token;
    },

    // ---- Session: expose custom fields to client ----
    async session({ session, token }): Promise<Session> {
      if (session.user) {
        (session.user as any).id = token.userId;
        (session.user as any).role = token.role;
        (session.user as any).isActive = token.isActive;
        (session.user as any).streamerId = token.streamerId;
        (session.user as any).streamerStatus = token.streamerStatus;
        (session.user as any).brandId = token.brandId;
        (session.user as any).brandStatus = token.brandStatus;
      }
      return session;
    },
  },

  events: {
    // Log sign-ins for security audit
    async signIn({ user, account }) {
      console.log(
        `[auth] Sign in: ${user.email} via ${account?.provider || "credentials"}`,
      );
    },
  },
};

// ==========================================
// ROUTE HANDLER
// ==========================================

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
