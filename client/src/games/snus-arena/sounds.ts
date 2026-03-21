import { play, envelope } from '../audio';

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
