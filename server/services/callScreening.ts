import { db } from "@db";
import { eq } from "drizzle-orm";
import { phoneNumbers, callLogs } from "@db/schema";
import { verifyPhoneNumber } from "./phoneVerification";
import { predictSpam } from "./spamPrediction";
import { dncRegistry } from "./dncRegistry";
import { generateVerificationCode } from "./callerVerification";
import { analyzeVoiceStream } from "./voiceAnalysis";

interface ScreeningResult {
  action: "blocked" | "allowed" | "challenge";
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
  voiceAnalysis?: {
    isRobot: boolean;
    confidence: number;
    features: string[];
  };
  verification?: {
    code?: string;
    expiresAt?: Date;
    message?: string;
  };
}

export async function screenCall(
  phoneNumber: string,
  audioData?: number[],
  sampleRate?: number
): Promise<ScreeningResult> {
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

  // Analyze voice patterns if audio data is provided
  let voiceAnalysis;
  if (audioData && sampleRate) {
    voiceAnalysis = await analyzeVoiceStream(audioData, sampleRate);
    if (voiceAnalysis.isRobot && voiceAnalysis.confidence > 0.7) {
      const verificationResult = await generateVerificationCode(phoneNumber);
      return {
        action: "blocked",
        reason: "Robocall detected",
        risk: 0.9,
        voiceAnalysis,
        verification: {
          code: verificationResult.code,
          expiresAt: verificationResult.expiresAt,
          message: "If this is a legitimate call, please verify your identity"
        }
      };
    }
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
      voiceAnalysis,
      verification: {
        code: verificationResult.code,
        expiresAt: verificationResult.expiresAt,
        message: "If you are a legitimate caller, please verify your identity"
      }
    };
  }

  // If voice analysis shows some suspicious patterns but not certain
  if (voiceAnalysis && voiceAnalysis.confidence > 0.5 && prediction.spamProbability > 0.4) {
    const verificationResult = await generateVerificationCode(phoneNumber);
    return {
      action: "challenge",
      reason: "Suspicious voice patterns detected",
      risk: Math.max(voiceAnalysis.confidence, prediction.spamProbability),
      features: [...(prediction.features || []), ...(voiceAnalysis.features || [])],
      prediction: {
        spamProbability: prediction.spamProbability,
        confidence: prediction.confidence,
        factors: prediction.features
      },
      voiceAnalysis,
      verification: {
        code: verificationResult.code,
        expiresAt: verificationResult.expiresAt,
        message: "Please complete voice verification challenge"
      }
    };
  }

  return {
    action: "allowed",
    reason: "Call passed all screening checks",
    risk: prediction.spamProbability,
    features: prediction.features,
    prediction: {
      spamProbability: prediction.spamProbability,
      confidence: prediction.confidence,
      factors: prediction.features
    },
    voiceAnalysis
  };
}

export async function logCall(phoneNumber: string, result: ScreeningResult) {
  await db.insert(callLogs).values({
    phoneNumber,
    action: result.action === "challenge" ? "blocked" : result.action,
    metadata: {
      reason: result.reason,
      risk: result.risk,
      features: result.features,
      dncStatus: result.dncStatus,
      prediction: result.prediction,
      voiceAnalysis: result.voiceAnalysis,
      verification: result.verification ? {
        provided: true,
        expiresAt: result.verification.expiresAt
      } : undefined
    }
  });
}