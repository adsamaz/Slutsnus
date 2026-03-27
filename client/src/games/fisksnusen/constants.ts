// Canvas
export const CANVAS_W = 900;
export const CANVAS_H = 600;
export const PANEL_W = 450;
export const WATERLINE_Y = 220;
export const SERVER_TICK_MS = 20;

// Colours
export const COLOR_SKY_TOP = '#1a2a4a';
export const COLOR_SKY_BOT = '#2a4a6a';
export const COLOR_WATER_SURFACE = '#2a6a8a';
export const COLOR_WATER_DEEP = '#0a1a2a';
export const COLOR_DOCK = '#5a3a1a';
export const COLOR_PERFECT = '#44cc44';
export const COLOR_GOOD = '#cccc22';
export const COLOR_MISS = '#cc3333';
export const COLOR_METER_BG = '#1a1a2a';
export const COLOR_NEEDLE = '#ffffff';
export const COLOR_FISH = '#c0a060';
export const COLOR_HOOK = '#aaaaaa';

// Meter arc geometry (relative to panel midpoint bottom)
export const METER_CX_FRAC = 0.5;   // fraction of PANEL_W
export const METER_CY = 555;
export const METER_RADIUS = 75;

// Zone angles (in radians, where 0=right, PI=left on a standard arc)
// We draw the arc from 180° (left) to 0° (right) at the bottom
// meter value 0 = leftmost, 1 = rightmost
export const METER_ARC_START = Math.PI;   // left
export const METER_ARC_END = 0;           // right

// Zone thresholds (meter value 0–1)
export const ZONE_PERFECT_MIN = 0.45;
export const ZONE_PERFECT_MAX = 0.55;
export const ZONE_GOOD_MIN = 0.35;
export const ZONE_GOOD_MAX = 0.65;

// Reel balance bar geometry (relative to panel)
export const REEL_BAR_Y = 510;
export const REEL_BAR_W = 370;
export const REEL_BAR_H = 22;

// Reel zone thresholds (must match engine constants)
export const REEL_ZONE_PERFECT_MIN = 0.40;
export const REEL_ZONE_PERFECT_MAX = 0.60;
export const REEL_ZONE_GOOD_MIN = 0.30;
export const REEL_ZONE_GOOD_MAX = 0.70;

// Fish dimensions
export const FISH_W = 50;
export const FISH_H = 22;

// Stage labels
export const STAGE_LABELS = ['BITE', 'REEL', 'BOAT', 'SNUS'] as const;
