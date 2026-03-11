import { NpcState, SnusPlayer } from '@slutsnus/shared';
import { v4 as uuidv4 } from 'uuid';

const MAP_WIDTH = 25;
const MAP_HEIGHT = 25;

const DIRECTIONS = [
    { dx: 1, dy: 0 },
    { dx: -1, dy: 0 },
    { dx: 0, dy: 1 },
    { dx: 0, dy: -1 },
];

function isWall(grid: number[][], x: number, y: number): boolean {
    if (x < 0 || x >= MAP_WIDTH || y < 0 || y >= MAP_HEIGHT) return true;
    return grid[y][x] === 1;
}

function getValidDirections(grid: number[][], x: number, y: number): { dx: number; dy: number }[] {
    return DIRECTIONS.filter((d) => !isWall(grid, x + d.dx, y + d.dy));
}

export function createNpcs(count: number, floorTiles: { x: number; y: number }[]): NpcState[] {
    const shuffled = [...floorTiles].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, Math.min(count, shuffled.length)).map((tile) => ({
        id: uuidv4(),
        x: tile.x,
        y: tile.y,
        hp: 30,
        type: 'nicotine_pouch' as const,
        patrolDir: DIRECTIONS[Math.floor(Math.random() * DIRECTIONS.length)],
    }));
}

export function tickNpcs(npcs: NpcState[], grid: number[][]): NpcState[] {
    return npcs.map((npc) => {
        if (npc.hp <= 0) return npc;

        const nextX = npc.x + npc.patrolDir.dx;
        const nextY = npc.y + npc.patrolDir.dy;

        if (isWall(grid, nextX, nextY)) {
            const validDirs = getValidDirections(grid, npc.x, npc.y);
            const newDir =
                validDirs.length > 0
                    ? validDirs[Math.floor(Math.random() * validDirs.length)]
                    : npc.patrolDir;
            return { ...npc, patrolDir: newDir };
        }

        return { ...npc, x: nextX, y: nextY };
    });
}

export interface NpcAttackEvent {
    npcId: string;
    playerId: string;
    damage: number;
}

export function resolveNpcAttacks(
    npcs: NpcState[],
    players: Record<string, SnusPlayer>,
): NpcAttackEvent[] {
    const attacks: NpcAttackEvent[] = [];

    for (const npc of npcs) {
        if (npc.hp <= 0) continue;
        for (const playerId in players) {
            const player = players[playerId];
            if (!player.alive) continue;
            const distance = Math.abs(npc.x - player.x) + Math.abs(npc.y - player.y);
            if (distance === 1) {
                attacks.push({
                    npcId: npc.id,
                    playerId,
                    damage: 10 + Math.floor(Math.random() * 6),
                });
            }
        }
    }

    return attacks;
}

export function shouldRespawn(tickCount: number, deathTick: number): boolean {
    return tickCount - deathTick >= 300;
}
