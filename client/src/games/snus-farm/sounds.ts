import { play, envelope } from '../audio';

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
