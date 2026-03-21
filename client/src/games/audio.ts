/** Shared Web Audio context and master volume for all games. */

let ctx: AudioContext | null = null;
let masterGain: GainNode | null = null;

const STORAGE_KEY = 'slutsnus_volume';
const DEFAULT_VOLUME = 0.5;

let _volume: number = (() => {
    try {
        const v = parseFloat(localStorage.getItem(STORAGE_KEY) ?? '');
        return isNaN(v) ? DEFAULT_VOLUME : Math.max(0, Math.min(1, v));
    } catch { return DEFAULT_VOLUME; }
})();

export function getVolume(): number { return _volume; }

export function setVolume(v: number): void {
    _volume = Math.max(0, Math.min(1, v));
    try { localStorage.setItem(STORAGE_KEY, String(_volume)); } catch { /* ignore */ }
    if (masterGain) masterGain.gain.setValueAtTime(_volume, masterGain.context.currentTime);
}

export function getAudioCtx(): AudioContext {
    if (!ctx) {
        ctx = new AudioContext();
        masterGain = ctx.createGain();
        masterGain.gain.setValueAtTime(_volume, ctx.currentTime);
        masterGain.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
}

export function getDestination(): AudioNode {
    getAudioCtx(); // ensure masterGain is created
    return masterGain!;
}

export function play(fn: (ac: AudioContext, dest: AudioNode) => void): void {
    try { const ac = getAudioCtx(); fn(ac, masterGain!); } catch { /* ignore */ }
}

export function envelope(
    gain: GainNode, ac: AudioContext,
    attack: number, decay: number, sustain: number, release: number,
    peak = 0.4
): void {
    const now = ac.currentTime;
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(peak, now + attack);
    gain.gain.linearRampToValueAtTime(sustain * peak, now + attack + decay);
    gain.gain.setValueAtTime(sustain * peak, now + attack + decay);
    gain.gain.linearRampToValueAtTime(0, now + attack + decay + release);
}
