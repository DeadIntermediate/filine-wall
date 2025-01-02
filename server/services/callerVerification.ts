import { db } from "@db";
import { eq, and, sql } from "drizzle-orm";
import { verificationCodes, phoneNumbers } from "@db/schema";
import crypto from "crypto";

interface VerificationResult {
  success: boolean;
  message: string;
  code?: string;
  expiresAt?: Date;
}

export async function generateVerificationCode(phoneNumber: string): Promise<VerificationResult> {
  // Generate a 6-digit code
  const code = crypto.randomInt(100000, 999999).toString();
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes expiry

  // Store the verification code
  const [created] = await db
    .insert(verificationCodes)
    .values({
      phoneNumber,
      code,
      expiresAt,
      metadata: {
        attempts: 0,
        lastAttempt: null,
      },
    })
    .returning();

  return {
    success: true,
    message: "Verification code generated successfully",
    code: created.code,
    expiresAt: created.expiresAt,
  };
}

export async function verifyCode(phoneNumber: string, code: string): Promise<VerificationResult> {
  // Find the latest unused verification code for this number
  const [verificationCode] = await db
    .select()
    .from(verificationCodes)
    .where(
      and(
        eq(verificationCodes.phoneNumber, phoneNumber),
        eq(verificationCodes.code, code),
        eq(verificationCodes.used, false),
        sql`${verificationCodes.expiresAt} > NOW()`
      )
    )
    .orderBy(sql`${verificationCodes.createdAt} DESC`)
    .limit(1);

  if (!verificationCode) {
    return {
      success: false,
      message: "Invalid or expired verification code",
    };
  }

  // Mark the code as used
  await db
    .update(verificationCodes)
    .set({
      used: true,
      verifiedAt: new Date(),
    })
    .where(eq(verificationCodes.id, verificationCode.id));

  // Add the number to whitelist
  const [number] = await db
    .insert(phoneNumbers)
    .values({
      number: phoneNumber,
      type: "whitelist",
      description: "Verified caller through authentication system",
    })
    .onConflictDoUpdate({
      target: phoneNumbers.number,
      set: {
        type: "whitelist",
        description: "Verified caller through authentication system",
      },
    })
    .returning();

  return {
    success: true,
    message: "Phone number verified successfully and added to allow list",
  };
}

export async function getVerificationAttempts(phoneNumber: string): Promise<number> {
  const [result] = await db
    .select({
      count: sql<number>`count(*)`,
    })
    .from(verificationCodes)
    .where(
      and(
        eq(verificationCodes.phoneNumber, phoneNumber),
        sql`${verificationCodes.createdAt} > NOW() - INTERVAL '24 hours'`
      )
    );

  return result.count;
}
