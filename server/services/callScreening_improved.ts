import { db } from "@db";
import { eq } from "drizzle-orm";
import { phoneNumbers, callLogs } from "@db/schema";
import { RiskEngine, CallFeatures } from "./riskEngine";
import { analyzeVoice } from "./voiceAnalysisService_improved";
import { lookupCarrier } from "./carrierLookup";
import { SpamDatabaseService } from "./spamDatabaseService";
import { detectScamPhrasesAdvanced } from "./scamPhraseDetection_improved";
import { calculateReputationScore } from "./reputationScoring_improved";
import { dncRegistry } from "./dncRegistry";
import { generateVerificationCode } from "./callerVerification";
import { CallScreeningMetrics } from "./metrics.js";

export interface ScreeningResult {
  action: "blocked" | "allowed" | "challenge";
  reason: string;
  risk: number;
  confidence: number;
  features?: string[];
  breakdown: {
    regulatory: number;
    community: number;
    behavioral: number;
    voice: number;
    ml: number;
    temporal: number;
  };
  verification?: {
    code?: string;
    expiresAt?: Date;
    message?: string;
  };
  metadata?: {
    carrierName?: string;
    carrierType?: string;
    lineType?: string;
    developmentMode?: boolean;
    processingTime?: number;
  };
}

const isDevelopmentMode = process.env.NODE_ENV === 'development';

export async function screenCall(
  phoneNumber: string,
  audioData?: Float32Array,
  sampleRate?: number
): Promise<ScreeningResult> {
  const startTime = Date.now();

  try {
    // Step 1: Aggregate features from all sources (parallel where possible)
    const features = await RiskEngine.aggregateFeatures(phoneNumber, audioData, sampleRate);

    // Step 2: Gather additional data in parallel
    const [
      carrierInfo,
      fccCheck,
      dncCheck,
      reputationData,
      voiceAnalysis,
      scamPhraseResult
    ] = await Promise.all([
      lookupCarrier(phoneNumber),
      SpamDatabaseService.checkNumber(phoneNumber),
      dncRegistry.checkNumber(phoneNumber).catch(() => ({ isRegistered: false })),
      calculateReputationScore(phoneNumber),
      audioData && sampleRate && !isDevelopmentMode
        ? analyzeVoice(audioData, sampleRate)
        : Promise.resolve(null),
      audioData && sampleRate && !isDevelopmentMode
        ? detectScamPhrasesAdvanced("", "en", {
            pausePatterns: [0.2, 0.3, 0.2],
            responseLatency: [1.0, 1.1, 1.0],
            intonationVariance: 0.5
          })
        : Promise.resolve(null)
    ]);

    // Step 3: Enrich features with collected data
    features.carrier = {
      name: carrierInfo.carrier || "Unknown",
      type: carrierInfo.lineType || "Unknown",
      country: "Unknown", // CarrierInfo doesn't have country field
      isMobile: carrierInfo.lineType === "mobile"
    };

    features.regulatory = {
      isDNC: dncCheck.isRegistered,
      isFCCSpam: fccCheck.isSpam,
      isWhitelisted: features.regulatory?.isWhitelisted || false,
      isBlacklisted: features.regulatory?.isBlacklisted || false
    };

    features.community = {
      ...features.community!,
      reputationScore: reputationData.score
    };

    if (voiceAnalysis) {
      features.voice = {
        isRobot: voiceAnalysis.isSpam,
        confidence: voiceAnalysis.confidence,
        features: voiceAnalysis.features,
        patterns: voiceAnalysis.patterns
      };
    }

    if (scamPhraseResult) {
      features.scamPhrases = {
        detected: scamPhraseResult.isScam,
        confidence: scamPhraseResult.confidence,
        phrases: scamPhraseResult.detectedPhrases,
        category: scamPhraseResult.category
      };
    }

    // Step 4: Calculate risk using ensemble model
    const riskScore = await RiskEngine.calculateRisk(features);

    // Step 5: Generate verification if needed
    let verification;
    if (riskScore.action === "blocked" || riskScore.action === "challenge") {
      verification = await generateVerificationCode(phoneNumber);
    }

    // Step 6: Build result
    const result: ScreeningResult = {
      action: riskScore.action,
      reason: riskScore.reason,
      risk: riskScore.finalScore,
      confidence: riskScore.confidence,
      features: buildFeatureList(riskScore),
      breakdown: riskScore.breakdown,
      verification,
      metadata: {
        carrierName: carrierInfo.carrier,
        carrierType: carrierInfo.lineType,
        lineType: carrierInfo.lineType,
        developmentMode: isDevelopmentMode,
        processingTime: Date.now() - startTime
      }
    };

    // Step 7: Log metrics
    CallScreeningMetrics.recordScreening(result, features);

    // Step 8: Log the call
    await logCall(phoneNumber, result);

    return result;

  } catch (error) {
    console.error("Error in call screening:", error);
    
    // Record error metric
    CallScreeningMetrics.recordError(error);

    // Fail-safe: allow call on error but flag it
    const result: ScreeningResult = {
      action: "allowed",
      reason: isDevelopmentMode 
        ? `Error in screening: ${error instanceof Error ? error.message : 'Unknown error'}`
        : "Screening system unavailable",
      risk: 0.5,
      confidence: 0.1,
      breakdown: {
        regulatory: 0,
        community: 0,
        behavioral: 0,
        voice: 0,
        ml: 0,
        temporal: 0
      },
      metadata: {
        developmentMode: isDevelopmentMode,
        processingTime: Date.now() - startTime
      }
    };

    await logCall(phoneNumber, result);
    return result;
  }
}

function buildFeatureList(riskScore: any): string[] {
  const features: string[] = [];
  const { breakdown, features: callFeatures } = riskScore;

  // Add significant risk factors
  if (breakdown.regulatory > 0.5) {
    features.push("Regulatory concerns");
  }
  if (breakdown.community > 0.5) {
    features.push(`Reputation score: ${Math.round(callFeatures.community?.reputationScore || 50)}`);
  }
  if (breakdown.behavioral > 0.5) {
    features.push("Suspicious call patterns");
  }
  if (breakdown.voice > 0.5 && callFeatures.voice) {
    features.push(...callFeatures.voice.features);
  }
  if (breakdown.ml > 0.5) {
    features.push("High spam probability");
  }
  if (breakdown.temporal > 0.5) {
    features.push("Unusual timing");
  }

  if (callFeatures.scamPhrases?.detected) {
    features.push(`Scam phrases: ${callFeatures.scamPhrases.category || 'generic'}`);
  }

  return features;
}

export async function logCall(phoneNumber: string, result: ScreeningResult) {
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
      country: null,
      mobile: result.metadata?.lineType === "mobile"
    };

    await db.insert(callLogs).values({
      phoneNumber,
      action: result.action === "challenge" ? "blocked" : result.action,
      callerId: callerIdInfo,
      carrierInfo,
      metadata: {
        reason: result.reason,
        risk: result.risk,
        confidence: result.confidence,
        features: result.features,
        breakdown: result.breakdown,
        verification: result.verification ? {
          provided: true,
          expiresAt: result.verification.expiresAt
        } : undefined,
        lineType: result.metadata?.lineType || "unknown",
        carrierName: result.metadata?.carrierName,
        carrierType: result.metadata?.carrierType,
        developmentMode: result.metadata?.developmentMode,
        processingTime: result.metadata?.processingTime
      }
    });
  } catch (error) {
    console.error("Error logging call:", error);
    // Don't throw - logging failure shouldn't prevent call screening
  }
}

// Batch screening for analysis purposes
export async function batchScreenCalls(phoneNumbers: string[]): Promise<Map<string, ScreeningResult>> {
  const results = new Map<string, ScreeningResult>();

  // Process in parallel batches of 10
  const batchSize = 10;
  for (let i = 0; i < phoneNumbers.length; i += batchSize) {
    const batch = phoneNumbers.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map(async (num) => {
        try {
          const result = await screenCall(num);
          return [num, result] as [string, ScreeningResult];
        } catch (error) {
          console.error(`Error screening ${num}:`, error);
          return null;
        }
      })
    );

    batchResults
      .filter((r): r is [string, ScreeningResult] => r !== null)
      .forEach(([num, result]) => results.set(num, result));
  }

  return results;
}
