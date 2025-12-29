import { NextResponse } from 'next/server';
import { spawn, ChildProcess } from 'child_process';
import path from 'path';

// Global watcher process reference
let watcherProcess: ChildProcess | null = null;

export async function GET() {
    const isRunning = watcherProcess !== null && !watcherProcess.killed;
    return NextResponse.json({
        running: isRunning,
        pid: watcherProcess?.pid
    });
}

export async function POST() {
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

        watcherProcess = spawn('npx', ['tsx', scriptPath], {
            detached: false,
            stdio: 'pipe',
            env: { ...process.env, NODE_ENV: 'development' }
        });

        const pid = watcherProcess.pid;

        // Log output for debugging
        watcherProcess.stdout?.on('data', (data) => {
            console.log(`[Watcher] ${data.toString()}`);
        });

        watcherProcess.stderr?.on('data', (data) => {
            console.error(`[Watcher Error] ${data.toString()}`);
        });

        watcherProcess.on('exit', (code) => {
            console.log(`[Watcher] Process exited with code ${code}`);
            watcherProcess = null;
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
