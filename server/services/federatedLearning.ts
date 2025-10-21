/**
 * Federated Learning System
 * Enables continuous learning across multiple devices while preserving privacy
 * Models are trained locally on devices, and only model updates are shared
 */

import { EventEmitter } from 'events';
import { logger } from '../utils/logger.js';

interface ModelUpdate {
  deviceId: string;
  weights: number[][];
  bias: number[];
  gradients: number[][];
  samplesCount: number;
  accuracy: number;
  timestamp: Date;
  modelVersion: string;
}

interface GlobalModel {
  version: string;
  weights: number[][];
  bias: number[];
  accuracy: number;
  participatingDevices: number;
  lastUpdate: Date;
  trainingRounds: number;
}

interface DeviceMetrics {
  deviceId: string;
  totalSamples: number;
  accuracy: number;
  contributionScore: number;
  lastSync: Date;
  trustScore: number;
}

export class FederatedLearningSystem extends EventEmitter {
  private globalModel: GlobalModel;
  private pendingUpdates: ModelUpdate[] = [];
  private deviceMetrics = new Map<string, DeviceMetrics>();
  private aggregationThreshold = 5; // Minimum devices before aggregating
  private minSamplesPerDevice = 10;
  private learningRate = 0.01;
  private momentumFactor = 0.9;
  private previousMomentum: number[][] | null = null;

  constructor() {
    super();
    
    this.globalModel = {
      version: '1.0.0',
      weights: this.initializeWeights(50, 32), // 50 features, 32 hidden units
      bias: new Array(32).fill(0),
      accuracy: 0,
      participatingDevices: 0,
      lastUpdate: new Date(),
      trainingRounds: 0
    };

    this.startAggregationCycle();
    logger.info('Federated Learning System initialized');
  }

  /**
   * Initialize model weights with Xavier initialization
   */
  private initializeWeights(inputSize: number, outputSize: number): number[][] {
    const limit = Math.sqrt(6 / (inputSize + outputSize));
    return Array(inputSize).fill(0).map(() =>
      Array(outputSize).fill(0).map(() => 
        (Math.random() * 2 - 1) * limit
      )
    );
  }

  /**
   * Receive model update from a device
   */
  async receiveModelUpdate(update: ModelUpdate): Promise<void> {
    try {
      // Validate update
      if (!this.validateUpdate(update)) {
        logger.warn(`Invalid model update from device ${update.deviceId}`);
        return;
      }

      // Check if device is trusted
      const trustScore = this.calculateTrustScore(update.deviceId, update);
      if (trustScore < 0.3) {
        logger.warn(`Low trust score for device ${update.deviceId}: ${trustScore}`);
        return;
      }

      // Add to pending updates
      this.pendingUpdates.push(update);

      // Update device metrics
      this.updateDeviceMetrics(update.deviceId, {
        totalSamples: update.samplesCount,
        accuracy: update.accuracy,
        trustScore: trustScore,
        contributionScore: this.calculateContributionScore(update),
        lastSync: new Date()
      });

      logger.info(
        `Received model update from ${update.deviceId}: ` +
        `${update.samplesCount} samples, accuracy: ${update.accuracy.toFixed(3)}`
      );

      // Trigger aggregation if threshold met
      if (this.pendingUpdates.length >= this.aggregationThreshold) {
        await this.aggregateModels();
      }

      this.emit('update-received', { deviceId: update.deviceId, update });
    } catch (error) {
      logger.error('Error receiving model update:', error);
      throw error;
    }
  }

  /**
   * Aggregate model updates using Federated Averaging (FedAvg)
   */
  private async aggregateModels(): Promise<void> {
    if (this.pendingUpdates.length === 0) return;

    logger.info(`Aggregating ${this.pendingUpdates.length} model updates`);

    try {
      // Calculate weighted average based on sample counts and trust scores
      const totalWeight = this.pendingUpdates.reduce((sum, update) => {
        const metrics = this.deviceMetrics.get(update.deviceId);
        const trust = metrics?.trustScore || 0.5;
        return sum + (update.samplesCount * trust);
      }, 0);

      // Initialize aggregated weights
      const aggregatedWeights = this.initializeWeights(
        this.globalModel.weights.length,
        this.globalModel.weights[0].length
      ).map(row => row.map(() => 0));

      const aggregatedBias = new Array(this.globalModel.bias.length).fill(0);

      // Weighted averaging
      for (const update of this.pendingUpdates) {
        const metrics = this.deviceMetrics.get(update.deviceId);
        const trust = metrics?.trustScore || 0.5;
        const weight = (update.samplesCount * trust) / totalWeight;

        // Aggregate weights
        for (let i = 0; i < aggregatedWeights.length; i++) {
          for (let j = 0; j < aggregatedWeights[i].length; j++) {
            aggregatedWeights[i][j] += update.weights[i][j] * weight;
          }
        }

        // Aggregate bias
        for (let i = 0; i < aggregatedBias.length; i++) {
          aggregatedBias[i] += update.bias[i] * weight;
        }
      }

      // Apply momentum for smoother updates
      if (this.previousMomentum) {
        for (let i = 0; i < aggregatedWeights.length; i++) {
          for (let j = 0; j < aggregatedWeights[i].length; j++) {
            const momentum = this.momentumFactor * this.previousMomentum[i][j];
            aggregatedWeights[i][j] += momentum;
          }
        }
      }

      // Store momentum for next iteration
      this.previousMomentum = aggregatedWeights.map(row => [...row]);

      // Update global model
      const avgAccuracy = this.pendingUpdates.reduce((sum, u) => sum + u.accuracy, 0) / 
                          this.pendingUpdates.length;

      this.globalModel = {
        version: this.incrementVersion(this.globalModel.version),
        weights: aggregatedWeights,
        bias: aggregatedBias,
        accuracy: avgAccuracy,
        participatingDevices: this.pendingUpdates.length,
        lastUpdate: new Date(),
        trainingRounds: this.globalModel.trainingRounds + 1
      };

      logger.info(
        `Global model updated to v${this.globalModel.version}: ` +
        `accuracy: ${avgAccuracy.toFixed(3)}, devices: ${this.pendingUpdates.length}`
      );

      // Clear pending updates
      this.pendingUpdates = [];

      // Emit update event for clients to download new model
      this.emit('global-model-updated', { 
        version: this.globalModel.version,
        accuracy: this.globalModel.accuracy,
        timestamp: this.globalModel.lastUpdate
      });

    } catch (error) {
      logger.error('Error aggregating models:', error);
      throw error;
    }
  }

  /**
   * Get current global model for devices to download
   */
  getGlobalModel(): GlobalModel {
    return { ...this.globalModel };
  }

  /**
   * Validate model update from device
   */
  private validateUpdate(update: ModelUpdate): boolean {
    // Check minimum samples
    if (update.samplesCount < this.minSamplesPerDevice) {
      return false;
    }

    // Check weights dimensions
    if (!update.weights || !Array.isArray(update.weights)) {
      return false;
    }

    // Check for NaN or Infinity
    const hasInvalidValues = update.weights.some(row =>
      row.some(val => !isFinite(val))
    );

    if (hasInvalidValues) {
      return false;
    }

    // Check accuracy is reasonable
    if (update.accuracy < 0 || update.accuracy > 1) {
      return false;
    }

    return true;
  }

  /**
   * Calculate trust score for a device
   */
  private calculateTrustScore(deviceId: string, update: ModelUpdate): number {
    const metrics = this.deviceMetrics.get(deviceId);
    
    if (!metrics) {
      return 0.5; // Default trust for new devices
    }

    let trustScore = 0.5;

    // Reward consistent accuracy
    if (update.accuracy > 0.7) {
      trustScore += 0.2;
    }

    // Reward frequent contributions
    const daysSinceLastSync = (Date.now() - metrics.lastSync.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceLastSync < 7) {
      trustScore += 0.1;
    }

    // Reward high sample counts
    if (update.samplesCount > 50) {
      trustScore += 0.1;
    }

    // Consider historical trust
    trustScore = (trustScore + metrics.trustScore) / 2;

    return Math.min(1.0, Math.max(0.0, trustScore));
  }

  /**
   * Calculate contribution score for metrics
   */
  private calculateContributionScore(update: ModelUpdate): number {
    return (
      update.accuracy * 0.5 +
      Math.min(update.samplesCount / 100, 1.0) * 0.3 +
      0.2 // Base contribution
    );
  }

  /**
   * Update device metrics
   */
  private updateDeviceMetrics(deviceId: string, partial: Partial<DeviceMetrics>): void {
    const existing = this.deviceMetrics.get(deviceId) || {
      deviceId,
      totalSamples: 0,
      accuracy: 0,
      contributionScore: 0,
      lastSync: new Date(),
      trustScore: 0.5
    };

    this.deviceMetrics.set(deviceId, { ...existing, ...partial });
  }

  /**
   * Start periodic aggregation cycle
   */
  private startAggregationCycle(): void {
    // Aggregate every 30 minutes if updates are pending
    setInterval(async () => {
      if (this.pendingUpdates.length >= 2) {
        await this.aggregateModels();
      }
    }, 30 * 60 * 1000);

    // Generate reports every 24 hours
    setInterval(() => {
      this.generateLearningReport();
    }, 24 * 60 * 60 * 1000);
  }

  /**
   * Generate learning report
   */
  private generateLearningReport(): void {
    const report = {
      modelVersion: this.globalModel.version,
      accuracy: this.globalModel.accuracy,
      trainingRounds: this.globalModel.trainingRounds,
      totalDevices: this.deviceMetrics.size,
      activeDevices: Array.from(this.deviceMetrics.values()).filter(
        m => Date.now() - m.lastSync.getTime() < 7 * 24 * 60 * 60 * 1000
      ).length,
      averageDeviceAccuracy: Array.from(this.deviceMetrics.values())
        .reduce((sum, m) => sum + m.accuracy, 0) / this.deviceMetrics.size,
      topContributors: Array.from(this.deviceMetrics.entries())
        .sort((a, b) => b[1].contributionScore - a[1].contributionScore)
        .slice(0, 10)
        .map(([id, m]) => ({ deviceId: id, score: m.contributionScore }))
    };

    logger.info('Federated Learning Report:', report);
    this.emit('learning-report', report);
  }

  /**
   * Increment semantic version
   */
  private incrementVersion(version: string): string {
    const parts = version.split('.').map(Number);
    parts[2]++;
    if (parts[2] >= 100) {
      parts[2] = 0;
      parts[1]++;
    }
    if (parts[1] >= 10) {
      parts[1] = 0;
      parts[0]++;
    }
    return parts.join('.');
  }

  /**
   * Get device metrics
   */
  getDeviceMetrics(deviceId: string): DeviceMetrics | undefined {
    return this.deviceMetrics.get(deviceId);
  }

  /**
   * Get all device metrics
   */
  getAllDeviceMetrics(): DeviceMetrics[] {
    return Array.from(this.deviceMetrics.values());
  }
}

export default FederatedLearningSystem;
