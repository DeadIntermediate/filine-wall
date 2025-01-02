import { db } from "@db";
import { eq } from "drizzle-orm";
import { phoneNumbers, callLogs } from "@db/schema";
import { verifyPhoneNumber } from "./phoneVerification";

interface ScreeningResult {
  action: "blocked" | "allowed";
  reason: string;
  risk: number;
}

export async function screenCall(phoneNumber: string): Promise<ScreeningResult> {
  // Check if number is in blacklist
  const blacklisted = await db.query.phoneNumbers.findFirst({
    where: eq(phoneNumbers.number, phoneNumber),
  });

  if (blacklisted && blacklisted.type === "blacklist") {
    return {
      action: "blocked",
      reason: "Number is blacklisted",
      risk: 1
    };
  }

  // Verify number
  const verification = await verifyPhoneNumber(phoneNumber);

  if (!verification.isValid) {
    return {
      action: "blocked",
      reason: "Invalid phone number format",
      risk: 1
    };
  }

  if (verification.type === "suspicious" && verification.risk > 0.7) {
    return {
      action: "blocked",
      reason: "High risk number detected",
      risk: verification.risk
    };
  }

  return {
    action: "allowed",
    reason: "Number passed screening",
    risk: verification.risk
  };
}

export async function logCall(phoneNumber: string, result: ScreeningResult) {
  await db.insert(callLogs).values({
    phoneNumber,
    action: result.action,
    metadata: { reason: result.reason, risk: result.risk }
  });
}