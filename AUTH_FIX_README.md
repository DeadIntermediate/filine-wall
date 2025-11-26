# Authentication Fix - Quick Reference

## Problem
```
2025-11-25T22:48:19.610Z INFO  [HTTP] GET / 401 - 1ms
2:48:19 PM [express] GET /api/admin/risk-score 401 in 4ms :: {"message":"No token provided"}
```

## Solution
FiLine Wall now supports **optional authentication** for local/home deployments.

## How It Works

### `.env` Setting
```bash
# For local/home use (no login required)
REQUIRE_AUTH=false   # ← Default

# For public servers (login required)
REQUIRE_AUTH=true
```

### Behavior

| REQUIRE_AUTH | Admin Routes | User Routes | Use Case |
|--------------|--------------|-------------|----------|
| `false` | ✅ Open | ✅ Open | Local/Home (single user) |
| `true` | 🔒 Protected | 🔒 Protected | Public server (multi-user) |

## Apply the Fix

### Method 1: Restart with tmux manager
```bash
./manage-filine.sh restart
```

### Method 2: Manual restart
```bash
# Stop server
pkill -f "tsx.*server"

# Start server
npm run dev
```

### Method 3: Use start script
```bash
./start-filine.sh
```

## Verify It's Working

After restart, check the console for:
```
🔓 Running in open access mode (local deployment)
```

Then test the endpoint:
```bash
curl http://localhost:5000/api/admin/risk-score
```

Should return data instead of 401 error.

## When to Enable Authentication

Enable `REQUIRE_AUTH=true` when:
- ✅ Deploying on a public server
- ✅ Multiple users will access the system
- ✅ Exposed to the internet
- ✅ Need user management and permissions

Keep `REQUIRE_AUTH=false` when:
- ✅ Running on local Raspberry Pi at home
- ✅ Single user (you) accessing the system
- ✅ Behind your home firewall
- ✅ Don't want login hassle

## Security Note

For home/local deployments:
- Your Raspberry Pi is already protected by your home network firewall
- Only devices on your local network can access FiLine Wall
- No internet exposure = no need for authentication overhead

For public deployments:
- Always set `REQUIRE_AUTH=true`
- Use strong JWT_SECRET and passwords
- Consider HTTPS/SSL encryption
- Implement rate limiting (already included)

## Troubleshooting

### Still getting 401 errors?

1. **Check .env file:**
   ```bash
   grep REQUIRE_AUTH .env
   ```
   Should show: `REQUIRE_AUTH=false`

2. **Restart server completely:**
   ```bash
   pkill -f node
   pkill -f tsx
   npm run dev
   ```

3. **Check server logs:**
   ```bash
   tail -f logs/server.log
   ```
   Look for: `🔓 Running in open access mode`

### Want to add authentication later?

Just change `.env`:
```bash
REQUIRE_AUTH=true
```

Then restart. Login page will appear automatically.

## What Changed

- ✅ `server/routes.ts` - Conditional authentication middleware
- ✅ `.env` - Added `REQUIRE_AUTH=false` setting
- ✅ `fix-env.sh` - Templates include REQUIRE_AUTH

No database changes. No code compilation needed. Just restart!
