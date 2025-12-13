# NPM Install Fix for React Dependency Conflict

## Issue
When running `npm install` on Raspberry Pi, you may encounter:

```
npm ERR! ERESOLVE could not resolve
npm ERR! Conflicting peer dependency: react@16.14.0
npm ERR! peer react@"^16.8.0" from react-simple-maps@1.0.0
```

## Root Cause
The `react-simple-maps` package has outdated peer dependency metadata that incorrectly reports it requires React 16, but version 3.0.0 actually works perfectly with React 18.

## Solution

### Option 1: Use --legacy-peer-deps (Recommended)
```bash
npm install --legacy-peer-deps
```

### Option 2: Use --force
```bash
npm install --force
```

### Option 3: Clean Install
```bash
# Remove old files
rm -rf node_modules package-lock.json

# Clear cache
npm cache clean --force

# Install with legacy peer deps
npm install --legacy-peer-deps
```

## Why This Works
- `--legacy-peer-deps` tells npm to ignore peer dependency conflicts and use npm 6 behavior
- Version 3.0.0 of react-simple-maps is fully compatible with React 18
- The package just hasn't updated its peer dependency requirements

## After Installation
Everything will work normally. The conflict is only in the metadata, not in actual runtime compatibility.

## Permanent Fix
This is already documented in:
- `quick-setup.sh` - Now includes the --legacy-peer-deps flag
- `TROUBLESHOOTING_RASPBERRY_PI.md` - Updated with this solution

## For Future Installs
Always use:
```bash
npm install --legacy-peer-deps
```

Or add to `.npmrc`:
```bash
echo "legacy-peer-deps=true" >> .npmrc
```
