/**
 * Reinforcement Learning Decision Optimizer
 * Uses Q-Learning to optimize blocking decisions based on user feedback
 * Learns optimal policies to minimize false positives while maximizing spam detection
 */

import { logger } from '../utils/logger.js';

interface State {
  riskScore: number; // 0-1
  voiceAnalysisScore: number; // 0-1
  patternScore: number; // 0-1
  communityReports: number;
  historicalAccuracy: number; // 0-1
  timeOfDay: number; // 0-23
  userBusy: boolean;
}

interface Action {
  type: 'block' | 'allow' | 'challenge' | 'screen';
  confidence: number;
}

interface Experience {
  state: State;
  action: Action;
  reward: number;
  nextState: State;
  timestamp: Date;
}

interface QTableEntry {
  blockValue: number;
  allowValue: number;
  challengeValue: number;
  screenValue: number;
  visitCount: number;
  lastUpdated: Date;
}

export class ReinforcementLearningOptimizer {
  private qTable: Map<string, QTableEntry>;
  private learningRate = 0.1;
  private discountFactor = 0.95;
  private explorationRate = 0.2;
  private minExplorationRate = 0.05;
  private explorationDecay = 0.995;
  private experienceBuffer: Experience[] = [];
  private maxBufferSize = 1000;
  private batchSize = 32;
  
  // Reward structure
  private rewards = {
    truePositive: 1.0,      // Correctly blocked spam
    trueNegative: 0.5,      // Correctly allowed legitimate call
    falsePositive: -2.0,    // Incorrectly blocked legitimate call (very bad!)
    falseNegative: -1.0,    // Incorrectly allowed spam call
    userChallengePassed: 0.3, // Challenge passed successfully
    userChallengeFailed: 0.7  // Challenge failed (likely spam)
  };

  private performanceMetrics = {
    totalDecisions: 0,
    correctDecisions: 0,
    falsePositives: 0,
    falseNegatives: 0,
    averageReward: 0
  };

  constructor() {
    this.qTable = new Map();
    this.loadQTable();
    this.startPeriodicTraining();
    logger.info('Reinforcement Learning Optimizer initialized');
  }

  /**
   * Get optimal action for current state
   */
  getOptimalAction(state: State): Action {
    const stateKey = this.stateToKey(state);
    const qValues = this.getQValues(stateKey);

    // Epsilon-greedy exploration
    if (Math.random() < this.explorationRate) {
      // Explore: random action
      const actions: Action['type'][] = ['block', 'allow', 'challenge', 'screen'];
      const randomAction = actions[Math.floor(Math.random() * actions.length)];
      
      return {
        type: randomAction,
        confidence: 0.5
      };
    } else {
      // Exploit: choose best action
      const bestAction = this.getBestAction(qValues);
      const bestValue = qValues[`${bestAction}Value`];
      
      // Calculate confidence based on Q-value difference
      const values = [
        qValues.blockValue,
        qValues.allowValue,
        qValues.challengeValue,
        qValues.screenValue
      ];
      const secondBestValue = values.sort((a, b) => b - a)[1];
      const confidence = Math.min(1.0, (bestValue - secondBestValue + 1) / 2);

      return {
        type: bestAction,
        confidence
      };
    }
  }

  /**
   * Update Q-values based on user feedback
   */
  async provideFeedback(
    state: State,
    action: Action,
    actualOutcome: 'spam' | 'legitimate' | 'challenge_passed' | 'challenge_failed'
  ): Promise<void> {
    // Calculate reward based on action and outcome
    const reward = this.calculateReward(action.type, actualOutcome);

    // Create experience
    const experience: Experience = {
      state,
      action,
      reward,
      nextState: state, // For simplicity, using same state
      timestamp: new Date()
    };

    // Add to experience buffer
    this.experienceBuffer.push(experience);
    if (this.experienceBuffer.length > this.maxBufferSize) {
      this.experienceBuffer.shift();
    }

    // Update Q-values immediately for this experience
    this.updateQValue(experience);

    // Update metrics
    this.updateMetrics(action.type, actualOutcome, reward);

    // Decay exploration rate
    this.explorationRate = Math.max(
      this.minExplorationRate,
      this.explorationRate * this.explorationDecay
    );

    logger.info(
      `RL feedback: action=${action.type}, outcome=${actualOutcome}, ` +
      `reward=${reward.toFixed(2)}, exploration=${this.explorationRate.toFixed(3)}`
    );
  }

  /**
   * Calculate reward based on action and outcome
   */
  private calculateReward(
    action: 'block' | 'allow' | 'challenge' | 'screen',
    outcome: 'spam' | 'legitimate' | 'challenge_passed' | 'challenge_failed'
  ): number {
    if (outcome === 'challenge_passed') {
      return this.rewards.userChallengePassed;
    }
    if (outcome === 'challenge_failed') {
      return this.rewards.userChallengeFailed;
    }

    const isSpam = outcome === 'spam';

    if (action === 'block') {
      return isSpam ? this.rewards.truePositive : this.rewards.falsePositive;
    } else if (action === 'allow') {
      return isSpam ? this.rewards.falseNegative : this.rewards.trueNegative;
    } else if (action === 'challenge' || action === 'screen') {
      // Challenge/screen is moderately good - adds friction but not full block
      return isSpam ? 0.8 : 0.1;
    }

    return 0;
  }

  /**
   * Update Q-value using Q-learning algorithm
   */
  private updateQValue(experience: Experience): void {
    const stateKey = this.stateToKey(experience.state);
    const qValues = this.getQValues(stateKey);

    // Get current Q-value
    const actionKey = `${experience.action.type}Value`;
    const currentQ = qValues[actionKey as keyof QTableEntry] as number;

    // Get maximum Q-value for next state
    const nextStateKey = this.stateToKey(experience.nextState);
    const nextQValues = this.getQValues(nextStateKey);
    const maxNextQ = Math.max(
      nextQValues.blockValue,
      nextQValues.allowValue,
      nextQValues.challengeValue,
      nextQValues.screenValue
    );

    // Q-learning update rule
    const newQ = currentQ + this.learningRate * (
      experience.reward + this.discountFactor * maxNextQ - currentQ
    );

    // Update Q-table
    const updated = {
      ...qValues,
      [actionKey]: newQ,
      visitCount: qValues.visitCount + 1,
      lastUpdated: new Date()
    };

    this.qTable.set(stateKey, updated);
  }

  /**
   * Batch training using experience replay
   */
  private async batchTrain(): Promise<void> {
    if (this.experienceBuffer.length < this.batchSize) return;

    logger.info(`Batch training with ${this.experienceBuffer.length} experiences`);

    // Sample random batch from experience buffer
    const batch = this.sampleBatch(this.batchSize);

    // Update Q-values for batch
    for (const experience of batch) {
      this.updateQValue(experience);
    }

    logger.info('Batch training completed');
  }

  /**
   * Sample random batch from experience buffer
   */
  private sampleBatch(size: number): Experience[] {
    const batch: Experience[] = [];
    const used = new Set<number>();

    while (batch.length < size && used.size < this.experienceBuffer.length) {
      const idx = Math.floor(Math.random() * this.experienceBuffer.length);
      if (!used.has(idx)) {
        used.add(idx);
        batch.push(this.experienceBuffer[idx]);
      }
    }

    return batch;
  }

  /**
   * Convert state to string key for Q-table
   */
  private stateToKey(state: State): string {
    // Discretize continuous values into bins
    const riskBin = Math.floor(state.riskScore * 10);
    const voiceBin = Math.floor(state.voiceAnalysisScore * 10);
    const patternBin = Math.floor(state.patternScore * 10);
    const reportsBin = Math.min(5, Math.floor(state.communityReports / 2));
    const accuracyBin = Math.floor(state.historicalAccuracy * 10);
    const timeBlock = Math.floor(state.timeOfDay / 6); // 4 time blocks
    const busy = state.userBusy ? 1 : 0;

    return `${riskBin}-${voiceBin}-${patternBin}-${reportsBin}-${accuracyBin}-${timeBlock}-${busy}`;
  }

  /**
   * Get Q-values for state, initialize if not exists
   */
  private getQValues(stateKey: string): QTableEntry {
    if (!this.qTable.has(stateKey)) {
      this.qTable.set(stateKey, {
        blockValue: 0,
        allowValue: 0,
        challengeValue: 0,
        screenValue: 0,
        visitCount: 0,
        lastUpdated: new Date()
      });
    }
    return this.qTable.get(stateKey)!;
  }

  /**
   * Get best action from Q-values
   */
  private getBestAction(qValues: QTableEntry): 'block' | 'allow' | 'challenge' | 'screen' {
    const actions = [
      { type: 'block' as const, value: qValues.blockValue },
      { type: 'allow' as const, value: qValues.allowValue },
      { type: 'challenge' as const, value: qValues.challengeValue },
      { type: 'screen' as const, value: qValues.screenValue }
    ];

    return actions.reduce((best, current) =>
      current.value > best.value ? current : best
    ).type;
  }

  /**
   * Update performance metrics
   */
  private updateMetrics(
    action: string,
    outcome: string,
    reward: number
  ): void {
    this.performanceMetrics.totalDecisions++;

    if (reward > 0) {
      this.performanceMetrics.correctDecisions++;
    }

    if (action === 'block' && outcome === 'legitimate') {
      this.performanceMetrics.falsePositives++;
    }

    if (action === 'allow' && outcome === 'spam') {
      this.performanceMetrics.falseNegatives++;
    }

    // Update running average reward
    this.performanceMetrics.averageReward =
      (this.performanceMetrics.averageReward * (this.performanceMetrics.totalDecisions - 1) + reward) /
      this.performanceMetrics.totalDecisions;
  }

  /**
   * Start periodic training
   */
  private startPeriodicTraining(): void {
    // Batch train every 5 minutes
    setInterval(() => {
      this.batchTrain();
    }, 5 * 60 * 1000);

    // Save Q-table every 30 minutes
    setInterval(() => {
      this.saveQTable();
    }, 30 * 60 * 1000);

    // Generate performance report daily
    setInterval(() => {
      this.generatePerformanceReport();
    }, 24 * 60 * 60 * 1000);
  }

  /**
   * Generate performance report
   */
  private generatePerformanceReport(): void {
    const accuracy = this.performanceMetrics.correctDecisions / 
                     Math.max(1, this.performanceMetrics.totalDecisions);
    const fpr = this.performanceMetrics.falsePositives / 
                Math.max(1, this.performanceMetrics.totalDecisions);
    const fnr = this.performanceMetrics.falseNegatives / 
                Math.max(1, this.performanceMetrics.totalDecisions);

    const report = {
      ...this.performanceMetrics,
      accuracy,
      falsePositiveRate: fpr,
      falseNegativeRate: fnr,
      qTableSize: this.qTable.size,
      explorationRate: this.explorationRate,
      experienceBufferSize: this.experienceBuffer.length
    };

    logger.info('RL Performance Report:', report);
  }

  /**
   * Get performance metrics
   */
  getPerformanceMetrics(): any {
    const accuracy = this.performanceMetrics.correctDecisions / 
                     Math.max(1, this.performanceMetrics.totalDecisions);
    
    return {
      ...this.performanceMetrics,
      accuracy,
      qTableSize: this.qTable.size,
      explorationRate: this.explorationRate,
      experienceBufferSize: this.experienceBuffer.length
    };
  }

  /**
   * Get top Q-values (most visited states)
   */
  getTopQValues(limit: number = 10): any[] {
    return Array.from(this.qTable.entries())
      .sort((a, b) => b[1].visitCount - a[1].visitCount)
      .slice(0, limit)
      .map(([state, values]) => ({
        state,
        ...values
      }));
  }

  /**
   * Save Q-table to persistent storage
   */
  private async saveQTable(): Promise<void> {
    try {
      // In production, save to database
      // For now, just log the action
      logger.info(`Q-table saved: ${this.qTable.size} states`);
    } catch (error) {
      logger.error('Error saving Q-table:', error);
    }
  }

  /**
   * Load Q-table from persistent storage
   */
  private async loadQTable(): Promise<void> {
    try {
      // In production, load from database
      // For now, start with empty Q-table
      logger.info('Q-table loaded/initialized');
    } catch (error) {
      logger.error('Error loading Q-table:', error);
    }
  }

  /**
   * Reset exploration rate (for testing or reset scenarios)
   */
  resetExploration(): void {
    this.explorationRate = 0.2;
    logger.info('Exploration rate reset to 0.2');
  }

  /**
   * Adjust reward structure based on user preferences
   */
  adjustRewardStructure(preferFewFalsePositives: boolean): void {
    if (preferFewFalsePositives) {
      // User prefers to minimize false positives (blocking legitimate calls)
      this.rewards.falsePositive = -3.0;
      this.rewards.trueNegative = 1.0;
      this.rewards.truePositive = 0.8;
      logger.info('Reward structure adjusted: minimize false positives');
    } else {
      // User prefers to minimize false negatives (allowing spam)
      this.rewards.falsePositive = -1.5;
      this.rewards.trueNegative = 0.5;
      this.rewards.truePositive = 1.5;
      this.rewards.falseNegative = -2.0;
      logger.info('Reward structure adjusted: minimize false negatives');
    }
  }
}

export default ReinforcementLearningOptimizer;
