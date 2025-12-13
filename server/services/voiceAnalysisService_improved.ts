// Conditional TensorFlow import - only load if ML features are enabled
let tf: any = null;
try {
  if (process.env.ENABLE_VOICE_ANALYSIS === 'true' || process.env.FEATURE_VOICE_ANALYSIS === 'true') {
    tf = require('@tensorflow/tfjs-node');
  }
} catch (error) {
  console.warn('⚠ Voice analysis not available:', (error as Error).message);
}

import * as webAudio from 'web-audio-api';
import Meyda from 'meyda';
import * as vad from 'node-vad';
import { db } from "@db";
import { voicePatterns } from "@db/schema";
import { desc } from "drizzle-orm";

interface VoiceFeatures {
  mfcc: number[];
  energy: number;
  zeroCrossings: number;
  spectralSlope: number;
  spectralRolloff: number;
  loudness: number;
  perceptualSpread: number;
  perceptualSharpness: number;
}

export interface VoiceAnalysisResult {
  isSpam: boolean;
  confidence: number;
  features: string[];
  patterns: {
    energy: number;
    zeroCrossings: number;
    rhythmRegularity: number;
    repetition?: number;
    naturalness?: number;
    pitch?: number;
    intonationVariance?: number;
  };
}

// Singleton audio context (reuse across calls)
class AudioContextManager {
  private static instance: any | null = null;
  
  static getContext(): any {
    if (!this.instance) {
      this.instance = new webAudio.AudioContext();
    }
    return this.instance;
  }
  
  static close() {
    if (this.instance) {
      this.instance = null;
    }
  }
}

// Voice Analysis Model Manager
class VoiceModelManager {
  private static model: any = null;
  private static isTraining = false;
  private static isDevelopmentMode = process.env.NODE_ENV === 'development';

  static async ensureModelLoaded(): Promise<any> {
    if (!tf) {
      console.warn('TensorFlow not available - voice analysis model disabled');
      return null;
    }
    
    if (this.model) return this.model;

    try {
      // Try to load existing model
      this.model = await tf.loadLayersModel('file://./models/voice_analysis_model/model.json');
      console.log('Loaded existing voice analysis model');
    } catch {
      // Create new model
      console.log('Creating new voice analysis model');
      this.model = this.createModel();
      
      // Train with real data if available
      if (!this.isDevelopmentMode) {
        await this.trainModel();
      }
    }

    return this.model;
  }

  private static createModel(): any {
    if (!tf) return null;
    
    const model = tf.sequential({
      layers: [
        tf.layers.dense({ inputShape: [13], units: 64, activation: 'relu' }),
        tf.layers.batchNormalization(),
        tf.layers.dropout({ rate: 0.3 }),
        tf.layers.dense({ units: 32, activation: 'relu' }),
        tf.layers.batchNormalization(),
        tf.layers.dropout({ rate: 0.2 }),
        tf.layers.dense({ units: 16, activation: 'relu' }),
        tf.layers.dense({ units: 1, activation: 'sigmoid' }) // Binary: spam or not
      ]
    });

    model.compile({
      optimizer: tf.train.adam(0.001),
      loss: 'binaryCrossentropy',
      metrics: ['accuracy']
    });

    return model;
  }

  static async trainModel(): Promise<void> {
    if (this.isTraining || !this.model) return;
    
    this.isTraining = true;
    
    try {
      // Get labeled voice patterns from database
      const patterns = await db.query.voicePatterns.findMany({
        where: (fields, { or, eq }) => 
          or(
            eq(fields.metadata, { source: 'verified_spam' } as any),
            eq(fields.metadata, { source: 'verified_legitimate' } as any)
          ),
        orderBy: desc(voicePatterns.createdAt),
        limit: 1000
      });

      if (patterns.length < 20) {
        console.log('Insufficient training data for voice analysis model');
        return;
      }

      // Extract features and labels
      const features: number[][] = [];
      const labels: number[] = [];

      for (const pattern of patterns) {
        const metadata = pattern.metadata as any;
        const featureData = pattern.features as any;
        
        if (featureData?.mfcc && Array.isArray(featureData.mfcc)) {
          features.push(featureData.mfcc.slice(0, 13));
          labels.push(metadata?.source === 'verified_spam' ? 1 : 0);
        }
      }

      if (features.length < 20) {
        console.log('Insufficient feature data for training');
        return;
      }

      const xs = tf.tensor2d(features);
      const ys = tf.tensor2d(labels, [labels.length, 1]);

      await this.model.fit(xs, ys, {
        epochs: 20,
        batchSize: 16,
        validationSplit: 0.2,
        shuffle: true,
        callbacks: {
          onEpochEnd: (epoch: number, logs: any) => {
            console.log(`Voice model epoch ${epoch}: loss=${logs?.loss.toFixed(4)}, accuracy=${logs?.acc?.toFixed(4)}`);
          }
        }
      });

      // Save the trained model
      await this.model.save('file://./models/voice_analysis_model');
      console.log('Voice analysis model trained and saved');

      xs.dispose();
      ys.dispose();
    } catch (error) {
      console.error('Error training voice analysis model:', error);
    } finally {
      this.isTraining = false;
    }
  }

  static async predict(mfccFeatures: number[]): Promise<number> {
    const model = await this.ensureModelLoaded();
    
    return tf.tidy(() => {
      const inputTensor = tf.tensor2d([mfccFeatures.slice(0, 13)]);
      const prediction = model.predict(inputTensor) as any;
      return prediction.dataSync()[0];
    });
  }
}

// Extract audio features using Meyda (reusing audio context)
function extractFeatures(audioData: Float32Array, sampleRate: number): VoiceFeatures {
  const audioContext = AudioContextManager.getContext();
  
  // Create analyzer with proper sample rate
  const meydaAnalyzer = Meyda.createMeydaAnalyzer({
    audioContext,
    sampleRate: sampleRate,
    bufferSize: 512,
    numberOfMFCCCoefficients: 13,
    featureExtractors: [
      'mfcc',
      'energy',
      'zcr',
      'spectralSlope',
      'spectralRolloff',
      'loudness',
      'perceptualSpread',
      'perceptualSharpness'
    ]
  });

  // Get features from the analyzer
  const features = meydaAnalyzer.get([
    'mfcc',
    'energy',
    'zcr',
    'spectralSlope',
    'spectralRolloff',
    'loudness',
    'perceptualSpread',
    'perceptualSharpness'
  ]) || {
    mfcc: Array(13).fill(0),
    energy: 0,
    zcr: 0,
    spectralSlope: 0,
    spectralRolloff: 0,
    loudness: { total: 0 },
    perceptualSpread: 0,
    perceptualSharpness: 0
  };

  return {
    mfcc: features.mfcc || Array(13).fill(0),
    energy: features.energy || 0,
    zeroCrossings: features.zcr || 0,
    spectralSlope: features.spectralSlope || 0,
    spectralRolloff: features.spectralRolloff || 0,
    loudness: features.loudness?.total || 0,
    perceptualSpread: features.perceptualSpread || 0,
    perceptualSharpness: features.perceptualSharpness || 0
  };
}

// Detect voice activity segments
function detectVoiceSegments(audioData: Float32Array, sampleRate: number): boolean[] {
  try {
    // Simple energy-based VAD since node-vad has interface issues
    const frameDuration = 30; // 30ms frames
    const frameSize = Math.floor((sampleRate * frameDuration) / 1000);
    const segments: boolean[] = [];
    const energyThreshold = 0.01; // Tune based on your audio

    for (let i = 0; i < audioData.length; i += frameSize) {
      const frame = audioData.slice(i, Math.min(i + frameSize, audioData.length));
      
      // Calculate frame energy
      const energy = frame.reduce((sum, val) => sum + val * val, 0) / frame.length;
      segments.push(energy > energyThreshold);
    }

    return segments;
  } catch (error) {
    console.error('Error in voice activity detection:', error);
    return [];
  }
}

// Calculate rhythm regularity (high regularity suggests robocalls)
function calculateRhythmRegularity(segments: boolean[]): number {
  if (segments.length === 0) return 0;
  
  const voiceSegmentLengths: number[] = [];
  let currentLength = 0;

  segments.forEach((isVoice, i) => {
    if (isVoice) {
      currentLength++;
    } else if (currentLength > 0) {
      voiceSegmentLengths.push(currentLength);
      currentLength = 0;
    }
  });

  if (currentLength > 0) {
    voiceSegmentLengths.push(currentLength);
  }

  if (voiceSegmentLengths.length < 2) return 0;

  const mean = voiceSegmentLengths.reduce((a, b) => a + b, 0) / voiceSegmentLengths.length;
  const variance = voiceSegmentLengths.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / voiceSegmentLengths.length;
  const stdDev = Math.sqrt(variance);

  // Low standard deviation relative to mean suggests high regularity
  return mean > 0 ? 1 - Math.min(1, stdDev / mean) : 0;
}

// Calculate naturalness score based on multiple features
function calculateNaturalness(features: VoiceFeatures, rhythmRegularity: number): number {
  let naturalness = 1.0;

  // Very regular rhythm reduces naturalness
  naturalness -= rhythmRegularity * 0.3;

  // Abnormal energy levels reduce naturalness
  if (features.energy < 0.05 || features.energy > 0.95) {
    naturalness -= 0.2;
  }

  // Very low or very high spectral spread suggests synthetic voice
  if (features.perceptualSpread < 0.1 || features.perceptualSpread > 0.9) {
    naturalness -= 0.2;
  }

  // Abnormal zero crossings
  const normalZCRange = [50, 500];
  if (features.zeroCrossings !== undefined && 
      (features.zeroCrossings < (normalZCRange[0] || 0) || 
       features.zeroCrossings > (normalZCRange[1] || 500))) {
    naturalness -= 0.15;
  }

  return Math.max(0, naturalness);
}

// Main analysis function
export async function analyzeVoice(audioData: Float32Array, sampleRate: number): Promise<VoiceAnalysisResult> {
  try {
    // Extract audio features
    const features = extractFeatures(audioData, sampleRate);

    // Detect voice activity
    const voiceSegments = detectVoiceSegments(audioData, sampleRate);

    // Calculate rhythm regularity
    const rhythmRegularity = calculateRhythmRegularity(voiceSegments);

    // Calculate naturalness
    const naturalness = calculateNaturalness(features, rhythmRegularity);

    // Get ML prediction
    const mlPrediction = await VoiceModelManager.predict(features.mfcc);

    // Combine heuristics and ML for final decision
    let confidence = mlPrediction * 0.6; // ML contributes 60%

    // Heuristic indicators (40% contribution)
    if (rhythmRegularity > 0.8) confidence += 0.15; // Very regular
    if (naturalness < 0.3) confidence += 0.15; // Unnatural
    if (features.energy > 0.9 || features.energy < 0.1) confidence += 0.10; // Abnormal energy

    confidence = Math.min(1, confidence);

    const isSpam = confidence > 0.6;

    const detectedFeatures: string[] = [];
    if (rhythmRegularity > 0.7) detectedFeatures.push('Regular rhythm pattern');
    if (naturalness < 0.4) detectedFeatures.push('Synthetic voice characteristics');
    if (features.energy < 0.1) detectedFeatures.push('Low energy (robocall)');
    if (mlPrediction > 0.7) detectedFeatures.push('ML spam classification');

    return {
      isSpam,
      confidence,
      features: detectedFeatures,
      patterns: {
        energy: features.energy,
        zeroCrossings: features.zeroCrossings,
        rhythmRegularity,
        naturalness,
        intonationVariance: features.perceptualSpread
      }
    };
  } catch (error) {
    console.error('Error in voice analysis:', error);
    
    // Return safe default on error
    return {
      isSpam: false,
      confidence: 0,
      features: ['Error in analysis'],
      patterns: {
        energy: 0,
        zeroCrossings: 0,
        rhythmRegularity: 0
      }
    };
  }
}

// Save voice pattern for training
export async function saveVoicePattern(
  features: VoiceFeatures,
  isSpam: boolean,
  confidence: number
): Promise<void> {
  try {
    await db.insert(voicePatterns).values({
      patternType: isSpam ? 'spam' : 'legitimate',
      confidence: confidence.toString(),
      features: {
        mfcc: features.mfcc,
        energy: features.energy,
        zeroCrossings: features.zeroCrossings,
        spectralSlope: features.spectralSlope
      },
      metadata: {
        source: isSpam ? 'detected_spam' : 'detected_legitimate',
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error saving voice pattern:', error);
  }
}

// Periodic model retraining (call this from a cron job)
export async function retrainVoiceModel(): Promise<void> {
  console.log('Starting voice model retraining...');
  await VoiceModelManager.trainModel();
}
