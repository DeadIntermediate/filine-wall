/**
 * Real-time Model Update Service
 * Continuously monitors for emerging scam patterns and updates models accordingly
 */

import { EventEmitter } from 'events';
import { logger } from '../utils/logger.js';
import { db } from '@db';
import { callLogs, spamReports } from '@db/schema';
import { sql } from 'drizzle-orm';

interface ScamPattern {
  id: string;
  phonePrefix: string;
  callPattern: string;
  confidence: number;
  firstSeen: Date;
  lastSeen: Date;
  reportCount: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  characteristics: {
    timeOfDay: number[];
    dayOfWeek: number[];
    callDuration: number;
    geographicOrigin?: string;
    voiceCharacteristics?: any;
  };
}

interface ModelUpdateTrigger {
  type: 'new_pattern' | 'pattern_surge' | 'accuracy_drop' | 'false_positive_spike';
  severity: number;
  description: string;
  affectedNumbers: string[];
  timestamp: Date;
}

interface ModelPerformanceMetrics {
  accuracy: number;
  precision: number;
  recall: number;
  f1Score: number;
  falsePositiveRate: number;
  falseNegativeRate: number;
  timestamp: Date;
}

export class RealtimeModelUpdater extends EventEmitter {
  private emergingPatterns = new Map<string, ScamPattern>();
  private performanceHistory: ModelPerformanceMetrics[] = [];
  private updateQueue: ModelUpdateTrigger[] = [];
  private minReportsForPattern = 3;
  private patternWindowHours = 24;
  private performanceCheckInterval = 60 * 60 * 1000; // 1 hour
  private patternDetectionInterval = 5 * 60 * 1000; // 5 minutes
  private emergencyUpdateThreshold = 10; // Reports in 1 hour

  constructor() {
    super();
    this.startMonitoring();
    logger.info('Real-time Model Updater initialized');
  }

  /**
   * Start monitoring for patterns and performance
   */
  private startMonitoring(): void {
    // Monitor for emerging patterns
    setInterval(() => {
      this.detectEmergingPatterns();
    }, this.patternDetectionInterval);

    // Monitor model performance
    setInterval(() => {
      this.checkModelPerformance();
    }, this.performanceCheckInterval);

    // Process update queue
    setInterval(() => {
      this.processUpdateQueue();
    }, 2 * 60 * 1000); // Every 2 minutes

    // Clean old patterns
    setInterval(() => {
      this.cleanOldPatterns();
    }, 6 * 60 * 60 * 1000); // Every 6 hours
  }

  /**
   * Detect emerging scam patterns in real-time
   */
  private async detectEmergingPatterns(): Promise<void> {
    try {
      const windowStart = new Date(Date.now() - this.patternWindowHours * 60 * 60 * 1000);

      // Analyze recent spam reports for patterns
      const recentReports = await db
        .select({
          phoneNumber: spamReports.phoneNumber,
          category: spamReports.category,
          reportedAt: spamReports.reportedAt,
          confirmations: spamReports.confirmations,
          location: spamReports.location
        })
        .from(spamReports)
        .where(sql`${spamReports.reportedAt} >= ${windowStart}`)
        .orderBy(sql`${spamReports.reportedAt} DESC`);

      // Group by phone prefix (first 6 digits)
      const prefixGroups = new Map<string, typeof recentReports>();
      
      for (const report of recentReports) {
        const prefix = report.phoneNumber.substring(0, 6);
        if (!prefixGroups.has(prefix)) {
          prefixGroups.set(prefix, []);
        }
        prefixGroups.get(prefix)!.push(report);
      }

      // Analyze each prefix group for patterns
      for (const [prefix, reports] of prefixGroups.entries()) {
        if (reports.length >= this.minReportsForPattern) {
          await this.analyzePatternGroup(prefix, reports);
        }

        // Check for emergency surge
        if (reports.length >= this.emergencyUpdateThreshold) {
          this.triggerEmergencyUpdate(prefix, reports);
        }
      }

    } catch (error) {
      logger.error('Error detecting emerging patterns:', error);
    }
  }

  /**
   * Analyze a group of reports for pattern characteristics
   */
  private async analyzePatternGroup(
    prefix: string,
    reports: any[]
  ): Promise<void> {
    const patternId = `${prefix}_${Date.now()}`;

    // Extract timing patterns
    const timeOfDay = reports.map(r => new Date(r.reportedAt).getHours());
    const dayOfWeek = reports.map(r => new Date(r.reportedAt).getDay());

    // Get call details from logs
    const callDetails = await db
      .select()
      .from(callLogs)
      .where(sql`${callLogs.phoneNumber} LIKE ${prefix + '%'}`)
      .limit(100);

    const avgDuration = callDetails.reduce((sum, call) => {
      const duration = parseInt(call.duration || '0');
      return sum + duration;
    }, 0) / Math.max(1, callDetails.length);

    // Determine severity based on report frequency and confirmations
    const avgConfirmations = reports.reduce((sum, r) => sum + r.confirmations, 0) / reports.length;
    const reportsPerHour = reports.length / this.patternWindowHours;

    let severity: 'low' | 'medium' | 'high' | 'critical' = 'low';
    if (reportsPerHour > 5 || avgConfirmations > 10) {
      severity = 'critical';
    } else if (reportsPerHour > 2 || avgConfirmations > 5) {
      severity = 'high';
    } else if (reportsPerHour > 1 || avgConfirmations > 2) {
      severity = 'medium';
    }

    const pattern: ScamPattern = {
      id: patternId,
      phonePrefix: prefix,
      callPattern: this.identifyCallPattern(timeOfDay, dayOfWeek),
      confidence: this.calculatePatternConfidence(reports, callDetails),
      firstSeen: new Date(Math.min(...reports.map(r => new Date(r.reportedAt).getTime()))),
      lastSeen: new Date(Math.max(...reports.map(r => new Date(r.reportedAt).getTime()))),
      reportCount: reports.length,
      severity,
      characteristics: {
        timeOfDay: this.getModeValues(timeOfDay),
        dayOfWeek: this.getModeValues(dayOfWeek),
        callDuration: avgDuration,
        geographicOrigin: this.extractGeographicPattern(reports),
      }
    };

    // Check if pattern is new or updated
    const existingPattern = this.emergingPatterns.get(prefix);
    if (!existingPattern || existingPattern.reportCount < pattern.reportCount) {
      this.emergingPatterns.set(prefix, pattern);
      
      logger.info(
        `New/updated scam pattern detected: ${prefix}, ` +
        `severity: ${severity}, reports: ${reports.length}`
      );

      // Queue model update
      this.queueModelUpdate({
        type: existingPattern ? 'pattern_surge' : 'new_pattern',
        severity: severity === 'critical' ? 1.0 : severity === 'high' ? 0.75 : 0.5,
        description: `${severity} severity pattern on prefix ${prefix}`,
        affectedNumbers: reports.map(r => r.phoneNumber),
        timestamp: new Date()
      });

      this.emit('pattern-detected', pattern);
    }
  }

  /**
   * Identify call pattern type
   */
  private identifyCallPattern(timeOfDay: number[], dayOfWeek: number[]): string {
    const patterns: string[] = [];

    // Check for business hours pattern
    const businessHourCalls = timeOfDay.filter(h => h >= 9 && h <= 17).length;
    if (businessHourCalls > timeOfDay.length * 0.8) {
      patterns.push('business_hours');
    }

    // Check for after-hours pattern
    const afterHoursCalls = timeOfDay.filter(h => h < 8 || h > 20).length;
    if (afterHoursCalls > timeOfDay.length * 0.5) {
      patterns.push('after_hours');
    }

    // Check for weekend pattern
    const weekendCalls = dayOfWeek.filter(d => d === 0 || d === 6).length;
    if (weekendCalls > dayOfWeek.length * 0.7) {
      patterns.push('weekend_focused');
    }

    // Check for systematic pattern (same time every day)
    const hourCounts = new Map<number, number>();
    timeOfDay.forEach(h => hourCounts.set(h, (hourCounts.get(h) || 0) + 1));
    const maxHourCount = Math.max(...Array.from(hourCounts.values()));
    if (maxHourCount > timeOfDay.length * 0.5) {
      patterns.push('systematic');
    }

    return patterns.join(',') || 'random';
  }

  /**
   * Calculate pattern confidence
   */
  private calculatePatternConfidence(reports: any[], callDetails: any[]): number {
    let confidence = 0.5;

    // More reports = higher confidence
    confidence += Math.min(0.3, reports.length / 50);

    // More confirmations = higher confidence
    const avgConfirmations = reports.reduce((sum, r) => sum + r.confirmations, 0) / reports.length;
    confidence += Math.min(0.2, avgConfirmations / 20);

    return Math.min(1.0, confidence);
  }

  /**
   * Get mode (most common) values from array
   */
  private getModeValues(arr: number[]): number[] {
    const counts = new Map<number, number>();
    arr.forEach(val => counts.set(val, (counts.get(val) || 0) + 1));
    
    const sorted = Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([val]) => val);

    return sorted;
  }

  /**
   * Extract geographic pattern from reports
   */
  private extractGeographicPattern(reports: any[]): string | undefined {
    const locations = reports
      .map(r => r.location)
      .filter(l => l && typeof l === 'object');

    if (locations.length === 0) return undefined;

    // Extract regions/cities
    const regions = locations
      .map(l => l.city || l.region || l.country)
      .filter(r => r);

    if (regions.length === 0) return undefined;

    // Find most common region
    const regionCounts = new Map<string, number>();
    regions.forEach(r => regionCounts.set(r, (regionCounts.get(r) || 0) + 1));

    const [mostCommon] = Array.from(regionCounts.entries())
      .sort((a, b) => b[1] - a[1])[0] || [];

    return mostCommon;
  }

  /**
   * Trigger emergency model update
   */
  private triggerEmergencyUpdate(prefix: string, reports: any[]): void {
    logger.warn(
      `EMERGENCY: Rapid scam surge detected on prefix ${prefix}, ` +
      `${reports.length} reports in ${this.patternWindowHours} hours`
    );

    this.queueModelUpdate({
      type: 'pattern_surge',
      severity: 1.0,
      description: `Emergency: ${reports.length} reports on prefix ${prefix}`,
      affectedNumbers: reports.map(r => r.phoneNumber),
      timestamp: new Date()
    });

    this.emit('emergency-update', { prefix, reports: reports.length });
  }

  /**
   * Check model performance and trigger updates if degraded
   */
  private async checkModelPerformance(): Promise<void> {
    try {
      // Get recent call logs with user feedback
      const recentCalls = await db
        .select()
        .from(callLogs)
        .where(sql`${callLogs.timestamp} >= NOW() - INTERVAL '1 hour'`)
        .limit(1000);

      if (recentCalls.length < 10) return; // Not enough data

      // Calculate metrics
      const metrics = this.calculatePerformanceMetrics(recentCalls);
      this.performanceHistory.push(metrics);

      // Keep only last 24 hours of metrics
      const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
      this.performanceHistory = this.performanceHistory.filter(
        m => m.timestamp.getTime() > oneDayAgo
      );

      logger.info(
        `Model performance: accuracy=${metrics.accuracy.toFixed(3)}, ` +
        `FPR=${metrics.falsePositiveRate.toFixed(3)}, ` +
        `FNR=${metrics.falseNegativeRate.toFixed(3)}`
      );

      // Check for performance degradation
      if (this.performanceHistory.length >= 3) {
        const recentAvg = this.performanceHistory.slice(-3)
          .reduce((sum, m) => sum + m.accuracy, 0) / 3;
        const historicalAvg = this.performanceHistory.slice(0, -3)
          .reduce((sum, m) => sum + m.accuracy, 0) / Math.max(1, this.performanceHistory.length - 3);

        if (recentAvg < historicalAvg - 0.05) {
          this.queueModelUpdate({
            type: 'accuracy_drop',
            severity: 0.8,
            description: `Accuracy dropped from ${historicalAvg.toFixed(3)} to ${recentAvg.toFixed(3)}`,
            affectedNumbers: [],
            timestamp: new Date()
          });
        }
      }

      // Check for false positive spike
      if (metrics.falsePositiveRate > 0.1) {
        this.queueModelUpdate({
          type: 'false_positive_spike',
          severity: 0.9,
          description: `High false positive rate: ${metrics.falsePositiveRate.toFixed(3)}`,
          affectedNumbers: [],
          timestamp: new Date()
        });
      }

      this.emit('performance-metrics', metrics);

    } catch (error) {
      logger.error('Error checking model performance:', error);
    }
  }

  /**
   * Calculate performance metrics from call logs
   */
  private calculatePerformanceMetrics(calls: any[]): ModelPerformanceMetrics {
    let truePositives = 0;
    let trueNegatives = 0;
    let falsePositives = 0;
    let falseNegatives = 0;

    for (const call of calls) {
      const metadata = call.metadata as any;
      const predicted = call.action === 'blocked';
      const actual = metadata?.userFeedback === 'spam' || metadata?.isSpam === true;

      if (predicted && actual) truePositives++;
      else if (!predicted && !actual) trueNegatives++;
      else if (predicted && !actual) falsePositives++;
      else if (!predicted && actual) falseNegatives++;
    }

    const total = calls.length;
    const accuracy = (truePositives + trueNegatives) / total;
    const precision = truePositives / Math.max(1, truePositives + falsePositives);
    const recall = truePositives / Math.max(1, truePositives + falseNegatives);
    const f1Score = 2 * (precision * recall) / Math.max(0.001, precision + recall);

    return {
      accuracy: isFinite(accuracy) ? accuracy : 0,
      precision: isFinite(precision) ? precision : 0,
      recall: isFinite(recall) ? recall : 0,
      f1Score: isFinite(f1Score) ? f1Score : 0,
      falsePositiveRate: falsePositives / Math.max(1, falsePositives + trueNegatives),
      falseNegativeRate: falseNegatives / Math.max(1, falseNegatives + truePositives),
      timestamp: new Date()
    };
  }

  /**
   * Queue a model update
   */
  private queueModelUpdate(trigger: ModelUpdateTrigger): void {
    this.updateQueue.push(trigger);
    logger.info(`Model update queued: ${trigger.type} (severity: ${trigger.severity})`);
  }

  /**
   * Process queued model updates
   */
  private async processUpdateQueue(): Promise<void> {
    if (this.updateQueue.length === 0) return;

    logger.info(`Processing ${this.updateQueue.length} queued model updates`);

    // Sort by severity
    this.updateQueue.sort((a, b) => b.severity - a.severity);

    // Process high-severity updates immediately
    const criticalUpdates = this.updateQueue.filter(u => u.severity >= 0.8);
    
    if (criticalUpdates.length > 0) {
      this.emit('critical-updates-pending', criticalUpdates);
      
      // Trigger immediate model retraining
      this.triggerModelRetraining(criticalUpdates);
    }

    // Clear processed updates
    this.updateQueue = this.updateQueue.filter(u => u.severity < 0.8);
  }

  /**
   * Trigger model retraining with new patterns
   */
  private triggerModelRetraining(updates: ModelUpdateTrigger[]): void {
    logger.info(`Triggering model retraining with ${updates.length} critical updates`);

    const retrainingData = {
      updates,
      emergingPatterns: Array.from(this.emergingPatterns.values()),
      timestamp: new Date()
    };

    this.emit('model-retraining-triggered', retrainingData);
  }

  /**
   * Clean old patterns
   */
  private cleanOldPatterns(): void {
    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000; // 7 days
    
    for (const [prefix, pattern] of this.emergingPatterns.entries()) {
      if (pattern.lastSeen.getTime() < cutoff) {
        this.emergingPatterns.delete(prefix);
        logger.info(`Cleaned old pattern: ${prefix}`);
      }
    }
  }

  /**
   * Get emerging patterns
   */
  getEmergingPatterns(): ScamPattern[] {
    return Array.from(this.emergingPatterns.values())
      .sort((a, b) => b.reportCount - a.reportCount);
  }

  /**
   * Get performance history
   */
  getPerformanceHistory(): ModelPerformanceMetrics[] {
    return [...this.performanceHistory];
  }

  /**
   * Get update queue
   */
  getUpdateQueue(): ModelUpdateTrigger[] {
    return [...this.updateQueue];
  }
}

export default RealtimeModelUpdater;
