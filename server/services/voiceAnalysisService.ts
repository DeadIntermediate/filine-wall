import * as tf from '@tensorflow/tfjs-node';
import * as webAudio from 'web-audio-api';
import Meyda from 'meyda';
import * as vad from 'node-vad';
import { db } from "@db";
import { voicePatterns } from "@db/schema";

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

// Initialize TensorFlow model for audio analysis
let audioModel: tf.LayersModel;

async function loadModel() {
  try {
    const model = tf.sequential({
      layers: [
        tf.layers.dense({ inputShape: [13], units: 64, activation: 'relu' }),
        tf.layers.dropout({ rate: 0.2 }),
        tf.layers.dense({ units: 32, activation: 'relu' }),
        tf.layers.dense({ units: 4, activation: 'softmax' })
      ]
    });

    model.compile({
      optimizer: tf.train.adam(0.001),
      loss: 'categoricalCrossentropy',
      metrics: ['accuracy']
    });

    audioModel = model;
  } catch (error) {
    console.error('Error loading audio model:', error);
    throw error;
  }
}

// Extract audio features using Meyda
function extractFeatures(audioData: Float32Array): VoiceFeatures {
  const audioContext = new webAudio.AudioContext();
  const meydaAnalyzer = Meyda.createMeydaAnalyzer({
    audioContext,
    sampleRate: audioContext.sampleRate,
    bufferSize: 512,
    numberOfMFCCCoefficients: 13
  });

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
    mfcc: [],
    energy: 0,
    zcr: 0,
    spectralSlope: 0,
    spectralRolloff: 0,
    loudness: { total: 0 },
    perceptualSpread: 0,
    perceptualSharpness: 0
  };

  return {
    mfcc: features.mfcc || [],
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
function detectVoiceSegments(audioData: Float32Array): boolean[] {
  const vadInstance = new vad(vad.Mode.NORMAL);
  const frameSize = 480; // 30ms at 16kHz
  const segments: boolean[] = [];

  for (let i = 0; i < audioData.length; i += frameSize) {
    const frame = audioData.slice(i, i + frameSize);
    const result = vadInstance.process(frame);
    segments.push(result === vad.Event.VOICE);
  }

  return segments;
}

// Calculate rhythm regularity
function calculateRhythmRegularity(segments: boolean[]): number {
  let voiceSegmentLengths: number[] = [];
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

  return 1 - Math.min(1, variance / mean);
}

// Main analysis function
export async function analyzeVoice(audioData: Float32Array, sampleRate: number): Promise<VoiceAnalysisResult> {
  if (!audioModel) {
    await loadModel();
  }

  try {
    // Extract features
    const features = extractFeatures(audioData);
    const voiceSegments = detectVoiceSegments(audioData);

    // Calculate rhythm regularity
    const rhythmRegularity = calculateRhythmRegularity(voiceSegments);

    // Prepare input for TensorFlow model
    const input = tf.tensor2d([features.mfcc]);
    const prediction = audioModel.predict(input) as tf.Tensor;
    const scores = Array.from(await prediction.data());

    // Calculate spam probability
    const spamIndicators = [
      rhythmRegularity > 0.8, // Too regular rhythm
      features.energy < 0.2,  // Too low energy
      features.zeroCrossings > 1000 // Too many zero crossings
    ];

    const spamProbability = spamIndicators.filter(Boolean).length / spamIndicators.length;

    // Generate feature descriptions
    const featureDescriptions = [];

    if (rhythmRegularity > 0.8) {
      featureDescriptions.push('Unusually regular speech rhythm detected');
    }

    if (features.energy < 0.2) {
      featureDescriptions.push('Abnormally low voice energy');
    }

    if (features.zeroCrossings > 1000) {
      featureDescriptions.push('High frequency of voice pattern changes');
    }

    const result: VoiceAnalysisResult = {
      isSpam: spamProbability > 0.6,
      confidence: Math.max(...scores),
      features: featureDescriptions,
      patterns: {
        energy: features.energy,
        zeroCrossings: features.zeroCrossings,
        rhythmRegularity,
        intonationVariance: features.spectralSlope
      }
    };

    return result;
  } catch (error) {
    console.error('Voice analysis error:', error);
    throw error;
  }
}

// Load the model when the service starts
loadModel().catch(console.error);