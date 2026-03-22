import type { SnusFlavorType, StationType } from '@slutsnus/shared';

export const TICK_MS = 20;
export const CANVAS_W = 1600;
export const CANVAS_H = 960;

export const GAME_DURATION_TICKS = 9000;  // 3 minutes
export const TARGET_SCORE = 20;

export const PLAYER_SPEED = 8.0;
export const PLAYER_RADIUS = 20;
export const PLAYER_INTERACT_RADIUS = 100;
export const ORDER_INTERACT_RADIUS = 180;

export const PLANTER_REFILL_TICKS = 400;    // 8s
export const PATCH_GROW_TICKS = 300;         // 6s
export const GRINDER_PROCESS_TICKS = 80;     // 1.6s
export const PACKAGER_PROCESS_TICKS = 60;    // 1.2s

export const ORDER_SPAWN_MIN_TICKS = 400;   // ~8s
export const ORDER_SPAWN_MAX_TICKS = 600;   // ~12s
export const ORDER_EXPIRY_TICKS = 1500;     // 30s
export const ORDER_EXPIRY_PENALTY = 1;
export const ORDER_FULFILL_SCORE = 2;

export const FLAVORS: SnusFlavorType[] = ['mint', 'juniper', 'licorice', 'original'];

export const POUCH_SPAWN_INTERVAL_TICKS = 1500; // 30s
export const POUCH_COLLECT_RADIUS = 30;
export const POUCH_INITIAL_SPEED = 1.5;
export const POUCH_SPEED_INCREMENT = 0.5; // added each spawn
export const POUCH_SPEED_BOOST_TICKS = 250; // 5s speed boost on collect
export const POUCH_SPEED_BOOST_MULT = 2.0;  // 2× player speed while boosted
export const MAX_ACTIVE_ORDERS = 3;

export const PLAYER_MIN_X = PLAYER_RADIUS;
export const PLAYER_MAX_X = CANVAS_W - PLAYER_RADIUS;
export const PLAYER_MIN_Y = PLAYER_RADIUS;
export const PLAYER_MAX_Y = CANVAS_H - PLAYER_RADIUS;

export const STATION_CENTERS: Record<StationType, { x: number; y: number }> = {
    'planter-l':             { x: 130,  y: 170 },
    'planter-r':             { x: 1470, y: 170 },
    'patch-1':               { x: 525,  y: 165 },
    'patch-2':               { x: 800,  y: 165 },
    'patch-3':               { x: 1075, y: 165 },
    'flavor-shelf-mint':     { x: 535,  y: 355 },
    'flavor-shelf-juniper':  { x: 800,  y: 355 },
    'flavor-shelf-licorice': { x: 1065, y: 355 },
    'grinder':               { x: 650,  y: 570 },
    'packager':              { x: 950,  y: 570 },
    'order-0':               { x: 300,  y: 835 },
    'order-1':               { x: 800,  y: 835 },
    'order-2':               { x: 1300, y: 835 },
    'storage-l-1':           { x: 280,  y: 450 },
    'storage-l-2':           { x: 280,  y: 570 },
    'storage-r-1':           { x: 1320, y: 450 },
    'storage-r-2':           { x: 1320, y: 570 },
};

export const PLAYER_SPAWN_POSITIONS = [
    { x: 500, y: 700 },
    { x: 1100, y: 700 },
    { x: 700, y: 720 },
    { x: 900, y: 720 },
];
