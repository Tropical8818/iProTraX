
#!/bin/bash
set -e

echo "🚀 Starting Deployment Process..."

# 1. Safely Pull latest code
echo "📥 Checking for local changes..."
STASH_RESULT=$(git stash 2>/dev/null)
echo "$STASH_RESULT"

echo "📥 Pulling latest code from git..."
git pull origin main

if [[ "$STASH_RESULT" != "No local changes to save" ]]; then
    echo "📤 Restoring local config changes..."
    git stash pop || echo "⚠️  Warning: Conflict detected during configuration restore. Keeping remote changes for conflicting files. Review data/config.json if needed."
fi

# 2. Rebuild and Restart containers
echo "🔄 Rebuilding and restarting containers..."
# This uses the configuration from docker-compose.yml
docker-compose down
docker-compose up -d --build

# 3. Cleanup unused images
echo "🧹 Cleaning up unused Docker images..."
docker image prune -f

echo "✅ Deployment complete!"
echo "   - App running at: http://localhost:3001"
echo "   - Timezone: Asia/Shanghai"
echo ""
echo "📜 View logs with: docker-compose logs -f"
