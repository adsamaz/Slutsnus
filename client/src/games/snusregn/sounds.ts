import { play, envelope, getAudioCtx, getDestination } from '../audio';

// ── Background music ──────────────────────────────────────────────────────────
// Frantic arcade rain: fast tempo, major key, punchy and relentless

let bgMusicActive = false;
let bgSchedulerTimer: ReturnType<typeof setTimeout> | null = null;
let bgMusicGain: GainNode | null = null;
let bgMusicHpf: BiquadFilterNode | null = null;
let bgScheduledUntil = 0;
let bgMusicStartTime = 0;

const LOOKAHEAD = 0.3;   // seconds ahead to schedule
const SCHEDULE_INTERVAL = 150; // ms between scheduler ticks

const bpm = 160;
const step = 60 / bpm / 4; // 16th note
const totalSteps = 128; // 8 bars
const loopDuration = totalSteps * step;

// ── Bassline: G major bounce (G2=98, D3=146.8, C3=130.8, B2=123.5) ───────
const bassA: Array<{ freq: number; len: number } | null> = [
    { freq: 98,    len: 1 }, null, { freq: 98,    len: 1 }, null,
    { freq: 146.8, len: 1 }, null, { freq: 130.8, len: 1 }, null,
    { freq: 98,    len: 1 }, null, { freq: 98,    len: 1 }, null,
    { freq: 130.8, len: 1 }, { freq: 123.5, len: 1 }, { freq: 146.8, len: 1 }, null,
];
const bassB: Array<{ freq: number; len: number } | null> = [
    { freq: 146.8, len: 2 }, null, null, null,
    { freq: 130.8, len: 2 }, null, null, null,
    { freq: 123.5, len: 2 }, null, null, null,
    { freq: 98,    len: 2 }, null, null, null,
];
const fullBass: Array<{ freq: number; len: number } | null> = [
    ...bassA, ...bassA, ...bassB, ...bassA,
    ...bassA, ...bassA, ...bassB, ...bassA,
];

// ── Melody: G major pentatonic (G4=392, A4=440, B4=494, D5=587.3, E5=659.3) ─
const melA: Array<{ freq: number; len: number } | null> = [
    { freq: 392,   len: 1 }, null, { freq: 440,   len: 1 }, null,
    { freq: 494,   len: 1 }, null, { freq: 587.3, len: 2 }, null,
    null, null, { freq: 494, len: 1 }, null,
    { freq: 440,   len: 1 }, null, { freq: 392,   len: 2 }, null,

    { freq: 392,   len: 1 }, null, { freq: 440,   len: 1 }, null,
    { freq: 587.3, len: 1 }, null, { freq: 659.3, len: 2 }, null,
    null, { freq: 587.3, len: 1 }, null, { freq: 494, len: 1 },
    { freq: 440,   len: 2 }, null, null, null,
];
const melB: Array<{ freq: number; len: number } | null> = [
    { freq: 659.3, len: 1 }, null, { freq: 587.3, len: 1 }, null,
    { freq: 494,   len: 1 }, null, { freq: 440,   len: 1 }, null,
    { freq: 392,   len: 2 }, null, null, null,
    null, null, { freq: 440, len: 1 }, null,

    { freq: 494,   len: 1 }, null, { freq: 587.3, len: 1 }, null,
    { freq: 659.3, len: 2 }, null, null, null,
    { freq: 587.3, len: 1 }, null, { freq: 494,   len: 1 }, null,
    { freq: 440,   len: 2 }, null, null, null,
];
const fullMel: Array<{ freq: number; len: number } | null> = [
    ...melA, ...melB, ...melA, ...melB,
];

// ── Chord stabs every 4 steps: G major (G, B, D) / C major (C, E, G) ────
const chordFreqs = [
    [196, 246.9, 293.7], // G major
    [261.6, 329.6, 392], // C major
    [293.7, 370, 440],   // D major
    [196, 246.9, 293.7], // G major
];

function freeOnEnd(src: OscillatorNode | AudioBufferSourceNode, stopTime: number, ...nodes: AudioNode[]): void {
    const delay = (stopTime - (src.context as AudioContext).currentTime + 0.05) * 1000;
    setTimeout(() => { try { for (const n of nodes) n.disconnect(); } catch { /* ignore */ } }, Math.max(0, delay));
}

function scheduleSnusregnLoop(
    ac: AudioContext,
    musicGain: GainNode,
    hpf: BiquadFilterNode,
    loopStart: number
): void {
    // Bass
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
        g.gain.linearRampToValueAtTime(0.12, t + 0.005);
        g.gain.setValueAtTime(0.12, t + step * note.len * 0.65);
        g.gain.linearRampToValueAtTime(0, t + step * note.len * 0.85);
        osc.connect(g); g.connect(hpf);
        osc.start(t); osc.stop(t + step * note.len + 0.01);
        freeOnEnd(osc, t + step * note.len + 0.01, osc, g);
    }

    // Melody
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
        g.gain.linearRampToValueAtTime(0.18, t + 0.006);
        g.gain.setValueAtTime(0.18, t + step * note.len * 0.55);
        g.gain.linearRampToValueAtTime(0, t + step * note.len * 0.8);
        osc.connect(g); g.connect(hpf);
        osc.start(t); osc.stop(t + step * note.len + 0.01);
        freeOnEnd(osc, t + step * note.len + 0.01, osc, g);
    }

    // Chord stabs every 8 steps
    for (let ci = 0; ci * 8 < totalSteps; ci++) {
        const stab = ci * 8;
        const freqs = chordFreqs[ci % chordFreqs.length];
        const t = loopStart + stab * step;
        if (t + step * 3.5 < ac.currentTime) continue;
        for (const freq of freqs) {
            const osc = ac.createOscillator();
            const g = ac.createGain();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(freq, t);
            g.gain.setValueAtTime(0, t);
            g.gain.linearRampToValueAtTime(0.1, t + 0.004);
            g.gain.linearRampToValueAtTime(0, t + step * 3);
            osc.connect(g); g.connect(hpf);
            osc.start(t); osc.stop(t + step * 3.5);
            freeOnEnd(osc, t + step * 3.5, osc, g);
        }
    }

    // Hi-hat: every 2 steps (fast 8th notes at 160bpm)
    for (let i = 0; i < totalSteps; i++) {
        if (i % 2 !== 0) continue;
        const t = loopStart + i * step;
        if (t + 0.025 < ac.currentTime) continue;
        const buf = ac.createBuffer(1, Math.ceil(ac.sampleRate * 0.025), ac.sampleRate);
        const data = buf.getChannelData(0);
        for (let s = 0; s < data.length; s++) data[s] = (Math.random() * 2 - 1);
        const src = ac.createBufferSource();
        src.buffer = buf;
        const g = ac.createGain();
        const accent = (i % 8 === 0) ? 0.2 : 0.09;
        g.gain.setValueAtTime(accent, t);
        g.gain.linearRampToValueAtTime(0, t + 0.02);
        const hhf = ac.createBiquadFilter();
        hhf.type = 'highpass';
        hhf.frequency.value = 9000;
        src.connect(hhf); hhf.connect(g); g.connect(musicGain);
        src.start(t); src.stop(t + 0.025);
        freeOnEnd(src, t + 0.025, src, hhf, g);
    }

    // Kick: beats 0 and 8 (half-time feel at 160bpm)
    for (const kick of [0, 8, 10]) {
        const t = loopStart + kick * step;
        if (t + 0.13 < ac.currentTime) continue;
        const osc = ac.createOscillator();
        const g = ac.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(180, t);
        osc.frequency.exponentialRampToValueAtTime(50, t + 0.07);
        g.gain.setValueAtTime(0.65, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
        osc.connect(g); g.connect(musicGain);
        osc.start(t); osc.stop(t + 0.13);
        freeOnEnd(osc, t + 0.13, osc, g);
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
            scheduleSnusregnLoop(ac, bgMusicGain, bgMusicHpf, loopStart);
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
        bgMusicHpf.frequency.value = 60;
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

/** Fresh snus caught — soft triangle bloop, rising glide */
export function soundFreshCatch(): void {
    play((ac, dest) => {
        const osc = ac.createOscillator();
        const gain = ac.createGain();
        osc.connect(gain);
        gain.connect(dest);
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(220, ac.currentTime);
        osc.frequency.exponentialRampToValueAtTime(330, ac.currentTime + 0.1);
        envelope(gain, ac, 0.005, 0.06, 0, 0.1, 0.18);
        osc.start(ac.currentTime);
        osc.stop(ac.currentTime + 0.2);
    });
}

/** Fresh snus caught with beer (×3) — three gentle ascending triangle chimes */
export function soundFreshCatchBeer(): void {
    play((ac, dest) => {
        const freqs = [220, 277, 330];
        const offsets = [0, 0.08, 0.16];
        freqs.forEach((freq, i) => {
            const osc = ac.createOscillator();
            const gain = ac.createGain();
            osc.connect(gain);
            gain.connect(dest);
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(freq, ac.currentTime + offsets[i]);
            osc.frequency.exponentialRampToValueAtTime(freq * 1.1, ac.currentTime + offsets[i] + 0.1);
            const t = ac.currentTime + offsets[i];
            const peak = i === 2 ? 0.12 : 0.10;
            gain.gain.setValueAtTime(0, t);
            gain.gain.linearRampToValueAtTime(peak, t + 0.005);
            gain.gain.linearRampToValueAtTime(0, t + 0.18);
            osc.start(t);
            osc.stop(t + 0.2);
        });
    });
}

/** Spent snus caught — soft low thud */
export function soundSpentCatch(): void {
    play((ac, dest) => {
        const osc = ac.createOscillator();
        const filter = ac.createBiquadFilter();
        const gain = ac.createGain();
        osc.connect(filter);
        filter.connect(gain);
        gain.connect(dest);
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(108, ac.currentTime);
        osc.frequency.exponentialRampToValueAtTime(54, ac.currentTime + 0.04);
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(400, ac.currentTime);
        filter.Q.setValueAtTime(1, ac.currentTime);
        envelope(gain, ac, 0.002, 0.05, 0, 0.12, 0.18);
        osc.start(ac.currentTime);
        osc.stop(ac.currentTime + 0.22);
    });
}

/** Missed a fresh snus — life lost, descending square steps */
export function soundLifeLost(): void {
    play((ac, dest) => {
        const osc = ac.createOscillator();
        const gain = ac.createGain();
        osc.connect(gain);
        gain.connect(dest);
        osc.type = 'square';
        osc.frequency.setValueAtTime(165, ac.currentTime);
        osc.frequency.setValueAtTime(110, ac.currentTime + 0.08);
        osc.frequency.setValueAtTime(55, ac.currentTime + 0.17);
        envelope(gain, ac, 0.002, 0.06, 0.15, 0.3, 0.10);
        osc.start(ac.currentTime);
        osc.stop(ac.currentTime + 0.55);

        // Soft triangle undertone
        const osc2 = ac.createOscillator();
        const gain2 = ac.createGain();
        osc2.connect(gain2);
        gain2.connect(dest);
        osc2.type = 'triangle';
        osc2.frequency.setValueAtTime(80, ac.currentTime);
        osc2.frequency.exponentialRampToValueAtTime(40, ac.currentTime + 0.4);
        const t2 = ac.currentTime;
        gain2.gain.setValueAtTime(0, t2);
        gain2.gain.linearRampToValueAtTime(0.1, t2 + 0.01);
        gain2.gain.linearRampToValueAtTime(0, t2 + 0.55);
        osc2.start(ac.currentTime);
        osc2.stop(ac.currentTime + 0.55);
    });
}

/** Powerup caught (wideBar, slowRain, beer) — warm triangle arpeggio */
export function soundPowerup(): void {
    play((ac, dest) => {
        const freqs = [131, 165, 196, 262];
        const offsets = [0, 0.08, 0.16, 0.24];
        const holds = [0.07, 0.07, 0.07, 0.14];
        freqs.forEach((freq, i) => {
            const osc = ac.createOscillator();
            const gain = ac.createGain();
            osc.connect(gain);
            gain.connect(dest);
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(freq, ac.currentTime + offsets[i]);
            const t = ac.currentTime + offsets[i];
            const peak = i === 3 ? 0.2 : 0.16;
            const sustainLevel = 0.4 * peak;
            const releaseTime = 0.1;
            gain.gain.setValueAtTime(0, t);
            gain.gain.linearRampToValueAtTime(peak, t + 0.005);
            gain.gain.linearRampToValueAtTime(sustainLevel, t + 0.005 + 0.03);
            gain.gain.setValueAtTime(sustainLevel, t + 0.005 + 0.03 + holds[i]);
            gain.gain.linearRampToValueAtTime(0, t + 0.005 + 0.03 + holds[i] + releaseTime);
            osc.start(t);
            osc.stop(t + 0.005 + 0.03 + holds[i] + releaseTime + 0.01);
        });
    });
}

/** Game start — ascending fanfare arpeggio */
export function soundGameStart(): void {
    play((ac, dest) => {
        const freqs = [196, 247, 294, 392, 523];
        const offsets = [0, 0.1, 0.2, 0.3, 0.4];
        const holds = [0.08, 0.08, 0.08, 0.08, 0.2];
        freqs.forEach((freq, i) => {
            const osc = ac.createOscillator();
            const gain = ac.createGain();
            osc.connect(gain);
            gain.connect(dest);
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(freq, ac.currentTime + offsets[i]);
            const t = ac.currentTime + offsets[i];
            const peak = i === 4 ? 0.28 : 0.2;
            gain.gain.setValueAtTime(0, t);
            gain.gain.linearRampToValueAtTime(peak, t + 0.008);
            gain.gain.linearRampToValueAtTime(peak * 0.5, t + 0.008 + 0.03);
            gain.gain.setValueAtTime(peak * 0.5, t + 0.008 + 0.03 + holds[i]);
            gain.gain.linearRampToValueAtTime(0, t + 0.008 + 0.03 + holds[i] + 0.12);
            osc.start(t);
            osc.stop(t + 0.008 + 0.03 + holds[i] + 0.15);
        });
    });
}

/** Debuff caught (fastRain, shrinkBar, blind) — low dissonant triangle drop */
export function soundDebuff(): void {
    play((ac, dest) => {
        const osc = ac.createOscillator();
        const gain = ac.createGain();
        osc.connect(gain);
        gain.connect(dest);
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(160, ac.currentTime);
        osc.frequency.setValueAtTime(113, ac.currentTime + 0.06);
        osc.frequency.setValueAtTime(80, ac.currentTime + 0.13);
        envelope(gain, ac, 0.003, 0.04, 0.1, 0.15, 0.18);
        osc.start(ac.currentTime);
        osc.stop(ac.currentTime + 0.3);
    });
}
