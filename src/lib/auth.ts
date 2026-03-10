/**
 * NextAuth.js configuration
 * Supports: Twitch OAuth + Email/Password credentials
 */
import { PrismaAdapter } from "@auth/prisma-adapter";
import { type NextAuthOptions, type DefaultSession } from "next-auth";
import { type Adapter } from "next-auth/adapters";
import CredentialsProvider from "next-auth/providers/credentials";
import TwitchProvider from "next-auth/providers/twitch";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { type UserRole } from "@prisma/client";

/**
 * Extend NextAuth types to include role and custom fields
 */
declare module "next-auth" {
  interface Session extends DefaultSession {
    user: {
      id: string;
      role: UserRole;
      onboardingComplete: boolean;
    } & DefaultSession["user"];
  }

  interface User {
    role: UserRole;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: UserRole;
    onboardingComplete: boolean;
  }
}

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(db) as Adapter,
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  pages: {
    signIn: "/login",
    newUser: "/onboarding",
    error: "/login",
  },
  providers: [
    /**
     * Twitch OAuth — for streamer registration
     * Scopes: user:read:email for email, channel:read:subscriptions for audience data
     */
    TwitchProvider({
      clientId: process.env.TWITCH_CLIENT_ID!,
      clientSecret: process.env.TWITCH_CLIENT_SECRET!,
      authorization: {
        params: {
          scope: "user:read:email openid",
        },
      },
    }),

    /**
     * Email/Password — for brand registration and admin login
     */
    CredentialsProvider({
      id: "credentials",
      name: "Email & Password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error("Email and password are required");
        }

        const user = await db.user.findUnique({
          where: { email: credentials.email },
        });

        if (!user || !user.hashedPassword) {
          throw new Error("Invalid email or password");
        }

        const isValid = await bcrypt.compare(credentials.password, user.hashedPassword);

        if (!isValid) {
          throw new Error("Invalid email or password");
        }

        if (!user.isActive) {
          throw new Error("Account is disabled. Contact support.");
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
          role: user.role,
        };
      },
    }),
  ],

  callbacks: {
    /**
     * JWT callback — add user role and onboarding status to token
     */
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
      }

      // Check onboarding status
      if (token.id) {
        const dbUser = await db.user.findUnique({
          where: { id: token.id },
          include: { streamer: true, brand: true },
        });

        if (dbUser) {
          token.role = dbUser.role;

          if (dbUser.role === "STREAMER") {
            token.onboardingComplete =
              dbUser.streamer?.status === "ACTIVE";
          } else if (dbUser.role === "BRAND") {
            token.onboardingComplete =
              dbUser.brand?.status === "ACTIVE";
          } else {
            token.onboardingComplete = true; // Admin
          }
        }
      }

      // Handle session updates (e.g., after onboarding)
      if (trigger === "update" && session) {
        token.onboardingComplete = session.onboardingComplete ?? token.onboardingComplete;
      }

      return token;
    },

    /**
     * Session callback — expose role and onboarding to client
     */
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id;
        session.user.role = token.role;
        session.user.onboardingComplete = token.onboardingComplete;
      }
      return session;
    },

    /**
     * Sign in callback — handle Twitch OAuth linking
     */
    async signIn({ user, account, profile }) {
      // If signing in with Twitch, set role to STREAMER and create streamer profile
      if (account?.provider === "twitch" && user.id) {
        const existingUser = await db.user.findUnique({
          where: { id: user.id },
          include: { streamer: true },
        });

        if (existingUser && !existingUser.streamer) {
          await db.user.update({
            where: { id: user.id },
            data: { role: "STREAMER" },
          });

          // Create streamer profile with Twitch data
          const twitchProfile = profile as any;
          await db.streamer.create({
            data: {
              userId: user.id,
              twitchId: twitchProfile?.sub || account?.providerAccountId,
              twitchUsername: twitchProfile?.preferred_username || user.name,
              twitchDisplayName: twitchProfile?.preferred_username || user.name,
              twitchAvatar: user.image,
              status: "ONBOARDING",
              onboardingStep: 1,
            },
          });
        }
      }

      return true;
    },
  },
};

/**
 * Helper to get the current session server-side
 */
export { getServerSession } from "next-auth";
