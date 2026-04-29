/**
 * /api/podcast/render
 *
 * Takes the plan + the per-scene assets (image / video / audio) the client
 * has accumulated, downloads them, and uses ffmpeg to:
 *   1. Per scene: replace the muted video clip's audio with the ElevenLabs
 *      voice (or fall back to silent audio if no voice was generated).
 *   2. Concat every scene into one final.mp4.
 *
 * The merged file is written under /public/renders so it can be downloaded
 * straight from the dev server (and survives a refresh).
 *
 * Note: this only works on machines with ffmpeg installed (Mac/Linux dev
 * boxes already do via Homebrew). On Vercel serverless, ffmpeg isn't
 * available out of the box — that's a follow-up via Remotion Lambda.
 */

import { NextResponse } from 'next/server';
import { spawn } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rename, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';

export const runtime = 'nodejs';
export const maxDuration = 600;

function ffmpeg(args) {
    return new Promise((resolve, reject) => {
        const proc = spawn('ffmpeg', args, { stdio: ['ignore', 'ignore', 'pipe'] });
        let stderr = '';
        proc.stderr.on('data', (d) => { stderr += d.toString(); });
        proc.on('error', reject);
        proc.on('close', (code) => code === 0 ? resolve() : reject(new Error(`ffmpeg exited ${code}: ${stderr.slice(-400)}`)));
    });
}

async function download(url, filePath) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`download ${url} → ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    await writeFile(filePath, buf);
}

export async function POST(request) {
    let workdir;
    try {
        const body = await request.json();
        const plan = body.plan;
        const assets = body.assets || {};
        if (!plan?.scenes?.length) {
            return NextResponse.json({ error: 'plan with scenes is required' }, { status: 400 });
        }

        workdir = await mkdtemp(path.join(os.tmpdir(), 'goat-podcast-'));

        // Download every scene's video + audio.
        const scenePieces = [];
        for (const [idx, scene] of plan.scenes.entries()) {
            const a = assets[scene.id] || {};
            if (!a.videoUrl && !a.imageUrl) {
                throw new Error(`scene ${scene.id}: no video or image asset`);
            }

            const dur = Number(scene.duration) || 3;
            const sceneOut = path.join(workdir, `scene-${String(idx).padStart(3, '0')}.mp4`);

            // Source visual track: prefer videoUrl, else loop the still image for `dur` seconds.
            let visualSrc;
            if (a.videoUrl) {
                visualSrc = path.join(workdir, `v-${idx}.mp4`);
                await download(a.videoUrl, visualSrc);
            } else {
                visualSrc = path.join(workdir, `i-${idx}.jpg`);
                await download(a.imageUrl, visualSrc);
            }

            // Audio track: use the ElevenLabs voice if present; else a silent track.
            let audioSrc = null;
            if (a.audioUrl) {
                audioSrc = path.join(workdir, `a-${idx}.mp3`);
                await download(a.audioUrl, audioSrc);
            }

            // Build the per-scene mp4 with vertical 720x1280 + correct duration.
            // -shortest stops at whichever stream ends first.
            if (a.videoUrl) {
                if (audioSrc) {
                    await ffmpeg([
                        '-y',
                        '-i', visualSrc,
                        '-i', audioSrc,
                        '-map', '0:v:0',
                        '-map', '1:a:0',
                        '-vf', 'scale=720:1280:force_original_aspect_ratio=cover,crop=720:1280',
                        '-c:v', 'libx264',
                        '-preset', 'veryfast',
                        '-pix_fmt', 'yuv420p',
                        '-c:a', 'aac',
                        '-b:a', '128k',
                        '-t', String(dur),
                        sceneOut,
                    ]);
                } else {
                    await ffmpeg([
                        '-y',
                        '-i', visualSrc,
                        '-vf', 'scale=720:1280:force_original_aspect_ratio=cover,crop=720:1280',
                        '-an',
                        '-c:v', 'libx264',
                        '-preset', 'veryfast',
                        '-pix_fmt', 'yuv420p',
                        '-t', String(dur),
                        sceneOut,
                    ]);
                }
            } else {
                // Image-only scene: loop still + audio.
                const args = ['-y', '-loop', '1', '-i', visualSrc];
                if (audioSrc) args.push('-i', audioSrc, '-map', '0:v:0', '-map', '1:a:0', '-c:a', 'aac', '-b:a', '128k');
                else args.push('-an');
                args.push(
                    '-vf', 'scale=720:1280:force_original_aspect_ratio=cover,crop=720:1280',
                    '-c:v', 'libx264',
                    '-preset', 'veryfast',
                    '-pix_fmt', 'yuv420p',
                    '-r', '30',
                    '-t', String(dur),
                    sceneOut,
                );
                await ffmpeg(args);
            }

            scenePieces.push(sceneOut);
        }

        // Concat list file for ffmpeg's concat demuxer.
        const listPath = path.join(workdir, 'list.txt');
        await writeFile(listPath, scenePieces.map((p) => `file '${p}'`).join('\n'));

        const merged = path.join(workdir, 'merged.mp4');
        await ffmpeg([
            '-y',
            '-f', 'concat',
            '-safe', '0',
            '-i', listPath,
            '-c', 'copy',
            merged,
        ]);

        // Move into /public/renders so it's served by Next.
        const rendersDir = path.join(process.cwd(), 'public', 'renders');
        await mkdir(rendersDir, { recursive: true });
        const finalName = `podcast-${Date.now()}-${crypto.randomBytes(3).toString('hex')}.mp4`;
        const finalPath = path.join(rendersDir, finalName);
        await rename(merged, finalPath);

        return NextResponse.json({
            url: `/renders/${finalName}`,
            sceneCount: scenePieces.length,
        });
    } catch (error) {
        console.error('[api/podcast/render]', error);
        return NextResponse.json({ error: error.message || 'render failed' }, { status: 500 });
    } finally {
        if (workdir) await rm(workdir, { recursive: true, force: true }).catch(() => {});
    }
}
