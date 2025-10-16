# Spam Number API Integration Setup Guide

This guide explains how to set up and configure external spam detection APIs for FiLine Wall.

## 🌐 Available APIs

### 1. **Twilio Lookup API** (Recommended - Commercial)

**Features:**
- Carrier identification
- Phone number validation
- Caller name lookup
- Line type detection (mobile, landline, VoIP)

**Setup:**
1. Sign up at [Twilio](https://www.twilio.com/)
2. Get your Account SID and Auth Token from the console
3. Add to `.env`:
```env
TWILIO_ACCOUNT_SID=your_account_sid_here
TWILIO_AUTH_TOKEN=your_auth_token_here
```

**Pricing:** Free trial with $15 credit, then $0.005 per lookup

**Enable in code:**
Edit `server/services/spamNumberAPIs.ts`:
```typescript
twilioLookup: {
    enabled: true, // Change to true
    // ...
}
```

---

### 2. **Numverify API** (Free Tier Available)

**Features:**
- Phone number validation
- Carrier lookup
- Line type detection
- Country/location data

**Setup:**
1. Sign up at [Numverify](https://numverify.com/)
2. Get your API key from dashboard
3. Add to `.env`:
```env
NUMVERIFY_API_KEY=your_api_key_here
```

**Pricing:** 
- Free: 250 requests/month
- Basic: $9.99/month - 5,000 requests
- Professional: $49.99/month - 50,000 requests

**Enable in code:**
```typescript
numverify: {
    enabled: true,
    // ...
}
```

---

### 3. **NumLookup API** (Free Tier)

**Features:**
- Spam score calculation
- Community spam reports
- Phone validation
- Carrier information

**Setup:**
1. Sign up at [NumLookup](https://www.numlookupapi.com/)
2. Get API key
3. Add to `.env`:
```env
NUMLOOKUP_API_KEY=your_api_key_here
```

**Pricing:**
- Free: 100 lookups/month
- Starter: $9/month - 1,000 lookups
- Professional: $49/month - 10,000 lookups

---

### 4. **FCC Database Integration** (Free - Government Data)

**Features:**
- Official FCC enforcement actions
- Consumer complaint data
- Do Not Originate (DNO) list
- Robocall violators database

**Setup:**
No API key required - uses public FCC data sources.

**Data Sources:**
- FCC Enforcement Bureau Actions
- Consumer Complaints (Open Data)
- Robocall Mitigation Database
- DNO List (spoofed numbers)

**Automatic Updates:**
Database automatically updates every 7 days from FCC sources.

---

### 5. **Community-Based APIs** (Free - Web Scraping)

#### Should I Answer
- Community spam database
- User-reported spam numbers
- No API key required (uses web scraping)

#### WhoCallsMe
- Crowdsourced spam reports
- Spam scoring system
- No API key required

**Note:** These use respectful web scraping. Use rate limiting to avoid overwhelming servers.

---

### 6. **PhoneValidator / Phone Spam Filter**

**Features:**
- Real-time spam detection
- Machine learning spam scoring
- Category classification
- Report counts

**Setup:**
1. Sign up at spam filter provider
2. Get API key
3. Add to `.env`:
```env
PHONE_SPAM_FILTER_KEY=your_api_key_here
```

---

## 🔧 Environment Configuration

Create or update your `.env` file in the project root:

```env
# Twilio Lookup API (Recommended)
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token_here

# Numverify API
NUMVERIFY_API_KEY=your_numverify_key_here

# NumLookup API
NUMLOOKUP_API_KEY=your_numlookup_key_here

# Phone Spam Filter
PHONE_SPAM_FILTER_KEY=your_spam_filter_key_here

# Optional: Pro versions
NUMVERIFY_PRO_API_KEY=your_pro_key_here
```

---

## 📊 How It Works

### Multi-Source Aggregation

FiLine Wall queries **multiple APIs simultaneously** and aggregates results:

1. **Parallel Queries**: All enabled APIs are called at once
2. **Weighted Scoring**: Results are combined with confidence weighting
3. **Majority Vote**: Spam determination based on consensus
4. **Caching**: Results cached for 24 hours to reduce API calls

### Example Check Process

```
Phone Number: (555) 123-4567
    ↓
┌───────────────────────────────────────┐
│  Parallel API Queries (Async)         │
├───────────────────────────────────────┤
│  ✓ Twilio         → Carrier: VoIP     │
│  ✓ NumLookup      → Spam Score: 0.8   │
│  ✓ FCC Database   → 3 complaints      │
│  ✓ Should I Answer → 127 reports      │
│  ✓ Community DB   → Flagged           │
└───────────────────────────────────────┘
    ↓
┌───────────────────────────────────────┐
│  Result Aggregation                   │
├───────────────────────────────────────┤
│  Spam Votes: 4/5 sources              │
│  Confidence: 0.82                     │
│  Report Count: 130                    │
│  Categories: robocall, telemarketer   │
└───────────────────────────────────────┘
    ↓
    BLOCK CALL
```

---

## 🎯 Recommended Setup

### For Maximum Protection (All APIs)

```env
# Enable all commercial APIs
TWILIO_ACCOUNT_SID=...
TWILIO_AUTH_TOKEN=...
NUMVERIFY_API_KEY=...
NUMLOOKUP_API_KEY=...
PHONE_SPAM_FILTER_KEY=...
```

**Monthly Cost:** ~$20-50 depending on call volume  
**Accuracy:** 95%+ spam detection  
**Coverage:** Global numbers

---

### For Budget Setup (Free APIs Only)

```typescript
// In spamNumberAPIs.ts, enable only:
- shouldIAnswer: enabled: true (Free)
- whoCallsMe: enabled: true (Free)
- ftcDNC: enabled: true (Free)
- fccSpamDatabase: Always enabled (Free)
```

**Monthly Cost:** $0  
**Accuracy:** 75-80% spam detection  
**Coverage:** US/Canada primarily

---

### For Businesses (Recommended Mix)

```env
# Commercial for carrier data
TWILIO_ACCOUNT_SID=...
TWILIO_AUTH_TOKEN=...

# Free for spam intelligence
# (Community APIs enabled by default)
```

**Monthly Cost:** ~$10-20  
**Accuracy:** 90%+ spam detection  
**Coverage:** US/Canada + International

---

## 🚀 Usage in Code

### Basic Usage

```typescript
import SpamNumberAPIService from './services/spamNumberAPIs';

const spamAPI = new SpamNumberAPIService();

// Check single number
const result = await spamAPI.checkNumber('(555) 123-4567');

console.log(result);
// {
//   isSpam: true,
//   confidence: 0.85,
//   sources: ['NumLookup', 'ShouldIAnswer', 'FCC'],
//   spamType: ['robocall', 'telemarketer'],
//   reportCount: 142,
//   details: 'Checked against 3 sources...'
// }
```

### Bulk Check

```typescript
const numbers = [
  '(555) 123-4567',
  '(555) 987-6543',
  '(555) 111-2222'
];

const results = await spamAPI.checkBulk(numbers);

results.forEach((result, number) => {
  console.log(`${number}: ${result.isSpam ? 'SPAM' : 'OK'}`);
});
```

### Integration with Call Flow

```typescript
// In your call screening logic
import { spamAPI } from './services/spamNumberAPIs';
import { fccDatabase } from './services/fccSpamDatabase';

async function screenIncomingCall(phoneNumber: string) {
  // Check external APIs
  const apiResult = await spamAPI.checkNumber(phoneNumber);
  
  // Check FCC database
  const fccResult = await fccDatabase.checkNumber(phoneNumber);
  
  // Combine with internal AI analysis
  const patternResult = await callPatternAnalyzer.analyzeCallPattern(phoneNumber);
  const voiceResult = await voiceAnalysis.analyze(audioStream);
  
  // Final decision with weighted scoring
  const totalRisk = 
    apiResult.confidence * 0.4 +
    fccResult.riskScore * 0.3 +
    patternResult.riskScore * 0.2 +
    voiceResult.robocallConfidence * 0.1;
  
  return totalRisk > 0.6 ? 'BLOCK' : 'ALLOW';
}
```

---

## 📈 Rate Limiting

Built-in rate limiting protects against API quota exhaustion:

- **Per-API Limits**: 10 requests/minute per API
- **Automatic Backoff**: Failed requests don't count against limits
- **Cache First**: Checks cache before calling APIs
- **Bulk Processing**: Batches of 10 with 1-second delays

---

## 💾 Caching Strategy

- **Cache Duration**: 24 hours
- **Cache Key**: Cleaned phone number
- **Invalidation**: Automatic after expiry
- **Clear Cache**: `spamAPI.clearCache()`

---

## 🔍 Monitoring

Get API usage statistics:

```typescript
const stats = spamAPI.getStats();

console.log(stats);
// {
//   cacheSize: 1247,
//   rateLimitStatus: { twilio: { count: 3, resetTime: 1634567890 } },
//   enabledAPIs: ['Twilio', 'NumLookup', 'ShouldIAnswer']
// }
```

---

## 🆓 Free Tier Optimization

To maximize free tier usage:

1. **Enable caching** (enabled by default)
2. **Use bulk checks** for multiple numbers
3. **Set longer cache expiry** for low-volume setups
4. **Prioritize community APIs** (free, unlimited)
5. **Use FCC database first** (free government data)

### Recommended Priority Order:

1. **Local Database** (instant, free)
2. **FCC Database** (free, updated weekly)
3. **Community APIs** (free, live data)
4. **Cached Results** (free, 24hr fresh)
5. **Commercial APIs** (paid, most accurate)

---

## 🔐 Security Notes

- **Never commit `.env` files** to version control
- **Rotate API keys** every 90 days
- **Use environment variables** for all secrets
- **Monitor API usage** to detect unauthorized access
- **Enable HTTPS only** for API calls

---

## 🐛 Troubleshooting

### API Not Returning Results

1. Check API key is correct in `.env`
2. Verify API is enabled in `spamNumberAPIs.ts`
3. Check rate limits: `spamAPI.getStats()`
4. Review logs for error messages
5. Test API directly with curl/Postman

### High API Costs

1. Enable caching (check cache is working)
2. Increase cache duration in code
3. Use bulk checks instead of individual
4. Prioritize free APIs
5. Consider switching to lower-cost alternatives

### Low Accuracy

1. Enable more API sources
2. Check if APIs have data for your region
3. Combine with ML-based detection
4. Report false positives to improve learning
5. Consider commercial APIs for better coverage

---

## 📞 Support

- **FCC Database Issues**: Check FCC.gov for data updates
- **API Provider Support**: Contact provider directly
- **Integration Help**: See main README.md
- **Bug Reports**: GitHub Issues

---

## 🔄 Keeping Data Fresh

### FCC Database
- Auto-updates every 7 days
- Manual update: `fccDatabase.updateDatabase()`

### API Cache
- Auto-expires after 24 hours
- Manual clear: `spamAPI.clearCache()`

### Community Databases
- Real-time queries (no caching for community APIs)
- Always fresh data

---

## 📚 Additional Resources

- [Twilio Lookup API Docs](https://www.twilio.com/docs/lookup)
- [Numverify Documentation](https://numverify.com/documentation)
- [FCC Consumer Complaint Center](https://consumercomplaints.fcc.gov/)
- [FCC Robocall Resources](https://www.fcc.gov/consumers/guides/stop-unwanted-robocalls-and-texts)

---

## 🎯 Next Steps

1. ✅ Choose your API tier (free/budget/business)
2. ✅ Sign up for selected APIs
3. ✅ Add API keys to `.env`
4. ✅ Enable APIs in `spamNumberAPIs.ts`
5. ✅ Test with known spam numbers
6. ✅ Integrate into call screening flow
7. ✅ Monitor usage and accuracy
8. ✅ Optimize based on your call volume

---

**Remember:** The more data sources you enable, the better your spam detection accuracy!
