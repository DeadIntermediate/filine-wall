/**
 * Example Integration: Complete Call Screening with All ML/AI Features + External APIs
 * This demonstrates how all the advanced features work together
 */

import SpamNumberAPIService from './services/spamNumberAPIs';
import FCCSpamDatabaseService from './services/fccSpamDatabase';
import CallPatternAnalyzer from './services/callPatternAnalyzer';
import AdvancedVoiceAnalysis from './services/advancedVoiceAnalysis';
import CollaborativeThreatIntelligence from './services/collaborativeThreatIntelligence';
import AdaptiveLearningEngine from './services/adaptiveLearningEngine';
import HoneypotSystem from './services/honeypotSystem';
import { logger } from './utils/logger';

interface CallScreeningResult {
    action: 'BLOCK' | 'ALLOW' | 'CHALLENGE';
    confidence: number;
    reasons: string[];
    riskScore: number;
    detectionSources: string[];
    recommendedAction: string;
}

export class MasterCallScreeningEngine {
    private spamAPI: SpamNumberAPIService;
    private fccDatabase: FCCSpamDatabaseService;
    private patternAnalyzer: CallPatternAnalyzer;
    private voiceAnalysis: AdvancedVoiceAnalysis;
    private threatIntel: CollaborativeThreatIntelligence;
    private learningEngine: AdaptiveLearningEngine;
    private honeypot: HoneypotSystem;

    constructor() {
        // Initialize all AI/ML services
        this.spamAPI = new SpamNumberAPIService();
        this.fccDatabase = new FCCSpamDatabaseService();
        this.patternAnalyzer = new CallPatternAnalyzer();
        this.voiceAnalysis = new AdvancedVoiceAnalysis();
        this.threatIntel = new CollaborativeThreatIntelligence();
        this.learningEngine = new AdaptiveLearningEngine();
        this.honeypot = new HoneypotSystem();

        logger.info('Master Call Screening Engine initialized with all AI/ML features');
    }

    /**
     * Comprehensive multi-layer call screening
     * Combines all AI/ML features + external APIs for maximum protection
     */
    async screenIncomingCall(
        phoneNumber: string,
        userId: string,
        audioStream?: any
    ): Promise<CallScreeningResult> {
        logger.info(`Screening incoming call from ${phoneNumber} for user ${userId}`);

        const reasons: string[] = [];
        const detectionSources: string[] = [];
        let totalRiskScore = 0;
        let confidence = 0;

        try {
            // LAYER 1: Quick local database check (instant)
            const localCheck = await this.checkLocalDatabase(phoneNumber);
            if (localCheck.isBlocked) {
                return {
                    action: 'BLOCK',
                    confidence: 1.0,
                    reasons: ['Number in local blocklist'],
                    riskScore: 1.0,
                    detectionSources: ['Local Database'],
                    recommendedAction: 'Block immediately - known spammer'
                };
            }

            // LAYER 2: FCC Government Database (free, authoritative)
            const fccResult = await this.fccDatabase.checkNumber(phoneNumber);
            if (fccResult.inDatabase) {
                totalRiskScore += fccResult.riskScore * 0.25; // 25% weight
                confidence += 0.15;
                detectionSources.push('FCC Database');
                
                if (fccResult.riskScore > 0.7) {
                    reasons.push(`FCC enforcement action: ${fccResult.details}`);
                }
            }

            // LAYER 3: External Spam APIs (multiple sources)
            const apiResult = await this.spamAPI.checkNumber(phoneNumber);
            if (apiResult.sources.length > 0) {
                totalRiskScore += apiResult.confidence * 0.3; // 30% weight
                confidence += 0.2;
                detectionSources.push(...apiResult.sources);
                
                if (apiResult.isSpam) {
                    reasons.push(
                        `Reported as spam by ${apiResult.sources.length} source(s): ${apiResult.details}`
                    );
                }
            }

            // LAYER 4: Community Threat Intelligence (real-time network)
            const threatData = await this.threatIntel.checkThreat(phoneNumber);
            if (threatData.isThreat) {
                totalRiskScore += threatData.riskScore * 0.2; // 20% weight
                confidence += 0.15;
                detectionSources.push('Community Network');
                
                reasons.push(
                    `Community alert: ${threatData.reportCount} reports from ${threatData.userCount} users`
                );
            }

            // LAYER 5: Behavioral Pattern Analysis (statistical ML)
            const patternResult = await this.patternAnalyzer.analyzeCallPattern(
                phoneNumber,
                new Date()
            );
            if (patternResult.riskScore > 0.5) {
                totalRiskScore += patternResult.riskScore * 0.15; // 15% weight
                confidence += 0.15;
                detectionSources.push('Pattern Analysis');
                
                if (patternResult.suspiciousPatterns.length > 0) {
                    reasons.push(
                        `Suspicious patterns: ${patternResult.reasoning}`
                    );
                }
            }

            // LAYER 6: Honeypot Intelligence (proactive discovery)
            const honeypotData = await this.honeypot.checkAgainstHoneypotData(phoneNumber);
            if (honeypotData.wasDetected) {
                totalRiskScore += 0.8; // High weight - honeypot detection is strong signal
                confidence += 0.2;
                detectionSources.push('Honeypot System');
                
                reasons.push(
                    `Honeypot detection: ${honeypotData.detectedCampaigns.join(', ')}`
                );
            }

            // LAYER 7: Voice Analysis (if audio available)
            if (audioStream) {
                const voiceResult = await this.voiceAnalysis.analyzeVoice(audioStream);
                if (voiceResult.isRobocall) {
                    totalRiskScore += voiceResult.confidence * 0.1; // 10% weight
                    confidence += 0.1;
                    detectionSources.push('Voice Analysis');
                    
                    reasons.push(
                        `Voice analysis: ${voiceResult.reasoning} (${(voiceResult.confidence * 100).toFixed(1)}% confidence)`
                    );
                }
            }

            // LAYER 8: Personal Learning Engine (individual AI)
            const personalResult = await this.learningEngine.predictCallAction(
                userId,
                phoneNumber,
                {
                    hour: new Date().getHours(),
                    dayOfWeek: new Date().getDay(),
                    hasVoicemail: false,
                    callDuration: 0
                }
            );
            
            // Personal learning gets moderate weight but high influence
            totalRiskScore += personalResult.shouldBlock ? 0.2 : -0.1;
            confidence += 0.05;
            detectionSources.push('Personal AI');
            
            if (personalResult.shouldBlock) {
                reasons.push(
                    `Personal AI learned preference: ${personalResult.reasoning}`
                );
            }

            // FINAL DECISION: Aggregate all layers
            const finalRiskScore = Math.min(totalRiskScore, 1.0);
            const finalConfidence = Math.min(confidence, 1.0);

            // Determine action based on risk score
            let action: 'BLOCK' | 'ALLOW' | 'CHALLENGE';
            let recommendedAction: string;

            if (finalRiskScore >= 0.7) {
                action = 'BLOCK';
                recommendedAction = 'Block call - high spam probability';
            } else if (finalRiskScore >= 0.4) {
                action = 'CHALLENGE';
                recommendedAction = 'Challenge with IVR - moderate risk';
            } else {
                action = 'ALLOW';
                recommendedAction = 'Allow call - low spam probability';
            }

            // Log decision
            logger.info(`Call screening decision for ${phoneNumber}:`, {
                action,
                riskScore: finalRiskScore,
                confidence: finalConfidence,
                sources: detectionSources,
                reasons
            });

            // If call was allowed or challenged, learn from user's eventual response
            this.scheduleUserFeedbackLearning(userId, phoneNumber, action);

            return {
                action,
                confidence: finalConfidence,
                reasons: reasons.length > 0 ? reasons : ['No spam indicators detected'],
                riskScore: finalRiskScore,
                detectionSources,
                recommendedAction
            };

        } catch (error) {
            logger.error(`Error screening call from ${phoneNumber}:`, error as Error);
            
            // Fail-safe: allow call if screening fails
            return {
                action: 'ALLOW',
                confidence: 0,
                reasons: ['Screening system error - call allowed by default'],
                riskScore: 0,
                detectionSources: [],
                recommendedAction: 'System error - allowing call'
            };
        }
    }

    /**
     * Quick local database check
     */
    private async checkLocalDatabase(phoneNumber: string): Promise<{
        isBlocked: boolean;
        reason?: string;
    }> {
        // Check user's personal blocklist
        // Check system-wide blocklist
        // This would query your PostgreSQL database
        return { isBlocked: false };
    }

    /**
     * Schedule learning from user feedback
     */
    private scheduleUserFeedbackLearning(
        userId: string,
        phoneNumber: string,
        initialAction: string
    ): void {
        // After call ends, check if user:
        // - Blocked the number manually
        // - Reported as spam
        // - Answered and spoke
        // - Ignored/sent to voicemail
        
        // Then train the personal learning engine
        setTimeout(async () => {
            // This would be triggered by actual user action
            // For now, just a placeholder
            logger.debug(`Will learn from user feedback for ${phoneNumber}`);
        }, 60000); // Check after 1 minute
    }

    /**
     * Bulk screen multiple numbers (e.g., for call log analysis)
     */
    async screenBulk(
        phoneNumbers: string[],
        userId: string
    ): Promise<Map<string, CallScreeningResult>> {
        const results = new Map<string, CallScreeningResult>();
        
        logger.info(`Bulk screening ${phoneNumbers.length} numbers for user ${userId}`);
        
        // Process in parallel with concurrency limit
        const concurrency = 5;
        for (let i = 0; i < phoneNumbers.length; i += concurrency) {
            const batch = phoneNumbers.slice(i, i + concurrency);
            const batchResults = await Promise.all(
                batch.map(num => this.screenIncomingCall(num, userId))
            );
            
            batch.forEach((num, index) => {
                results.set(num, batchResults[index]);
            });
        }
        
        return results;
    }

    /**
     * Get comprehensive system statistics
     */
    getSystemStats(): any {
        return {
            spamAPI: this.spamAPI.getStats(),
            fccDatabase: this.fccDatabase.getStats(),
            patternAnalyzer: this.patternAnalyzer.getAnalytics(),
            threatIntel: this.threatIntel.getNetworkStats(),
            learningEngine: this.learningEngine.getStats(),
            honeypot: this.honeypot.getStats()
        };
    }

    /**
     * Report spam to all systems (user feedback loop)
     */
    async reportSpam(
        userId: string,
        phoneNumber: string,
        category: string,
        description?: string
    ): Promise<void> {
        logger.info(`User ${userId} reported spam: ${phoneNumber}`);

        // Report to community threat intelligence
        await this.threatIntel.reportThreat(userId, phoneNumber, {
            category,
            description: description || 'User reported spam',
            timestamp: new Date()
        });

        // Train personal learning engine
        await this.learningEngine.trainModel(userId, phoneNumber, {
            userBlocked: true,
            userAnswered: false,
            reportedSpam: true
        });

        // Add to local blocklist
        // This would insert into your database
        logger.info(`Added ${phoneNumber} to blocklist based on user report`);
    }
}

export default MasterCallScreeningEngine;

/**
 * Example Usage:
 * 
 * const screeningEngine = new MasterCallScreeningEngine();
 * 
 * // Screen incoming call
 * const result = await screeningEngine.screenIncomingCall(
 *     '(555) 123-4567',
 *     'user-123',
 *     audioStream  // optional
 * );
 * 
 * console.log(result);
 * // {
 * //   action: 'BLOCK',
 * //   confidence: 0.92,
 * //   reasons: [
 * //     'FCC enforcement action: Illegal robocalls',
 * //     'Reported as spam by 3 sources',
 * //     'Community alert: 142 reports from 89 users',
 * //     'Suspicious patterns: High call frequency detected',
 * //     'Voice analysis: Robocall detected (95.3% confidence)'
 * //   ],
 * //   riskScore: 0.89,
 * //   detectionSources: ['FCC Database', 'NumLookup', 'ShouldIAnswer', 
 * //                     'Community Network', 'Pattern Analysis', 'Voice Analysis'],
 * //   recommendedAction: 'Block call - high spam probability'
 * // }
 * 
 * if (result.action === 'BLOCK') {
 *     // Block the call
 *     modem.hangup();
 *     logger.info(`Blocked spam call: ${result.reasons.join('; ')}`);
 * }
 */
