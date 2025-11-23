/**
 * Behavioral Biometrics
 * Creates unique caller fingerprints to track persistent scammers
 * Analyzes speech patterns, rhythm, and linguistic characteristics
 */

interface VoiceFingerprint {
  speakingRate: number; // Words per minute
  pausePatterns: number[]; // Average pause durations
  pitchRange: { min: number; max: number; average: number };
  intonationProfile: number[]; // Pitch variation over time
  vocabularySignature: string[]; // Common word patterns
  stressPatterns: number[]; // Emphasis on syllables
  articulationRate: number; // Phonemes per second
}

interface BiometricMatchResult {
  fingerprintId: string | null;
  matchConfidence: number;
  isPersistentScammer: boolean;
  previousCalls: number;
  reasonsMatched: string[];
  riskScore: number;
}

interface StoredFingerprint {
  id: string;
  fingerprint: VoiceFingerprint;
  isScammer: boolean;
  callCount: number;
  firstSeen: Date;
  lastSeen: Date;
  phoneNumbers: string[];
}

export class BehavioralBiometrics {
  private developmentMode: boolean;
  private fingerprintDatabase: Map<string, StoredFingerprint>;
  private matchThreshold: number = 0.75;

  constructor(developmentMode = false) {
    this.developmentMode = developmentMode;
    this.fingerprintDatabase = new Map();
  }

  /**
   * Analyze caller's behavioral biometrics
   */
  async analyzeBehavioralBiometrics(
    audioData: Float32Array,
    transcript: string,
    callerId: string,
    sampleRate: number = 8000
  ): Promise<BiometricMatchResult> {
    if (this.developmentMode) {
      return this.mockBiometricAnalysis(callerId);
    }

    try {
      // Extract voice fingerprint
      const fingerprint = await this.extractVoiceFingerprint(audioData, transcript, sampleRate);

      // Search for matching fingerprints
      const match = this.findMatchingFingerprint(fingerprint);

      if (match) {
        // Update existing fingerprint
        this.updateFingerprint(match.id, callerId, fingerprint);

        return {
          fingerprintId: match.id,
          matchConfidence: match.confidence,
          isPersistentScammer: match.isScammer,
          previousCalls: match.callCount,
          reasonsMatched: match.reasons,
          riskScore: match.isScammer ? 0.9 : 0.3
        };
      } else {
        // Create new fingerprint
        const newId = this.createFingerprint(callerId, fingerprint, false);

        return {
          fingerprintId: newId,
          matchConfidence: 1.0,
          isPersistentScammer: false,
          previousCalls: 1,
          reasonsMatched: ['New caller'],
          riskScore: 0.5
        };
      }
    } catch (error) {
      console.error('Behavioral biometrics error:', error);
      return {
        fingerprintId: null,
        matchConfidence: 0,
        isPersistentScammer: false,
        previousCalls: 0,
        reasonsMatched: ['Analysis failed'],
        riskScore: 0.5
      };
    }
  }

  /**
   * Extract voice fingerprint from audio and transcript
   */
  private async extractVoiceFingerprint(
    audioData: Float32Array,
    transcript: string,
    sampleRate: number
  ): Promise<VoiceFingerprint> {
    const speakingRate = this.calculateSpeakingRate(transcript, audioData.length / sampleRate);
    const pausePatterns = this.detectPausePatterns(audioData, sampleRate);
    const pitchRange = this.analyzePitchRange(audioData, sampleRate);
    const intonationProfile = this.extractIntonationProfile(audioData, sampleRate);
    const vocabularySignature = this.extractVocabularySignature(transcript);
    const stressPatterns = this.analyzeStressPatterns(audioData, sampleRate);
    const articulationRate = this.calculateArticulationRate(transcript, audioData.length / sampleRate);

    return {
      speakingRate,
      pausePatterns,
      pitchRange,
      intonationProfile,
      vocabularySignature,
      stressPatterns,
      articulationRate
    };
  }

  /**
   * Calculate speaking rate (words per minute)
   */
  private calculateSpeakingRate(transcript: string, durationSeconds: number): number {
    const words = transcript.split(/\s+/).filter(w => w.length > 0).length;
    return (words / durationSeconds) * 60;
  }

  /**
   * Detect pause patterns in speech
   */
  private detectPausePatterns(audioData: Float32Array, sampleRate: number): number[] {
    const silenceThreshold = 0.02;
    const minPauseDuration = 0.2; // 200ms
    const pauseDurations: number[] = [];
    
    let silenceStart: number | null = null;

    for (let i = 0; i < audioData.length; i++) {
      const isSilence = Math.abs(audioData[i] || 0) < silenceThreshold;

      if (isSilence && silenceStart === null) {
        silenceStart = i;
      } else if (!isSilence && silenceStart !== null) {
        const pauseDuration = (i - silenceStart) / sampleRate;
        if (pauseDuration >= minPauseDuration) {
          pauseDurations.push(pauseDuration);
        }
        silenceStart = null;
      }
    }

    // Return average pause durations by quartile
    if (pauseDurations.length === 0) return [0, 0, 0, 0];

    pauseDurations.sort((a, b) => a - b);
    return [
      pauseDurations[Math.floor(pauseDurations.length * 0.25)] || 0,
      pauseDurations[Math.floor(pauseDurations.length * 0.5)] || 0,
      pauseDurations[Math.floor(pauseDurations.length * 0.75)] || 0,
      pauseDurations[pauseDurations.length - 1] || 0
    ];
  }

  /**
   * Analyze pitch range
   */
  private analyzePitchRange(
    audioData: Float32Array,
    sampleRate: number
  ): { min: number; max: number; average: number } {
    const frameSize = Math.floor(sampleRate * 0.03); // 30ms frames
    const pitches: number[] = [];

    for (let i = 0; i < audioData.length - frameSize; i += frameSize) {
      const frame = audioData.slice(i, i + frameSize);
      const pitch = this.estimatePitch(frame, sampleRate);
      
      if (pitch > 0) {
        pitches.push(pitch);
      }
    }

    if (pitches.length === 0) {
      return { min: 0, max: 0, average: 0 };
    }

    return {
      min: Math.min(...pitches),
      max: Math.max(...pitches),
      average: pitches.reduce((sum, p) => sum + p, 0) / pitches.length
    };
  }

  /**
   * Estimate pitch using autocorrelation
   */
  private estimatePitch(frame: Float32Array, sampleRate: number): number {
    const minPitch = 80; // Hz
    const maxPitch = 400; // Hz
    const minLag = Math.floor(sampleRate / maxPitch);
    const maxLag = Math.floor(sampleRate / minPitch);

    let maxCorrelation = 0;
    let bestLag = 0;

    for (let lag = minLag; lag <= maxLag; lag++) {
      let correlation = 0;
      for (let i = 0; i < frame.length - lag; i++) {
        correlation += (frame[i] || 0) * (frame[i + lag] || 0);
      }

      if (correlation > maxCorrelation) {
        maxCorrelation = correlation;
        bestLag = lag;
      }
    }

    return bestLag > 0 ? sampleRate / bestLag : 0;
  }

  /**
   * Extract intonation profile
   */
  private extractIntonationProfile(audioData: Float32Array, sampleRate: number): number[] {
    const numSegments = 10;
    const segmentSize = Math.floor(audioData.length / numSegments);
    const profile: number[] = [];

    for (let i = 0; i < numSegments; i++) {
      const segment = audioData.slice(i * segmentSize, (i + 1) * segmentSize);
      const avgPitch = this.estimatePitch(segment, sampleRate);
      profile.push(avgPitch);
    }

    return profile;
  }

  /**
   * Extract vocabulary signature
   */
  private extractVocabularySignature(transcript: string): string[] {
    const words = transcript.toLowerCase().split(/\s+/);
    const wordFreq = new Map<string, number>();

    for (const word of words) {
      wordFreq.set(word, (wordFreq.get(word) || 0) + 1);
    }

    // Return top 10 most frequent words
    return Array.from(wordFreq.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([word]) => word);
  }

  /**
   * Analyze stress patterns
   */
  private analyzeStressPatterns(audioData: Float32Array, sampleRate: number): number[] {
    const frameSize = Math.floor(sampleRate * 0.1); // 100ms frames
    const stressLevels: number[] = [];

    for (let i = 0; i < audioData.length - frameSize; i += frameSize) {
      const frame = audioData.slice(i, i + frameSize);
      
      // Stress is indicated by higher energy
      const energy = frame.reduce((sum, val) => sum + (val || 0) * (val || 0), 0) / frame.length;
      stressLevels.push(energy);
    }

    return stressLevels;
  }

  /**
   * Calculate articulation rate
   */
  private calculateArticulationRate(transcript: string, durationSeconds: number): number {
    // Approximate: 1.5 phonemes per character in English
    const estimatedPhonemes = transcript.length * 1.5;
    return estimatedPhonemes / durationSeconds;
  }

  /**
   * Find matching fingerprint in database
   */
  private findMatchingFingerprint(fingerprint: VoiceFingerprint): {
    id: string;
    confidence: number;
    isScammer: boolean;
    callCount: number;
    reasons: string[];
  } | null {
    let bestMatch: { id: string; confidence: number; isScammer: boolean; callCount: number; reasons: string[] } | null = null;
    let highestConfidence = 0;

    for (const [id, stored] of this.fingerprintDatabase.entries()) {
      const { confidence, reasons } = this.compareFingerprints(fingerprint, stored.fingerprint);

      if (confidence > highestConfidence && confidence >= this.matchThreshold) {
        highestConfidence = confidence;
        bestMatch = {
          id,
          confidence,
          isScammer: stored.isScammer,
          callCount: stored.callCount,
          reasons
        };
      }
    }

    return bestMatch;
  }

  /**
   * Compare two fingerprints
   */
  private compareFingerprints(
    fp1: VoiceFingerprint,
    fp2: VoiceFingerprint
  ): { confidence: number; reasons: string[] } {
    const reasons: string[] = [];
    let totalScore = 0;
    let weights = 0;

    // Speaking rate similarity (15% weight)
    const speakingRateDiff = Math.abs(fp1.speakingRate - fp2.speakingRate);
    const speakingRateScore = Math.max(0, 1 - speakingRateDiff / 100);
    totalScore += speakingRateScore * 0.15;
    weights += 0.15;
    if (speakingRateScore > 0.8) reasons.push('Similar speaking rate');

    // Pause patterns similarity (10% weight)
    const pauseSimilarity = this.compareArrays(fp1.pausePatterns, fp2.pausePatterns);
    totalScore += pauseSimilarity * 0.1;
    weights += 0.1;
    if (pauseSimilarity > 0.8) reasons.push('Similar pause patterns');

    // Pitch range similarity (20% weight)
    const pitchSimilarity = this.comparePitchRanges(fp1.pitchRange, fp2.pitchRange);
    totalScore += pitchSimilarity * 0.2;
    weights += 0.2;
    if (pitchSimilarity > 0.8) reasons.push('Similar pitch range');

    // Intonation similarity (15% weight)
    const intonationSimilarity = this.compareArrays(fp1.intonationProfile, fp2.intonationProfile);
    totalScore += intonationSimilarity * 0.15;
    weights += 0.15;
    if (intonationSimilarity > 0.8) reasons.push('Similar intonation patterns');

    // Vocabulary overlap (25% weight)
    const vocabSimilarity = this.compareVocabulary(fp1.vocabularySignature, fp2.vocabularySignature);
    totalScore += vocabSimilarity * 0.25;
    weights += 0.25;
    if (vocabSimilarity > 0.7) reasons.push('Similar vocabulary usage');

    // Articulation rate similarity (15% weight)
    const articulationDiff = Math.abs(fp1.articulationRate - fp2.articulationRate);
    const articulationScore = Math.max(0, 1 - articulationDiff / 10);
    totalScore += articulationScore * 0.15;
    weights += 0.15;
    if (articulationScore > 0.8) reasons.push('Similar articulation rate');

    const confidence = totalScore / weights;
    return { confidence, reasons };
  }

  /**
   * Compare two numeric arrays
   */
  private compareArrays(arr1: number[], arr2: number[]): number {
    if (arr1.length !== arr2.length) return 0;

    let sumSquaredDiff = 0;
    let sumSquared1 = 0;
    let sumSquared2 = 0;

    for (let i = 0; i < arr1.length; i++) {
      const diff = (arr1[i] || 0) - (arr2[i] || 0);
      sumSquaredDiff += diff * diff;
      sumSquared1 += (arr1[i] || 0) * (arr1[i] || 0);
      sumSquared2 += (arr2[i] || 0) * (arr2[i] || 0);
    }

    const magnitude = Math.sqrt(sumSquared1 * sumSquared2);
    return magnitude > 0 ? 1 - Math.sqrt(sumSquaredDiff) / magnitude : 0;
  }

  /**
   * Compare pitch ranges
   */
  private comparePitchRanges(
    range1: { min: number; max: number; average: number },
    range2: { min: number; max: number; average: number }
  ): number {
    const minDiff = Math.abs(range1.min - range2.min);
    const maxDiff = Math.abs(range1.max - range2.max);
    const avgDiff = Math.abs(range1.average - range2.average);

    const maxPitch = 400;
    const similarity = 1 - (minDiff + maxDiff + avgDiff) / (3 * maxPitch);

    return Math.max(0, similarity);
  }

  /**
   * Compare vocabulary signatures
   */
  private compareVocabulary(vocab1: string[], vocab2: string[]): number {
    const set1 = new Set(vocab1);
    const set2 = new Set(vocab2);
    
    const intersection = new Set([...set1].filter(word => set2.has(word)));
    const union = new Set([...set1, ...set2]);

    return union.size > 0 ? intersection.size / union.size : 0;
  }

  /**
   * Create new fingerprint
   */
  private createFingerprint(
    callerId: string,
    fingerprint: VoiceFingerprint,
    isScammer: boolean
  ): string {
    const id = `fp_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    this.fingerprintDatabase.set(id, {
      id,
      fingerprint,
      isScammer,
      callCount: 1,
      firstSeen: new Date(),
      lastSeen: new Date(),
      phoneNumbers: [callerId]
    });

    return id;
  }

  /**
   * Update existing fingerprint
   */
  private updateFingerprint(
    fingerprintId: string,
    callerId: string,
    newFingerprint: VoiceFingerprint
  ): void {
    const stored = this.fingerprintDatabase.get(fingerprintId);
    
    if (stored) {
      stored.callCount++;
      stored.lastSeen = new Date();
      
      if (!stored.phoneNumbers.includes(callerId)) {
        stored.phoneNumbers.push(callerId);
      }

      // Update fingerprint with exponential moving average
      const alpha = 0.3; // Weight for new data
      stored.fingerprint.speakingRate = 
        alpha * newFingerprint.speakingRate + (1 - alpha) * stored.fingerprint.speakingRate;
      stored.fingerprint.articulationRate = 
        alpha * newFingerprint.articulationRate + (1 - alpha) * stored.fingerprint.articulationRate;
    }
  }

  /**
   * Mark fingerprint as scammer
   */
  markAsScammer(fingerprintId: string): void {
    const stored = this.fingerprintDatabase.get(fingerprintId);
    if (stored) {
      stored.isScammer = true;
    }
  }

  /**
   * Development mode mock
   */
  private mockBiometricAnalysis(callerId: string): BiometricMatchResult {
    const hash = callerId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const scenario = hash % 3;

    const scenarios = [
      {
        fingerprintId: 'fp_scammer_persistent',
        matchConfidence: 0.92,
        isPersistentScammer: true,
        previousCalls: 47,
        reasonsMatched: ['Similar speaking rate', 'Similar pitch range', 'Similar vocabulary usage'],
        riskScore: 0.95
      },
      {
        fingerprintId: 'fp_legitimate_returning',
        matchConfidence: 0.88,
        isPersistentScammer: false,
        previousCalls: 3,
        reasonsMatched: ['Similar pause patterns', 'Similar articulation rate'],
        riskScore: 0.15
      },
      {
        fingerprintId: `fp_new_${callerId}`,
        matchConfidence: 1.0,
        isPersistentScammer: false,
        previousCalls: 1,
        reasonsMatched: ['New caller'],
        riskScore: 0.5
      }
    ];

    return scenarios[scenario] || scenarios[2];
  }
}

export default BehavioralBiometrics;
