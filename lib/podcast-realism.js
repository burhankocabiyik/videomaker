/**
 * Hyper-realistic video-prompt builder.
 *
 * The reference style we're emulating (the "Grüns Superfood selfie" prompt
 * the user shared) is dense, structured, and very explicit about
 * cinematography, performance, dialogue and audio. Asking the LLM to write
 * something this long for every scene blows past the any-llm output budget,
 * so we ask it for the THIN scene primitives (line, expression, gesture)
 * and assemble the long realism prompt server-side.
 */

const FILM_BASE = {
    camera:       'Sony a7S III with a 35mm prime',
    lens:         '35mm full-frame, f/2.8, deep depth of field keeping the room visible but slightly soft',
    grade:        'natural HDR, true skin tones, slight warm tungsten cast, fine grain',
    framing:      'Medium close-up, eye-level, centered framing showing chest up, microphone in lower third',
    motion:       'subtle handheld micro-shake, micro-rotations from natural breathing, no jitter, no Dutch angle',
    lighting:     'soft warm key from a tungsten lamp at frame-left, gentle ambient fill from a window at frame-right, faint catch light in the eyes',
    audio:        'Recorded through a Shure SM7B on a stand — close, present voice with natural mouth sounds and a touch of room reverb. Faint ambient room tone, soft creak of an armchair, no music, no cuts; one-take natural pacing.',
    ugcKeywords:  'authentic podcast realism, two-host conversation, modern home studio, vertical 9:16, raw unfiltered Reels/TikTok aesthetic, real voice, micro hand jitters, one-take, intimate co-host energy',
};

const ASPECT_NOTE = 'A vertical 9:16 single-take podcast clip filmed on the same set as the rest of the episode';

function speakerDescriptor(speaker) {
    const lines = [];
    if (speaker?.appearance) lines.push(speaker.appearance);
    if (speaker?.wardrobe)   lines.push(`wearing ${speaker.wardrobe}`);
    if (speaker?.persona)    lines.push(`persona: ${speaker.persona}`);
    return lines.join(', ');
}

function dialogueBlock(scene) {
    const text = String(scene.text || '').trim();
    if (!text) return '';
    return `Dialogue:\n"${text}"`;
}

/**
 * Build a "Grüns Superfood"-style hyper-detailed video prompt for one scene.
 * Runs deterministically on the server using the plan + scene + speaker.
 */
export function buildRealisticVideoPrompt({ plan, scene, speaker, takeIndex = 1 }) {
    const showSlug = (plan?.showName || 'show').replace(/\s+/g, '_').toLowerCase();
    const filename = `IMG_${1000 + (Number(scene.id) || 0)}_${showSlug}.MOV`;
    const speakerLabel = speaker?.id ? `@${speaker.id}` : '@host';
    const characterLine = speakerDescriptor(speaker) || 'a podcast host';
    const settingLine = plan?.setting
        ? plan.setting
        : 'a modern home podcast studio with two armchairs facing each other, one yellow accent floor lamp, a wooden bookshelf with plants and books, neutral linen wall, two podcast microphones on stands';

    const beatAction = scene.imagePrompt
        ? scene.imagePrompt
        : 'speaks naturally into the microphone with subtle hand gestures';

    const beatMotion = scene.videoPromptHint
        ? scene.videoPromptHint
        : 'subtle natural micro-motion: small head tilts, breathing, light hand gestures, occasional eye-line drift to the other host';

    const productPop = scene.productPop
        ? `On this beat the on-screen brand sticker for ${plan?.productSticker?.copy || plan?.showName || 'the product'} pops in for emphasis.`
        : '';

    const performance = [
        `${speakerLabel} sits in the ${scene.speaker === plan?.speakers?.[0]?.id ? 'left' : 'right'} armchair facing the other host,`,
        'speaking into a podcast microphone with natural conversational energy.',
        beatAction + '.',
        productPop,
        'Constant relaxed eye-line — alternating between the camera lens and the other host across the table.',
        'Natural body language with slight weight shifts, micro-rotations of the torso and head.',
    ].filter(Boolean).join(' ');

    return [
        `A casual, podcast-style vertical (9:16) clip filmed in ${settingLine}, titled "${filename}".`,
        `Character: ${speakerLabel}, ${characterLine}.`,
        `Setting: ${ASPECT_NOTE}.`,
        `Cinematography:`,
        `Camera Shot: ${FILM_BASE.framing}.`,
        `Lens & DOF: ${FILM_BASE.lens}.`,
        `Camera Motion: ${FILM_BASE.motion}; ${beatMotion}.`,
        `Lighting: ${FILM_BASE.lighting}.`,
        `Color & Grade: ${FILM_BASE.grade}.`,
        `Subject Action & Performance:`,
        performance,
        dialogueBlock(scene),
        `Audio & Ambience:`,
        FILM_BASE.audio,
        `UGC Authenticity Keywords:`,
        FILM_BASE.ugcKeywords + '.',
        `Universal Quality Control: no extra limbs, no face warp, no object duplication, no flicker, no rolling shutter wobble, no Dutch angle, keep horizon level, no on-screen text or watermark, take ${takeIndex}.`,
    ].join('\n');
}
