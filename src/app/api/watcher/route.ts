import { NextResponse } from 'next/server';
import { spawn, ChildProcess } from 'child_process';
import path from 'path';

import { getSession } from '@/lib/auth';

// Global watcher process reference
let watcherProcess: ChildProcess | null = null;

export async function GET() {
    const session = await getSession();
    if (!session || session.role !== 'admin') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const isRunning = watcherProcess !== null && !watcherProcess.killed;
    return NextResponse.json({
        running: isRunning,
        pid: watcherProcess?.pid
    });
}

export async function POST() {
    const session = await getSession();
    if (!session || session.role !== 'admin') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if already running
    if (watcherProcess && !watcherProcess.killed) {
        return NextResponse.json({
            success: false,
            error: 'Watcher is already running',
            pid: watcherProcess.pid
        }, { status: 400 });
    }

    try {
        // Start watcher process
        const scriptPath = path.join(process.cwd(), 'scripts', 'watcher.ts');
        console.log(`[Watcher API] Starting watcher script: ${scriptPath}`);

        watcherProcess = spawn('npx', ['tsx', scriptPath], {
            detached: false,
            stdio: 'pipe',
            env: { ...process.env, NODE_ENV: 'development' }
        });

        const pid = watcherProcess.pid;
        console.log(`[Watcher API] Spawned process with PID: ${pid}`);

        // Log output for debugging
        watcherProcess.stdout?.on('data', (data: any) => {
            console.log(`[Watcher] ${data.toString().trim()}`);
        });

        watcherProcess.stderr?.on('data', (data: any) => {
            console.error(`[Watcher Error] ${data.toString().trim()}`);
        });

        watcherProcess.on('exit', (code: any) => {
            console.log(`[Watcher API] Process exited with code ${code}`);
            watcherProcess = null;
        });

        watcherProcess.on('error', (err: any) => {
            console.error(`[Watcher API] Failed to spawn process:`, err);
        });

        return NextResponse.json({
            success: true,
            message: 'File watcher started successfully',
            pid
        });
    } catch (error) {
        console.error('Failed to start watcher:', error);
        return NextResponse.json({
            success: false,
            error: 'Failed to start file watcher'
        }, { status: 500 });
    }
}

export async function DELETE() {
    const session = await getSession();
    if (!session || session.role !== 'admin') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!watcherProcess || watcherProcess.killed) {
        return NextResponse.json({
            success: false,
            error: 'Watcher is not running'
        }, { status: 400 });
    }

    try {
        // Kill the watcher process
        watcherProcess.kill('SIGTERM');

        // Wait a bit and force kill if needed
        setTimeout(() => {
            if (watcherProcess && !watcherProcess.killed) {
                watcherProcess.kill('SIGKILL');
            }
        }, 3000);

        watcherProcess = null;

        return NextResponse.json({
            success: true,
            message: 'File watcher stopped successfully'
        });
    } catch (error) {
        console.error('Failed to stop watcher:', error);
        return NextResponse.json({
            success: false,
            error: 'Failed to stop file watcher'
        }, { status: 500 });
    }
}
