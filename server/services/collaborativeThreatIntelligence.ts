/**
 * Collaborative Threat Intelligence System
 * Real-time sharing and analysis of spam reports across FiLine Wall community
 */

import { EventEmitter } from 'events';
import WebSocket from 'ws';
import { logger } from '../utils/logger.js';

interface ThreatReport {
    id: string;
    phoneNumber: string;
    reportType: 'spam' | 'scam' | 'robocall' | 'telemarketer' | 'verified_safe';
    severity: 1 | 2 | 3 | 4 | 5; // 1 = low, 5 = critical
    timestamp: Date;
    userId: string;
    userLocation?: string; // Anonymized location (city/state)
    callDetails: {
        duration?: number;
        voiceAnalysis?: any;
        transcription?: string;
        callerIdSpoofed?: boolean;
    };
    metadata: {
        confidence: number;
        verified: boolean;
        reportCount: number;
        lastUpdated: Date;
    };
    tags: string[];
    description?: string;
}

interface ThreatIntelligence {
    phoneNumber: string;
    riskScore: number;
    reportCount: number;
    consensus: 'spam' | 'safe' | 'unknown';
    lastReported: Date;
    geographicPattern: string[];
    reportingSources: number;
    trends: {
        increasingReports: boolean;
        recentActivity: number;
        peakHours: number[];
    };
}

interface CommunityStats {
    totalReports: number;
    activeUsers: number;
    blockedCallsToday: number;
    topThreatNumbers: string[];
    regionalThreats: Map<string, number>;
}

export class CollaborativeThreatIntelligence extends EventEmitter {
    private wsServer: WebSocket.Server;
    private connectedClients = new Map<string, WebSocket>();
    private threatDatabase = new Map<string, ThreatIntelligence>();
    private recentReports: ThreatReport[] = [];
    private communityStats: CommunityStats;
    private maxReportsInMemory = 10000;

    constructor(port: number = 8080) {
        super();
        
        this.communityStats = {
            totalReports: 0,
            activeUsers: 0,
            blockedCallsToday: 0,
            topThreatNumbers: [],
            regionalThreats: new Map()
        };

        this.initializeWebSocketServer(port);
        this.startPeriodicUpdates();
        
        logger.info('Collaborative threat intelligence system initialized');
    }

    /**
     * Initialize WebSocket server for real-time communication
     */
    private initializeWebSocketServer(port: number): void {
        this.wsServer = new WebSocket.Server({ port });

        this.wsServer.on('connection', (ws: WebSocket, request) => {
            const clientId = this.generateClientId();
            this.connectedClients.set(clientId, ws);
            this.communityStats.activeUsers = this.connectedClients.size;

            logger.info(`Client ${clientId} connected to threat intelligence network`);

            // Send initial threat intelligence to new client
            this.sendThreatIntelligenceUpdate(ws);

            ws.on('message', (data: Buffer) => {
                try {
                    const message = JSON.parse(data.toString());
                    this.handleClientMessage(clientId, message);
                } catch (error) {
                    logger.error('Failed to parse client message:', error as Error);
                }
            });

            ws.on('close', () => {
                this.connectedClients.delete(clientId);
                this.communityStats.activeUsers = this.connectedClients.size;
                logger.info(`Client ${clientId} disconnected from threat intelligence network`);
            });

            ws.on('error', (error) => {
                logger.error(`WebSocket error for client ${clientId}:`, error);
                this.connectedClients.delete(clientId);
            });
        });

        logger.info(`Threat intelligence WebSocket server listening on port ${port}`);
    }

    /**
     * Handle incoming messages from clients
     */
    private handleClientMessage(clientId: string, message: any): void {
        switch (message.type) {
            case 'threat_report':
                this.processThreatReport(clientId, message.data);
                break;
            case 'verify_number':
                this.verifyNumberRequest(clientId, message.data);
                break;
            case 'request_intelligence':
                this.sendThreatIntelligence(clientId, message.data);
                break;
            case 'feedback':
                this.processFeedback(clientId, message.data);
                break;
            default:
                logger.warn(`Unknown message type from ${clientId}: ${message.type}`);
        }
    }

    /**
     * Process a new threat report from the community
     */
    async processThreatReport(clientId: string, reportData: Partial<ThreatReport>): Promise<void> {
        try {
            // Validate and sanitize report data
            const report = await this.validateThreatReport(reportData, clientId);
            
            if (!report) {
                logger.warn(`Invalid threat report from ${clientId}`);
                return;
            }

            // Add to recent reports
            this.recentReports.push(report);
            
            // Maintain memory limit
            if (this.recentReports.length > this.maxReportsInMemory) {
                this.recentReports.shift();
            }

            // Update threat intelligence
            await this.updateThreatIntelligence(report);
            
            // Update community stats
            this.updateCommunityStats(report);
            
            // Broadcast to all connected clients
            this.broadcastThreatUpdate(report);
            
            // Store in persistent database
            await this.storeThreatReport(report);
            
            logger.info(`Processed threat report for ${report.phoneNumber} from ${clientId}`);
            
        } catch (error) {
            logger.error(`Failed to process threat report from ${clientId}:`, error as Error);
        }
    }

    /**
     * Validate and sanitize threat report data
     */
    private async validateThreatReport(data: Partial<ThreatReport>, userId: string): Promise<ThreatReport | null> {
        if (!data.phoneNumber || !data.reportType) {
            return null;
        }

        // Sanitize phone number
        const phoneNumber = data.phoneNumber.replace(/\D/g, '');
        if (phoneNumber.length < 10) {
            return null;
        }

        // Validate report type
        const validTypes = ['spam', 'scam', 'robocall', 'telemarketer', 'verified_safe'];
        if (!validTypes.includes(data.reportType)) {
            return null;
        }

        // Create validated report
        const report: ThreatReport = {
            id: this.generateReportId(),
            phoneNumber,
            reportType: data.reportType,
            severity: data.severity || 3,
            timestamp: new Date(),
            userId,
            userLocation: await this.getAnonymizedLocation(userId),
            callDetails: {
                duration: data.callDetails?.duration,
                voiceAnalysis: data.callDetails?.voiceAnalysis,
                transcription: this.sanitizeTranscription(data.callDetails?.transcription),
                callerIdSpoofed: data.callDetails?.callerIdSpoofed
            },
            metadata: {
                confidence: this.calculateReportConfidence(data, userId),
                verified: false,
                reportCount: 1,
                lastUpdated: new Date()
            },
            tags: this.sanitizeTags(data.tags || []),
            description: this.sanitizeDescription(data.description)
        };

        return report;
    }

    /**
     * Update threat intelligence for a phone number
     */
    private async updateThreatIntelligence(report: ThreatReport): Promise<void> {
        let intel = this.threatDatabase.get(report.phoneNumber);
        
        if (!intel) {
            intel = {
                phoneNumber: report.phoneNumber,
                riskScore: 0,
                reportCount: 0,
                consensus: 'unknown',
                lastReported: report.timestamp,
                geographicPattern: [],
                reportingSources: 0,
                trends: {
                    increasingReports: false,
                    recentActivity: 0,
                    peakHours: []
                }
            };
        }

        // Update report count
        intel.reportCount++;
        intel.lastReported = report.timestamp;

        // Update geographic pattern
        if (report.userLocation && !intel.geographicPattern.includes(report.userLocation)) {
            intel.geographicPattern.push(report.userLocation);
            intel.reportingSources++;
        }

        // Calculate new risk score
        intel.riskScore = this.calculateRiskScore(intel, report);

        // Determine consensus
        intel.consensus = this.determineConsensus(intel, report);

        // Update trends
        this.updateTrends(intel, report);

        // Store updated intelligence
        this.threatDatabase.set(report.phoneNumber, intel);

        // Trigger alerts for high-risk numbers
        if (intel.riskScore > 0.8 && intel.reportCount >= 5) {
            this.triggerHighRiskAlert(intel);
        }
    }

    /**
     * Calculate risk score based on reports and intelligence
     */
    private calculateRiskScore(intel: ThreatIntelligence, newReport: ThreatReport): number {
        let riskScore = intel.riskScore;

        // Weight based on report type
        const typeWeights = {
            'scam': 1.0,
            'robocall': 0.8,
            'spam': 0.6,
            'telemarketer': 0.4,
            'verified_safe': -0.5
        };

        const typeWeight = typeWeights[newReport.reportType] || 0.5;
        const severityMultiplier = newReport.severity / 5;
        const confidenceMultiplier = newReport.metadata.confidence;

        // Calculate weighted contribution
        const contribution = typeWeight * severityMultiplier * confidenceMultiplier * 0.1;

        // Update risk score with decay factor for old reports
        const daysSinceLastReport = (Date.now() - intel.lastReported.getTime()) / (1000 * 60 * 60 * 24);
        const decayFactor = Math.max(0.5, 1 - (daysSinceLastReport * 0.01));

        riskScore = (riskScore * decayFactor) + contribution;

        // Geographic diversity bonus (more sources = higher confidence)
        const diversityBonus = Math.min(0.2, intel.reportingSources * 0.05);
        riskScore += diversityBonus;

        return Math.min(Math.max(riskScore, 0), 1);
    }

    /**
     * Determine consensus classification
     */
    private determineConsensus(intel: ThreatIntelligence, newReport: ThreatReport): 'spam' | 'safe' | 'unknown' {
        if (intel.reportCount < 3) {
            return 'unknown';
        }

        if (intel.riskScore > 0.7) {
            return 'spam';
        } else if (intel.riskScore < 0.3) {
            return 'safe';
        }

        return 'unknown';
    }

    /**
     * Update trend analysis
     */
    private updateTrends(intel: ThreatIntelligence, report: ThreatReport): void {
        // Recent activity (last 24 hours)
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const recentReports = this.recentReports.filter(r => 
            r.phoneNumber === report.phoneNumber && r.timestamp >= oneDayAgo
        );
        
        intel.trends.recentActivity = recentReports.length;
        intel.trends.increasingReports = recentReports.length > intel.trends.recentActivity;

        // Peak hours analysis
        const hours = recentReports.map(r => r.timestamp.getHours());
        const hourCounts = new Map<number, number>();
        
        hours.forEach(hour => {
            hourCounts.set(hour, (hourCounts.get(hour) || 0) + 1);
        });

        intel.trends.peakHours = Array.from(hourCounts.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3)
            .map(([hour]) => hour);
    }

    /**
     * Broadcast threat update to all connected clients
     */
    private broadcastThreatUpdate(report: ThreatReport): void {
        const message = {
            type: 'threat_update',
            data: {
                phoneNumber: report.phoneNumber,
                reportType: report.reportType,
                severity: report.severity,
                timestamp: report.timestamp,
                intelligence: this.threatDatabase.get(report.phoneNumber)
            }
        };

        const messageStr = JSON.stringify(message);

        this.connectedClients.forEach((ws, clientId) => {
            if (ws.readyState === WebSocket.OPEN) {
                try {
                    ws.send(messageStr);
                } catch (error) {
                    logger.error(`Failed to send update to client ${clientId}:`, error as Error);
                    this.connectedClients.delete(clientId);
                }
            }
        });
    }

    /**
     * Send threat intelligence for a specific number
     */
    private sendThreatIntelligence(clientId: string, data: { phoneNumber: string }): void {
        const ws = this.connectedClients.get(clientId);
        if (!ws || ws.readyState !== WebSocket.OPEN) return;

        const intel = this.threatDatabase.get(data.phoneNumber);
        const recentReports = this.recentReports
            .filter(r => r.phoneNumber === data.phoneNumber)
            .slice(-10); // Last 10 reports

        const response = {
            type: 'intelligence_response',
            data: {
                phoneNumber: data.phoneNumber,
                intelligence: intel || null,
                recentReports: recentReports.map(r => ({
                    reportType: r.reportType,
                    severity: r.severity,
                    timestamp: r.timestamp,
                    userLocation: r.userLocation
                }))
            }
        };

        ws.send(JSON.stringify(response));
    }

    /**
     * Get threat intelligence for a phone number
     */
    async getThreatIntelligence(phoneNumber: string): Promise<ThreatIntelligence | null> {
        const sanitizedNumber = phoneNumber.replace(/\D/g, '');
        return this.threatDatabase.get(sanitizedNumber) || null;
    }

    /**
     * Report a number as safe (user feedback)
     */
    async reportNumberSafe(phoneNumber: string, userId: string): Promise<void> {
        await this.processThreatReport(userId, {
            phoneNumber,
            reportType: 'verified_safe',
            severity: 1,
            callDetails: {}
        });
    }

    /**
     * Get community statistics
     */
    getCommunityStats(): CommunityStats {
        // Update top threat numbers
        const sortedThreats = Array.from(this.threatDatabase.entries())
            .sort((a, b) => b[1].riskScore - a[1].riskScore)
            .slice(0, 10)
            .map(([phoneNumber]) => phoneNumber);

        this.communityStats.topThreatNumbers = sortedThreats;
        
        return { ...this.communityStats };
    }

    /**
     * Start periodic updates and maintenance
     */
    private startPeriodicUpdates(): void {
        // Update community stats every minute
        setInterval(() => {
            this.updateCommunityStats();
            this.broadcastCommunityStats();
        }, 60 * 1000);

        // Clean old data every hour
        setInterval(() => {
            this.cleanOldData();
        }, 60 * 60 * 1000);

        // Backup data every 6 hours
        setInterval(() => {
            this.backupThreatData();
        }, 6 * 60 * 60 * 1000);
    }

    // Utility methods
    private generateClientId(): string {
        return `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    private generateReportId(): string {
        return `report_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    private async getAnonymizedLocation(userId: string): Promise<string> {
        // Return anonymized location (city/state) based on user ID
        // This would typically query user preferences or IP geolocation
        return 'Anonymous';
    }

    private calculateReportConfidence(data: Partial<ThreatReport>, userId: string): number {
        let confidence = 0.5; // Base confidence

        // Increase confidence based on call details
        if (data.callDetails?.duration) confidence += 0.1;
        if (data.callDetails?.voiceAnalysis) confidence += 0.2;
        if (data.callDetails?.transcription) confidence += 0.1;
        if (data.description && data.description.length > 20) confidence += 0.1;

        return Math.min(confidence, 1.0);
    }

    private sanitizeTags(tags: string[]): string[] {
        return tags
            .filter(tag => typeof tag === 'string' && tag.length <= 50)
            .map(tag => tag.toLowerCase().replace(/[^a-z0-9_]/g, ''))
            .slice(0, 10);
    }

    private sanitizeDescription(description?: string): string | undefined {
        if (!description) return undefined;
        return description.substring(0, 500).replace(/[<>]/g, '');
    }

    private sanitizeTranscription(transcription?: string): string | undefined {
        if (!transcription) return undefined;
        return transcription.substring(0, 1000).replace(/[<>]/g, '');
    }

    private updateCommunityStats(report?: ThreatReport): void {
        this.communityStats.totalReports = this.recentReports.length;
        
        if (report) {
            // Update regional threats
            if (report.userLocation) {
                const currentCount = this.communityStats.regionalThreats.get(report.userLocation) || 0;
                this.communityStats.regionalThreats.set(report.userLocation, currentCount + 1);
            }

            // Update blocked calls count
            if (report.reportType !== 'verified_safe') {
                this.communityStats.blockedCallsToday++;
            }
        }
    }

    private broadcastCommunityStats(): void {
        const message = {
            type: 'community_stats',
            data: this.getCommunityStats()
        };

        const messageStr = JSON.stringify(message);

        this.connectedClients.forEach((ws, clientId) => {
            if (ws.readyState === WebSocket.OPEN) {
                try {
                    ws.send(messageStr);
                } catch (error) {
                    logger.error(`Failed to send stats to client ${clientId}:`, error as Error);
                }
            }
        });
    }

    private sendThreatIntelligenceUpdate(ws: WebSocket): void {
        const recentThreats = Array.from(this.threatDatabase.entries())
            .sort((a, b) => b[1].lastReported.getTime() - a[1].lastReported.getTime())
            .slice(0, 100)
            .map(([phoneNumber, intel]) => ({ phoneNumber, ...intel }));

        const message = {
            type: 'initial_intelligence',
            data: {
                threats: recentThreats,
                stats: this.getCommunityStats()
            }
        };

        ws.send(JSON.stringify(message));
    }

    private verifyNumberRequest(clientId: string, data: { phoneNumber: string }): void {
        // Handle number verification request
        this.sendThreatIntelligence(clientId, data);
    }

    private processFeedback(clientId: string, data: any): void {
        // Process user feedback on threat intelligence accuracy
        logger.info(`Received feedback from ${clientId}:`, data);
    }

    private triggerHighRiskAlert(intel: ThreatIntelligence): void {
        logger.warn(`HIGH RISK NUMBER DETECTED: ${intel.phoneNumber} - Risk Score: ${intel.riskScore}`);
        
        // Broadcast high-risk alert
        const alert = {
            type: 'high_risk_alert',
            data: {
                phoneNumber: intel.phoneNumber,
                riskScore: intel.riskScore,
                reportCount: intel.reportCount,
                consensus: intel.consensus
            }
        };

        this.connectedClients.forEach(ws => {
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify(alert));
            }
        });
    }

    private cleanOldData(): void {
        // Clean reports older than 30 days
        const cutoffDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        this.recentReports = this.recentReports.filter(r => r.timestamp >= cutoffDate);

        // Clean low-activity threat intelligence
        for (const [phoneNumber, intel] of this.threatDatabase.entries()) {
            if (intel.lastReported < cutoffDate && intel.reportCount < 5) {
                this.threatDatabase.delete(phoneNumber);
            }
        }

        logger.info('Cleaned old threat intelligence data');
    }

    private async storeThreatReport(report: ThreatReport): Promise<void> {
        // Store report in persistent database
        // Implementation depends on your database setup
    }

    private async backupThreatData(): Promise<void> {
        // Backup threat intelligence data
        logger.info('Backing up threat intelligence data');
    }

    /**
     * Shutdown the threat intelligence system
     */
    shutdown(): void {
        this.wsServer.close();
        this.connectedClients.clear();
        logger.info('Collaborative threat intelligence system shutdown');
    }
}

export default CollaborativeThreatIntelligence;