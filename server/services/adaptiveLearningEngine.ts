/**
 * Adaptive Personal Learning Engine
 * Personalizes call blocking based on user behavior, feedback, and preferences
 */

import { logger } from '../utils/logger.js';

interface UserProfile {
    userId: string;
    preferences: {
        blockingAggression: 'conservative' | 'moderate' | 'aggressive';
        allowBusinessCalls: boolean;
        allowPoliticalCalls: boolean;
        allowCharityCalls: boolean;
        allowSurveyCalls: boolean;
        timeBasedBlocking: {
            enabled: boolean;
            quietHours: { start: string; end: string }[];
            weekendOnly: boolean;
        };
        whitelistMode: boolean; // Only allow known contacts
    };
    behaviorPattern: {
        answeredCalls: string[];
        blockedCalls: string[];
        markedAsSpam: string[];
        markedAsSafe: string[];
        callDurationPreferences: number[];
        preferredCallingTimes: number[];
    };
    learningData: {
        correctPredictions: number;
        incorrectPredictions: number;
        userOverrides: number;
        feedbackScore: number;
        confidenceLevel: number;
    };
    personalizedModel: {
        weights: number[];
        bias: number;
        lastUpdated: Date;
        trainingIterations: number;
    };
}

interface LearningFeedback {
    callId: string;
    phoneNumber: string;
    prediction: 'block' | 'allow';
    userAction: 'answered' | 'blocked' | 'marked_spam' | 'marked_safe';
    satisfaction: 1 | 2 | 3 | 4 | 5; // User satisfaction with the decision
    timestamp: Date;
    context?: {
        timeOfDay: number;
        dayOfWeek: number;
        callDuration?: number;
        userBusy?: boolean;
    };
}

interface PersonalizedPrediction {
    action: 'block' | 'allow' | 'screen';
    confidence: number;
    reasoning: string[];
    personalizedFactors: string[];
    riskScore: number;
}

export class AdaptivePersonalLearningEngine {
    private userProfiles = new Map<string, UserProfile>();
    private feedbackBuffer = new Map<string, LearningFeedback[]>();
    private learningEnabled = true;
    private batchSize = 50;
    private learningRate = 0.01;

    constructor() {
        this.initializeLearningEngine();
    }

    private initializeLearningEngine(): void {
        logger.info('Initializing adaptive personal learning engine');
        
        // Load existing user profiles from database
        this.loadUserProfiles();
        
        // Start periodic learning updates
        setInterval(() => {
            this.performBatchLearning();
        }, 5 * 60 * 1000); // Every 5 minutes
        
        // Daily model optimization
        setInterval(() => {
            this.optimizePersonalizedModels();
        }, 24 * 60 * 60 * 1000); // Daily
    }

    /**
     * Get personalized prediction for a call
     */
    async getPersonalizedPrediction(
        userId: string,
        phoneNumber: string,
        baseRiskScore: number,
        context: {
            timeOfDay: number;
            dayOfWeek: number;
            callerReputation?: number;
            voiceAnalysis?: any;
        }
    ): Promise<PersonalizedPrediction> {
        const profile = await this.getUserProfile(userId);
        
        // Calculate personalized risk score
        const personalizedRisk = this.calculatePersonalizedRisk(
            profile, 
            phoneNumber, 
            baseRiskScore, 
            context
        );
        
        // Apply user preferences
        const decision = this.applyUserPreferences(profile, personalizedRisk, context);
        
        // Generate reasoning
        const reasoning = this.generateReasoning(profile, decision, personalizedRisk, context);
        
        return {
            action: decision.action,
            confidence: decision.confidence,
            reasoning: reasoning.general,
            personalizedFactors: reasoning.personalized,
            riskScore: personalizedRisk
        };
    }

    /**
     * Record user feedback for learning
     */
    async recordFeedback(userId: string, feedback: LearningFeedback): Promise<void> {
        try {
            // Add to feedback buffer
            if (!this.feedbackBuffer.has(userId)) {
                this.feedbackBuffer.set(userId, []);
            }
            
            const userFeedback = this.feedbackBuffer.get(userId)!;
            userFeedback.push(feedback);
            
            // Update user profile with immediate feedback
            await this.updateUserProfile(userId, feedback);
            
            // Trigger immediate learning if enough feedback
            if (userFeedback.length >= this.batchSize) {
                await this.performUserSpecificLearning(userId);
                this.feedbackBuffer.set(userId, []); // Clear buffer
            }
            
            logger.info(`Recorded learning feedback for user ${userId}: ${feedback.userAction}`);
            
        } catch (error) {
            logger.error(`Failed to record feedback for user ${userId}:`, error as Error);
        }
    }

    /**
     * Calculate personalized risk score
     */
    private calculatePersonalizedRisk(
        profile: UserProfile,
        phoneNumber: string,
        baseRiskScore: number,
        context: any
    ): number {
        let personalizedRisk = baseRiskScore;
        
        // Apply personal learning model if trained
        if (profile.personalizedModel.trainingIterations > 10) {
            const features = this.extractPersonalizedFeatures(profile, phoneNumber, context);
            const modelPrediction = this.runPersonalizedModel(profile.personalizedModel, features);
            
            // Blend base risk with personalized model
            const modelWeight = Math.min(profile.learningData.confidenceLevel, 0.7);
            personalizedRisk = (baseRiskScore * (1 - modelWeight)) + (modelPrediction * modelWeight);
        }
        
        // Adjust based on user behavior patterns
        personalizedRisk = this.adjustForBehaviorPatterns(profile, phoneNumber, personalizedRisk);
        
        // Time-based adjustments
        personalizedRisk = this.adjustForTimeContext(profile, context, personalizedRisk);
        
        return Math.max(0, Math.min(1, personalizedRisk));
    }

    /**
     * Apply user preferences to make final decision
     */
    private applyUserPreferences(
        profile: UserProfile,
        riskScore: number,
        context: any
    ): { action: 'block' | 'allow' | 'screen'; confidence: number } {
        // Determine thresholds based on user's blocking aggression
        const thresholds = this.getBlockingThresholds(profile.preferences.blockingAggression);
        
        // Check whitelist mode
        if (profile.preferences.whitelistMode) {
            const isKnownContact = this.isKnownContact(profile, context.phoneNumber);
            if (!isKnownContact) {
                return { action: 'block', confidence: 0.95 };
            }
        }
        
        // Check quiet hours
        if (this.isQuietHours(profile, context)) {
            return { action: 'block', confidence: 0.9 };
        }
        
        // Apply risk-based decision
        if (riskScore >= thresholds.block) {
            return { action: 'block', confidence: riskScore };
        } else if (riskScore >= thresholds.screen) {
            return { action: 'screen', confidence: riskScore };
        } else {
            return { action: 'allow', confidence: 1 - riskScore };
        }
    }

    /**
     * Update user profile with new feedback
     */
    private async updateUserProfile(userId: string, feedback: LearningFeedback): Promise<void> {
        const profile = await this.getUserProfile(userId);
        
        // Update behavior patterns
        switch (feedback.userAction) {
            case 'answered':
                profile.behaviorPattern.answeredCalls.push(feedback.phoneNumber);
                break;
            case 'blocked':
                profile.behaviorPattern.blockedCalls.push(feedback.phoneNumber);
                break;
            case 'marked_spam':
                profile.behaviorPattern.markedAsSpam.push(feedback.phoneNumber);
                break;
            case 'marked_safe':
                profile.behaviorPattern.markedAsSafe.push(feedback.phoneNumber);
                break;
        }
        
        // Update learning metrics
        const wasCorrectPrediction = this.evaluatePrediction(feedback);
        if (wasCorrectPrediction) {
            profile.learningData.correctPredictions++;
        } else {
            profile.learningData.incorrectPredictions++;
            profile.learningData.userOverrides++;
        }
        
        // Update feedback score
        profile.learningData.feedbackScore = this.calculateFeedbackScore(profile.learningData);
        
        // Update confidence level
        profile.learningData.confidenceLevel = this.calculateConfidenceLevel(profile.learningData);
        
        // Store updated profile
        this.userProfiles.set(userId, profile);
        await this.saveUserProfile(profile);
    }

    /**
     * Perform batch learning for all users
     */
    private async performBatchLearning(): Promise<void> {
        if (!this.learningEnabled) return;
        
        for (const [userId, feedbackList] of this.feedbackBuffer.entries()) {
            if (feedbackList.length >= this.batchSize) {
                await this.performUserSpecificLearning(userId);
                this.feedbackBuffer.set(userId, []); // Clear processed feedback
            }
        }
    }

    /**
     * Perform learning for a specific user
     */
    private async performUserSpecificLearning(userId: string): Promise<void> {
        const profile = await this.getUserProfile(userId);
        const feedback = this.feedbackBuffer.get(userId) || [];
        
        if (feedback.length === 0) return;
        
        try {
            // Prepare training data
            const trainingData = this.prepareTrainingData(profile, feedback);
            
            // Update personalized model
            this.updatePersonalizedModel(profile, trainingData);
            
            // Update profile
            profile.personalizedModel.lastUpdated = new Date();
            profile.personalizedModel.trainingIterations++;
            
            this.userProfiles.set(userId, profile);
            await this.saveUserProfile(profile);
            
            logger.info(`Performed personalized learning for user ${userId} with ${feedback.length} feedback samples`);
            
        } catch (error) {
            logger.error(`Failed to perform learning for user ${userId}:`, error as Error);
        }
    }

    /**
     * Extract features for personalized model
     */
    private extractPersonalizedFeatures(profile: UserProfile, phoneNumber: string, context: any): number[] {
        const features: number[] = [];
        
        // Time-based features
        features.push(context.timeOfDay / 24); // Normalized hour
        features.push(context.dayOfWeek / 7); // Normalized day
        
        // User behavior features
        features.push(profile.behaviorPattern.answeredCalls.includes(phoneNumber) ? 1 : 0);
        features.push(profile.behaviorPattern.blockedCalls.includes(phoneNumber) ? 1 : 0);
        features.push(profile.behaviorPattern.markedAsSpam.includes(phoneNumber) ? 1 : 0);
        features.push(profile.behaviorPattern.markedAsSafe.includes(phoneNumber) ? 1 : 0);
        
        // Preference features
        features.push(profile.preferences.allowBusinessCalls ? 1 : 0);
        features.push(profile.preferences.allowPoliticalCalls ? 1 : 0);
        features.push(profile.preferences.allowCharityCalls ? 1 : 0);
        features.push(profile.preferences.allowSurveyCalls ? 1 : 0);
        
        // Blocking aggression level
        const aggressionMap = { 'conservative': 0.3, 'moderate': 0.6, 'aggressive': 0.9 };
        features.push(aggressionMap[profile.preferences.blockingAggression]);
        
        // Historical context
        features.push(profile.learningData.feedbackScore);
        features.push(profile.learningData.confidenceLevel);
        
        return features;
    }

    /**
     * Run personalized model prediction
     */
    private runPersonalizedModel(model: UserProfile['personalizedModel'], features: number[]): number {
        if (features.length !== model.weights.length) {
            logger.warn('Feature dimension mismatch in personalized model');
            return 0.5; // Default prediction
        }
        
        // Simple linear model: prediction = sum(feature * weight) + bias
        let prediction = model.bias;
        for (let i = 0; i < features.length; i++) {
            prediction += features[i] * model.weights[i];
        }
        
        // Apply sigmoid activation
        return 1 / (1 + Math.exp(-prediction));
    }

    /**
     * Update personalized model with new training data
     */
    private updatePersonalizedModel(
        profile: UserProfile,
        trainingData: { features: number[][]; labels: number[] }
    ): void {
        const model = profile.personalizedModel;
        
        // Simple gradient descent update
        for (let i = 0; i < trainingData.features.length; i++) {
            const features = trainingData.features[i];
            const target = trainingData.labels[i];
            
            // Forward pass
            const prediction = this.runPersonalizedModel(model, features);
            
            // Calculate error
            const error = target - prediction;
            
            // Update weights
            for (let j = 0; j < model.weights.length; j++) {
                model.weights[j] += this.learningRate * error * features[j];
            }
            
            // Update bias
            model.bias += this.learningRate * error;
        }
        
        // Apply weight decay to prevent overfitting
        const decayRate = 0.001;
        for (let i = 0; i < model.weights.length; i++) {
            model.weights[i] *= (1 - decayRate);
        }
    }

    /**
     * Prepare training data from feedback
     */
    private prepareTrainingData(
        profile: UserProfile,
        feedback: LearningFeedback[]
    ): { features: number[][]; labels: number[] } {
        const features: number[][] = [];
        const labels: number[] = [];
        
        feedback.forEach(f => {
            const featureVector = this.extractPersonalizedFeatures(
                profile,
                f.phoneNumber,
                f.context || { timeOfDay: 12, dayOfWeek: 1 }
            );
            
            features.push(featureVector);
            
            // Convert user action to label (1 = should block, 0 = should allow)
            const label = (f.userAction === 'blocked' || f.userAction === 'marked_spam') ? 1 : 0;
            labels.push(label);
        });
        
        return { features, labels };
    }

    // Utility methods
    private async getUserProfile(userId: string): Promise<UserProfile> {
        let profile = this.userProfiles.get(userId);
        
        if (!profile) {
            profile = this.createDefaultProfile(userId);
            this.userProfiles.set(userId, profile);
            await this.saveUserProfile(profile);
        }
        
        return profile;
    }

    private createDefaultProfile(userId: string): UserProfile {
        return {
            userId,
            preferences: {
                blockingAggression: 'moderate',
                allowBusinessCalls: true,
                allowPoliticalCalls: false,
                allowCharityCalls: true,
                allowSurveyCalls: false,
                timeBasedBlocking: {
                    enabled: true,
                    quietHours: [{ start: '22:00', end: '08:00' }],
                    weekendOnly: false
                },
                whitelistMode: false
            },
            behaviorPattern: {
                answeredCalls: [],
                blockedCalls: [],
                markedAsSpam: [],
                markedAsSafe: [],
                callDurationPreferences: [],
                preferredCallingTimes: []
            },
            learningData: {
                correctPredictions: 0,
                incorrectPredictions: 0,
                userOverrides: 0,
                feedbackScore: 0.5,
                confidenceLevel: 0.5
            },
            personalizedModel: {
                weights: new Array(13).fill(0).map(() => (Math.random() - 0.5) * 0.1),
                bias: 0,
                lastUpdated: new Date(),
                trainingIterations: 0
            }
        };
    }

    private getBlockingThresholds(aggression: string): { block: number; screen: number } {
        switch (aggression) {
            case 'conservative':
                return { block: 0.8, screen: 0.6 };
            case 'moderate':
                return { block: 0.6, screen: 0.4 };
            case 'aggressive':
                return { block: 0.4, screen: 0.2 };
            default:
                return { block: 0.6, screen: 0.4 };
        }
    }

    private isKnownContact(profile: UserProfile, phoneNumber: string): boolean {
        return profile.behaviorPattern.answeredCalls.includes(phoneNumber) ||
               profile.behaviorPattern.markedAsSafe.includes(phoneNumber);
    }

    private isQuietHours(profile: UserProfile, context: any): boolean {
        if (!profile.preferences.timeBasedBlocking.enabled) return false;
        
        const currentHour = context.timeOfDay;
        const currentDay = context.dayOfWeek;
        
        // Check weekend only mode
        if (profile.preferences.timeBasedBlocking.weekendOnly && 
            currentDay !== 0 && currentDay !== 6) {
            return false;
        }
        
        // Check quiet hours
        return profile.preferences.timeBasedBlocking.quietHours.some(period => {
            const start = parseInt(period.start.split(':')[0]);
            const end = parseInt(period.end.split(':')[0]);
            
            if (start > end) { // Overnight period
                return currentHour >= start || currentHour <= end;
            } else {
                return currentHour >= start && currentHour <= end;
            }
        });
    }

    private evaluatePrediction(feedback: LearningFeedback): boolean {
        // Determine if the original prediction was correct based on user action
        const predictedToBlock = feedback.prediction === 'block';
        const userWantedToBlock = feedback.userAction === 'blocked' || 
                                 feedback.userAction === 'marked_spam';
        
        return predictedToBlock === userWantedToBlock;
    }

    private calculateFeedbackScore(learningData: UserProfile['learningData']): number {
        const total = learningData.correctPredictions + learningData.incorrectPredictions;
        return total > 0 ? learningData.correctPredictions / total : 0.5;
    }

    private calculateConfidenceLevel(learningData: UserProfile['learningData']): number {
        const total = learningData.correctPredictions + learningData.incorrectPredictions;
        const accuracy = this.calculateFeedbackScore(learningData);
        
        // Confidence increases with accuracy and number of samples
        const sampleWeight = Math.min(total / 100, 1); // Max confidence at 100 samples
        return accuracy * sampleWeight;
    }

    private adjustForBehaviorPatterns(
        profile: UserProfile,
        phoneNumber: string,
        riskScore: number
    ): number {
        // If user previously answered this number, reduce risk
        if (profile.behaviorPattern.answeredCalls.includes(phoneNumber)) {
            riskScore *= 0.3;
        }
        
        // If user previously marked as safe, significantly reduce risk
        if (profile.behaviorPattern.markedAsSafe.includes(phoneNumber)) {
            riskScore *= 0.1;
        }
        
        // If user previously blocked or marked as spam, increase risk
        if (profile.behaviorPattern.blockedCalls.includes(phoneNumber) ||
            profile.behaviorPattern.markedAsSpam.includes(phoneNumber)) {
            riskScore = Math.min(riskScore * 1.5, 1.0);
        }
        
        return riskScore;
    }

    private adjustForTimeContext(
        profile: UserProfile,
        context: any,
        riskScore: number
    ): number {
        // If user typically doesn't answer at this time, increase risk slightly
        const preferredTimes = profile.behaviorPattern.preferredCallingTimes;
        if (preferredTimes.length > 0) {
            const isPreferredTime = preferredTimes.some(time => 
                Math.abs(time - context.timeOfDay) <= 1
            );
            
            if (!isPreferredTime) {
                riskScore *= 1.1;
            }
        }
        
        return Math.min(riskScore, 1.0);
    }

    private generateReasoning(
        profile: UserProfile,
        decision: any,
        riskScore: number,
        context: any
    ): { general: string[]; personalized: string[] } {
        const general: string[] = [];
        const personalized: string[] = [];
        
        if (decision.action === 'block') {
            general.push(`Risk score ${(riskScore * 100).toFixed(0)}% exceeds blocking threshold`);
            
            if (profile.preferences.blockingAggression === 'aggressive') {
                personalized.push('Using aggressive blocking mode');
            }
            
            if (this.isQuietHours(profile, context)) {
                personalized.push('Call during configured quiet hours');
            }
        }
        
        if (profile.personalizedModel.trainingIterations > 10) {
            personalized.push(`Decision based on ${profile.personalizedModel.trainingIterations} learning iterations`);
        }
        
        return { general, personalized };
    }

    private optimizePersonalizedModels(): void {
        // Daily optimization of all user models
        logger.info('Optimizing personalized models for all users');
        
        this.userProfiles.forEach(async (profile, userId) => {
            if (profile.personalizedModel.trainingIterations > 50) {
                // Perform model optimization/pruning
                await this.optimizeUserModel(userId, profile);
            }
        });
    }

    private async optimizeUserModel(userId: string, profile: UserProfile): Promise<void> {
        // Implement model optimization techniques like weight pruning, regularization, etc.
        logger.debug(`Optimizing model for user ${userId}`);
    }

    private async loadUserProfiles(): Promise<void> {
        // Load user profiles from persistent storage
        logger.info('Loading user profiles from database');
    }

    private async saveUserProfile(profile: UserProfile): Promise<void> {
        // Save user profile to persistent storage
        // Implementation depends on your database setup
    }

    /**
     * Get learning analytics for a user
     */
    getUserLearningAnalytics(userId: string): any {
        const profile = this.userProfiles.get(userId);
        if (!profile) return null;
        
        return {
            accuracy: this.calculateFeedbackScore(profile.learningData),
            confidence: profile.learningData.confidenceLevel,
            trainingIterations: profile.personalizedModel.trainingIterations,
            totalFeedback: profile.learningData.correctPredictions + profile.learningData.incorrectPredictions,
            preferences: profile.preferences,
            lastModelUpdate: profile.personalizedModel.lastUpdated
        };
    }

    /**
     * Update user preferences
     */
    async updateUserPreferences(userId: string, preferences: Partial<UserProfile['preferences']>): Promise<void> {
        const profile = await this.getUserProfile(userId);
        Object.assign(profile.preferences, preferences);
        
        this.userProfiles.set(userId, profile);
        await this.saveUserProfile(profile);
        
        logger.info(`Updated preferences for user ${userId}`);
    }
}

export default AdaptivePersonalLearningEngine;