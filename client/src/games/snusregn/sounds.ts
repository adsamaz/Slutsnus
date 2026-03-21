import { play, envelope } from '../audio';

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
