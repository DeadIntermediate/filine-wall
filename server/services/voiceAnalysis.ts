import { spawn } from "child_process";

interface VoiceAnalysisResult {
  isRobot: boolean;
  confidence: number;
  features: string[];
  language?: {
    detected: string;
    confidence: number;
  };
  patterns?: {
    repetition?: number;
    naturalness?: number;
    pitch?: number;
    languageSpecific?: {
      knownPhrases?: boolean;
      dialectMatch?: boolean;
    };
  };
}

// Python script for voice analysis with multi-language support
const VOICE_ANALYSIS_SCRIPT = `
import sys
import json
import numpy as np
import librosa
import sounddevice as sd
from scipy import signal
from transformers import Wav2Vec2ForCTC, Wav2Vec2Processor
from langdetect import detect, detect_langs
from torch import nn
import torch

# Load pre-trained speech recognition model
model_name = "facebook/wav2vec2-large-xlsr-53"
processor = Wav2Vec2Processor.from_pretrained(model_name)
model = Wav2Vec2ForCTC.from_pretrained(model_name)

def detect_language(text):
    try:
        # Get language probabilities
        langs = detect_langs(text)
        primary_lang = langs[0]
        return {
            'detected': primary_lang.lang,
            'confidence': primary_lang.prob
        }
    except:
        return None

def analyze_voice_stream(audio_data, sample_rate):
    # Convert audio data to numpy array
    y = np.array(audio_data)

    # Extract features
    # 1. Pitch detection
    pitches, magnitudes = librosa.piptrack(y=y, sr=sample_rate)
    pitch_mean = np.mean(pitches[magnitudes > np.max(magnitudes)/2])

    # 2. Speech rate detection (using zero crossings)
    zero_crossings = librosa.zero_crossings(y)
    speech_rate = sum(zero_crossings)

    # 3. Repetition detection
    mfccs = librosa.feature.mfcc(y=y, sr=sample_rate, n_mfcc=13)
    repetition_score = np.mean(np.std(mfccs, axis=1))

    # 4. Spectral features
    spec_cent = librosa.feature.spectral_centroid(y=y, sr=sample_rate)
    spec_rolloff = librosa.feature.spectral_rolloff(y=y, sr=sample_rate)

    # 5. Speech-to-text for language detection
    try:
        inputs = processor(y, sampling_rate=sample_rate, return_tensors="pt", padding=True)
        with torch.no_grad():
            logits = model(inputs.input_values).logits
        predicted_ids = torch.argmax(logits, dim=-1)
        transcription = processor.batch_decode(predicted_ids)[0]

        # Detect language from transcription
        lang_info = detect_language(transcription)
    except Exception as e:
        print(f"Language detection error: {str(e)}", file=sys.stderr)
        lang_info = None

    # Calculate naturalness score
    naturalness = calculate_naturalness(mfccs, spec_cent, spec_rolloff)

    # Language-specific pattern analysis
    language_patterns = analyze_language_patterns(y, sample_rate, lang_info['detected'] if lang_info else None)

    # Determine if it's a robot based on features
    is_robot = (
        repetition_score < 0.5 or  # High repetition
        naturalness < 0.4 or       # Unnatural speech
        speech_rate > 3.0 or       # Too fast/regular
        language_patterns.get('suspicious', False)  # Suspicious language patterns
    )

    return {
        'is_robot': bool(is_robot),
        'confidence': float(max(0.6, 1 - naturalness)),
        'language': lang_info,
        'patterns': {
            'repetition': float(repetition_score),
            'naturalness': float(naturalness),
            'pitch': float(pitch_mean) if not np.isnan(pitch_mean) else 0.0,
            'languageSpecific': language_patterns
        }
    }

def calculate_naturalness(mfccs, spec_cent, spec_rolloff):
    # Combined score based on multiple features
    mfcc_var = np.mean(np.var(mfccs, axis=1))
    cent_var = np.var(spec_cent)
    rolloff_var = np.var(spec_rolloff)

    # Normalize and combine scores
    naturalness = (
        0.4 * min(1.0, mfcc_var / 2.0) +
        0.3 * min(1.0, cent_var / 1000.0) +
        0.3 * min(1.0, rolloff_var / 1000.0)
    )

    return float(naturalness)

def analyze_language_patterns(audio, sample_rate, detected_language):
    # Common spam phrases in different languages
    spam_phrases = {
        'en': ['warranty', 'credit card', 'prize', 'won', 'free'],
        'es': ['premio', 'gratis', 'ganado', 'tarjeta'],
        'zh': ['优惠', '免费', '中奖', '推销'],
        'hi': ['मुफ्त', 'इनाम', 'जीता', 'कार्ड'],
        # Add more languages and phrases
    }

    # Analyze dialect consistency
    dialect_match = True  # Implement proper dialect analysis

    # Check for known spam phrases in detected language
    known_phrases = False
    if detected_language and detected_language in spam_phrases:
        # Implementation would check transcribed text against spam phrases
        known_phrases = False  # Placeholder

    return {
        'knownPhrases': known_phrases,
        'dialectMatch': dialect_match,
        'suspicious': known_phrases or not dialect_match
    }

if __name__ == '__main__':
    # Read input from Node.js
    input_data = json.loads(sys.stdin.read())
    result = analyze_voice_stream(
        input_data['audio_data'],
        input_data['sample_rate']
    )
    print(json.dumps(result))
`

export async function analyzeVoiceStream(audioData: number[], sampleRate: number): Promise<VoiceAnalysisResult> {
  try {
    // Run Python script for analysis
    const python = spawn('python3', ['-c', VOICE_ANALYSIS_SCRIPT]);
    let result = '';
    let error = '';

    python.stdout.on('data', (data) => {
      result += data.toString();
    });

    python.stderr.on('data', (data) => {
      error += data.toString();
    });

    // Send audio data to Python script
    python.stdin.write(JSON.stringify({
      audio_data: audioData,
      sample_rate: sampleRate
    }));
    python.stdin.end();

    // Wait for Python script to complete
    const exitCode = await new Promise<number>((resolve) => {
      python.on('close', resolve);
    });

    if (exitCode !== 0) {
      console.error('Voice analysis error:', error);
      return fallbackAnalysis();
    }

    const analysis = JSON.parse(result);
    return {
      isRobot: analysis.is_robot,
      confidence: analysis.confidence,
      features: generateFeatureDescriptions(analysis.patterns, analysis.language),
      language: analysis.language,
      patterns: analysis.patterns
    };
  } catch (error) {
    console.error('Voice analysis failed:', error);
    return fallbackAnalysis();
  }
}

function generateFeatureDescriptions(patterns: any, language: any): string[] {
  const features: string[] = [];

  if (patterns.repetition < 0.5) {
    features.push('High speech pattern repetition detected');
  }

  if (patterns.naturalness < 0.4) {
    features.push('Unnatural speech patterns detected');
  }

  if (patterns.pitch > 0 && (patterns.pitch < 50 || patterns.pitch > 300)) {
    features.push('Unusual pitch characteristics');
  }

  if (language) {
    features.push(`Detected language: ${language.detected} (${Math.round(language.confidence * 100)}% confidence)`);
  }

  if (patterns.languageSpecific) {
    if (patterns.languageSpecific.knownPhrases) {
      features.push('Known spam phrases detected in the speech');
    }
    if (!patterns.languageSpecific.dialectMatch) {
      features.push('Inconsistent dialect patterns detected');
    }
  }

  return features;
}

function fallbackAnalysis(): VoiceAnalysisResult {
  return {
    isRobot: false,
    confidence: 0.5,
    features: ['Using fallback analysis due to processing error'],
    patterns: {
      repetition: 0.5,
      naturalness: 0.5,
      pitch: 0
    }
  };
}