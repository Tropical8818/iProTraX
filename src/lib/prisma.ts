import { PrismaClient } from '@prisma/client';
// Force reload for schema update

const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const prisma =
  (globalForPrisma.prisma ||
    new PrismaClient({
      log: ['query'],
    })) as any;

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
