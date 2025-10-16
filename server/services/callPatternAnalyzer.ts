/**
 * Behavioral Call Pattern Analysis
 * Detects suspicious calling patterns using machine learning and statistical analysis
 */

import { logger } from '../utils/logger.js';
import { CallLog } from '../db/schema.js';

interface CallPattern {
    phoneNumber: string;
    callTimes: Date[];
    duration: number[];
    frequency: number;
    timeSpread: number;
    callingWindowPattern: string;
    volumeAnomaly: number;
    sequentialityScore: number;
}

interface BehaviorAnalysis {
    riskScore: number;
    suspiciousPatterns: string[];
    confidence: number;
    reasoning: string;
    blockedRecommendation: boolean;
}

interface CallTimeWindow {
    hour: number;
    dayOfWeek: number;
    count: number;
}

export class CallPatternAnalyzer {
    private patternCache = new Map<string, CallPattern>();
    private anomalyThresholds = {
        highVolumeCallsPerHour: 10,
        suspiciousSequentialCalls: 5,
        abnormalTimeSpread: 2, // hours
        robocallVolumeSpike: 20
    };

    constructor() {
        this.initializeAnalyzer();
    }

    private initializeAnalyzer(): void {
        logger.info('Initializing call pattern analyzer');
        
        // Load known scammer patterns from database
        this.loadKnownScammerPatterns();
        
        // Set up periodic pattern analysis
        setInterval(() => {
            this.performPeriodicAnalysis();
        }, 5 * 60 * 1000); // Every 5 minutes
    }

    /**
     * Analyze a new incoming call for suspicious patterns
     */
    async analyzeCallPattern(
        phoneNumber: string, 
        timestamp: Date,
        callDuration?: number
    ): Promise<BehaviorAnalysis> {
        try {
            // Update pattern cache with new call
            await this.updateCallPattern(phoneNumber, timestamp, callDuration);
            
            // Get current pattern for this number
            const pattern = this.patternCache.get(phoneNumber);
            if (!pattern) {
                return this.createLowRiskAnalysis('Insufficient call history');
            }

            // Perform comprehensive pattern analysis
            const analysis = await this.performPatternAnalysis(pattern);
            
            // Check against known scammer patterns
            const scammerAnalysis = await this.checkScammerPatterns(pattern);
            
            // Combine analyses
            const finalAnalysis = this.combineAnalyses(analysis, scammerAnalysis);
            
            // Log high-risk patterns
            if (finalAnalysis.riskScore > 0.7) {
                logger.warn(`High-risk calling pattern detected for ${phoneNumber}:`, {
                    riskScore: finalAnalysis.riskScore,
                    patterns: finalAnalysis.suspiciousPatterns
                });
            }
            
            return finalAnalysis;
            
        } catch (error) {
            logger.error(`Call pattern analysis failed for ${phoneNumber}:`, error as Error);
            return this.createLowRiskAnalysis('Analysis failed');
        }
    }

    /**
     * Update call pattern cache with new call data
     */
    private async updateCallPattern(
        phoneNumber: string, 
        timestamp: Date, 
        duration?: number
    ): Promise<void> {
        let pattern = this.patternCache.get(phoneNumber);
        
        if (!pattern) {
            // Get historical call data for this number
            const historicalCalls = await this.getHistoricalCalls(phoneNumber);
            
            pattern = {
                phoneNumber,
                callTimes: [],
                duration: [],
                frequency: 0,
                timeSpread: 0,
                callingWindowPattern: '',
                volumeAnomaly: 0,
                sequentialityScore: 0
            };
            
            // Populate with historical data
            historicalCalls.forEach(call => {
                pattern!.callTimes.push(new Date(call.timestamp));
                if (call.duration) {
                    pattern!.duration.push(call.duration);
                }
            });
        }
        
        // Add new call
        pattern.callTimes.push(timestamp);
        if (duration !== undefined) {
            pattern.duration.push(duration);
        }
        
        // Keep only recent calls (last 30 days)
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        pattern.callTimes = pattern.callTimes.filter(time => time >= thirtyDaysAgo);
        
        // Update calculated fields
        this.recalculatePatternMetrics(pattern);
        
        // Update cache
        this.patternCache.set(phoneNumber, pattern);
    }

    /**
     * Recalculate pattern metrics
     */
    private recalculatePatternMetrics(pattern: CallPattern): void {
        const calls = pattern.callTimes;
        
        if (calls.length === 0) return;
        
        // Calculate frequency (calls per day)
        const timeSpan = calls.length > 1 
            ? (calls[calls.length - 1].getTime() - calls[0].getTime()) / (1000 * 60 * 60 * 24)
            : 1;
        pattern.frequency = calls.length / Math.max(timeSpan, 1);
        
        // Calculate time spread (hours between first and last call in a day)
        pattern.timeSpread = this.calculateTimeSpread(calls);
        
        // Analyze calling window pattern
        pattern.callingWindowPattern = this.analyzeCallingWindows(calls);
        
        // Calculate volume anomaly score
        pattern.volumeAnomaly = this.calculateVolumeAnomaly(calls);
        
        // Calculate sequentiality score (how sequential/robotic the calls are)
        pattern.sequentialityScore = this.calculateSequentialityScore(calls);
    }

    /**
     * Perform comprehensive pattern analysis
     */
    private async performPatternAnalysis(pattern: CallPattern): Promise<BehaviorAnalysis> {
        const suspiciousPatterns: string[] = [];
        let riskScore = 0;
        let reasoning = '';

        // High frequency analysis
        if (pattern.frequency > 5) { // More than 5 calls per day
            suspiciousPatterns.push('high_frequency_calling');
            riskScore += 0.3;
            reasoning += `Extremely high call frequency (${pattern.frequency.toFixed(1)} calls/day). `;
        } else if (pattern.frequency > 2) {
            suspiciousPatterns.push('elevated_frequency');
            riskScore += 0.1;
            reasoning += `Elevated call frequency detected. `;
        }

        // Time pattern analysis
        if (pattern.timeSpread < 2) {
            suspiciousPatterns.push('narrow_time_window');
            riskScore += 0.2;
            reasoning += 'Calls concentrated in narrow time window. ';
        }

        // Volume anomaly detection
        if (pattern.volumeAnomaly > 0.7) {
            suspiciousPatterns.push('volume_spike_anomaly');
            riskScore += 0.4;
            reasoning += 'Sudden spike in call volume detected. ';
        }

        // Sequential calling pattern (robocall indicator)
        if (pattern.sequentialityScore > 0.8) {
            suspiciousPatterns.push('robotic_calling_pattern');
            riskScore += 0.5;
            reasoning += 'Highly sequential calling pattern suggests automated system. ';
        }

        // Business hours analysis
        const businessHoursScore = this.analyzeBusinessHours(pattern.callTimes);
        if (businessHoursScore > 0.8) {
            suspiciousPatterns.push('business_hours_pattern');
            riskScore += 0.2;
            reasoning += 'Calls predominantly during business hours (telemarketing indicator). ';
        }

        // Weekend calling analysis
        const weekendScore = this.analyzeWeekendCalling(pattern.callTimes);
        if (weekendScore > 0.5) {
            suspiciousPatterns.push('weekend_calling');
            riskScore += 0.3;
            reasoning += 'Frequent weekend calling suggests telemarketing activity. ';
        }

        // Duration analysis (if available)
        if (pattern.duration.length > 0) {
            const avgDuration = pattern.duration.reduce((sum, d) => sum + d, 0) / pattern.duration.length;
            if (avgDuration < 5) { // Very short calls
                suspiciousPatterns.push('short_duration_calls');
                riskScore += 0.2;
                reasoning += 'Consistently short call durations suggest robocalls. ';
            }
        }

        // Call clustering analysis
        const clusterScore = this.analyzeCallClustering(pattern.callTimes);
        if (clusterScore > 0.7) {
            suspiciousPatterns.push('clustered_calling');
            riskScore += 0.3;
            reasoning += 'Calls occur in distinct clusters suggesting campaign-based activity. ';
        }

        return {
            riskScore: Math.min(riskScore, 1.0),
            suspiciousPatterns,
            confidence: Math.min(pattern.callTimes.length / 10, 1.0), // More calls = higher confidence
            reasoning: reasoning.trim() || 'Pattern analysis completed.',
            blockedRecommendation: riskScore > 0.6
        };
    }

    /**
     * Check against known scammer patterns
     */
    private async checkScammerPatterns(pattern: CallPattern): Promise<Partial<BehaviorAnalysis>> {
        const suspiciousPatterns: string[] = [];
        let riskScore = 0;
        let reasoning = '';

        // Check for number spoofing patterns
        if (this.detectNumberSpoofing(pattern.phoneNumber)) {
            suspiciousPatterns.push('number_spoofing');
            riskScore += 0.6;
            reasoning += 'Number shows signs of spoofing. ';
        }

        // Check for known scammer area codes
        if (this.isKnownScammerAreaCode(pattern.phoneNumber)) {
            suspiciousPatterns.push('scammer_area_code');
            riskScore += 0.3;
            reasoning += 'Number from area code frequently used by scammers. ';
        }

        // Check for carrier-based patterns
        const carrierAnalysis = await this.analyzeCarrierPatterns(pattern.phoneNumber);
        if (carrierAnalysis.suspicious) {
            suspiciousPatterns.push('suspicious_carrier');
            riskScore += carrierAnalysis.riskIncrease;
            reasoning += carrierAnalysis.reasoning;
        }

        return {
            riskScore,
            suspiciousPatterns,
            reasoning
        };
    }

    /**
     * Calculate time spread of calls
     */
    private calculateTimeSpread(calls: Date[]): number {
        if (calls.length === 0) return 0;
        
        const hours = calls.map(call => call.getHours());
        const minHour = Math.min(...hours);
        const maxHour = Math.max(...hours);
        
        return maxHour - minHour;
    }

    /**
     * Analyze calling window patterns
     */
    private analyzeCallingWindows(calls: Date[]): string {
        const windows: CallTimeWindow[] = [];
        
        calls.forEach(call => {
            const hour = call.getHours();
            const dayOfWeek = call.getDay();
            
            let window = windows.find(w => w.hour === hour && w.dayOfWeek === dayOfWeek);
            if (!window) {
                window = { hour, dayOfWeek, count: 0 };
                windows.push(window);
            }
            window.count++;
        });
        
        // Analyze patterns
        const businessHours = windows.filter(w => w.hour >= 9 && w.hour <= 17);
        const totalBusinessCalls = businessHours.reduce((sum, w) => sum + w.count, 0);
        const businessRatio = totalBusinessCalls / calls.length;
        
        if (businessRatio > 0.8) return 'business_hours_concentrated';
        if (businessRatio < 0.2) return 'off_hours_concentrated';
        return 'mixed_hours';
    }

    /**
     * Calculate volume anomaly score
     */
    private calculateVolumeAnomaly(calls: Date[]): number {
        if (calls.length < 7) return 0; // Need at least a week of data
        
        // Group calls by day
        const dailyCounts = new Map<string, number>();
        calls.forEach(call => {
            const day = call.toDateString();
            dailyCounts.set(day, (dailyCounts.get(day) || 0) + 1);
        });
        
        const counts = Array.from(dailyCounts.values());
        const mean = counts.reduce((sum, count) => sum + count, 0) / counts.length;
        const variance = counts.reduce((sum, count) => sum + Math.pow(count - mean, 2), 0) / counts.length;
        const stdDev = Math.sqrt(variance);
        
        // Check for outliers (days with unusually high call volume)
        const outliers = counts.filter(count => count > mean + 2 * stdDev);
        
        return outliers.length / counts.length;
    }

    /**
     * Calculate sequentiality score (how robotic/systematic the calls are)
     */
    private calculateSequentialityScore(calls: Date[]): number {
        if (calls.length < 3) return 0;
        
        let sequentialityScore = 0;
        
        // Check for regular intervals
        const intervals: number[] = [];
        for (let i = 1; i < calls.length; i++) {
            const interval = calls[i].getTime() - calls[i - 1].getTime();
            intervals.push(interval);
        }
        
        // Calculate interval consistency
        if (intervals.length > 1) {
            const meanInterval = intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length;
            const intervalVariance = intervals.reduce((sum, interval) => 
                sum + Math.pow(interval - meanInterval, 2), 0) / intervals.length;
            
            // Low variance = high sequentiality
            const normalizedVariance = intervalVariance / Math.pow(meanInterval, 2);
            sequentialityScore += Math.max(0, 1 - normalizedVariance);
        }
        
        // Check for time-of-day consistency
        const hours = calls.map(call => call.getHours());
        const uniqueHours = new Set(hours).size;
        const hourConsistency = 1 - (uniqueHours / 24);
        sequentialityScore += hourConsistency * 0.5;
        
        return Math.min(sequentialityScore, 1.0);
    }

    /**
     * Analyze business hours calling pattern
     */
    private analyzeBusinessHours(calls: Date[]): number {
        const businessHoursCalls = calls.filter(call => {
            const hour = call.getHours();
            const day = call.getDay();
            return hour >= 9 && hour <= 17 && day >= 1 && day <= 5;
        });
        
        return businessHoursCalls.length / calls.length;
    }

    /**
     * Analyze weekend calling patterns
     */
    private analyzeWeekendCalling(calls: Date[]): number {
        const weekendCalls = calls.filter(call => {
            const day = call.getDay();
            return day === 0 || day === 6; // Sunday or Saturday
        });
        
        return weekendCalls.length / calls.length;
    }

    /**
     * Analyze call clustering patterns
     */
    private analyzeCallClustering(calls: Date[]): number {
        if (calls.length < 5) return 0;
        
        // Sort calls by time
        const sortedCalls = [...calls].sort((a, b) => a.getTime() - b.getTime());
        
        // Find clusters (calls within 1 hour of each other)
        const clusters: Date[][] = [];
        let currentCluster: Date[] = [sortedCalls[0]];
        
        for (let i = 1; i < sortedCalls.length; i++) {
            const timeDiff = sortedCalls[i].getTime() - sortedCalls[i - 1].getTime();
            const hoursDiff = timeDiff / (1000 * 60 * 60);
            
            if (hoursDiff <= 1) {
                currentCluster.push(sortedCalls[i]);
            } else {
                clusters.push(currentCluster);
                currentCluster = [sortedCalls[i]];
            }
        }
        clusters.push(currentCluster);
        
        // Calculate clustering score
        const clusteredCalls = clusters.filter(cluster => cluster.length > 1)
            .reduce((sum, cluster) => sum + cluster.length, 0);
        
        return clusteredCalls / calls.length;
    }

    /**
     * Detect number spoofing patterns
     */
    private detectNumberSpoofing(phoneNumber: string): boolean {
        // Check for suspicious number patterns
        const digits = phoneNumber.replace(/\D/g, '');
        
        // Sequential numbers (123456789, 987654321)
        if (this.isSequentialNumber(digits)) return true;
        
        // Repeating patterns (111-111-1111, 123-123-1234)
        if (this.isRepeatingPattern(digits)) return true;
        
        // Local number spoofing (same area code as user)
        // This would require user's location context
        
        return false;
    }

    /**
     * Check if number is from known scammer area codes
     */
    private isKnownScammerAreaCode(phoneNumber: string): boolean {
        const knownScammerAreaCodes = [
            '876', '473', '649', '284', '246', '441', // Caribbean scam areas
            '917', '347', '646', // NYC area codes often spoofed
            '712', '605', '641'  // Conference call scam numbers
        ];
        
        const areaCode = phoneNumber.replace(/\D/g, '').substring(0, 3);
        return knownScammerAreaCodes.includes(areaCode);
    }

    // Utility methods
    private isSequentialNumber(digits: string): boolean {
        for (let i = 1; i < digits.length; i++) {
            const diff = parseInt(digits[i]) - parseInt(digits[i - 1]);
            if (Math.abs(diff) !== 1) return false;
        }
        return true;
    }

    private isRepeatingPattern(digits: string): boolean {
        // Check for repeating digit patterns
        const uniqueDigits = new Set(digits).size;
        return uniqueDigits <= 3; // Too few unique digits
    }

    private createLowRiskAnalysis(reason: string): BehaviorAnalysis {
        return {
            riskScore: 0.1,
            suspiciousPatterns: [],
            confidence: 0.5,
            reasoning: reason,
            blockedRecommendation: false
        };
    }

    private combineAnalyses(analysis1: BehaviorAnalysis, analysis2: Partial<BehaviorAnalysis>): BehaviorAnalysis {
        return {
            riskScore: Math.min((analysis1.riskScore + (analysis2.riskScore || 0)), 1.0),
            suspiciousPatterns: [...analysis1.suspiciousPatterns, ...(analysis2.suspiciousPatterns || [])],
            confidence: analysis1.confidence,
            reasoning: `${analysis1.reasoning} ${analysis2.reasoning || ''}`.trim(),
            blockedRecommendation: analysis1.blockedRecommendation || (analysis2.riskScore || 0) > 0.6
        };
    }

    // Placeholder methods (implement with real database queries)
    private async getHistoricalCalls(phoneNumber: string): Promise<CallLog[]> {
        // Implement database query to get historical calls
        return [];
    }

    private loadKnownScammerPatterns(): void {
        // Load known scammer patterns from database or external sources
        logger.info('Loading known scammer patterns...');
    }

    private performPeriodicAnalysis(): void {
        // Perform periodic analysis of all patterns
        logger.debug('Performing periodic call pattern analysis');
    }

    private async analyzeCarrierPatterns(phoneNumber: string): Promise<{
        suspicious: boolean;
        riskIncrease: number;
        reasoning: string;
    }> {
        // Implement carrier analysis
        return {
            suspicious: false,
            riskIncrease: 0,
            reasoning: ''
        };
    }

    /**
     * Get analytics for dashboard
     */
    getAnalytics(): any {
        return {
            totalPatternsTracked: this.patternCache.size,
            highRiskPatterns: Array.from(this.patternCache.values())
                .filter(pattern => pattern.volumeAnomaly > 0.7 || pattern.sequentialityScore > 0.8).length,
            anomalyThresholds: this.anomalyThresholds
        };
    }

    /**
     * Clear old patterns from cache
     */
    clearOldPatterns(): void {
        const cutoffDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days ago
        
        for (const [phoneNumber, pattern] of this.patternCache.entries()) {
            if (pattern.callTimes.length === 0 || 
                pattern.callTimes[pattern.callTimes.length - 1] < cutoffDate) {
                this.patternCache.delete(phoneNumber);
            }
        }
    }
}

export default CallPatternAnalyzer;