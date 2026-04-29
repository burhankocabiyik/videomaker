import { NextResponse } from 'next/server';
import { spawn } from 'node:child_process';
import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fal } from '@fal-ai/client';
import { analyzeReferenceFrames } from '@/lib/providers/fal-vision.js';

export const runtime = 'nodejs';
export const maxDuration = 240;

function configureFal() {
    const key = process.env.FAL_KEY;
    if (!key) throw new Error('FAL_KEY not configured.');
    fal.config({ credentials: key });
}

async function streamToBuffer(req) {
    const reader = req.body.getReader();
    const chunks = [];
    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
    }
    return Buffer.concat(chunks.map((c) => Buffer.from(c)));
}

async function runFfmpeg(args) {
    return new Promise((resolve, reject) => {
        const proc = spawn('ffmpeg', args, { stdio: ['ignore', 'ignore', 'pipe'] });
        let stderr = '';
        proc.stderr.on('data', (d) => { stderr += d.toString(); });
        proc.on('error', reject);
        proc.on('close', (code) => code === 0 ? resolve() : reject(new Error('ffmpeg exit ' + code + ': ' + stderr.slice(-400))));
    });
}

export async function POST(request) {
    let workdir;
    try {
        configureFal();
        const ct = request.headers.get('content-type') || '';
        let videoBuffer;
        let videoUrl = null;
        let hint = '';
        let frameCount = 6;

        if (ct.includes('application/json')) {
            const body = await request.json();
            videoUrl = body.videoUrl;
            hint = body.hint || '';
            frameCount = Math.max(3, Math.min(10, Number(body.frameCount) || 6));
            if (!videoUrl) {
                return NextResponse.json({ error: 'videoUrl is required when posting JSON' }, { status: 400 });
            }
            const fetched = await fetch(videoUrl);
            if (!fetched.ok) throw new Error('failed to fetch reference video: ' + fetched.status);
            videoBuffer = Buffer.from(await fetched.arrayBuffer());
        } else if (ct.startsWith('video/') || ct.includes('octet-stream')) {
            videoBuffer = await streamToBuffer(request);
            hint = request.headers.get('x-hint') || '';
        } else {
            return NextResponse.json({ error: 'send JSON {videoUrl} or raw video bytes' }, { status: 400 });
        }

        workdir = await mkdtemp(path.join(os.tmpdir(), 'goat-analyze-'));
        const inputPath = path.join(workdir, 'input.mp4');
        await writeFile(inputPath, videoBuffer);

        // Sample evenly across the duration. fps filter keeps things simple.
        const framesDir = path.join(workdir, 'frames');
        await runFfmpeg(['-y', '-i', inputPath, '-vf', `fps=1/2,scale=540:-1`, '-frames:v', String(frameCount), path.join(framesDir, 'f_%02d.jpg')]).catch(async () => {
            // Some videos need the frames dir to exist first.
            const { mkdir } = await import('node:fs/promises');
            await mkdir(framesDir, { recursive: true });
            await runFfmpeg(['-y', '-i', inputPath, '-vf', `fps=1/2,scale=540:-1`, '-frames:v', String(frameCount), path.join(framesDir, 'f_%02d.jpg')]);
        });

        const files = (await readdir(framesDir)).filter((f) => f.endsWith('.jpg')).sort().slice(0, frameCount);
        if (files.length === 0) throw new Error('no frames extracted');

        // Upload each frame to fal storage so the vision model can see it.
        const frameUrls = [];
        for (const f of files) {
            const buf = await readFile(path.join(framesDir, f));
            const url = await fal.storage.upload(new File([buf], f, { type: 'image/jpeg' }));
            frameUrls.push(url);
        }

        const analysis = await analyzeReferenceFrames({ frames: frameUrls, hint });

        return NextResponse.json({ frames: frameUrls, analysis });
    } catch (error) {
        console.error('[api/podcast/analyze]', error);
        return NextResponse.json({ error: error.message || 'analyze failed' }, { status: 500 });
    } finally {
        if (workdir) await rm(workdir, { recursive: true, force: true }).catch(() => {});
    }
}
