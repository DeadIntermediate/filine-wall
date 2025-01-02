import { db } from "@db";
import { eq } from "drizzle-orm";
import { phoneNumbers, callLogs } from "@db/schema";
import { verifyPhoneNumber } from "./phoneVerification";
import { predictSpam } from "./spamPrediction";
import { dncRegistry } from "./dncRegistry";
import { generateVerificationCode } from "./callerVerification";

interface ScreeningResult {
  action: "blocked" | "allowed";
  reason: string;
  risk: number;
  features?: string[];
  dncStatus?: {
    isRegistered: boolean;
    registrationDate?: Date;
  };
  prediction?: {
    spamProbability: number;
    confidence: number;
    factors: string[];
  };
  verification?: {
    code?: string;
    expiresAt?: Date;
    message?: string;
  };
}

export async function screenCall(phoneNumber: string): Promise<ScreeningResult> {
  // Check if number is whitelisted
  const whitelisted = await db.query.phoneNumbers.findFirst({
    where: eq(phoneNumbers.number, phoneNumber),
  });

  if (whitelisted && whitelisted.type === "whitelist") {
    return {
      action: "allowed",
      reason: "Number is whitelisted",
      risk: 0
    };
  }

  // Check if number is blacklisted
  if (whitelisted && whitelisted.type === "blacklist") {
    const verificationResult = await generateVerificationCode(phoneNumber);
    return {
      action: "blocked",
      reason: "Number is blacklisted",
      risk: 1,
      verification: {
        code: verificationResult.code,
        expiresAt: verificationResult.expiresAt,
        message: "If you are a legitimate caller, please verify your identity"
      }
    };
  }

  // Check DNC registry
  try {
    const dncCheck = await dncRegistry.checkNumber(phoneNumber);
    if (dncCheck.isRegistered) {
      const verificationResult = await generateVerificationCode(phoneNumber);
      return {
        action: "blocked",
        reason: "Number is registered in Do Not Call registry",
        risk: 1,
        dncStatus: {
          isRegistered: true,
          registrationDate: dncCheck.registrationDate
        },
        verification: {
          code: verificationResult.code,
          expiresAt: verificationResult.expiresAt,
          message: "If you are a legitimate caller, please verify your identity"
        }
      };
    }
  } catch (error) {
    console.error("DNC check failed:", error);
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

  // Get ML prediction with confidence score
  const prediction = await predictSpam(phoneNumber);

  // High spam probability (>0.7) and good confidence (>0.5)
  if (prediction.spamProbability > 0.7 && prediction.confidence > 0.5) {
    const verificationResult = await generateVerificationCode(phoneNumber);
    return {
      action: "blocked",
      reason: "High spam probability detected",
      risk: prediction.spamProbability,
      features: prediction.features,
      prediction: {
        spamProbability: prediction.spamProbability,
        confidence: prediction.confidence,
        factors: prediction.features
      },
      verification: {
        code: verificationResult.code,
        expiresAt: verificationResult.expiresAt,
        message: "If you are a legitimate caller, please verify your identity"
      }
    };
  }

  // Suspicious number with some evidence
  if (verification.type === "suspicious" && prediction.spamProbability > 0.4) {
    const verificationResult = await generateVerificationCode(phoneNumber);
    return {
      action: "blocked",
      reason: "Multiple risk factors detected",
      risk: Math.max(verification.risk, prediction.spamProbability),
      features: prediction.features,
      prediction: {
        spamProbability: prediction.spamProbability,
        confidence: prediction.confidence,
        factors: prediction.features
      },
      verification: {
        code: verificationResult.code,
        expiresAt: verificationResult.expiresAt,
        message: "If you are a legitimate caller, please verify your identity"
      }
    };
  }

  return {
    action: "allowed",
    reason: "Number passed screening",
    risk: prediction.spamProbability,
    features: prediction.features,
    prediction: {
      spamProbability: prediction.spamProbability,
      confidence: prediction.confidence,
      factors: prediction.features
    }
  };
}

export async function logCall(phoneNumber: string, result: ScreeningResult) {
  await db.insert(callLogs).values({
    phoneNumber,
    action: result.action,
    metadata: {
      reason: result.reason,
      risk: result.risk,
      features: result.features,
      dncStatus: result.dncStatus,
      prediction: result.prediction,
      verification: result.verification ? {
        provided: true,
        expiresAt: result.verification.expiresAt
      } : undefined
    }
  });
}