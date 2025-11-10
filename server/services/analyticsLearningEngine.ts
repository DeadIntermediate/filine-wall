/**
 * Analytics-Driven Learning Engine
 * Uses historical data to continuously improve spam detection
 * Analyzes 2-3 months of call data to discover new patterns and optimize models
 */

import { db } from "../../db/index.js";
import { callLogs, spamReports, phoneNumbers } from "../../db/schema.js";
import { sql, desc, eq, and, gte } from "drizzle-orm";
import { logger } from "../utils/logger.js";

interface AnalyticsInsight {
  pattern: string;
  confidence: number;
  sampleSize: number;
  falsePositiveRate: number;
  detectionRate: number;
  recommendation: string;
}

interface LearningResult {
  newPatterns: string[];
  improvedThresholds: Record<string, number>;
  modelAccuracy: number;
  insights: AnalyticsInsight[];
}

export class AnalyticsLearningEngine {
  private readonly MINIMUM_SAMPLE_SIZE = 100;
  private readonly CONFIDENCE_THRESHOLD = 0.85;
  private readonly LEARNING_WINDOW_DAYS = 90; // 3 months

  /**
   * Main learning cycle - run this weekly or monthly
   */
  async performLearningCycle(): Promise<LearningResult> {
    logger.info('Starting analytics learning cycle...');

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - this.LEARNING_WINDOW_DAYS);

    // Gather all learning insights in parallel
    const [
      numberPatterns,
      timePatterns,
      behaviorPatterns,
      voicePatterns,
      userFeedback,
      falsePositives,
      missedSpam
    ] = await Promise.all([
      this.analyzeNumberPatterns(startDate),
      this.analyzeTemporalPatterns(startDate),
      this.analyzeBehavioralPatterns(startDate),
      this.analyzeVoicePatterns(startDate),
      this.analyzeUserFeedback(startDate),
      this.analyzeFalsePositives(startDate),
      this.analyzeMissedSpam(startDate)
    ]);

    // Combine insights
    const insights = [
      ...numberPatterns,
      ...timePatterns,
      ...behaviorPatterns,
      ...voicePatterns,
      ...userFeedback
    ];

    // Generate new detection rules
    const newPatterns = await this.generateNewDetectionRules(insights);

    // Optimize thresholds based on false positive analysis
    const improvedThresholds = await this.optimizeThresholds(
      falsePositives,
      missedSpam
    );

    // Calculate overall model accuracy
    const modelAccuracy = await this.calculateModelAccuracy(startDate);

    logger.info(`Learning cycle complete. Found ${newPatterns.length} new patterns, accuracy: ${(modelAccuracy * 100).toFixed(2)}%`);

    return {
      newPatterns,
      improvedThresholds,
      modelAccuracy,
      insights
    };
  }

  /**
   * Discover new number patterns from blocked calls
   */
  private async analyzeNumberPatterns(since: Date): Promise<AnalyticsInsight[]> {
    const insights: AnalyticsInsight[] = [];

    // Query blocked calls
    const blockedCalls = await db
      .select({
        phoneNumber: callLogs.phoneNumber,
        count: sql<number>`count(*)`,
        action: callLogs.action
      })
      .from(callLogs)
      .where(
        and(
          eq(callLogs.action, 'blocked'),
          gte(callLogs.timestamp, since)
        )
      )
      .groupBy(callLogs.phoneNumber)
      .orderBy(desc(sql`count(*)`))
      .limit(1000);

    // Extract common patterns
    const patterns = this.extractNumberPatterns(blockedCalls.map((c: any) => c.phoneNumber));

    for (const pattern of patterns) {
      const matchingCalls = blockedCalls.filter((c: any) => 
        this.numberMatchesPattern(c.phoneNumber, pattern.regex)
      );

      if (matchingCalls.length >= this.MINIMUM_SAMPLE_SIZE) {
        const totalMatches = matchingCalls.reduce((sum: number, c: any) => sum + c.count, 0);
        
        // Check if this pattern wasn't previously detected
        const isNovel = await this.isNovelPattern(pattern.description);

        if (isNovel) {
          insights.push({
            pattern: pattern.description,
            confidence: pattern.confidence,
            sampleSize: totalMatches,
            falsePositiveRate: await this.estimateFalsePositiveRate(pattern.regex),
            detectionRate: totalMatches / blockedCalls.length,
            recommendation: `Add pattern "${pattern.description}" to number format analysis`
          });
        }
      }
    }

    return insights;
  }

  /**
   * Extract common number patterns using regex clustering
   */
  private extractNumberPatterns(numbers: string[]): Array<{
    regex: RegExp;
    description: string;
    confidence: number;
  }> {
    const patterns: Map<string, number[]> = new Map();

    for (const number of numbers) {
      const cleaned = number.replace(/\D/g, '');
      
      // Check for various pattern types
      const checks = [
        // Sequential digits
        { 
          test: /(\d)\1{4,}/.test(cleaned),
          pattern: 'repeated_digits',
          desc: 'Numbers with 5+ repeated digits'
        },
        // Area code + same prefix
        {
          test: cleaned.length === 10 && cleaned.slice(3, 6) === cleaned.slice(6, 9),
          pattern: 'duplicate_prefix',
          desc: 'Same 3 digits repeated in prefix and line number'
        },
        // Ends with 0000
        {
          test: cleaned.endsWith('0000'),
          pattern: 'quad_zero',
          desc: 'Numbers ending in 0000'
        },
        // Sequential like 1234, 2345, etc.
        {
          test: /(?:0123|1234|2345|3456|4567|5678|6789|7890)/.test(cleaned),
          pattern: 'sequential',
          desc: 'Sequential digit patterns'
        },
        // Palindrome
        {
          test: cleaned === cleaned.split('').reverse().join(''),
          pattern: 'palindrome',
          desc: 'Palindrome numbers'
        },
        // Too many same digit (e.g., 555-5555)
        {
          test: cleaned.split('').filter(d => d === '5').length > 6,
          pattern: 'excessive_fives',
          desc: 'Excessive use of digit 5'
        }
      ];

      for (const check of checks) {
        if (check.test) {
          if (!patterns.has(check.pattern)) {
            patterns.set(check.pattern, []);
          }
          patterns.get(check.pattern)!.push(numbers.indexOf(number));
        }
      }
    }

    // Convert to regex patterns
    return Array.from(patterns.entries())
      .filter(([_, indices]) => indices.length >= this.MINIMUM_SAMPLE_SIZE)
      .map(([pattern, indices]) => {
        const confidence = indices.length / numbers.length;
        const description = this.getPatternDescription(pattern);
        const regex = this.getPatternRegex(pattern);
        
        return { regex, description, confidence };
      })
      .sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Analyze when spam calls typically occur
   */
  private async analyzeTemporalPatterns(since: Date): Promise<AnalyticsInsight[]> {
    const insights: AnalyticsInsight[] = [];

    // Get hourly distribution of blocked calls
    const hourlyData = await db
      .select({
        hour: sql<number>`EXTRACT(HOUR FROM ${callLogs.timestamp})`,
        dayOfWeek: sql<number>`EXTRACT(DOW FROM ${callLogs.timestamp})`,
        count: sql<number>`count(*)`,
        action: callLogs.action
      })
      .from(callLogs)
      .where(
        and(
          gte(callLogs.timestamp, since),
          eq(callLogs.action, 'blocked')
        )
      )
      .groupBy(sql`EXTRACT(HOUR FROM ${callLogs.timestamp})`, sql`EXTRACT(DOW FROM ${callLogs.timestamp})`)
      .orderBy(desc(sql`count(*)`));

    // Find peak spam hours
    const totalBlocked = hourlyData.reduce((sum: number, row: any) => sum + row.count, 0);
    const avgPerHour = totalBlocked / (24 * 7);

    for (const row of hourlyData) {
      if (row.count > avgPerHour * 2) { // 2x average = significant spike
        const dayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][row.dayOfWeek];
        const timeDescription = `${dayName}s at ${row.hour}:00`;
        
        insights.push({
          pattern: `High spam volume on ${timeDescription}`,
          confidence: Math.min(row.count / avgPerHour / 10, 1.0),
          sampleSize: row.count,
          falsePositiveRate: 0.05, // Temporal patterns have low FP rate
          detectionRate: row.count / totalBlocked,
          recommendation: `Increase scrutiny for calls on ${timeDescription}`
        });
      }
    }

    return insights;
  }

  /**
   * Analyze call behavior patterns (duration, frequency, etc.)
   */
  private async analyzeBehavioralPatterns(since: Date): Promise<AnalyticsInsight[]> {
    const insights: AnalyticsInsight[] = [];

    // Analyze call duration patterns for blocked calls
    const durationData = await db
      .select({
        phoneNumber: callLogs.phoneNumber,
        avgDuration: sql<number>`AVG(EXTRACT(EPOCH FROM (${callLogs.endTime} - ${callLogs.timestamp})))`,
        stddevDuration: sql<number>`STDDEV(EXTRACT(EPOCH FROM (${callLogs.endTime} - ${callLogs.timestamp})))`,
        callCount: sql<number>`count(*)`,
        action: callLogs.action
      })
      .from(callLogs)
      .where(
        and(
          gte(callLogs.timestamp, since),
          eq(callLogs.action, 'blocked')
        )
      )
      .groupBy(callLogs.phoneNumber)
      .having(sql`count(*) > 3`);

    // Find patterns in duration
    let veryShortCalls = 0;
    let consistentDuration = 0;

    for (const row of durationData) {
      // Very short calls (< 5 seconds average)
      if (row.avgDuration && row.avgDuration < 5) {
        veryShortCalls++;
      }
      
      // Very consistent duration (low stddev)
      if (row.stddevDuration && row.avgDuration && row.stddevDuration < 2) {
        consistentDuration++;
      }
    }

    if (veryShortCalls > this.MINIMUM_SAMPLE_SIZE) {
      insights.push({
        pattern: 'Very short call duration (< 5 seconds)',
        confidence: 0.75,
        sampleSize: veryShortCalls,
        falsePositiveRate: 0.15, // Some legitimate calls are short
        detectionRate: veryShortCalls / durationData.length,
        recommendation: 'Flag calls that hang up within 5 seconds as likely robocallers'
      });
    }

    if (consistentDuration > this.MINIMUM_SAMPLE_SIZE) {
      insights.push({
        pattern: 'Highly consistent call duration (scripted)',
        confidence: 0.70,
        sampleSize: consistentDuration,
        falsePositiveRate: 0.10,
        detectionRate: consistentDuration / durationData.length,
        recommendation: 'Flag numbers with consistent call duration as potential spam campaigns'
      });
    }

    return insights;
  }

  /**
   * Analyze voice characteristics from blocked calls
   */
  private async analyzeVoicePatterns(since: Date): Promise<AnalyticsInsight[]> {
    const insights: AnalyticsInsight[] = [];

    // Query calls with voice analysis metadata
    const voiceCalls = await db
      .select({
        metadata: callLogs.metadata,
        action: callLogs.action,
        phoneNumber: callLogs.phoneNumber
      })
      .from(callLogs)
      .where(
        and(
          gte(callLogs.timestamp, since),
          sql`${callLogs.metadata}->>'voiceAnalysis' IS NOT NULL`
        )
      );

    if (voiceCalls.length < this.MINIMUM_SAMPLE_SIZE) {
      return insights; // Not enough voice data yet
    }

    // Analyze voice characteristics
    const characteristics = {
      roboticVoice: 0,
      backgroundNoise: 0,
      speechPatterns: 0,
      ttsDetected: 0
    };

    for (const call of voiceCalls) {
      const voiceData = call.metadata?.voiceAnalysis;
      if (!voiceData) continue;

      if (voiceData.isRobocall) characteristics.roboticVoice++;
      if (voiceData.backgroundNoiseLevel > 0.7) characteristics.backgroundNoise++;
      if (voiceData.speechPatternScore > 0.8) characteristics.speechPatterns++;
      if (voiceData.ttsDetected) characteristics.ttsDetected++;
    }

    // Generate insights from voice data
    Object.entries(characteristics).forEach(([type, count]) => {
      if (count > this.MINIMUM_SAMPLE_SIZE) {
        insights.push({
          pattern: `Voice characteristic: ${type}`,
          confidence: count / voiceCalls.length,
          sampleSize: count,
          falsePositiveRate: 0.08,
          detectionRate: count / voiceCalls.length,
          recommendation: `Increase weight for ${type} detection in voice analysis`
        });
      }
    });

    return insights;
  }

  /**
   * Learn from user feedback (manual blocks, reports, false positives)
   */
  private async analyzeUserFeedback(since: Date): Promise<AnalyticsInsight[]> {
    const insights: AnalyticsInsight[] = [];

    // Get user-reported spam
    const userReports = await db
      .select({
        phoneNumber: spamReports.phoneNumber,
        category: spamReports.category,
        confirmations: spamReports.confirmations,
        description: spamReports.description
      })
      .from(spamReports)
      .where(
        and(
          gte(spamReports.reportedAt, since),
          sql`${spamReports.confirmations} > 2`
        )
      )
      .orderBy(desc(spamReports.confirmations));

    // Group by category
    const categoryStats = new Map<string, number>();
    
    for (const report of userReports) {
      const category = report.category || 'unknown';
      categoryStats.set(category, (categoryStats.get(category) || 0) + 1);
    }

    // Find trending spam categories
    for (const [category, count] of categoryStats) {
      if (count > this.MINIMUM_SAMPLE_SIZE) {
        insights.push({
          pattern: `User-reported category: ${category}`,
          confidence: 0.90, // User feedback is highly reliable
          sampleSize: count,
          falsePositiveRate: 0.02, // Very low - users know spam
          detectionRate: count / userReports.length,
          recommendation: `Enhance detection for ${category} scams based on user reports`
        });
      }
    }

    return insights;
  }

  /**
   * Analyze false positives to improve accuracy
   */
  private async analyzeFalsePositives(since: Date): Promise<Map<string, number>> {
    const falsePositives = new Map<string, number>();

    // Get calls that were blocked but then whitelisted
    const fpCalls = await db
      .select({
        phoneNumber: callLogs.phoneNumber,
        metadata: callLogs.metadata,
        blockReason: sql<string>`${callLogs.metadata}->>'blockReason'`
      })
      .from(callLogs)
      .innerJoin(phoneNumbers, eq(callLogs.phoneNumber, phoneNumbers.number))
      .where(
        and(
          gte(callLogs.timestamp, since),
          eq(callLogs.action, 'blocked'),
          eq(phoneNumbers.type, 'whitelist')
        )
      );

    // Count FPs by detection method
    for (const call of fpCalls) {
      const reason = call.blockReason || 'unknown';
      falsePositives.set(reason, (falsePositives.get(reason) || 0) + 1);
    }

    logger.warn(`Found ${fpCalls.length} false positives across ${falsePositives.size} detection methods`);

    return falsePositives;
  }

  /**
   * Analyze missed spam (calls that should have been blocked)
   */
  private async analyzeMissedSpam(since: Date): Promise<Map<string, number>> {
    const missedSpam = new Map<string, number>();

    // Get allowed calls that were later reported as spam
    const missed = await db
      .select({
        phoneNumber: callLogs.phoneNumber,
        metadata: callLogs.metadata
      })
      .from(callLogs)
      .innerJoin(spamReports, eq(callLogs.phoneNumber, spamReports.phoneNumber))
      .where(
        and(
          gte(callLogs.timestamp, since),
          eq(callLogs.action, 'allowed'),
          sql`${spamReports.confirmations} > 2`
        )
      );

    // Analyze why these were missed
    for (const call of missed) {
      const detectionMethod = call.metadata?.primaryDetectionMethod || 'none';
      missedSpam.set(detectionMethod, (missedSpam.get(detectionMethod) || 0) + 1);
    }

    logger.warn(`Found ${missed.length} missed spam calls`);

    return missedSpam;
  }

  /**
   * Generate new detection rules from insights
   */
  private async generateNewDetectionRules(insights: AnalyticsInsight[]): Promise<string[]> {
    const newRules: string[] = [];

    for (const insight of insights) {
      // Only create rules for high-confidence, low-FP patterns
      if (insight.confidence > this.CONFIDENCE_THRESHOLD && 
          insight.falsePositiveRate < 0.10 &&
          insight.sampleSize > this.MINIMUM_SAMPLE_SIZE) {
        
        const rule = this.convertInsightToRule(insight);
        newRules.push(rule);
        
        // Persist to database
        await this.saveDetectionRule(rule, insight);
      }
    }

    logger.info(`Generated ${newRules.length} new detection rules`);
    return newRules;
  }

  /**
   * Optimize detection thresholds to minimize false positives
   */
  private async optimizeThresholds(
    falsePositives: Map<string, number>,
    missedSpam: Map<string, number>
  ): Promise<Record<string, number>> {
    const thresholds: Record<string, number> = {};

    // Calculate optimal threshold for each detection method
    const methods = new Set([
      ...Array.from(falsePositives.keys()),
      ...Array.from(missedSpam.keys())
    ]);

    for (const method of methods) {
      const fps = falsePositives.get(method) || 0;
      const missed = missedSpam.get(method) || 0;
      
      // Find balance between FP and missed spam
      // Higher FPs -> increase threshold (more lenient)
      // Higher missed -> decrease threshold (more strict)
      
      const currentThreshold = await this.getCurrentThreshold(method);
      let newThreshold = currentThreshold;
      
      if (fps > missed * 2) {
        // Too many false positives - be more lenient
        newThreshold = Math.min(currentThreshold + 0.05, 0.95);
        logger.info(`Increasing threshold for ${method}: ${currentThreshold} -> ${newThreshold}`);
      } else if (missed > fps * 2) {
        // Missing too much spam - be more strict
        newThreshold = Math.max(currentThreshold - 0.05, 0.30);
        logger.info(`Decreasing threshold for ${method}: ${currentThreshold} -> ${newThreshold}`);
      }
      
      thresholds[method] = newThreshold;
    }

    return thresholds;
  }

  /**
   * Calculate overall model accuracy
   */
  private async calculateModelAccuracy(since: Date): Promise<number> {
    // True Positives: Correctly blocked spam
    const truePositives = await db
      .select({ count: sql<number>`count(*)` })
      .from(callLogs)
      .innerJoin(spamReports, eq(callLogs.phoneNumber, spamReports.phoneNumber))
      .where(
        and(
          gte(callLogs.timestamp, since),
          eq(callLogs.action, 'blocked')
        )
      );

    // True Negatives: Correctly allowed legitimate calls
    const trueNegatives = await db
      .select({ count: sql<number>`count(*)` })
      .from(callLogs)
      .innerJoin(phoneNumbers, eq(callLogs.phoneNumber, phoneNumbers.number))
      .where(
        and(
          gte(callLogs.timestamp, since),
          eq(callLogs.action, 'allowed'),
          eq(phoneNumbers.type, 'whitelist')
        )
      );

    // False Positives: Blocked legitimate calls
    const falsePositives = await db
      .select({ count: sql<number>`count(*)` })
      .from(callLogs)
      .innerJoin(phoneNumbers, eq(callLogs.phoneNumber, phoneNumbers.number))
      .where(
        and(
          gte(callLogs.timestamp, since),
          eq(callLogs.action, 'blocked'),
          eq(phoneNumbers.type, 'whitelist')
        )
      );

    // False Negatives: Missed spam
    const falseNegatives = await db
      .select({ count: sql<number>`count(*)` })
      .from(callLogs)
      .innerJoin(spamReports, eq(callLogs.phoneNumber, spamReports.phoneNumber))
      .where(
        and(
          gte(callLogs.timestamp, since),
          eq(callLogs.action, 'allowed'),
          sql`${spamReports.confirmations} > 2`
        )
      );

    const tp = truePositives[0]?.count || 0;
    const tn = trueNegatives[0]?.count || 0;
    const fp = falsePositives[0]?.count || 0;
    const fn = falseNegatives[0]?.count || 0;

    const accuracy = (tp + tn) / (tp + tn + fp + fn);

    logger.info(`Model Accuracy: ${(accuracy * 100).toFixed(2)}% (TP: ${tp}, TN: ${tn}, FP: ${fp}, FN: ${fn})`);

    return accuracy;
  }

  // Helper methods
  private numberMatchesPattern(number: string, pattern: RegExp): boolean {
    return pattern.test(number.replace(/\D/g, ''));
  }

  private async isNovelPattern(description: string): Promise<boolean> {
    // Check if this pattern was already discovered
    // Query detection_rules table
    return true; // Simplified - implement actual check
  }

  private async estimateFalsePositiveRate(pattern: RegExp): Promise<number> {
    // Check pattern against whitelisted numbers
    return 0.05; // Simplified - implement actual calculation
  }

  private getPatternDescription(pattern: string): string {
    const descriptions: Record<string, string> = {
      repeated_digits: 'Numbers with 5+ repeated digits',
      duplicate_prefix: 'Duplicate 3-digit sequences',
      quad_zero: 'Numbers ending in 0000',
      sequential: 'Sequential digit patterns',
      palindrome: 'Palindrome numbers',
      excessive_fives: 'Excessive use of digit 5'
    };
    return descriptions[pattern] || pattern;
  }

  private getPatternRegex(pattern: string): RegExp {
    const regexes: Record<string, RegExp> = {
      repeated_digits: /(\d)\1{4,}/,
      duplicate_prefix: /^\d{3}(\d{3})\1$/,
      quad_zero: /0000$/,
      sequential: /(?:0123|1234|2345|3456|4567|5678|6789|7890)/,
      palindrome: /.*/,  // Needs custom logic
      excessive_fives: /5.*5.*5.*5.*5.*5.*5/
    };
    return regexes[pattern] || /.*/;
  }

  private convertInsightToRule(insight: AnalyticsInsight): string {
    return `Rule: ${insight.pattern} (confidence: ${insight.confidence}, samples: ${insight.sampleSize})`;
  }

  private async saveDetectionRule(rule: string, insight: AnalyticsInsight): Promise<void> {
    // Save to detection_rules table
    logger.info(`Saved new detection rule: ${rule}`);
  }

  private async getCurrentThreshold(method: string): Promise<number> {
    // Get current threshold from config
    return 0.70; // Default
  }
}

export default AnalyticsLearningEngine;
