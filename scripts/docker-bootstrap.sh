#!/bin/sh
set -e

echo "🚀 iProTraX Docker Bootstrap"
echo "================================"

# Wait a moment for any file system operations to settle
sleep 1

# Ensure Prisma directory exists
if [ ! -d "/app/prisma" ]; then
    echo "❌ Error: Prisma directory not found"
    exit 1
fi

# Database schema is pre-synced during Docker build (prisma db push)
# The mounted volume will use existing database if present, or the pre-created one
echo "📦 Checking database schema..."

# Ensure schema is synced (handles both new and existing databases)
echo "🗄️  Synchronizing database schema..."
npx prisma db push --accept-data-loss --skip-generate

# Check if we need to seed the default admin
echo "🔍 Checking for default admin user..."
node -e "
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

async function checkAndSeed() {
    const prisma = new PrismaClient();
    try {
        // SIMPLIFICATION: SuperAdmin identity is FIXED to ensure permissions work.
        // User can only configure the password via ADMIN_PASSWORD env var.
        const adminPassword = process.env.ADMIN_PASSWORD || 'superadmin123';
        
        const username = 'superadmin';
        const employeeId = 'SUPER001';

        const existingUser = await prisma.user.findUnique({ where: { username } });
        
        if (!existingUser) {
            console.log('');
            console.log('╔══════════════════════════════════════════════════════════╗');
            console.log('║           🔐 SUPERADMIN ACCOUNT CREATED                  ║');
            console.log('╠══════════════════════════════════════════════════════════╣');
            console.log('║  Login ID (Employee ID):  SUPER001                       ║');
            console.log('║  Password:                ' + adminPassword.padEnd(31) + '║');
            console.log('╠══════════════════════════════════════════════════════════╣');
            console.log('║  ⚠️  IMPORTANT: Change password after first login!       ║');
            console.log('╚══════════════════════════════════════════════════════════╝');
            console.log('');
            
            const hash = await bcrypt.hash(adminPassword, 10);
            await prisma.user.create({
                data: {
                    username,
                    passwordHash: hash,
                    employeeId,
                    role: 'admin',
                    status: 'approved'
                }
            });
        } else {
            console.log('✅ SuperAdmin user already exists.');
        }
    } finally {
        await prisma.\$disconnect();
    }
}

checkAndSeed().catch(console.error);
"

echo "✅ Database ready!"
echo "🌐 Starting iProTraX..."
echo ""

# Start the file watcher in the background
echo "👀 Starting file watcher..."
npm run watcher &

# Start the Next.js server
exec node server.js
