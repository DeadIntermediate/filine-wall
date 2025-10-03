import { db } from "@db";
import { sql } from "drizzle-orm";
import { voicePatterns } from "@db/schema";

interface ScamDetectionResult {
  isScam: boolean;
  confidence: number;
  detectedPhrases: string[];
  category?: string;
  language?: string;
  aiVoiceIndicators?: {
    clonedVoicePatterns: boolean;
    artificialPauses: boolean;
    scriptedResponses: boolean;
    confidence: number;
  };
}

// Enhanced multi-language scam phrase database with regex patterns
const scamPhrasePatterns = {
  en: {
    investment: [
      /guaranteed\s+returns?/i,
      /risk[\s-]?free\s+investment/i,
      /double\s+your\s+money/i,
      /crypto(currency)?\s+opportunity/i,
      /limited\s+time\s+offer/i,
      /act\s+now/i,
      /offshore\s+account/i,
      /tax\s+haven/i,
      /insider\s+trading/i,
      /get\s+rich\s+quick/i
    ],
    government: [
      /social\s+security\s+(number|administration)/i,
      /(tax|irs)\s+(refund|debt|payment)/i,
      /government\s+grant/i,
      /stimulus\s+payment/i,
      /federal\s+agency/i,
      /arrest\s+warrant/i,
      /legal\s+action/i,
      /medicaid|medicare\s+card/i
    ],
    tech: [
      /computer\s+virus/i,
      /(technical|tech)\s+support/i,
      /(microsoft|windows|apple)\s+(security|support)/i,
      /account\s+(compromised|hacked|suspended)/i,
      /suspicious\s+activity/i,
      /verify\s+your\s+(account|identity)/i,
      /update\s+your\s+payment/i,
      /unauthorized\s+(access|transaction)/i
    ],
    aiScam: [
      /voice\s+(verification|authentication|signature)/i,
      /(say|repeat)\s+(yes|your\s+name|after\s+me)/i,
      /automated\s+security\s+check/i,
      /voice\s+(recording|print)/i,
      /confirm\s+identity\s+by\s+speaking/i
    ],
    lottery: [
      /(won|winner)\s+lottery/i,
      /claim\s+your\s+prize/i,
      /million\s+dollar/i,
      /processing\s+fee/i,
      /claim\s+department/i
    ],
    utility: [
      /power\s+(company|bill|shut\s?off)/i,
      /water\s+service/i,
      /disconnect\s+notice/i,
      /immediate\s+payment/i
    ],
    charity: [
      /donate\s+now/i,
      /help\s+(children|veterans|animals)/i,
      /tax[\s-]?deductible/i,
      /one[\s-]?time\s+donation/i
    ]
  },
  es: {
    investment: [
      /rendimientos?\s+garantizados?/i,
      /inversión\s+sin\s+riesgo/i,
      /duplicar\s+su\s+dinero/i,
      /oportunidad\s+(crypto|criptomoneda)/i,
      /oferta\s+(limitada|temporal)/i
    ],
    government: [
      /número\s+de\s+seguro\s+social/i,
      /reembolso\s+de\s+impuestos/i,
      /subvención\s+gubernamental/i,
      /pago\s+de\s+estímulo/i,
      /agencia\s+federal/i
    ],
    tech: [
      /virus\s+en\s+(la\s+)?computadora/i,
      /soporte\s+técnico/i,
      /cuenta\s+comprometida/i,
      /actividad\s+sospechosa/i
    ],
    aiScam: [
      /verificación\s+de\s+voz/i,
      /firma\s+de\s+voz/i,
      /autenticación\s+de\s+voz/i
    ]
  },
  zh: {
    investment: [
      /保证(回报|收益)/i,
      /零风险投资/i,
      /翻倍(收益|赚钱)/i,
      /加密货币(机会|投资)/i
    ],
    government: [
      /社会安全号码/i,
      /税务(退款|欠款)/i,
      /政府(补助|拨款)/i
    ],
    tech: [
      /电脑病毒/i,
      /技术支持/i,
      /账户(被盗|异常)/i
    ],
    aiScam: [
      /语音(验证|认证|签名)/i,
      /请(重复|说出)/i
    ]
  },
  hi: {
    investment: [
      /गारंटीड\s+रिटर्न/i,
      /जोखिम\s+मुक्त/i,
      /पैसा\s+दोगुना/i
    ],
    government: [
      /आधार\s+नंबर/i,
      /टैक्स\s+रिफंड/i,
      /सरकारी\s+योजना/i
    ],
    tech: [
      /कंप्यूटर\s+वायरस/i,
      /तकनीकी\s+सहायता/i,
      /खाता\s+खतरे\s+में/i
    ]
  }
};

// Enhanced AI voice scam patterns with more sophisticated detection
const aiVoicePatterns = {
  scriptedResponses: [
    /please\s+(repeat|say)\s+.{1,30}(after\s+me|following)/i,
    /voice\s+verification\s+system/i,
    /automated\s+security\s+(check|verification)/i,
    /confirm\s+.{1,20}identity\s+by\s+(saying|speaking)/i,
    /(say|speak)\s+(yes|no)\s+to\s+confirm/i,
    /record\s+your\s+voice/i
  ],
  suspiciousPhrases: [
    /voice\s+(signature|print|biometric)/i,
    /voice\s+authentication/i,
    /voice\s+recording\s+for/i,
    /(clone|copy)\s+your\s+voice/i,
    /voice\s+verification\s+required/i
  ],
  urgencyIndicators: [
    /(urgent|immediate|emergency)\s+(action|response)/i,
    /within\s+\d+\s+(hours?|minutes?)/i,
    /expires?\s+(today|soon|now)/i,
    /final\s+(notice|warning)/i,
    /(act|call|respond)\s+now/i
  ]
};

// Common scam tactics across languages
const scamTactics = {
  pressure: [
    /limited\s+time/i,
    /act\s+now/i,
    /expires?\s+(today|soon)/i,
    /last\s+chance/i,
    /final\s+(offer|notice)/i
  ],
  authority: [
    /(government|irs|fbi|police|sheriff)/i,
    /federal\s+agent/i,
    /legal\s+department/i,
    /court\s+order/i
  ],
  reward: [
    /congratulations/i,
    /(won|winner|prize)/i,
    /free\s+(gift|trial|vacation)/i,
    /selected\s+for/i
  ],
  threat: [
    /arrest/i,
    /lawsuit/i,
    /suspended\s+account/i,
    /frozen\s+funds/i,
    /warrant/i
  ]
};

export async function detectScamPhrases(
  text: string,
  language: string,
  audioFeatures?: {
    pausePatterns: number[];
    responseLatency: number[];
    intonationVariance: number;
  }
): Promise<ScamDetectionResult> {
  let detectedPhrases: string[] = [];
  let category: string | undefined;
  let confidence = 0;
  let isScam = false;

  // Get language-specific patterns
  const patterns = scamPhrasePatterns[language as keyof typeof scamPhrasePatterns];
  
  if (patterns) {
    // Check each category of scam phrases
    for (const [cat, phrases] of Object.entries(patterns)) {
      for (const phrase of phrases) {
        if (phrase.test(text)) {
          detectedPhrases.push(phrase.source || phrase.toString());
          if (!category) category = cat;
          confidence += 0.25; // Each matched phrase increases confidence
        }
      }
    }
  }

  // Check for AI voice scam patterns (language-agnostic)
  let aiIndicators = {
    clonedVoicePatterns: false,
    artificialPauses: false,
    scriptedResponses: false,
    confidence: 0
  };

  // Check for scripted responses
  for (const pattern of aiVoicePatterns.scriptedResponses) {
    if (pattern.test(text)) {
      aiIndicators.scriptedResponses = true;
      aiIndicators.confidence += 0.3;
      detectedPhrases.push('Scripted response pattern detected');
    }
  }

  // Check for suspicious voice-related phrases
  for (const pattern of aiVoicePatterns.suspiciousPhrases) {
    if (pattern.test(text)) {
      aiIndicators.confidence += 0.25;
      detectedPhrases.push('Voice manipulation attempt detected');
    }
  }

  // Check for urgency indicators (common scam tactic)
  let urgencyScore = 0;
  for (const pattern of aiVoicePatterns.urgencyIndicators) {
    if (pattern.test(text)) {
      urgencyScore += 0.15;
      if (urgencyScore === 0.15) { // Only add once
        detectedPhrases.push('Urgency pressure tactic');
      }
    }
  }
  confidence += urgencyScore;

  // Check for common scam tactics
  for (const [tactic, patterns] of Object.entries(scamTactics)) {
    for (const pattern of patterns) {
      if (pattern.test(text)) {
        confidence += 0.15;
        detectedPhrases.push(`${tactic} tactic detected`);
        break; // Only count once per tactic
      }
    }
  }

  // Analyze audio features if provided
  if (audioFeatures) {
    // Check for unnatural pause patterns (too regular)
    const pauseVariance = calculateVariance(audioFeatures.pausePatterns);
    if (pauseVariance < 0.1) { 
      // Very regular pauses suggest automated/scripted speech
      aiIndicators.artificialPauses = true;
      aiIndicators.confidence += 0.3;
      detectedPhrases.push('Artificial pause patterns');
    }

    // Check for consistent response latency (suggesting automated responses)
    const latencyVariance = calculateVariance(audioFeatures.responseLatency);
    if (latencyVariance < 0.05) {
      aiIndicators.confidence += 0.25;
      detectedPhrases.push('Automated response timing');
    }

    // Check for unnatural intonation patterns
    if (audioFeatures.intonationVariance < 0.2) {
      aiIndicators.clonedVoicePatterns = true;
      aiIndicators.confidence += 0.3;
      detectedPhrases.push('Synthetic voice patterns');
    }
  }

  // Combined confidence score
  confidence = Math.min(1, confidence + aiIndicators.confidence);
  
  // Lower threshold for blocking if AI indicators are strong
  isScam = confidence > 0.4 || aiIndicators.confidence > 0.6;

  // Boost confidence if multiple categories detected (polymorphic scam)
  if (detectedPhrases.length > 3) {
    confidence = Math.min(1, confidence * 1.2);
    isScam = true;
  }

  return {
    isScam,
    confidence,
    detectedPhrases: [...new Set(detectedPhrases)], // Remove duplicates
    category,
    language,
    aiVoiceIndicators: aiIndicators.confidence > 0 ? aiIndicators : undefined
  };
}

function calculateVariance(values: number[]): number {
  if (values.length === 0) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const squareDiffs = values.map(value => Math.pow(value - mean, 2));
  return Math.sqrt(squareDiffs.reduce((a, b) => a + b, 0) / values.length);
}

// Learn new scam phrases from confirmed scam calls
export async function learnNewScamPhrases(
  text: string,
  language: string,
  isConfirmedScam: boolean,
  category?: string
): Promise<void> {
  if (!isConfirmedScam) return;

  try {
    // Extract potential new patterns
    const words = text.toLowerCase().split(/\s+/);
    const phrases: string[] = [];

    // Look for 2-3 word patterns
    for (let i = 0; i < words.length - 1; i++) {
      phrases.push(`${words[i]} ${words[i + 1]}`);
      if (i < words.length - 2) {
        phrases.push(`${words[i]} ${words[i + 1]} ${words[i + 2]}`);
      }
    }

    // Store in database for future machine learning
    await db.insert(voicePatterns).values({
      confidence: "0.85",
      features: {
        text,
        language,
        category,
        phrases,
        confirmedAt: new Date().toISOString()
      },
      language,
      metadata: {
        category,
        source: 'user_report',
        patternType: 'scam_phrase',
        phraseCount: phrases.length
      }
    });

    console.log(`Learned ${phrases.length} potential scam patterns from confirmed scam`);
  } catch (error) {
    console.error('Error learning scam phrases:', error);
  }
}

// Get dynamically learned patterns from database
export async function getDynamicPatterns(language: string, category: string): Promise<RegExp[]> {
  try {
    const patterns = await db.query.voicePatterns.findMany({
      where: (fields, { and, eq }) => 
        and(
          eq(fields.language, language),
          eq(fields.metadata, { category, patternType: 'scam_phrase' } as any)
        ),
      limit: 100
    });

    return patterns
      .map((p: any) => {
        const features = p.features as any;
        return features?.phrases || [];
      })
      .flat()
      .map((phrase: string) => new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'));
  } catch (error) {
    console.error('Error fetching dynamic patterns:', error);
    return [];
  }
}

// Detect scam phrases with dynamic learning
export async function detectScamPhrasesAdvanced(
  text: string,
  language: string,
  audioFeatures?: {
    pausePatterns: number[];
    responseLatency: number[];
    intonationVariance: number;
  }
): Promise<ScamDetectionResult> {
  // First, run standard detection
  const result = await detectScamPhrases(text, language, audioFeatures);

  // Then, check against dynamically learned patterns
  try {
    const categories = ['investment', 'government', 'tech', 'aiScam', 'lottery', 'utility'];
    
    for (const category of categories) {
      const dynamicPatterns = await getDynamicPatterns(language, category);
      
      for (const pattern of dynamicPatterns) {
        if (pattern.test(text)) {
          result.detectedPhrases.push(`Learned pattern (${category})`);
          result.confidence = Math.min(1, result.confidence + 0.15);
          if (!result.category) result.category = category;
        }
      }
    }

    result.isScam = result.confidence > 0.4;
  } catch (error) {
    console.error('Error in advanced detection:', error);
  }

  return result;
}
