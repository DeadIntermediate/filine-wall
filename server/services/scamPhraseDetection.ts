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

// Multi-language scam phrase database
const scamPhrasePatterns = {
  en: {
    investment: [
      "guaranteed returns?",
      "risk-free investment",
      "double your money",
      "crypto opportunity",
      "limited time offer"
    ],
    government: [
      "social security number",
      "tax refund",
      "government grant",
      "stimulus payment",
      "federal agency"
    ],
    tech: [
      "computer virus",
      "technical support",
      "microsoft security",
      "apple support",
      "account compromised"
    ],
    aiScam: [
      "voice verification required",
      "voice signature needed",
      "voice authentication system",
      "automated security check",
      "voice recording for verification"
    ]
  },
  es: {
    investment: [
      "rendimientos garantizados",
      "inversión sin riesgo",
      "duplicar su dinero",
      "oportunidad crypto",
      "oferta por tiempo limitado"
    ],
    government: [
      "número de seguro social",
      "reembolso de impuestos",
      "subvención gubernamental",
      "pago de estímulo",
      "agencia federal"
    ],
    tech: [
      "virus en computadora",
      "soporte técnico",
      "seguridad de microsoft",
      "soporte de apple",
      "cuenta comprometida"
    ],
    aiScam: [
      "verificación de voz requerida",
      "firma de voz necesaria",
      "sistema de autenticación de voz",
      "control de seguridad automatizado",
      "grabación de voz para verificación"
    ]
  },
  zh: {
    investment: [
      "保证回报",
      "零风险投资",
      "翻倍收益",
      "加密货币机会",
      "限时优惠"
    ],
    government: [
      "社会安全号码",
      "税务退款",
      "政府补助",
      "纾困金",
      "联邦机构"
    ],
    tech: [
      "电脑病毒",
      "技术支持",
      "微软安全",
      "苹果支持",
      "账户被盗"
    ],
    aiScam: [
      "需要语音验证",
      "需要声音签名",
      "语音认证系统",
      "自动安全检查",
      "验证用语音录音"
    ]
  },
  hi: {
    investment: [
      "गारंटीड रिटर्न",
      "जोखिम मुक्त निवेश",
      "पैसा दोगुना",
      "क्रिप्टो अवसर",
      "सीमित समय का ऑफर"
    ],
    government: [
      "आधार नंबर",
      "टैक्स रिफंड",
      "सरकारी अनुदान",
      "राहत राशि",
      "सरकारी एजेंसी"
    ],
    tech: [
      "कंप्यूटर वायरस",
      "तकनीकी सहायता",
      "माइक्रोसॉफ्ट सुरक्षा",
      "एप्पल सपोर्ट",
      "खाता खतरे में"
    ],
    aiScam: [
      "आवाज़ सत्यापन आवश्यक",
      "वॉइस सिग्नेचर चाहिए",
      "वॉइस प्रमाणीकरण सिस्टम",
      "स्वचालित सुरक्षा जांच",
      "सत्यापन के लिए आवाज़ रिकॉर्डिंग"
    ]
  }
};

// AI voice scam patterns
const aiVoicePatterns = {
  scriptedResponses: [
    /please.{1,20}repeat.{1,20}after me/i,
    /voice.{1,20}verification.{1,20}system/i,
    /automated.{1,20}security.{1,20}check/i,
    /confirm.{1,20}identity.{1,20}by.{1,20}speaking/i
  ],
  suspiciousPhrases: [
    /voice.{1,20}signature/i,
    /voice.{1,20}print/i,
    /voice.{1,20}authentication/i,
    /voice.{1,20}recording/i
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
  if (!patterns) {
    return {
      isScam: false,
      confidence: 0,
      detectedPhrases: [],
      language
    };
  }

  // Check each category of scam phrases
  for (const [cat, phrases] of Object.entries(patterns)) {
    for (const phrase of phrases) {
      const regex = new RegExp(phrase, 'i');
      if (regex.test(text)) {
        detectedPhrases.push(phrase);
        if (!category) category = cat;
        confidence += 0.2; // Increase confidence for each matched phrase
      }
    }
  }

  // Check for AI voice scam patterns
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
      aiIndicators.confidence += 0.25;
    }
  }

  // Check for suspicious phrases
  for (const pattern of aiVoicePatterns.suspiciousPhrases) {
    if (pattern.test(text)) {
      aiIndicators.confidence += 0.25;
    }
  }

  // Analyze audio features if provided
  if (audioFeatures) {
    // Check for unnatural pause patterns (too regular)
    const pauseVariance = calculateVariance(audioFeatures.pausePatterns);
    if (pauseVariance < 0.1) { // Very regular pauses suggest automated/scripted speech
      aiIndicators.artificialPauses = true;
      aiIndicators.confidence += 0.25;
    }

    // Check for consistent response latency (suggesting automated responses)
    const latencyVariance = calculateVariance(audioFeatures.responseLatency);
    if (latencyVariance < 0.05) {
      aiIndicators.confidence += 0.25;
    }

    // Check for unnatural intonation patterns
    if (audioFeatures.intonationVariance < 0.2) {
      aiIndicators.clonedVoicePatterns = true;
      aiIndicators.confidence += 0.25;
    }
  }

  // Combined confidence score
  confidence = Math.min(1, confidence + aiIndicators.confidence);
  isScam = confidence > 0.4 || aiIndicators.confidence > 0.5;

  return {
    isScam,
    confidence,
    detectedPhrases,
    category,
    language,
    aiVoiceIndicators: aiIndicators.confidence > 0 ? aiIndicators : undefined
  };
}

function calculateVariance(values: number[]): number {
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

  // Store the new pattern in the database for future analysis
  await db.insert(voicePatterns).values({
    confidence: "0.8", // High confidence since it's confirmed
    features: {
      text,
      language,
      category,
      confirmedAt: new Date().toISOString()
    },
    language,
    metadata: {
      category,
      source: 'user_report',
      patternType: 'scam_phrase'
    }
  });
}
