import type {
    PlayerInfo, GameAction, GameResult,
    FactoryState, FactoryStation, FactoryPlayer, FactorySnusPouch,
    FactoryItemType, StationType, SnusFlavorType, FactoryDifficulty,
} from '@slutsnus/shared';
import type { GameEngine, GameEngineOptions } from '../registry';
import {
    TICK_MS, CANVAS_W, CANVAS_H,
    GAME_DURATION_TICKS, TARGET_SCORE,
    PLAYER_SPEED, PLAYER_RADIUS, PLAYER_INTERACT_RADIUS,
    PLAYER_MIN_X, PLAYER_MAX_X, PLAYER_MIN_Y, PLAYER_MAX_Y,
    PLANTER_REFILL_TICKS, PATCH_GROW_TICKS,
    GRINDER_PROCESS_TICKS, PACKAGER_PROCESS_TICKS,
    ORDER_SPAWN_MIN_TICKS, ORDER_SPAWN_MAX_TICKS,
    ORDER_EXPIRY_TICKS, ORDER_EXPIRY_PENALTY, ORDER_FULFILL_SCORE,
    FLAVORS,
    STATION_CENTERS, PLAYER_SPAWN_POSITIONS, ORDER_INTERACT_RADIUS,
    POUCH_SPAWN_INTERVAL_TICKS, POUCH_COLLECT_RADIUS,
    POUCH_INITIAL_SPEED, POUCH_SPEED_INCREMENT,
    POUCH_SPEED_BOOST_TICKS, POUCH_SPEED_BOOST_MULT,
} from './constants';

interface PlayerInternal {
    info: PlayerInfo;
    x: number;
    y: number;
    carrying: FactoryItemType | null;
    colorIndex: number;
    inputDx: number;
    inputDy: number;
    pendingInteract: boolean;
    wasInteracting: boolean;
    speedBoostTicks: number;
}

interface StationInternal {
    id: StationType;
    state: number;
    hasItem: boolean;
    itemFlavor: SnusFlavorType | null;
    leafLoaded: boolean;
    flavorLoaded: SnusFlavorType | null;
    occupiedByPlayerId: string | null;
}

function randInt(min: number, max: number): number {
    return Math.floor(min + Math.random() * (max - min + 1));
}

function flavorFromItem(item: FactoryItemType): SnusFlavorType | null {
    if (item.startsWith('flavor-')) return item.slice(7) as SnusFlavorType;
    if (item.startsWith('ground-')) return item.slice(7) as SnusFlavorType;
    if (item.startsWith('can-'))    return item.slice(4) as SnusFlavorType;
    return null;
}

const DIFFICULTY_CONFIG: Record<FactoryDifficulty, {
    durationTicks: number;
    targetScore: number;
    orderSpawnMinTicks: number;
    orderSpawnMaxTicks: number;
    orderExpiryTicks: number;
}> = {
    easy:   { durationTicks: 12000, targetScore: 15, orderSpawnMinTicks: 550, orderSpawnMaxTicks: 800, orderExpiryTicks: 2000 },
    medium: { durationTicks: GAME_DURATION_TICKS, targetScore: TARGET_SCORE, orderSpawnMinTicks: ORDER_SPAWN_MIN_TICKS, orderSpawnMaxTicks: ORDER_SPAWN_MAX_TICKS, orderExpiryTicks: ORDER_EXPIRY_TICKS },
    hard:   { durationTicks: 6000, targetScore: 25, orderSpawnMinTicks: 250, orderSpawnMaxTicks: 400, orderExpiryTicks: 1000 },
};

export class SnusFactoryEngine implements GameEngine {
    private players: Map<string, PlayerInternal> = new Map();
    private stations: Map<StationType, StationInternal> = new Map();
    private score = 0;
    private tickCount = 0;
    private timeRemainingTicks = GAME_DURATION_TICKS;
    private status: 'playing' | 'ended' = 'playing';
    private results: GameResult[] | undefined;
    private interval: ReturnType<typeof setInterval> | null = null;
    private onStateUpdate: ((state: unknown) => void) | null = null;
    private startTime = 0;
    private nextOrderSpawnTick = 0;
    private difficulty: FactoryDifficulty = 'medium';
    private cfg = DIFFICULTY_CONFIG.medium;
    private snusPouch: FactorySnusPouch | null = null;
    private nextPouchSpawnTick = 0;
    private pouchSpawnCount = 0;

    init(_roomId: string, players: PlayerInfo[], onStateUpdate: (state: unknown) => void, options?: GameEngineOptions): void {
        this.difficulty = options?.difficulty ?? 'medium';
        const baseCfg = DIFFICULTY_CONFIG[this.difficulty];
        // Scale difficulty with player count: more players → more orders, higher target
        const n = players.length;
        const scoreScale = 1 + (n - 1) * 0.6;          // +60% target per extra player
        const spawnScale = 1 - (n - 1) * 0.2;           // 20% faster spawns per extra player (lower = faster)
        const expiryScale = 1 - (n - 1) * 0.1;          // 10% shorter expiry per extra player
        this.cfg = {
            durationTicks: baseCfg.durationTicks,
            targetScore: Math.round(baseCfg.targetScore * scoreScale),
            orderSpawnMinTicks: Math.round(baseCfg.orderSpawnMinTicks * Math.max(spawnScale, 0.4)),
            orderSpawnMaxTicks: Math.round(baseCfg.orderSpawnMaxTicks * Math.max(spawnScale, 0.4)),
            orderExpiryTicks: Math.round(baseCfg.orderExpiryTicks * Math.max(expiryScale, 0.6)),
        };
        this.timeRemainingTicks = this.cfg.durationTicks;
        this.onStateUpdate = onStateUpdate;

        // Place players
        players.forEach((p, i) => {
            const spawn = PLAYER_SPAWN_POSITIONS[i] ?? { x: CANVAS_W / 2, y: CANVAS_H / 2 };
            this.players.set(p.userId, {
                info: p,
                x: spawn.x,
                y: spawn.y,
                carrying: null,
                colorIndex: i % 4,
                inputDx: 0,
                inputDy: 0,
                pendingInteract: false,
                wasInteracting: false,
                speedBoostTicks: 0,
            });
        });

        // Init stations
        const allStationIds: StationType[] = [
            'planter-l', 'planter-r',
            'patch-1', 'patch-2', 'patch-3',
            'flavor-shelf-mint', 'flavor-shelf-juniper', 'flavor-shelf-licorice',
            'grinder', 'packager',
            'order-0', 'order-1', 'order-2',
            'storage-l-1', 'storage-l-2', 'storage-r-1', 'storage-r-2',
        ];

        for (const id of allStationIds) {
            const isFlavorShelf = id.startsWith('flavor-shelf-');
            const isOrderSlot = id.startsWith('order-');
            this.stations.set(id, {
                id,
                state: isOrderSlot ? -1 : 0,
                hasItem: isFlavorShelf,               // flavor shelves always have stock
                itemFlavor: isFlavorShelf ? (id.split('-')[2] as SnusFlavorType) : null,
                leafLoaded: false,
                flavorLoaded: null,
                occupiedByPlayerId: null,
            });
        }

        // Planters start stocked
        const planterL = this.stations.get('planter-l')!;
        const planterR = this.stations.get('planter-r')!;
        planterL.hasItem = true;
        planterR.hasItem = true;

        // Delay first order spawn
        this.nextOrderSpawnTick = 250; // ~5s

        // First pouch spawns after 15s
        this.nextPouchSpawnTick = POUCH_SPAWN_INTERVAL_TICKS;
        this.pouchSpawnCount = 0;
        this.snusPouch = null;

        this.startTime = Date.now();
        this.interval = setInterval(() => this.tick(), TICK_MS);
    }

    handleEvent(playerId: string, action: GameAction): void {
        const player = this.players.get(playerId);
        if (!player || this.status !== 'playing') return;

        if (action.type === 'factory:move') {
            const payload = action.payload as { dx: number; dy: number };
            player.inputDx = Math.max(-1, Math.min(1, payload.dx));
            player.inputDy = Math.max(-1, Math.min(1, payload.dy));
        } else if (action.type === 'factory:interact') {
            const payload = action.payload as { interacting: boolean };
            const nowInteracting = payload.interacting;
            // Edge detect: trigger interact on keydown (false→true transition)
            if (nowInteracting && !player.wasInteracting) {
                player.pendingInteract = true;
            }
            player.wasInteracting = nowInteracting;
        } else if (action.type === 'factory:drop') {
            player.carrying = null;
        } else if (action.type === 'factory:grinder-slot-pickup') {
            const payload = action.payload as { slot: 'leaf' | 'flavor' };
            const grinder = this.stations.get('grinder')!;
            if (grinder.state === 0 && !grinder.hasItem) {
                if (payload.slot === 'leaf' && grinder.leafLoaded && player.carrying === null) {
                    player.carrying = 'ripe-leaf';
                    grinder.leafLoaded = false;
                } else if (payload.slot === 'flavor' && grinder.flavorLoaded && player.carrying === null) {
                    player.carrying = `flavor-${grinder.flavorLoaded}` as FactoryItemType;
                    grinder.flavorLoaded = null;
                }
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

        // 1. Move players
        for (const player of this.players.values()) {
            const { inputDx, inputDy } = player;
            if (inputDx === 0 && inputDy === 0) continue;
            const len = Math.sqrt(inputDx * inputDx + inputDy * inputDy);
            const nx = inputDx / len;
            const ny = inputDy / len;
            const speedMult = player.speedBoostTicks > 0 ? POUCH_SPEED_BOOST_MULT : 1;
            player.x = Math.max(PLAYER_MIN_X, Math.min(PLAYER_MAX_X, player.x + nx * PLAYER_SPEED * speedMult));
            player.y = Math.max(PLAYER_MIN_Y, Math.min(PLAYER_MAX_Y, player.y + ny * PLAYER_SPEED * speedMult));
            if (player.speedBoostTicks > 0) player.speedBoostTicks--;
        }

        // 2. Process interactions
        for (const player of this.players.values()) {
            if (!player.pendingInteract) continue;
            player.pendingInteract = false;
            this.resolveInteraction(player);
        }

        // 3. Station timers
        for (const station of this.stations.values()) {
            if (station.id === 'planter-l' || station.id === 'planter-r') {
                // Refill countdown
                if (!station.hasItem && station.state > 0) {
                    station.state--;
                    if (station.state === 0) station.hasItem = true;
                }
            } else if (station.id.startsWith('patch-')) {
                // Grow countdown
                if (station.state > 0) {
                    station.state--;
                    if (station.state === 0) {
                        station.state = -1; // ripe
                        station.hasItem = true;
                    }
                }
            } else if (station.id === 'grinder' || station.id === 'packager') {
                // Processing countdown
                if (station.state > 0) {
                    station.state--;
                    if (station.state === 0) {
                        station.hasItem = true;
                        station.occupiedByPlayerId = null;
                    }
                }
            } else if (station.id.startsWith('order-')) {
                // Order expiry countdown
                if (station.state > 0) {
                    station.state--;
                    if (station.state === 0) {
                        // Order expired
                        this.score = Math.max(0, this.score - ORDER_EXPIRY_PENALTY);
                        station.state = -1;
                        station.hasItem = false;
                        station.itemFlavor = null;
                    }
                }
            }
        }

        // 4. Spawn new orders
        if (this.tickCount >= this.nextOrderSpawnTick) {
            const spawned = this.spawnOrder();
            if (spawned) {
                this.nextOrderSpawnTick = this.tickCount + randInt(this.cfg.orderSpawnMinTicks, this.cfg.orderSpawnMaxTicks);
            }
        }

        // 4b. Snus pouch: spawn, move, collect
        if (!this.snusPouch && this.tickCount >= this.nextPouchSpawnTick) {
            this.pouchSpawnCount++;
            const speed = POUCH_INITIAL_SPEED + (this.pouchSpawnCount - 1) * POUCH_SPEED_INCREMENT;
            // Spawn at random edge position
            const edge = Math.floor(Math.random() * 4);
            let px: number, py: number;
            if (edge === 0)      { px = Math.random() * CANVAS_W; py = PLAYER_MIN_Y + 20; }
            else if (edge === 1) { px = Math.random() * CANVAS_W; py = PLAYER_MAX_Y - 20; }
            else if (edge === 2) { px = PLAYER_MIN_X + 20;       py = Math.random() * CANVAS_H; }
            else                 { px = PLAYER_MAX_X - 20;       py = Math.random() * CANVAS_H; }
            this.snusPouch = { x: px!, y: py!, speed, active: true };
        }

        if (this.snusPouch) {
            // Move toward nearest player
            let nearestPlayer: PlayerInternal | null = null;
            let nearestDist = Infinity;
            for (const p of this.players.values()) {
                const d = Math.hypot(p.x - this.snusPouch.x, p.y - this.snusPouch.y);
                if (d < nearestDist) { nearestDist = d; nearestPlayer = p; }
            }
            if (nearestPlayer) {
                const dx = nearestPlayer.x - this.snusPouch.x;
                const dy = nearestPlayer.y - this.snusPouch.y;
                const len = Math.hypot(dx, dy);
                if (len > 0) {
                    this.snusPouch.x += (dx / len) * this.snusPouch.speed;
                    this.snusPouch.y += (dy / len) * this.snusPouch.speed;
                }
                // Collect if player touches it
                if (nearestDist < POUCH_COLLECT_RADIUS) {
                    nearestPlayer.speedBoostTicks = POUCH_SPEED_BOOST_TICKS;
                    this.snusPouch = null;
                    this.nextPouchSpawnTick = this.tickCount + POUCH_SPAWN_INTERVAL_TICKS;
                }
            }
        }

        // 5. Time
        this.timeRemainingTicks--;
        if (this.timeRemainingTicks <= 0) {
            this.endGame();
            return;
        }

        this.onStateUpdate?.(this.buildState());
    }

    private resolveInteraction(player: PlayerInternal): void {
        // Find nearest station within interact radius
        let nearest: StationInternal | null = null;
        let nearestDist = Infinity;

        for (const station of this.stations.values()) {
            const center = STATION_CENTERS[station.id];
            const dist = Math.hypot(player.x - center.x, player.y - center.y);
            const radius = station.id.startsWith('order-') ? ORDER_INTERACT_RADIUS : PLAYER_INTERACT_RADIUS;
            if (dist < radius && dist < nearestDist) {
                nearestDist = dist;
                nearest = station;
            }
        }

        if (!nearest) return;
        const station = nearest;
        const carrying = player.carrying;

        if (station.id === 'planter-l' || station.id === 'planter-r') {
            if (carrying === null && station.hasItem) {
                player.carrying = 'leaf';
                station.hasItem = false;
                station.state = PLANTER_REFILL_TICKS;
            } else if (carrying === 'leaf' && !station.hasItem) {
                // Return leaf to planter
                player.carrying = null;
                station.hasItem = true;
                station.state = 0;
            }
        } else if (station.id.startsWith('patch-')) {
            if (carrying === 'leaf' && station.state === 0) {
                // Plant leaf
                player.carrying = null;
                station.state = PATCH_GROW_TICKS;
                station.hasItem = false;
            } else if (carrying === null && station.state === -1) {
                // Harvest ripe leaf
                player.carrying = 'ripe-leaf';
                station.state = 0;
                station.hasItem = false;
            } else if (carrying === 'ripe-leaf' && station.state === 0) {
                // Return ripe leaf to patch
                player.carrying = null;
                station.state = -1;
                station.hasItem = true;
            }
        } else if (station.id.startsWith('flavor-shelf-')) {
            if (carrying === null) {
                const flavor = station.itemFlavor!;
                player.carrying = `flavor-${flavor}` as FactoryItemType;
                // Shelf is infinite — keep hasItem=true, no state change
            } else if (carrying.startsWith('flavor-') && flavorFromItem(carrying) === station.itemFlavor) {
                // Return flavor to its shelf (shelf is infinite, just discard)
                player.carrying = null;
            }
        } else if (station.id === 'grinder') {
            if (carrying === 'ripe-leaf' && !station.leafLoaded && station.state === 0 && !station.hasItem) {
                // Load leaf — if flavor already waiting, start grinding immediately
                player.carrying = null;
                if (station.flavorLoaded !== null) {
                    station.itemFlavor = station.flavorLoaded;
                    station.flavorLoaded = null;
                    station.state = GRINDER_PROCESS_TICKS;
                    station.occupiedByPlayerId = player.info.userId;
                } else {
                    station.leafLoaded = true;
                }
            } else if (carrying === null && station.leafLoaded && station.state === 0 && !station.hasItem) {
                // Grind without flavor → original
                station.leafLoaded = false;
                station.itemFlavor = 'original';
                station.state = GRINDER_PROCESS_TICKS;
                station.occupiedByPlayerId = player.info.userId;
            } else if (
                carrying !== null &&
                carrying.startsWith('flavor-') &&
                station.state === 0 &&
                !station.hasItem &&
                station.flavorLoaded === null
            ) {
                const flavor = flavorFromItem(carrying)!;
                player.carrying = null;
                if (station.leafLoaded) {
                    // Leaf already loaded → start grinding immediately
                    station.leafLoaded = false;
                    station.itemFlavor = flavor;
                    station.state = GRINDER_PROCESS_TICKS;
                    station.occupiedByPlayerId = player.info.userId;
                } else {
                    // Pre-load flavor, wait for leaf
                    station.flavorLoaded = flavor;
                }
            } else if (carrying === null && station.hasItem) {
                // Pick up ground tobacco
                player.carrying = `ground-${station.itemFlavor}` as FactoryItemType;
                station.hasItem = false;
                station.itemFlavor = null;
            } else if (carrying !== null && carrying.startsWith('ground-') && !station.hasItem && station.state === 0) {
                // Return ground tobacco to grinder output
                player.carrying = null;
                station.hasItem = true;
                station.itemFlavor = flavorFromItem(carrying);
            }
        } else if (station.id === 'packager') {
            if (carrying !== null && carrying.startsWith('ground-') && station.state === 0 && !station.hasItem) {
                // Start packaging
                const flavor = flavorFromItem(carrying)!;
                player.carrying = null;
                station.itemFlavor = flavor;
                station.state = PACKAGER_PROCESS_TICKS;
                station.occupiedByPlayerId = player.info.userId;
            } else if (carrying === null && station.hasItem) {
                // Pick up can
                player.carrying = `can-${station.itemFlavor}` as FactoryItemType;
                station.hasItem = false;
                station.itemFlavor = null;
            } else if (carrying !== null && carrying.startsWith('can-') && !station.hasItem && station.state === 0) {
                // Return can to packager output
                player.carrying = null;
                station.hasItem = true;
                station.itemFlavor = flavorFromItem(carrying);
            }
        } else if (station.id === 'storage-l-1' || station.id === 'storage-l-2' || station.id === 'storage-r-1' || station.id === 'storage-r-2') {
            if (carrying !== null && !station.hasItem) {
                // Deposit item
                player.carrying = null;
                station.hasItem = true;
                station.itemFlavor = flavorFromItem(carrying);
                station.state = carrying.startsWith('leaf') ? 0 :
                    carrying.startsWith('ripe') ? 1 :
                    carrying.startsWith('flavor') ? 2 :
                    carrying.startsWith('ground') ? 3 : 4; // encode item kind: 0=leaf,1=ripe-leaf,2=flavor-*,3=ground-*,4=can-*
                // store full item type in flavorLoaded slot (repurposed as string carrier)
                station.flavorLoaded = carrying as unknown as SnusFlavorType;
            } else if (carrying === null && station.hasItem) {
                // Pick up stored item
                player.carrying = station.flavorLoaded as unknown as FactoryItemType;
                station.hasItem = false;
                station.itemFlavor = null;
                station.flavorLoaded = null;
                station.state = 0;
            } else if (carrying !== null && station.hasItem) {
                // Swap: put down current, pick up stored
                const stored = station.flavorLoaded as unknown as FactoryItemType;
                station.flavorLoaded = carrying as unknown as SnusFlavorType;
                station.itemFlavor = flavorFromItem(carrying);
                player.carrying = stored;
            }
        } else if (station.id.startsWith('order-')) {
            if (carrying !== null && carrying.startsWith('can-') && station.state > 0) {
                const canFlavor = flavorFromItem(carrying)!;
                if (station.itemFlavor === canFlavor) {
                    // Correct! Fulfill order
                    player.carrying = null;
                    this.score += ORDER_FULFILL_SCORE;
                    station.state = -1;
                    station.hasItem = false;
                    station.itemFlavor = null;
                }
                // Wrong flavor → no-op (player keeps can)
            }
        }
    }

    private spawnOrder(): boolean {
        for (const id of ['order-0', 'order-1', 'order-2'] as StationType[]) {
            const slot = this.stations.get(id)!;
            if (slot.state === -1) {
                // Empty slot — fill it
                const flavor = FLAVORS[Math.floor(Math.random() * FLAVORS.length)]!;
                slot.state = this.cfg.orderExpiryTicks;
                slot.hasItem = false;
                slot.itemFlavor = flavor;
                return true;
            }
        }
        return false; // all slots full
    }

    private endGame(): void {
        this.status = 'ended';
        const timeTakenMs = Date.now() - this.startTime;
        const rank = this.score >= this.cfg.targetScore ? 1 : 2;

        this.results = Array.from(this.players.values()).map(p => ({
            userId: p.info.userId,
            username: p.info.username,
            score: this.score,
            rank,
            timeTakenMs,
        }));

        this.onStateUpdate?.(this.buildState());
        this.destroy();
    }

    private buildState(): FactoryState {
        const players: FactoryPlayer[] = Array.from(this.players.values()).map(p => ({
            userId: p.info.userId,
            username: p.info.username,
            x: p.x,
            y: p.y,
            carrying: p.carrying,
            colorIndex: p.colorIndex,
            interacting: p.wasInteracting,
            speedBoostTicks: p.speedBoostTicks,
        }));

        const stations: FactoryStation[] = Array.from(this.stations.values()).map(s => ({
            id: s.id,
            state: s.state,
            hasItem: s.hasItem,
            itemFlavor: s.itemFlavor,
            leafLoaded: s.leafLoaded,
            flavorLoaded: s.flavorLoaded,
            occupiedByPlayerId: s.occupiedByPlayerId,
        }));

        return {
            status: this.status,
            tickCount: this.tickCount,
            timeRemainingTicks: this.timeRemainingTicks,
            score: this.score,
            targetScore: this.cfg.targetScore,
            difficulty: this.difficulty,
            players,
            stations,
            snusPouch: this.snusPouch,
            results: this.results,
        };
    }
}
