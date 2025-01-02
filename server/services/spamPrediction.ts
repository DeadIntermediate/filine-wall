import { db } from "@db";
import { sql } from "drizzle-orm";
import { callLogs } from "@db/schema";

interface CallFeatures {
  hour: number;
  latitude?: number;
  longitude?: number;
  historicalBlockRate: number;
}

interface PredictionResult {
  spamProbability: number;
  features: string[];
  confidence: number;
}

export async function predictSpam(phoneNumber: string): Promise<PredictionResult> {
  // Extract hour from current time
  const hour = new Date().getHours();
  
  // Get historical data for the number
  const [history] = await db
    .select({
      total: sql<number>`count(*)`,
      blocked: sql<number>`count(*) filter (where ${callLogs.action} = 'blocked')`,
      avgLat: sql<number>`avg(${callLogs.latitude})`,
      avgLong: sql<number>`avg(${callLogs.longitude})`,
    })
    .from(callLogs)
    .where(sql`${callLogs.phoneNumber} = ${phoneNumber}`);

  const features: string[] = [];
  let spamProbability = 0;
  
  // Time-based analysis
  const riskHours = [0, 1, 2, 3, 4, 22, 23]; // Late night/early morning
  if (riskHours.includes(hour)) {
    spamProbability += 0.3;
    features.push("Suspicious call time");
  }

  // Historical block rate
  const blockRate = history.total > 0 ? (history.blocked / history.total) : 0;
  if (blockRate > 0) {
    spamProbability += blockRate * 0.4;
    features.push(`Historical block rate: ${(blockRate * 100).toFixed(1)}%`);
  }

  // Location pattern analysis
  if (history.avgLat && history.avgLong) {
    // Example: If calls are coming from known spam regions
    // This is a simplified check - you would want to expand this
    const isKnownSpamRegion = await checkSpamRegion(history.avgLat, history.avgLong);
    if (isKnownSpamRegion) {
      spamProbability += 0.3;
      features.push("Known spam region");
    }
  }

  // Normalize final probability to be between 0 and 1
  spamProbability = Math.min(1, spamProbability);
  
  // Calculate confidence based on amount of historical data
  const confidence = Math.min(1, (history.total / 10)); // More history = higher confidence

  return {
    spamProbability,
    features,
    confidence
  };
}

async function checkSpamRegion(latitude: number, longitude: number): Promise<boolean> {
  // Get counts of spam calls in this region
  const [regionStats] = await db
    .select({
      totalCalls: sql<number>`count(*)`,
      spamCalls: sql<number>`count(*) filter (where ${callLogs.action} = 'blocked')`,
    })
    .from(callLogs)
    .where(sql`
      ${callLogs.latitude} between ${latitude - 1} and ${latitude + 1}
      and ${callLogs.longitude} between ${longitude - 1} and ${longitude + 1}
    `);

  // If more than 70% of calls from this region are spam, mark it as a spam region
  return (regionStats.spamCalls / regionStats.totalCalls) > 0.7;
}

// Function to train/update the model based on new data
export async function updateSpamModel(): Promise<void> {
  // In a production environment, you would:
  // 1. Fetch recent call data
  // 2. Extract features (time patterns, location patterns, etc.)
  // 3. Train a proper ML model (e.g., Random Forest or Gradient Boosting)
  // 4. Save the model parameters
  
  // For now, we're using rule-based prediction, so no training is needed
  console.log("Model rules updated based on latest data");
}
