import { db } from "@db";
import { sql } from "drizzle-orm";
import { callLogs } from "@db/schema";
import { spawn } from "child_process";

interface CallFeatures {
  hour: number;
  latitude?: number;
  longitude?: number;
  historicalBlockRate: number;
  lineType?: string;
  carrierRisk?: number;
}

interface PredictionResult {
  spamProbability: number;
  features: string[];
  confidence: number;
}

interface MLResult {
  probability: number;
  confidence: number;
  feature_importance: number[];
}

// Python script for ML prediction
const PYTHON_SCRIPT = `
import sys
import json
import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.preprocessing import StandardScaler

def train_model(data):
    X = np.array([[
        d['hour'],
        d.get('latitude', 0),
        d.get('longitude', 0),
        d['historicalBlockRate'],
        d.get('carrierRisk', 0)
    ] for d in data['features']])

    y = np.array(data['labels'])

    # Normalize features
    scaler = StandardScaler()
    X = scaler.fit_transform(X)

    # Train model with more trees and balanced class weights
    clf = RandomForestClassifier(
        n_estimators=200,
        class_weight='balanced',
        max_depth=10,
        random_state=42
    )
    clf.fit(X, y)

    # Make prediction for new data
    new_data = np.array([[
        data['new_call']['hour'],
        data['new_call'].get('latitude', 0),
        data['new_call'].get('longitude', 0),
        data['new_call']['historicalBlockRate'],
        data['new_call'].get('carrierRisk', 0)
    ]])
    new_data = scaler.transform(new_data)

    # Get prediction and confidence
    pred_prob = clf.predict_proba(new_data)[0]
    feature_importance = clf.feature_importances_

    return {
        'probability': float(pred_prob[1]),  # Probability of spam
        'confidence': float(np.max(pred_prob)),
        'feature_importance': feature_importance.tolist()
    }

if __name__ == '__main__':
    # Read input from Node.js
    input_data = json.loads(sys.stdin.read())
    result = train_model(input_data)
    print(json.dumps(result))
`

export async function predictSpam(phoneNumber: string): Promise<PredictionResult> {
  try {
    // Extract hour from current time
    const hour = new Date().getHours();

    // Get historical data for training
    const [history] = await db
      .select({
        total: sql<number>`count(*)`,
        blocked: sql<number>`count(*) filter (where ${callLogs.action} = 'blocked')`,
        avgLat: sql<number>`avg(${callLogs.latitude})`,
        avgLong: sql<number>`avg(${callLogs.longitude})`,
        lineType: sql<string>`mode() within group (order by ${callLogs.lineType})`,
      })
      .from(callLogs)
      .where(sql`${callLogs.phoneNumber} = ${phoneNumber}`);

    // Calculate carrier risk based on line type
    const carrierRisk = calculateCarrierRisk(history.lineType);

    // Get training data from all calls
    const trainingData = await db
      .select({
        hour: sql<number>`extract(hour from ${callLogs.timestamp})::integer`,
        latitude: callLogs.latitude,
        longitude: callLogs.longitude,
        action: callLogs.action,
        lineType: callLogs.lineType,
      })
      .from(callLogs)
      .limit(1000);  // Use last 1000 calls for training

    // Prepare data for Python ML script
    const mlInput = {
      features: trainingData.map(call => ({
        hour: call.hour,
        latitude: call.latitude ? Number(call.latitude) : undefined,
        longitude: call.longitude ? Number(call.longitude) : undefined,
        historicalBlockRate: history.total > 0 ? history.blocked / history.total : 0,
        carrierRisk: calculateCarrierRisk(call.lineType),
      })),
      labels: trainingData.map(call => call.action === 'blocked' ? 1 : 0),
      new_call: {
        hour,
        latitude: history.avgLat ? Number(history.avgLat) : undefined,
        longitude: history.avgLong ? Number(history.avgLong) : undefined,
        historicalBlockRate: history.total > 0 ? history.blocked / history.total : 0,
        carrierRisk,
      }
    };

    // Run Python ML script
    const python = spawn('python3', ['-c', PYTHON_SCRIPT]);
    let result = '';
    let error = '';

    python.stdout.on('data', (data) => {
      result += data.toString();
    });

    python.stderr.on('data', (data) => {
      error += data.toString();
    });

    // Write input data to Python script
    python.stdin.write(JSON.stringify(mlInput));
    python.stdin.end();

    // Wait for Python script to complete
    const exitCode = await new Promise<number>((resolve) => {
      python.on('close', resolve);
    });

    if (exitCode !== 0) {
      console.error('Python script error:', error);
      // Fallback to rule-based prediction if ML fails
      return generateRuleBasedPrediction(hour, history);
    }

    try {
      const mlResult = JSON.parse(result) as MLResult;
      const features: string[] = [];

      // Generate feature explanations
      const featureNames = ['Time of day', 'Location', 'Geographic pattern', 'Historical blocks', 'Carrier type'];
      mlResult.feature_importance.forEach((importance: number, i: number) => {
        if (importance > 0.2) {  // Only include significant features
          features.push(`${featureNames[i]} impact: ${(importance * 100).toFixed(1)}%`);
        }
      });

      return {
        spamProbability: mlResult.probability,
        features,
        confidence: mlResult.confidence
      };
    } catch (e) {
      console.error('Error parsing ML result:', e);
      return generateRuleBasedPrediction(hour, history);
    }
  } catch (error) {
    console.error('Error in spam prediction:', error);
    throw error;
  }
}

function generateRuleBasedPrediction(hour: number, history: { 
  total: number; 
  blocked: number;
  lineType?: string;
}): PredictionResult {
  const features: string[] = [];
  let spamProbability = 0;

  // Time-based analysis
  const riskHours = [0, 1, 2, 3, 4, 22, 23]; // Late night/early morning
  if (riskHours.includes(hour)) {
    spamProbability += 0.3;
    features.push("Suspicious call time");
  }

  // Historical block rate
  const blockRate = history.total > 0 ? (history.blocked / history.total) : 0;
  if (blockRate > 0) {
    spamProbability += blockRate * 0.4;
    features.push(`Historical block rate: ${(blockRate * 100).toFixed(1)}%`);
  }

  // Line type risk
  const carrierRisk = calculateCarrierRisk(history.lineType);
  if (carrierRisk > 0.3) {
    spamProbability += carrierRisk * 0.3;
    features.push(`High-risk line type: ${history.lineType}`);
  }

  return {
    spamProbability: Math.min(1, spamProbability),
    features,
    confidence: Math.min(1, (history.total / 10)) // More history = higher confidence
  };
}

function calculateCarrierRisk(lineType?: string): number {
  if (!lineType) return 0.5;  // Unknown type has medium risk

  switch (lineType.toLowerCase()) {
    case 'voip':
      return 0.8;  // Higher risk for VoIP numbers
    case 'mobile':
      return 0.3;  // Lower risk for mobile numbers
    case 'landline':
      return 0.2;  // Lowest risk for landlines
    default:
      return 0.5;  // Medium risk for unknown types
  }
}

// Export for testing and model evaluation
export async function updateSpamModel(): Promise<void> {
  // In the future, we could add periodic model retraining here
  console.log("Model updated");
}