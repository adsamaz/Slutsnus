export const TICK_MS = 20;
export const CANVAS_W = 800;
export const CANVAS_H = 600;

export const PLAYER_RADIUS = 16;

export const PLAYER_SPEED: Record<string, number> = {
    warrior: 3.5,
    archer: 4.2,
    mage: 3.8,
};

export const BASE_HP: Record<string, number> = {
    warrior: 200,
    archer: 130,
    mage: 90,
};

// Per-class ability definitions keyed by slot
// Fields: cooldownTicks, damage, range (px), durationTicks, speed (px/tick for projectiles), windupTicks (delay before firing)
export const ABILITIES: Record<string, Record<string, {
    cooldownTicks: number;
    damage: number;
    range: number;
    durationTicks: number;
    speed?: number;
    windupTicks: number;
}>> = {
    warrior: {
        Q: { cooldownTicks: 30,  damage: 30, range: 55,  durationTicks: 0,  windupTicks: 4  }, // Melee Strike
        W: { cooldownTicks: 150, damage: 25, range: 60,  durationTicks: 50, windupTicks: 7  }, // Shield Bash (stun)
        E: { cooldownTicks: 100, damage: 20, range: 220, durationTicks: 8,  windupTicks: 5, speed: 27 }, // Charge dash
    },
    archer: {
        Q: { cooldownTicks: 25,  damage: 22, range: 600, durationTicks: 35, windupTicks: 3,  speed: 17 }, // Arrow Shot
        W: { cooldownTicks: 120, damage: 18, range: 600, durationTicks: 35, windupTicks: 6,  speed: 17 }, // Multi-shot
        E: { cooldownTicks: 180, damage: 0,  range: 130, durationTicks: 15, windupTicks: 3  }, // Evasive Roll
    },
    mage: {
        Q: { cooldownTicks: 20,  damage: 14, range: 600, durationTicks: 35, windupTicks: 3,  speed: 17 }, // Wand Bolt
        W: { cooldownTicks: 80,  damage: 55, range: 500, durationTicks: 45, windupTicks: 10, speed: 10 }, // Fireball
        E: { cooldownTicks: 150, damage: 0,  range: 200, durationTicks: 1,  windupTicks: 5  }, // Blink
    },
};

export const ABILITY_NAMES: Record<string, Record<string, string>> = {
    warrior: { Q: 'Melee Strike', W: 'Shield Bash', E: 'Charge' },
    archer:  { Q: 'Arrow Shot', W: 'Multi-shot', E: 'Evasive Roll' },
    mage:    { Q: 'Wand Bolt', W: 'Fireball', E: 'Blink' },
};

export const BERSERKER_MULT = 1.6;

export const HEAL_AMOUNT = 40;
export const DAMAGE_BOOST_MULT = 1.4;
export const DAMAGE_BOOST_TICKS = 250;
export const HEAL_RESPAWN_TICKS = 400;
export const DAMAGE_BOOST_RESPAWN_TICKS = 600;

export const ARROW_RADIUS = 5;
export const FIREBALL_RADIUS = 12;
export const MULTI_ARROW_SPREAD_RAD = (15 * Math.PI) / 180;

export const STUN_TICKS = 75;
export const FREEZE_TICKS = 100;

export const CLASS_SELECT_TIMEOUT_TICKS = 600; // 12 seconds

export const BOT_APPROACH_RANGE = 180;
export const BOT_RETREAT_HP_THRESHOLD = 0.3;
export const BOT_ABILITY_JITTER = 0.15;
export const BOT_STRAFE_CHANGE_TICKS = 40;
