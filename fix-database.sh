#!/bin/bash
# Quick fix for database schema after enterprise upgrade

set -e

echo "🔧 Fixing Database Schema..."
echo ""

# 1. Backup current database
if [ -f "data/db/prod.db" ]; then
    echo "📦 Backing up production database..."
    cp data/db/prod.db data/db/prod.db.backup.$(date +%Y%m%d_%H%M%S)
    echo "   ✅ Backup created"
elif [ -f "dev.db" ]; then
    echo "📦 Backing up development database..."
    cp dev.db dev.db.backup.$(date +%Y%m%d_%H%M%S)
    echo "   ✅ Backup created"
else
    echo "⚠️  No database found, will create new one"
fi

echo ""

# 2. Update database schema
echo "🔄 Updating database schema..."
npx prisma db push --accept-data-loss
echo "   ✅ Schema updated"

echo ""

# 3. Run backfill script
echo "📊 Backfilling status and priority data..."
npx tsx scripts/backfill-orders.ts
echo "   ✅ Data backfilled"

echo ""
echo "✅ Database fix complete!"
echo ""
echo "Next steps:"
echo "  - Restart your application: npm run dev"
echo "  - Or restart Docker: docker-compose restart"
echo ""
