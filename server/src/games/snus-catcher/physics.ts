import type { SenusCatcherObject, SenusCatcherPlayerState } from '@slutsnus/shared';

export const PHYSICS = {
    FALL_SPEED_PER_TICK: 0.008,
    SPAWN_CHANCE_PER_TICK: 0.15,
    SPENT_POUCH_FRACTION: 0.3,
    BAR_WIDTH_FRACTION: 0.15,
    COLLISION_Y_THRESHOLD: 0.88,
    INITIAL_LIVES: 3,
    TICK_MS: 50,
} as const;

export function spawnObject(playerIndex: number, tickCount: number): SenusCatcherObject {
    const isSpent = Math.random() < PHYSICS.SPENT_POUCH_FRACTION;
    return {
        id: `p${playerIndex}-t${tickCount}-${Math.random().toString(36).slice(2, 7)}`,
        type: isSpent ? 'spent' : 'fresh',
        x: Math.random(),
        y: 0.0,
    };
}

export function moveObjects(objects: SenusCatcherObject[]): SenusCatcherObject[] {
    return objects
        .map(obj => ({ ...obj, y: obj.y + PHYSICS.FALL_SPEED_PER_TICK }))
        .filter(obj => obj.y < 1.1);
}

export function resolveCollisions(
    player: SenusCatcherPlayerState,
    objects: SenusCatcherObject[],
): { updatedPlayer: SenusCatcherPlayerState; remainingObjects: SenusCatcherObject[] } {
    let { score, lives } = player;
    const halfBar = PHYSICS.BAR_WIDTH_FRACTION / 2;
    const remaining: SenusCatcherObject[] = [];

    for (const obj of objects) {
        const inCatchZone = obj.y >= PHYSICS.COLLISION_Y_THRESHOLD;
        const barOverlaps = Math.abs(obj.x - player.barXFraction) <= halfBar;

        if (inCatchZone && barOverlaps) {
            if (obj.type === 'fresh') {
                score++;
            } else {
                lives = Math.max(0, lives - 1);
            }
            // object is consumed — do not add to remaining
        } else {
            remaining.push(obj);
        }
    }

    return {
        updatedPlayer: { ...player, score, lives },
        remainingObjects: remaining,
    };
}
