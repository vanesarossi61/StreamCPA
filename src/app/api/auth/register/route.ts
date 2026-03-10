/**
 * POST /api/auth/register
 * Register a new user with email/password (for brands and admins)
 */
import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { z } from "zod";

const registerSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  role: z.enum(["STREAMER", "BRAND"]),
  // Brand-specific fields
  companyName: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const data = registerSchema.parse(body);

    // Check if email already exists
    const existingUser = await db.user.findUnique({
      where: { email: data.email },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "An account with this email already exists" },
        { status: 409 },
      );
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(data.password, 12);

    // Create user + role-specific profile in a transaction
    const user = await db.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          name: data.name,
          email: data.email,
          hashedPassword,
          role: data.role,
        },
      });

      // Create role-specific profile
      if (data.role === "BRAND") {
        await tx.brand.create({
          data: {
            userId: newUser.id,
            companyName: data.companyName || data.name,
            contactName: data.name,
            contactEmail: data.email,
            status: "PENDING_VERIFICATION",
          },
        });
      } else if (data.role === "STREAMER") {
        await tx.streamer.create({
          data: {
            userId: newUser.id,
            status: "ONBOARDING",
            onboardingStep: 0,
          },
        });
      }

      return newUser;
    });

    return NextResponse.json(
      {
        message: "Account created successfully",
        userId: user.id,
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", details: error.errors },
        { status: 400 },
      );
    }

    console.error("Registration error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
