import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

export async function GET() {
    const session = await getSession();
    if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        // Return all approved non-kiosk users so any user can @mention supervisors, admins, operators, or everyone
        const users = await prisma.user.findMany({
            where: {
                status: 'approved',
                role: { not: 'kiosk' }
            },
            select: {
                id: true,
                username: true,
                role: true
            },
            orderBy: {
                username: 'asc'
            }
        });

        return NextResponse.json({ supervisors: users });
    } catch (error) {
        console.error('Failed to fetch supervisors:', error);
        return NextResponse.json({ error: 'Failed to fetch supervisors' }, { status: 500 });
    }
}
