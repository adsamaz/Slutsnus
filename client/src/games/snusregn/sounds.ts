let ctx: AudioContext | null = null;

function getCtx(): AudioContext {
    if (!ctx) ctx = new AudioContext();
    // Resume if suspended (browser autoplay policy)
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
}

function play(fn: (ac: AudioContext) => void): void {
    try { fn(getCtx()); } catch { /* ignore if audio unavailable */ }
}

function envelope(gain: GainNode, ac: AudioContext, attack: number, decay: number, sustain: number, release: number, peak = 0.4): void {
    const now = ac.currentTime;
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(peak, now + attack);
    gain.gain.linearRampToValueAtTime(sustain * peak, now + attack + decay);
    gain.gain.setValueAtTime(sustain * peak, now + attack + decay);
    gain.gain.linearRampToValueAtTime(0, now + attack + decay + release);
}

/** Fresh snus caught — smooth mellow pop */
export function soundFreshCatch(): void {
    play(ac => {
        const osc = ac.createOscillator();
        const gain = ac.createGain();
        osc.connect(gain);
        gain.connect(ac.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(330, ac.currentTime);
        osc.frequency.exponentialRampToValueAtTime(260, ac.currentTime + 0.12);
        envelope(gain, ac, 0.01, 0.08, 0, 0.12, 0.28);
        osc.start(ac.currentTime);
        osc.stop(ac.currentTime + 0.25);
    });
}

/** Fresh snus caught with beer (×3) — warm double chime */
export function soundFreshCatchBeer(): void {
    play(ac => {
        const osc = ac.createOscillator();
        const osc2 = ac.createOscillator();
        const gain = ac.createGain();
        osc.connect(gain);
        osc2.connect(gain);
        gain.connect(ac.destination);
        osc.type = 'sine';
        osc2.type = 'sine';
        osc.frequency.setValueAtTime(440, ac.currentTime);
        osc.frequency.exponentialRampToValueAtTime(350, ac.currentTime + 0.15);
        osc2.frequency.setValueAtTime(550, ac.currentTime);
        osc2.frequency.exponentialRampToValueAtTime(440, ac.currentTime + 0.15);
        envelope(gain, ac, 0.01, 0.1, 0, 0.15, 0.2);
        osc.start(ac.currentTime);
        osc2.start(ac.currentTime);
        osc.stop(ac.currentTime + 0.3);
        osc2.stop(ac.currentTime + 0.3);
    });
}

/** Spent snus caught — dull low thud */
export function soundSpentCatch(): void {
    play(ac => {
        const osc = ac.createOscillator();
        const gain = ac.createGain();
        osc.connect(gain);
        gain.connect(ac.destination);
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(120, ac.currentTime);
        osc.frequency.exponentialRampToValueAtTime(60, ac.currentTime + 0.15);
        envelope(gain, ac, 0.002, 0.08, 0, 0.1, 0.3);
        osc.start(ac.currentTime);
        osc.stop(ac.currentTime + 0.22);
    });
}

/** Missed a fresh snus — life lost, descending tone */
export function soundLifeLost(): void {
    play(ac => {
        const osc = ac.createOscillator();
        const gain = ac.createGain();
        osc.connect(gain);
        gain.connect(ac.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(220, ac.currentTime);
        osc.frequency.exponentialRampToValueAtTime(110, ac.currentTime + 0.25);
        envelope(gain, ac, 0.002, 0.1, 0.3, 0.2, 0.3);
        osc.start(ac.currentTime);
        osc.stop(ac.currentTime + 0.55);
    });
}

/** Powerup caught (wideBar, slowRain, beer) — rising shimmer */
export function soundPowerup(): void {
    play(ac => {
        const osc = ac.createOscillator();
        const gain = ac.createGain();
        osc.connect(gain);
        gain.connect(ac.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(220, ac.currentTime);
        osc.frequency.exponentialRampToValueAtTime(440, ac.currentTime + 0.15);
        envelope(gain, ac, 0.002, 0.05, 0.2, 0.15, 0.3);
        osc.start(ac.currentTime);
        osc.stop(ac.currentTime + 0.35);
    });
}

/** Debuff caught (fastRain, shrinkBar, blind) — discordant blip */
export function soundDebuff(): void {
    play(ac => {
        const osc = ac.createOscillator();
        const gain = ac.createGain();
        osc.connect(gain);
        gain.connect(ac.destination);
        osc.type = 'square';
        osc.frequency.setValueAtTime(100, ac.currentTime);
        osc.frequency.setValueAtTime(75, ac.currentTime + 0.04);
        osc.frequency.setValueAtTime(90, ac.currentTime + 0.08);
        envelope(gain, ac, 0.002, 0.03, 0, 0.12, 0.2);
        osc.start(ac.currentTime);
        osc.stop(ac.currentTime + 0.18);
    });
}
