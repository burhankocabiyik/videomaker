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
    camera:       'Sony a7S III on a fluid-head tripod beside a casual smartphone B-cam, real-world podcast set, NOT a CGI render',
    lens:         '35mm full-frame, f/2.8, deep depth of field keeping the room visible but slightly soft, real anamorphic-style flares only when light catches',
    grade:        'natural HDR with NO over-smoothing — visible skin pores, fine peach-fuzz, micro shadows under the eyes, true asymmetric facial features, light grain, true-to-life teal-orange balance, no waxy plastic skin, no symmetric AI face',
    framing:      'Medium close-up, eye-level, centered framing showing chest up, microphone visible in the lower third, occasional slight reframing as the speaker shifts',
    motion:       'subtle handheld micro-shake, breathing-driven head bob, occasional micro-rotation as the speaker glances at the other host, gentle weight shifts, NO Dutch angle, NO jitter, NO whip pans',
    lighting:     'practical-only: warm tungsten key from the yellow accent lamp at frame-left, soft window fill at frame-right, no studio softboxes, faint catch light in both eyes, mild rim from the bookshelf practicals',
    audio:        'Shure SM7B microphone close to mouth — present voice with natural mouth sounds (breath, lip smacks), a touch of armchair-fabric reverb, very faint ambient room tone, distant traffic just at the noise floor, no music, no cuts, one-take natural pacing',
    ugcKeywords:  'photorealistic podcast clip, NOT AI-looking, raw skin texture, real micro-expressions, asymmetric features, lived-in clothing creases, candid co-host energy, modern home studio, vertical 9:16, intimate Reels/TikTok aesthetic',
    negatives:    'no plastic skin, no airbrushed face, no symmetric eyes, no over-smoothing, no waxy texture, no glossy CGI look, no extra fingers, no warped hands, no floating jewelry, no frame stutter, no flicker, no rolling shutter wobble, no on-screen text, no watermark',
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
        `A photorealistic, raw, NOT-AI-looking podcast clip — vertical (9:16), filmed in ${settingLine}, titled "${filename}".`,
        `This must read as authentic captured footage of real people, not a generated render.`,
        `Character: ${speakerLabel}, ${characterLine}.`,
        `Setting: ${ASPECT_NOTE}.`,
        `Cinematography:`,
        `Camera: ${FILM_BASE.camera}.`,
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
        `Universal Quality Control: ${FILM_BASE.negatives}, take ${takeIndex}.`,
    ].join('\n');
}

/**
 * Realism-focused image prompt for the FIRST anchor (wide shot or close-up).
 * Heavy lift on photorealism keywords so Nano Banana doesn't drift into
 * the glossy-AI-portrait style.
 */
export function buildRealisticImagePrompt({ kind, plan, speaker, side }) {
    const setting = plan?.setting
        ? plan.setting
        : 'modern home podcast studio with two beige armchairs facing each other, yellow accent floor lamp, wooden bookshelf with plants and books, neutral linen wall, two podcast microphones on stands';

    const realismCore = [
        'Shot on Sony a7S III, 35mm prime f/2.8, ISO 800, raw unedited still — looks like a frame grab from a documentary podcast, NOT a generated render.',
        'Photorealistic skin texture: visible pores, peach fuzz, faint shadows under the eyes, fine asymmetric features, no airbrushing, no plastic skin, no waxy CGI look.',
        'Natural HDR colour, fine grain, mild teal-orange balance, soft warm tungsten key from frame-left, soft window fill from frame-right.',
        'Authentic, lived-in feel; clothes have natural creases; jewellery sits naturally; hair is not perfectly styled.',
        'Vertical 9:16 framing.',
    ].join(' ');

    const negatives = 'NOT AI-looking, no symmetric face, no plastic doll skin, no over-smoothing, no extra fingers, no warped hands, no floating microphone, no on-screen text, no watermark, no logo on clothing.';

    if (kind === 'wide') {
        const a = (plan?.speakers || [])[0];
        const b = (plan?.speakers || [])[1];
        return [
            `Wide establishing photo of two real-looking podcast hosts in ${setting}.`,
            a ? `Left armchair host: ${a.appearance}, wearing ${a.wardrobe}.` : '',
            b ? `Right armchair host: ${b.appearance}, wearing ${b.wardrobe}.` : '',
            'Both clearly in the same room, same lighting, two microphones on adjustable stands in front of them, mid-conversation candid pose.',
            realismCore,
            negatives,
        ].filter(Boolean).join(' ');
    }

    return [
        `Medium close-up photo of the ${side === 'right' ? 'right' : 'left'} podcast host from this exact same scene — ${speaker?.appearance || 'a podcast host'}, wearing ${speaker?.wardrobe || ''}.`,
        `They sit in their armchair in the same room, microphone in front of them, eyes toward the other host across the table.`,
        realismCore,
        negatives,
    ].join(' ');
}

