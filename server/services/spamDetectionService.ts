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
  private static isDevelopmentMode = process.env.NODE_ENV === 'development';
  private static simplifiedModel: tf.LayersModel | null = null;

  static async loadModel() {
    if (this.model || this.isModelLoading) return;

    try {
      this.isModelLoading = true;

      // In development mode, use a simplified model
      if (this.isDevelopmentMode) {
        console.log('Development mode: Using simplified spam detection model');
        if (!this.simplifiedModel) {
          this.simplifiedModel = this.createSimplifiedModel();
          await this.trainSimplifiedModel();
        }
        this.model = this.simplifiedModel;
        return;
      }

      // Production mode: try to load saved model or create new one
      try {
        this.model = await tf.loadLayersModel('file://./models/spam_detection_model/model.json');
      } catch {
        console.log('Creating new spam detection model');
        this.model = this.createSimplifiedModel();
        await this.trainModel();
      }
    } finally {
      this.isModelLoading = false;
    }
  }

  private static createSimplifiedModel() {
    const model = tf.sequential({
      layers: [
        tf.layers.dense({ units: 16, activation: 'relu', inputShape: [8] }),
        tf.layers.dense({ units: 8, activation: 'relu' }),
        tf.layers.dense({ units: 1, activation: 'sigmoid' })
      ]
    });

    model.compile({
      optimizer: tf.train.adam(0.001),
      loss: 'binaryCrossentropy',
      metrics: ['accuracy']
    });

    return model;
  }

  private static async trainSimplifiedModel() {
    // Create synthetic training data for development
    const syntheticData = this.generateSyntheticData(100);
    const features = syntheticData.map(d => d.features);
    const labels = syntheticData.map(d => d.label);

    const xs = tf.tensor2d(features);
    const ys = tf.tensor2d(labels, [labels.length, 1]);

    await this.model!.fit(xs, ys, {
      epochs: 5,
      batchSize: 32,
      verbose: 0
    });

    xs.dispose();
    ys.dispose();
  }

  private static generateSyntheticData(count: number) {
    const data = [];
    for (let i = 0; i < count; i++) {
      const isSpam = Math.random() > 0.5;
      data.push({
        features: [
          Math.random() * 24, // timeOfDay
          Math.random() * 7,  // dayOfWeek
          isSpam ? Math.random() * 0.8 + 0.2 : Math.random() * 0.3, // duration
          Math.random(),      // signalStrength
          isSpam ? Math.random() * 0.8 + 0.2 : Math.random() * 0.3, // callFrequency
          isSpam ? Math.random() * 0.8 + 0.2 : Math.random() * 0.3, // blockRate
          isSpam ? Math.random() * 5 + 5 : Math.random() * 2,       // spamReports
          Math.random()       // voiceEnergy
        ],
        label: [isSpam ? 1 : 0]
      });
    }
    return data;
  }

  static async trainModel() {
    await this.loadModel();
    if (!this.model) throw new Error('Model not initialized');

    if (this.isDevelopmentMode) {
      console.log('Development mode: Using pre-trained simplified model');
      return;
    }

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
    if (!this.isDevelopmentMode) {
      await this.model.save('file://./models/spam_detection_model');
    }

    // Clean up tensors
    xs.dispose();
    ys.dispose();
  }

  static async predictSpam(phoneNumber: string, callData: any): Promise<SpamPredictionResult> {
    await this.loadModel();
    if (!this.model) throw new Error('Model not initialized');

    // Get historical data for this number
    const [recentCalls, spamReportsCount, voiceAnalysis] = await Promise.all([
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

    // Extract basic features that work in both production and development
    const features = [
      callData.timeOfDay || 0,
      callData.dayOfWeek || 0,
      callData.duration || 0,
      callData.metadata?.signalStrength || 0,
      recentCalls.length || 0,
      recentCalls.filter(c => c.action === 'blocked').length / Math.max(recentCalls.length, 1),
      spamReportsCount.length || 0,
      voiceAnalysis?.confidence || 0
    ];

    // Make prediction
    const prediction = tf.tidy(() => {
      const inputTensor = tf.tensor2d([features]);
      const result = this.model!.predict(inputTensor) as tf.Tensor;
      return result.dataSync()[0];
    });

    // In development mode, use additional factors for scoring
    const confidence = this.isDevelopmentMode ?
      Math.min(0.3 + (spamReportsCount.length * 0.2) + (features[5] * 0.3), 1) :
      prediction;

    // Prepare detailed result
    const result: SpamPredictionResult = {
      isSpam: confidence > 0.7,
      confidence,
      features: {
        voicePattern: voiceAnalysis ? {
          roboticScore: voiceAnalysis.metadata?.audioCharacteristics?.energy || 0,
          naturalness: 1 - (voiceAnalysis.metadata?.audioCharacteristics?.rhythmRegularity || 0)
        } : undefined,
        callPattern: {
          frequency: features[4],
          timeConsistency: features[1] - features[0]
        },
        metadata: {
          spamReports: features[6],
          blockRate: features[5],
          predictionScore: prediction,
          developmentMode: this.isDevelopmentMode,
          rawFeatures: features
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
      call.metadata?.voiceEnergy || 0
    ];
  }
}