
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Start seeding 1000 orders...');

    // 1. Get the TEST product
    const product = await prisma.product.findFirst({
        where: { name: 'TEST' }
    });

    if (!product) {
        console.error('Error: Product "TEST" not found. Please create it first.');
        process.exit(1);
    }

    const productId = product.id;
    console.log(`Using Product: ${product.name} (${productId})`);

    // Parse config to know steps
    const config = JSON.parse(product.config);
    const steps = config.steps || ['STEP1', 'STEP2', 'STEP3', 'STEP4', 'STEP5'];

    const orders = [];
    const now = new Date();

    // 2. Generate 1000 orders
    for (let i = 0; i < 1000; i++) {
        const woSuffix = String(Math.floor(Math.random() * 1000000)).padStart(6, '0');
        const woId = `SIM-${woSuffix}`; // e.g., SIM-123456

        // Randomize status and progress
        const data: Record<string, string> = {};

        // Basic fields
        data['WO ID'] = woId;
        data['Priority'] = Math.random() > 0.8 ? 'High' : 'Normal';
        data['Description'] = `Simulated Order #${i + 1}`;

        // Random step progress
        const progress = Math.random();
        let currentStep = '';

        if (progress < 0.1) {
            // Just started
            data[steps[0]] = 'WIP';
        } else if (progress > 0.9) {
            // Completed
            steps.forEach((s: string) => data[s] = now.toISOString().split('T')[0]);
        } else {
            // Somewhere in between
            const stepIndex = Math.floor(progress * steps.length);
            for (let j = 0; j < steps.length; j++) {
                if (j < stepIndex) {
                    data[steps[j]] = now.toISOString().split('T')[0]; // Completed prev steps
                } else if (j === stepIndex) {
                    // Current step state
                    const stateRoll = Math.random();
                    if (stateRoll > 0.9) data[steps[j]] = 'QN';
                    else if (stateRoll > 0.8) data[steps[j]] = 'Hold';
                    else if (stateRoll > 0.5) data[steps[j]] = 'WIP';
                    else data[steps[j]] = 'P';
                } else {
                    data[steps[j]] = ''; // Future steps
                }
            }
        }

        orders.push({
            woId,
            productId,
            data: JSON.stringify(data),
            updatedAt: new Date(now.getTime() - Math.floor(Math.random() * 1000000000)) // Random updated time in last ~10 days
        });
    }

    // 3. Batch insert
    // SQLite might have limits on variables, so chunk it
    const chunkSize = 100;
    for (let i = 0; i < orders.length; i += chunkSize) {
        const chunk = orders.slice(i, i + chunkSize);
        await prisma.order.createMany({
            data: chunk
        });
        console.log(`Inserted ${Math.min(i + chunkSize, orders.length)} / 1000 orders`);
    }

    console.log('Seeding finished.');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
