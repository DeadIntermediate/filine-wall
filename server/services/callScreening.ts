import { db } from "@db";
import { eq } from "drizzle-orm";
import { phoneNumbers, callLogs } from "@db/schema";
import { verifyPhoneNumber } from "./phoneVerification";
import { predictSpam } from "./spamPrediction";
import { dncRegistry } from "./dncRegistry";
import { generateVerificationCode } from "./callerVerification";
import { analyzeVoiceStream } from "./voiceAnalysis";
import { lookupCarrier } from "./carrierLookup";
import { SpamDatabaseService } from "./spamDatabaseService";

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
  metadata?: {
    callerName?: string;
    callerType?: string;
    callerPresentation?: string;
    callerVerified?: boolean;
    carrierName?: string;
    carrierType?: string;
    carrierCountry?: string;
    isMobile?: boolean;
    lineType?: string;
    fccData?: any;
  };
}

export async function screenCall(
  phoneNumber: string,
  audioData?: number[],
  sampleRate?: number
): Promise<ScreeningResult> {
  // Get carrier information
  const carrierInfo = await lookupCarrier(phoneNumber);

  // Check FCC spam database
  const fccCheck = await SpamDatabaseService.checkNumber(phoneNumber);
  if (fccCheck.isSpam) {
    const verificationResult = await generateVerificationCode(phoneNumber);
    return {
      action: "blocked",
      reason: "Number found in FCC spam database",
      risk: 0.9,
      metadata: {
        lineType: carrierInfo.lineType,
        carrierName: carrierInfo.carrier,
        carrierType: carrierInfo.lineType,
        fccData: fccCheck.details
      }
    };
  }

  // Check if number is whitelisted
  const whitelisted = await db.query.phoneNumbers.findFirst({
    where: eq(phoneNumbers.number, phoneNumber),
  });

  if (whitelisted && whitelisted.type === "whitelist") {
    return {
      action: "allowed",
      reason: "Number is whitelisted",
      risk: 0,
      metadata: {
        lineType: carrierInfo.lineType,
        carrierName: carrierInfo.carrier,
        carrierType: carrierInfo.lineType,
      }
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
      },
      metadata: {
        lineType: carrierInfo.lineType,
        carrierName: carrierInfo.carrier,
        carrierType: carrierInfo.lineType,
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
        },
        metadata: {
          lineType: carrierInfo.lineType,
          carrierName: carrierInfo.carrier,
          carrierType: carrierInfo.lineType,
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
        },
        metadata: {
          lineType: carrierInfo.lineType,
          carrierName: carrierInfo.carrier,
          carrierType: carrierInfo.lineType,
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
      risk: 1,
      metadata: {
        lineType: carrierInfo.lineType,
        carrierName: carrierInfo.carrier,
        carrierType: carrierInfo.lineType,
      }
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
      },
      metadata: {
        lineType: carrierInfo.lineType,
        carrierName: carrierInfo.carrier,
        carrierType: carrierInfo.lineType,
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
      },
      metadata: {
        lineType: carrierInfo.lineType,
        carrierName: carrierInfo.carrier,
        carrierType: carrierInfo.lineType,
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
    voiceAnalysis,
    metadata: {
      lineType: carrierInfo.lineType,
      carrierName: carrierInfo.carrier,
      carrierType: carrierInfo.lineType,
    }
  };
}

export async function logCall(phoneNumber: string, result: ScreeningResult) {
  const callerIdInfo = {
    name: "Unknown",
    type: "Unknown",
    presentation: "allowed",
    verified: false,
    timestamp: new Date().toISOString()
  };

  const carrierInfo = {
    name: result.metadata?.carrierName,
    type: result.metadata?.carrierType,
    country: result.metadata?.carrierCountry,
    mobile: result.metadata?.isMobile
  };

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
      } : undefined,
      lineType: result.metadata?.lineType || "unknown",
      carrierName: result.metadata?.carrierName,
      carrierType: result.metadata?.carrierType,
      carrierCountry: result.metadata?.carrierCountry,
      isMobile: result.metadata?.isMobile,

    },
    callerId: callerIdInfo,
    carrierInfo,
  });
}