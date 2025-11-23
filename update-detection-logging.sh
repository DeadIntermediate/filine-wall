#!/bin/bash
# Script to update all detection services with proper logging and error handling

cd "$(dirname "$0")"

# List of service files to update
services=(
  "server/services/stirShakenVerification.ts"
  "server/services/acousticEnvironmentAnalysis.ts"
  "server/services/behavioralBiometrics.ts"
  "server/services/voipIPReputationChecker.ts"
  "server/services/callMetadataAnalyzer.ts"
  "server/services/sentimentAnalyzer.ts"
  "server/services/advancedDetectionCoordinator.ts"
)

echo "🔧 Updating detection services with proper logging..."

for service in "${services[@]}"; do
  if [ -f "$service" ]; then
    echo "  📝 Updating $service..."
    
    # Add logger import if not present
    if ! grep -q "import { logger } from '../utils/logger';" "$service"; then
      # Find the last import statement and add logger import after it
      sed -i "/^import/a import { logger } from '../utils/logger';" "$service" | head -1
    fi
    
    # Replace console.error with logger.error
    sed -i "s/console\.error(\(.*\)error);/logger.error(\1error as Error, 'DetectionService');/g" "$service"
    
    # Replace console.log with logger.info
    sed -i "s/console\.log(/logger.info(/g" "$service"
    
    # Replace console.warn with logger.warn
    sed -i "s/console\.warn(/logger.warn(/g" "$service"
    
    echo "  ✅ Updated $service"
  else
    echo "  ⚠️  File not found: $service"
  fi
done

echo ""
echo "✅ All detection services updated!"
echo ""
echo "📋 Next steps:"
echo "  1. Review the changes in each file"
echo "  2. Test the services with: npm run dev"
echo "  3. Check logs are properly formatted"
