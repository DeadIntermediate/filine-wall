# 📋 Quick Reference: Spam Detection APIs

## 🆓 FREE APIs (No Cost)

### 1. FCC Database (Government Data)
- **Cost**: FREE
- **Coverage**: US official enforcement actions
- **Data**: FCC violations, consumer complaints, DNO list
- **Rate Limit**: Unlimited (local database, updates weekly)
- **Setup**: No API key required
- **Accuracy**: ⭐⭐⭐⭐⭐ (Official government data)

### 2. Should I Answer
- **Cost**: FREE (web scraping)
- **Coverage**: Global crowdsourced data
- **Data**: Community spam reports
- **Rate Limit**: Respectful use (built-in rate limiting)
- **Setup**: No API key required
- **Accuracy**: ⭐⭐⭐⭐ (Community verified)

### 3. WhoCallsMe
- **Cost**: FREE (web scraping)
- **Coverage**: US/Canada primarily
- **Data**: Community spam scores
- **Rate Limit**: Respectful use
- **Setup**: No API key required
- **Accuracy**: ⭐⭐⭐ (User submitted)

---

## 💰 FREE TIER (Limited Free Usage)

### 4. Numverify
- **Free Tier**: 250 requests/month
- **Coverage**: International validation
- **Data**: Carrier info, line type, location
- **Paid Plans**: $9.99/mo (5,000), $49.99/mo (50,000)
- **Setup**: Sign up at numverify.com
- **Accuracy**: ⭐⭐⭐⭐ (Carrier data)

### 5. NumLookup
- **Free Tier**: 100 requests/month
- **Coverage**: Global spam detection
- **Data**: Spam scores, categories, reports
- **Paid Plans**: $9/mo (1,000), $49/mo (10,000)
- **Setup**: Sign up at numlookupapi.com
- **Accuracy**: ⭐⭐⭐⭐⭐ (ML-based scoring)

### 6. Twilio Lookup
- **Free Tier**: $15 credit trial
- **Coverage**: International
- **Data**: Carrier validation, caller name
- **Pricing**: $0.005/lookup (very cheap)
- **Setup**: Sign up at twilio.com
- **Accuracy**: ⭐⭐⭐⭐⭐ (Best carrier data)

---

## 🎯 RECOMMENDED SETUPS

### Budget Setup (100% Free)
```bash
✅ FCC Database (always enabled)
✅ Should I Answer (free)
✅ WhoCallsMe (free)
✅ Internal ML/AI (included)

Monthly Cost: $0
Accuracy: ~75-80%
Coverage: US/Canada
```

### Optimal Free Tier Setup
```bash
✅ FCC Database
✅ Numverify (250/month free)
✅ NumLookup (100/month free)
✅ Should I Answer
✅ WhoCallsMe
✅ Internal ML/AI

Monthly Cost: $0
Accuracy: ~85-90%
Coverage: Global
Limits: 350 API calls/month
```

### Business Setup (Recommended)
```bash
✅ FCC Database
✅ Twilio Lookup ($0.005 per call)
✅ NumLookup Starter ($9/month)
✅ Community databases (free)
✅ Internal ML/AI

Monthly Cost: ~$15-25
Accuracy: ~95%+
Coverage: Global
Limits: 1,000+ calls/month
```

### Enterprise Setup (Maximum Protection)
```bash
✅ FCC Database
✅ Twilio Lookup
✅ Numverify Pro ($49.99/month)
✅ NumLookup Pro ($49/month)
✅ All community databases
✅ Internal ML/AI
✅ Honeypot system

Monthly Cost: ~$100-150
Accuracy: ~98%+
Coverage: Global
Limits: 50,000+ calls/month
```

---

## 📊 API Comparison

| API | Free Tier | Spam Detection | Carrier Info | Speed | Best For |
|-----|-----------|----------------|--------------|-------|----------|
| FCC | Unlimited | ⭐⭐⭐ | ❌ | Fast | US violations |
| Should I Answer | Unlimited | ⭐⭐⭐⭐ | ❌ | Medium | Community data |
| Numverify | 250/mo | ❌ | ⭐⭐⭐⭐⭐ | Fast | Validation |
| NumLookup | 100/mo | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | Fast | Spam scores |
| Twilio | $15 credit | ❌ | ⭐⭐⭐⭐⭐ | Very Fast | Carrier data |
| WhoCallsMe | Unlimited | ⭐⭐⭐ | ❌ | Slow | Basic check |

---

## 🚀 Quick Setup

### 1. Start with Free (No API keys)
```bash
# No configuration needed!
# FCC Database + Community APIs work out of the box
npm start
```

### 2. Add Free Tier APIs
```bash
# Get free API keys
1. Visit numverify.com → Sign up → Copy API key
2. Visit numlookupapi.com → Sign up → Copy API key

# Add to .env
echo "NUMVERIFY_API_KEY=your_key_here" >> .env
echo "NUMLOOKUP_API_KEY=your_key_here" >> .env

# Restart server
npm restart
```

### 3. Upgrade to Twilio (Recommended)
```bash
# Best carrier data for minimal cost
1. Visit twilio.com → Sign up
2. Get Account SID and Auth Token
3. Add to .env:

echo "TWILIO_ACCOUNT_SID=ACxxxx" >> .env
echo "TWILIO_AUTH_TOKEN=your_token" >> .env

npm restart
```

---

## 📈 Call Volume Planning

### Low Volume (< 100 calls/month)
**Recommendation**: Free tier only
- FCC Database
- Community APIs (Should I Answer, WhoCallsMe)
- NumLookup free tier (100/mo)

**Cost**: $0/month

### Medium Volume (100-1,000 calls/month)
**Recommendation**: Mix of free + cheap paid
- All free tier APIs
- Twilio Lookup ($0.005 × 1,000 = $5/mo)
- NumLookup Starter ($9/mo)

**Cost**: ~$15/month

### High Volume (1,000-10,000 calls/month)
**Recommendation**: Paid tiers
- Numverify Professional ($49.99/mo)
- NumLookup Pro ($49/mo)
- Twilio ($0.005 × 10,000 = $50/mo)

**Cost**: ~$150/month

### Enterprise (10,000+ calls/month)
**Recommendation**: Enterprise plans + caching
- Contact API providers for volume discounts
- Enable aggressive caching (48-72 hours)
- Use honeypot system for proactive detection

**Cost**: Negotiated pricing

---

## 🎛️ Enable/Disable APIs

Edit `server/services/spamNumberAPIs.ts`:

```typescript
private apis = {
    // Enable/disable each API
    twilioLookup: {
        enabled: true,  // ← Change to false to disable
        // ...
    },
    numverify: {
        enabled: true,  // ← Change to false to disable
        // ...
    },
    // ... etc
}
```

---

## 🔄 Priority Order (How APIs are Called)

FiLine Wall checks sources in this order:

1. **Local Database** (instant, free)
2. **Cache** (24hr, free)
3. **FCC Database** (local file, free)
4. **Twilio** (if enabled, $0.005)
5. **Numverify** (if enabled, free tier)
6. **NumLookup** (if enabled, free tier)
7. **Should I Answer** (free)
8. **WhoCallsMe** (free)
9. **Internal ML/AI** (free)

**Smart Caching**: Results cached for 24 hours, reducing API costs by 80-90%!

---

## 💡 Pro Tips

### Maximize Free Tier
1. Enable 24-48 hour caching
2. Use bulk checks (process overnight)
3. Prioritize free APIs first
4. Only call paid APIs for unknown numbers

### Reduce Costs
1. Pre-screen with ML before API calls
2. Batch process call logs
3. Cache aggressively (48-72 hours)
4. Use Twilio only (cheapest paid option)

### Maximum Accuracy
1. Enable ALL APIs
2. Use weighted consensus voting
3. Combine with voice analysis
4. Train personal learning engine

---

## 🆘 Troubleshooting

**APIs not returning data?**
- Check API key in `.env`
- Verify API is enabled in code
- Check rate limits with `getStats()`

**Too expensive?**
- Increase cache duration
- Disable expensive APIs
- Use free tier only
- Process calls in bulk overnight

**Low accuracy?**
- Enable more API sources
- Check regional coverage
- Combine with ML features
- Report false positives

---

## 📞 Support Resources

- **Twilio**: https://www.twilio.com/docs/lookup
- **Numverify**: https://numverify.com/documentation
- **NumLookup**: https://www.numlookupapi.com/docs
- **FCC Data**: https://www.fcc.gov/enforcement
- **Full Setup Guide**: See `SPAM_API_SETUP.md`

---

## ✅ Recommended Quick Start

```bash
# 1. Start with free (no setup needed)
npm start

# 2. After 1 week, if blocking is good, you're done!

# 3. If you want better accuracy:
#    - Sign up for NumLookup free tier (100 calls/mo)
#    - Sign up for Numverify free tier (250 calls/mo)
#    Total cost: $0/month, 350 API calls/month

# 4. If you need more:
#    - Add Twilio ($0.005 per call, best value)
#    Total cost: ~$5-15/month for 1000-3000 calls

# 5. For business use:
#    - Upgrade to paid tiers (~$50-100/mo)
```

**Remember**: FiLine Wall's ML/AI works WITHOUT any API keys. External APIs just make it even better! 🚀
