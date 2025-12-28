import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
    const username = 'superadmin';
    const password = 'superuser2025'; // Default strong password
    const employeeId = 'SUPER001';

    const existing = await prisma.user.findUnique({
        where: { username }
    });

    if (existing) {
        console.log(`User ${username} already exists.`);
        return;
    }

    const passwordHash = await bcrypt.hash(password, 10);

    await prisma.user.create({
        data: {
            username,
            employeeId,
            passwordHash,
            role: 'admin',
            status: 'approved'
        }
    });

    console.log('✅ Super Admin account created successfully!');
    console.log(`👤 Username: ${username}`);
    console.log(`🔑 Password: ${password}`);
    console.log(`🆔 Employee ID: ${employeeId}`);
    console.log('\n⚠️  Please log in and change your password immediately!');
}

main()
    .catch((e) => {
        console.error('Failed to create superadmin:', e);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());
