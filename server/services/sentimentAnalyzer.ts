/**
 * Sentiment Analysis for Scam Detection
 * Detects emotional manipulation tactics used by scammers
 * Analyzes urgency, fear, pressure, and persuasion patterns
 */

interface SentimentScore {
  overall: number; // -1 (very negative) to +1 (very positive)
  urgency: number; // 0-1 scale
  fear: number; // 0-1 scale
  pressure: number; // 0-1 scale
  friendliness: number; // 0-1 scale
  professionalism: number; // 0-1 scale
}

interface EmotionalTactics {
  isUsingUrgency: boolean;
  isUsingFear: boolean;
  isUsingPressure: boolean;
  isUsingFalseFamiliarity: boolean;
  isUsingAuthorityImpersonation: boolean;
  detectedTactics: string[];
}

interface SentimentAnalysisResult {
  sentimentScore: SentimentScore;
  emotionalTactics: EmotionalTactics;
  manipulationRisk: number;
  riskScore: number;
  reason: string;
}

export class SentimentAnalyzer {
  private developmentMode: boolean;

  // Urgency keywords
  private urgencyKeywords = [
    'urgent', 'immediately', 'right now', 'asap', 'hurry', 'quick', 'expires',
    'limited time', 'act now', 'today only', 'last chance', 'deadline', 'expire'
  ];

  // Fear keywords
  private fearKeywords = [
    'suspended', 'terminated', 'arrested', 'fraud', 'unauthorized', 'illegal',
    'warrant', 'police', 'lawsuit', 'court', 'security breach', 'compromised',
    'hacked', 'locked', 'frozen', 'seized'
  ];

  // Pressure keywords
  private pressureKeywords = [
    'must', 'need to', 'have to', 'required', 'mandatory', 'obligation',
    'failure to', 'consequences', 'penalty', 'fine', 'or else'
  ];

  // False familiarity keywords
  private familiarityKeywords = [
    'remember me', 'we spoke before', 'your friend', 'your neighbor',
    'family member', 'i know you', 'recognize your voice'
  ];

  // Authority impersonation keywords
  private authorityKeywords = [
    'irs', 'social security', 'microsoft', 'apple', 'amazon', 'bank',
    'government', 'federal', 'department', 'agent', 'officer', 'official',
    'representative', 'technical support', 'customer service'
  ];

  constructor(developmentMode = false) {
    this.developmentMode = developmentMode;
  }

  /**
   * Analyze sentiment and emotional manipulation
   */
  async analyzeSentiment(transcript: string): Promise<SentimentAnalysisResult> {
    if (this.developmentMode) {
      return this.mockSentimentAnalysis(transcript);
    }

    try {
      const lowerTranscript = transcript.toLowerCase();

      // Calculate sentiment scores
      const sentimentScore = this.calculateSentimentScores(lowerTranscript);

      // Detect emotional tactics
      const emotionalTactics = this.detectEmotionalTactics(lowerTranscript);

      // Calculate manipulation risk
      const manipulationRisk = this.calculateManipulationRisk(sentimentScore, emotionalTactics);

      // Calculate overall risk score
      const riskScore = this.calculateRiskScore(manipulationRisk, emotionalTactics);

      // Generate reason
      const reason = this.generateReason(emotionalTactics, sentimentScore);

      return {
        sentimentScore,
        emotionalTactics,
        manipulationRisk,
        riskScore,
        reason
      };
    } catch (error) {
      console.error('Sentiment analysis error:', error);
      return {
        sentimentScore: {
          overall: 0,
          urgency: 0,
          fear: 0,
          pressure: 0,
          friendliness: 0,
          professionalism: 0
        },
        emotionalTactics: {
          isUsingUrgency: false,
          isUsingFear: false,
          isUsingPressure: false,
          isUsingFalseFamiliarity: false,
          isUsingAuthorityImpersonation: false,
          detectedTactics: []
        },
        manipulationRisk: 0.5,
        riskScore: 0.5,
        reason: 'Sentiment analysis failed'
      };
    }
  }

  /**
   * Calculate sentiment scores
   */
  private calculateSentimentScores(transcript: string): SentimentScore {
    // Count keyword occurrences
    const urgencyCount = this.countKeywords(transcript, this.urgencyKeywords);
    const fearCount = this.countKeywords(transcript, this.fearKeywords);
    const pressureCount = this.countKeywords(transcript, this.pressureKeywords);

    // Normalize by transcript length (words)
    const wordCount = transcript.split(/\s+/).length;
    const normalize = (count: number) => Math.min(count / (wordCount / 50), 1.0);

    // Calculate individual scores
    const urgency = normalize(urgencyCount * 10);
    const fear = normalize(fearCount * 15);
    const pressure = normalize(pressureCount * 10);

    // Calculate friendliness (positive words vs negative)
    const friendliness = this.calculateFriendliness(transcript);

    // Calculate professionalism (grammar, structure)
    const professionalism = this.calculateProfessionalism(transcript);

    // Overall sentiment (-1 to +1)
    const overall = this.calculateOverallSentiment(transcript);

    return {
      overall,
      urgency,
      fear,
      pressure,
      friendliness,
      professionalism
    };
  }

  /**
   * Count keyword occurrences
   */
  private countKeywords(text: string, keywords: string[]): number {
    let count = 0;
    for (const keyword of keywords) {
      const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
      const matches = text.match(regex);
      count += matches ? matches.length : 0;
    }
    return count;
  }

  /**
   * Calculate friendliness score
   */
  private calculateFriendliness(transcript: string): number {
    const positiveWords = [
      'please', 'thank', 'appreciate', 'help', 'assist', 'happy',
      'glad', 'wonderful', 'great', 'excellent'
    ];

    const negativeWords = [
      'must', 'cannot', 'won\'t', 'refuse', 'denied', 'rejected',
      'forbidden', 'prohibited'
    ];

    const positiveCount = this.countKeywords(transcript, positiveWords);
    const negativeCount = this.countKeywords(transcript, negativeWords);

    const wordCount = transcript.split(/\s+/).length;
    const positiveRatio = positiveCount / (wordCount / 50);
    const negativeRatio = negativeCount / (wordCount / 50);

    return Math.min(Math.max((positiveRatio - negativeRatio + 1) / 2, 0), 1);
  }

  /**
   * Calculate professionalism score
   */
  private calculateProfessionalism(transcript: string): number {
    let score = 0.5;

    // Check for proper capitalization
    const sentences = transcript.split(/[.!?]+/);
    let properlyCapitalized = 0;
    for (const sentence of sentences) {
      const trimmed = sentence.trim();
      if (trimmed.length > 0 && /^[A-Z]/.test(trimmed)) {
        properlyCapitalized++;
      }
    }
    if (sentences.length > 0) {
      score = properlyCapitalized / sentences.length;
    }

    // Penalty for excessive CAPS
    const capsRatio = (transcript.match(/[A-Z]/g) || []).length / transcript.length;
    if (capsRatio > 0.3) {
      score -= 0.3; // Excessive caps indicates shouting/unprofessional
    }

    // Penalty for excessive punctuation
    const exclamationCount = (transcript.match(/!/g) || []).length;
    const wordCount = transcript.split(/\s+/).length;
    if (exclamationCount / wordCount > 0.1) {
      score -= 0.2;
    }

    return Math.max(0, Math.min(1, score));
  }

  /**
   * Calculate overall sentiment
   */
  private calculateOverallSentiment(transcript: string): number {
    // Simple sentiment based on positive vs negative words
    const positiveWords = [
      'good', 'great', 'excellent', 'wonderful', 'happy', 'pleased',
      'thank', 'appreciate', 'help', 'benefit', 'opportunity', 'win'
    ];

    const negativeWords = [
      'bad', 'terrible', 'awful', 'problem', 'issue', 'error',
      'fraud', 'scam', 'illegal', 'suspended', 'terminated', 'locked'
    ];

    const positiveCount = this.countKeywords(transcript, positiveWords);
    const negativeCount = this.countKeywords(transcript, negativeWords);

    const total = positiveCount + negativeCount;
    if (total === 0) return 0;

    return (positiveCount - negativeCount) / total;
  }

  /**
   * Detect emotional manipulation tactics
   */
  private detectEmotionalTactics(transcript: string): EmotionalTactics {
    const tactics: string[] = [];

    // Check urgency
    const isUsingUrgency = this.urgencyKeywords.some(keyword => 
      transcript.includes(keyword)
    );
    if (isUsingUrgency) tactics.push('Creating false urgency');

    // Check fear
    const isUsingFear = this.fearKeywords.some(keyword => 
      transcript.includes(keyword)
    );
    if (isUsingFear) tactics.push('Using fear tactics');

    // Check pressure
    const isUsingPressure = this.pressureKeywords.some(keyword => 
      transcript.includes(keyword)
    );
    if (isUsingPressure) tactics.push('Applying psychological pressure');

    // Check false familiarity
    const isUsingFalseFamiliarity = this.familiarityKeywords.some(keyword => 
      transcript.includes(keyword)
    );
    if (isUsingFalseFamiliarity) tactics.push('Claiming false familiarity');

    // Check authority impersonation
    const isUsingAuthorityImpersonation = this.authorityKeywords.some(keyword => 
      transcript.includes(keyword)
    );
    if (isUsingAuthorityImpersonation) tactics.push('Impersonating authority figure');

    return {
      isUsingUrgency,
      isUsingFear,
      isUsingPressure,
      isUsingFalseFamiliarity,
      isUsingAuthorityImpersonation,
      detectedTactics: tactics
    };
  }

  /**
   * Calculate manipulation risk
   */
  private calculateManipulationRisk(
    sentiment: SentimentScore,
    tactics: EmotionalTactics
  ): number {
    let risk = 0;

    // High urgency is a red flag
    if (sentiment.urgency > 0.6) risk += 0.2;
    else if (sentiment.urgency > 0.3) risk += 0.1;

    // Fear tactics are highly suspicious
    if (sentiment.fear > 0.5) risk += 0.3;
    else if (sentiment.fear > 0.2) risk += 0.15;

    // Pressure is a warning sign
    if (sentiment.pressure > 0.5) risk += 0.2;
    else if (sentiment.pressure > 0.3) risk += 0.1;

    // Low professionalism in "official" calls is suspicious
    if (tactics.isUsingAuthorityImpersonation && sentiment.professionalism < 0.5) {
      risk += 0.3;
    }

    // Overly friendly in urgent situations is suspicious
    if (sentiment.urgency > 0.5 && sentiment.friendliness > 0.7) {
      risk += 0.15;
    }

    // Multiple tactics is very suspicious
    const tacticCount = tactics.detectedTactics.length;
    if (tacticCount >= 3) risk += 0.25;
    else if (tacticCount === 2) risk += 0.15;

    return Math.min(risk, 1.0);
  }

  /**
   * Calculate risk score
   */
  private calculateRiskScore(
    manipulationRisk: number,
    tactics: EmotionalTactics
  ): number {
    let risk = manipulationRisk;

    // Certain tactics are automatic high risk
    if (tactics.isUsingFear && tactics.isUsingUrgency) {
      risk = Math.max(risk, 0.8);
    }

    if (tactics.isUsingAuthorityImpersonation && tactics.isUsingPressure) {
      risk = Math.max(risk, 0.75);
    }

    return Math.min(risk, 0.95);
  }

  /**
   * Generate human-readable reason
   */
  private generateReason(tactics: EmotionalTactics, sentiment: SentimentScore): string {
    if (tactics.detectedTactics.length === 0) {
      return 'No suspicious emotional manipulation detected';
    }

    const parts: string[] = [];

    if (tactics.detectedTactics.length > 0) {
      parts.push(`Detected ${tactics.detectedTactics.length} manipulation tactic(s): ${tactics.detectedTactics.join(', ')}`);
    }

    if (sentiment.urgency > 0.6) {
      parts.push('High urgency language detected');
    }

    if (sentiment.fear > 0.5) {
      parts.push('Excessive fear-based language');
    }

    if (sentiment.pressure > 0.5) {
      parts.push('Strong pressure tactics');
    }

    if (sentiment.professionalism < 0.3) {
      parts.push('Unprofessional communication style');
    }

    return parts.join('; ');
  }

  /**
   * Development mode mock
   */
  private mockSentimentAnalysis(transcript: string): SentimentAnalysisResult {
    // Generate different scenarios based on transcript length
    const scenario = transcript.length % 3;

    const scenarios: SentimentAnalysisResult[] = [
      {
        sentimentScore: {
          overall: -0.6,
          urgency: 0.85,
          fear: 0.9,
          pressure: 0.75,
          friendliness: 0.2,
          professionalism: 0.3
        },
        emotionalTactics: {
          isUsingUrgency: true,
          isUsingFear: true,
          isUsingPressure: true,
          isUsingFalseFamiliarity: false,
          isUsingAuthorityImpersonation: true,
          detectedTactics: [
            'Creating false urgency',
            'Using fear tactics',
            'Applying psychological pressure',
            'Impersonating authority figure'
          ]
        },
        manipulationRisk: 0.92,
        riskScore: 0.95,
        reason: 'Detected 4 manipulation tactic(s): Creating false urgency, Using fear tactics, Applying psychological pressure, Impersonating authority figure; High urgency language detected; Excessive fear-based language; Strong pressure tactics; Unprofessional communication style'
      },
      {
        sentimentScore: {
          overall: -0.2,
          urgency: 0.45,
          fear: 0.3,
          pressure: 0.4,
          friendliness: 0.5,
          professionalism: 0.6
        },
        emotionalTactics: {
          isUsingUrgency: true,
          isUsingFear: false,
          isUsingPressure: true,
          isUsingFalseFamiliarity: true,
          isUsingAuthorityImpersonation: false,
          detectedTactics: [
            'Creating false urgency',
            'Applying psychological pressure',
            'Claiming false familiarity'
          ]
        },
        manipulationRisk: 0.58,
        riskScore: 0.60,
        reason: 'Detected 3 manipulation tactic(s): Creating false urgency, Applying psychological pressure, Claiming false familiarity'
      },
      {
        sentimentScore: {
          overall: 0.3,
          urgency: 0.1,
          fear: 0.0,
          pressure: 0.15,
          friendliness: 0.7,
          professionalism: 0.85
        },
        emotionalTactics: {
          isUsingUrgency: false,
          isUsingFear: false,
          isUsingPressure: false,
          isUsingFalseFamiliarity: false,
          isUsingAuthorityImpersonation: false,
          detectedTactics: []
        },
        manipulationRisk: 0.05,
        riskScore: 0.08,
        reason: 'No suspicious emotional manipulation detected'
      }
    ];

    return scenarios[scenario] || scenarios[2];
  }
}

export default SentimentAnalyzer;
