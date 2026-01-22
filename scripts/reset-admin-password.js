
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function reset() {
    const password = process.argv[2] || 'admin123';
    // Allow passing username as 2nd arg: node script.js <pass> <user>
    const targetUser = process.argv[3] || 'admin';

    console.log(`Resetting password for user: ${targetUser} to: ${password}`);

    const hash = await bcrypt.hash(password, 10);

    // Special handling for SuperAdmin
    let employeeIdUpdate = undefined;
    if (targetUser === 'superadmin') {
        employeeIdUpdate = 'SUPER001';
        console.log('⚡️ Detected superadmin: Enforcing ID = SUPER001');
    }

    try {
        // Try to find first
        const user = await prisma.user.findUnique({ where: { username: targetUser } });

        if (user) {
            const updateData = { passwordHash: hash };
            if (employeeIdUpdate) updateData.employeeId = employeeIdUpdate;
            // Ensure role is admin
            if (user.role !== 'admin') updateData.role = 'admin';

            await prisma.user.update({
                where: { username: targetUser },
                data: updateData
            });
            console.log('✅ Account repaired & password reset successful!');
        } else {
            // Create if not found
            console.log(`User "${targetUser}" not found. Creating new admin user...`);
            await prisma.user.create({
                data: {
                    username: targetUser,
                    passwordHash: hash,
                    employeeId: employeeIdUpdate || targetUser,
                    role: 'admin',
                    status: 'approved'
                }
            });
            console.log(`✅ Admin user created! (ID: ${employeeIdUpdate || targetUser})`);
        }
    } catch (e) {
        console.error('❌ Error resetting password:', e);
    } finally {
        await prisma.$disconnect();
    }
}

reset();
