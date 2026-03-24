import { play, envelope, getAudioCtx, getDestination } from '../audio';

// ── Background music ──────────────────────────────────────────────────────────
// Intense arena battle: minor key, driving, aggressive

let bgMusicActive = false;
let bgSchedulerTimer: ReturnType<typeof setTimeout> | null = null;
let bgMusicGain: GainNode | null = null;
let bgMusicHpf: BiquadFilterNode | null = null;
let bgScheduledUntil = 0;
let bgMusicStartTime = 0;

const LOOKAHEAD = 0.3;   // seconds ahead to schedule
const SCHEDULE_INTERVAL = 150; // ms between scheduler ticks

const bpm = 145;
const step = 60 / bpm / 4;
const totalSteps = 128;
const loopDuration = totalSteps * step;

// ── Bassline: A minor (A2=110, E2=82.4, G2=98, F2=87.3) ─────────────────
const bassA: Array<{ freq: number; len: number } | null> = [
    { freq: 110,  len: 1 }, null, { freq: 110,  len: 1 }, null,
    { freq: 110,  len: 1 }, null, { freq: 110,  len: 1 }, null,
    { freq: 98,   len: 1 }, null, { freq: 98,   len: 1 }, null,
    { freq: 87.3, len: 1 }, null, { freq: 82.4, len: 2 }, null,
];
const bassB: Array<{ freq: number; len: number } | null> = [
    { freq: 110,  len: 1 }, null, { freq: 110,  len: 1 }, { freq: 110,  len: 1 },
    null, { freq: 98,   len: 1 }, null, null,
    { freq: 87.3, len: 1 }, null, { freq: 87.3, len: 1 }, { freq: 87.3, len: 1 },
    null, { freq: 82.4, len: 1 }, null, null,
];
const bassC: Array<{ freq: number; len: number } | null> = [
    { freq: 82.4, len: 4 }, null, null, null,
    null, null, null, null,
    { freq: 87.3, len: 4 }, null, null, null,
    { freq: 98,   len: 2 }, null, { freq: 110,  len: 2 }, null,
];
const fullBass: Array<{ freq: number; len: number } | null> = [
    ...bassA, ...bassB, ...bassA, ...bassC,
    ...bassA, ...bassB, ...bassA, ...bassC,
];

// ── Melody: A minor pentatonic (A4=440, C5=523.3, D5=587.3, E5=659.3, G5=784) ─
const melA: Array<{ freq: number; len: number } | null> = [
    { freq: 440,   len: 1 }, null, null, null,
    { freq: 523.3, len: 1 }, null, { freq: 587.3, len: 1 }, null,
    { freq: 659.3, len: 2 }, null, null, null,
    { freq: 587.3, len: 1 }, null, { freq: 523.3, len: 1 }, null,

    { freq: 440,   len: 1 }, null, { freq: 523.3, len: 1 }, null,
    { freq: 440,   len: 2 }, null, null, null,
    null, null, { freq: 392, len: 1 }, null,
    { freq: 440,   len: 2 }, null, null, null,
];
const melB: Array<{ freq: number; len: number } | null> = [
    { freq: 784,   len: 1 }, null, { freq: 659.3, len: 1 }, null,
    { freq: 587.3, len: 1 }, null, { freq: 523.3, len: 1 }, null,
    { freq: 440,   len: 2 }, null, null, null,
    null, { freq: 523.3, len: 1 }, null, null,

    { freq: 587.3, len: 1 }, null, { freq: 659.3, len: 1 }, null,
    { freq: 784,   len: 2 }, null, null, null,
    { freq: 659.3, len: 1 }, null, { freq: 587.3, len: 1 }, null,
    { freq: 523.3, len: 2 }, null, null, null,
];
const fullMel: Array<{ freq: number; len: number } | null> = [
    ...melA, ...melB, ...melA, ...melB,
];

// ── Chord stabs: Am / F / G / Em ─────────────────────────────────────────
const chordFreqs = [
    [220, 261.6, 329.6], // Am
    [174.6, 220, 261.6], // F
    [196, 246.9, 293.7], // G
    [164.8, 196, 246.9], // Em
];

function freeOnEnd(src: OscillatorNode | AudioBufferSourceNode, stopTime: number, ...nodes: AudioNode[]): void {
    const delay = (stopTime - (src.context as AudioContext).currentTime + 0.05) * 1000;
    setTimeout(() => { try { for (const n of nodes) n.disconnect(); } catch { /* ignore */ } }, Math.max(0, delay));
}

function scheduleArenaLoop(
    ac: AudioContext,
    musicGain: GainNode,
    hpf: BiquadFilterNode,
    loopStart: number
): void {
    // Bass (distorted sawtooth)
    for (let i = 0; i < fullBass.length; i++) {
        const note = fullBass[i];
        if (!note) continue;
        const t = loopStart + i * step;
        if (t + step * note.len < ac.currentTime) continue;
        const osc = ac.createOscillator();
        const g = ac.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(note.freq, t);
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(0.14, t + 0.004);
        g.gain.setValueAtTime(0.14, t + step * note.len * 0.7);
        g.gain.linearRampToValueAtTime(0, t + step * note.len * 0.9);
        osc.connect(g); g.connect(hpf);
        osc.start(t); osc.stop(t + step * note.len + 0.01);
        freeOnEnd(osc, t + step * note.len + 0.01, osc, g);
    }

    // Melody (square wave — aggressive)
    for (let i = 0; i < fullMel.length; i++) {
        const note = fullMel[i];
        if (!note) continue;
        const t = loopStart + i * step;
        if (t + step * note.len < ac.currentTime) continue;
        const osc = ac.createOscillator();
        const g = ac.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(note.freq, t);
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(0.15, t + 0.006);
        g.gain.setValueAtTime(0.15, t + step * note.len * 0.6);
        g.gain.linearRampToValueAtTime(0, t + step * note.len * 0.85);
        osc.connect(g); g.connect(hpf);
        osc.start(t); osc.stop(t + step * note.len + 0.01);
        freeOnEnd(osc, t + step * note.len + 0.01, osc, g);
    }

    // Chord stabs every 8 steps
    for (let ci = 0; ci * 8 < totalSteps; ci++) {
        const stab = ci * 8;
        const freqs = chordFreqs[ci % chordFreqs.length];
        const t = loopStart + stab * step;
        if (t + step * 3 < ac.currentTime) continue;
        for (const freq of freqs) {
            const osc = ac.createOscillator();
            const g = ac.createGain();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(freq, t);
            g.gain.setValueAtTime(0, t);
            g.gain.linearRampToValueAtTime(0.09, t + 0.005);
            g.gain.linearRampToValueAtTime(0, t + step * 2.5);
            osc.connect(g); g.connect(hpf);
            osc.start(t); osc.stop(t + step * 3);
            freeOnEnd(osc, t + step * 3, osc, g);
        }
    }

    // Hi-hat: 8th notes
    for (let i = 0; i < totalSteps; i++) {
        if (i % 2 !== 0) continue;
        const t = loopStart + i * step;
        if (t + 0.028 < ac.currentTime) continue;
        const buf = ac.createBuffer(1, Math.ceil(ac.sampleRate * 0.028), ac.sampleRate);
        const data = buf.getChannelData(0);
        for (let s = 0; s < data.length; s++) data[s] = (Math.random() * 2 - 1);
        const src = ac.createBufferSource();
        src.buffer = buf;
        const g = ac.createGain();
        const accent = (i % 8 === 0) ? 0.22 : 0.1;
        g.gain.setValueAtTime(accent, t);
        g.gain.linearRampToValueAtTime(0, t + 0.022);
        const hhf = ac.createBiquadFilter();
        hhf.type = 'highpass';
        hhf.frequency.value = 8500;
        src.connect(hhf); hhf.connect(g); g.connect(musicGain);
        src.start(t); src.stop(t + 0.028);
        freeOnEnd(src, t + 0.028, src, hhf, g);
    }

    // Kick: 4-on-the-floor
    for (const kick of [0, 8, 16, 24]) {
        const t = loopStart + kick * step;
        if (t + 0.15 < ac.currentTime) continue;
        const osc = ac.createOscillator();
        const g = ac.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(170, t);
        osc.frequency.exponentialRampToValueAtTime(48, t + 0.09);
        g.gain.setValueAtTime(0.75, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
        osc.connect(g); g.connect(musicGain);
        osc.start(t); osc.stop(t + 0.15);
        freeOnEnd(osc, t + 0.15, osc, g);
    }

    // Snare on beats 2 and 4 (steps 8 and 24)
    for (const snare of [8, 24]) {
        const t = loopStart + snare * step;
        if (t + 0.15 < ac.currentTime) continue;
        const buf = ac.createBuffer(1, Math.ceil(ac.sampleRate * 0.15), ac.sampleRate);
        const data = buf.getChannelData(0);
        for (let s = 0; s < data.length; s++) data[s] = (Math.random() * 2 - 1);
        const src = ac.createBufferSource();
        src.buffer = buf;
        const bpf = ac.createBiquadFilter();
        bpf.type = 'bandpass';
        bpf.frequency.value = 2500;
        bpf.Q.value = 0.7;
        const g = ac.createGain();
        g.gain.setValueAtTime(0.35, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
        src.connect(bpf); bpf.connect(g); g.connect(musicGain);
        src.start(t); src.stop(t + 0.15);
        freeOnEnd(src, t + 0.15, src, bpf, g);
    }
}

function runScheduler(): void {
    if (!bgMusicActive) return;
    try {
        const ac = getAudioCtx();
        if (!bgMusicGain || !bgMusicHpf) return;

        const scheduleUntil = ac.currentTime + LOOKAHEAD;

        // bgScheduledUntil tracks the end of the last scheduled loop
        while (bgScheduledUntil < scheduleUntil) {
            const elapsed = bgScheduledUntil - bgMusicStartTime;
            const loop = Math.floor(elapsed / loopDuration);
            const loopStart = bgMusicStartTime + loop * loopDuration;
            scheduleArenaLoop(ac, bgMusicGain, bgMusicHpf, loopStart);
            bgScheduledUntil = loopStart + loopDuration;
        }
    } catch { /* ignore */ }

    bgSchedulerTimer = setTimeout(runScheduler, SCHEDULE_INTERVAL);
}

export function startBgMusic(): void {
    if (bgMusicActive) return;
    bgMusicActive = true;
    try {
        const ac = getAudioCtx();
        const dest = getDestination();

        bgMusicGain = ac.createGain();
        bgMusicGain.gain.setValueAtTime(0.08, ac.currentTime);
        bgMusicGain.connect(dest);

        bgMusicHpf = ac.createBiquadFilter();
        bgMusicHpf.type = 'highpass';
        bgMusicHpf.frequency.value = 70;
        bgMusicHpf.connect(bgMusicGain);

        bgMusicStartTime = ac.currentTime;
        bgScheduledUntil = ac.currentTime;
        runScheduler();
    } catch { /* ignore */ }
}

export function stopBgMusic(): void {
    bgMusicActive = false;
    if (bgSchedulerTimer !== null) {
        clearTimeout(bgSchedulerTimer);
        bgSchedulerTimer = null;
    }
    try {
        bgMusicGain?.disconnect();
        bgMusicHpf?.disconnect();
    } catch { /* ignore */ }
    bgMusicGain = null;
    bgMusicHpf = null;
    bgScheduledUntil = 0;
}

/** Game start — punchy ascending arcade fanfare */
export function soundArenaStart(): void {
    play((ac, dest) => {
        const freqs = [220, 277, 330, 440, 554];
        const offsets = [0, 0.09, 0.18, 0.27, 0.36];
        const holds = [0.07, 0.07, 0.07, 0.07, 0.18];
        freqs.forEach((freq, i) => {
            const osc = ac.createOscillator();
            const gain = ac.createGain();
            osc.connect(gain);
            gain.connect(dest);
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(freq, ac.currentTime + offsets[i]);
            const t = ac.currentTime + offsets[i];
            const peak = i === 4 ? 0.26 : 0.18;
            gain.gain.setValueAtTime(0, t);
            gain.gain.linearRampToValueAtTime(peak, t + 0.007);
            gain.gain.linearRampToValueAtTime(peak * 0.45, t + 0.025);
            gain.gain.setValueAtTime(peak * 0.45, t + 0.025 + holds[i]);
            gain.gain.linearRampToValueAtTime(0, t + 0.025 + holds[i] + 0.1);
            osc.start(t);
            osc.stop(t + 0.025 + holds[i] + 0.13);
        });
    });
}

/** Arrow/wand-bolt fired — crisp short tick */
export function soundShoot(): void {
    play((ac, dest) => {
        const osc = ac.createOscillator();
        const gain = ac.createGain();
        osc.connect(gain);
        gain.connect(dest);
        osc.type = 'square';
        osc.frequency.setValueAtTime(600, ac.currentTime);
        osc.frequency.exponentialRampToValueAtTime(300, ac.currentTime + 0.05);
        envelope(gain, ac, 0.002, 0.03, 0, 0.05, 0.12);
        osc.start(ac.currentTime);
        osc.stop(ac.currentTime + 0.1);
    });
}

/** Fireball cast — deeper whoosh pop */
export function soundFireball(): void {
    play((ac, dest) => {
        const osc = ac.createOscillator();
        const filter = ac.createBiquadFilter();
        const gain = ac.createGain();
        osc.connect(filter);
        filter.connect(gain);
        gain.connect(dest);
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(180, ac.currentTime);
        osc.frequency.exponentialRampToValueAtTime(90, ac.currentTime + 0.12);
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(300, ac.currentTime);
        filter.Q.setValueAtTime(2, ac.currentTime);
        envelope(gain, ac, 0.003, 0.06, 0.1, 0.18, 0.22);
        osc.start(ac.currentTime);
        osc.stop(ac.currentTime + 0.35);
    });
}

/** Player takes damage — short low thud with brief drop */
export function soundHit(): void {
    play((ac, dest) => {
        const osc = ac.createOscillator();
        const gain = ac.createGain();
        osc.connect(gain);
        gain.connect(dest);
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(140, ac.currentTime);
        osc.frequency.exponentialRampToValueAtTime(60, ac.currentTime + 0.08);
        envelope(gain, ac, 0.002, 0.04, 0, 0.1, 0.2);
        osc.start(ac.currentTime);
        osc.stop(ac.currentTime + 0.18);
    });
}

/** Player dies — descending wobble */
export function soundDeath(): void {
    play((ac, dest) => {
        const osc = ac.createOscillator();
        const gain = ac.createGain();
        osc.connect(gain);
        gain.connect(dest);
        osc.type = 'square';
        osc.frequency.setValueAtTime(220, ac.currentTime);
        osc.frequency.setValueAtTime(165, ac.currentTime + 0.1);
        osc.frequency.setValueAtTime(110, ac.currentTime + 0.2);
        osc.frequency.setValueAtTime(55, ac.currentTime + 0.3);
        envelope(gain, ac, 0.003, 0.07, 0.15, 0.4, 0.14);
        osc.start(ac.currentTime);
        osc.stop(ac.currentTime + 0.65);
    });
}

/** Heal powerup collected — bright ascending chime */
export function soundHeal(): void {
    play((ac, dest) => {
        const freqs = [330, 415, 494];
        const offsets = [0, 0.07, 0.14];
        freqs.forEach((freq, i) => {
            const osc = ac.createOscillator();
            const gain = ac.createGain();
            osc.connect(gain);
            gain.connect(dest);
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(freq, ac.currentTime + offsets[i]);
            osc.frequency.exponentialRampToValueAtTime(freq * 1.08, ac.currentTime + offsets[i] + 0.1);
            const t = ac.currentTime + offsets[i];
            const peak = i === 2 ? 0.18 : 0.13;
            gain.gain.setValueAtTime(0, t);
            gain.gain.linearRampToValueAtTime(peak, t + 0.005);
            gain.gain.linearRampToValueAtTime(0, t + 0.22);
            osc.start(t);
            osc.stop(t + 0.25);
        });
    });
}

/** Damage-boost powerup collected — punchy low growl */
export function soundDamageBoost(): void {
    play((ac, dest) => {
        const osc = ac.createOscillator();
        const gain = ac.createGain();
        osc.connect(gain);
        gain.connect(dest);
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(110, ac.currentTime);
        osc.frequency.exponentialRampToValueAtTime(165, ac.currentTime + 0.15);
        envelope(gain, ac, 0.004, 0.05, 0.2, 0.2, 0.2);
        osc.start(ac.currentTime);
        osc.stop(ac.currentTime + 0.45);
    });
}

/** Melee Strike (Q) — short blunt thwack */
export function soundMeleeStrike(): void {
    play((ac, dest) => {
        const osc = ac.createOscillator();
        const gain = ac.createGain();
        osc.connect(gain);
        gain.connect(dest);
        osc.type = 'square';
        osc.frequency.setValueAtTime(280, ac.currentTime);
        osc.frequency.exponentialRampToValueAtTime(100, ac.currentTime + 0.04);
        envelope(gain, ac, 0.001, 0.02, 0, 0.05, 0.1);
        osc.start(ac.currentTime);
        osc.stop(ac.currentTime + 0.1);
    });
}

/** Shield Bash (W) — heavy metallic clang */
export function soundShieldBash(): void {
    play((ac, dest) => {
        // Low thud
        const osc = ac.createOscillator();
        const gain = ac.createGain();
        osc.connect(gain);
        gain.connect(dest);
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(160, ac.currentTime);
        osc.frequency.exponentialRampToValueAtTime(60, ac.currentTime + 0.07);
        envelope(gain, ac, 0.001, 0.035, 0, 0.08, 0.12);
        osc.start(ac.currentTime);
        osc.stop(ac.currentTime + 0.18);

        // High metallic ring
        const osc2 = ac.createOscillator();
        const gain2 = ac.createGain();
        osc2.connect(gain2);
        gain2.connect(dest);
        osc2.type = 'triangle';
        osc2.frequency.setValueAtTime(900, ac.currentTime);
        osc2.frequency.exponentialRampToValueAtTime(600, ac.currentTime + 0.15);
        envelope(gain2, ac, 0.001, 0.01, 0.05, 0.18, 0.1);
        osc2.start(ac.currentTime);
        osc2.stop(ac.currentTime + 0.3);
    });
}

/** Ability on cooldown / denied — short blip down */
export function soundCooldown(): void {
    play((ac, dest) => {
        const osc = ac.createOscillator();
        const gain = ac.createGain();
        osc.connect(gain);
        gain.connect(dest);
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(200, ac.currentTime);
        osc.frequency.exponentialRampToValueAtTime(120, ac.currentTime + 0.06);
        envelope(gain, ac, 0.002, 0.03, 0, 0.06, 0.1);
        osc.start(ac.currentTime);
        osc.stop(ac.currentTime + 0.12);
    });
}

/** Game end win — celebratory jingle */
export function soundArenaWin(): void {
    play((ac, dest) => {
        const notes = [262, 330, 392, 523, 659, 784];
        const offsets = [0, 0.1, 0.2, 0.3, 0.4, 0.52];
        const holds = [0.08, 0.08, 0.08, 0.08, 0.08, 0.25];
        notes.forEach((freq, i) => {
            const osc = ac.createOscillator();
            const gain = ac.createGain();
            osc.connect(gain);
            gain.connect(dest);
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(freq, ac.currentTime + offsets[i]);
            const t = ac.currentTime + offsets[i];
            const peak = i === 5 ? 0.28 : 0.2;
            gain.gain.setValueAtTime(0, t);
            gain.gain.linearRampToValueAtTime(peak, t + 0.007);
            gain.gain.linearRampToValueAtTime(peak * 0.5, t + 0.03);
            gain.gain.setValueAtTime(peak * 0.5, t + 0.03 + holds[i]);
            gain.gain.linearRampToValueAtTime(0, t + 0.03 + holds[i] + 0.12);
            osc.start(t);
            osc.stop(t + 0.03 + holds[i] + 0.15);
        });
    });
}

/** Game end lose — sad descending tones */
export function soundArenaLose(): void {
    play((ac, dest) => {
        const notes = [330, 262, 220, 165];
        const offsets = [0, 0.15, 0.3, 0.5];
        const holds = [0.1, 0.1, 0.1, 0.25];
        notes.forEach((freq, i) => {
            const osc = ac.createOscillator();
            const gain = ac.createGain();
            osc.connect(gain);
            gain.connect(dest);
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(freq, ac.currentTime + offsets[i]);
            const t = ac.currentTime + offsets[i];
            const peak = i === 0 ? 0.2 : 0.16 - i * 0.02;
            gain.gain.setValueAtTime(0, t);
            gain.gain.linearRampToValueAtTime(peak, t + 0.008);
            gain.gain.linearRampToValueAtTime(peak * 0.4, t + 0.03);
            gain.gain.setValueAtTime(peak * 0.4, t + 0.03 + holds[i]);
            gain.gain.linearRampToValueAtTime(0, t + 0.03 + holds[i] + 0.2);
            osc.start(t);
            osc.stop(t + 0.03 + holds[i] + 0.25);
        });
    });
}
