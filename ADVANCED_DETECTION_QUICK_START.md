# Advanced Detection Quick Start Guide

## 🚀 Quick Start (Development Mode)

### Run All Detections

```typescript
import AdvancedDetectionCoordinator from './server/services/advancedDetectionCoordinator';

// Initialize with development mode (no API keys needed)
const detector = new AdvancedDetectionCoordinator(true);

// Analyze a call
const result = await detector.runAllDetections({
  callerId: '+15551234567',
  audioData: audioBuffer, // Float32Array
  transcript: 'This is the IRS. Your account has been suspended...',
  sipHeaders: {
    From: '"Scammer" <sip:5551234567@scam.com>',
    Via: 'SIP/2.0/UDP 192.168.1.1:5060;branch=z9hG4bKtest',
    'User-Agent': 'sipvicious'
  },
  sampleRate: 8000
});

// Check results
console.log('Overall Risk:', result.overallRiskScore); // 0.0-1.0
console.log('Confidence:', result.confidence); // 0.0-1.0  
console.log('Reasoning:', result.reasoning);

// Get recommendations
result.recommendations.forEach(rec => console.log('→', rec));

// Check individual method results
if (result.individualResults.sentiment.manipulationRisk > 0.7) {
  console.log('⚠️ High emotional manipulation detected!');
}
```

---

## 📊 Understanding Results

### Risk Score Ranges

| Score | Level | Action |
|-------|-------|--------|
| 0.0-0.2 | **Low Risk** | Allow call |
| 0.2-0.5 | **Medium Risk** | Flag for review |
| 0.5-0.7 | **High Risk** | Block with user notification |
| 0.7-1.0 | **Critical Risk** | Auto-block immediately |

### Confidence Levels

| Confidence | Meaning |
|------------|---------|
| 0.9-1.0 | Very confident in assessment |
| 0.7-0.9 | Confident |
| 0.5-0.7 | Moderate confidence |
| <0.5 | Low confidence - need more data |

---

## 🔧 Individual Method Usage

### 1. Blockchain Verification

```typescript
import BlockchainCallerVerification from './server/services/blockchainCallerVerification';

const blockchain = new BlockchainCallerVerification(true);
const result = await blockchain.verifyCallerOnChain('+15551234567');

console.log('On-chain:', result.onChain); // boolean
console.log('Trust score:', result.trustScore); // 0.0-1.0
console.log('Complaints:', result.complaintCount);
```

### 2. Social Network Validation

```typescript
import SocialNetworkValidator from './server/services/socialNetworkValidator';

const social = new SocialNetworkValidator(true);
const result = await social.validateCaller('+15551234567');

console.log('Platforms found:', result.platformsFound); // ['LinkedIn', 'Facebook', ...]
console.log('Confidence:', result.confidence);
console.log('Is business:', result.isVerifiedBusiness);
```

### 3. STIR/SHAKEN

```typescript
import STIRSHAKENVerification from './server/services/stirShakenVerification';

const stirShaken = new STIRSHAKENVerification(true);
const result = await stirShaken.verifyCallAuthenticity(
  '+15551234567',
  { Identity: '<jwt_token>;info=https://cert.com;alg=ES256;ppt=shaken' }
);

console.log('Verified:', result.verified);
console.log('Attestation:', result.attestationLevel); // 'A', 'B', 'C', or 'none'
console.log('Signature valid:', result.signatureValid);
```

### 4. Acoustic Environment

```typescript
import AcousticEnvironmentAnalysis from './server/services/acousticEnvironmentAnalysis';

const acoustic = new AcousticEnvironmentAnalysis(true);
const result = await acoustic.analyzeAcousticEnvironment(audioData, 8000);

console.log('Is call center:', result.isCallCenter);
console.log('Environment:', result.features.environmentType);
console.log('Background noise:', result.features.backgroundNoiseLevel);
console.log('Multiple voices:', result.features.multipleVoicesDetected);
```

### 5. Behavioral Biometrics

```typescript
import BehavioralBiometrics from './server/services/behavioralBiometrics';

const biometrics = new BehavioralBiometrics(true);
const result = await biometrics.analyzeBehavioralBiometrics(
  audioData,
  'Hello this is a scam call',
  '+15551234567',
  8000
);

console.log('Fingerprint ID:', result.fingerprintId);
console.log('Match confidence:', result.matchConfidence);
console.log('Persistent scammer:', result.isPersistentScammer);
console.log('Previous calls:', result.previousCalls);

// Mark as scammer for future tracking
if (confirmed_scam) {
  biometrics.markAsScammer(result.fingerprintId);
}
```

### 6. VoIP IP Reputation

```typescript
import VoIPIPReputationChecker from './server/services/voipIPReputationChecker';

const ipChecker = new VoIPIPReputationChecker(true);
const result = await ipChecker.checkIPReputation('192.168.1.100', sipHeaders);

console.log('IP:', result.ipAddress);
console.log('Blacklisted:', result.isBlacklisted);
console.log('Reputation:', result.reputationScore);
console.log('Provider:', result.provider);
console.log('Country:', result.country);
console.log('Blacklist sources:', result.blacklistSources);
```

### 7. Call Metadata Analysis

```typescript
import CallMetadataAnalyzer from './server/services/callMetadataAnalyzer';

const metadata = new CallMetadataAnalyzer(true);
const result = await metadata.analyzeMetadata({
  From: '"Caller" <sip:5551234567@domain.com>',
  To: '<sip:me@mydomain.com>',
  'Call-ID': 'abc123@host',
  CSeq: '1 INVITE',
  Via: 'SIP/2.0/UDP 1.2.3.4:5060;branch=z9hG4bKtest',
  'User-Agent': 'My Softphone 1.0'
});

console.log('Has anomalies:', result.hasAnomalies);
console.log('Anomalies:', result.anomalies);
console.log('Spoofing indicators:', result.spoofingIndicators);
console.log('Protocol compliant:', result.protocolCompliance);
```

### 8. Sentiment Analysis

```typescript
import SentimentAnalyzer from './server/services/sentimentAnalyzer';

const sentiment = new SentimentAnalyzer(true);
const result = await sentiment.analyzeSentiment(
  'This is urgent! Your account has been suspended. You must call us immediately or face arrest!'
);

console.log('Manipulation risk:', result.manipulationRisk);
console.log('Urgency:', result.sentimentScore.urgency);
console.log('Fear:', result.sentimentScore.fear);
console.log('Pressure:', result.sentimentScore.pressure);
console.log('Tactics detected:', result.emotionalTactics.detectedTactics);
```

---

## 🎯 Common Use Cases

### Use Case 1: Spam Call Detection

```typescript
const detector = new AdvancedDetectionCoordinator(true);

async function shouldBlockCall(callerId: string, transcript: string) {
  const result = await detector.runAllDetections({
    callerId,
    transcript,
    audioData: new Float32Array(), // Provide actual audio
    sampleRate: 8000
  });
  
  if (result.overallRiskScore > 0.7) {
    console.log('🚫 BLOCK:', result.reasoning);
    return true;
  } else if (result.overallRiskScore > 0.5) {
    console.log('⚠️ FLAG:', result.reasoning);
    return 'flag'; // Flag for user review
  }
  
  console.log('✅ ALLOW:', result.reasoning);
  return false;
}
```

### Use Case 2: Track Persistent Scammer

```typescript
const biometrics = new BehavioralBiometrics(true);

async function trackScammer(audioData: Float32Array, transcript: string, callerId: string) {
  const result = await biometrics.analyzeBehavioralBiometrics(
    audioData,
    transcript,
    callerId,
    8000
  );
  
  if (result.isPersistentScammer) {
    console.log(`🎯 Persistent scammer detected!`);
    console.log(`   Previous calls: ${result.previousCalls}`);
    console.log(`   Phone numbers used: ${result.fingerprintId}`);
    console.log(`   Match confidence: ${result.matchConfidence}`);
    
    // Alert user
    return {
      block: true,
      reason: `Known scammer - ${result.previousCalls} previous attempts`
    };
  }
}
```

### Use Case 3: Verify Legitimate Business

```typescript
async function verifyBusiness(callerId: string) {
  const social = new SocialNetworkValidator(true);
  const blockchain = new BlockchainCallerVerification(true);
  const stirShaken = new STIRSHAKENVerification(true);
  
  const [socialResult, blockchainResult, stirShakenResult] = await Promise.all([
    social.validateCaller(callerId),
    blockchain.verifyCallerOnChain(callerId),
    stirShaken.verifyCallAuthenticity(callerId, {})
  ]);
  
  const isLegit = 
    socialResult.isVerifiedBusiness ||
    (blockchainResult.trustScore > 0.7 && blockchainResult.complaintCount === 0) ||
    stirShakenResult.attestationLevel === 'A';
  
  if (isLegit) {
    console.log('✅ Verified legitimate business');
    return { verified: true, confidence: 0.95 };
  }
  
  return { verified: false, confidence: 0.3 };
}
```

### Use Case 4: Detect Call Center Scams

```typescript
async function detectCallCenterScam(audioData: Float32Array, transcript: string) {
  const acoustic = new AcousticEnvironmentAnalysis(true);
  const sentiment = new SentimentAnalyzer(true);
  
  const [acousticResult, sentimentResult] = await Promise.all([
    acoustic.analyzeAcousticEnvironment(audioData, 8000),
    sentiment.analyzeSentiment(transcript)
  ]);
  
  if (acousticResult.isCallCenter && sentimentResult.manipulationRisk > 0.6) {
    console.log('🚨 Call center scam detected!');
    console.log(`   Environment: ${acousticResult.features.environmentType}`);
    console.log(`   Manipulation tactics: ${sentimentResult.emotionalTactics.detectedTactics.join(', ')}`);
    return {
      isScam: true,
      confidence: 0.9,
      reason: 'Call center with high manipulation tactics'
    };
  }
  
  return { isScam: false };
}
```

---

## 🛡️ Integration with Existing FiLine Code

### Add to Modem Interface

```typescript
// server/services/modemInterface.ts
import AdvancedDetectionCoordinator from './advancedDetectionCoordinator';

class ModemInterface {
  private advancedDetector: AdvancedDetectionCoordinator;
  
  constructor() {
    this.advancedDetector = new AdvancedDetectionCoordinator(
      process.env.NODE_ENV !== 'production'
    );
  }
  
  private async analyzeIncomingCall(callerId: string, audioData: Float32Array) {
    // Get transcript from existing voice analysis
    const transcript = await this.voiceAnalysis(audioData);
    
    // Run advanced detection
    const result = await this.advancedDetector.runAllDetections({
      callerId,
      audioData,
      transcript,
      sipHeaders: this.lastSipHeaders,
      sampleRate: 8000
    });
    
    // Make blocking decision
    if (result.overallRiskScore > 0.7) {
      await this.blockCall(callerId, result.reasoning);
    } else if (result.overallRiskScore > 0.5) {
      await this.flagCall(callerId, result.reasoning);
    }
    
    return result;
  }
}
```

### Add to Call Screening Service

```typescript
// server/services/callScreening.ts
import AdvancedDetectionCoordinator from './advancedDetectionCoordinator';

export async function screenCall(callData: CallData) {
  const coordinator = new AdvancedDetectionCoordinator(false);
  
  // Run all existing checks PLUS advanced detection
  const [basicChecks, advancedChecks] = await Promise.all([
    runBasicScreening(callData),
    coordinator.runAllDetections({
      callerId: callData.callerId,
      audioData: callData.audioBuffer,
      transcript: callData.transcript,
      sipHeaders: callData.sipHeaders
    })
  ]);
  
  // Combine results
  const finalRisk = Math.max(basicChecks.risk, advancedChecks.overallRiskScore);
  
  return {
    risk: finalRisk,
    shouldBlock: finalRisk > 0.7,
    reasoning: `${basicChecks.reason}; ${advancedChecks.reasoning}`,
    recommendations: advancedChecks.recommendations
  };
}
```

---

## 📈 Performance Tips

### 1. Use Caching
```typescript
// Cache results for frequently called numbers
const cache = new Map<string, { result: any, timestamp: number }>();
const CACHE_DURATION = 3600000; // 1 hour

async function getCachedResult(callerId: string) {
  const cached = cache.get(callerId);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.result;
  }
  
  const result = await detector.runAllDetections({...});
  cache.set(callerId, { result, timestamp: Date.now() });
  return result;
}
```

### 2. Parallel Execution
Already built into coordinator, but for individual methods:

```typescript
// BAD: Sequential
const social = await validator.validateCaller(callerId);
const blockchain = await verifier.verifyCallerOnChain(callerId);
const ip = await checker.checkIPReputation(ipAddress);

// GOOD: Parallel
const [social, blockchain, ip] = await Promise.all([
  validator.validateCaller(callerId),
  verifier.verifyCallerOnChain(callerId),
  checker.checkIPReputation(ipAddress)
]);
```

### 3. Selective Method Execution
Only run expensive methods when needed:

```typescript
async function smartDetection(callerId: string, quickCheckRisk: number) {
  // If quick checks show low risk, skip expensive methods
  if (quickCheckRisk < 0.3) {
    return { risk: quickCheckRisk, confidence: 0.7 };
  }
  
  // Only run full advanced detection for suspicious calls
  return await detector.runAllDetections({...});
}
```

---

## 🐛 Debugging

### Enable Verbose Logging

```typescript
const detector = new AdvancedDetectionCoordinator(true);

// Add logging to each method
detector.runAllDetections({...}).then(result => {
  console.log('=== ADVANCED DETECTION RESULTS ===');
  console.log('Overall Risk:', result.overallRiskScore);
  console.log('Confidence:', result.confidence);
  console.log('\n--- Individual Results ---');
  
  Object.entries(result.individualResults).forEach(([method, data]) => {
    console.log(`\n${method}:`, JSON.stringify(data, null, 2));
  });
});
```

### Check Method Failures

```typescript
const result = await detector.runAllDetections({...});

// Check if any methods failed
Object.entries(result.individualResults).forEach(([method, data]) => {
  if (data.error) {
    console.error(`❌ ${method} failed:`, data.error);
  }
});
```

---

## 🎓 Learning Path

1. **Start with sentiment analysis** (easiest to understand)
2. **Try acoustic analysis** (visual results with spectrograms)
3. **Experiment with metadata** (see SIP header analysis)
4. **Test behavioral biometrics** (track callers across calls)
5. **Integrate blockchain** (decentralized reputation)
6. **Add social validation** (cross-reference with social media)
7. **Enable STIR/SHAKEN** (cryptographic verification)
8. **Use VoIP IP checking** (network-level filtering)

---

## 📞 Support & Resources

- **Full Documentation:** `ADVANCED_DETECTION_IMPLEMENTATION.md`
- **Original Proposal:** `ADVANCED_DETECTION_METHODS.md`
- **Code Examples:** Individual service files have extensive comments
- **Integration Guide:** See `server/services/advancedDetectionCoordinator.ts`

---

## ✅ Checklist for Production

- [ ] Set `developmentMode = false`
- [ ] Configure all API keys in `.env`
- [ ] Set up database for fingerprint storage
- [ ] Enable Redis caching
- [ ] Configure trusted Certificate Authorities for STIR/SHAKEN
- [ ] Test with real phone calls
- [ ] Monitor accuracy metrics
- [ ] Set up alerting for method failures
- [ ] Tune risk score thresholds
- [ ] Enable logging and monitoring

---

**Ready to detect scams like never before! 🛡️**
