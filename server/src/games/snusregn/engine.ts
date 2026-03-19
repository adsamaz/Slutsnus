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
const BASE_FALL_SPEED = 12;
const FALL_SPEED_INCREMENT = 0.2;
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
    beerSnus: 3.5,
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
    prevBarXPx: number;
    items: SnusregnItem[];
    effects: SnusregnEffect[];
    powerupCooldowns: Partial<Record<SnusregnItemType, number>>;
    nextItemId: number;
    ticksSinceLastSpawn: number;
    prevItemY: Map<string, number>;
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

function removeEffect(target: PlayerInternal, type: SnusregnEffectType): void {
    target.effects = target.effects.filter(e => e.type !== type);
}

/** Applies `type` to `target`, or cancels `opposite` if it is active instead. */
function applyOrCancel(target: PlayerInternal, type: SnusregnEffectType, opposite: SnusregnEffectType): void {
    if (hasEffect(target, opposite)) {
        removeEffect(target, opposite);
    } else {
        addEffect(target, type);
    }
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
            prevBarXPx: LANE_W / 2,
            items: [],
            effects: [],
            powerupCooldowns: {},
            nextItemId: 0,
            ticksSinceLastSpawn: 0,
            prevItemY: new Map(),
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
                const halfW = computeBarHalfWidthPx(player);
                player.prevBarXPx = player.barXPx;
                player.barXPx = Math.max(halfW, Math.min(LANE_W - halfW, xFraction * LANE_W));
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

        // Decrement and expire powerup spawn cooldowns
        for (const key of Object.keys(player.powerupCooldowns) as SnusregnItemType[]) {
            player.powerupCooldowns[key]!--;
            if (player.powerupCooldowns[key]! <= 0) {
                delete player.powerupCooldowns[key];
            }
        }

        // 2. Effective fall speed — square-root ramp: fast early increase that tapers off
        const ramp = Math.sqrt(this.tickCount) * FALL_SPEED_INCREMENT;
        const baseSpeed = BASE_FALL_SPEED + ramp;
        // fastRain adds a fixed speed bonus (diminishing relative effect at high speeds)
        const fastBonus = hasEffect(player, 'fastRain') ? BASE_FALL_SPEED * 0.5 : 0;
        let speed = (baseSpeed + fastBonus)
            * (hasEffect(player, 'slowRain') ? 0.7 : 1.0);
        if (speed < 0) speed = 0;

        // 3. Spawn interval — grows with speed so item density stays constant
        const spawnInterval = Math.round(BASE_SPAWN_INTERVAL / (speed / BASE_FALL_SPEED));

        // 4. Move items (capture prevY before advancing for swept collision)
        for (const item of player.items) {
            player.prevItemY.set(item.id, item.y);
            item.y += (speed * item.speedMult) / CANVAS_H;
        }

        // 5. Spawn
        if (player.ticksSinceLastSpawn >= spawnInterval && player.items.length < MAX_ITEMS) {
            const id = `${player.userId}-${player.nextItemId++}`;
            const weights: Record<SnusregnItemType, number> = { ...SPAWN_WEIGHTS };
            for (const key of Object.keys(player.powerupCooldowns) as SnusregnItemType[]) {
                weights[key] = 0;
            }
            const spawnType = weightedRandom(weights);
            const canBeTargeted = !this.isSolo && (
                spawnType === 'wideBar' || spawnType === 'beer' ||
                spawnType === 'fastRain' || spawnType === 'shrinkBar' || spawnType === 'blind'
            );
            player.items.push({
                id,
                type: spawnType,
                x: 0.05 + Math.random() * 0.90,
                y: 0,
                speedMult: 0.85 + Math.random() * 0.15,
                targeted: canBeTargeted && Math.random() < 0.35,
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
            const prevYPx = (player.prevItemY.get(item.id) ?? item.y) * CANVAS_H;

            // Missed — fell off screen (top of item is below bar bottom)
            if (itemYPx - ITEM_RADIUS > barBotYPx) {
                if (item.type === 'fresh' || item.type === 'beerSnus') {
                    player.lives = Math.max(0, player.lives - 1);
                }
                player.prevItemY.delete(item.id);
                player.items.splice(i, 1);
                continue;
            }

            // Standard overlap check
            const vertOverlap = (itemYPx + ITEM_RADIUS >= barTopYPx) && (itemYPx - ITEM_RADIUS <= barBotYPx);
            // Swept pass-through: item center crossed from above bar top to below bar bottom in one tick
            const sweptThrough = prevYPx < barTopYPx && itemYPx > barBotYPx;

            const horizOverlap = (itemXPx + ITEM_RADIUS >= player.barXPx - barHalfW) &&
                (itemXPx - ITEM_RADIUS <= player.barXPx + barHalfW);
            // Horizontal sweep: bar moved sideways over an item that is at bar height
            const barLeft = Math.min(player.prevBarXPx, player.barXPx) - barHalfW;
            const barRight = Math.max(player.prevBarXPx, player.barXPx) + barHalfW;
            const horizSwept = vertOverlap && itemXPx + ITEM_RADIUS >= barLeft && itemXPx - ITEM_RADIUS <= barRight;

            if ((vertOverlap || sweptThrough) && (horizOverlap || horizSwept)) {
                this.resolveCatch(player, item, opponent);
                player.prevItemY.delete(item.id);
                player.items.splice(i, 1);
            }
        }

        // Reset bar sweep origin so next tick only sweeps from the current position
        player.prevBarXPx = player.barXPx;
    }

    private resolveCatch(player: PlayerInternal, item: SnusregnItem, opponent: PlayerInternal): void {
        const t = item.targeted ? opponent : player;
        const o = item.targeted ? player : opponent;
        switch (item.type) {
            case 'fresh': player.score += hasEffect(player, 'beer') ? 3 : 1; break;
            case 'beerSnus': player.score += 3; break;
            case 'spent': player.lives -= 1; break;
            case 'wideBar': applyOrCancel(t, 'wideBar', 'shrinkBar'); break;
            case 'slowRain': applyOrCancel(this.isSolo ? player : o, 'slowRain', 'fastRain'); break;
            case 'fastRain': applyOrCancel(t, 'fastRain', 'slowRain'); break;
            case 'shrinkBar': applyOrCancel(t, 'shrinkBar', 'wideBar'); break;
            case 'blind': addEffect(t, 'blind'); break;
            case 'beer': addEffect(t, 'beer'); break;
        }

        // Prevent the same powerup from spawning again for its effect duration
        if (item.type in EFFECT_DURATIONS) {
            player.powerupCooldowns[item.type] = EFFECT_DURATIONS[item.type as SnusregnEffectType];
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
