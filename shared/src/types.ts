// ─────────────────────────────────────────────────
// Core User
// ─────────────────────────────────────────────────
export interface UserPublic {
    id: string;
    username: string;
}

// ─────────────────────────────────────────────────
// Auth
// ─────────────────────────────────────────────────
export interface RegisterRequest {
    username: string;
    password: string;
}

export interface LoginRequest {
    username: string;
    password: string;
}

export interface AuthResponse {
    user: UserPublic;
}

// ─────────────────────────────────────────────────
// Rooms
// ─────────────────────────────────────────────────
export type RoomStatus = 'waiting' | 'playing' | 'ended';
export type GameType = 'snusregn' | 'snus-arena' | 'snus-farm';

export interface RoomPlayer {
    userId: string;
    username: string;
    ready: boolean;
}

export interface RoomInfo {
    id: string;
    code: string;
    gameType: GameType;
    hostId: string;
    status: RoomStatus;
    players: RoomPlayer[];
}

// ─────────────────────────────────────────────────
// Game Engine (generic)
// ─────────────────────────────────────────────────
export interface PlayerInfo {
    userId: string;
    username: string;
}

export interface GameAction {
    type: string;
    payload?: unknown;
}

export interface GameResult {
    userId: string;
    username: string;
    score: number;
    rank: number;
    timeTakenMs?: number;
}

// ─────────────────────────────────────────────────
// Friends
// ─────────────────────────────────────────────────
export type FriendshipStatus = 'pending' | 'accepted' | 'blocked';

export interface FriendInfo {
    userId: string;
    username: string;
    friendshipStatus: FriendshipStatus;
    direction: 'incoming' | 'outgoing' | 'mutual';
    online: boolean;
    currentRoom?: { code: string; gameType: GameType; isHost: boolean } | null;
}

// ─────────────────────────────────────────────────
// Leaderboard
// ─────────────────────────────────────────────────
export interface LeaderboardEntry {
    rank: number;
    userId: string;
    username: string;
    score: number;
    timeTakenMs?: number;
    recordedAt: string;
}

// ─────────────────────────────────────────────────
// Socket event payloads
// ─────────────────────────────────────────────────
export interface ClientToServerEvents {
    'room:join': (data: { roomCode: string }) => void;
    'room:ready': (data: { roomCode: string }) => void;
    'room:leave': (data: { roomCode: string }) => void;
    'room:start': (data: { roomCode: string; gameMode?: ArenaGameMode }) => void;
    'game:action': (data: { roomCode: string; action: GameAction }) => void;
    'game:ready': (data: { roomCode: string }) => void;
    'friends:invite': (data: { targetUserId: string; roomCode: string }) => void;
    'friends:inviteAccept': (data: { roomCode: string }) => void;
}

export interface ServerToClientEvents {
    'room:update': (data: { room: RoomInfo }) => void;
    'room:error': (data: { message: string }) => void;
    'room:started': (data: { roomCode: string }) => void;
    'room:dissolved': () => void;
    'game:state': (data: { state: unknown }) => void;
    'game:end': (data: { results: GameResult[] }) => void;
    'friends:status': (data: { userId: string; online: boolean }) => void;
    'friends:invite': (data: {
        fromUserId: string;
        fromUsername: string;
        roomCode: string;
        gameType: GameType;
    }) => void;
    'friends:update': () => void;
}

// ─────────────────────────────────────────────────
// Snus RPG specific
// ─────────────────────────────────────────────────
export interface SnusBrand {
    id: string;
    name: string;
    nicotineStrength: number; // 1–10
    taste: string;
    pouchSize: 'slim' | 'regular' | 'large';
    value: number;
}

export interface SnusItemOnMap {
    id: string;
    brandId: string;
    x: number;
    y: number;
    collected: boolean;
}

export type ActiveEffectType = 'nicotine_boost' | 'shake';

export interface ActiveEffect {
    type: ActiveEffectType;
    remainingTicks: number;
    value: number;
}

export interface SnusPlayer {
    userId: string;
    username: string;
    x: number;
    y: number;
    hp: number;
    score: number;
    inventory: SnusBrand[];
    effects: ActiveEffect[];
    alive: boolean;
}

export interface NpcState {
    id: string;
    x: number;
    y: number;
    hp: number;
    type: 'nicotine_pouch';
    patrolDir: { dx: number; dy: number };
}

export interface TradeOffer {
    id: string;
    fromPlayerId: string;
    toPlayerId: string;
    realBrandId: string;
    displayedName: string;
    expiresAtTick: number;
}

export interface SnusRpgState {
    players: Record<string, SnusPlayer>;
    items: SnusItemOnMap[];
    npcs: NpcState[];
    map: number[][];
    tickCount: number;
    status: 'playing' | 'ended';
    results?: GameResult[];
    tradeOffers: TradeOffer[];
    timeRemainingTicks: number;
}

// ─────────────────────────────────────────────────
// Snus Catcher specific
// ─────────────────────────────────────────────────

export interface SenusCatcherObject {
    id: string;
    type: 'fresh' | 'spent';
    x: number;   // 0.0–1.0 fraction of logical width
    y: number;   // 0.0–1.0 fraction of logical height
}

export interface SenusCatcherPlayerState {
    userId: string;
    username: string;
    score: number;
    lives: number;              // 3 → 0
    barXFraction: number;       // 0.0–1.0 — last-known server position
    objects: SenusCatcherObject[];  // this player's independent falling items
}

export interface SenusCatcherState {
    status: 'playing' | 'ended';
    tickCount: number;
    players: SenusCatcherPlayerState[];   // 2 entries for 1v1
    results?: GameResult[];               // only present when status === 'ended'
}



// ─────────────────────────────────────────────────
// Snusregn specific
// ─────────────────────────────────────────────────

export type SnusregnItemType =
    | 'fresh'      // +1 score if caught
    | 'spent'      // -1 life if caught
    | 'wideBar'    // powerup: catch to double own bar width for 5s
    | 'slowRain'   // powerup: catch to halve opponent's fall speed for 4s
    | 'fastRain'   // debuff: catch to double own fall speed for 3s
    | 'shrinkBar'  // debuff: catch to halve own bar width for 4s
    | 'blind'      // debuff: catch to black out own screen for 2s
    | 'beer'       // powerup: catch to triple own score
    | 'beerSnus';  // +3 score if caught (no effect)

export type SnusregnEffectType =
    | 'wideBar'
    | 'slowRain'
    | 'fastRain'
    | 'shrinkBar'
    | 'blind'
    | 'beer';

export interface SnusregnEffect {
    type: SnusregnEffectType;
    remainingTicks: number;
}

export interface SnusregnItem {
    id: string;
    type: SnusregnItemType;
    x: number;       // 0.0–1.0 fraction of the lane width (400px)
    y: number;       // 0.0–1.0 fraction of the full canvas height (600px)
    speedMult: number; // individual speed multiplier, typically 0.85–1.15
    spawnSpeed: number; // fall speed (px/tick) at the time this item was spawned — frozen for its lifetime
    targeted?: boolean; // 1v1 only: effect applies to opponent instead of self
}

export interface SnusregnPlayerState {
    userId: string;
    username: string;
    score: number;
    lives: number;
    barXFraction: number;    // 0.0–1.0 within own lane
    items: SnusregnItem[];
    effects: SnusregnEffect[];
}

export interface SnusregnState {
    status: 'playing' | 'ended';
    tickCount: number;
    players: SnusregnPlayerState[];   // always 2 entries
    results?: GameResult[];
}

export type SnusregnAction =
    | { type: 'snusregn:bar-move'; payload: { xFraction: number } };

// ─────────────────────────────────────────────────
// Snus Arena specific
// ─────────────────────────────────────────────────

export type ArenaClass = 'warrior' | 'archer' | 'mage';
export type ArenaTeam = 'alpha' | 'beta';
export type ArenaAbilitySlot = 'Q' | 'W' | 'E';
export type ArenaGameMode = '1v1' | 'solo' | '2v2';

export interface ArenaAbilityState {
    slot: ArenaAbilitySlot;
    cooldownRemainingTicks: number;
    cooldownTotalTicks: number;
}

export interface ArenaCast {
    slot: ArenaAbilitySlot;
    remainingTicks: number;
    totalTicks: number;
    angle: number;
}

export interface ArenaProjectile {
    id: string;
    ownerId: string;
    type: 'arrow' | 'multi-arrow' | 'fireball' | 'wand-bolt';
    x: number;
    y: number;
    vx: number;
    vy: number;
    radius: number;
    damage: number;
    remainingTicks: number;
}

export interface ArenaEffect {
    type: 'stun' | 'frozen' | 'damage-boost' | 'invincible';
    remainingTicks: number;
}

export interface ArenaPowerup {
    id: string;
    type: 'heal' | 'damage-boost';
    x: number;
    y: number;
    active: boolean;
    respawnRemainingTicks: number;
}

export interface ArenaPlayer {
    userId: string;
    username: string;
    isBot: boolean;
    team: ArenaTeam;
    class: ArenaClass | null;
    x: number;
    y: number;
    hp: number;
    maxHp: number;
    alive: boolean;
    effects: ArenaEffect[];
    abilities: ArenaAbilityState[];
    facingAngle: number;
    castingAbility: ArenaCast | null;
}

export interface ArenaObstacle {
    x: number;
    y: number;
    w: number;
    h: number;
}

export interface ArenaState {
    status: 'selecting' | 'playing' | 'ended';
    tickCount: number;
    players: ArenaPlayer[];
    projectiles: ArenaProjectile[];
    powerups: ArenaPowerup[];
    obstacles: ArenaObstacle[];
    results?: GameResult[];
}

export type ArenaAction =
    | { type: 'arena:select-class'; payload: { class: ArenaClass } }
    | { type: 'arena:move'; payload: { dx: number; dy: number } }
    | { type: 'arena:ability'; payload: { slot: ArenaAbilitySlot } }
    | { type: 'arena:aim'; payload: { angle: number } };

// ─────────────────────────────────────────────────
// Snus Farm specific
// ─────────────────────────────────────────────────

export interface FarmChicken {
    id: string;
    x: number;
    y: number;
    vx: number;
    vy: number;
}

export interface FarmSnus {
    id: string;
    x: number;
    y: number;
}

export interface FarmPlayer {
    userId: string;
    username: string;
    x: number;
    y: number;
    score: number;
    side: 'left' | 'right';
    speedBoostTicks: number;
}

export interface FarmState {
    status: 'playing' | 'ended';
    tickCount: number;
    players: FarmPlayer[];
    chickens: FarmChicken[];
    snus: FarmSnus | null;
    results?: GameResult[];
}

export type FarmAction =
    | { type: 'farm:move'; payload: { dx: number; dy: number } };
