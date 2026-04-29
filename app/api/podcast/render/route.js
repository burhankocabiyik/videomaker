/**
 * /api/podcast/render
 *
 * Take-architecture renderer. The pipeline produced ONE long synced video
 * + ONE long voice track per take (≤10s, ≤3 lines from one speaker).
 * We slice each take by scene-offset and concat the alternating slices in
 * scene order to produce one MP4.
 *
 * Inputs:
 *   plan       — full plan (scenes carry takeId + takeOffsetSec + duration)
 *   takeAssets — { [takeId]: { videoUrl, audioUrl, syncedUrl } }
 *
 * Slice priority per take: syncedUrl → videoUrl. We rely on the synced
 * video's own audio track when present; otherwise we overlay the take's
 * audioUrl on top of the muted i2v output and slice that.
 */

import { NextResponse } from 'next/server';
import { spawn } from 'node:child_process';
import { mkdir, mkdtemp, rename, rm, writeFile } from 'node:fs/promises';
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
        proc.on('close', (code) => code === 0 ? resolve() : reject(new Error(`ffmpeg ${code}: ${stderr.slice(-400)}`)));
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
        const takeAssets = body.takeAssets || {};
        if (!plan?.scenes?.length) {
            return NextResponse.json({ error: 'plan with scenes is required' }, { status: 400 });
        }
        if (!plan?.takes?.length) {
            return NextResponse.json({ error: 'plan with takes is required' }, { status: 400 });
        }

        workdir = await mkdtemp(path.join(os.tmpdir(), 'goat-podcast-'));

        // Step 1 — download each take's master video + audio. We prefer the
        // syncedUrl (lipsynced audio + video together) when present; if it's
        // missing we'll fall back to videoUrl + audioUrl overlay during the
        // slice step.
        const masters = {};                 // takeId → { videoPath, audioPath, hasSyncedAudio }
        for (const take of plan.takes) {
            const a = takeAssets[take.id] || {};
            if (!a.videoUrl && !a.syncedUrl) {
                throw new Error(`take ${take.id}: no video asset`);
            }
            const usingSynced = Boolean(a.syncedUrl);
            const videoPath = path.join(workdir, `${take.id}-video.mp4`);
            await download(a.syncedUrl || a.videoUrl, videoPath);
            let audioPath = null;
            if (!usingSynced && a.audioUrl) {
                audioPath = path.join(workdir, `${take.id}-audio.mp3`);
                await download(a.audioUrl, audioPath);
            }
            masters[take.id] = { videoPath, audioPath, hasSyncedAudio: usingSynced };
        }

        // Step 2 — slice each scene from its take. Pad each slice to 720x1280
        // and re-encode so concat demuxer is happy with consistent codec.
        const slices = [];
        for (const [idx, scene] of plan.scenes.entries()) {
            const m = masters[scene.takeId];
            if (!m) throw new Error(`scene ${scene.id}: no master for take ${scene.takeId}`);

            const start = Number(scene.takeOffsetSec) || 0;
            const dur = Number(scene.duration) || 3;
            const slicePath = path.join(workdir, `slice-${String(idx).padStart(3, '0')}.mp4`);

            const args = ['-y', '-ss', String(start), '-t', String(dur), '-i', m.videoPath];
            const filter = 'scale=720:1280:force_original_aspect_ratio=increase,crop=720:1280';

            if (m.hasSyncedAudio) {
                args.push(
                    '-vf', filter,
                    '-c:v', 'libx264', '-preset', 'veryfast', '-pix_fmt', 'yuv420p',
                    '-c:a', 'aac', '-b:a', '128k', '-ar', '44100',
                    slicePath,
                );
            } else if (m.audioPath) {
                // Overlay take audio at the same offset so each scene's
                // audio aligns with what the host is saying in the i2v frame.
                args.push(
                    '-ss', String(start), '-t', String(dur), '-i', m.audioPath,
                    '-vf', filter,
                    '-map', '0:v:0', '-map', '1:a:0',
                    '-c:v', 'libx264', '-preset', 'veryfast', '-pix_fmt', 'yuv420p',
                    '-c:a', 'aac', '-b:a', '128k', '-ar', '44100',
                    slicePath,
                );
            } else {
                args.push(
                    '-vf', filter,
                    '-c:v', 'libx264', '-preset', 'veryfast', '-pix_fmt', 'yuv420p',
                    '-an',
                    slicePath,
                );
            }
            await ffmpeg(args);
            slices.push(slicePath);
        }

        // Step 3 — concat. Use the demuxer with re-encoded inputs (all share
        // libx264/aac now, so concat -c copy would technically work but the
        // first-frame I-frame can be wrong; safer to re-encode lightly).
        const listPath = path.join(workdir, 'list.txt');
        await writeFile(listPath, slices.map((p) => `file '${p}'`).join('\n'));
        const merged = path.join(workdir, 'merged.mp4');
        await ffmpeg([
            '-y',
            '-f', 'concat', '-safe', '0',
            '-i', listPath,
            '-c', 'copy',
            merged,
        ]);

        // Step 4 — publish under /public/renders.
        const rendersDir = path.join(process.cwd(), 'public', 'renders');
        await mkdir(rendersDir, { recursive: true });
        const finalName = `podcast-${Date.now()}-${crypto.randomBytes(3).toString('hex')}.mp4`;
        const finalPath = path.join(rendersDir, finalName);
        await rename(merged, finalPath);

        return NextResponse.json({
            url: `/renders/${finalName}`,
            sliceCount: slices.length,
        });
    } catch (error) {
        console.error('[api/podcast/render]', error);
        return NextResponse.json({ error: error.message || 'render failed' }, { status: 500 });
    } finally {
        if (workdir) await rm(workdir, { recursive: true, force: true }).catch(() => {});
    }
}
