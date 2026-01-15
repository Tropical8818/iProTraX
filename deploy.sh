#!/bin/bash
set -e

echo "🚀 Starting Deployment Process..."

# 1. Handle local changes to data/config.json
echo "📥 Pulling latest code..."

# Check if there are uncommitted changes
if [[ -n $(git status -s) ]]; then
    echo "⚠️  Local changes detected. Preserving configuration..."
    # Backup config if it exists and has changes
    if [[ -f data/config.json ]]; then
        cp data/config.json data/config.json.backup
        echo "   → Backed up data/config.json"
    fi
    
    # Try to reset to remote
    if git fetch origin main 2>/dev/null; then
        git reset --hard origin/main
    else
        echo "   ⚠️  Could not fetch from remote (network issue). Using local code."
    fi
    
    # Restore config backup if exists
    if [[ -f data/config.json.backup ]]; then
        mv data/config.json.backup data/config.json
        echo "   → Restored data/config.json"
    fi
else
    # No local changes, try to pull normally
    if ! git pull origin main 2>/dev/null; then
        echo "   ⚠️  Could not pull from remote (network issue). Using local code."
    fi
fi

# 2. Rebuild and Restart containers
echo "🔄 Rebuilding and restarting containers..."
docker-compose down
docker-compose up -d --build

# 3. Cleanup unused images
echo "🧹 Cleaning up unused Docker images..."
docker image prune -f

# 4. Verify deployment
echo "🔍 Verifying deployment..."
    if ! docker ps | grep -q "iprotrax"; then
        echo "❌ Deployment failed! 'iprotrax' container not found running."
        exit 1
    fi
    
echo ""
echo "✅ Deployment complete!"
echo "   - App running at: http://localhost:3001"
echo "   - Timezone: Asia/Singapore"
echo ""
echo "📜 View logs with: docker-compose logs -f"
