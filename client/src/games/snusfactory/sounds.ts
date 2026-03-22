import { play, envelope, getAudioCtx, getDestination } from '../audio';

// ── Background music ──────────────────────────────────────────────────────────
// A catchy factory jingle: driving bassline + melodic lead + hi-hat rhythm

let bgMusicNodes: AudioNode[] = [];
let bgMusicActive = false;

/** 16-step sequencer at a given BPM. Returns a list of nodes to stop/disconnect. */
function buildFactoryMusic(ac: AudioContext, dest: AudioNode): AudioNode[] {
    const nodes: AudioNode[] = [];
    const bpm = 128;
    const step = 60 / bpm / 4; // 16th note

    // Master gain for music (kept low vs SFX)
    const musicGain = ac.createGain();
    musicGain.gain.setValueAtTime(0.09, ac.currentTime);
    musicGain.connect(dest);
    nodes.push(musicGain);

    // Soft high-pass filter for music channel
    const hpf = ac.createBiquadFilter();
    hpf.type = 'highpass';
    hpf.frequency.value = 80;
    hpf.connect(musicGain);
    nodes.push(hpf);

    const totalSteps = 256; // 16-bar loop (~30s at 128bpm)
    const loopDuration = totalSteps * step;

    // ── Bassline: 4 sections × 16 steps ─────────────────────────────────────
    // Section A — root bounce (D2, A2, G2)
    const bassA: Array<{ freq: number; len: number } | null> = [
        { freq: 73.4, len: 1 }, null, { freq: 73.4, len: 1 }, null,
        { freq: 110,  len: 1 }, null, { freq: 98,   len: 1 }, null,
        { freq: 73.4, len: 1 }, null, { freq: 87.3, len: 1 }, null,
        { freq: 73.4, len: 1 }, null, { freq: 110,  len: 1 }, { freq: 98, len: 1 },
    ];
    // Section B — descending walk
    const bassB: Array<{ freq: number; len: number } | null> = [
        { freq: 110,  len: 2 }, null, null, null,
        { freq: 98,   len: 2 }, null, null, null,
        { freq: 87.3, len: 2 }, null, null, null,
        { freq: 73.4, len: 2 }, null, null, null,
    ];
    // Section C — syncopated pump
    const bassC: Array<{ freq: number; len: number } | null> = [
        { freq: 73.4, len: 1 }, null, null, { freq: 73.4, len: 1 },
        null, { freq: 110, len: 1 }, null, null,
        { freq: 98,   len: 1 }, null, null, { freq: 87.3, len: 1 },
        null, { freq: 73.4, len: 1 }, null, null,
    ];
    // Section D — high energy repeat of A with extra hits
    const bassD: Array<{ freq: number; len: number } | null> = [
        { freq: 73.4, len: 1 }, null, { freq: 73.4, len: 1 }, { freq: 73.4, len: 1 },
        { freq: 110,  len: 1 }, null, { freq: 98,   len: 1 }, null,
        { freq: 73.4, len: 1 }, { freq: 73.4, len: 1 }, { freq: 87.3, len: 1 }, null,
        { freq: 73.4, len: 1 }, null, { freq: 110,  len: 1 }, { freq: 73.4, len: 1 },
    ];
    // Full 64-step bassline: A A B A  A C D A (128 steps each repeated once = 256 steps)
    const fullBass: Array<{ freq: number; len: number } | null> = [
        ...bassA, ...bassA, ...bassB, ...bassA,
        ...bassA, ...bassC, ...bassD, ...bassA,
        ...bassA, ...bassA, ...bassB, ...bassA,
        ...bassA, ...bassC, ...bassD, ...bassA,
    ];

    // ── Melody: 4 sections × 32 steps ────────────────────────────────────────
    // D minor pentatonic: D4=293.7, F4=349.2, G4=392, A4=440, C5=523.3, D5=587.3
    // Section 1 — intro hook (original)
    const melA: Array<{ freq: number; len: number } | null> = [
        { freq: 293.7, len: 1 }, null, null, null,
        { freq: 349.2, len: 1 }, null, { freq: 392,   len: 1 }, null,
        { freq: 440,   len: 1 }, null, { freq: 392,   len: 2 }, null,
        null, null, { freq: 349.2, len: 1 }, null,

        { freq: 293.7, len: 1 }, null, { freq: 349.2, len: 1 }, null,
        { freq: 523.3, len: 1 }, null, { freq: 440,   len: 2 }, null,
        null, { freq: 392,   len: 1 }, null, { freq: 349.2, len: 1 },
        { freq: 293.7, len: 2 }, null, null, null,
    ];
    // Section 2 — ascending run, higher range
    const melB: Array<{ freq: number; len: number } | null> = [
        { freq: 349.2, len: 1 }, null, { freq: 392,   len: 1 }, null,
        { freq: 440,   len: 1 }, null, { freq: 523.3, len: 1 }, null,
        { freq: 587.3, len: 2 }, null, null, { freq: 523.3, len: 1 },
        null, { freq: 440, len: 1 }, null, null,

        { freq: 392,   len: 1 }, null, { freq: 440,   len: 1 }, null,
        { freq: 523.3, len: 2 }, null, null, null,
        { freq: 587.3, len: 1 }, null, { freq: 523.3, len: 1 }, null,
        { freq: 440,   len: 2 }, null, null, null,
    ];
    // Section 3 — sparse, builds tension
    const melC: Array<{ freq: number; len: number } | null> = [
        { freq: 440,   len: 4 }, null, null, null,
        null, null, null, null,
        { freq: 392,   len: 4 }, null, null, null,
        null, null, null, null,

        { freq: 349.2, len: 2 }, null, null, { freq: 392, len: 1 },
        null, { freq: 440, len: 1 }, null, null,
        { freq: 523.3, len: 2 }, null, null, null,
        { freq: 440,   len: 2 }, null, null, null,
    ];
    // Section 4 — energetic payoff
    const melD: Array<{ freq: number; len: number } | null> = [
        { freq: 587.3, len: 1 }, null, { freq: 523.3, len: 1 }, null,
        { freq: 440,   len: 1 }, null, { freq: 392,   len: 1 }, null,
        { freq: 349.2, len: 1 }, null, { freq: 293.7, len: 2 }, null,
        null, null, null, null,

        { freq: 293.7, len: 1 }, null, { freq: 349.2, len: 1 }, null,
        { freq: 392,   len: 1 }, null, { freq: 440,   len: 1 }, null,
        { freq: 523.3, len: 1 }, null, { freq: 587.3, len: 2 }, null,
        null, null, null, null,
    ];
    // Full 128-step melody: A B C D  A B C D (mirrors 256-step bass)
    const fullMel: Array<{ freq: number; len: number } | null> = [
        ...melA, ...melB, ...melC, ...melD,
        ...melA, ...melB, ...melC, ...melD,
    ];

    // ── Chord pad: stabs across all 256 steps ────────────────────────────────
    const chordPattern: number[] = [];
    for (let i = 0; i < totalSteps; i += 4) chordPattern.push(i);
    const chordFreqs = [
        [146.8, 220, 293.7], // Dm
        [130.8, 196, 261.6], // Cm
        [146.8, 196, 246.9], // Dm/A
        [130.8, 174.6, 220], // Cm/G
    ];

    // Schedule enough loops to fill ~5 minutes
    const maxLoops = Math.ceil(300 / loopDuration);

    for (let loop = 0; loop < maxLoops; loop++) {
        const loopStart = ac.currentTime + loop * loopDuration;

        // Bass
        for (let i = 0; i < fullBass.length; i++) {
            const note = fullBass[i];
            if (!note) continue;
            const t = loopStart + i * step;
            const osc = ac.createOscillator();
            const g = ac.createGain();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(note.freq, t);
            g.gain.setValueAtTime(0, t);
            g.gain.linearRampToValueAtTime(0.1, t + 0.005);
            g.gain.setValueAtTime(0.1, t + step * note.len * 0.7);
            g.gain.linearRampToValueAtTime(0, t + step * note.len * 0.9);
            osc.connect(g); g.connect(hpf);
            osc.start(t); osc.stop(t + step * note.len + 0.01);
            nodes.push(osc, g);
        }

        // Melody
        for (let i = 0; i < fullMel.length; i++) {
            const note = fullMel[i];
            if (!note) continue;
            const t = loopStart + i * step;
            const osc = ac.createOscillator();
            const g = ac.createGain();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(note.freq, t);
            g.gain.setValueAtTime(0, t);
            g.gain.linearRampToValueAtTime(0.45, t + 0.008);
            g.gain.setValueAtTime(0.45, t + step * note.len * 0.6);
            g.gain.linearRampToValueAtTime(0, t + step * note.len * 0.85);
            osc.connect(g); g.connect(hpf);
            osc.start(t); osc.stop(t + step * note.len + 0.01);
            nodes.push(osc, g);
        }

        // Chord stabs
        for (let ci = 0; ci < chordPattern.length; ci++) {
            const stab = chordPattern[ci];
            const freqs = chordFreqs[ci % chordFreqs.length];
            const t = loopStart + stab * step;
            for (const freq of freqs) {
                const osc = ac.createOscillator();
                const g = ac.createGain();
                osc.type = 'square';
                osc.frequency.setValueAtTime(freq, t);
                g.gain.setValueAtTime(0, t);
                g.gain.linearRampToValueAtTime(0.12, t + 0.004);
                g.gain.linearRampToValueAtTime(0, t + step * 1.5);
                osc.connect(g); g.connect(hpf);
                osc.start(t); osc.stop(t + step * 2);
                nodes.push(osc, g);
            }
        }

        // Hi-hat: every 2 steps (8th note clicks)
        for (let i = 0; i < totalSteps; i++) {
            if (i % 2 !== 0) continue;
            const t = loopStart + i * step;
            const buf = ac.createBuffer(1, Math.ceil(ac.sampleRate * 0.03), ac.sampleRate);
            const data = buf.getChannelData(0);
            for (let s = 0; s < data.length; s++) data[s] = (Math.random() * 2 - 1);
            const src = ac.createBufferSource();
            src.buffer = buf;
            const g = ac.createGain();
            const accent = (i % 8 === 0) ? 0.18 : 0.08;
            g.gain.setValueAtTime(accent, t);
            g.gain.linearRampToValueAtTime(0, t + 0.025);
            const hhf = ac.createBiquadFilter();
            hhf.type = 'highpass';
            hhf.frequency.value = 8000;
            src.connect(hhf); hhf.connect(g); g.connect(musicGain);
            src.start(t); src.stop(t + 0.03);
            nodes.push(src, g, hhf);
        }

        // Kick: steps 0, 8, 12 (driving 4-on-the-floor-ish)
        for (const kick of [0, 8, 12]) {
            const t = loopStart + kick * step;
            const osc = ac.createOscillator();
            const g = ac.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(160, t);
            osc.frequency.exponentialRampToValueAtTime(50, t + 0.08);
            g.gain.setValueAtTime(0.7, t);
            g.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
            osc.connect(g); g.connect(musicGain);
            osc.start(t); osc.stop(t + 0.16);
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
        bgMusicNodes = buildFactoryMusic(ac, dest);
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

/** Pick up any item — crisp click with pitch rise */
export function soundPickup(): void {
    play((ac, dest) => {
        const osc = ac.createOscillator();
        const gain = ac.createGain();
        osc.connect(gain);
        gain.connect(dest);
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(600, ac.currentTime);
        osc.frequency.exponentialRampToValueAtTime(900, ac.currentTime + 0.06);
        gain.gain.setValueAtTime(0, ac.currentTime);
        gain.gain.linearRampToValueAtTime(0.18, ac.currentTime + 0.004);
        gain.gain.linearRampToValueAtTime(0, ac.currentTime + 0.1);
        osc.start(ac.currentTime);
        osc.stop(ac.currentTime + 0.12);
    });
}

/** Plant a leaf in a patch — soft earthy thud */
export function soundPlant(): void {
    play((ac, dest) => {
        const osc = ac.createOscillator();
        const gain = ac.createGain();
        osc.connect(gain);
        gain.connect(dest);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(120, ac.currentTime);
        osc.frequency.exponentialRampToValueAtTime(60, ac.currentTime + 0.12);
        gain.gain.setValueAtTime(0, ac.currentTime);
        gain.gain.linearRampToValueAtTime(0.22, ac.currentTime + 0.008);
        gain.gain.linearRampToValueAtTime(0, ac.currentTime + 0.18);
        osc.start(ac.currentTime);
        osc.stop(ac.currentTime + 0.2);
    });
}

/** Patch ripened — gentle ascending chime */
export function soundRipe(): void {
    play((ac, dest) => {
        const freqs = [523, 659];
        const offsets = [0, 0.1];
        freqs.forEach((freq, i) => {
            const osc = ac.createOscillator();
            const gain = ac.createGain();
            osc.connect(gain);
            gain.connect(dest);
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(freq, ac.currentTime + offsets[i]);
            const t = ac.currentTime + offsets[i];
            gain.gain.setValueAtTime(0, t);
            gain.gain.linearRampToValueAtTime(i === 1 ? 0.2 : 0.14, t + 0.005);
            gain.gain.linearRampToValueAtTime(0, t + 0.22);
            osc.start(t);
            osc.stop(t + 0.24);
        });
    });
}

/** Grinder starts — sawtooth buzz ramp */
export function soundGrindStart(): void {
    play((ac, dest) => {
        const osc = ac.createOscillator();
        const gain = ac.createGain();
        osc.connect(gain);
        gain.connect(dest);
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(200, ac.currentTime);
        osc.frequency.linearRampToValueAtTime(400, ac.currentTime + 0.18);
        gain.gain.setValueAtTime(0, ac.currentTime);
        gain.gain.linearRampToValueAtTime(0.14, ac.currentTime + 0.02);
        gain.gain.linearRampToValueAtTime(0.08, ac.currentTime + 0.15);
        gain.gain.linearRampToValueAtTime(0, ac.currentTime + 0.22);
        osc.start(ac.currentTime);
        osc.stop(ac.currentTime + 0.24);
    });
}

/** Packager starts — mechanical thump */
export function soundPackageStart(): void {
    play((ac, dest) => {
        const osc = ac.createOscillator();
        const gain = ac.createGain();
        osc.connect(gain);
        gain.connect(dest);
        osc.type = 'square';
        osc.frequency.setValueAtTime(180, ac.currentTime);
        osc.frequency.exponentialRampToValueAtTime(90, ac.currentTime + 0.1);
        gain.gain.setValueAtTime(0, ac.currentTime);
        gain.gain.linearRampToValueAtTime(0.16, ac.currentTime + 0.005);
        gain.gain.linearRampToValueAtTime(0, ac.currentTime + 0.14);
        osc.start(ac.currentTime);
        osc.stop(ac.currentTime + 0.16);
    });
}

/** Order fulfilled — cash register ding */
export function soundSell(): void {
    play((ac, dest) => {
        const freqs = [880, 1047];
        const offsets = [0, 0.07];
        freqs.forEach((freq, i) => {
            const osc = ac.createOscillator();
            const gain = ac.createGain();
            osc.connect(gain);
            gain.connect(dest);
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(freq, ac.currentTime + offsets[i]);
            const t = ac.currentTime + offsets[i];
            const peak = i === 1 ? 0.22 : 0.16;
            gain.gain.setValueAtTime(0, t);
            gain.gain.linearRampToValueAtTime(peak, t + 0.005);
            gain.gain.linearRampToValueAtTime(0, t + 0.28);
            osc.start(t);
            osc.stop(t + 0.3);
        });
    });
}

/** New customer order appears — ascending two-tone ping */
export function soundNewOrder(): void {
    play((ac, dest) => {
        const freqs = [440, 554];
        const offsets = [0, 0.08];
        freqs.forEach((freq, i) => {
            const osc = ac.createOscillator();
            const gain = ac.createGain();
            osc.connect(gain);
            gain.connect(dest);
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, ac.currentTime + offsets[i]);
            const t = ac.currentTime + offsets[i];
            gain.gain.setValueAtTime(0, t);
            gain.gain.linearRampToValueAtTime(i === 1 ? 0.18 : 0.12, t + 0.005);
            gain.gain.linearRampToValueAtTime(0, t + 0.2);
            osc.start(t);
            osc.stop(t + 0.22);
        });
    });
}

/** Order expired — sad descending buzz */
export function soundOrderExpire(): void {
    play((ac, dest) => {
        const osc = ac.createOscillator();
        const gain = ac.createGain();
        osc.connect(gain);
        gain.connect(dest);
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(330, ac.currentTime);
        osc.frequency.setValueAtTime(247, ac.currentTime + 0.14);
        osc.frequency.setValueAtTime(196, ac.currentTime + 0.28);
        gain.gain.setValueAtTime(0, ac.currentTime);
        gain.gain.linearRampToValueAtTime(0.2, ac.currentTime + 0.01);
        gain.gain.setValueAtTime(0.2, ac.currentTime + 0.3);
        gain.gain.linearRampToValueAtTime(0, ac.currentTime + 0.5);
        osc.start(ac.currentTime);
        osc.stop(ac.currentTime + 0.52);
    });
}

/** Urgent time warning — pulsing beep (call once at 30s) */
export function soundTimeLow(): void {
    play((ac, dest) => {
        const pulses = [0, 0.22, 0.44];
        for (const offset of pulses) {
            const osc = ac.createOscillator();
            const gain = ac.createGain();
            osc.connect(gain);
            gain.connect(dest);
            osc.type = 'square';
            osc.frequency.setValueAtTime(880, ac.currentTime + offset);
            const t = ac.currentTime + offset;
            gain.gain.setValueAtTime(0, t);
            gain.gain.linearRampToValueAtTime(0.15, t + 0.005);
            gain.gain.linearRampToValueAtTime(0, t + 0.1);
            osc.start(t);
            osc.stop(t + 0.12);
        }
    });
}

/** Snus pouch collected — energetic fizz + rising tone */
export function soundSnusPouch(): void {
    play((ac, dest) => {
        // Fizz burst
        const buf = ac.createBuffer(1, Math.ceil(ac.sampleRate * 0.08), ac.sampleRate);
        const data = buf.getChannelData(0);
        for (let s = 0; s < data.length; s++) data[s] = (Math.random() * 2 - 1);
        const src = ac.createBufferSource();
        src.buffer = buf;
        const noiseGain = ac.createGain();
        const bpf = ac.createBiquadFilter();
        bpf.type = 'bandpass';
        bpf.frequency.value = 3000;
        noiseGain.gain.setValueAtTime(0.25, ac.currentTime);
        noiseGain.gain.linearRampToValueAtTime(0, ac.currentTime + 0.08);
        src.connect(bpf); bpf.connect(noiseGain); noiseGain.connect(dest);
        src.start(ac.currentTime); src.stop(ac.currentTime + 0.09);
        // Rising tone
        const osc = ac.createOscillator();
        const gain = ac.createGain();
        osc.connect(gain); gain.connect(dest);
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(400, ac.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1200, ac.currentTime + 0.15);
        gain.gain.setValueAtTime(0, ac.currentTime);
        gain.gain.linearRampToValueAtTime(0.22, ac.currentTime + 0.01);
        gain.gain.linearRampToValueAtTime(0, ac.currentTime + 0.18);
        osc.start(ac.currentTime);
        osc.stop(ac.currentTime + 0.2);
    });
}

/** Game end */
export function soundGameEnd(won: boolean): void {
    if (won) {
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
    } else {
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
}
