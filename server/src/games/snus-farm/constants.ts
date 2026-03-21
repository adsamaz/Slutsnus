export const TICK_MS = 20;
export const CANVAS_W = 800;
export const CANVAS_H = 600;

export const GAME_DURATION_TICKS = 3750; // 75 seconds
export const CHICKENS_TO_WIN = 5;
export const TOTAL_CHICKENS = 10;

export const FARMER_SPEED = 3.5;
export const FARMER_RADIUS = 14;
export const FARMER_PUSH_RADIUS = 80;
export const FARMER_PUSH_STRENGTH = 3.5;

export const CHICKEN_SPEED = 1.2;
export const CHICKEN_RADIUS = 10;
export const CHICKEN_MAX_SPEED = 3.6; // 3 * CHICKEN_SPEED
export const CHICKEN_WANDER_MIN_TICKS = 30;
export const CHICKEN_WANDER_MAX_TICKS = 80;

export const PEN_CAPTURE_RADIUS = 45;
export const PEN_LEFT = { x: CANVAS_W * 0.3, y: CANVAS_H / 2 };
export const PEN_RIGHT = { x: CANVAS_W * 0.7, y: CANVAS_H / 2 };

// Chicken wander bounds (keep away from pens so chickens can't drift in alone)
export const CHICKEN_MIN_X = CANVAS_W * 0.3 + PEN_CAPTURE_RADIUS + 10;
export const CHICKEN_MAX_X = CANVAS_W * 0.7 - PEN_CAPTURE_RADIUS - 10;
export const CHICKEN_MIN_Y = 20;
export const CHICKEN_MAX_Y = CANVAS_H - 20;

// Farmer can walk anywhere in the field
export const FARMER_MIN_X = FARMER_RADIUS;
export const FARMER_MAX_X = CANVAS_W - FARMER_RADIUS;
export const FARMER_MIN_Y = FARMER_RADIUS;
export const FARMER_MAX_Y = CANVAS_H - FARMER_RADIUS;

// Chicken spawn zone (center third of field)
export const SPAWN_MIN_X = 250;
export const SPAWN_MAX_X = 550;
export const SPAWN_MIN_Y = 100;
export const SPAWN_MAX_Y = 500;
