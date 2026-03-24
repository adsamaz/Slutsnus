import type { PlayerInfo, GameAction, FarmState, FarmChicken, FarmPlayer, FarmSnus, GameResult } from '@slutsnus/shared';
import type { GameEngine } from '../registry';
import {
    TICK_MS, CANVAS_W, CANVAS_H,
    CHICKENS_TO_WIN, TOTAL_CHICKENS,
    FARMER_SPEED, FARMER_RADIUS, FARMER_PUSH_RADIUS, FARMER_PUSH_STRENGTH,
    CHICKEN_SPEED, CHICKEN_MAX_SPEED,
    CHICKEN_WANDER_MIN_TICKS, CHICKEN_WANDER_MAX_TICKS,
    PEN_CAPTURE_RADIUS, PEN_LEFT, PEN_RIGHT,
    CHICKEN_MIN_X, CHICKEN_MAX_X, CHICKEN_MIN_Y, CHICKEN_MAX_Y,
    FARMER_MIN_X, FARMER_MAX_X, FARMER_MIN_Y, FARMER_MAX_Y,
    SNUS_RADIUS, SNUS_SPAWN_INTERVAL_TICKS, SNUS_SPEED_BOOST, SNUS_BOOST_TICKS, SNUS_SPAWN_MARGIN,
} from './constants';

interface PlayerInternal {
    info: PlayerInfo;
    x: number;
    y: number;
    score: number;
    side: 'left' | 'right';
    inputDx: number;
    inputDy: number;
    speedBoostTicks: number;
    rakeAngle: number;
}

interface ChickenInternal extends FarmChicken {
    wanderTimer: number;
    inPen: boolean;
}

function rand(min: number, max: number): number {
    return min + Math.random() * (max - min);
}

function randInt(min: number, max: number): number {
    return Math.floor(rand(min, max + 1));
}

export class SnusFarmEngine implements GameEngine {
    private players: Map<string, PlayerInternal> = new Map();
    private chickens: ChickenInternal[] = [];
    private snus: FarmSnus | null = null;
    private snusIdCounter = 0;
    private tickCount = 0;
    private status: 'playing' | 'ended' = 'playing';
    private results: GameResult[] | undefined;
    private interval: ReturnType<typeof setInterval> | null = null;
    private onStateUpdate: ((state: unknown) => void) | null = null;
    private startTime = 0;

    init(roomId: string, players: PlayerInfo[], onStateUpdate: (state: unknown) => void): void {
        this.onStateUpdate = onStateUpdate;

        const sides: Array<'left' | 'right'> = ['left', 'right'];
        players.forEach((p, i) => {
            this.players.set(p.userId, {
                info: p,
                x: i === 0 ? CANVAS_W * 0.25 : CANVAS_W * 0.75,
                y: CANVAS_H / 2,
                score: 0,
                side: sides[i] ?? 'left',
                inputDx: 0,
                inputDy: 0,
                speedBoostTicks: 0,
                rakeAngle: -Math.PI / 4,
            });
        });

        // Spawn chickens scattered across the full field, avoiding pen zones
        const penClearRadius = PEN_CAPTURE_RADIUS + 20;
        for (let i = 0; i < TOTAL_CHICKENS; i++) {
            let x: number, y: number;
            do {
                x = rand(FARMER_RADIUS + 10, CANVAS_W - FARMER_RADIUS - 10);
                y = rand(FARMER_RADIUS + 10, CANVAS_H - FARMER_RADIUS - 10);
            } while (
                Math.hypot(x - PEN_LEFT.x, y - PEN_LEFT.y) < penClearRadius ||
                Math.hypot(x - PEN_RIGHT.x, y - PEN_RIGHT.y) < penClearRadius
            );
            const angle = Math.random() * Math.PI * 2;
            this.chickens.push({
                id: `chicken-${i}`,
                x,
                y,
                vx: Math.cos(angle) * CHICKEN_SPEED,
                vy: Math.sin(angle) * CHICKEN_SPEED,
                wanderTimer: randInt(CHICKEN_WANDER_MIN_TICKS, CHICKEN_WANDER_MAX_TICKS),
                inPen: false,
            });
        }

        this.startTime = Date.now();
        this.interval = setInterval(() => this.tick(), TICK_MS);
    }

    handleEvent(playerId: string, action: GameAction): void {
        const player = this.players.get(playerId);
        if (!player || this.status !== 'playing') return;

        if (action.type === 'farm:move') {
            const payload = action.payload as { dx: number; dy: number; rakeAngle: number };
            player.inputDx = Math.max(-1, Math.min(1, payload.dx));
            player.inputDy = Math.max(-1, Math.min(1, payload.dy));
            if (typeof payload.rakeAngle === 'number' && isFinite(payload.rakeAngle)) {
                player.rakeAngle = payload.rakeAngle;
            }
        }
    }

    getState(): unknown {
        return this.buildState();
    }

    destroy(): void {
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
        }
    }

    private tick(): void {
        if (this.status !== 'playing') return;

        this.tickCount++;

        // 0. Bot AI: steer bots toward nearest free chicken
        for (const player of this.players.values()) {
            if (!player.info.userId.startsWith('bot-')) continue;
            const pen = player.side === 'left' ? PEN_LEFT : PEN_RIGHT;

            // Find the nearest free chicken
            let bestChicken: ChickenInternal | null = null;
            let bestDist = Infinity;
            for (const chicken of this.chickens) {
                if (chicken.inPen) continue;
                const d = Math.hypot(chicken.x - player.x, chicken.y - player.y);
                if (d < bestDist) { bestDist = d; bestChicken = chicken; }
            }

            let targetX: number;
            let targetY: number;

            if (bestChicken === null) {
                // No chickens left, idle
                player.inputDx = 0;
                player.inputDy = 0;
                continue;
            }

            if (bestDist > FARMER_PUSH_RADIUS * 1.5) {
                // Far from chicken — move directly to it
                targetX = bestChicken.x;
                targetY = bestChicken.y;
            } else {
                // Close enough to herd — position behind chicken relative to pen
                // "Behind" = on the opposite side of the chicken from the pen
                const toPenDx = pen.x - bestChicken.x;
                const toPenDy = pen.y - bestChicken.y;
                const toPenDist = Math.hypot(toPenDx, toPenDy);
                if (toPenDist > 0) {
                    // Target point behind the chicken (away from pen), close enough to push
                    const behindDist = FARMER_PUSH_RADIUS * 0.6;
                    targetX = bestChicken.x - (toPenDx / toPenDist) * behindDist;
                    targetY = bestChicken.y - (toPenDy / toPenDist) * behindDist;
                } else {
                    targetX = bestChicken.x;
                    targetY = bestChicken.y;
                }
            }

            const dx = targetX - player.x;
            const dy = targetY - player.y;
            const dist = Math.hypot(dx, dy);
            player.inputDx = dist > 2 ? dx / dist : 0;
            player.inputDy = dist > 2 ? dy / dist : 0;
        }

        // 1. Move players
        for (const player of this.players.values()) {
            const { inputDx, inputDy } = player;
            if (player.speedBoostTicks > 0) player.speedBoostTicks--;

            if (inputDx === 0 && inputDy === 0) continue;

            // Normalize diagonal movement
            const len = Math.sqrt(inputDx * inputDx + inputDy * inputDy);
            const nx = inputDx / len;
            const ny = inputDy / len;

            const speed = FARMER_SPEED * (player.speedBoostTicks > 0 ? SNUS_SPEED_BOOST : 1);
            player.x = Math.max(FARMER_MIN_X, Math.min(FARMER_MAX_X, player.x + nx * speed));
            player.y = Math.max(FARMER_MIN_Y, Math.min(FARMER_MAX_Y, player.y + ny * speed));
        }

        // 1b. Snus spawn & pickup
        if (!this.snus && this.tickCount % SNUS_SPAWN_INTERVAL_TICKS === 0 && this.tickCount > 0) {
            this.snus = {
                id: `snus-${this.snusIdCounter++}`,
                x: rand(SNUS_SPAWN_MARGIN, CANVAS_W - SNUS_SPAWN_MARGIN),
                y: rand(SNUS_SPAWN_MARGIN, CANVAS_H - SNUS_SPAWN_MARGIN),
            };
        }
        if (this.snus) {
            for (const player of this.players.values()) {
                const dx = player.x - this.snus.x;
                const dy = player.y - this.snus.y;
                if (Math.sqrt(dx * dx + dy * dy) < FARMER_RADIUS + SNUS_RADIUS) {
                    player.speedBoostTicks = SNUS_BOOST_TICKS;
                    this.snus = null;
                    break;
                }
            }
        }

        // 2. Move chickens + apply push
        const playerList = Array.from(this.players.values());
        for (const chicken of this.chickens) {
            if (chicken.inPen) continue;

            // Wander direction change
            chicken.wanderTimer--;
            if (chicken.wanderTimer <= 0) {
                const angle = Math.random() * Math.PI * 2;
                chicken.vx = Math.cos(angle) * CHICKEN_SPEED;
                chicken.vy = Math.sin(angle) * CHICKEN_SPEED;
                chicken.wanderTimer = randInt(CHICKEN_WANDER_MIN_TICKS, CHICKEN_WANDER_MAX_TICKS);
            }

            // Apply push from nearby farmers, biased toward rake direction
            let pushX = 0;
            let pushY = 0;
            for (const player of playerList) {
                const dx = chicken.x - player.x;
                const dy = chicken.y - player.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < FARMER_PUSH_RADIUS && dist > 0) {
                    const mag = ((FARMER_PUSH_RADIUS - dist) / FARMER_PUSH_RADIUS) * FARMER_PUSH_STRENGTH;
                    // Base push: away from farmer
                    const basePushX = (dx / dist) * mag;
                    const basePushY = (dy / dist) * mag;
                    // Rake direction: chickens are steered toward the angle the rake points
                    const rakeX = Math.cos(player.rakeAngle);
                    const rakeY = Math.sin(player.rakeAngle);
                    // Blend: 50% raw push-away, 50% rake direction
                    pushX += basePushX * 0.5 + rakeX * mag * 0.5;
                    pushY += basePushY * 0.5 + rakeY * mag * 0.5;
                }
            }

            // Cap total speed before applying movement to prevent teleport-like jumps
            const totalVx = chicken.vx + pushX;
            const totalVy = chicken.vy + pushY;
            const totalSpeed = Math.sqrt(totalVx * totalVx + totalVy * totalVy);
            let frameVx = totalVx;
            let frameVy = totalVy;
            if (totalSpeed > CHICKEN_MAX_SPEED) {
                const scale = CHICKEN_MAX_SPEED / totalSpeed;
                frameVx = totalVx * scale;
                frameVy = totalVy * scale;
                // Do NOT scale down the wander component — push is transient and
                // shrinking vx/vy permanently causes a velocity pop when wander resets.
            }

            // Apply capped velocity
            let newX = chicken.x + frameVx;
            let newY = chicken.y + frameVy;

            // Bounce off canvas edges (hard walls)
            if (newX < FARMER_RADIUS) { newX = FARMER_RADIUS; chicken.vx = Math.abs(chicken.vx); }
            if (newX > CANVAS_W - FARMER_RADIUS) { newX = CANVAS_W - FARMER_RADIUS; chicken.vx = -Math.abs(chicken.vx); }
            if (newY < CHICKEN_MIN_Y) { newY = CHICKEN_MIN_Y; chicken.vy = Math.abs(chicken.vy); }
            if (newY > CHICKEN_MAX_Y) { newY = CHICKEN_MAX_Y; chicken.vy = -Math.abs(chicken.vy); }

            // Steer wander velocity away from pen zones so chickens don't linger there.
            // Only affects future wander direction, never clamps position (which would cause jumps).
            if (chicken.x < CHICKEN_MIN_X && chicken.vx < 0) chicken.vx = Math.abs(chicken.vx);
            if (chicken.x > CHICKEN_MAX_X && chicken.vx > 0) chicken.vx = -Math.abs(chicken.vx);

            chicken.x = newX;
            chicken.y = newY;
        }

        // 3. Check pen captures
        for (const chicken of this.chickens) {
            if (chicken.inPen) continue;

            // Check left pen
            const dxL = chicken.x - PEN_LEFT.x;
            const dyL = chicken.y - PEN_LEFT.y;
            if (Math.sqrt(dxL * dxL + dyL * dyL) < PEN_CAPTURE_RADIUS) {
                chicken.inPen = true;
                // Award to left-side player
                for (const player of this.players.values()) {
                    if (player.side === 'left') { player.score++; break; }
                }
                continue;
            }

            // Check right pen
            const dxR = chicken.x - PEN_RIGHT.x;
            const dyR = chicken.y - PEN_RIGHT.y;
            if (Math.sqrt(dxR * dxR + dyR * dyR) < PEN_CAPTURE_RADIUS) {
                chicken.inPen = true;
                for (const player of this.players.values()) {
                    if (player.side === 'right') { player.score++; break; }
                }
            }
        }

        // 4. Check win conditions
        for (const player of this.players.values()) {
            if (player.score >= CHICKENS_TO_WIN) {
                this.endGame();
                return;
            }
        }
        this.onStateUpdate?.(this.buildState());
    }

    private endGame(): void {
        this.status = 'ended';
        const timeTakenMs = Date.now() - this.startTime;

        const sorted = Array.from(this.players.values()).sort((a, b) => b.score - a.score);
        this.results = sorted.map((p, i) => ({
            userId: p.info.userId,
            username: p.info.username,
            score: p.score,
            rank: i + 1,
            timeTakenMs,
        }));

        // Handle ties: give same rank
        for (let i = 1; i < this.results.length; i++) {
            if (this.results[i].score === this.results[i - 1].score) {
                this.results[i].rank = this.results[i - 1].rank;
            }
        }

        this.onStateUpdate?.(this.buildState());
        this.destroy();
    }

    private buildState(): FarmState {
        const players: FarmPlayer[] = Array.from(this.players.values()).map(p => ({
            userId: p.info.userId,
            username: p.info.username,
            x: p.x,
            y: p.y,
            score: p.score,
            side: p.side,
            speedBoostTicks: p.speedBoostTicks,
            rakeAngle: p.rakeAngle,
        }));

        const chickens: FarmChicken[] = this.chickens
            .filter(c => !c.inPen)
            .map(c => ({ id: c.id, x: c.x, y: c.y, vx: c.vx, vy: c.vy }));

        return {
            status: this.status,
            tickCount: this.tickCount,
            players,
            chickens,
            snus: this.snus,
            results: this.results,
        };
    }
}
