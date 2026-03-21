import type { PlayerInfo, GameAction, FarmState, FarmChicken, FarmPlayer, GameResult } from '@slutsnus/shared';
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
    SPAWN_MIN_X, SPAWN_MAX_X, SPAWN_MIN_Y, SPAWN_MAX_Y,
} from './constants';

interface PlayerInternal {
    info: PlayerInfo;
    x: number;
    y: number;
    score: number;
    side: 'left' | 'right';
    inputDx: number;
    inputDy: number;
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
    private tickCount = 0;
    private status: 'playing' | 'ended' = 'playing';
    private results: GameResult[] | undefined;
    private interval: ReturnType<typeof setInterval> | null = null;
    private onStateUpdate: ((state: unknown) => void) | null = null;

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
            });
        });

        // Spawn chickens in the center zone
        for (let i = 0; i < TOTAL_CHICKENS; i++) {
            const angle = Math.random() * Math.PI * 2;
            this.chickens.push({
                id: `chicken-${i}`,
                x: rand(SPAWN_MIN_X, SPAWN_MAX_X),
                y: rand(SPAWN_MIN_Y, SPAWN_MAX_Y),
                vx: Math.cos(angle) * CHICKEN_SPEED,
                vy: Math.sin(angle) * CHICKEN_SPEED,
                wanderTimer: randInt(CHICKEN_WANDER_MIN_TICKS, CHICKEN_WANDER_MAX_TICKS),
                inPen: false,
            });
        }

        this.interval = setInterval(() => this.tick(), TICK_MS);
    }

    handleEvent(playerId: string, action: GameAction): void {
        const player = this.players.get(playerId);
        if (!player || this.status !== 'playing') return;

        if (action.type === 'farm:move') {
            const payload = action.payload as { dx: number; dy: number };
            player.inputDx = Math.max(-1, Math.min(1, payload.dx));
            player.inputDy = Math.max(-1, Math.min(1, payload.dy));
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

        // 1. Move players
        for (const player of this.players.values()) {
            const { inputDx, inputDy } = player;
            if (inputDx === 0 && inputDy === 0) continue;

            // Normalize diagonal movement
            const len = Math.sqrt(inputDx * inputDx + inputDy * inputDy);
            const nx = inputDx / len;
            const ny = inputDy / len;

            player.x = Math.max(FARMER_MIN_X, Math.min(FARMER_MAX_X, player.x + nx * FARMER_SPEED));
            player.y = Math.max(FARMER_MIN_Y, Math.min(FARMER_MAX_Y, player.y + ny * FARMER_SPEED));
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

            // Apply push from nearby farmers
            let pushX = 0;
            let pushY = 0;
            for (const player of playerList) {
                const dx = chicken.x - player.x;
                const dy = chicken.y - player.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < FARMER_PUSH_RADIUS && dist > 0) {
                    const mag = ((FARMER_PUSH_RADIUS - dist) / FARMER_PUSH_RADIUS) * FARMER_PUSH_STRENGTH;
                    pushX += (dx / dist) * mag;
                    pushY += (dy / dist) * mag;
                }
            }

            // Apply wander velocity + push
            let newX = chicken.x + chicken.vx + pushX;
            let newY = chicken.y + chicken.vy + pushY;

            // Bounce wander velocity off field walls; allow push to carry chickens into pen zones
            if (newX < CHICKEN_MIN_X) { if (pushX >= 0) { chicken.vx = Math.abs(chicken.vx); newX = CHICKEN_MIN_X; } }
            if (newX > CHICKEN_MAX_X) { if (pushX <= 0) { chicken.vx = -Math.abs(chicken.vx); newX = CHICKEN_MAX_X; } }
            if (newY < CHICKEN_MIN_Y) { newY = CHICKEN_MIN_Y; chicken.vy = Math.abs(chicken.vy); }
            if (newY > CHICKEN_MAX_Y) { newY = CHICKEN_MAX_Y; chicken.vy = -Math.abs(chicken.vy); }

            // Cap total speed to prevent runaway acceleration from repeated pushes
            const totalVx = chicken.vx + pushX;
            const totalVy = chicken.vy + pushY;
            const totalSpeed = Math.sqrt(totalVx * totalVx + totalVy * totalVy);
            if (totalSpeed > CHICKEN_MAX_SPEED) {
                const scale = CHICKEN_MAX_SPEED / totalSpeed;
                chicken.vx *= scale;
                chicken.vy *= scale;
            }

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

        const sorted = Array.from(this.players.values()).sort((a, b) => b.score - a.score);
        this.results = sorted.map((p, i) => ({
            userId: p.info.userId,
            username: p.info.username,
            score: p.score,
            rank: i + 1,
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
        }));

        const chickens: FarmChicken[] = this.chickens
            .filter(c => !c.inPen)
            .map(c => ({ id: c.id, x: c.x, y: c.y, vx: c.vx, vy: c.vy }));

        return {
            status: this.status,
            tickCount: this.tickCount,
            players,
            chickens,
            results: this.results,
        };
    }
}
