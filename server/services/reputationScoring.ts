import { db } from "@db";
import { eq, sql } from "drizzle-orm";
import { phoneNumbers, callLogs, spamReports } from "@db/schema";

interface ReputationFactors {
  communityReports: number;
  callHistory: number;
  blockRate: number;
  verificationStatus: number;
  timeFactors: number;
}

interface ReputationDetails {
  score: number;
  factors: ReputationFactors;
  lastUpdate: Date;
  trend: "improving" | "declining" | "stable";
}

export async function calculateReputationScore(phoneNumber: string): Promise<ReputationDetails> {
  // Get existing reports and call history
  const [reports] = await db
    .select({
      reportCount: sql<number>`count(*)`,
      verifiedCount: sql<number>`count(*) filter (where ${spamReports.status} = 'verified')`,
    })
    .from(spamReports)
    .where(eq(spamReports.phoneNumber, phoneNumber));

  const [callHistory] = await db
    .select({
      totalCalls: sql<number>`count(*)`,
      blockedCalls: sql<number>`count(*) filter (where ${callLogs.action} = 'blocked')`,
    })
    .from(callLogs)
    .where(eq(callLogs.phoneNumber, phoneNumber));

  // Calculate individual factors (0-100 scale)
  const factors: ReputationFactors = {
    communityReports: calculateReportScore(reports.reportCount, reports.verifiedCount),
    callHistory: calculateCallHistoryScore(callHistory.totalCalls),
    blockRate: calculateBlockRateScore(callHistory.totalCalls, callHistory.blockedCalls),
    verificationStatus: await getVerificationScore(phoneNumber),
    timeFactors: await calculateTimeFactors(phoneNumber),
  };

  // Calculate weighted average for final score
  const score = calculateWeightedScore(factors);

  // Get previous score for trend
  const [previousScore] = await db
    .select({
      score: phoneNumbers.reputationScore,
      lastUpdate: phoneNumbers.lastScoreUpdate,
    })
    .from(phoneNumbers)
    .where(eq(phoneNumbers.number, phoneNumber));

  const trend = previousScore?.score
    ? determineTrend(score, Number(previousScore.score))
    : "stable";

  // Update score in database
  await db
    .update(phoneNumbers)
    .set({
      reputationScore: score,
      lastScoreUpdate: new Date(),
      scoreFactors: factors,
    })
    .where(eq(phoneNumbers.number, phoneNumber));

  return {
    score,
    factors,
    lastUpdate: new Date(),
    trend,
  };
}

function calculateReportScore(totalReports: number, verifiedReports: number): number {
  if (totalReports === 0) return 80; // Default good score if no reports
  const verificationRate = verifiedReports / totalReports;
  return Math.max(0, 100 - (verificationRate * 100));
}

function calculateCallHistoryScore(totalCalls: number): number {
  // More calls = more data = more reliable score
  return Math.min(100, totalCalls * 5); // 20 calls for max reliability
}

function calculateBlockRateScore(totalCalls: number, blockedCalls: number): number {
  if (totalCalls === 0) return 50; // Neutral score if no calls
  const blockRate = blockedCalls / totalCalls;
  return Math.max(0, 100 - (blockRate * 100));
}

async function getVerificationScore(phoneNumber: string): Promise<number> {
  // Get the last verification result from metadata
  const [lastLog] = await db
    .select({
      metadata: callLogs.metadata,
    })
    .from(callLogs)
    .where(eq(callLogs.phoneNumber, phoneNumber))
    .orderBy(sql`${callLogs.timestamp} desc`)
    .limit(1);

  if (!lastLog?.metadata) return 50;

  // Extract verification status from metadata
  const metadata = lastLog.metadata as any;
  if (metadata.verification?.isValid) {
    return metadata.verification.risk ? 75 - (metadata.verification.risk * 25) : 75;
  }
  return 25;
}

async function calculateTimeFactors(phoneNumber: string): Promise<number> {
  // Calculate score based on call patterns (time of day, frequency)
  const [patterns] = await db
    .select({
      nightCalls: sql<number>`count(*) filter (where extract(hour from ${callLogs.timestamp}) between 22 and 5)`,
      totalCalls: sql<number>`count(*)`,
    })
    .from(callLogs)
    .where(eq(callLogs.phoneNumber, phoneNumber));

  if (patterns.totalCalls === 0) return 50;

  const nightCallRate = patterns.nightCalls / patterns.totalCalls;
  return Math.max(0, 100 - (nightCallRate * 100)); // Night calls reduce score
}

function calculateWeightedScore(factors: ReputationFactors): number {
  const weights = {
    communityReports: 0.35,
    callHistory: 0.1,
    blockRate: 0.25,
    verificationStatus: 0.2,
    timeFactors: 0.1,
  };

  return Math.round(
    Object.entries(factors).reduce(
      (score, [factor, value]) => score + value * weights[factor as keyof typeof weights],
      0
    )
  );
}

function determineTrend(currentScore: number, previousScore: number): "improving" | "declining" | "stable" {
  const difference = currentScore - previousScore;
  if (Math.abs(difference) < 5) return "stable";
  return difference > 0 ? "improving" : "declining";
}
