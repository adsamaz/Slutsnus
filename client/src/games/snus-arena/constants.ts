export const CANVAS_W = 800;
export const CANVAS_H = 600;
export const PLAYER_RADIUS = 16;
export const ARROW_RADIUS = 5;
export const FIREBALL_RADIUS = 12;
export const POWERUP_RADIUS = 18;

export const TEAM_COLORS: Record<string, string> = {
    alpha: '#4a9eff',
    beta: '#ff4a4a',
};

export const CLASS_COLORS: Record<string, string> = {
    warrior: '#e8a020',
    archer: '#50c878',
    mage: '#c850ff',
};

export const PROJECTILE_COLORS: Record<string, string> = {
    arrow: '#50c878',
    'multi-arrow': '#90ee90',
    fireball: '#ff6600',
    'wand-bolt': '#dd88ff',
};

export const EFFECT_COLORS: Record<string, string> = {
    stun: '#ffff00',
    frozen: '#00ccff',
    'damage-boost': '#ff4444',
    invincible: '#ffffff',
};

export const POWERUP_COLORS: Record<string, string> = {
    heal: '#00cc44',
    'damage-boost': '#ff8800',
};

export const CLASS_INFO: Record<string, {
    name: string;
    description: string;
    hp: number;
    speed: string;
    abilities: { slot: string; name: string; desc: string }[];
}> = {
    warrior: {
        name: 'Warrior',
        description: 'Tanky melee fighter. High HP, close-range devastation.',
        hp: 200,
        speed: 'Medium',
        abilities: [
            { slot: 'M1', name: 'Melee Strike', desc: 'Quick strike dealing moderate damage to nearby enemies' },
            { slot: 'R', name: 'Shield Bash', desc: 'Stun and damage nearby enemies' },
            { slot: 'M2', name: 'Charge', desc: 'Dash forward, dealing damage to enemies in path' },
        ],
    },
    archer: {
        name: 'Archer',
        description: 'Agile ranged attacker. Keep your distance and pepper enemies.',
        hp: 130,
        speed: 'Fast',
        abilities: [
            { slot: 'M1', name: 'Arrow Shot', desc: 'Fire a fast arrow in your aim direction' },
            { slot: 'R', name: 'Multi-shot', desc: 'Fire three arrows in a spread' },
            { slot: 'M2', name: 'Evasive Roll', desc: 'Dash with brief invincibility' },
        ],
    },
    mage: {
        name: 'Mage',
        description: 'Glass cannon. Devastating AoE but fragile. Position is key.',
        hp: 90,
        speed: 'Medium',
        abilities: [
            { slot: 'M1', name: 'Wand Bolt', desc: 'Quick magic projectile, less damage than fireball' },
            { slot: 'R', name: 'Fireball', desc: 'Slow but hard-hitting projectile' },
            { slot: 'M2', name: 'Blink', desc: 'Teleport instantly in your aim direction' },
        ],
    },
};
