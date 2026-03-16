import { GameEngine } from '../registry';
import { GameAction, PlayerInfo, GameResult, SnusregnItemType, SnusregnEffectType, SnusregnItem, SnusregnEffect, SnusregnPlayerState, SnusregnState } from '@slutsnus/shared';

// ─── Constants ───────────────────────────────────
const TICK_INTERVAL_MS = 20;
const CANVAS_H = 900;
const LANE_W = 450;
const BAR_Y_FROM_BOTTOM = 20;
const BAR_HEIGHT = 18;
const BAR_WIDTH_DEFAULT = 100;
const ITEM_RADIUS = 18;
const BASE_FALL_SPEED = 13;
const FALL_SPEED_INCREMENT = 0.01;
const BASE_SPAWN_INTERVAL = 20;
const MAX_ITEMS = 15;
const LIVES_START = 3;

const SPAWN_WEIGHTS: Record<SnusregnItemType, number> = {
    fresh: 80,
    spent: 10,
    wideBar: 1,
    slowRain: 1,
    fastRain: 1,
    shrinkBar: 1,
    blind: 1,
    beer: 1.5,
};

const EFFECT_DURATIONS: Record<SnusregnEffectType, number> = {
    wideBar: 200,
    slowRain: 150,
    fastRain: 150,
    shrinkBar: 200,
    blind: 100,
    beer: 200,
};

// ─── Internal State ───────────────────────────────
interface PlayerInternal {
    userId: string;
    username: string;
    score: number;
    lives: number;
    barXPx: number;
    items: SnusregnItem[];
    effects: SnusregnEffect[];
    nextItemId: number;
    ticksSinceLastSpawn: number;
}

// ─── Helpers ──────────────────────────────────────
function weightedRandom(weights: Record<SnusregnItemType, number>): SnusregnItemType {
    const total = Object.values(weights).reduce((a, b) => a + b, 0);
    let r = Math.random() * total;
    for (const [type, w] of Object.entries(weights)) {
        r -= w;
        if (r <= 0) return type as SnusregnItemType;
    }
    return 'fresh';
}

function hasEffect(player: PlayerInternal, type: SnusregnEffectType): boolean {
    return player.effects.some(e => e.type === type);
}

function addEffect(target: PlayerInternal, type: SnusregnEffectType): void {
    target.effects = target.effects.filter(e => e.type !== type);
    target.effects.push({ type, remainingTicks: EFFECT_DURATIONS[type] });
}

function computeBarHalfWidthPx(player: PlayerInternal): number {
    let half = BAR_WIDTH_DEFAULT / 2;
    if (hasEffect(player, 'wideBar')) half *= 2;
    if (hasEffect(player, 'shrinkBar')) half *= 0.5;
    return half;
}

function toPublicState(p: PlayerInternal): SnusregnPlayerState {
    return {
        userId: p.userId,
        username: p.username,
        score: p.score,
        lives: p.lives,
        barXFraction: p.barXPx / LANE_W,
        items: p.items,
        effects: p.effects,
    };
}

// ─── Engine ───────────────────────────────────────
export class SnusregnEngine implements GameEngine {
    private players: [PlayerInternal, PlayerInternal] | null = null;
    private onStateUpdate: ((state: unknown) => void) | null = null;
    private intervalId: ReturnType<typeof setInterval> | null = null;
    private tickCount = 0;
    private lastState: SnusregnState | null = null;
    private isSolo = false;

    init(roomId: string, playerInfos: PlayerInfo[], onStateUpdate: (state: unknown) => void): void {
        void roomId;
        this.onStateUpdate = onStateUpdate;
        this.tickCount = 0;

        const makePlayer = (info: PlayerInfo): PlayerInternal => ({
            userId: info.userId,
            username: info.username,
            score: 0,
            lives: LIVES_START,
            barXPx: LANE_W / 2,
            items: [],
            effects: [],
            nextItemId: 0,
            ticksSinceLastSpawn: 0,
        });

        this.isSolo = playerInfos.length === 1;
        const p0 = makePlayer(playerInfos[0]);
        const p1 = makePlayer(playerInfos[1] ?? playerInfos[0]);
        this.players = [p0, p1];

        this.intervalId = setInterval(() => this.tick(), TICK_INTERVAL_MS);
    }

    handleEvent(playerId: string, action: GameAction): void {
        if (!this.players) return;
        if (action.type === 'snusregn:bar-move') {
            const payload = action.payload as { xFraction: number };
            const xFraction = Math.max(0, Math.min(1, payload.xFraction));
            const player = this.players.find(p => p.userId === playerId);
            if (player) {
                player.barXPx = xFraction * LANE_W;
            }
        }
    }

    getState(): unknown {
        return this.lastState;
    }

    destroy(): void {
        if (this.intervalId !== null) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
    }

    private tick(): void {
        if (!this.players || !this.onStateUpdate) return;

        this.tickCount++;
        const [p0, p1] = this.players;

        if (p0.lives > 0) this.processPlayer(p0, p1);
        if (p1.lives > 0) this.processPlayer(p1, p0);

        // Win check
        const winner = this.determineWinner(p0, p1);
        if (winner !== null) {
            const [rank1, rank2] = winner;
            const results: GameResult[] = this.isSolo
                ? [{ userId: rank1.userId, username: rank1.username, score: rank1.score, rank: 1 }]
                : [
                    { userId: rank1.userId, username: rank1.username, score: rank1.score, rank: 1 },
                    { userId: rank2.userId, username: rank2.username, score: rank2.score, rank: 2 },
                ];
            const state: SnusregnState = {
                status: 'ended',
                tickCount: this.tickCount,
                players: [toPublicState(p0), toPublicState(p1)],
                results,
            };
            this.lastState = state;
            this.onStateUpdate(state);
            this.destroy();
            return;
        }

        const state: SnusregnState = {
            status: 'playing',
            tickCount: this.tickCount,
            players: [toPublicState(p0), toPublicState(p1)],
        };
        this.lastState = state;
        this.onStateUpdate(state);
    }

    private processPlayer(player: PlayerInternal, opponent: PlayerInternal): void {
        // 1. Decrement and expire effects
        for (const effect of player.effects) {
            effect.remainingTicks--;
        }
        player.effects = player.effects.filter(e => e.remainingTicks > 0);

        // 2. Effective fall speed
        const ramp = this.tickCount * FALL_SPEED_INCREMENT;
        let speed = (BASE_FALL_SPEED + ramp)
            * (hasEffect(player, 'fastRain') ? 1.5 : 1.0)
            * (hasEffect(player, 'slowRain') ? 0.5 : 1.0);
        if (speed < 0) speed = 0;

        // 3. Spawn interval — grows with speed so item density stays constant
        const spawnInterval = Math.round(BASE_SPAWN_INTERVAL / (speed / BASE_FALL_SPEED));

        // 4. Move items
        for (const item of player.items) {
            item.y += (speed * item.speedMult) / CANVAS_H;
        }

        // 5. Spawn
        if (player.ticksSinceLastSpawn >= spawnInterval && player.items.length < MAX_ITEMS) {
            const id = `${player.userId}-${player.nextItemId++}`;
            const weights = this.isSolo
                ? { ...SPAWN_WEIGHTS, slowRain: 0 }
                : SPAWN_WEIGHTS;
            player.items.push({
                id,
                type: weightedRandom(weights),
                x: 0.05 + Math.random() * 0.90,
                y: 0,
                speedMult: 0.85 + Math.random() * 0.15,
            });
            player.ticksSinceLastSpawn = 0;
        } else {
            player.ticksSinceLastSpawn++;
        }

        // 6. Collision detection (reverse iteration for safe splice)
        const barTopYPx = CANVAS_H - BAR_Y_FROM_BOTTOM - BAR_HEIGHT;
        const barBotYPx = CANVAS_H - BAR_Y_FROM_BOTTOM;
        const barHalfW = computeBarHalfWidthPx(player);

        for (let i = player.items.length - 1; i >= 0; i--) {
            const item = player.items[i];
            const itemXPx = item.x * LANE_W;
            const itemYPx = item.y * CANVAS_H;

            // Missed — fell off screen
            if (itemYPx - ITEM_RADIUS > barBotYPx + ITEM_RADIUS) {
                if (item.type === 'fresh') {
                    player.lives = Math.max(0, player.lives - 1);
                }
                player.items.splice(i, 1);
                continue;
            }

            // Collision check
            const vertOverlap = (itemYPx + ITEM_RADIUS >= barTopYPx) && (itemYPx - ITEM_RADIUS <= barBotYPx);
            const horizOverlap = (itemXPx + ITEM_RADIUS >= player.barXPx - barHalfW) &&
                (itemXPx - ITEM_RADIUS <= player.barXPx + barHalfW);

            if (vertOverlap && horizOverlap) {
                this.resolveCatch(player, item, opponent);
                player.items.splice(i, 1);
            }
        }
    }

    private resolveCatch(player: PlayerInternal, item: SnusregnItem, opponent: PlayerInternal): void {
        switch (item.type) {
            case 'fresh': player.score += hasEffect(player, 'beer') ? 3 : 1; break;
            case 'spent': player.lives -= 1; break;
            case 'wideBar': addEffect(player, 'wideBar'); break;
            case 'slowRain': addEffect(opponent, 'slowRain'); break;
            case 'fastRain': addEffect(player, 'fastRain'); break;
            case 'shrinkBar': addEffect(player, 'shrinkBar'); break;
            case 'blind': addEffect(player, 'blind'); break;
            case 'beer': addEffect(player, 'beer'); break;
        }
    }

    private determineWinner(
        p0: PlayerInternal,
        p1: PlayerInternal,
    ): [PlayerInternal, PlayerInternal] | null {
        if (this.isSolo) {
            return p0.lives <= 0 ? [p0, p1] : null;
        }

        const p0Done = p0.lives <= 0;
        const p1Done = p1.lives <= 0;

        // Game continues until both players are out of lives
        if (!p0Done || !p1Done) return null;

        // Higher score wins; p0 wins tiebreak
        if (p0.score !== p1.score) {
            return p0.score > p1.score ? [p0, p1] : [p1, p0];
        }
        return [p0, p1];
    }
}
