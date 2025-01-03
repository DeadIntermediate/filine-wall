import { db } from "@db";
import { sql } from "drizzle-orm";
import { voicePatterns } from "@db/schema";

interface PatternFeatures {
  mfcc: number[];
  spectral: {
    centroid: number;
    rolloff: number;
    bandwidth: number;
  };
  temporal: {
    zeroCrossings: number;
    energy: number;
  };
  pitch: {
    mean: number;
    variance: number;
  };
  rhythm: {
    tempo: number;
    beatStrength: number;
  };
}

interface LearningResult {
  success: boolean;
  updatedPatterns: number;
  confidence: number;
}

export class VoicePatternLearner {
  private static instance: VoicePatternLearner;
  private patternCache: Map<string, PatternFeatures[]>;
  private updateInterval: number = 300000; // 5 minutes

  private constructor() {
    this.patternCache = new Map();
    this.startPeriodicUpdate();
  }

  public static getInstance(): VoicePatternLearner {
    if (!VoicePatternLearner.instance) {
      VoicePatternLearner.instance = new VoicePatternLearner();
    }
    return VoicePatternLearner.instance;
  }

  private startPeriodicUpdate() {
    setInterval(() => this.updatePatternDatabase(), this.updateInterval);
  }

  public async learnFromPattern(
    features: PatternFeatures,
    classification: string,
    language?: string
  ): Promise<LearningResult> {
    try {
      // Add to cache for batch processing
      const key = `${classification}_${language || 'unknown'}`;
      if (!this.patternCache.has(key)) {
        this.patternCache.set(key, []);
      }
      this.patternCache.get(key)?.push(features);

      // If cache reaches threshold, trigger update
      if (this.patternCache.get(key)?.length ?? 0 >= 10) {
        await this.updatePatternDatabase();
      }

      return {
        success: true,
        updatedPatterns: 1,
        confidence: this.calculateConfidence(features)
      };
    } catch (error) {
      console.error('Error learning pattern:', error);
      return {
        success: false,
        updatedPatterns: 0,
        confidence: 0
      };
    }
  }

  private async updatePatternDatabase() {
    for (const [key, patterns] of this.patternCache.entries()) {
      if (patterns.length === 0) continue;

      const [classification, language] = key.split('_');
      const averagePattern = this.calculateAveragePattern(patterns);

      // Update or insert pattern
      await db
        .insert(voicePatterns)
        .values({
          patternType: classification,
          features: averagePattern,
          confidence: this.calculateConfidence(averagePattern),
          language: language !== 'unknown' ? language : null,
          metadata: {
            sampleSize: patterns.length,
            lastUpdate: new Date().toISOString()
          }
        })
        .onConflictDoUpdate({
          target: [voicePatterns.patternType, voicePatterns.language],
          set: {
            features: sql`jsonb_merge_patch(${voicePatterns.features}, ${averagePattern})`,
            updatedAt: new Date(),
            confidence: sql`(${voicePatterns.confidence} + ${this.calculateConfidence(averagePattern)}) / 2`
          }
        });
    }

    // Clear cache after update
    this.patternCache.clear();
  }

  private calculateAveragePattern(patterns: PatternFeatures[]): PatternFeatures {
    const sum = patterns.reduce((acc, pattern) => ({
      mfcc: pattern.mfcc.map((v, i) => (acc.mfcc[i] || 0) + v),
      spectral: {
        centroid: acc.spectral.centroid + pattern.spectral.centroid,
        rolloff: acc.spectral.rolloff + pattern.spectral.rolloff,
        bandwidth: acc.spectral.bandwidth + pattern.spectral.bandwidth
      },
      temporal: {
        zeroCrossings: acc.temporal.zeroCrossings + pattern.temporal.zeroCrossings,
        energy: acc.temporal.energy + pattern.temporal.energy
      },
      pitch: {
        mean: acc.pitch.mean + pattern.pitch.mean,
        variance: acc.pitch.variance + pattern.pitch.variance
      },
      rhythm: {
        tempo: acc.rhythm.tempo + pattern.rhythm.tempo,
        beatStrength: acc.rhythm.beatStrength + pattern.rhythm.beatStrength
      }
    }), this.getEmptyPattern());

    const count = patterns.length;
    return {
      mfcc: sum.mfcc.map(v => v / count),
      spectral: {
        centroid: sum.spectral.centroid / count,
        rolloff: sum.spectral.rolloff / count,
        bandwidth: sum.spectral.bandwidth / count
      },
      temporal: {
        zeroCrossings: sum.temporal.zeroCrossings / count,
        energy: sum.temporal.energy / count
      },
      pitch: {
        mean: sum.pitch.mean / count,
        variance: sum.pitch.variance / count
      },
      rhythm: {
        tempo: sum.rhythm.tempo / count,
        beatStrength: sum.rhythm.beatStrength / count
      }
    };
  }

  private calculateConfidence(pattern: PatternFeatures): number {
    // Calculate confidence based on pattern strength and consistency
    const features = [
      ...pattern.mfcc,
      pattern.spectral.centroid,
      pattern.spectral.rolloff,
      pattern.spectral.bandwidth,
      pattern.temporal.zeroCrossings,
      pattern.temporal.energy,
      pattern.pitch.mean,
      pattern.pitch.variance,
      pattern.rhythm.tempo,
      pattern.rhythm.beatStrength
    ];

    const variance = this.calculateVariance(features);
    return Math.min(1, Math.max(0, 1 - variance));
  }

  private calculateVariance(values: number[]): number {
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const squareDiffs = values.map(value => Math.pow(value - mean, 2));
    return Math.sqrt(squareDiffs.reduce((a, b) => a + b, 0) / values.length);
  }

  private getEmptyPattern(): PatternFeatures {
    return {
      mfcc: Array(13).fill(0),
      spectral: { centroid: 0, rolloff: 0, bandwidth: 0 },
      temporal: { zeroCrossings: 0, energy: 0 },
      pitch: { mean: 0, variance: 0 },
      rhythm: { tempo: 0, beatStrength: 0 }
    };
  }

  public async matchPattern(
    features: PatternFeatures,
    language?: string
  ): Promise<{ type: string; confidence: number }> {
    const patterns = await db
      .select()
      .from(voicePatterns)
      .where(sql`${voicePatterns.language} = ${language} OR ${voicePatterns.language} IS NULL`);

    let bestMatch = { type: 'unknown', confidence: 0 };
    for (const pattern of patterns) {
      const similarity = this.calculatePatternSimilarity(features, pattern.features as PatternFeatures);
      if (similarity > bestMatch.confidence) {
        bestMatch = {
          type: pattern.patternType,
          confidence: similarity * Number(pattern.confidence)
        };
      }
    }

    return bestMatch;
  }

  private calculatePatternSimilarity(a: PatternFeatures, b: PatternFeatures): number {
    // Calculate cosine similarity between feature vectors
    const vectorA = this.flattenFeatures(a);
    const vectorB = this.flattenFeatures(b);
    
    const dotProduct = vectorA.reduce((sum, val, i) => sum + val * vectorB[i], 0);
    const magnitudeA = Math.sqrt(vectorA.reduce((sum, val) => sum + val * val, 0));
    const magnitudeB = Math.sqrt(vectorB.reduce((sum, val) => sum + val * val, 0));
    
    return dotProduct / (magnitudeA * magnitudeB);
  }

  private flattenFeatures(pattern: PatternFeatures): number[] {
    return [
      ...pattern.mfcc,
      pattern.spectral.centroid,
      pattern.spectral.rolloff,
      pattern.spectral.bandwidth,
      pattern.temporal.zeroCrossings,
      pattern.temporal.energy,
      pattern.pitch.mean,
      pattern.pitch.variance,
      pattern.rhythm.tempo,
      pattern.rhythm.beatStrength
    ];
  }
}

// Export singleton instance
export const voicePatternLearner = VoicePatternLearner.getInstance();
