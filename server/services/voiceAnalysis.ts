import { spawn } from "child_process";
import { voicePatternLearner } from "./voicePatternLearning";

interface VoiceAnalysisResult {
  isRobot: boolean;
  confidence: number;
  features: string[];
  patterns?: {
    repetition?: number;
    naturalness?: number;
    pitch?: number;
    energy?: number;
    zeroCrossings?: number;
    pausePatterns?: number[];
    responseLatency?: number[];
    intonationVariance?: number;
  };
}

const VOICE_ANALYSIS_SCRIPT = `
import sys
import json
import numpy as np
from scipy import signal

def analyze_voice_stream(audio_data, sample_rate):
    # Convert audio data to numpy array
    y = np.array(audio_data)

    # Calculate basic features
    # 1. Zero crossings (measure of frequency content)
    zero_crossings = np.sum(np.abs(np.diff(np.signbit(y))))

    # 2. Energy features
    energy = np.sum(y**2) / len(y)
    rms = np.sqrt(np.mean(y**2))

    # 3. Pitch estimation using autocorrelation
    f0_min = 50  # Minimum pitch in Hz
    f0_max = 500  # Maximum pitch in Hz

    corr = signal.correlate(y, y)
    lags = signal.correlation_lags(len(y), len(y))
    valid_lags = np.where((lags >= sample_rate/f0_max) & (lags <= sample_rate/f0_min))[0]

    if len(valid_lags) > 0:
        pitch_idx = valid_lags[np.argmax(corr[valid_lags])]
        pitch = sample_rate / pitch_idx if pitch_idx > 0 else 0
        pitch_confidence = np.max(corr[valid_lags]) / corr[len(y)-1]
    else:
        pitch = 0
        pitch_confidence = 0

    # 4. Rhythm and pause analysis
    # Split signal into frames
    frame_length = int(0.025 * sample_rate)  # 25ms frames
    hop_length = int(0.010 * sample_rate)    # 10ms hop

    frames = []
    for i in range(0, len(y)-frame_length, hop_length):
        frames.append(y[i:i+frame_length])

    frames = np.array(frames)
    frame_energy = np.sum(frames**2, axis=1)

    # Detect pauses (low energy regions)
    energy_threshold = 0.1 * np.max(frame_energy)
    is_pause = frame_energy < energy_threshold

    # Calculate pause patterns
    pause_lengths = []
    current_pause = 0

    for is_p in is_pause:
        if is_p:
            current_pause += 1
        elif current_pause > 0:
            pause_lengths.append(current_pause * hop_length / sample_rate)
            current_pause = 0

    if current_pause > 0:
        pause_lengths.append(current_pause * hop_length / sample_rate)

    # Calculate response latency (time between high energy regions)
    response_latency = []
    last_active = None

    for i, is_p in enumerate(is_pause):
        if not is_p:
            if last_active is not None and i - last_active > 1:
                response_latency.append((i - last_active) * hop_length / sample_rate)
            last_active = i

    # Calculate rhythm regularity
    if len(pause_lengths) > 1:
        rhythm_regularity = 1 - np.std(pause_lengths) / np.mean(pause_lengths)
    else:
        rhythm_regularity = 1.0

    # Determine if it's likely a robot based on features
    is_robot = (
        rhythm_regularity > 0.8 or                # Too regular rhythm
        (pitch > 0 and pitch_confidence > 0.8) or # Too stable pitch
        len(np.unique(pause_lengths)) < 3         # Too few unique pause patterns
    )

    confidence = min(1.0, max(0.0,
        0.3 * rhythm_regularity +
        0.3 * (pitch_confidence if pitch > 0 else 0) +
        0.4 * (1 - len(np.unique(pause_lengths)) / max(len(pause_lengths), 1))
    ))

    return {
        'is_robot': bool(is_robot),
        'confidence': float(confidence),
        'patterns': {
            'pitch': float(pitch),
            'pitchConfidence': float(pitch_confidence),
            'energy': float(energy),
            'zeroCrossings': int(zero_crossings),
            'rhythmRegularity': float(rhythm_regularity),
            'pausePatterns': [float(x) for x in pause_lengths],
            'responseLatency': [float(x) for x in response_latency],
        }
    }

if __name__ == '__main__':
    input_data = json.loads(sys.stdin.read())
    result = analyze_voice_stream(
        input_data['audio_data'],
        input_data['sample_rate']
    )
    print(json.dumps(result))
`;

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

    // Generate feature descriptions
    const features = generateFeatureDescriptions(analysis.patterns);

    // Learn from this pattern if confidence is high
    if (analysis.confidence > 0.8) {
      await voicePatternLearner.learnFromPattern(
        {
          mfcc: [], // We'll add this back when we have librosa
          spectral: {
            centroid: 0,
            rolloff: 0,
            bandwidth: 0
          },
          temporal: {
            zeroCrossings: analysis.patterns.zeroCrossings,
            energy: analysis.patterns.energy
          },
          pitch: {
            mean: analysis.patterns.pitch,
            variance: 0
          },
          rhythm: {
            tempo: analysis.patterns.rhythmRegularity * 120, // Approximate tempo
            beatStrength: analysis.patterns.energy
          }
        },
        analysis.is_robot ? 'robot' : 'legitimate'
      );
    }

    return {
      isRobot: analysis.is_robot,
      confidence: analysis.confidence,
      features,
      patterns: analysis.patterns
    };

  } catch (error) {
    console.error('Voice analysis failed:', error);
    return fallbackAnalysis();
  }
}

function generateFeatureDescriptions(patterns: any): string[] {
  const features: string[] = [];

  if (patterns.rhythmRegularity > 0.8) {
    features.push('Highly regular speech rhythm detected');
  }

  if (patterns.pitchConfidence > 0.8) {
    features.push('Unusually stable pitch patterns detected');
  }

  if (patterns.pausePatterns && patterns.pausePatterns.length > 0) {
    const uniquePauses = new Set(patterns.pausePatterns.map((p: number) => Math.round(p * 100) / 100));
    if (uniquePauses.size < 3) {
      features.push('Limited variation in pause patterns');
    }
  }

  if (patterns.responseLatency && patterns.responseLatency.length > 0) {
    const avgLatency = patterns.responseLatency.reduce((a: number, b: number) => a + b, 0) / patterns.responseLatency.length;
    if (avgLatency < 0.2) {
      features.push('Unusually quick response times');
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
      pitch: 0,
      energy: 0,
      zeroCrossings: 0
    }
  };
}