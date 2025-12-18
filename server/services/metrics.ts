import { db } from "@db";
import { sql } from "drizzle-orm";
import { callLogs } from "@db/schema";

interface MetricData {
  timestamp: Date;
  action: string;
  risk: number;
  confidence: number;
  processingTime?: number;
  breakdown?: Record<string, number>;
}

export class CallScreeningMetrics {
  private static metrics: MetricData[] = [];
  private static readonly MAX_METRICS = 1000;

  // Record a screening result
  static recordScreening(result: any, features: any): void {
    const metric: MetricData = {
      timestamp: new Date(),
      action: result.action,
      risk: result.risk,
      confidence: result.confidence,
      processingTime: result.metadata?.processingTime,
      breakdown: result.breakdown
    };

    this.metrics.push(metric);

    // Keep only recent metrics
    if (this.metrics.length > this.MAX_METRICS) {
      this.metrics = this.metrics.slice(-this.MAX_METRICS);
    }

    // Log significant events
    if (result.action === "blocked" && result.risk > 0.8) {
      console.log(`[HIGH RISK] Blocked call with ${(result.risk * 100).toFixed(1)}% risk`);
    }

    if (result.breakdown) {
      const dominantFactor = Object.entries(result.breakdown)
        .sort(([, a], [, b]) => (b as number) - (a as number))[0];
      
      if (dominantFactor && (dominantFactor[1] as number) > 0.7) {
        console.log(`[DETECTION] Primary factor: ${dominantFactor[0]} (${((dominantFactor[1] as number) * 100).toFixed(1)}%)`);
      }
    }
  }

  // Record errors
  static recordError(error: any): void {
    console.error('[SCREENING ERROR]', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString()
    });
  }

  // Get performance statistics
  static async getPerformanceStats(): Promise<{
    avgProcessingTime: number;
    p95ProcessingTime: number;
    p99ProcessingTime: number;
    totalScreenings: number;
    errorRate: number;
  }> {
    const recentMetrics = this.metrics.filter(m => 
      m.timestamp.getTime() > Date.now() - 3600000 // Last hour
    );

    const processingTimes = recentMetrics
      .map(m => m.processingTime)
      .filter((t): t is number => t !== undefined)
      .sort((a, b) => a - b);

    return {
      avgProcessingTime: processingTimes.length > 0
        ? processingTimes.reduce((a, b) => a + b, 0) / processingTimes.length
        : 0,
      p95ProcessingTime: processingTimes[Math.floor(processingTimes.length * 0.95)] || 0,
      p99ProcessingTime: processingTimes[Math.floor(processingTimes.length * 0.99)] || 0,
      totalScreenings: recentMetrics.length,
      errorRate: 0 // Would need error tracking
    };
  }

  // Get detection accuracy metrics
  static async getDetectionMetrics(): Promise<{
    blockedRate: number;
    allowedRate: number;
    challengeRate: number;
    avgRisk: number;
    avgConfidence: number;
    breakdownAvg: Record<string, number>;
  }> {
    const recentMetrics = this.metrics.filter(m => 
      m.timestamp.getTime() > Date.now() - 86400000 // Last 24 hours
    );

    if (recentMetrics.length === 0) {
      return {
        blockedRate: 0,
        allowedRate: 0,
        challengeRate: 0,
        avgRisk: 0,
        avgConfidence: 0,
        breakdownAvg: {}
      };
    }

    const blocked = recentMetrics.filter(m => m.action === 'blocked').length;
    const allowed = recentMetrics.filter(m => m.action === 'allowed').length;
    const challenged = recentMetrics.filter(m => m.action === 'challenge').length;

    const avgRisk = recentMetrics.reduce((sum, m) => sum + m.risk, 0) / recentMetrics.length;
    const avgConfidence = recentMetrics.reduce((sum, m) => sum + m.confidence, 0) / recentMetrics.length;

    // Calculate average breakdown
    const breakdownAvg: Record<string, number> = {};
    const breakdownKeys = ['regulatory', 'community', 'behavioral', 'voice', 'ml', 'temporal'];
    
    for (const key of breakdownKeys) {
      const values = recentMetrics
        .map(m => m.breakdown?.[key])
        .filter((v): v is number => v !== undefined);
      
      breakdownAvg[key] = values.length > 0
        ? values.reduce((a, b) => a + b, 0) / values.length
        : 0;
    }

    return {
      blockedRate: blocked / recentMetrics.length,
      allowedRate: allowed / recentMetrics.length,
      challengeRate: challenged / recentMetrics.length,
      avgRisk,
      avgConfidence,
      breakdownAvg
    };
  }

  // Get database statistics
  static async getDatabaseStats(): Promise<{
    totalCalls: number;
    callsLast24h: number;
    callsLast7d: number;
    topBlockedReasons: Array<{ reason: string; count: number }>;
  }> {
    const now = new Date();
    const yesterday = new Date(now.getTime() - 86400000);
    const weekAgo = new Date(now.getTime() - 604800000);

    const [totalCalls, callsLast24h, callsLast7d] = await Promise.all([
      db.select({ count: sql<number>`count(*)` }).from(callLogs),
      db.select({ count: sql<number>`count(*)` })
        .from(callLogs)
        .where(sql`${callLogs.timestamp} >= ${yesterday.toISOString()}`),
      db.select({ count: sql<number>`count(*)` })
        .from(callLogs)
        .where(sql`${callLogs.timestamp} >= ${weekAgo.toISOString()}`)
    ]);

    // Get top blocked reasons
    const blockedCalls = await db
      .select({
        reason: sql<string>`${callLogs.metadata}->>'reason'`,
        count: sql<number>`count(*)`
      })
      .from(callLogs)
      .where(sql`${callLogs.action} = 'blocked'`)
      .groupBy(sql`${callLogs.metadata}->>'reason'`)
      .orderBy(sql`count(*) desc`)
      .limit(10);

    return {
      totalCalls: totalCalls[0]?.count || 0,
      callsLast24h: callsLast24h[0]?.count || 0,
      callsLast7d: callsLast7d[0]?.count || 0,
      topBlockedReasons: blockedCalls.map(r => ({
        reason: r.reason || 'Unknown',
        count: r.count || 0
      }))
    };
  }

  // Log comprehensive report
  static async logReport(): Promise<void> {
    const [performance, detection, database] = await Promise.all([
      this.getPerformanceStats(),
      this.getDetectionMetrics(),
      this.getDatabaseStats()
    ]);

    console.log('\n=== Call Screening Performance Report ===');
    console.log(`Processing Time: ${performance.avgProcessingTime.toFixed(2)}ms avg, ${performance.p95ProcessingTime}ms p95`);
    console.log(`Total Screenings (1h): ${performance.totalScreenings}`);
    
    console.log('\n=== Detection Metrics (24h) ===');
    console.log(`Blocked: ${(detection.blockedRate * 100).toFixed(1)}%`);
    console.log(`Allowed: ${(detection.allowedRate * 100).toFixed(1)}%`);
    console.log(`Challenged: ${(detection.challengeRate * 100).toFixed(1)}%`);
    console.log(`Average Risk: ${(detection.avgRisk * 100).toFixed(1)}%`);
    console.log(`Average Confidence: ${(detection.avgConfidence * 100).toFixed(1)}%`);
    
    console.log('\n=== Risk Factor Breakdown ===');
    Object.entries(detection.breakdownAvg).forEach(([key, value]) => {
      console.log(`${key}: ${(value * 100).toFixed(1)}%`);
    });

    console.log('\n=== Database Statistics ===');
    console.log(`Total Calls: ${database.totalCalls}`);
    console.log(`Last 24h: ${database.callsLast24h}`);
    console.log(`Last 7d: ${database.callsLast7d}`);
    
    if (database.topBlockedReasons.length > 0) {
      console.log('\nTop Blocked Reasons:');
      database.topBlockedReasons.slice(0, 5).forEach((r, i) => {
        console.log(`${i + 1}. ${r.reason}: ${r.count} calls`);
      });
    }
    
    console.log('\n=====================================\n');
  }
}

// Schedule periodic reports (call this from a cron job or startup)
export function startMetricsReporting(intervalMs: number = 3600000): void {
  setInterval(() => {
    CallScreeningMetrics.logReport().catch(console.error);
  }, intervalMs);
  
  console.log(`Metrics reporting started (interval: ${intervalMs}ms)`);
}
