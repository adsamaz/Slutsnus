import type { ArenaObstacle } from '@slutsnus/shared';

const WALL_T = 16;
const W = 800;
const H = 600;

const BORDERS: ArenaObstacle[] = [
    { x: 0,        y: 0,        w: W,     h: WALL_T }, // top
    { x: 0,        y: H - WALL_T, w: W,   h: WALL_T }, // bottom
    { x: 0,        y: 0,        w: WALL_T, h: H },      // left
    { x: W - WALL_T, y: 0,      w: WALL_T, h: H },      // right
];

const PILLARS: ArenaObstacle[] = [
    { x: 375, y: 250, w: 50, h: 100 },  // center cross
    { x: 160, y: 130, w: 60, h: 60 },   // top-left quadrant
    { x: 580, y: 130, w: 60, h: 60 },   // top-right quadrant
    { x: 160, y: 410, w: 60, h: 60 },   // bottom-left quadrant
    { x: 580, y: 410, w: 60, h: 60 },   // bottom-right quadrant
    { x: 280, y: 190, w: 30, h: 80 },   // mid-lane blocker left
    { x: 490, y: 330, w: 30, h: 80 },   // mid-lane blocker right
];

export const ARENA_OBSTACLES: ArenaObstacle[] = [...BORDERS, ...PILLARS];

export const POWERUP_SPAWN_LOCATIONS: { x: number; y: number; type: 'heal' | 'damage-boost' }[] = [
    { x: 400, y: 420, type: 'heal' },
    { x: 120, y: 300, type: 'damage-boost' },
    { x: 680, y: 300, type: 'damage-boost' },
];

export const SPAWN_POINTS: Record<string, { x: number; y: number }> = {
    alpha: { x: 80,  y: 80  },
    beta:  { x: 720, y: 520 },
};
