import { db } from "@db";
import { eq } from "drizzle-orm";
import { phoneNumbers, callLogs } from "@db/schema";
import { verifyPhoneNumber } from "./phoneVerification";
import { predictSpam } from "./spamPrediction";

interface ScreeningResult {
  action: "blocked" | "allowed";
  reason: string;
  risk: number;
  features?: string[];
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

  // Get ML prediction
  const prediction = await predictSpam(phoneNumber);

  // High spam probability (>0.7) and good confidence (>0.5)
  if (prediction.spamProbability > 0.7 && prediction.confidence > 0.5) {
    return {
      action: "blocked",
      reason: "High spam probability detected",
      risk: prediction.spamProbability,
      features: prediction.features
    };
  }

  // Suspicious number with some evidence
  if (verification.type === "suspicious" && prediction.spamProbability > 0.4) {
    return {
      action: "blocked",
      reason: "Multiple risk factors detected",
      risk: Math.max(verification.risk, prediction.spamProbability),
      features: prediction.features
    };
  }

  return {
    action: "allowed",
    reason: "Number passed screening",
    risk: prediction.spamProbability,
    features: prediction.features
  };
}

export async function logCall(phoneNumber: string, result: ScreeningResult) {
  await db.insert(callLogs).values({
    phoneNumber,
    action: result.action,
    metadata: { 
      reason: result.reason,
      risk: result.risk,
      features: result.features
    }
  });
}