import { db } from "@db";
import { eq } from "drizzle-orm";
import { phoneNumbers, callLogs } from "@db/schema";
import { verifyPhoneNumber } from "./phoneVerification";
import { predictSpam } from "./spamPrediction";
import { dncRegistry } from "./dncRegistry";
import { generateVerificationCode } from "./callerVerification";
import { analyzeVoice } from "./voiceAnalysisService";
import { lookupCarrier } from "./carrierLookup";
import { SpamDatabaseService } from "./spamDatabaseService";
import { detectScamPhrases } from "./scamPhraseDetection";
import { logger } from "../utils/logger";

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
    developmentMode?: boolean;
    error?: any;
  };
}

const isDevelopmentMode = process.env.NODE_ENV === 'development';

export async function screenCall(
  phoneNumber: string,
  audioData?: Float32Array,
  sampleRate?: number
): Promise<ScreeningResult> {
  try {
    // Log incoming call
    logger.info(`📞 INCOMING CALL from ${phoneNumber}`, 'CallScreening', { 
      phoneNumber,
      hasAudio: !!audioData,
      timestamp: new Date().toISOString()
    });

    // Get carrier information
    const carrierInfo = await lookupCarrier(phoneNumber);

    // Basic metadata for all responses
    const baseMetadata = {
      lineType: carrierInfo.lineType,
      carrierName: carrierInfo.carrier,
      carrierType: carrierInfo.lineType,
      developmentMode: isDevelopmentMode
    };

    // Check FCC spam database
    const fccCheck = await SpamDatabaseService.checkNumber(phoneNumber);
    if (fccCheck.isSpam) {
      const verificationResult = await generateVerificationCode(phoneNumber);
      logger.warn(`🚫 BLOCKED - FCC spam database match: ${phoneNumber}`, 'CallScreening', {
        phoneNumber,
        reason: 'FCC spam database',
        risk: 0.9,
        fccData: fccCheck.details
      });
      return {
        action: "blocked",
        reason: "Number found in FCC spam database",
        risk: 0.9,
        verification: verificationResult,
        metadata: { ...baseMetadata, fccData: fccCheck.details }
      };
    }

    // Check whitelist/blacklist
    const listedNumber = await db.query.phoneNumbers.findFirst({
      where: eq(phoneNumbers.number, phoneNumber),
    });

    if (listedNumber?.type === "whitelist") {
      logger.info(`✅ ALLOWED - Whitelisted: ${phoneNumber}`, 'CallScreening', {
        phoneNumber,
        reason: 'Whitelisted',
        risk: 0
      });
      return {
        action: "allowed",
        reason: "Number is whitelisted",
        risk: 0,
        metadata: baseMetadata
      };
    }

    if (listedNumber?.type === "blacklist") {
      const verificationResult = await generateVerificationCode(phoneNumber);
      logger.warn(`🚫 BLOCKED - Blacklisted: ${phoneNumber}`, 'CallScreening', {
        phoneNumber,
        reason: 'Blacklisted',
        risk: 1.0
      });
      return {
        action: "blocked",
        reason: "Number is blacklisted",
        risk: 1,
        verification: verificationResult,
        metadata: baseMetadata
      };
    }

    // Analyze voice if audio data is provided
    let voiceAnalysis;
    let scamPhraseDetection;
    if (audioData && sampleRate) {
      // Real voice analysis in production, simplified in development
      if (!isDevelopmentMode) {
        voiceAnalysis = await analyzeVoice(audioData, sampleRate);
      } else {
        // Simplified voice analysis for development
        voiceAnalysis = {
          isSpam: Math.random() > 0.7,
          confidence: 0.7 + (Math.random() * 0.3),
          features: ["Development mode voice analysis"],
          patterns: {
            energy: Math.random(),
            zeroCrossings: Math.floor(Math.random() * 1000),
            rhythmRegularity: Math.random(),
          }
        };
      }

      // Detect scam phrases if voice analysis indicates potential spam
      if (voiceAnalysis.isSpam && voiceAnalysis.confidence > 0.7) {
        const audioFeatures = {
          pausePatterns: [0.2, 0.3, 0.2],
          responseLatency: [1.0, 1.1, 1.0],
          intonationVariance: voiceAnalysis.patterns.rhythmRegularity
        };

        scamPhraseDetection = await detectScamPhrases(
          "sample_text", // In development mode, we don't have real transcription
          "en",
          audioFeatures
        );

        if (scamPhraseDetection.isScam) {
          const verificationResult = await generateVerificationCode(phoneNumber);
          return {
            action: "blocked",
            reason: "Scam phrases detected in call",
            risk: scamPhraseDetection.confidence,
            features: scamPhraseDetection.detectedPhrases,
            voiceAnalysis: {
              isRobot: true,
              confidence: voiceAnalysis.confidence,
              features: voiceAnalysis.features
            },
            verification: verificationResult,
            metadata: baseMetadata
          };
        }
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
          verification: verificationResult,
          metadata: baseMetadata
        };
      }
    } catch (error) {
      logger.error("DNC check failed", error as Error, 'CallScreening', { phoneNumber });
      // Continue with other checks
    }

    // Verify number format
    const verification = await verifyPhoneNumber(phoneNumber);
    if (!verification.isValid) {
      return {
        action: "blocked",
        reason: "Invalid phone number format",
        risk: 1,
        metadata: baseMetadata
      };
    }

    // Get ML prediction
    const prediction = await predictSpam(phoneNumber);

    // High confidence spam prediction
    if (prediction.spamProbability > 0.7 && prediction.confidence > 0.5) {
      const verificationResult = await generateVerificationCode(phoneNumber);
      logger.warn(`🚫 BLOCKED - High spam probability: ${phoneNumber}`, 'CallScreening', {
        phoneNumber,
        reason: 'High spam probability',
        risk: prediction.spamProbability,
        confidence: prediction.confidence,
        factors: prediction.features
      });
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
        voiceAnalysis: voiceAnalysis ? {
          isRobot: voiceAnalysis.isSpam,
          confidence: voiceAnalysis.confidence,
          features: voiceAnalysis.features
        } : undefined,
        verification: verificationResult,
        metadata: baseMetadata
      };
    }

    // Uncertain cases - require challenge
    if (prediction.confidence < 0.6 || (voiceAnalysis && voiceAnalysis.confidence < 0.6)) {
      const verificationResult = await generateVerificationCode(phoneNumber);
      logger.info(`⚠️  CHALLENGE - Verification required: ${phoneNumber}`, 'CallScreening', {
        phoneNumber,
        reason: 'Additional verification required',
        risk: Math.max(prediction.spamProbability, voiceAnalysis?.confidence || 0),
        predictionConfidence: prediction.confidence,
        voiceConfidence: voiceAnalysis?.confidence
      });
      return {
        action: "challenge",
        reason: "Additional verification required",
        risk: Math.max(prediction.spamProbability, voiceAnalysis?.confidence || 0),
        features: [...(prediction.features || []), ...(voiceAnalysis?.features || [])],
        prediction: {
          spamProbability: prediction.spamProbability,
          confidence: prediction.confidence,
          factors: prediction.features
        },
        voiceAnalysis: voiceAnalysis ? {
          isRobot: voiceAnalysis.isSpam,
          confidence: voiceAnalysis.confidence,
          features: voiceAnalysis.features
        } : undefined,
        verification: verificationResult,
        metadata: baseMetadata
      };
    }

    // Allow call if all checks pass
    logger.info(`✅ ALLOWED - All checks passed: ${phoneNumber}`, 'CallScreening', {
      phoneNumber,
      reason: 'All screening checks passed',
      risk: prediction.spamProbability,
      spamProbability: prediction.spamProbability,
      confidence: prediction.confidence
    });
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
      voiceAnalysis: voiceAnalysis ? {
        isRobot: voiceAnalysis.isSpam,
        confidence: voiceAnalysis.confidence,
        features: voiceAnalysis.features
      } : undefined,
      metadata: baseMetadata
    };
  } catch (error) {
    logger.error("Error in call screening", error as Error, 'CallScreening', { 
      phoneNumber,
      developmentMode: isDevelopmentMode 
    });
    // In development mode, provide more details
    if (isDevelopmentMode) {
      return {
        action: "allowed",
        reason: "Error in screening process (development mode)",
        risk: 0.5,
        features: ["Error occurred during screening"],
        metadata: {
          error: error instanceof Error ? error.message : "Unknown error",
          developmentMode: true
        }
      };
    }
    // In production, default to allowing call with warning
    return {
      action: "allowed",
      reason: "Error in screening process",
      risk: 0.5,
      metadata: { error: true }
    };
  }
}

export async function logCall(phoneNumber: string, result: ScreeningResult, deviceId?: string) {
  try {
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
      callerId: callerIdInfo,
      carrierInfo,
      deviceId: deviceId || null,
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
        developmentMode: result.metadata?.developmentMode
      }
    });

    // Log call to database
    logger.debug('Call logged to database', 'CallScreening', {
      phoneNumber,
      action: result.action,
      risk: result.risk,
      deviceId
    });
  } catch (error) {
    logger.error('Failed to log call to database', error as Error, 'CallScreening', {
      phoneNumber,
      action: result.action,
      deviceId,
      errorMessage: error instanceof Error ? error.message : 'Unknown error'
    });
    // Don't throw - we don't want logging failures to crash the screening process
  }
}