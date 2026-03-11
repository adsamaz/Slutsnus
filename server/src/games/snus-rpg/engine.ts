import { GameEngine } from '../registry';
import {
    GameAction,
    GameResult,
    PlayerInfo,
    SnusRpgState,
    SnusPlayer,
    SnusBrand,
    SnusItemOnMap,
    TradeOffer,
} from '@slutsnus/shared';
import { generateMap, placeSnusItems, getSpawnPositions } from './map';
import { SNUS_BRANDS, getBrandById } from './brands';
import { createNpcs, tickNpcs, resolveNpcAttacks, shouldRespawn } from './npc';
import { v4 as uuidv4 } from 'uuid';

const GAME_DURATION_TICKS = 1800;
const TICK_INTERVAL_MS = 100;

export class SnusRpgEngine implements GameEngine {
    private state!: SnusRpgState;
    private onStateUpdate: (state: unknown) => void = () => { };
    private tickInterval?: ReturnType<typeof setInterval>;
    private npcDeathTicks = new Map<string, number>();

    init(roomId: string, players: PlayerInfo[], onStateUpdate: (state: unknown) => void): void {
        this.onStateUpdate = onStateUpdate;

        const { grid, floorTiles } = generateMap();
        const spawnPositions = getSpawnPositions();
        const snusItems = placeSnusItems(floorTiles, SNUS_BRANDS, 40);

        const playerMap: Record<string, SnusPlayer> = {};
        players.forEach((p, i) => {
            const spawn = spawnPositions[i % spawnPositions.length];
            playerMap[p.userId] = {
                userId: p.userId,
                username: p.username,
                x: spawn.x,
                y: spawn.y,
                hp: 100,
                score: 0,
                inventory: [],
                effects: [],
                alive: true,
            };
        });

        const npcCount = Math.max(2, Math.min(6, Math.ceil(players.length / 2)));
        const npcs = createNpcs(npcCount, floorTiles);

        this.state = {
            players: playerMap,
            items: snusItems,
            npcs,
            map: grid,
            tickCount: 0,
            status: 'playing',
            tradeOffers: [],
            timeRemainingTicks: GAME_DURATION_TICKS,
        };

        this.onStateUpdate(this.getState());
        this.tickInterval = setInterval(() => this.tick(), TICK_INTERVAL_MS);
    }

    private tick(): void {
        if (this.state.status !== 'playing') return;

        this.state.tickCount++;
        this.state.timeRemainingTicks--;

        // Move NPCs
        this.state.npcs = tickNpcs(this.state.npcs, this.state.map);

        // NPC attacks
        const attacks = resolveNpcAttacks(this.state.npcs, this.state.players);
        for (const atk of attacks) {
            const p = this.state.players[atk.playerId];
            if (p?.alive) {
                p.hp -= atk.damage;
                if (p.hp <= 0) {
                    p.hp = 0;
                    p.alive = false;
                }
            }
        }

        // Respawn dead NPCs
        this.state.npcs = this.state.npcs.map((npc) => {
            if (npc.hp <= 0) {
                const deathTick = this.npcDeathTicks.get(npc.id) ?? this.state.tickCount;
                if (!this.npcDeathTicks.has(npc.id)) this.npcDeathTicks.set(npc.id, deathTick);

                if (shouldRespawn(this.state.tickCount, deathTick)) {
                    const floorTiles = this.getFloorTiles();
                    if (floorTiles.length > 0) {
                        const tile = floorTiles[Math.floor(Math.random() * floorTiles.length)];
                        this.npcDeathTicks.delete(npc.id);
                        return { ...npc, x: tile.x, y: tile.y, hp: 30 };
                    }
                }
            }
            return npc;
        });

        // Expire trade offers
        this.state.tradeOffers = this.state.tradeOffers.filter(
            (o) => this.state.tickCount < o.expiresAtTick,
        );

        // Decrement effects
        for (const p of Object.values(this.state.players)) {
            p.effects = p.effects
                .map((e) => ({ ...e, remainingTicks: e.remainingTicks - 1 }))
                .filter((e) => e.remainingTicks > 0);
        }

        // Win condition
        if (this.state.timeRemainingTicks <= 0 || this.allItemsCollected()) {
            this.endGame();
            return;
        }

        this.onStateUpdate(this.getState());
    }

    private getFloorTiles(): { x: number; y: number }[] {
        const tiles: { x: number; y: number }[] = [];
        for (let y = 0; y < this.state.map.length; y++) {
            for (let x = 0; x < this.state.map[y].length; x++) {
                if (this.state.map[y][x] === 0) tiles.push({ x, y });
            }
        }
        return tiles;
    }

    private allItemsCollected(): boolean {
        return this.state.items.every((i) => i.collected);
    }

    private endGame(): void {
        const sorted = Object.values(this.state.players).sort((a, b) => b.score - a.score);
        const results: GameResult[] = sorted.map((p, i) => ({
            userId: p.userId,
            username: p.username,
            score: p.score,
            rank: i + 1,
        }));
        this.state.status = 'ended';
        this.state.results = results;
        this.onStateUpdate(this.getState());
        this.destroy();
    }

    handleEvent(playerId: string, action: GameAction): void {
        if (this.state.status !== 'playing') return;
        const player = this.state.players[playerId];
        if (!player) return;

        switch (action.type) {
            case 'move':
                this.handleMove(playerId, action.payload as { direction: string });
                break;
            case 'attack':
                this.handleAttack(playerId);
                break;
            case 'tradeOffer':
                this.handleTradeOffer(
                    playerId,
                    action.payload as { targetPlayerId: string; inventoryIndex: number; displayedName: string },
                );
                break;
            case 'tradeAccept':
                this.handleTradeAccept(playerId, action.payload as { tradeOfferId: string });
                break;
            case 'tradeDecline':
                this.handleTradeDecline(playerId, action.payload as { tradeOfferId: string });
                break;
        }

        this.onStateUpdate(this.getState());
    }

    private handleMove(playerId: string, payload: { direction: string }): void {
        const player = this.state.players[playerId];
        if (!player?.alive) return;

        const hasShake = player.effects.some((e) => e.type === 'shake');
        if (hasShake && this.state.tickCount % 2 !== 0) return;

        const dirs: Record<string, { dx: number; dy: number }> = {
            up: { dx: 0, dy: -1 },
            down: { dx: 0, dy: 1 },
            left: { dx: -1, dy: 0 },
            right: { dx: 1, dy: 0 },
        };
        const dir = dirs[payload.direction];
        if (!dir) return;

        const nx = player.x + dir.dx;
        const ny = player.y + dir.dy;

        if (
            nx < 0 ||
            ny < 0 ||
            ny >= this.state.map.length ||
            nx >= this.state.map[0].length ||
            this.state.map[ny][nx] === 1
        ) {
            return;
        }

        player.x = nx;
        player.y = ny;

        const item = this.state.items.find((i) => i.x === nx && i.y === ny && !i.collected);
        if (item) this.collectItem(player, item);
    }

    private collectItem(player: SnusPlayer, item: SnusItemOnMap): void {
        const brand = getBrandById(item.brandId);
        if (!brand) return;
        item.collected = true;
        player.inventory.push(brand);
        player.score += brand.value;
        this.applyBrandEffects(player, brand);
    }

    private applyBrandEffects(player: SnusPlayer, brand: SnusBrand): void {
        player.effects = player.effects.filter(
            (e) => e.type !== 'nicotine_boost' && e.type !== 'shake',
        );

        const boostDuration = brand.pouchSize === 'slim' ? 30 : brand.pouchSize === 'regular' ? 50 : 80;
        player.effects.push({ type: 'nicotine_boost', remainingTicks: boostDuration, value: brand.nicotineStrength });

        if (brand.nicotineStrength >= 7) {
            player.effects.push({
                type: 'shake',
                remainingTicks: brand.nicotineStrength * 8,
                value: brand.nicotineStrength,
            });
        }
    }

    private handleAttack(playerId: string): void {
        const player = this.state.players[playerId];
        if (!player?.alive) return;

        for (const npc of this.state.npcs) {
            if (npc.hp <= 0) continue;
            const dist = Math.abs(npc.x - player.x) + Math.abs(npc.y - player.y);
            if (dist === 1) {
                const boost = player.effects.find((e) => e.type === 'nicotine_boost');
                const base = 20 + Math.floor(Math.random() * 11);
                npc.hp -= boost ? base + boost.value * 0.5 : base;
                if (npc.hp <= 0) this.npcDeathTicks.set(npc.id, this.state.tickCount);
                break;
            }
        }
    }

    private handleTradeOffer(
        playerId: string,
        payload: { targetPlayerId: string; inventoryIndex: number; displayedName: string },
    ): void {
        const from = this.state.players[playerId];
        const to = this.state.players[payload.targetPlayerId];
        if (!from || !to) return;

        const dist = Math.abs(from.x - to.x) + Math.abs(from.y - to.y);
        if (dist > 3) return;

        const { inventoryIndex, displayedName, targetPlayerId } = payload;
        if (inventoryIndex < 0 || inventoryIndex >= from.inventory.length) return;

        const brand = from.inventory[inventoryIndex];
        const offer: TradeOffer = {
            id: uuidv4(),
            fromPlayerId: playerId,
            toPlayerId: targetPlayerId,
            realBrandId: brand.id,
            displayedName,
            expiresAtTick: this.state.tickCount + 100,
        };
        this.state.tradeOffers.push(offer);
    }

    private handleTradeAccept(playerId: string, payload: { tradeOfferId: string }): void {
        const offer = this.state.tradeOffers.find((o) => o.id === payload.tradeOfferId);
        if (!offer || offer.toPlayerId !== playerId) return;
        if (this.state.tickCount >= offer.expiresAtTick) return;

        const from = this.state.players[offer.fromPlayerId];
        const to = this.state.players[offer.toPlayerId];
        if (!from || !to) return;

        const idx = from.inventory.findIndex((b) => b.id === offer.realBrandId);
        if (idx === -1) return;

        const [brand] = from.inventory.splice(idx, 1);
        from.score -= brand.value;
        to.inventory.push(brand);
        to.score += brand.value;
        this.applyBrandEffects(to, brand);
        this.state.tradeOffers = this.state.tradeOffers.filter((o) => o.id !== offer.id);
    }

    private handleTradeDecline(playerId: string, payload: { tradeOfferId: string }): void {
        this.state.tradeOffers = this.state.tradeOffers.filter(
            (o) => !(o.id === payload.tradeOfferId && o.toPlayerId === playerId),
        );
    }

    getState(): unknown {
        return this.state;
    }

    destroy(): void {
        if (this.tickInterval) {
            clearInterval(this.tickInterval);
            this.tickInterval = undefined;
        }
    }
}
