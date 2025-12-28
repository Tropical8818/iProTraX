import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';

export async function POST(request: Request) {
    try {
        const { username, password, employeeId } = await request.json();

        if (!username || !password) {
            return NextResponse.json(
                { success: false, error: 'Username and password required' },
                { status: 400 }
            );
        }

        // Check if user exists
        const existing = await prisma.user.findUnique({
            where: { username }
        });

        if (existing) {
            return NextResponse.json(
                { success: false, error: 'Username already exists' },
                { status: 409 }
            );
        }

        // Check if Employee ID exists
        if (employeeId) {
            const existingEmp = await prisma.user.findUnique({
                where: { employeeId }
            });
            if (existingEmp) {
                return NextResponse.json(
                    { success: false, error: 'Employee ID already exists' },
                    { status: 409 }
                );
            }
        }

        // Create new user (pending approval)
        const passwordHash = await bcrypt.hash(password, 10);

        await prisma.user.create({
            data: {
                username,
                passwordHash,
                employeeId: employeeId || null,
                role: 'user', // Default role
                status: 'pending' // Requires approval
            }
        });

        return NextResponse.json({
            success: true,
            message: 'Registration successful. Account pending approval.'
        });

    } catch (error) {
        console.error('Registration error:', error);
        return NextResponse.json(
            { success: false, error: 'Registration failed' },
            { status: 500 }
        );
    }
}
