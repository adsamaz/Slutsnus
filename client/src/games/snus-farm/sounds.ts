import { play, envelope, getAudioCtx, getDestination } from '../audio';

// ── Background music ──────────────────────────────────────────────────────────
// Cheerful pastoral farm tune: bouncy, folksy, bright and warm

let bgMusicNodes: AudioNode[] = [];
let bgMusicActive = false;

function buildFarmMusic(ac: AudioContext, dest: AudioNode): AudioNode[] {
    const nodes: AudioNode[] = [];
    const bpm = 120;
    const step = 60 / bpm / 4;

    const musicGain = ac.createGain();
    musicGain.gain.setValueAtTime(0.09, ac.currentTime);
    musicGain.connect(dest);
    nodes.push(musicGain);

    const hpf = ac.createBiquadFilter();
    hpf.type = 'highpass';
    hpf.frequency.value = 60;
    hpf.connect(musicGain);
    nodes.push(hpf);

    const totalSteps = 128;
    const loopDuration = totalSteps * step;

    // ── Bassline: C major (C2=65.4, G2=98, F2=87.3, Am: A2=110) ─────────────
    const bassA: Array<{ freq: number; len: number } | null> = [
        { freq: 65.4, len: 2 }, null, null, null,
        { freq: 98,   len: 2 }, null, null, null,
        { freq: 87.3, len: 2 }, null, null, null,
        { freq: 65.4, len: 2 }, null, null, null,
    ];
    const bassB: Array<{ freq: number; len: number } | null> = [
        { freq: 65.4, len: 1 }, null, { freq: 65.4, len: 1 }, null,
        { freq: 98,   len: 1 }, null, { freq: 98,   len: 1 }, null,
        { freq: 87.3, len: 1 }, null, { freq: 110,  len: 1 }, null,
        { freq: 65.4, len: 2 }, null, null, null,
    ];
    const fullBass: Array<{ freq: number; len: number } | null> = [
        ...bassA, ...bassB, ...bassA, ...bassB,
        ...bassA, ...bassB, ...bassA, ...bassB,
    ];

    // ── Melody: C major pentatonic (C5=523.3, D5=587.3, E5=659.3, G5=784, A5=880) ─
    const melA: Array<{ freq: number; len: number } | null> = [
        { freq: 523.3, len: 1 }, null, { freq: 587.3, len: 1 }, null,
        { freq: 659.3, len: 1 }, null, { freq: 784,   len: 2 }, null,
        null, null, { freq: 659.3, len: 1 }, null,
        { freq: 587.3, len: 1 }, null, { freq: 523.3, len: 2 }, null,

        { freq: 523.3, len: 1 }, null, { freq: 659.3, len: 1 }, null,
        { freq: 784,   len: 1 }, null, { freq: 880,   len: 2 }, null,
        null, { freq: 784, len: 1 }, null, { freq: 659.3, len: 1 },
        { freq: 523.3, len: 2 }, null, null, null,
    ];
    const melB: Array<{ freq: number; len: number } | null> = [
        { freq: 880,   len: 1 }, null, { freq: 784,   len: 1 }, null,
        { freq: 659.3, len: 1 }, null, { freq: 587.3, len: 1 }, null,
        { freq: 523.3, len: 2 }, null, null, null,
        null, null, { freq: 587.3, len: 1 }, null,

        { freq: 523.3, len: 1 }, null, { freq: 659.3, len: 1 }, null,
        { freq: 784,   len: 2 }, null, null, null,
        { freq: 659.3, len: 1 }, null, { freq: 523.3, len: 1 }, null,
        { freq: 587.3, len: 2 }, null, null, null,
    ];
    const fullMel: Array<{ freq: number; len: number } | null> = [
        ...melA, ...melB, ...melA, ...melB,
    ];

    // ── Chord pads: C / F / G / Am ────────────────────────────────────────────
    const chordFreqs = [
        [261.6, 329.6, 392],  // C major
        [174.6, 220, 261.6],  // F major
        [196, 246.9, 293.7],  // G major
        [220, 261.6, 329.6],  // Am
    ];

    const maxLoops = Math.ceil(300 / loopDuration);

    for (let loop = 0; loop < maxLoops; loop++) {
        const loopStart = ac.currentTime + loop * loopDuration;

        // Bass (warm triangle)
        for (let i = 0; i < fullBass.length; i++) {
            const note = fullBass[i];
            if (!note) continue;
            const t = loopStart + i * step;
            const osc = ac.createOscillator();
            const g = ac.createGain();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(note.freq, t);
            g.gain.setValueAtTime(0, t);
            g.gain.linearRampToValueAtTime(0.16, t + 0.008);
            g.gain.setValueAtTime(0.16, t + step * note.len * 0.6);
            g.gain.linearRampToValueAtTime(0, t + step * note.len * 0.85);
            osc.connect(g); g.connect(hpf);
            osc.start(t); osc.stop(t + step * note.len + 0.01);
            nodes.push(osc, g);
        }

        // Melody (triangle — warm and folksy)
        for (let i = 0; i < fullMel.length; i++) {
            const note = fullMel[i];
            if (!note) continue;
            const t = loopStart + i * step;
            const osc = ac.createOscillator();
            const g = ac.createGain();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(note.freq, t);
            g.gain.setValueAtTime(0, t);
            g.gain.linearRampToValueAtTime(0.5, t + 0.01);
            g.gain.setValueAtTime(0.5, t + step * note.len * 0.55);
            g.gain.linearRampToValueAtTime(0, t + step * note.len * 0.82);
            osc.connect(g); g.connect(hpf);
            osc.start(t); osc.stop(t + step * note.len + 0.01);
            nodes.push(osc, g);
        }

        // Chord pads every 8 steps
        for (let ci = 0; ci * 8 < totalSteps; ci++) {
            const stab = ci * 8;
            const freqs = chordFreqs[ci % chordFreqs.length];
            const t = loopStart + stab * step;
            for (const freq of freqs) {
                const osc = ac.createOscillator();
                const g = ac.createGain();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(freq, t);
                g.gain.setValueAtTime(0, t);
                g.gain.linearRampToValueAtTime(0.12, t + 0.02);
                g.gain.setValueAtTime(0.12, t + step * 5);
                g.gain.linearRampToValueAtTime(0, t + step * 7);
                osc.connect(g); g.connect(hpf);
                osc.start(t); osc.stop(t + step * 7.5);
                nodes.push(osc, g);
            }
        }

        // Soft hi-hat: quarter notes only (relaxed feel)
        for (let i = 0; i < totalSteps; i++) {
            if (i % 4 !== 0) continue;
            const t = loopStart + i * step;
            const buf = ac.createBuffer(1, Math.ceil(ac.sampleRate * 0.04), ac.sampleRate);
            const data = buf.getChannelData(0);
            for (let s = 0; s < data.length; s++) data[s] = (Math.random() * 2 - 1);
            const src = ac.createBufferSource();
            src.buffer = buf;
            const g = ac.createGain();
            g.gain.setValueAtTime(0.12, t);
            g.gain.linearRampToValueAtTime(0, t + 0.035);
            const hhf = ac.createBiquadFilter();
            hhf.type = 'highpass';
            hhf.frequency.value = 7000;
            src.connect(hhf); hhf.connect(g); g.connect(musicGain);
            src.start(t); src.stop(t + 0.04);
            nodes.push(src, g, hhf);
        }

        // Kick: on 1 and 3 (steps 0 and 16)
        for (const kick of [0, 16]) {
            const t = loopStart + kick * step;
            const osc = ac.createOscillator();
            const g = ac.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(150, t);
            osc.frequency.exponentialRampToValueAtTime(50, t + 0.1);
            g.gain.setValueAtTime(0.55, t);
            g.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
            osc.connect(g); g.connect(musicGain);
            osc.start(t); osc.stop(t + 0.16);
            nodes.push(osc, g);
        }

        // Pluck: cheerful 8th-note decoration on offbeats
        const pluckSteps = [2, 10, 18, 26];
        const pluckFreqs = [659.3, 784, 659.3, 523.3];
        for (let pi = 0; pi < pluckSteps.length; pi++) {
            const t = loopStart + pluckSteps[pi] * step;
            const freq = pluckFreqs[pi % pluckFreqs.length];
            const osc = ac.createOscillator();
            const g = ac.createGain();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(freq, t);
            g.gain.setValueAtTime(0, t);
            g.gain.linearRampToValueAtTime(0.1, t + 0.005);
            g.gain.linearRampToValueAtTime(0, t + 0.12);
            osc.connect(g); g.connect(hpf);
            osc.start(t); osc.stop(t + 0.13);
            nodes.push(osc, g);
        }
    }

    return nodes;
}

export function startBgMusic(): void {
    if (bgMusicActive) return;
    bgMusicActive = true;
    try {
        const ac = getAudioCtx();
        const dest = getDestination();
        bgMusicNodes = buildFarmMusic(ac, dest);
    } catch { /* ignore */ }
}

export function stopBgMusic(): void {
    bgMusicActive = false;
    for (const node of bgMusicNodes) {
        try {
            if (node instanceof AudioBufferSourceNode || node instanceof OscillatorNode) {
                (node as OscillatorNode).stop();
            }
            node.disconnect();
        } catch { /* ignore */ }
    }
    bgMusicNodes = [];
}

/** Game start — cheerful bouncy arpeggio */
export function soundFarmStart(): void {
    play((ac, dest) => {
        const freqs = [261, 329, 392, 523, 659];
        const offsets = [0, 0.09, 0.18, 0.27, 0.36];
        const holds = [0.07, 0.07, 0.07, 0.07, 0.2];
        freqs.forEach((freq, i) => {
            const osc = ac.createOscillator();
            const gain = ac.createGain();
            osc.connect(gain);
            gain.connect(dest);
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(freq, ac.currentTime + offsets[i]);
            const t = ac.currentTime + offsets[i];
            const peak = i === 4 ? 0.24 : 0.17;
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

/** Chicken herded into pen — happy little bloop */
export function soundChickenCaptured(): void {
    play((ac, dest) => {
        const freqs = [392, 494, 587];
        const offsets = [0, 0.06, 0.12];
        freqs.forEach((freq, i) => {
            const osc = ac.createOscillator();
            const gain = ac.createGain();
            osc.connect(gain);
            gain.connect(dest);
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(freq, ac.currentTime + offsets[i]);
            osc.frequency.exponentialRampToValueAtTime(freq * 1.06, ac.currentTime + offsets[i] + 0.08);
            const t = ac.currentTime + offsets[i];
            gain.gain.setValueAtTime(0, t);
            gain.gain.linearRampToValueAtTime(0.16, t + 0.005);
            gain.gain.linearRampToValueAtTime(0, t + 0.18);
            osc.start(t);
            osc.stop(t + 0.2);
        });
    });
}

/** Score milestone (every 5 points) — sparkle chime */
export function soundFarmMilestone(): void {
    play((ac, dest) => {
        const freqs = [523, 659, 784, 1047];
        const offsets = [0, 0.07, 0.14, 0.21];
        freqs.forEach((freq, i) => {
            const osc = ac.createOscillator();
            const gain = ac.createGain();
            osc.connect(gain);
            gain.connect(dest);
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(freq, ac.currentTime + offsets[i]);
            const t = ac.currentTime + offsets[i];
            const peak = i === 3 ? 0.18 : 0.13;
            gain.gain.setValueAtTime(0, t);
            gain.gain.linearRampToValueAtTime(peak, t + 0.005);
            gain.gain.linearRampToValueAtTime(0, t + 0.2);
            osc.start(t);
            osc.stop(t + 0.22);
        });
    });
}

/** Game end win */
export function soundFarmWin(): void {
    play((ac, dest) => {
        const notes = [261, 329, 392, 523, 659, 784];
        const offsets = [0, 0.1, 0.2, 0.3, 0.4, 0.52];
        const holds = [0.08, 0.08, 0.08, 0.08, 0.08, 0.22];
        notes.forEach((freq, i) => {
            const osc = ac.createOscillator();
            const gain = ac.createGain();
            osc.connect(gain);
            gain.connect(dest);
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(freq, ac.currentTime + offsets[i]);
            const t = ac.currentTime + offsets[i];
            const peak = i === 5 ? 0.26 : 0.18;
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

/** Snus spawned — soft mystical shimmer */
export function soundSnusSpawn(): void {
    play((ac, dest) => {
        const osc = ac.createOscillator();
        const gain = ac.createGain();
        osc.connect(gain);
        gain.connect(dest);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(600, ac.currentTime);
        osc.frequency.exponentialRampToValueAtTime(900, ac.currentTime + 0.15);
        osc.frequency.exponentialRampToValueAtTime(750, ac.currentTime + 0.35);
        gain.gain.setValueAtTime(0, ac.currentTime);
        gain.gain.linearRampToValueAtTime(0.18, ac.currentTime + 0.05);
        gain.gain.linearRampToValueAtTime(0, ac.currentTime + 0.4);
        osc.start(ac.currentTime);
        osc.stop(ac.currentTime + 0.42);
    });
}

/** Snus pickup — snappy energetic zap */
export function soundSnusPickup(): void {
    play((ac, dest) => {
        const freqs = [440, 660, 880, 1100];
        const offsets = [0, 0.04, 0.08, 0.12];
        freqs.forEach((freq, i) => {
            const osc = ac.createOscillator();
            const gain = ac.createGain();
            osc.connect(gain);
            gain.connect(dest);
            osc.type = 'square';
            osc.frequency.setValueAtTime(freq, ac.currentTime + offsets[i]);
            osc.frequency.exponentialRampToValueAtTime(freq * 1.5, ac.currentTime + offsets[i] + 0.07);
            const t = ac.currentTime + offsets[i];
            gain.gain.setValueAtTime(0, t);
            gain.gain.linearRampToValueAtTime(i === 3 ? 0.18 : 0.12, t + 0.004);
            gain.gain.linearRampToValueAtTime(0, t + 0.12);
            osc.start(t);
            osc.stop(t + 0.14);
        });
    });
}

/** Game end lose */
export function soundFarmLose(): void {
    play((ac, dest) => {
        const osc = ac.createOscillator();
        const gain = ac.createGain();
        osc.connect(gain);
        gain.connect(dest);
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(330, ac.currentTime);
        osc.frequency.setValueAtTime(247, ac.currentTime + 0.15);
        osc.frequency.setValueAtTime(196, ac.currentTime + 0.32);
        osc.frequency.setValueAtTime(147, ac.currentTime + 0.5);
        envelope(gain, ac, 0.005, 0.08, 0.3, 0.4, 0.2);
        osc.start(ac.currentTime);
        osc.stop(ac.currentTime + 0.95);
    });
}
