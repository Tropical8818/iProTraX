
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
    console.log('--- Diagnosis Start ---');
    console.log('NODE_ENV:', process.env.NODE_ENV);

    // 1. Check Admin
    const admin = await prisma.user.findUnique({ where: { employeeId: 'admin' } });
    console.log('Current Admin User:', admin ? 'Found' : 'Not Found');

    if (admin) {
        console.log('Resetting Admin Password to "dhe-admin"...');
        const hash = await bcrypt.hash('dhe-admin', 10);
        await prisma.user.update({
            where: { employeeId: 'admin' },
            data: { passwordHash: hash }
        });
        console.log('✅ Admin password reset successful.');
    } else {
        console.log('Creating Admin User...');
        const hash = await bcrypt.hash('dhe-admin', 10);
        await prisma.user.create({
            data: {
                username: 'Admin',
                employeeId: 'admin',
                role: 'admin',
                passwordHash: hash,
                status: 'approved'
            }
        });
        console.log('✅ Admin user created.');
    }

    // 2. Check SUPER001
    const superUser = await prisma.user.findUnique({ where: { employeeId: 'SUPER001' } });
    console.log('SUPER001 User:', superUser ? 'Found' : 'Not Found');
    if (superUser) {
        console.log('SUPER001 Role:', superUser.role);
    }

    console.log('--- Diagnosis End ---');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
