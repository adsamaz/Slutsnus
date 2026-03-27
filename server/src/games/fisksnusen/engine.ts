import type { PlayerInfo, GameAction, GameResult, FiskeSnusState, FiskeSnusPlayerState, FiskePhase, FiskeStageResult, FiskeFishSize } from '@slutsnus/shared';
import type { GameEngine } from '../registry';

// ─── Constants ───────────────────────────────────
const TICK_MS = 20;
const SCORE_TO_WIN = 10;
const IDLE_TICKS = 20;
const BOT_STAGGER_TICKS = 15;

// Aiming phase
const AIMING_SWEEP_TICKS = 50;   // speed of power meter oscillation
const AIMING_TIMEOUT = 300;      // auto-cast if player doesn't act
const BOT_CAST_MIN_TICK = 20;    // bot waits at least this many ticks before casting
const BOT_CAST_MAX_TICK = 45;
const CAST_PROXIMITY_THRESHOLD = 0.3; // max distance to get a proximity bonus
const AMBIENT_FISH_COUNT = 3;   // decorative background fish
const ACTIVE_FISH_COUNT = 3;    // fish that can actually bite

const CAST_TICKS = 30;
const TREE_STUCK_EXTRA_TICKS = 125;  // ~2.5s stuck after the cast animation
const WAIT_MIN_TICKS = 80;
const WAIT_MAX_TICKS = 200;
const MAX_NIBBLES = 3;
const NIBBLE_MIN_TICKS = 15;
const NIBBLE_MAX_TICKS = 50;

// Stage 1: Bite — oscillating meter
const BITE_SWEEP_TICKS = 60;
const BITE_MISS_TIMEOUT = 180;
const BITE_PERFECT_MIN = 0.45;
const BITE_PERFECT_MAX = 0.55;
const BITE_GOOD_MIN = 0.35;
const BITE_GOOD_MAX = 0.65;

// Stage 2: Reel — balance bar mechanic
// Player must keep indicator near center (0.5) by pressing Space to nudge it back.
// Reel progress accumulates while in the good/perfect zone; danger ticks accumulate outside.
const REEL_DURATION_TICKS = 400;        // max ticks to complete reel (~8s at 50fps)
const REEL_DRIFT_SPEED = 0.006;         // how fast indicator drifts per tick
const REEL_DRIFT_CHANGE_CHANCE = 0.03;  // probability per tick of drift direction flip
const REEL_NUDGE_STRENGTH = 0.10;       // how far a Space press nudges indicator toward center
const REEL_PROGRESS_PER_TICK = 1 / 120; // in-zone ticks needed to complete reel
const REEL_DANGER_TIMEOUT = 55;         // ticks outside zone before fish escapes (~1.1s)
const REEL_PERFECT_MIN = 0.40;
const REEL_PERFECT_MAX = 0.60;
const REEL_GOOD_MIN = 0.30;
const REEL_GOOD_MAX = 0.70;

// Stage 3: Boat — oscillating meter (faster sweep)
const BOAT_TAPS_REQUIRED = 5;    // stored in player state for UI
const BOAT_SWEEP_TICKS = 45;
const BOAT_MISS_TIMEOUT = 90;
const BOAT_PERFECT_MIN = 0.45;
const BOAT_PERFECT_MAX = 0.55;
const BOAT_GOOD_MIN = 0.35;
const BOAT_GOOD_MAX = 0.65;

// Stage 4: Snus — two sub-steps
// Step 0: open the tin (oscillating arc meter)
const SNUS_OPEN_SWEEP_TICKS = 60;   // same speed as bite
const SNUS_OPEN_MISS_TIMEOUT = 180;
const SNUS_OPEN_PERFECT_MIN = 0.45;
const SNUS_OPEN_PERFECT_MAX = 0.55;
const SNUS_OPEN_GOOD_MIN = 0.35;
const SNUS_OPEN_GOOD_MAX = 0.65;
// Step 1: pop the portioner (fast rising bar, narrower window)
const SNUS_POP_PULSE_TICKS = 60;    // fill speed
const SNUS_POP_MISS_TIMEOUT = 120;
const SNUS_POP_PERFECT_MIN = 0.44;
const SNUS_POP_PERFECT_MAX = 0.56;
const SNUS_POP_GOOD_MIN = 0.38;
const SNUS_POP_GOOD_MAX = 0.62;

const RESULT_TICKS = 100;
const TRANSITION_TICKS = 45;        // ~900ms pause between phases
const TRANSITION_TICKS_SNUS = 90;   // ~1800ms pause before snus (final phase)

// Score values for leaderboard (fish caught = win condition)
// big fish = all-perfect across all stages
// medium fish = caught with at least one perfect, no miss
// small fish = caught but had a miss somewhere
const SCORE_BIG_FISH = 3;
const SCORE_MEDIUM_FISH = 2;
const SCORE_SMALL_FISH = 1;

// ─── Internal types ───────────────────────────────
interface AmbientFish {
    x: number;        // 0–1 horizontal position
    y: number;        // 0–1 depth
    vx: number;       // velocity per tick
    vy: number;
    dir: number;      // 1=facing right, -1=facing left
    canBite: boolean; // true = can be hooked; false = purely decorative
    approaching: boolean; // true while swimming toward the hook (frozen in ambient pool, rendered separately)
}

interface PlayerInternal {
    userId: string;
    username: string;
    isBot: boolean;
    fishCaught: number;
    totalScore: number;
    phase: FiskePhase;
    phaseTick: number;        // ticks elapsed in current phase
    phaseDuration: number;    // total ticks for phases with fixed duration

    // Meter state
    meterValue: number;
    meterDirection: 1 | -1;
    meterSweepTicks: number;  // configurable sweep speed
    meterMissTimeout: number;

    // Boat phase (tap/mash mechanic)
    boatTapsCompleted: number;
    boatTapsRequired: number;
    boatLastTapTick: number;

    // Reel state (balance bar mechanic)
    reelProgress: number;       // 0–1, accumulates while in zone
    reelBarPosition: number;    // 0–1, 0.5=center; drifts away, player nudges back
    reelDriftDir: 1 | -1;       // current drift direction
    reelDangerTicks: number;    // ticks spent outside safe zone
    reelPerfectTicks: number;   // ticks spent in perfect zone (for result quality)

    // Fish approach
    fishApproachProgress: number;
    approachFishStartX: number;  // 0–1 position of the attracted fish when it started swimming
    approachFishStartY: number;
    approachFishIdx: number;     // index in ambientFish of the fish swimming toward hook (-1 = none)
    nibbleCount: number;
    nibblesPlanned: number;
    nibblesFired: number;
    fishDepth: number;

    // Per-fish stage results
    stageResults: FiskeStageResult[];
    lastStageResult: FiskeStageResult;
    lastFishSize: FiskeFishSize;
    caughtFishSizes: FiskeFishSize[];

    // Cast position (set when player casts)
    castX: number;
    castDepth: number;

    // For cast animation
    castProgress: number;

    consecutivePerfects: number;

    // Snus sub-step (0=open tin, 1=pop portioner)
    snusStep: 0 | 1;
    snusOpenResult: FiskeStageResult;

    // Ambient fish swimming around
    ambientFish: AmbientFish[];

    // Transition phase
    transitionTarget: FiskePhase | null;

    // Bot AI
    botStrikeScheduledTick: number | null;
    botCastTick: number;         // tick at which bot will cast during aiming
    botTargetCastX: number;     // horizontal position bot will cast toward
    botTargetDepth: number;     // depth bot will try to time the meter for

    // Tree stuck: tick count at which the stuck state ends (0 = not stuck)
    treeStuckUntilTick: number;
}

function rand(min: number, max: number): number {
    return min + Math.random() * (max - min);
}

function randInt(min: number, max: number): number {
    return Math.floor(rand(min, max + 1));
}

function makeFish(canBite: boolean): AmbientFish {
    const dir = Math.random() < 0.5 ? 1 : -1;
    return {
        x: rand(0.05, 0.95),
        y: rand(0.1, 0.9),
        vx: rand(0.003, 0.008) * dir,
        vy: rand(-0.002, 0.002),
        dir,
        canBite,
        approaching: false,
    };
}

function initAmbientFish(): AmbientFish[] {
    const fish: AmbientFish[] = [];
    for (let i = 0; i < AMBIENT_FISH_COUNT; i++) fish.push(makeFish(false));
    for (let i = 0; i < ACTIVE_FISH_COUNT; i++) fish.push(makeFish(true));
    return fish;
}

function classifyMeter(
    value: number,
    perfectMin: number,
    perfectMax: number,
    goodMin: number,
    goodMax: number,
): FiskeStageResult {
    if (value >= perfectMin && value <= perfectMax) return 'perfect';
    if (value >= goodMin && value <= goodMax) return 'good';
    return 'miss';
}

// ─── Engine ───────────────────────────────────────
export class FiskeSnusEngine implements GameEngine {
    private players: PlayerInternal[] = [];
    private onStateUpdate: ((state: unknown) => void) | null = null;
    private intervalId: ReturnType<typeof setInterval> | null = null;
    private tickCount = 0;
    private status: 'playing' | 'ended' = 'playing';
    private results: GameResult[] | undefined;
    private startTime = 0;
    private isSolo = false;

    init(roomId: string, playerInfos: PlayerInfo[], onStateUpdate: (state: unknown) => void): void {
        void roomId;
        this.onStateUpdate = onStateUpdate;
        this.isSolo = playerInfos.length === 1;

        const makePlayer = (info: PlayerInfo, isBot: boolean, stagger: number): PlayerInternal => ({
            userId: info.userId,
            username: info.username,
            isBot,
            fishCaught: 0,
            totalScore: 0,
            phase: 'idle',
            phaseTick: 0,
            phaseDuration: IDLE_TICKS + stagger,

            meterValue: 0,
            meterDirection: 1,
            meterSweepTicks: BITE_SWEEP_TICKS,
            meterMissTimeout: BITE_MISS_TIMEOUT,

            reelProgress: 0,
            reelBarPosition: 0.5,
            reelDriftDir: 1,
            reelDangerTicks: 0,
            reelPerfectTicks: 0,

            fishApproachProgress: 0,
            approachFishStartX: 1,
            approachFishStartY: 0.5,
            approachFishIdx: -1,
            nibbleCount: 0,
            nibblesPlanned: 0,
            nibblesFired: 0,
            fishDepth: 0,

            stageResults: [],
            lastStageResult: null,
            lastFishSize: null,
            caughtFishSizes: [],
            castX: 0.5,
            castDepth: 0.5,
            castProgress: 0,
            consecutivePerfects: 0,
            snusStep: 0,
            snusOpenResult: null,
            boatTapsCompleted: 0,
            boatTapsRequired: 0,
            boatLastTapTick: 0,
            ambientFish: initAmbientFish(),
            transitionTarget: null,
            botStrikeScheduledTick: null,
            botCastTick: 0,
            botTargetCastX: 0.5,
            botTargetDepth: 0.5,
            treeStuckUntilTick: 0,
        });

        const p0info = playerInfos[0];
        this.players.push(makePlayer(p0info, false, 0));

        if (this.isSolo) {
            const botInfo: PlayerInfo = { userId: 'bot-fisksnusen', username: 'The Fisherman' };
            this.players.push(makePlayer(botInfo, true, BOT_STAGGER_TICKS));
        } else {
            this.players.push(makePlayer(playerInfos[1], false, BOT_STAGGER_TICKS));
        }

        this.startTime = Date.now();
        this.intervalId = setInterval(() => this.tick(), TICK_MS);
    }

    handleEvent(playerId: string, action: GameAction): void {
        if (this.status !== 'playing') return;

        const player = this.players.find(p => p.userId === playerId && !p.isBot);
        if (!player) return;

        if (action.type === 'fisksnusen:cast') {
            if ((player.phase as string) !== 'aiming') return;
            const raw = (action as unknown as Record<string, unknown>).castX;
            const castX = typeof raw === 'number' ? Math.max(0, Math.min(1, raw)) : 0.5;
            this.executeCast(player, castX);
            return;
        }

        if (action.type === 'fisksnusen:tree-hit') {
            if ((player.phase as string) !== 'aiming') return;
            player.castX = 0.535; // center of tree zone
            player.castDepth = player.meterValue;
            player.castProgress = 0;
            player.phase = 'casting';
            player.phaseTick = 0;
            player.phaseDuration = CAST_TICKS;
            player.treeStuckUntilTick = this.tickCount + CAST_TICKS + TREE_STUCK_EXTRA_TICKS;
            return;
        }

        if (action.type === 'fisksnusen:strike') {
            this.resolveStrike(player);
        }
    }

    getState(): unknown {
        return this.buildState();
    }

    destroy(): void {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
    }

    // ─── Tick ───────────────────────────────────────
    private tick(): void {
        if (this.status !== 'playing') return;

        this.tickCount++;

        for (const player of this.players) {
            this.tickAmbientFish(player);
            this.tickPlayer(player);
        }

        this.onStateUpdate?.(this.buildState());
    }

    private tickPlayer(p: PlayerInternal): void {
        p.phaseTick++;

        switch (p.phase) {
            case 'idle':
                this.tickIdle(p);
                break;
            case 'aiming':
                this.tickAiming(p);
                break;
            case 'casting':
                this.tickCasting(p);
                break;
            case 'waiting':
                this.tickWaiting(p);
                break;
            case 'nibble':
                this.tickNibble(p);
                break;
            case 'bite':
                this.tickMeterPhase(p);
                break;
            case 'reel':
                this.tickReel(p);
                break;
            case 'boat':
                this.tickMeterPhase(p);
                break;
            case 'snus':
                this.tickSnusPhase(p);
                break;
            case 'transition':
                this.tickTransition(p);
                break;
            case 'result':
                this.tickResult(p);
                break;
        }
    }

    private tickAmbientFish(p: PlayerInternal): void {
        for (const fish of p.ambientFish) {
            if (fish.approaching) continue; // frozen — rendered as the approach fish
            fish.x += fish.vx;
            fish.y += fish.vy;
            if (fish.x <= 0 || fish.x >= 1) {
                fish.vx *= -1;
                fish.dir = fish.vx > 0 ? 1 : -1;
                fish.x = Math.max(0, Math.min(1, fish.x));
            }
            if (fish.y <= 0.05 || fish.y >= 0.95) {
                fish.vy *= -1;
                fish.y = Math.max(0.05, Math.min(0.95, fish.y));
            }
            if (Math.random() < 0.004) {
                fish.vx += rand(-0.002, 0.002);
                fish.vy += rand(-0.001, 0.001);
                fish.vx = Math.max(-0.009, Math.min(0.009, fish.vx));
                fish.vy = Math.max(-0.003, Math.min(0.003, fish.vy));
                fish.dir = fish.vx >= 0 ? 1 : -1;
            }
        }
    }

    private tickIdle(p: PlayerInternal): void {
        if (p.phaseTick >= p.phaseDuration) {
            this.enterAiming(p);
        }
    }

    private enterAiming(p: PlayerInternal): void {
        p.meterValue = 0;
        p.meterDirection = 1;
        p.phase = 'aiming' as FiskePhase;
        p.phaseTick = 0;
        p.phaseDuration = AIMING_TIMEOUT;

        if (p.isBot) {
            p.botCastTick = randInt(BOT_CAST_MIN_TICK, BOT_CAST_MAX_TICK);
            // Bot aims at an active (canBite) fish for best chance of a fast bite
            const activeFish = p.ambientFish.filter(f => f.canBite);
            const targetPool = activeFish.length > 0 ? activeFish : p.ambientFish;
            if (targetPool.length > 0) {
                const fish = targetPool[randInt(0, targetPool.length - 1)];
                p.botTargetCastX = Math.max(0.05, Math.min(0.95, fish.x + rand(-0.06, 0.06)));
                p.botTargetDepth = fish.y;
            } else {
                p.botTargetCastX = rand(0.3, 0.7);
                p.botTargetDepth = rand(0.3, 0.7);
            }
        }
    }

    private tickAiming(p: PlayerInternal): void {
        // Oscillate power meter
        const step = 1 / AIMING_SWEEP_TICKS;
        p.meterValue += p.meterDirection * step;
        if (p.meterValue >= 1) { p.meterValue = 1; p.meterDirection = -1; }
        else if (p.meterValue <= 0) { p.meterValue = 0; p.meterDirection = 1; }

        if (p.isBot && p.phaseTick >= p.botCastTick) {
            // Cast when meter is close to target depth, or on timeout
            const depthDiff = Math.abs(p.meterValue - p.botTargetDepth);
            if (depthDiff < 0.08 || p.phaseTick >= AIMING_TIMEOUT - 10) {
                this.executeCast(p, p.botTargetCastX);
            }
            return;
        }

        if (!p.isBot && p.phaseTick >= AIMING_TIMEOUT) {
            this.executeCast(p, 0.5);
        }
    }

    private executeCast(p: PlayerInternal, castX: number): void {
        p.castX = Math.max(0, Math.min(1, castX));
        p.castDepth = p.meterValue;
        p.phase = 'casting';
        p.phaseTick = 0;
        p.phaseDuration = CAST_TICKS;
        p.castProgress = 0;
    }

    private tickCasting(p: PlayerInternal): void {
        p.castProgress = Math.min(1, p.phaseTick / CAST_TICKS);
        if (p.phaseTick >= CAST_TICKS) {
            p.castProgress = 1;
            if (p.treeStuckUntilTick > 0) {
                // Line is stuck in the tree — stay in a holding state until unstuck
                if (this.tickCount >= p.treeStuckUntilTick) {
                    p.treeStuckUntilTick = 0;
                    this.enterAiming(p);
                }
                // Don't advance phaseTick while stuck (keep it capped at CAST_TICKS)
                p.phaseTick = CAST_TICKS;
            } else {
                this.enterWaiting(p);
            }
        }
    }

    private enterWaiting(p: PlayerInternal): void {
        p.fishApproachProgress = 0;
        p.nibblesFired = 0;
        p.nibbleCount = 0;
        p.nibblesPlanned = randInt(1, MAX_NIBBLES);

        let duration = randInt(WAIT_MIN_TICKS, WAIT_MAX_TICKS);

        // Only active (canBite) fish interact with the cast
        const SCARE_THRESHOLD = 0.12;
        const SWEET_THRESHOLD = 0.28;

        let closestActiveIdx = -1;
        let closestActiveDist = Infinity;
        for (let i = 0; i < p.ambientFish.length; i++) {
            const fish = p.ambientFish[i];
            if (!fish.canBite) continue;
            const dx = fish.x - p.castX;
            const dy = fish.y - p.castDepth;
            const d = Math.sqrt(dx * dx + dy * dy);
            if (d < closestActiveDist) { closestActiveDist = d; closestActiveIdx = i; }
        }

        p.approachFishIdx = -1;

        if (closestActiveIdx >= 0 && closestActiveDist < SCARE_THRESHOLD) {
            // Splashed right on a fish — it bolts; replace with a fresh one
            p.ambientFish[closestActiveIdx] = makeFish(true);
            const scareFactor = 1 - closestActiveDist / SCARE_THRESHOLD;
            duration = Math.round(duration * (1 + scareFactor * 1.5));
            duration = Math.min(Math.round(WAIT_MAX_TICKS * 2.5), duration);
        } else if (closestActiveIdx >= 0 && closestActiveDist < SWEET_THRESHOLD) {
            // Hook near an active fish — record its start position, freeze it in the ambient
            // pool (approaching=true) so the client knows to skip it there and render it
            // as the approach fish instead
            const attracted = p.ambientFish[closestActiveIdx];
            p.approachFishStartX = attracted.x;
            p.approachFishStartY = attracted.y;
            p.approachFishIdx = closestActiveIdx;
            attracted.approaching = true;
            const bonus = 1 - (closestActiveDist - SCARE_THRESHOLD) / (SWEET_THRESHOLD - SCARE_THRESHOLD);
            duration = Math.round(duration * (1 - bonus * 0.60));
            duration = Math.max(Math.round(WAIT_MIN_TICKS * 0.35), duration);
        } else {
            // No nearby active fish — a random fish eventually wanders over; use right edge as fallback
            p.approachFishStartX = 1.0;
            p.approachFishStartY = p.castDepth;
        }

        p.phase = 'waiting';
        p.phaseTick = 0;
        p.phaseDuration = duration;
    }

    private tickWaiting(p: PlayerInternal): void {
        // Advance fish toward hook
        p.fishApproachProgress = Math.min(1, p.phaseTick / p.phaseDuration);

        // Trigger nibbles at ~60% and ~80% approach if not all fired yet
        const nibblesRemaining = p.nibblesPlanned - p.nibblesFired;
        if (nibblesRemaining > 0) {
            const threshold = 0.6 + (p.nibblesFired * 0.15);
            if (p.fishApproachProgress >= threshold) {
                this.enterNibble(p);
                return;
            }
        }

        // When approach completes and all nibbles done → bite
        if (p.phaseTick >= p.phaseDuration) {
            p.fishApproachProgress = 1;
            this.enterBite(p);
        }
    }

    private enterNibble(p: PlayerInternal): void {
        p.phase = 'nibble';
        p.phaseTick = 0;
        p.phaseDuration = randInt(NIBBLE_MIN_TICKS, NIBBLE_MAX_TICKS);
        p.nibblesFired++;
        p.nibbleCount++;
    }

    private tickNibble(p: PlayerInternal): void {
        if (p.phaseTick >= p.phaseDuration) {
            // Return to waiting to continue approach
            const remaining = p.nibblesPlanned - p.nibblesFired;
            if (remaining > 0) {
                // more nibbles to go — continue waiting, extend duration
                const extraTicks = randInt(WAIT_MIN_TICKS / 2, WAIT_MAX_TICKS / 2);
                p.phase = 'waiting';
                p.phaseTick = 0;
                p.phaseDuration = extraTicks;
            } else {
                // all nibbles done → bite
                p.fishApproachProgress = 1;
                this.enterBite(p);
            }
        }
    }

    private enterBite(p: PlayerInternal): void {
        // Fish has taken the hook — remove it from the ambient pool now
        if (p.approachFishIdx >= 0 && p.approachFishIdx < p.ambientFish.length) {
            p.ambientFish.splice(p.approachFishIdx, 1);
            p.approachFishIdx = -1;
        }

        p.stageResults = [];
        p.lastStageResult = null;
        p.meterValue = 0;
        p.meterDirection = 1;
        p.meterSweepTicks = BITE_SWEEP_TICKS;
        p.meterMissTimeout = BITE_MISS_TIMEOUT;
        p.phase = 'bite';
        p.phaseTick = 0;
        p.phaseDuration = BITE_MISS_TIMEOUT;

        if (p.isBot) {
            this.scheduleBotStrike(p, p.meterSweepTicks);
        }
    }

    private tickMeterPhase(p: PlayerInternal): void {
        // Advance meter
        const step = 1 / p.meterSweepTicks;
        p.meterValue += p.meterDirection * step;

        if (p.meterValue >= 1) {
            p.meterValue = 1;
            p.meterDirection = -1;
        } else if (p.meterValue <= 0) {
            p.meterValue = 0;
            p.meterDirection = 1;
        }

        // Bot auto-strike
        if (p.isBot && p.botStrikeScheduledTick !== null && p.phaseTick >= p.botStrikeScheduledTick) {
            this.resolveStrike(p);
            return;
        }

        // Miss timeout
        if (p.phaseTick >= p.meterMissTimeout) {
            this.handleMissTimeout(p);
        }
    }

    private tickSnusPhase(p: PlayerInternal): void {
        if (p.snusStep === 0) {
            // Step 0: oscillating arc meter (like bite/boat)
            const step = 1 / p.meterSweepTicks;
            p.meterValue += p.meterDirection * step;
            if (p.meterValue >= 1) { p.meterValue = 1; p.meterDirection = -1; }
            else if (p.meterValue <= 0) { p.meterValue = 0; p.meterDirection = 1; }
        } else {
            // Step 1: fast rising pulse 0→1
            p.meterValue = Math.min(1, p.phaseTick / SNUS_POP_PULSE_TICKS);
        }

        // Bot auto-strike
        if (p.isBot && p.botStrikeScheduledTick !== null && p.phaseTick >= p.botStrikeScheduledTick) {
            this.resolveStrike(p);
            return;
        }

        if (p.phaseTick >= p.meterMissTimeout) {
            this.handleMissTimeout(p);
        }
    }

    private handleMissTimeout(p: PlayerInternal): void {
        if (p.phase === 'bite') {
            // Fish escapes — no catch
            p.lastStageResult = 'miss';
            p.stageResults.push('miss');
            this.enterResult(p, false);
        } else if (p.phase === 'boat') {
            // Fish falls back but is still caught without snus opportunity
            p.lastStageResult = 'miss';
            p.stageResults.push('miss');
            this.enterResult(p, true);
        } else if (p.phase === 'snus') {
            if (p.snusStep === 0) {
                // Failed to open the tin — fish caught but no snus
                p.lastStageResult = 'miss';
                p.stageResults.push('miss');
                this.enterResult(p, true);
            } else {
                // Opened tin but fumbled the portioner — caught, partial snus credit lost
                p.lastStageResult = 'miss';
                p.stageResults.push('miss');
                this.enterResult(p, true);
            }
        }
    }

    private tickReel(p: PlayerInternal): void {
        // Drift indicator away from center
        p.reelBarPosition += p.reelDriftDir * REEL_DRIFT_SPEED;

        // Randomly flip drift direction
        if (Math.random() < REEL_DRIFT_CHANGE_CHANCE) {
            p.reelDriftDir = p.reelDriftDir === 1 ? -1 : 1;
        }

        // Clamp & bounce at edges
        if (p.reelBarPosition >= 1) {
            p.reelBarPosition = 1;
            p.reelDriftDir = -1;
        } else if (p.reelBarPosition <= 0) {
            p.reelBarPosition = 0;
            p.reelDriftDir = 1;
        }

        const inGood = p.reelBarPosition >= REEL_GOOD_MIN && p.reelBarPosition <= REEL_GOOD_MAX;
        const inPerfect = p.reelBarPosition >= REEL_PERFECT_MIN && p.reelBarPosition <= REEL_PERFECT_MAX;

        if (inGood) {
            // Accumulate reel progress (faster in perfect zone)
            const rate = inPerfect ? REEL_PROGRESS_PER_TICK * 1.5 : REEL_PROGRESS_PER_TICK;
            p.reelProgress = Math.min(1, p.reelProgress + rate);
            p.fishDepth = p.reelProgress; // fish moves toward surface as progress grows
            p.reelDangerTicks = 0;
            if (inPerfect) p.reelPerfectTicks++;
        } else {
            // Danger — tension builds
            p.reelDangerTicks++;
            if (p.reelDangerTicks >= REEL_DANGER_TIMEOUT) {
                // Fish escapes
                p.lastStageResult = 'miss';
                p.stageResults.push('miss');
                this.enterResult(p, false);
                return;
            }
        }

        // Bot: nudge bar back toward center periodically
        if (p.isBot) {
            const distFromCenter = Math.abs(p.reelBarPosition - 0.5);
            if (distFromCenter > 0.15) {
                this.applyReelNudge(p);
            }
        }

        // Overall timeout
        if (p.phaseTick >= REEL_DURATION_TICKS) {
            p.lastStageResult = 'miss';
            p.stageResults.push('miss');
            this.enterResult(p, false);
            return;
        }

        // Complete when progress reaches 1
        if (p.reelProgress >= 1) {
            // Result quality based on perfect zone time
            const perfectRatio = p.reelPerfectTicks / Math.max(1, p.phaseTick);
            const result: FiskeStageResult = perfectRatio >= 0.4 ? 'perfect' : 'good';
            p.stageResults.push(result);
            p.lastStageResult = result;
            // fishDepth = 1 means surface (fish at boat)
            p.fishDepth = 1;
            this.enterTransition(p, 'boat');
        }
    }

    // ─── Strike resolution ───────────────────────────
    private resolveStrike(p: PlayerInternal): void {
        p.botStrikeScheduledTick = null;

        switch (p.phase) {
            case 'bite': {
                const result = classifyMeter(p.meterValue, BITE_PERFECT_MIN, BITE_PERFECT_MAX, BITE_GOOD_MIN, BITE_GOOD_MAX);
                p.stageResults.push(result);
                p.lastStageResult = result;
                if (result === 'miss') {
                    this.enterResult(p, false);
                } else {
                    this.enterTransition(p, 'reel');
                }
                break;
            }
            case 'reel': {
                // Space press = nudge indicator toward center
                this.applyReelNudge(p);
                break;
            }
            case 'boat': {
                const result = classifyMeter(p.meterValue, BOAT_PERFECT_MIN, BOAT_PERFECT_MAX, BOAT_GOOD_MIN, BOAT_GOOD_MAX);
                p.stageResults.push(result);
                p.lastStageResult = result;
                if (result === 'miss') {
                    this.enterResult(p, false);
                } else {
                    this.enterTransition(p, 'snus');
                }
                break;
            }
            case 'snus': {
                if (p.snusStep === 0) {
                    // Step 0: open the tin
                    const openResult = classifyMeter(p.meterValue, SNUS_OPEN_PERFECT_MIN, SNUS_OPEN_PERFECT_MAX, SNUS_OPEN_GOOD_MIN, SNUS_OPEN_GOOD_MAX);
                    p.snusOpenResult = openResult;
                    p.lastStageResult = openResult;
                    if (openResult === 'miss') {
                        p.stageResults.push('miss');
                        this.enterResult(p, true);
                    } else {
                        // Advance to pop step
                        this.enterSnusPopStep(p);
                    }
                } else {
                    // Step 1: pop the portioner
                    const popResult = classifyMeter(p.meterValue, SNUS_POP_PERFECT_MIN, SNUS_POP_PERFECT_MAX, SNUS_POP_GOOD_MIN, SNUS_POP_GOOD_MAX);
                    // Combined result: only perfect if both steps were perfect
                    const combined: FiskeStageResult =
                        popResult === 'perfect' && p.snusOpenResult === 'perfect' ? 'perfect' : 'good';
                    p.stageResults.push(popResult === 'miss' ? 'miss' : combined);
                    p.lastStageResult = popResult === 'miss' ? 'miss' : combined;
                    this.enterResult(p, true);
                }
                break;
            }
        }
    }

    private enterReel(p: PlayerInternal): void {
        p.reelProgress = 0;
        p.reelBarPosition = 0.5;
        p.reelDriftDir = Math.random() < 0.5 ? 1 : -1;
        p.reelDangerTicks = 0;
        p.reelPerfectTicks = 0;
        p.fishDepth = 0;
        p.meterValue = 0;
        p.phase = 'reel';
        p.phaseTick = 0;
        p.phaseDuration = REEL_DURATION_TICKS;
    }

    private applyReelNudge(p: PlayerInternal): void {
        // Nudge indicator toward center (0.5)
        const dir = p.reelBarPosition < 0.5 ? 1 : -1;
        p.reelBarPosition = Math.max(0, Math.min(1, p.reelBarPosition + dir * REEL_NUDGE_STRENGTH));
    }

    private enterBoat(p: PlayerInternal): void {
        p.meterValue = 0;
        p.meterDirection = 1;
        p.meterSweepTicks = BOAT_SWEEP_TICKS;
        p.meterMissTimeout = BOAT_MISS_TIMEOUT;
        p.boatTapsCompleted = 0;
        p.boatTapsRequired = BOAT_TAPS_REQUIRED;
        p.boatLastTapTick = 0;
        p.phase = 'boat';
        p.phaseTick = 0;

        if (p.isBot) {
            this.scheduleBotStrike(p, BOAT_SWEEP_TICKS);
        }
    }

    private enterSnus(p: PlayerInternal): void {
        p.snusStep = 0;
        p.snusOpenResult = null;
        p.meterValue = 0;
        p.meterDirection = 1;
        p.meterSweepTicks = SNUS_OPEN_SWEEP_TICKS;
        p.meterMissTimeout = SNUS_OPEN_MISS_TIMEOUT;
        p.phase = 'snus';
        p.phaseTick = 0;

        if (p.isBot) {
            this.scheduleBotStrike(p, SNUS_OPEN_SWEEP_TICKS);
        }
    }

    private enterSnusPopStep(p: PlayerInternal): void {
        p.snusStep = 1;
        p.meterValue = 0;
        p.meterDirection = 1;
        p.meterSweepTicks = SNUS_POP_PULSE_TICKS;
        p.meterMissTimeout = SNUS_POP_MISS_TIMEOUT;
        p.phaseTick = 0;

        if (p.isBot) {
            // Bot aims for mid-pulse with small jitter
            const targetTick = Math.round(SNUS_POP_PULSE_TICKS * 0.50);
            const jitter = randInt(-4, 4);
            p.botStrikeScheduledTick = Math.max(0, targetTick + jitter);
        }
    }

    private enterResult(p: PlayerInternal, fishCaught: boolean): void {
        if (fishCaught) {
            p.fishCaught++;
            const allPerfect = p.stageResults.length >= 4 && p.stageResults.every(r => r === 'perfect');
            const hasMiss = p.stageResults.some(r => r === 'miss');
            const hasPerfect = p.stageResults.some(r => r === 'perfect');
            const fishSize: FiskeFishSize = allPerfect ? 'big' : (hasPerfect && !hasMiss) ? 'medium' : 'small';
            p.lastFishSize = fishSize;
            p.caughtFishSizes.push(fishSize);
            if (allPerfect) {
                p.totalScore += SCORE_BIG_FISH;
                p.consecutivePerfects++;
            } else if (hasPerfect && !hasMiss) {
                p.totalScore += SCORE_MEDIUM_FISH;
                p.consecutivePerfects = 0;
            } else {
                p.totalScore += SCORE_SMALL_FISH;
                p.consecutivePerfects = 0;
            }
        } else {
            p.lastFishSize = null;
            p.consecutivePerfects = 0;
        }

        // Replenish one active fish if the pool is low (fish was consumed or escaped)
        const activeFishCount = p.ambientFish.filter(f => f.canBite).length;
        if (activeFishCount < ACTIVE_FISH_COUNT) {
            p.ambientFish.push(makeFish(true));
        }

        p.phase = 'result';
        p.phaseTick = 0;
        p.phaseDuration = RESULT_TICKS;

        // Check win condition
        if (p.totalScore >= SCORE_TO_WIN) {
            this.endGame();
        }
    }

    private enterTransition(p: PlayerInternal, next: FiskePhase): void {
        p.transitionTarget = next;
        p.phase = 'transition' as FiskePhase;
        p.phaseTick = 0;
        p.phaseDuration = next === 'snus' ? TRANSITION_TICKS_SNUS : TRANSITION_TICKS;
        p.botStrikeScheduledTick = null;
    }

    private tickTransition(p: PlayerInternal): void {
        if (p.phaseTick >= p.phaseDuration) {
            const next = p.transitionTarget;
            p.transitionTarget = null;
            if (next === 'reel') this.enterReel(p);
            else if (next === 'boat') this.enterBoat(p);
            else if (next === 'snus') this.enterSnus(p);
        }
    }

    private tickResult(p: PlayerInternal): void {
        if (p.phaseTick >= p.phaseDuration) {
            this.resetForNextCast(p);
        }
    }

    private resetForNextCast(p: PlayerInternal): void {
        p.stageResults = [];
        p.lastStageResult = null;
        p.fishDepth = 0;
        p.nibbleCount = 0;
        p.nibblesFired = 0;
        p.meterValue = 0;
        p.meterDirection = 1;
        p.reelProgress = 0;
        p.reelBarPosition = 0.5;
        p.reelDriftDir = 1;
        p.reelDangerTicks = 0;
        p.reelPerfectTicks = 0;
        p.castProgress = 0;
        p.castX = 0.5;
        p.castDepth = 0.5;
        p.snusStep = 0;
        p.snusOpenResult = null;
        p.botStrikeScheduledTick = null;
        this.enterPhase(p, 'idle');
    }

    private enterPhase(p: PlayerInternal, phase: FiskePhase): void {
        p.phase = phase;
        p.phaseTick = 0;
        p.phaseDuration = IDLE_TICKS;
    }

    private scheduleBotStrike(p: PlayerInternal, sweepTicks: number): void {
        // Aim for meter value of ~0.50 on the first upswing
        const ticksToCenter = Math.round(sweepTicks * 0.50);
        const jitter = randInt(-6, 6);
        p.botStrikeScheduledTick = Math.max(0, ticksToCenter + jitter);
    }

    // ─── End game ────────────────────────────────────
    private endGame(): void {
        this.status = 'ended';
        const timeTakenMs = Date.now() - this.startTime;

        const eligible = this.isSolo
            ? this.players.filter(p => !p.isBot)
            : this.players;

        const sorted = [...eligible].sort((a, b) =>
            b.fishCaught !== a.fishCaught
                ? b.fishCaught - a.fishCaught
                : b.totalScore - a.totalScore
        );

        this.results = sorted.map((p, i) => ({
            userId: p.userId,
            username: p.username,
            score: p.totalScore,
            rank: i + 1,
            timeTakenMs,
        }));

        // Handle ties
        for (let i = 1; i < this.results.length; i++) {
            if (this.results[i].score === this.results[i - 1].score) {
                this.results[i].rank = this.results[i - 1].rank;
            }
        }

        this.onStateUpdate?.(this.buildState());
        this.destroy();
    }

    // ─── State builder ────────────────────────────────
    private buildState(): FiskeSnusState {
        return {
            status: this.status,
            tickCount: this.tickCount,
            players: this.players.map(p => this.toPublicState(p)),
            results: this.results,
        };
    }

    private toPublicState(p: PlayerInternal): FiskeSnusPlayerState {
        return {
            userId: p.userId,
            username: p.username,
            isBot: p.isBot,
            fishCaught: p.fishCaught,
            lastFishSize: p.lastFishSize,
            caughtFishSizes: [...p.caughtFishSizes],
            phase: p.phase,
            phaseTicksRemaining: Math.max(0, p.phaseDuration - p.phaseTick),
            meterValue: p.meterValue,
            meterDirection: p.meterDirection,
            reelProgress: p.reelProgress,
            reelBarPosition: p.reelBarPosition,
            reelInDanger: p.reelDangerTicks > 0,
            stageResults: [...p.stageResults],
            lastStageResult: p.lastStageResult,
            castProgress: p.castProgress,
            castX: p.castX,
            castDepth: p.castDepth,
            fishApproachProgress: p.fishApproachProgress,
            approachFishStartX: p.approachFishStartX,
            approachFishStartY: p.approachFishStartY,
            nibbleCount: p.nibbleCount,
            fishDepth: p.fishDepth,
            consecutivePerfects: p.consecutivePerfects,
            totalScore: p.totalScore,
            ambientFish: p.ambientFish.map(f => ({ x: f.x, y: f.y, dir: f.dir, canBite: f.canBite, approaching: f.approaching })),
            snusStep: p.snusStep,
            boatTapsCompleted: p.boatTapsCompleted,
            boatTapsRequired: p.boatTapsRequired,
            transitionTarget: p.transitionTarget,
            transitionProgress: p.phase === 'transition' ? Math.min(1, p.phaseTick / p.phaseDuration) : 0,
            treeStuck: p.treeStuckUntilTick > 0,
        };
    }
}
