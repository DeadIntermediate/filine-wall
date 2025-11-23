# Console Logging Guide

## 📊 What You'll See in the Console

Your FiLine Wall server now has comprehensive console logging that shows **all incoming and outgoing calls** in real-time!

---

## 🎨 Development Mode (Colorized Output)

When running in development mode, you'll see color-coded logs:

```bash
npm run dev
```

### Example Console Output:

```
2025-11-23T10:30:45.123Z INFO  [HTTP] POST /api/screen-call 200 - 45ms
2025-11-23T10:30:45.124Z INFO  [CallScreening] 📞 INCOMING CALL from +15551234567
2025-11-23T10:30:45.345Z WARN  [CallScreening] 🚫 BLOCKED - FCC spam database match: +15551234567
2025-11-23T10:30:45.346Z DEBUG [CallScreening] Call logged to database

2025-11-23T10:31:12.456Z INFO  [HTTP] POST /api/screen-call 200 - 89ms
2025-11-23T10:31:12.457Z INFO  [CallScreening] 📞 INCOMING CALL from +15559876543
2025-11-23T10:31:12.678Z INFO  [CallScreening] ✅ ALLOWED - All checks passed: +15559876543
2025-11-23T10:31:12.679Z DEBUG [CallScreening] Call logged to database

2025-11-23T10:32:00.123Z INFO  [HTTP] POST /api/screen-call 200 - 67ms
2025-11-23T10:32:00.124Z INFO  [CallScreening] 📞 INCOMING CALL from +15551111111
2025-11-23T10:32:00.345Z WARN  [CallScreening] 🚫 BLOCKED - Blacklisted: +15551111111
2025-11-23T10:32:00.346Z DEBUG [CallScreening] Call logged to database

2025-11-23T10:33:15.789Z INFO  [HTTP] POST /api/screen-call 200 - 120ms
2025-11-23T10:33:15.790Z INFO  [CallScreening] 📞 INCOMING CALL from +15552223333
2025-11-23T10:33:16.012Z INFO  [CallScreening] ⚠️  CHALLENGE - Verification required: +15552223333
2025-11-23T10:33:16.013Z DEBUG [CallScreening] Call logged to database
```

---

## 📋 Production Mode (JSON Structured Logs)

When running in production, logs are output as JSON for easy parsing by log aggregators:

```bash
NODE_ENV=production npm start
```

### Example Console Output:

```json
{"timestamp":"2025-11-23T10:30:45.123Z","level":"INFO","context":"HTTP","message":"POST /api/screen-call 200 - 45ms","metadata":{"method":"POST","path":"/api/screen-call","statusCode":200,"duration":45}}
{"timestamp":"2025-11-23T10:30:45.124Z","level":"INFO","context":"CallScreening","message":"📞 INCOMING CALL from +15551234567","metadata":{"phoneNumber":"+15551234567","hasAudio":false,"timestamp":"2025-11-23T10:30:45.124Z"}}
{"timestamp":"2025-11-23T10:30:45.345Z","level":"WARN","context":"CallScreening","message":"🚫 BLOCKED - FCC spam database match: +15551234567","metadata":{"phoneNumber":"+15551234567","reason":"FCC spam database","risk":0.9}}
```

---

## 🎯 What Gets Logged

### 1. **Incoming Calls**
Every call that comes in shows:
- 📞 Icon for visibility
- Phone number
- Timestamp
- Whether audio data is included

```
📞 INCOMING CALL from +15551234567
```

### 2. **Call Decisions**

#### ✅ **ALLOWED** (Green in dev mode)
Call passed all screening checks:
```
✅ ALLOWED - All checks passed: +15559876543
```

#### 🚫 **BLOCKED** (Red/Yellow in dev mode)
Call was blocked with reason:
```
🚫 BLOCKED - FCC spam database match: +15551234567
🚫 BLOCKED - Blacklisted: +15551111111
🚫 BLOCKED - High spam probability: +15552224444
```

#### ⚠️ **CHALLENGE** (Yellow in dev mode)
Caller needs to complete verification:
```
⚠️ CHALLENGE - Verification required: +15552223333
```

### 3. **HTTP Requests**
All API requests show:
- Method (POST, GET, etc.)
- Path
- Status code
- Duration in milliseconds

```
POST /api/screen-call 200 - 45ms
GET /api/calls 200 - 12ms
```

### 4. **Errors**
Errors include full stack traces in development:
```
ERROR [CallScreening] Error in call screening
  Error: Network timeout
    at screenCall (server/services/callScreening.ts:123)
    ...
```

### 5. **Database Operations**
Debug level logs for database writes:
```
Call logged to database
```

---

## 🔍 Log Levels

Control what you see with the `LOG_LEVEL` environment variable:

### DEBUG (Most Verbose)
Shows everything including database operations:
```bash
LOG_LEVEL=debug npm run dev
```

### INFO (Default)
Shows important events (calls, decisions, requests):
```bash
LOG_LEVEL=info npm run dev
```

### WARN
Shows only warnings and errors (blocked calls):
```bash
LOG_LEVEL=warn npm run dev
```

### ERROR (Least Verbose)
Shows only errors:
```bash
LOG_LEVEL=error npm run dev
```

---

## 📊 Example Real-World Output

Here's what you'll see during active call screening:

```bash
$ LOG_LEVEL=info npm run dev

2025-11-23T14:25:10.123Z INFO  [Server] ✓ Server running on port 5000
2025-11-23T14:25:10.124Z INFO  [Server] ✓ AI Spam Detection: Active
2025-11-23T14:25:10.125Z INFO  [Server] Ready to accept connections

# First call - Blocked spam
2025-11-23T14:25:45.001Z INFO  [HTTP] POST /api/screen-call 200 - 67ms
2025-11-23T14:25:45.002Z INFO  [CallScreening] 📞 INCOMING CALL from +18775551234
2025-11-23T14:25:45.156Z WARN  [CallScreening] 🚫 BLOCKED - High spam probability: +18775551234

# Second call - Whitelisted contact
2025-11-23T14:26:12.345Z INFO  [HTTP] POST /api/screen-call 200 - 23ms
2025-11-23T14:26:12.346Z INFO  [CallScreening] 📞 INCOMING CALL from +12125551234
2025-11-23T14:26:12.389Z INFO  [CallScreening] ✅ ALLOWED - Whitelisted: +12125551234

# Third call - Needs verification
2025-11-23T14:27:33.678Z INFO  [HTTP] POST /api/screen-call 200 - 89ms
2025-11-23T14:27:33.679Z INFO  [CallScreening] 📞 INCOMING CALL from +13105551234
2025-11-23T14:27:33.834Z INFO  [CallScreening] ⚠️  CHALLENGE - Verification required: +13105551234

# Fourth call - Known scammer (blacklisted)
2025-11-23T14:28:56.123Z INFO  [HTTP] POST /api/screen-call 200 - 34ms
2025-11-23T14:28:56.124Z INFO  [CallScreening] 📞 INCOMING CALL from +18005551234
2025-11-23T14:28:56.178Z WARN  [CallScreening] 🚫 BLOCKED - Blacklisted: +18005551234

# User checking call history
2025-11-23T14:29:45.456Z INFO  [HTTP] GET /api/calls 200 - 15ms
```

---

## 🛠 How to Use

### Start Development Server with Logging
```bash
# Default (INFO level)
npm run dev

# Verbose (DEBUG level - shows everything)
LOG_LEVEL=debug npm run dev

# Quiet (WARN level - only blocked calls and errors)
LOG_LEVEL=warn npm run dev
```

### Start Production Server
```bash
NODE_ENV=production npm start
```

### Filter Logs in Terminal
```bash
# Show only incoming calls
npm run dev | grep "INCOMING CALL"

# Show only blocked calls
npm run dev | grep "BLOCKED"

# Show only allowed calls
npm run dev | grep "ALLOWED"

# Show only errors
npm run dev | grep "ERROR"
```

### Save Logs to File
```bash
# Save all logs
npm run dev > logs/server.log 2>&1

# Save only errors
npm run dev 2> logs/errors.log
```

---

## 🎨 Color Coding (Development Mode)

- **GRAY** - DEBUG messages and timestamps
- **BLUE** - INFO messages (normal operations)
- **YELLOW** - WARN messages (blocked calls, warnings)
- **RED** - ERROR messages (failures, exceptions)

---

## 📈 Monitoring Integration

Production JSON logs can be sent to:

### Elasticsearch/Kibana (ELK Stack)
```bash
npm start | filebeat -c filebeat.yml
```

### Splunk
```bash
npm start | splunk add monitor
```

### CloudWatch Logs (AWS)
```bash
npm start | aws logs put-log-events --log-group-name filine-wall
```

### Datadog
```bash
npm start | datadog-agent
```

---

## ✅ What You Now Have

- ✅ **Real-time call visibility** - See every call as it happens
- ✅ **Color-coded decisions** - Instantly identify blocked/allowed calls
- ✅ **Detailed metadata** - Phone numbers, risk scores, reasons
- ✅ **HTTP request logging** - Track API usage and performance
- ✅ **Error tracking** - Full stack traces for debugging
- ✅ **Production-ready** - JSON logs for aggregation
- ✅ **Flexible filtering** - Control verbosity with log levels

---

## 🚀 Quick Start

1. **Start the server:**
   ```bash
   npm run dev
   ```

2. **Watch the console** for incoming calls

3. **Test with a call:**
   ```bash
   curl -X POST http://localhost:5000/api/screen-call \
     -H "Content-Type: application/json" \
     -d '{"phoneNumber": "+15551234567"}'
   ```

4. **See the logs:**
   ```
   📞 INCOMING CALL from +15551234567
   ✅ ALLOWED - All checks passed: +15551234567
   ```

---

**You now have full visibility into your call screening system!** 🎉
