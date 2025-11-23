/**
 * Acoustic Environment Analysis
 * Detects call center environments vs individual callers
 * Analyzes background noise, multiple voices, equipment sounds
 */

import { logger } from '../utils/logger';

interface AcousticFeatures {
  backgroundNoiseLevel: number;
  multipleVoicesDetected: boolean;
  callCenterSounds: {
    keyboardClicks: boolean;
    phoneRings: boolean;
    otherConversations: boolean;
  };
  echoReverb: number;
  environmentType: 'call-center' | 'office' | 'home' | 'outdoor' | 'unknown';
  confidence: number;
}

interface AcousticAnalysisResult {
  isCallCenter: boolean;
  features: AcousticFeatures;
  riskScore: number;
  reason: string;
}

export class AcousticEnvironmentAnalysis {
  private developmentMode: boolean;

  constructor(developmentMode = false) {
    this.developmentMode = developmentMode;
  }

  /**
   * Analyze acoustic environment of caller
   */
  async analyzeAcousticEnvironment(
    audioData: Float32Array | Buffer,
    sampleRate: number = 8000
  ): Promise<AcousticAnalysisResult> {
    if (this.developmentMode) {
      return this.mockAcousticAnalysis();
    }

    try {
      const features = await this.extractAcousticFeatures(audioData, sampleRate);
      const isCallCenter = this.detectCallCenter(features);
      const riskScore = this.calculateRiskScore(features, isCallCenter);
      const reason = this.generateReason(features, isCallCenter);

      return {
        isCallCenter,
        features,
        riskScore,
        reason
      };
    } catch (error) {
      console.error('Acoustic analysis error:', error);
      return {
        isCallCenter: false,
        features: this.getDefaultFeatures(),
        riskScore: 0.5,
        reason: 'Acoustic analysis failed'
      };
    }
  }

  /**
   * Extract acoustic features from audio
   */
  private async extractAcousticFeatures(
    audioData: Float32Array | Buffer,
    sampleRate: number
  ): Promise<AcousticFeatures> {
    // Convert Buffer to Float32Array if needed
    const samples = audioData instanceof Buffer 
      ? this.bufferToFloat32Array(audioData)
      : audioData;

    // Analyze background noise
    const backgroundNoiseLevel = this.analyzeBackgroundNoise(samples);

    // Detect multiple simultaneous voices
    const multipleVoicesDetected = this.detectMultipleVoices(samples, sampleRate);

    // Detect call center specific sounds
    const callCenterSounds = this.detectCallCenterSounds(samples, sampleRate);

    // Analyze echo and reverb
    const echoReverb = this.analyzeEchoReverb(samples);

    // Classify environment
    const { environmentType, confidence } = this.classifyEnvironment({
      backgroundNoiseLevel,
      multipleVoicesDetected,
      callCenterSounds,
      echoReverb
    });

    return {
      backgroundNoiseLevel,
      multipleVoicesDetected,
      callCenterSounds,
      echoReverb,
      environmentType,
      confidence
    };
  }

  /**
   * Convert Buffer to Float32Array
   */
  private bufferToFloat32Array(buffer: Buffer): Float32Array {
    const float32 = new Float32Array(buffer.length / 2);
    for (let i = 0; i < float32.length; i++) {
      const int16 = buffer.readInt16LE(i * 2);
      float32[i] = int16 / 32768.0; // Normalize to -1 to 1
    }
    return float32;
  }

  /**
   * Analyze background noise level
   */
  private analyzeBackgroundNoise(samples: Float32Array): number {
    // Calculate RMS of lower 20% amplitude samples (background)
    const sortedMagnitudes = Array.from(samples)
      .map(s => Math.abs(s))
      .sort((a, b) => a - b);

    const backgroundSamples = sortedMagnitudes.slice(0, Math.floor(sortedMagnitudes.length * 0.2));
    const sumSquares = backgroundSamples.reduce((sum, val) => sum + val * val, 0);
    const rms = Math.sqrt(sumSquares / backgroundSamples.length);

    return rms;
  }

  /**
   * Detect multiple simultaneous voices
   */
  private detectMultipleVoices(samples: Float32Array, sampleRate: number): boolean {
    // Use spectral analysis to detect overlapping formants (voice characteristics)
    const fftSize = 2048;
    const numFrames = Math.floor(samples.length / fftSize);
    
    let overlappingFormantFrames = 0;

    for (let i = 0; i < numFrames; i++) {
      const frame = samples.slice(i * fftSize, (i + 1) * fftSize);
      const spectrum = this.simpleFFT(frame);
      
      // Detect multiple formant peaks (indicates multiple speakers)
      const formantPeaks = this.findFormantPeaks(spectrum, sampleRate);
      
      if (formantPeaks.length >= 6) { // 2 speakers × 3 formants each
        overlappingFormantFrames++;
      }
    }

    // If more than 30% of frames have overlapping formants
    return overlappingFormantFrames / numFrames > 0.3;
  }

  /**
   * Simple FFT approximation for formant detection
   */
  private simpleFFT(samples: Float32Array): Float32Array {
    const n = samples.length;
    const magnitudes = new Float32Array(n / 2);

    for (let k = 0; k < n / 2; k++) {
      let real = 0;
      let imag = 0;

      for (let t = 0; t < n; t++) {
        const angle = (2 * Math.PI * k * t) / n;
        real += samples[t] * Math.cos(angle);
        imag += samples[t] * Math.sin(angle);
      }

      magnitudes[k] = Math.sqrt(real * real + imag * imag);
    }

    return magnitudes;
  }

  /**
   * Find formant peaks in spectrum
   */
  private findFormantPeaks(spectrum: Float32Array, sampleRate: number): number[] {
    const peaks: number[] = [];
    const threshold = Math.max(...Array.from(spectrum)) * 0.3;

    for (let i = 1; i < spectrum.length - 1; i++) {
      if (spectrum[i] > threshold && 
          spectrum[i] > spectrum[i - 1] && 
          spectrum[i] > spectrum[i + 1]) {
        const frequency = (i * sampleRate) / (spectrum.length * 2);
        
        // Human voice formants typically in 300-3500 Hz
        if (frequency >= 300 && frequency <= 3500) {
          peaks.push(frequency);
        }
      }
    }

    return peaks;
  }

  /**
   * Detect call center specific sounds
   */
  private detectCallCenterSounds(
    samples: Float32Array,
    sampleRate: number
  ): { keyboardClicks: boolean; phoneRings: boolean; otherConversations: boolean } {
    // Keyboard clicks: Sharp transients with high-frequency content
    const keyboardClicks = this.detectKeyboardClicks(samples);

    // Phone rings: Periodic 440-480 Hz tones
    const phoneRings = this.detectPhoneRings(samples, sampleRate);

    // Other conversations: Voice activity in background
    const otherConversations = this.detectBackgroundConversations(samples);

    return {
      keyboardClicks,
      phoneRings,
      otherConversations
    };
  }

  /**
   * Detect keyboard clicking sounds
   */
  private detectKeyboardClicks(samples: Float32Array): boolean {
    let clickCount = 0;
    const windowSize = 400; // ~50ms at 8kHz

    for (let i = windowSize; i < samples.length; i += windowSize) {
      const window = samples.slice(i - windowSize, i);
      const energy = window.reduce((sum, val) => sum + val * val, 0);
      const prevWindow = samples.slice(i - windowSize * 2, i - windowSize);
      const prevEnergy = prevWindow.reduce((sum, val) => sum + val * val, 0);

      // Sharp energy increase = potential click
      if (energy > prevEnergy * 3) {
        clickCount++;
      }
    }

    // More than 5 clicks per second indicates typing
    const duration = samples.length / 8000;
    return clickCount / duration > 5;
  }

  /**
   * Detect phone ringing tones
   */
  private detectPhoneRings(samples: Float32Array, sampleRate: number): boolean {
    // Look for 440-480 Hz periodic signals
    const spectrum = this.simpleFFT(samples.slice(0, Math.min(samples.length, 8000)));
    const freqBinSize = sampleRate / spectrum.length / 2;

    const ringFreqBins = [
      Math.floor(440 / freqBinSize),
      Math.floor(480 / freqBinSize)
    ];

    let ringEnergy = 0;
    for (const bin of ringFreqBins) {
      if (bin < spectrum.length) {
        ringEnergy += spectrum[bin];
      }
    }

    const totalEnergy = spectrum.reduce((sum, val) => sum + val, 0);
    return ringEnergy / totalEnergy > 0.15;
  }

  /**
   * Detect background conversations
   */
  private detectBackgroundConversations(samples: Float32Array): boolean {
    // Split audio into foreground (louder) and background (quieter)
    const median = this.median(Array.from(samples).map(Math.abs));
    
    const foregroundSamples = samples.filter(s => Math.abs(s) > median);
    const backgroundSamples = samples.filter(s => Math.abs(s) <= median);

    // Detect voice-like patterns in background
    const backgroundVariance = this.variance(Array.from(backgroundSamples));
    
    // Background conversations have moderate variance
    return backgroundVariance > 0.01 && backgroundVariance < 0.1;
  }

  /**
   * Analyze echo and reverb
   */
  private analyzeEchoReverb(samples: Float32Array): number {
    // Calculate autocorrelation to detect echo
    const maxLag = 400; // 50ms at 8kHz
    let maxCorrelation = 0;

    for (let lag = 40; lag < maxLag; lag++) {
      let correlation = 0;
      for (let i = 0; i < samples.length - lag; i++) {
        correlation += samples[i] * samples[i + lag];
      }
      correlation /= samples.length - lag;
      maxCorrelation = Math.max(maxCorrelation, Math.abs(correlation));
    }

    return maxCorrelation;
  }

  /**
   * Classify environment type
   */
  private classifyEnvironment(partialFeatures: Partial<AcousticFeatures>): {
    environmentType: 'call-center' | 'office' | 'home' | 'outdoor' | 'unknown';
    confidence: number;
  } {
    let callCenterScore = 0;
    let officeScore = 0;
    let homeScore = 0;
    let outdoorScore = 0;

    // Call center indicators
    if (partialFeatures.multipleVoicesDetected) callCenterScore += 30;
    if (partialFeatures.callCenterSounds?.keyboardClicks) callCenterScore += 25;
    if (partialFeatures.callCenterSounds?.phoneRings) callCenterScore += 20;
    if (partialFeatures.callCenterSounds?.otherConversations) callCenterScore += 25;
    if ((partialFeatures.backgroundNoiseLevel || 0) > 0.1) callCenterScore += 10;
    if ((partialFeatures.echoReverb || 0) > 0.3) callCenterScore += 15;

    // Office indicators (similar but less intense)
    if (partialFeatures.callCenterSounds?.keyboardClicks) officeScore += 20;
    if ((partialFeatures.backgroundNoiseLevel || 0) > 0.05 && (partialFeatures.backgroundNoiseLevel || 0) < 0.15) officeScore += 15;

    // Home indicators
    if ((partialFeatures.backgroundNoiseLevel || 0) < 0.05) homeScore += 30;
    if (!partialFeatures.multipleVoicesDetected) homeScore += 20;
    if (!partialFeatures.callCenterSounds?.keyboardClicks) homeScore += 15;

    // Outdoor indicators
    if ((partialFeatures.backgroundNoiseLevel || 0) > 0.2) outdoorScore += 25;
    if ((partialFeatures.echoReverb || 0) < 0.1) outdoorScore += 15;

    const scores = { callCenterScore, officeScore, homeScore, outdoorScore };
    const maxScore = Math.max(...Object.values(scores));

    let environmentType: 'call-center' | 'office' | 'home' | 'outdoor' | 'unknown' = 'unknown';
    if (maxScore >= 50) {
      if (maxScore === callCenterScore) environmentType = 'call-center';
      else if (maxScore === officeScore) environmentType = 'office';
      else if (maxScore === homeScore) environmentType = 'home';
      else if (maxScore === outdoorScore) environmentType = 'outdoor';
    }

    const confidence = Math.min(maxScore / 100, 1.0);

    return { environmentType, confidence };
  }

  /**
   * Detect if environment is call center
   */
  private detectCallCenter(features: AcousticFeatures): boolean {
    return features.environmentType === 'call-center';
  }

  /**
   * Calculate risk score
   */
  private calculateRiskScore(features: AcousticFeatures, isCallCenter: boolean): number {
    if (!isCallCenter) {
      return 0.15;
    }

    let risk = 0.6; // Base risk for call center

    if (features.multipleVoicesDetected) risk += 0.1;
    if (features.callCenterSounds.keyboardClicks) risk += 0.1;
    if (features.callCenterSounds.phoneRings) risk += 0.05;
    if (features.callCenterSounds.otherConversations) risk += 0.1;
    if (features.backgroundNoiseLevel > 0.15) risk += 0.05;

    return Math.min(risk, 0.95);
  }

  /**
   * Generate human-readable reason
   */
  private generateReason(features: AcousticFeatures, isCallCenter: boolean): string {
    if (!isCallCenter) {
      return `Environment appears to be ${features.environmentType}`;
    }

    const indicators: string[] = [];
    if (features.multipleVoicesDetected) indicators.push('multiple voices detected');
    if (features.callCenterSounds.keyboardClicks) indicators.push('keyboard typing sounds');
    if (features.callCenterSounds.phoneRings) indicators.push('phone ringing in background');
    if (features.callCenterSounds.otherConversations) indicators.push('background conversations');
    if (features.backgroundNoiseLevel > 0.15) indicators.push('high background noise');

    return `Call center environment detected: ${indicators.join(', ')}`;
  }

  /**
   * Get default features
   */
  private getDefaultFeatures(): AcousticFeatures {
    return {
      backgroundNoiseLevel: 0,
      multipleVoicesDetected: false,
      callCenterSounds: {
        keyboardClicks: false,
        phoneRings: false,
        otherConversations: false
      },
      echoReverb: 0,
      environmentType: 'unknown',
      confidence: 0
    };
  }

  /**
   * Helper: Calculate median
   */
  private median(arr: number[]): number {
    const sorted = arr.slice().sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0
      ? (sorted[mid - 1] + sorted[mid]) / 2
      : sorted[mid];
  }

  /**
   * Helper: Calculate variance
   */
  private variance(arr: number[]): number {
    const mean = arr.reduce((sum, val) => sum + val, 0) / arr.length;
    const squaredDiffs = arr.map(val => Math.pow(val - mean, 2));
    return squaredDiffs.reduce((sum, val) => sum + val, 0) / arr.length;
  }

  /**
   * Development mode mock
   */
  private mockAcousticAnalysis(): AcousticAnalysisResult {
    const scenarios = [
      {
        isCallCenter: true,
        features: {
          backgroundNoiseLevel: 0.18,
          multipleVoicesDetected: true,
          callCenterSounds: {
            keyboardClicks: true,
            phoneRings: true,
            otherConversations: true
          },
          echoReverb: 0.35,
          environmentType: 'call-center' as const,
          confidence: 0.92
        },
        riskScore: 0.85,
        reason: 'Call center environment detected: multiple voices detected, keyboard typing sounds, phone ringing in background, background conversations, high background noise'
      },
      {
        isCallCenter: false,
        features: {
          backgroundNoiseLevel: 0.03,
          multipleVoicesDetected: false,
          callCenterSounds: {
            keyboardClicks: false,
            phoneRings: false,
            otherConversations: false
          },
          echoReverb: 0.12,
          environmentType: 'home' as const,
          confidence: 0.88
        },
        riskScore: 0.15,
        reason: 'Environment appears to be home'
      },
      {
        isCallCenter: false,
        features: {
          backgroundNoiseLevel: 0.08,
          multipleVoicesDetected: false,
          callCenterSounds: {
            keyboardClicks: true,
            phoneRings: false,
            otherConversations: false
          },
          echoReverb: 0.22,
          environmentType: 'office' as const,
          confidence: 0.75
        },
        riskScore: 0.25,
        reason: 'Environment appears to be office'
      }
    ];

    const index = Math.floor(Math.random() * scenarios.length);
    return scenarios[index] ?? scenarios[0]!;
  }
}

export default AcousticEnvironmentAnalysis;
