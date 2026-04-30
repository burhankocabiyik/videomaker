/**
 * /api/podcast/render
 *
 * Take-architecture renderer with PNG-overlay caption + brand sticker.
 *
 * The Homebrew ffmpeg ships without libfreetype (no drawtext filter), so we
 * render every overlay as an SVG → PNG via sharp and composite via the
 * always-available `overlay` filter.
 */

import { NextResponse } from 'next/server';
import { spawn } from 'node:child_process';
import { mkdir, mkdtemp, rename, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { renderSliceOverlays, buildFilterComplex } from '@/lib/podcast-overlay.js';

export const runtime = 'nodejs';
export const maxDuration = 600;

function ffmpeg(args) {
    return new Promise((resolve, reject) => {
        const proc = spawn('ffmpeg', args, { stdio: ['ignore', 'ignore', 'pipe'] });
        let stderr = '';
        proc.stderr.on('data', (d) => { stderr += d.toString(); });
        proc.on('error', reject);
        proc.on('close', (code) => code === 0 ? resolve() : reject(new Error(`ffmpeg ${code}: ${stderr.slice(-600)}`)));
    });
}

async function download(url, filePath) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`download ${url} → ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    await writeFile(filePath, buf);
}

/**
 * Probe a media file's duration in seconds. Returns null on failure so the
 * caller can fall back to the planned duration.
 */
async function probeDuration(filePath) {
    return new Promise((resolve) => {
        const proc = spawn('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', filePath], { stdio: ['ignore', 'pipe', 'ignore'] });
        let out = '';
        proc.stdout.on('data', (d) => { out += d.toString(); });
        proc.on('error', () => resolve(null));
        proc.on('close', () => {
            const n = parseFloat(out.trim());
            resolve(Number.isFinite(n) ? n : null);
        });
    });
}

export async function POST(request) {
    let workdir;
    try {
        const body = await request.json();
        const plan = body.plan;
        const takeAssets = body.takeAssets || {};
        const burnOverlays = body.burnOverlays !== false;
        if (!plan?.scenes?.length) return NextResponse.json({ error: 'plan.scenes required' }, { status: 400 });
        if (!plan?.takes?.length)  return NextResponse.json({ error: 'plan.takes required' }, { status: 400 });

        workdir = await mkdtemp(path.join(os.tmpdir(), 'goat-podcast-'));

        // Download masters
        const masters = {};
        for (const take of plan.takes) {
            const a = takeAssets[take.id] || {};
            if (!a.videoUrl && !a.syncedUrl) throw new Error(`take ${take.id}: no video asset`);
            const usingSynced = Boolean(a.syncedUrl);
            const videoPath = path.join(workdir, `${take.id}-video.mp4`);
            await download(a.syncedUrl || a.videoUrl, videoPath);
            let audioPath = null;
            if (!usingSynced && a.audioUrl) {
                audioPath = path.join(workdir, `${take.id}-audio.mp3`);
                await download(a.audioUrl, audioPath);
            }
            const videoDuration = await probeDuration(videoPath);
            const audioDuration = audioPath ? await probeDuration(audioPath) : null;
            masters[take.id] = {
                videoPath,
                audioPath,
                hasSyncedAudio: usingSynced,
                videoDuration,
                audioDuration,
            };
            console.log(`[render] take ${take.id}: video=${videoDuration?.toFixed(2)}s audio=${audioDuration?.toFixed(2) || 'n/a'}s`);
        }

        // Build a per-take "scene plan" with safe slicing. If the actual take
        // video is shorter than the sum of scene durations the planner asked
        // for, we proportionally rescale every scene in that take so all
        // scenes still appear in the final cut (no silent drops).
        const sceneOverride = new Map();
        for (const take of plan.takes) {
            const m = masters[take.id];
            const planned = (take.totalDuration || 0);
            const actual  = m.videoDuration || planned;
            // Leave a 0.05s safety pad so slicing never overruns the clip end.
            const usable = Math.max(0.5, actual - 0.05);
            const scale = planned > 0 ? Math.min(1, usable / planned) : 1;
            if (scale < 0.999) {
                console.log(`[render] take ${take.id} scale=${scale.toFixed(3)} (planned ${planned}s, actual ${actual.toFixed(2)}s)`);
            }
            let cursor = 0;
            for (const sceneId of take.sceneIds) {
                const sc = plan.scenes.find((s) => s.id === sceneId);
                if (!sc) continue;
                const newDur = Math.max(0.5, (sc.duration || 0) * scale);
                sceneOverride.set(sceneId, { takeOffsetSec: cursor, duration: newDur });
                cursor += newDur;
            }
        }

        const brandCopy   = plan?.brandSticker?.copy   || plan?.showName || '';
        const productCopy = plan?.productSticker?.copy || '';

        // Per-scene slice + overlay
        const slices = [];
        for (const [idx, scene] of plan.scenes.entries()) {
            const m = masters[scene.takeId];
            if (!m) throw new Error(`scene ${scene.id}: master ${scene.takeId} missing`);
            const ov    = sceneOverride.get(scene.id);
            const start = Number(ov?.takeOffsetSec ?? scene.takeOffsetSec) || 0;
            const dur   = Number(ov?.duration ?? scene.duration) || 3;
            const slicePath = path.join(workdir, `slice-${String(idx).padStart(3, '0')}.mp4`);
            const sliceWorkdir = path.join(workdir, `s${idx}`);
            await mkdir(sliceWorkdir, { recursive: true });

            const overlays = burnOverlays ? await renderSliceOverlays({
                sliceDuration: dur,
                sceneText: scene.text,
                emphasis: scene.emphasis,
                productPop: Boolean(scene.productPop),
                brand: brandCopy,
                product: productCopy,
                sliceWorkdir,
            }) : [];

            const args = ['-y', '-ss', String(start), '-t', String(dur), '-i', m.videoPath];
            if (!m.hasSyncedAudio && m.audioPath) {
                args.push('-ss', String(start), '-t', String(dur), '-i', m.audioPath);
            }
            for (const o of overlays) args.push('-i', o.path);

            const filter = buildFilterComplex(overlays, !m.hasSyncedAudio && Boolean(m.audioPath));
            args.push('-filter_complex', filter, '-map', '[v]');
            // Audio mapping
            if (m.hasSyncedAudio) args.push('-map', '0:a:0?');
            else if (m.audioPath) args.push('-map', '1:a:0');
            args.push(
                '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-pix_fmt', 'yuv420p',
                '-c:a', 'aac', '-b:a', '128k', '-ar', '44100',
                '-r', '30',
                slicePath,
            );
            await ffmpeg(args);
            slices.push(slicePath);
        }

        // Concat
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

        // Publish
        const rendersDir = path.join(process.cwd(), 'public', 'renders');
        await mkdir(rendersDir, { recursive: true });
        const finalName = `podcast-${Date.now()}-${crypto.randomBytes(3).toString('hex')}.mp4`;
        const finalPath = path.join(rendersDir, finalName);
        await rename(merged, finalPath);

        return NextResponse.json({
            url: `/renders/${finalName}`,
            sliceCount: slices.length,
            burnOverlays,
        });
    } catch (error) {
        console.error('[api/podcast/render]', error);
        return NextResponse.json({ error: error.message || 'render failed' }, { status: 500 });
    } finally {
        if (workdir) await rm(workdir, { recursive: true, force: true }).catch(() => {});
    }
}
