/**
 * Build PNG overlays for the podcast renderer.
 *
 * The Homebrew ffmpeg ships without libfreetype, so drawtext doesn't work.
 * Instead we render each overlay (brand sticker, product sticker, caption
 * chunks) as an SVG string, convert to PNG with sharp, and let ffmpeg
 * composite them via the `overlay` filter — which works in any build.
 *
 * Each overlay is the FULL composition canvas (720x1280) with everything
 * else transparent, so we don't have to compute pixel offsets in ffmpeg.
 * Multiple overlays per slice are stacked with separate `enable` time
 * windows for caption reveals.
 */

import sharp from 'sharp';

const W = 720;
const H = 1280;

const FONT_SANS  = '"Arial Black", "Helvetica Neue", Arial, sans-serif';
const FONT_SERIF = '"Times New Roman", Georgia, serif';

function escXml(s) {
    return String(s || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

/** SVG of a transparent canvas with a tilted brand sticker top-left. */
function brandStickerSvg(copy) {
    const text = String(copy || '').toUpperCase().slice(0, 16);
    const safe = escXml(text);
    return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <g transform="translate(28 28) rotate(-6)">
    <!-- speech-bubble background -->
    <rect x="0" y="0" rx="14" ry="14" width="200" height="76" fill="#000" stroke="#fff" stroke-width="3"/>
    <!-- speech-bubble tail -->
    <path d="M 36 76 L 26 100 L 60 76 Z" fill="#000" stroke="#fff" stroke-width="3" stroke-linejoin="round"/>
    <!-- copy -->
    <text x="100" y="46" text-anchor="middle" dominant-baseline="middle" fill="white"
          font-family='${FONT_SANS}' font-weight="900" font-size="28" letter-spacing="-1">${safe}</text>
  </g>
</svg>`;
}

/** SVG with a product pop sticker, top-center, capsule shape. */
function productStickerSvg(copy) {
    const text = String(copy || '').toUpperCase().slice(0, 18);
    const safe = escXml(text);
    return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <g transform="translate(${W/2} 150) rotate(-3)">
    <rect x="-150" y="-32" rx="32" ry="32" width="300" height="64" fill="#FF2945" stroke="#fff" stroke-width="3"/>
    <text x="0" y="0" text-anchor="middle" dominant-baseline="middle" fill="white"
          font-family='${FONT_SANS}' font-weight="900" font-size="30" letter-spacing="-0.5">${safe}</text>
  </g>
</svg>`;
}

/**
 * Caption chunk SVG — a couple of words centered in the lower-third with
 * a thick black stroke. If `italic`, render with italic serif and no stroke
 * (matches the reference look).
 */
function captionChunkSvg({ words, italic }) {
    const text = italic ? words.join(' ') : words.join(' ').toUpperCase();
    const safe = escXml(text);
    const family = italic ? FONT_SERIF : FONT_SANS;
    const fontStyle = italic ? 'italic' : 'normal';
    const fontWeight = italic ? 700 : 900;
    const fontSize = italic ? 78 : 68;
    const strokeWidth = italic ? 0 : 8;
    const y = Math.round(H * 0.7);
    return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <filter id="dropshadow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur in="SourceAlpha" stdDeviation="4"/>
      <feOffset dx="0" dy="6" result="offsetblur"/>
      <feFlood flood-color="#000" flood-opacity="0.7"/>
      <feComposite in2="offsetblur" operator="in"/>
      <feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>
  <text x="${W/2}" y="${y}" text-anchor="middle"
        font-family='${family}' font-style="${fontStyle}" font-weight="${fontWeight}"
        font-size="${fontSize}" letter-spacing="-1"
        fill="white" stroke="black" stroke-width="${strokeWidth}" paint-order="stroke fill"
        filter="url(#dropshadow)">${safe}</text>
</svg>`;
}

async function svgToPng(svg) {
    return sharp(Buffer.from(svg)).png().toBuffer();
}

/**
 * Split scene text into ≤2-word chunks, isolating any emphasis word.
 */
export function chunkText(text, emphasis) {
    const words = String(text || '').trim().split(/\s+/).filter(Boolean);
    const emphKey = emphasis ? String(emphasis).toLowerCase().replace(/[^a-z]/g, '') : null;
    const chunks = [];
    let buf = [];
    for (const w of words) {
        const isEmph = emphKey && w.toLowerCase().replace(/[^a-z]/g, '') === emphKey;
        if (isEmph) {
            if (buf.length) { chunks.push({ words: buf, italic: false }); buf = []; }
            chunks.push({ words: [w], italic: true });
        } else {
            buf.push(w);
            if (buf.length >= 2) { chunks.push({ words: buf, italic: false }); buf = []; }
        }
    }
    if (buf.length) chunks.push({ words: buf, italic: false });
    return chunks.length ? chunks : [{ words: ['…'], italic: false }];
}

/**
 * Build all the PNG overlays needed for a slice and return their paths
 * plus the timing windows for ffmpeg's `enable` parameter.
 */
export async function renderSliceOverlays({
    sliceDuration,
    sceneText,
    emphasis,
    productPop,
    brand,
    product,
    sliceWorkdir,           // Node fs path where the PNGs should be written
}) {
    const fs = await import('node:fs/promises');
    const path = await import('node:path');

    const overlays = [];

    if (brand) {
        const brandPath = path.join(sliceWorkdir, 'brand.png');
        await fs.writeFile(brandPath, await svgToPng(brandStickerSvg(brand)));
        overlays.push({ path: brandPath, t0: 0, t1: sliceDuration });
    }

    if (productPop && product) {
        const popPath = path.join(sliceWorkdir, 'product.png');
        await fs.writeFile(popPath, await svgToPng(productStickerSvg(product)));
        overlays.push({ path: popPath, t0: 0, t1: sliceDuration });
    }

    const chunks = chunkText(sceneText, emphasis);
    const beat = sliceDuration / chunks.length;
    for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const t0 = beat * i;
        const t1 = Math.min(sliceDuration, t0 + beat + 0.05);
        const p = path.join(sliceWorkdir, `cap-${i}.png`);
        await fs.writeFile(p, await svgToPng(captionChunkSvg(chunk)));
        overlays.push({ path: p, t0, t1 });
    }

    return overlays;
}

/**
 * Compose the ffmpeg `-filter_complex` chain that takes:
 *   [0:v] = the source slice (already at variable size)
 *   [1:v], [2:v], … = the overlay PNGs in `overlays` order
 * and outputs `[v]` ready to mux with audio.
 */
export function buildFilterComplex(overlays, hasAudioInput) {
    const parts = [];
    parts.push(`[0:v]scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H}[base]`);
    let prev = 'base';
    for (let i = 0; i < overlays.length; i++) {
        const ovIndex = i + (hasAudioInput ? 2 : 1); // input index in ffmpeg args
        const out = i === overlays.length - 1 ? 'v' : `s${i}`;
        const o = overlays[i];
        parts.push(`[${prev}][${ovIndex}:v]overlay=0:0:enable='between(t,${o.t0.toFixed(3)},${o.t1.toFixed(3)})'[${out}]`);
        prev = out;
    }
    if (overlays.length === 0) {
        // No overlays → just expose [base] as [v].
        parts.push(`[base]null[v]`);
    }
    return parts.join(';');
}
