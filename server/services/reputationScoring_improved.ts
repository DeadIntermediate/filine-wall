import { db } from "@db";
import { phoneNumbers, callLogs, spamReports } from "@db/schema";
import { eq, sql, and, gte } from "drizzle-orm";

interface ReputationFactors {
  communityReports: number;
  callHistory: number;
  blockRate: number;
  verificationStatus: number;
  timeFactors: number;
  carrierTrust: number;
}

interface ReputationDetails {
  score: number;
  factors: ReputationFactors;
  lastUpdate: Date;
  trend: "improving" | "declining" | "stable";
  confidence: number;
}

// Time decay constants
const TIME_DECAY = {
  HOUR: 3600,
  DAY: 86400,
  WEEK: 604800,
  MONTH: 2592000
};

class ReputationBatchProcessor {
  private static updateQueue: Map<string, Date> = new Map();
  private static processingBatch: boolean = false;
  private static readonly BATCH_SIZE = 50;
  private static readonly BATCH_DELAY = 5000; // 5 seconds

  static async queueUpdate(phoneNumber: string): Promise<void> {
    this.updateQueue.set(phoneNumber, new Date());

    // Auto-process if queue is large enough
    if (this.updateQueue.size >= this.BATCH_SIZE) {
      await this.processBatch();
    } else if (!this.processingBatch) {
      // Schedule batch processing
      setTimeout(() => this.processBatch(), this.BATCH_DELAY);
    }
  }

  static async processBatch(): Promise<void> {
    if (this.processingBatch || this.updateQueue.size === 0) return;

    this.processingBatch = true;
    const phoneNumbersToUpdate = Array.from(this.updateQueue.keys());
    this.updateQueue.clear();

    try {
      await Promise.all(
        phoneNumbersToUpdate.map(num => updateReputationScore(num))
      );
      console.log(`Processed ${phoneNumbersToUpdate.length} reputation updates`);
    } catch (error) {
      console.error('Error in batch reputation update:', error);
    } finally {
      this.processingBatch = false;
    }
  }

  static async forceFlush(): Promise<void> {
    await this.processBatch();
  }
}

// Calculate time-weighted score (newer events have more weight)
function applyTimeDecay(baseScore: number, timestamp: Date): number {
  const now = new Date();
  const ageInSeconds = (now.getTime() - timestamp.getTime()) / 1000;

  if (ageInSeconds < TIME_DECAY.DAY) {
    return baseScore * 1.0; // Recent events - full weight
  } else if (ageInSeconds < TIME_DECAY.WEEK) {
    return baseScore * 0.8; // Last week - 80% weight
  } else if (ageInSeconds < TIME_DECAY.MONTH) {
    return baseScore * 0.5; // Last month - 50% weight
  } else {
    return baseScore * 0.2; // Older - 20% weight
  }
}

function calculateReportScore(reports: any[]): number {
  if (!reports.length) return 100; // No reports = good reputation

  let score = 100;
  const now = new Date();

  for (const report of reports) {
    const ageInSeconds = (now.getTime() - report.createdAt.getTime()) / 1000;
    const isVerified = report.status === 'verified';
    
    // Base penalty: verified reports are weighted higher
    const basePenalty = isVerified ? 15 : 5;
    
    // Apply time decay to the penalty
    const decayedPenalty = applyTimeDecay(basePenalty, report.createdAt);
    
    score -= decayedPenalty;
  }

  return Math.max(0, score);
}

function calculateCallHistoryScore(totalCalls: number, recentCalls: number): number {
  if (totalCalls === 0) return 50; // Neutral for unknown numbers

  // Frequent callers with legitimate history get better scores
  if (totalCalls > 10 && recentCalls > 5) {
    return 70; // Established caller
  } else if (totalCalls > 5) {
    return 60; // Some history
  } else if (totalCalls > 2) {
    return 50; // New caller
  }

  return 40; // Very new/suspicious
}

function calculateBlockRateScore(totalCalls: number, blockedCalls: number, recentBlockRate: number): number {
  if (totalCalls === 0) return 50;

  const overallBlockRate = blockedCalls / totalCalls;
  
  // Recent block rate is weighted more heavily
  const weightedBlockRate = (overallBlockRate * 0.3) + (recentBlockRate * 0.7);

  // Convert block rate to score (0-100)
  return Math.round(100 * (1 - weightedBlockRate));
}

async function getVerificationScore(phoneNumber: string): Promise<number> {
  // Check if number has been user-verified as legitimate
  const listedNumber = await db.query.phoneNumbers.findFirst({
    where: eq(phoneNumbers.number, phoneNumber)
  });

  if (listedNumber?.type === "whitelist") return 100;
  if (listedNumber?.type === "blacklist") return 0;

  return 50; // Neutral
}

async function calculateTimeFactors(phoneNumber: string): Promise<number> {
  const now = new Date();
  const recentWindow = new Date(now.getTime() - TIME_DECAY.WEEK * 1000);

  const recentCalls = await db.query.callLogs.findMany({
    where: and(
      eq(callLogs.phoneNumber, phoneNumber),
      gte(callLogs.timestamp, recentWindow)
    )
  });

  if (!recentCalls.length) return 50; // No recent activity

  // Calculate call frequency
  const callsPerDay = recentCalls.length / 7;

  // Moderate frequency is good (1-3 calls per day)
  // Very high frequency (>10/day) or very low (<0.1/week) is suspicious
  if (callsPerDay >= 1 && callsPerDay <= 3) {
    return 80; // Normal frequency
  } else if (callsPerDay > 10) {
    return 20; // Spam-like frequency
  } else if (callsPerDay < 0.1) {
    return 40; // Very rare caller
  }

  return 60; // Moderate
}

async function calculateCarrierTrust(carrierInfo: any): Promise<number> {
  if (!carrierInfo) return 50;

  let score = 50;

  // Mobile numbers are slightly more trustworthy than landlines
  if (carrierInfo.isMobile) {
    score += 10;
  }

  // Certain carriers have better reputation
  const trustedCarriers = ['Verizon', 'AT&T', 'T-Mobile', 'Sprint'];
  if (trustedCarriers.some(carrier => carrierInfo.name?.includes(carrier))) {
    score += 10;
  }

  // US numbers are neutral, international can be more suspicious
  if (carrierInfo.country && carrierInfo.country !== 'US') {
    score -= 10;
  }

  return Math.min(100, Math.max(0, score));
}

async function updateReputationScore(phoneNumber: string): Promise<ReputationDetails> {
  const now = new Date();
  const oneMonthAgo = new Date(now.getTime() - TIME_DECAY.MONTH * 1000);
  const oneWeekAgo = new Date(now.getTime() - TIME_DECAY.WEEK * 1000);

  // Gather all data in parallel
  const [reports, allCalls, recentCalls, carrierInfo] = await Promise.all([
    db.query.spamReports.findMany({
      where: eq(spamReports.phoneNumber, phoneNumber)
    }),
    db.select({
      total: sql<number>`count(*)`,
      blocked: sql<number>`count(*) filter (where ${callLogs.action} = 'blocked')`,
    })
    .from(callLogs)
    .where(and(
      eq(callLogs.phoneNumber, phoneNumber),
      gte(callLogs.timestamp, oneMonthAgo)
    )),
    db.select({
      total: sql<number>`count(*)`,
      blocked: sql<number>`count(*) filter (where ${callLogs.action} = 'blocked')`,
    })
    .from(callLogs)
    .where(and(
      eq(callLogs.phoneNumber, phoneNumber),
      gte(callLogs.timestamp, oneWeekAgo)
    )),
    db.query.callLogs.findFirst({
      where: eq(callLogs.phoneNumber, phoneNumber)
    })
  ]);

  const totalCalls = allCalls[0]?.total || 0;
  const blockedCalls = allCalls[0]?.blocked || 0;
  const recentTotal = recentCalls[0]?.total || 0;
  const recentBlocked = recentCalls[0]?.blocked || 0;
  const recentBlockRate = recentTotal > 0 ? recentBlocked / recentTotal : 0;

  // Calculate individual factors
  const factors: ReputationFactors = {
    communityReports: calculateReportScore(reports),
    callHistory: calculateCallHistoryScore(totalCalls, recentTotal),
    blockRate: calculateBlockRateScore(totalCalls, blockedCalls, recentBlockRate),
    verificationStatus: await getVerificationScore(phoneNumber),
    timeFactors: await calculateTimeFactors(phoneNumber),
    carrierTrust: await calculateCarrierTrust(carrierInfo?.carrierInfo)
  };

  // Weighted average with updated weights
  const weights = {
    communityReports: 0.30,    // Community feedback is very important
    callHistory: 0.15,         // History matters
    blockRate: 0.25,           // Block rate is a strong signal
    verificationStatus: 0.15,  // User verification
    timeFactors: 0.10,         // Calling patterns
    carrierTrust: 0.05         // Carrier reputation
  };

  const score = Math.round(
    factors.communityReports * weights.communityReports +
    factors.callHistory * weights.callHistory +
    factors.blockRate * weights.blockRate +
    factors.verificationStatus * weights.verificationStatus +
    factors.timeFactors * weights.timeFactors +
    factors.carrierTrust * weights.carrierTrust
  );

  // Get previous score for trend analysis
  const previousRecord = await db.query.phoneNumbers.findFirst({
    where: eq(phoneNumbers.number, phoneNumber)
  });

  const previousScore = previousRecord?.reputationScore 
    ? (typeof previousRecord.reputationScore === 'number' 
        ? previousRecord.reputationScore 
        : parseInt(previousRecord.reputationScore as string, 10))
    : null;

  const trend = previousScore !== null
    ? (score > previousScore + 5 ? "improving" : 
       score < previousScore - 5 ? "declining" : "stable")
    : "stable";

  // Calculate confidence based on data availability
  const dataPoints = [
    reports.length > 0,
    totalCalls > 3,
    recentCalls.length > 0,
    previousScore !== null
  ].filter(Boolean).length;

  const confidence = Math.min(1.0, dataPoints / 4 + 0.2);

  // Update database
  await db
    .insert(phoneNumbers)
    .values({
      number: phoneNumber,
      reputationScore: score,
      lastScoreUpdate: now,
      scoreFactors: factors,
      type: null
    })
    .onConflictDoUpdate({
      target: phoneNumbers.number,
      set: {
        reputationScore: score,
        lastScoreUpdate: now,
        scoreFactors: factors
      }
    });

  return {
    score,
    factors,
    lastUpdate: now,
    trend,
    confidence
  };
}

// Public API
export async function calculateReputationScore(phoneNumber: string): Promise<ReputationDetails> {
  // Check if we have a recent score (< 1 hour old)
  const existing = await db.query.phoneNumbers.findFirst({
    where: eq(phoneNumbers.number, phoneNumber)
  });

  if (existing?.lastScoreUpdate) {
    const age = (new Date().getTime() - existing.lastScoreUpdate.getTime()) / 1000;
    if (age < 3600) { // Less than 1 hour old
      return {
        score: typeof existing.reputationScore === 'number' 
          ? existing.reputationScore 
          : parseInt(existing.reputationScore as string, 10),
        factors: (existing.scoreFactors || {}) as ReputationFactors,
        lastUpdate: existing.lastScoreUpdate,
        trend: "stable",
        confidence: 0.8
      };
    }
  }

  // Queue for batch update (async, non-blocking)
  ReputationBatchProcessor.queueUpdate(phoneNumber);

  // Return cached or default score immediately
  if (existing) {
    return {
      score: typeof existing.reputationScore === 'number' 
        ? existing.reputationScore 
        : parseInt(existing.reputationScore as string, 10),
      factors: (existing.scoreFactors || {}) as ReputationFactors,
      lastUpdate: existing.lastScoreUpdate || new Date(),
      trend: "stable",
      confidence: 0.6
    };
  }

  // For completely new numbers, return neutral score
  return {
    score: 50,
    factors: {
      communityReports: 50,
      callHistory: 50,
      blockRate: 50,
      verificationStatus: 50,
      timeFactors: 50,
      carrierTrust: 50
    },
    lastUpdate: new Date(),
    trend: "stable",
    confidence: 0.3
  };
}

// Force immediate recalculation (for admin/testing purposes)
export async function forceRecalculate(phoneNumber: string): Promise<ReputationDetails> {
  return await updateReputationScore(phoneNumber);
}

// Batch update utility
export async function batchUpdateReputations(phoneNumbers: string[]): Promise<void> {
  for (const number of phoneNumbers) {
    await ReputationBatchProcessor.queueUpdate(number);
  }
  await ReputationBatchProcessor.forceFlush();
}
