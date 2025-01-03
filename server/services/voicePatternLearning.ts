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
  clusterInfo?: {
    clusterId: number;
    similarPatterns: number;
    averageConfidence: number;
  };
}

export class VoicePatternLearner {
  private static instance: VoicePatternLearner;
  private patternCache: Map<string, PatternFeatures[]>;
  private updateInterval: number = 300000; // 5 minutes
  private confidenceThreshold: number = 0.7;
  private minSamplesForUpdate: number = 5;
  private maxClusterDistance: number = 0.3;

  private constructor() {
    this.patternCache = new Map();
    this.startPeriodicUpdate();
    this.adaptThresholds();
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

  private async adaptThresholds() {
    // Adapt learning thresholds based on pattern recognition success rate
    setInterval(async () => {
      const recentPatterns = await db
        .select()
        .from(voicePatterns)
        .where(sql`created_at >= NOW() - INTERVAL '1 day'`);

      const successRate = recentPatterns.reduce(
        (acc, pattern) => acc + (Number(pattern.confidence) > 0.8 ? 1 : 0),
        0
      ) / Math.max(1, recentPatterns.length);

      // Adjust thresholds based on success rate
      this.confidenceThreshold = Math.max(0.6, Math.min(0.9, successRate + 0.1));
      this.minSamplesForUpdate = Math.max(3, Math.min(10, Math.ceil(5 / successRate)));
      this.maxClusterDistance = Math.max(0.2, Math.min(0.4, 0.3 + (1 - successRate) * 0.1));
    }, 3600000); // Adapt every hour
  }

  public async learnFromPattern(
    features: PatternFeatures,
    classification: string,
    language?: string
  ): Promise<LearningResult> {
    try {
      const key = `${classification}_${language || 'unknown'}`;
      if (!this.patternCache.has(key)) {
        this.patternCache.set(key, []);
      }
      this.patternCache.get(key)?.push(features);

      // Find similar patterns for clustering
      const similarPatterns = await this.findSimilarPatterns(features, classification, language);
      const clusterId = similarPatterns.length > 0 ? similarPatterns[0].id : undefined;
      const averageConfidence = similarPatterns.reduce((acc, p) => acc + Number(p.confidence), 0) / Math.max(1, similarPatterns.length);

      // If cache reaches threshold or we have enough similar patterns, trigger update
      if ((this.patternCache.get(key)?.length ?? 0) >= this.minSamplesForUpdate || 
          similarPatterns.length >= this.minSamplesForUpdate) {
        await this.updatePatternDatabase();
      }

      const confidence = this.calculateConfidence(features, similarPatterns);

      return {
        success: true,
        updatedPatterns: 1,
        confidence,
        clusterInfo: clusterId ? {
          clusterId,
          similarPatterns: similarPatterns.length,
          averageConfidence
        } : undefined
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

  private async findSimilarPatterns(
    features: PatternFeatures,
    classification: string,
    language?: string
  ) {
    const patterns = await db
      .select()
      .from(voicePatterns)
      .where(sql`
        pattern_type = ${classification}
        AND (language = ${language} OR language IS NULL)
        AND created_at >= NOW() - INTERVAL '7 days'
      `);

    return patterns.filter(pattern => {
      const similarity = this.calculatePatternSimilarity(features, pattern.features as PatternFeatures);
      return similarity > (1 - this.maxClusterDistance);
    });
  }

  private async updatePatternDatabase() {
    for (const [key, patterns] of this.patternCache.entries()) {
      if (patterns.length === 0) continue;

      const [classification, language] = key.split('_');

      // Cluster patterns based on similarity
      const clusters = this.clusterPatterns(patterns);

      // Update database for each cluster
      for (const cluster of clusters) {
        const averagePattern = this.calculateAveragePattern(cluster);
        const confidence = this.calculateClusterConfidence(cluster);

        // Update or insert pattern
        await db
          .insert(voicePatterns)
          .values({
            patternType: classification,
            features: averagePattern,
            confidence,
            language: language !== 'unknown' ? language : null,
            metadata: {
              sampleSize: cluster.length,
              lastUpdate: new Date().toISOString(),
              clusterStats: {
                variance: this.calculateClusterVariance(cluster),
                coherence: this.calculateClusterCoherence(cluster)
              }
            }
          })
          .onConflictDoUpdate({
            target: [voicePatterns.patternType, voicePatterns.language],
            set: {
              features: sql`jsonb_merge_patch(${voicePatterns.features}, ${averagePattern})`,
              updatedAt: new Date(),
              confidence: sql`(${voicePatterns.confidence} + ${confidence}) / 2`
            }
          });
      }
    }

    // Clear cache after update
    this.patternCache.clear();
  }

  private clusterPatterns(patterns: PatternFeatures[]): PatternFeatures[][] {
    const clusters: PatternFeatures[][] = [];
    const assigned = new Set<number>();

    patterns.forEach((pattern, i) => {
      if (assigned.has(i)) return;

      const cluster = [pattern];
      assigned.add(i);

      patterns.forEach((otherPattern, j) => {
        if (i === j || assigned.has(j)) return;

        const similarity = this.calculatePatternSimilarity(pattern, otherPattern);
        if (similarity > (1 - this.maxClusterDistance)) {
          cluster.push(otherPattern);
          assigned.add(j);
        }
      });

      clusters.push(cluster);
    });

    return clusters;
  }

  private calculateClusterVariance(patterns: PatternFeatures[]): number {
    const average = this.calculateAveragePattern(patterns);
    const distances = patterns.map(p => this.calculatePatternDistance(p, average));
    return this.calculateVariance(distances);
  }

  private calculateClusterCoherence(patterns: PatternFeatures[]): number {
    if (patterns.length < 2) return 1;

    let totalSimilarity = 0;
    let comparisons = 0;

    for (let i = 0; i < patterns.length; i++) {
      for (let j = i + 1; j < patterns.length; j++) {
        totalSimilarity += this.calculatePatternSimilarity(patterns[i], patterns[j]);
        comparisons++;
      }
    }

    return totalSimilarity / comparisons;
  }

  private calculateClusterConfidence(patterns: PatternFeatures[]): number {
    const coherence = this.calculateClusterCoherence(patterns);
    const sizeBonus = Math.min(0.2, (patterns.length / 20) * 0.2); // Max 0.2 bonus for size
    const variance = this.calculateClusterVariance(patterns);
    const variancePenalty = Math.min(0.3, variance * 0.3); // Max 0.3 penalty for variance

    return Math.min(1, Math.max(0, coherence + sizeBonus - variancePenalty));
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

  private calculateConfidence(pattern: PatternFeatures, similarPatterns: any[] = []): number {
    // Base confidence from pattern strength
    const baseConfidence = this.calculatePatternStrength(pattern);

    // Similarity confidence from matching against known patterns
    const similarityConfidence = similarPatterns.length > 0
      ? similarPatterns.reduce((acc, p) => acc + Number(p.confidence), 0) / similarPatterns.length
      : 0;

    // Weight the confidence components
    const weightedConfidence = (baseConfidence * 0.6) + (similarityConfidence * 0.4);

    return Math.min(1, Math.max(0, weightedConfidence));
  }

  private calculatePatternStrength(pattern: PatternFeatures): number {
    const features = this.flattenFeatures(pattern);
    const variance = this.calculateVariance(features);
    const normalizedVariance = Math.min(1, variance / 0.5); // Normalize variance to [0,1]

    // Consider pattern strength as inverse of normalized variance
    return 1 - normalizedVariance;
  }

  private calculateVariance(values: number[]): number {
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const squareDiffs = values.map(value => Math.pow(value - mean, 2));
    return Math.sqrt(squareDiffs.reduce((a, b) => a + b, 0) / values.length);
  }

  private calculatePatternDistance(a: PatternFeatures, b: PatternFeatures): number {
    const vectorA = this.flattenFeatures(a);
    const vectorB = this.flattenFeatures(b);

    return Math.sqrt(
      vectorA.reduce((sum, val, i) => sum + Math.pow(val - vectorB[i], 2), 0)
    );
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
  ): Promise<{ type: string; confidence: number; clusterInfo?: any }> {
    const patterns = await db
      .select()
      .from(voicePatterns)
      .where(sql`${voicePatterns.language} = ${language} OR ${voicePatterns.language} IS NULL`);

    let bestMatch = { type: 'unknown', confidence: 0 };
    let bestCluster = undefined;

    for (const pattern of patterns) {
      const similarity = this.calculatePatternSimilarity(features, pattern.features as PatternFeatures);
      const matchConfidence = similarity * Number(pattern.confidence);

      if (matchConfidence > bestMatch.confidence) {
        bestMatch = {
          type: pattern.patternType,
          confidence: matchConfidence
        };
        bestCluster = pattern.metadata?.clusterStats;
      }
    }

    return {
      ...bestMatch,
      clusterInfo: bestCluster
    };
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