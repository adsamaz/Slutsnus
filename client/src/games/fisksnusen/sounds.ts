import { play, envelope, getAudioCtx, getDestination } from '../audio';
import mmSound from '../../assets/sound/mm.m4a';
import sagdetinteSound from '../../assets/sound/sagdetinte.m4a';

export function soundCast(): void {
    play((ac, dest) => {
        // Swish: falling bandpass noise
        const buf = ac.createBuffer(1, ac.sampleRate * 0.4, ac.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1);
        const src = ac.createBufferSource();
        src.buffer = buf;
        const filter = ac.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(800, ac.currentTime);
        filter.frequency.linearRampToValueAtTime(200, ac.currentTime + 0.35);
        filter.Q.value = 2;
        const g = ac.createGain();
        envelope(g, ac, 0.01, 0.1, 0.3, 0.25, 0.18);
        src.connect(filter);
        filter.connect(g);
        g.connect(dest);
        src.start();
        src.stop(ac.currentTime + 0.4);

        // Plop at the end
        setTimeout(() => play((ac2, dest2) => {
            const osc = ac2.createOscillator();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(250, ac2.currentTime);
            osc.frequency.linearRampToValueAtTime(80, ac2.currentTime + 0.12);
            const g2 = ac2.createGain();
            envelope(g2, ac2, 0.005, 0.05, 0.0, 0.08, 0.3);
            osc.connect(g2);
            g2.connect(dest2);
            osc.start();
            osc.stop(ac2.currentTime + 0.18);
        }), 320);
    });
}

export function soundNibble(): void {
    play((ac, dest) => {
        const osc = ac.createOscillator();
        osc.type = 'triangle';
        osc.frequency.value = 380;
        osc.frequency.linearRampToValueAtTime(280, ac.currentTime + 0.07);
        const g = ac.createGain();
        envelope(g, ac, 0.005, 0.03, 0.0, 0.04, 0.22);
        osc.connect(g);
        g.connect(dest);
        osc.start();
        osc.stop(ac.currentTime + 0.08);
    });
}

export function soundBiteAlert(): void {
    play((ac, dest) => {
        // Low sawtooth hit
        const osc = ac.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.value = 110;
        const g = ac.createGain();
        envelope(g, ac, 0.01, 0.08, 0.2, 0.25, 0.35);
        osc.connect(g);
        g.connect(dest);
        osc.start();
        osc.stop(ac.currentTime + 0.45);

        // High ping
        const osc2 = ac.createOscillator();
        osc2.type = 'sine';
        osc2.frequency.value = 880;
        const g2 = ac.createGain();
        envelope(g2, ac, 0.005, 0.05, 0.0, 0.15, 0.2);
        osc2.connect(g2);
        g2.connect(dest);
        osc2.start();
        osc2.stop(ac.currentTime + 0.25);
    });
}

export function soundBoatAlert(): void {
    play((ac, dest) => {
        const osc = ac.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.value = 140;
        const g = ac.createGain();
        envelope(g, ac, 0.008, 0.06, 0.15, 0.18, 0.3);
        osc.connect(g);
        g.connect(dest);
        osc.start();
        osc.stop(ac.currentTime + 0.35);

        const osc2 = ac.createOscillator();
        osc2.type = 'sine';
        osc2.frequency.value = 1100;
        const g2 = ac.createGain();
        envelope(g2, ac, 0.005, 0.04, 0.0, 0.1, 0.18);
        osc2.connect(g2);
        g2.connect(dest);
        osc2.start();
        osc2.stop(ac.currentTime + 0.18);
    });
}

export function soundSnusAlert(): void {
    play((ac, dest) => {
        const osc = ac.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = 440;
        // Tremolo via LFO
        const lfo = ac.createOscillator();
        lfo.type = 'sine';
        lfo.frequency.value = 8;
        const lfoGain = ac.createGain();
        lfoGain.gain.value = 15;
        lfo.connect(lfoGain);
        lfoGain.connect(osc.frequency);
        const g = ac.createGain();
        envelope(g, ac, 0.02, 0.1, 0.5, 0.3, 0.22);
        osc.connect(g);
        g.connect(dest);
        lfo.start();
        osc.start();
        osc.stop(ac.currentTime + 0.55);
        lfo.stop(ac.currentTime + 0.55);
    });
}

export function soundReelClick(): void {
    play((ac, dest) => {
        const buf = ac.createBuffer(1, Math.floor(ac.sampleRate * 0.05), ac.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
        const src = ac.createBufferSource();
        src.buffer = buf;
        const filter = ac.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 2000;
        const g = ac.createGain();
        g.gain.value = 0.4;
        src.connect(filter);
        filter.connect(g);
        g.connect(dest);
        src.start();
    });
}

export function soundReelMiss(): void {
    play((ac, dest) => {
        const osc = ac.createOscillator();
        osc.type = 'square';
        osc.frequency.value = 600;
        osc.frequency.linearRampToValueAtTime(200, ac.currentTime + 0.1);
        const g = ac.createGain();
        envelope(g, ac, 0.005, 0.04, 0.0, 0.06, 0.15);
        osc.connect(g);
        g.connect(dest);
        osc.start();
        osc.stop(ac.currentTime + 0.12);
    });
}

export function soundStrikePerfect(): void {
    play((ac, dest) => {
        // Short bright arpeggio: D4–F#4–A4
        const freqs = [293.66, 369.99, 440.00];
        freqs.forEach((freq, i) => {
            const osc = ac.createOscillator();
            osc.type = 'triangle';
            osc.frequency.value = freq;
            const g = ac.createGain();
            const t = ac.currentTime + i * 0.08;
            g.gain.setValueAtTime(0, t);
            g.gain.linearRampToValueAtTime(0.28, t + 0.015);
            g.gain.linearRampToValueAtTime(0, t + 0.12);
            osc.connect(g);
            g.connect(dest);
            osc.start(t);
            osc.stop(t + 0.15);
        });
    });
}

export function soundStrikeGood(): void {
    play((ac, dest) => {
        [330, 440].forEach((freq, i) => {
            const osc = ac.createOscillator();
            osc.type = 'triangle';
            osc.frequency.value = freq;
            const g = ac.createGain();
            const t = ac.currentTime + i * 0.09;
            g.gain.setValueAtTime(0, t);
            g.gain.linearRampToValueAtTime(0.22, t + 0.01);
            g.gain.linearRampToValueAtTime(0, t + 0.1);
            osc.connect(g);
            g.connect(dest);
            osc.start(t);
            osc.stop(t + 0.12);
        });
    });
}

export function soundStrikeMiss(): void {
    play((ac, dest) => {
        [220, 165, 110].forEach((freq, i) => {
            const osc = ac.createOscillator();
            osc.type = 'square';
            osc.frequency.value = freq;
            const g = ac.createGain();
            const t = ac.currentTime + i * 0.10;
            g.gain.setValueAtTime(0, t);
            g.gain.linearRampToValueAtTime(0.12, t + 0.01);
            g.gain.linearRampToValueAtTime(0, t + 0.09);
            osc.connect(g);
            g.connect(dest);
            osc.start(t);
            osc.stop(t + 0.12);
        });
    });
}

export function soundFishEscape(): void {
    play((ac, dest) => {
        const buf = ac.createBuffer(1, ac.sampleRate * 0.4, ac.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1);
        const src = ac.createBufferSource();
        src.buffer = buf;
        const filter = ac.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(600, ac.currentTime);
        filter.frequency.linearRampToValueAtTime(80, ac.currentTime + 0.4);
        filter.Q.value = 1.5;
        const g = ac.createGain();
        g.gain.setValueAtTime(0.2, ac.currentTime);
        g.gain.linearRampToValueAtTime(0, ac.currentTime + 0.4);
        src.connect(filter);
        filter.connect(g);
        g.connect(dest);
        src.start();
        src.stop(ac.currentTime + 0.4);
    });
}

export function soundPerfektFiskesnus(): void {
    play((ac, dest) => {
        // D major arpeggio: D4 F#4 A4 D5
        const freqs = [293.66, 369.99, 440.00, 587.33];
        freqs.forEach((freq, i) => {
            const osc = ac.createOscillator();
            osc.type = 'triangle';
            osc.frequency.value = freq;
            const g = ac.createGain();
            const t = ac.currentTime + i * 0.1;
            g.gain.setValueAtTime(0, t);
            g.gain.linearRampToValueAtTime(0.3, t + 0.015);
            g.gain.linearRampToValueAtTime(0, t + 0.15);
            osc.connect(g);
            g.connect(dest);
            osc.start(t);
            osc.stop(t + 0.18);
        });

        // G major chord: G4 B4 D5
        const chordStart = ac.currentTime + 0.5;
        [392.00, 493.88, 587.33].forEach(freq => {
            const osc = ac.createOscillator();
            osc.type = 'triangle';
            osc.frequency.value = freq;
            const g = ac.createGain();
            g.gain.setValueAtTime(0, chordStart);
            g.gain.linearRampToValueAtTime(0.18, chordStart + 0.04);
            g.gain.setValueAtTime(0.18, chordStart + 0.5);
            g.gain.linearRampToValueAtTime(0, chordStart + 0.9);
            osc.connect(g);
            g.connect(dest);
            osc.start(chordStart);
            osc.stop(chordStart + 0.95);
        });

        // Snus snap click
        const snapAt = ac.currentTime + 0.48;
        const buf = ac.createBuffer(1, Math.floor(ac.sampleRate * 0.03), ac.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
        const src = ac.createBufferSource();
        src.buffer = buf;
        const g2 = ac.createGain();
        g2.gain.value = 0.5;
        src.connect(g2);
        g2.connect(dest);
        src.start(snapAt);
    });
}

export function soundNo(): void {
    play((ac, dest) => {
        // Descending groan: "no!" effect
        const osc = ac.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(320, ac.currentTime);
        osc.frequency.linearRampToValueAtTime(160, ac.currentTime + 0.18);
        const g = ac.createGain();
        envelope(g, ac, 0.01, 0.06, 0.0, 0.12, 0.2);
        osc.connect(g);
        g.connect(dest);
        osc.start();
        osc.stop(ac.currentTime + 0.22);

        // Second drop
        const osc2 = ac.createOscillator();
        osc2.type = 'sawtooth';
        osc2.frequency.setValueAtTime(240, ac.currentTime + 0.14);
        osc2.frequency.linearRampToValueAtTime(100, ac.currentTime + 0.38);
        const g2 = ac.createGain();
        g2.gain.setValueAtTime(0, ac.currentTime + 0.14);
        g2.gain.linearRampToValueAtTime(0.18, ac.currentTime + 0.18);
        g2.gain.linearRampToValueAtTime(0, ac.currentTime + 0.4);
        osc2.connect(g2);
        g2.connect(dest);
        osc2.start(ac.currentTime + 0.14);
        osc2.stop(ac.currentTime + 0.42);
    });
}

export function soundStuckInTree(): void {
    play((ac, dest) => {
        const first = new Audio(mmSound);
        const source = ac.createMediaElementSource(first);
        const gain = ac.createGain();
        gain.gain.setValueAtTime(6.0, ac.currentTime);
        source.connect(gain);
        gain.connect(dest);
        first.play().catch(() => { });
        first.addEventListener('ended', () => {
            const second = new Audio(sagdetinteSound);
            second.play().catch(() => { });
        }, { once: true });
    });
}

export function soundSnusInWater(): void {
    play((ac, dest) => {
        const osc = ac.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(180, ac.currentTime);
        osc.frequency.linearRampToValueAtTime(80, ac.currentTime + 0.25);
        const g = ac.createGain();
        envelope(g, ac, 0.005, 0.08, 0.0, 0.18, 0.22);
        osc.connect(g);
        g.connect(dest);
        osc.start();
        osc.stop(ac.currentTime + 0.3);
    });
}

export function soundGameWin(): void {
    play((ac, dest) => {
        [261.63, 329.63, 392.00, 523.25, 659.25, 783.99].forEach((freq, i) => {
            const osc = ac.createOscillator();
            osc.type = 'triangle';
            osc.frequency.value = freq;
            const g = ac.createGain();
            const t = ac.currentTime + i * 0.09;
            g.gain.setValueAtTime(0, t);
            g.gain.linearRampToValueAtTime(0.25, t + 0.01);
            g.gain.linearRampToValueAtTime(0.1, t + 0.1);
            g.gain.linearRampToValueAtTime(0, t + 0.25);
            osc.connect(g);
            g.connect(dest);
            osc.start(t);
            osc.stop(t + 0.28);
        });
    });
}

export function soundGameLose(): void {
    play((ac, dest) => {
        [440.00, 392.00, 329.63, 261.63].forEach((freq, i) => {
            const osc = ac.createOscillator();
            osc.type = 'sawtooth';
            osc.frequency.value = freq;
            const g = ac.createGain();
            const t = ac.currentTime + i * 0.11;
            g.gain.setValueAtTime(0, t);
            g.gain.linearRampToValueAtTime(0.15, t + 0.02);
            g.gain.linearRampToValueAtTime(0, t + 0.12);
            osc.connect(g);
            g.connect(dest);
            osc.start(t);
            osc.stop(t + 0.15);
        });
    });
}

// ─── Background ambient music ────────────────────
let bgInterval: ReturnType<typeof setInterval> | null = null;
let bgStep = 0;
const STEP_MS = 1600;

type BgStep = { bass: number; chord: number[]; mel: number };

// 16-step progression in A minor — every step is a different chord, including wrap-around
// bass: low sine Hz, chord: pad tones Hz[], mel: melody note Hz
const BG_PROG: BgStep[] = [
    // Section A: Am–F–G–Em  (ascending melody A4→F4→G4→B4)
    { bass: 110.00, chord: [220.00, 261.63, 329.63], mel: 440.00 },  // Am  – A4
    { bass: 87.31, chord: [174.61, 220.00, 261.63], mel: 349.23 },  // F   – F4
    { bass: 98.00, chord: [196.00, 246.94, 293.66], mel: 392.00 },  // G   – G4
    { bass: 82.41, chord: [164.81, 196.00, 246.94], mel: 493.88 },  // Em  – B4
    // Section B: C–Dm–Am–G  (descending G4→F4→E4→D4)
    { bass: 130.81, chord: [261.63, 329.63, 392.00], mel: 392.00 },  // C   – G4
    { bass: 73.42, chord: [146.83, 174.61, 220.00], mel: 349.23 },  // Dm  – F4
    { bass: 110.00, chord: [220.00, 261.63, 329.63], mel: 329.63 },  // Am  – E4
    { bass: 98.00, chord: [196.00, 246.94, 293.66], mel: 293.66 },  // G   – D4
    // Section C: F–C–Dm–E  (builds F4→E4→A4→B4)
    { bass: 87.31, chord: [174.61, 220.00, 261.63], mel: 349.23 },  // F   – F4
    { bass: 130.81, chord: [261.63, 329.63, 392.00], mel: 329.63 },  // C   – E4
    { bass: 73.42, chord: [146.83, 174.61, 220.00], mel: 440.00 },  // Dm  – A4
    { bass: 82.41, chord: [164.81, 207.65, 246.94], mel: 493.88 },  // E   – B4 tension
    // Section D: Am–G–F–Em  (C5 peak then resolves C5→B4→A4→E4)
    { bass: 110.00, chord: [220.00, 261.63, 329.63], mel: 523.25 },  // Am  – C5 peak
    { bass: 98.00, chord: [196.00, 246.94, 293.66], mel: 493.88 },  // G   – B4
    { bass: 87.31, chord: [174.61, 220.00, 261.63], mel: 440.00 },  // F   – A4
    { bass: 82.41, chord: [164.81, 196.00, 246.94], mel: 329.63 },  // Em  – E4 → loops to Am ✓
];

export function startBgMusic(): void {
    if (bgInterval !== null) return;
    bgStep = 0;
    playBgStep();
    bgInterval = setInterval(() => {
        bgStep = (bgStep + 1) % BG_PROG.length;
        playBgStep();
    }, STEP_MS);
}

function playBgStep(): void {
    const step = BG_PROG[bgStep];
    play((ac, dest) => {
        const now = ac.currentTime;
        const dur = STEP_MS / 1000;

        // Bass: soft sine
        const bassOsc = ac.createOscillator();
        bassOsc.type = 'sine';
        bassOsc.frequency.value = step.bass;
        const bassGain = ac.createGain();
        bassGain.gain.setValueAtTime(0, now);
        bassGain.gain.linearRampToValueAtTime(0.12, now + 0.08);
        bassGain.gain.setValueAtTime(0.12, now + dur * 0.65);
        bassGain.gain.linearRampToValueAtTime(0, now + dur * 0.95);
        bassOsc.connect(bassGain);
        bassGain.connect(dest);
        bassOsc.start(now);
        bassOsc.stop(now + dur);

        // Chord pad: triangle
        step.chord.forEach(freq => {
            const osc = ac.createOscillator();
            osc.type = 'triangle';
            osc.frequency.value = freq;
            const g = ac.createGain();
            g.gain.setValueAtTime(0, now);
            g.gain.linearRampToValueAtTime(0.035, now + 0.15);
            g.gain.setValueAtTime(0.035, now + dur * 0.72);
            g.gain.linearRampToValueAtTime(0, now + dur * 0.96);
            osc.connect(g);
            g.connect(dest);
            osc.start(now);
            osc.stop(now + dur);
        });

        // Melody: sine pluck with natural decay
        if (step.mel > 0) {
            const t = now + 0.05;
            const mel = ac.createOscillator();
            mel.type = 'sine';
            mel.frequency.value = step.mel;
            const melGain = ac.createGain();
            melGain.gain.setValueAtTime(0, t);
            melGain.gain.linearRampToValueAtTime(0.09, t + 0.04);
            melGain.gain.exponentialRampToValueAtTime(0.001, t + 1.1);
            mel.connect(melGain);
            melGain.connect(dest);
            mel.start(t);
            mel.stop(t + 1.15);
        }
    });
}

export function stopBgMusic(): void {
    if (bgInterval !== null) {
        clearInterval(bgInterval);
        bgInterval = null;
    }
    bgStep = 0;
}
