import { db } from "@db";
import { eq, desc, sql, and } from "drizzle-orm";
import { phoneNumbers, callLogs, spamReports } from "@db/schema";

export interface CallFeatures {
  phoneNumber: string;
  timestamp: Date;
  
  // Carrier information
  carrier?: {
    name: string;
    type: string;
    country: string;
    isMobile: boolean;
  };
  
  // Historical patterns
  callHistory?: {
    totalCalls: number;
    blockedCalls: number;
    blockRate: number;
    avgCallDuration: number;
    callFrequency: number;
    lastCallTime?: Date;
  };
  
  // Community signals
  community?: {
    spamReports: number;
    verifiedReports: number;
    reputationScore: number;
  };
  
  // Voice analysis
  voice?: {
    isRobot: boolean;
    confidence: number;
    features: string[];
    patterns: {
      energy: number;
      zeroCrossings: number;
      rhythmRegularity: number;
      naturalness?: number;
    };
  };
  
  // ML prediction
  mlPrediction?: {
    spamProbability: number;
    confidence: number;
    factors: string[];
  };
  
  // Regulatory checks
  regulatory?: {
    isDNC: boolean;
    isFCCSpam: boolean;
    isWhitelisted: boolean;
    isBlacklisted: boolean;
  };
  
  // Scam phrase detection
  scamPhrases?: {
    detected: boolean;
    confidence: number;
    phrases: string[];
    category?: string;
  };
  
  // Time-based factors
  temporal?: {
    hourOfDay: number;
    dayOfWeek: number;
    isBusinessHours: boolean;
    timeSinceLastCall?: number;
  };
}

export interface RiskScore {
  finalScore: number;
  action: "blocked" | "allowed" | "challenge";
  reason: string;
  confidence: number;
  breakdown: {
    regulatory: number;
    community: number;
    behavioral: number;
    voice: number;
    ml: number;
    temporal: number;
  };
  features: CallFeatures;
}

export class RiskEngine {
  private static readonly WEIGHTS = {
    regulatory: 0.25,    // FCC, DNC, whitelist/blacklist
    community: 0.20,     // Reputation, spam reports
    behavioral: 0.15,    // Call patterns, frequency
    voice: 0.15,         // Voice analysis, robocall detection
    ml: 0.15,           // Machine learning prediction
    temporal: 0.10      // Time-based anomalies
  };

  private static readonly THRESHOLDS = {
    block: 0.70,        // Block if risk > 70%
    challenge: 0.40,    // Challenge if risk 40-70%
    allow: 0.40         // Allow if risk < 40%
  };

  static async calculateRisk(features: CallFeatures): Promise<RiskScore> {
    const breakdown = {
      regulatory: this.calculateRegulatoryRisk(features),
      community: this.calculateCommunityRisk(features),
      behavioral: this.calculateBehavioralRisk(features),
      voice: this.calculateVoiceRisk(features),
      ml: this.calculateMLRisk(features),
      temporal: this.calculateTemporalRisk(features)
    };

    // Weighted sum of all risk factors
    const finalScore = 
      breakdown.regulatory * this.WEIGHTS.regulatory +
      breakdown.community * this.WEIGHTS.community +
      breakdown.behavioral * this.WEIGHTS.behavioral +
      breakdown.voice * this.WEIGHTS.voice +
      breakdown.ml * this.WEIGHTS.ml +
      breakdown.temporal * this.WEIGHTS.temporal;

    // Determine action based on thresholds
    let action: "blocked" | "allowed" | "challenge";
    let reason: string;
    let confidence: number;

    // Hard blocks (override scoring)
    if (features.regulatory?.isBlacklisted) {
      action = "blocked";
      reason = "Number is blacklisted";
      confidence = 1.0;
    } else if (features.regulatory?.isWhitelisted) {
      action = "allowed";
      reason = "Number is whitelisted";
      confidence = 1.0;
    } else if (features.regulatory?.isFCCSpam) {
      action = "blocked";
      reason = "Number in FCC spam database";
      confidence = 0.95;
    } else if (finalScore >= this.THRESHOLDS.block) {
      action = "blocked";
      reason = this.generateReason(breakdown, "block");
      confidence = Math.min(finalScore, 0.95);
    } else if (finalScore >= this.THRESHOLDS.challenge) {
      action = "challenge";
      reason = this.generateReason(breakdown, "challenge");
      confidence = finalScore;
    } else {
      action = "allowed";
      reason = "Call passed screening checks";
      confidence = 1 - finalScore;
    }

    return {
      finalScore,
      action,
      reason,
      confidence,
      breakdown,
      features
    };
  }

  private static calculateRegulatoryRisk(features: CallFeatures): number {
    let risk = 0;

    if (features.regulatory?.isFCCSpam) risk += 0.9;
    if (features.regulatory?.isBlacklisted) risk = 1.0;
    if (features.regulatory?.isWhitelisted) risk = 0;
    if (features.regulatory?.isDNC) risk += 0.8;

    return Math.min(risk, 1.0);
  }

  private static calculateCommunityRisk(features: CallFeatures): number {
    if (!features.community) return 0;

    const { spamReports, verifiedReports, reputationScore } = features.community;
    
    // Reputation score is 0-100, convert to 0-1 risk (inverse)
    const reputationRisk = reputationScore ? (100 - reputationScore) / 100 : 0.5;
    
    // Spam reports contribute to risk (diminishing returns)
    const reportRisk = Math.min(spamReports / 10, 0.9);
    
    // Verified reports are weighted higher
    const verifiedRisk = Math.min(verifiedReports / 5, 1.0);
    
    // Combine with weights
    return Math.min(
      reputationRisk * 0.4 +
      reportRisk * 0.3 +
      verifiedRisk * 0.3,
      1.0
    );
  }

  private static calculateBehavioralRisk(features: CallFeatures): number {
    if (!features.callHistory) return 0;

    const { totalCalls, blockRate, callFrequency, avgCallDuration } = features.callHistory;
    
    let risk = 0;

    // High block rate is a strong signal
    risk += blockRate * 0.5;

    // High frequency calls (more than 3 per day)
    if (callFrequency > 3) {
      risk += Math.min((callFrequency - 3) / 10, 0.3);
    }

    // Very short calls (under 10 seconds) suggest robocalls
    if (avgCallDuration < 10) {
      risk += 0.2;
    }

    // Pattern of repeated attempts
    if (totalCalls > 5 && blockRate > 0.6) {
      risk += 0.3;
    }

    return Math.min(risk, 1.0);
  }

  private static calculateVoiceRisk(features: CallFeatures): number {
    if (!features.voice) return 0;

    const { isRobot, confidence, patterns } = features.voice;
    
    let risk = 0;

    if (isRobot) {
      risk += confidence * 0.6;
    }

    // Low naturalness suggests synthetic voice
    if (patterns.naturalness !== undefined && patterns.naturalness < 0.3) {
      risk += 0.3;
    }

    // Very regular rhythm suggests automated speech
    if (patterns.rhythmRegularity > 0.8) {
      risk += 0.2;
    }

    // Abnormal energy patterns
    if (patterns.energy < 0.1 || patterns.energy > 0.9) {
      risk += 0.1;
    }

    return Math.min(risk, 1.0);
  }

  private static calculateMLRisk(features: CallFeatures): number {
    if (!features.mlPrediction) return 0;

    const { spamProbability, confidence } = features.mlPrediction;
    
    // Weight ML prediction by its confidence
    return spamProbability * (0.5 + confidence * 0.5);
  }

  private static calculateTemporalRisk(features: CallFeatures): number {
    if (!features.temporal) return 0;

    const { hourOfDay, isBusinessHours, timeSinceLastCall } = features.temporal;
    
    let risk = 0;

    // Calls outside business hours (9 AM - 5 PM) are slightly more suspicious
    if (!isBusinessHours) {
      // Early morning (before 8 AM) or late night (after 9 PM)
      if (hourOfDay < 8 || hourOfDay > 21) {
        risk += 0.3;
      } else {
        risk += 0.1;
      }
    }

    // Multiple calls in short succession (within 1 hour)
    if (timeSinceLastCall !== undefined && timeSinceLastCall < 3600) {
      risk += 0.3;
    }

    return Math.min(risk, 1.0);
  }

  private static generateReason(breakdown: RiskScore['breakdown'], action: string): string {
    // Find the highest risk factors
    const factors = Object.entries(breakdown)
      .filter(([_, value]) => value > 0.3)
      .sort(([_, a], [__, b]) => b - a)
      .map(([key, _]) => key);

    if (factors.length === 0) {
      return action === "block" ? "Multiple risk factors detected" : "Moderate risk indicators";
    }

    const factorNames: Record<string, string> = {
      regulatory: "regulatory concerns",
      community: "community reports",
      behavioral: "suspicious call patterns",
      voice: "voice analysis",
      ml: "spam prediction model",
      temporal: "unusual timing"
    };

    const topFactors = factors.slice(0, 2).map(f => factorNames[f]);
    
    return `Risk detected: ${topFactors.join(" and ")}`;
  }

  // Aggregate features from multiple sources
  static async aggregateFeatures(
    phoneNumber: string,
    audioData?: Float32Array,
    sampleRate?: number
  ): Promise<CallFeatures> {
    const now = new Date();
    const hourOfDay = now.getHours();
    const dayOfWeek = now.getDay();

    // Parallel data gathering
    const [
      listedNumber,
      callHistory,
      spamReportsData,
      lastCall
    ] = await Promise.all([
      db.query.phoneNumbers.findFirst({
        where: eq(phoneNumbers.number, phoneNumber)
      }),
      db.select({
        totalCalls: sql<number>`count(*)`,
        blockedCalls: sql<number>`count(*) filter (where ${callLogs.action} = 'blocked')`,
        avgDuration: sql<number>`avg(extract(epoch from ${callLogs.timestamp}))`,
      })
      .from(callLogs)
      .where(eq(callLogs.phoneNumber, phoneNumber)),
      db.select({
        totalReports: sql<number>`count(*)`,
        verifiedReports: sql<number>`count(*) filter (where ${spamReports.status} = 'verified')`,
      })
      .from(spamReports)
      .where(eq(spamReports.phoneNumber, phoneNumber)),
      db.query.callLogs.findFirst({
        where: eq(callLogs.phoneNumber, phoneNumber),
        orderBy: desc(callLogs.timestamp)
      })
    ]);

    const features: CallFeatures = {
      phoneNumber,
      timestamp: now,
      callHistory: callHistory[0] ? {
        totalCalls: callHistory[0].totalCalls || 0,
        blockedCalls: callHistory[0].blockedCalls || 0,
        blockRate: callHistory[0].totalCalls > 0 
          ? (callHistory[0].blockedCalls || 0) / callHistory[0].totalCalls 
          : 0,
        avgCallDuration: callHistory[0].avgDuration || 0,
        callFrequency: callHistory[0].totalCalls || 0,
        lastCallTime: lastCall?.timestamp
      } : undefined,
      community: {
        spamReports: spamReportsData[0]?.totalReports || 0,
        verifiedReports: spamReportsData[0]?.verifiedReports || 0,
        reputationScore: typeof listedNumber?.reputationScore === 'number' 
          ? listedNumber.reputationScore 
          : 50
      },
      regulatory: {
        isDNC: false, // Will be set by caller
        isFCCSpam: false, // Will be set by caller
        isWhitelisted: listedNumber?.type === "whitelist",
        isBlacklisted: listedNumber?.type === "blacklist"
      },
      temporal: {
        hourOfDay,
        dayOfWeek,
        isBusinessHours: hourOfDay >= 9 && hourOfDay < 17 && dayOfWeek >= 1 && dayOfWeek <= 5,
        timeSinceLastCall: lastCall?.timestamp 
          ? (now.getTime() - lastCall.timestamp.getTime()) / 1000 
          : undefined
      }
    };

    return features;
  }
}
