import * as tf from '@tensorflow/tfjs-node';
import { db } from "@db";
import { voicePatterns, callLogs, spamReports } from "@db/schema";
import { eq, and, desc, sql } from "drizzle-orm";

interface SpamPredictionResult {
  isSpam: boolean;
  confidence: number;
  features: {
    voicePattern?: {
      roboticScore: number;
      naturalness: number;
    };
    callPattern?: {
      frequency: number;
      timeConsistency: number;
    };
    metadata: Record<string, any>;
  };
}

export class SpamDetectionService {
  private static model: tf.LayersModel | null = null;
  private static isModelLoading = false;

  static async loadModel() {
    if (this.model || this.isModelLoading) return;

    try {
      this.isModelLoading = true;
      // Load model from filesystem or initialize new one
      try {
        this.model = await tf.loadLayersModel('file://./models/spam_detection_model/model.json');
      } catch {
        // If model doesn't exist, create a new one
        this.model = tf.sequential({
          layers: [
            tf.layers.dense({ units: 64, activation: 'relu', inputShape: [12] }),
            tf.layers.dropout({ rate: 0.2 }),
            tf.layers.dense({ units: 32, activation: 'relu' }),
            tf.layers.dropout({ rate: 0.2 }),
            tf.layers.dense({ units: 1, activation: 'sigmoid' })
          ]
        });

        // Compile the model
        this.model.compile({
          optimizer: tf.train.adam(0.001),
          loss: 'binaryCrossentropy',
          metrics: ['accuracy']
        });
      }
    } finally {
      this.isModelLoading = false;
    }
  }

  static async trainModel() {
    await this.loadModel();
    if (!this.model) throw new Error('Model not initialized');

    // Get training data from database
    const trainingData = await db.query.callLogs.findMany({
      where: and(
        eq(callLogs.action, 'blocked'),
        sql`${callLogs.metadata}->>'isSpam' is not null`
      ),
      orderBy: desc(callLogs.timestamp),
      limit: 1000
    });

    if (!trainingData.length) {
      console.log('No training data available yet');
      return;
    }

    // Prepare features and labels
    const features = trainingData.map(call => this.extractFeatures(call));
    const labels = trainingData.map(call => 
      call.metadata?.isSpam ? 1 : 0
    );

    // Convert to tensors
    const xs = tf.tensor2d(features);
    const ys = tf.tensor2d(labels, [labels.length, 1]);

    // Train the model
    await this.model.fit(xs, ys, {
      epochs: 10,
      batchSize: 32,
      validationSplit: 0.2,
      callbacks: {
        onEpochEnd: (epoch, logs) => {
          console.log(`Epoch ${epoch}: loss = ${logs?.loss}, accuracy = ${logs?.acc}`);
        }
      }
    });

    // Save the updated model
    await this.model.save('file://./models/spam_detection_model');

    // Clean up tensors
    xs.dispose();
    ys.dispose();
  }

  static async predictSpam(phoneNumber: string, callData: any): Promise<SpamPredictionResult> {
    await this.loadModel();
    if (!this.model) throw new Error('Model not initialized');

    // Get historical data for this number
    const [
      recentCalls,
      spamReportsCount,
      voiceAnalysis
    ] = await Promise.all([
      db.query.callLogs.findMany({
        where: eq(callLogs.phoneNumber, phoneNumber),
        orderBy: desc(callLogs.timestamp),
        limit: 10
      }),
      db.query.spamReports.findMany({
        where: eq(spamReports.phoneNumber, phoneNumber)
      }),
      db.query.voicePatterns.findFirst({
        where: eq(voicePatterns.patternType, 'spam'),
        orderBy: desc(voicePatterns.createdAt)
      })
    ]);

    // Extract features
    const features = [
      // Call pattern features
      recentCalls.length, // Call frequency
      recentCalls.filter(c => c.action === 'blocked').length / Math.max(recentCalls.length, 1), // Block rate
      Math.max(...recentCalls.map(c => c.timeOfDay || 0)) - Math.min(...recentCalls.map(c => c.timeOfDay || 0)), // Time spread

      // Spam report features
      spamReportsCount.length,
      spamReportsCount.reduce((acc, r) => acc + (r.confirmations || 0), 0),

      // Voice pattern features
      voiceAnalysis?.confidence || 0,
      voiceAnalysis?.metadata?.detectedFeatures?.energy || 0,
      voiceAnalysis?.metadata?.detectedFeatures?.zeroCrossings || 0,

      // Current call features
      callData.timeOfDay || 0,
      callData.dayOfWeek || 0,
      callData.duration || 0,
      callData.metadata?.signalStrength || 0
    ];

    // Make prediction
    const prediction = tf.tidy(() => {
      const inputTensor = tf.tensor2d([features]);
      const result = this.model!.predict(inputTensor) as tf.Tensor;
      return result.dataSync()[0];
    });

    // Prepare detailed result
    const result: SpamPredictionResult = {
      isSpam: prediction > 0.7,
      confidence: prediction,
      features: {
        voicePattern: voiceAnalysis ? {
          roboticScore: voiceAnalysis.metadata?.audioCharacteristics?.energy || 0,
          naturalness: 1 - (voiceAnalysis.metadata?.audioCharacteristics?.rhythmRegularity || 0)
        } : undefined,
        callPattern: {
          frequency: recentCalls.length,
          timeConsistency: features[2] // Time spread
        },
        metadata: {
          spamReports: spamReportsCount.length,
          blockRate: features[1],
          predictionScore: prediction
        }
      }
    };

    return result;
  }

  private static extractFeatures(call: any): number[] {
    return [
      call.timeOfDay || 0,
      call.dayOfWeek || 0,
      call.duration || 0,
      call.metadata?.signalStrength || 0,
      call.metadata?.callFrequency || 0,
      call.metadata?.blockRate || 0,
      call.metadata?.spamReports || 0,
      call.metadata?.voiceEnergy || 0,
      call.metadata?.voiceZeroCrossings || 0,
      call.metadata?.voiceRhythmRegularity || 0,
      call.metadata?.geoRiskScore || 0,
      call.metadata?.carrierRiskScore || 0
    ];
  }
}