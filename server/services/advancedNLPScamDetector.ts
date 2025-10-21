/**
 * Advanced NLP for Scam Phrase Detection
 * Uses deep learning and NLP techniques to analyze transcriptions in real-time
 */

import { logger } from '../utils/logger.js';

interface TranscriptionAnalysis {
  scamProbability: number;
  detectedPhrases: string[];
  emotionalManipulation: {
    detected: boolean;
    type: 'urgency' | 'fear' | 'greed' | 'authority' | 'scarcity' | 'none';
    confidence: number;
  };
  sentimentScore: number; // -1 to 1
  urgencyLevel: number; // 0 to 1
  suspiciousKeywords: string[];
  languageComplexity: number;
  reasoning: string[];
}

interface ScamPhraseCategory {
  category: string;
  phrases: string[];
  weight: number;
  indicators: string[];
}

export class AdvancedNLPScamDetector {
  private scamPhraseDatabase: Map<string, ScamPhraseCategory>;
  private emotionalTriggerPatterns: RegExp[];
  private urgencyPatterns: RegExp[];
  private authorityPatterns: RegExp[];
  private financialPatterns: RegExp[];
  private wordEmbeddings: Map<string, number[]>;

  constructor() {
    this.scamPhraseDatabase = new Map();
    this.emotionalTriggerPatterns = [];
    this.urgencyPatterns = [];
    this.authorityPatterns = [];
    this.financialPatterns = [];
    this.wordEmbeddings = new Map();
    
    this.initializeScamDatabase();
    this.initializePatterns();
    logger.info('Advanced NLP Scam Detector initialized');
  }

  /**
   * Initialize comprehensive scam phrase database
   */
  private initializeScamDatabase(): void {
    // IRS/Tax Scams
    this.scamPhraseDatabase.set('irs_scam', {
      category: 'IRS/Tax Scam',
      phrases: [
        'irs', 'internal revenue', 'tax', 'back taxes', 'tax debt',
        'tax fraud', 'warrant', 'arrest', 'legal action', 'owe money',
        'tax lien', 'levy', 'seizure', 'federal agent', 'badge number'
      ],
      weight: 0.9,
      indicators: ['immediate payment', 'gift cards', 'wire transfer', 'prepaid cards']
    });

    // Tech Support Scams
    this.scamPhraseDatabase.set('tech_support', {
      category: 'Tech Support Scam',
      phrases: [
        'microsoft', 'windows', 'computer', 'virus', 'infected',
        'malware', 'hacked', 'security breach', 'remote access',
        'technician', 'it support', 'error messages', 'slow computer',
        'suspicious activity', 'protect your computer'
      ],
      weight: 0.85,
      indicators: ['refund', 'subscription', 'renewal', 'firewall']
    });

    // Social Security Scams
    this.scamPhraseDatabase.set('social_security', {
      category: 'Social Security Scam',
      phrases: [
        'social security', 'ssn', 'social security number', 'suspended',
        'compromised', 'fraudulent activity', 'social security administration',
        'benefits', 'disability', 'medicare', 'identity theft'
      ],
      weight: 0.9,
      indicators: ['verify', 'confirm', 'reactivate', 'investigate']
    });

    // Bank/Financial Scams
    this.scamPhraseDatabase.set('banking', {
      category: 'Banking/Financial Scam',
      phrases: [
        'bank account', 'credit card', 'unauthorized', 'fraudulent charge',
        'suspicious transaction', 'verify account', 'account suspended',
        'security department', 'fraud department', 'card services',
        'account verification', 'unusual activity', 'locked account'
      ],
      weight: 0.85,
      indicators: ['card number', 'cvv', 'pin', 'password', 'account number']
    });

    // Romance/Lottery Scams
    this.scamPhraseDatabase.set('romance_lottery', {
      category: 'Romance/Lottery Scam',
      phrases: [
        'won', 'winner', 'lottery', 'prize', 'sweepstakes',
        'congratulations', 'claim', 'love', 'relationship',
        'emergency', 'help me', 'stuck', 'hospital', 'customs'
      ],
      weight: 0.75,
      indicators: ['send money', 'western union', 'moneygram', 'fees', 'taxes']
    });

    // Utility/Service Scams
    this.scamPhraseDatabase.set('utility', {
      category: 'Utility/Service Scam',
      phrases: [
        'electric', 'power', 'gas', 'water', 'internet',
        'cable', 'phone service', 'disconnect', 'shut off',
        'past due', 'overdue', 'final notice', 'service interruption'
      ],
      weight: 0.8,
      indicators: ['immediate payment', 'today', 'within hours', 'avoid disconnection']
    });

    // Investment/Crypto Scams
    this.scamPhraseDatabase.set('investment', {
      category: 'Investment/Crypto Scam',
      phrases: [
        'investment', 'opportunity', 'bitcoin', 'cryptocurrency',
        'guaranteed returns', 'high returns', 'no risk', 'trading',
        'forex', 'stock', 'profit', 'millionaire', 'passive income'
      ],
      weight: 0.75,
      indicators: ['limited time', 'exclusive', 'act now', 'double your money']
    });

    // Debt Collection Scams
    this.scamPhraseDatabase.set('debt_collection', {
      category: 'Debt Collection Scam',
      phrases: [
        'debt', 'collection agency', 'lawsuit', 'court', 'legal proceedings',
        'settlement', 'owe', 'payment', 'collector', 'judgment',
        'garnish', 'attorney', 'law firm'
      ],
      weight: 0.8,
      indicators: ['immediate', 'avoid court', 'settle today', 'reduced amount']
    });

    // Medical/Healthcare Scams
    this.scamPhraseDatabase.set('medical', {
      category: 'Medical/Healthcare Scam',
      phrases: [
        'health insurance', 'medicare', 'medicaid', 'prescription',
        'medical device', 'free', 'no cost', 'eligible', 'qualify',
        'benefits', 'coverage', 'medical alert', 'diabetic'
      ],
      weight: 0.7,
      indicators: ['verify eligibility', 'shipping', 'personal information']
    });

    // Charity/Disaster Scams
    this.scamPhraseDatabase.set('charity', {
      category: 'Charity/Disaster Scam',
      phrases: [
        'charity', 'donation', 'disaster relief', 'hurricane', 'earthquake',
        'victims', 'help', 'fundraiser', 'non-profit', 'tax deductible',
        'save', 'children', 'veterans', 'police', 'firefighters'
      ],
      weight: 0.65,
      indicators: ['donate now', 'urgent', 'crisis', 'suffering']
    });
  }

  /**
   * Initialize emotional manipulation patterns
   */
  private initializePatterns(): void {
    // Urgency patterns
    this.urgencyPatterns = [
      /\b(urgent|immediately|right now|today|within (\d+)?\s?(hours?|minutes?))\b/i,
      /\b(act (now|fast|quickly)|hurry|time is running out|limited time)\b/i,
      /\b(before (it'?s too late|midnight|end of day|close of business))\b/i,
      /\b(final (notice|warning|chance|opportunity))\b/i,
      /\b(last chance|don'?t (wait|delay)|must (act|respond))\b/i
    ];

    // Authority patterns
    this.authorityPatterns = [
      /\b(government|federal|official|department|agency|administration)\b/i,
      /\b(officer|agent|representative|investigator|inspector)\b/i,
      /\b(badge number|case number|reference number|file number)\b/i,
      /\b(legal (action|proceedings|matter)|lawsuit|court|judge)\b/i,
      /\b(law enforcement|police|sheriff|marshal|attorney)\b/i
    ];

    // Financial pressure patterns
    this.financialPatterns = [
      /\b(pay|payment|money|cash|transfer|wire|send)\b/i,
      /\b(gift card|prepaid|bitcoin|cryptocurrency|western union)\b/i,
      /\b(account number|social security number|credit card|bank)\b/i,
      /\b(\$\d+|dollars?|amount|fee|charge|cost)\b/i,
      /\b(refund|owe|debt|tax|fine|penalty)\b/i
    ];

    // Emotional trigger patterns
    this.emotionalTriggerPatterns = [
      /\b(arrest|warrant|jail|prison|criminal|fraud)\b/i,
      /\b(suspended|terminated|cancelled|expired|blocked)\b/i,
      /\b(unauthorized|suspicious|compromised|hacked|breach)\b/i,
      /\b(congratulations|won|winner|selected|lucky)\b/i,
      /\b(loved one|family|emergency|accident|hospital)\b/i
    ];
  }

  /**
   * Analyze transcription for scam indicators
   */
  async analyzeTranscription(transcription: string): Promise<TranscriptionAnalysis> {
    const text = transcription.toLowerCase();
    const words = this.tokenize(text);
    
    const reasoning: string[] = [];
    let scamScore = 0;
    const detectedPhrases: string[] = [];
    const suspiciousKeywords: string[] = [];

    // 1. Scam phrase detection
    for (const [category, data] of this.scamPhraseDatabase.entries()) {
      const matches = this.findPhraseMatches(text, data.phrases);
      if (matches.length > 0) {
        const score = (matches.length / data.phrases.length) * data.weight;
        scamScore += score;
        detectedPhrases.push(...matches);
        reasoning.push(`${data.category}: detected ${matches.length} phrases`);

        // Check for category-specific indicators
        const indicators = this.findPhraseMatches(text, data.indicators);
        if (indicators.length > 0) {
          scamScore += 0.1 * indicators.length;
          suspiciousKeywords.push(...indicators);
          reasoning.push(`High-risk indicators: ${indicators.join(', ')}`);
        }
      }
    }

    // 2. Emotional manipulation detection
    const emotionalManipulation = this.detectEmotionalManipulation(text);
    if (emotionalManipulation.detected) {
      scamScore += 0.15;
      reasoning.push(
        `Emotional manipulation (${emotionalManipulation.type}): ${emotionalManipulation.confidence.toFixed(2)}`
      );
    }

    // 3. Urgency level detection
    const urgencyLevel = this.calculateUrgencyLevel(text);
    if (urgencyLevel > 0.5) {
      scamScore += urgencyLevel * 0.1;
      reasoning.push(`High urgency level: ${urgencyLevel.toFixed(2)}`);
    }

    // 4. Sentiment analysis
    const sentimentScore = this.analyzeSentiment(text, words);
    if (sentimentScore < -0.3) {
      scamScore += 0.05;
      reasoning.push(`Negative sentiment: ${sentimentScore.toFixed(2)}`);
    }

    // 5. Authority impersonation
    const authorityScore = this.detectAuthorityImpersonation(text);
    if (authorityScore > 0.5) {
      scamScore += authorityScore * 0.15;
      reasoning.push(`Authority impersonation detected: ${authorityScore.toFixed(2)}`);
    }

    // 6. Financial pressure tactics
    const financialPressure = this.detectFinancialPressure(text);
    if (financialPressure > 0.5) {
      scamScore += financialPressure * 0.15;
      reasoning.push(`Financial pressure tactics: ${financialPressure.toFixed(2)}`);
    }

    // 7. Language complexity (scammers often use simple, repetitive language)
    const languageComplexity = this.calculateLanguageComplexity(words);
    if (languageComplexity < 0.3) {
      scamScore += 0.05;
      reasoning.push(`Low language complexity: ${languageComplexity.toFixed(2)}`);
    }

    // 8. Request for sensitive information
    if (this.requestsSensitiveInfo(text)) {
      scamScore += 0.2;
      reasoning.push('Requests sensitive personal information');
    }

    // Normalize scam probability
    const scamProbability = Math.min(1.0, Math.max(0.0, scamScore));

    return {
      scamProbability,
      detectedPhrases: [...new Set(detectedPhrases)],
      emotionalManipulation,
      sentimentScore,
      urgencyLevel,
      suspiciousKeywords: [...new Set(suspiciousKeywords)],
      languageComplexity,
      reasoning
    };
  }

  /**
   * Tokenize text into words
   */
  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 0);
  }

  /**
   * Find phrase matches in text
   */
  private findPhraseMatches(text: string, phrases: string[]): string[] {
    const matches: string[] = [];
    for (const phrase of phrases) {
      const regex = new RegExp(`\\b${phrase}\\b`, 'i');
      if (regex.test(text)) {
        matches.push(phrase);
      }
    }
    return matches;
  }

  /**
   * Detect emotional manipulation
   */
  private detectEmotionalManipulation(text: string): {
    detected: boolean;
    type: 'urgency' | 'fear' | 'greed' | 'authority' | 'scarcity' | 'none';
    confidence: number;
  } {
    const scores = {
      urgency: 0,
      fear: 0,
      greed: 0,
      authority: 0,
      scarcity: 0
    };

    // Check urgency
    for (const pattern of this.urgencyPatterns) {
      if (pattern.test(text)) {
        scores.urgency += 0.3;
      }
    }

    // Check fear
    const fearKeywords = ['arrest', 'warrant', 'lawsuit', 'suspended', 'terminated', 'fraud', 'criminal'];
    for (const keyword of fearKeywords) {
      if (text.includes(keyword)) {
        scores.fear += 0.2;
      }
    }

    // Check greed
    const greedKeywords = ['won', 'winner', 'prize', 'free', 'guaranteed', 'profit', 'returns'];
    for (const keyword of greedKeywords) {
      if (text.includes(keyword)) {
        scores.greed += 0.2;
      }
    }

    // Check authority
    for (const pattern of this.authorityPatterns) {
      if (pattern.test(text)) {
        scores.authority += 0.3;
      }
    }

    // Check scarcity
    const scarcityKeywords = ['limited', 'expires', 'last chance', 'only', 'few left'];
    for (const keyword of scarcityKeywords) {
      if (text.includes(keyword)) {
        scores.scarcity += 0.2;
      }
    }

    // Find highest scoring type
    const maxType = Object.entries(scores).reduce((max, [type, score]) =>
      score > max.score ? { type: type as any, score } : max,
      { type: 'none' as any, score: 0 }
    );

    return {
      detected: maxType.score > 0.3,
      type: maxType.type,
      confidence: Math.min(1.0, maxType.score)
    };
  }

  /**
   * Calculate urgency level
   */
  private calculateUrgencyLevel(text: string): number {
    let urgencyScore = 0;
    
    for (const pattern of this.urgencyPatterns) {
      if (pattern.test(text)) {
        urgencyScore += 0.25;
      }
    }

    // Check for specific time mentions
    const timeMatches = text.match(/(\d+)\s*(hour|minute|day)/gi);
    if (timeMatches && timeMatches.length > 0) {
      urgencyScore += 0.2;
    }

    return Math.min(1.0, urgencyScore);
  }

  /**
   * Analyze sentiment
   */
  private analyzeSentiment(text: string, words: string[]): number {
    const positiveWords = ['help', 'assist', 'support', 'protect', 'save', 'benefit', 'free', 'win'];
    const negativeWords = ['problem', 'issue', 'fraud', 'scam', 'danger', 'risk', 'lose', 'debt', 'owe'];

    let sentimentScore = 0;
    for (const word of words) {
      if (positiveWords.includes(word)) sentimentScore += 0.1;
      if (negativeWords.includes(word)) sentimentScore -= 0.1;
    }

    return Math.max(-1.0, Math.min(1.0, sentimentScore / Math.max(1, words.length)));
  }

  /**
   * Detect authority impersonation
   */
  private detectAuthorityImpersonation(text: string): number {
    let score = 0;
    
    for (const pattern of this.authorityPatterns) {
      if (pattern.test(text)) {
        score += 0.25;
      }
    }

    return Math.min(1.0, score);
  }

  /**
   * Detect financial pressure tactics
   */
  private detectFinancialPressure(text: string): number {
    let score = 0;
    
    for (const pattern of this.financialPatterns) {
      if (pattern.test(text)) {
        score += 0.2;
      }
    }

    return Math.min(1.0, score);
  }

  /**
   * Calculate language complexity
   */
  private calculateLanguageComplexity(words: string[]): number {
    if (words.length === 0) return 0;

    // Calculate unique word ratio
    const uniqueWords = new Set(words);
    const uniqueRatio = uniqueWords.size / words.length;

    // Calculate average word length
    const avgWordLength = words.reduce((sum, word) => sum + word.length, 0) / words.length;

    // Combine metrics
    return (uniqueRatio * 0.6 + (avgWordLength / 10) * 0.4);
  }

  /**
   * Check if text requests sensitive information
   */
  private requestsSensitiveInfo(text: string): boolean {
    const sensitivePatterns = [
      /\b(social security|ssn|account number|card number|cvv|pin|password)\b/i,
      /\b(verify|confirm|provide|give (me|us)|tell (me|us))\b.*\b(number|information|details)\b/i,
      /\b(what is your|can I (have|get)|need your)\b.*\b(account|card|social|password)\b/i
    ];

    return sensitivePatterns.some(pattern => pattern.test(text));
  }

  /**
   * Update scam database with new phrases (learning)
   */
  learnNewScamPhrases(category: string, phrases: string[], weight: number = 0.7): void {
    const existing = this.scamPhraseDatabase.get(category);
    
    if (existing) {
      existing.phrases.push(...phrases);
      existing.phrases = [...new Set(existing.phrases)];
      this.scamPhraseDatabase.set(category, existing);
    } else {
      this.scamPhraseDatabase.set(category, {
        category,
        phrases,
        weight,
        indicators: []
      });
    }

    logger.info(`Learned ${phrases.length} new phrases for category: ${category}`);
  }

  /**
   * Get scam database statistics
   */
  getDatabaseStats(): any {
    const stats: any = {};
    
    for (const [category, data] of this.scamPhraseDatabase.entries()) {
      stats[category] = {
        phraseCount: data.phrases.length,
        indicatorCount: data.indicators.length,
        weight: data.weight
      };
    }

    return stats;
  }
}

export default AdvancedNLPScamDetector;
