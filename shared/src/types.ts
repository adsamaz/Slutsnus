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
export type GameType = 'snusking';

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
    currentRoom?: { code: string; gameType: GameType } | null;
}

// ─────────────────────────────────────────────────
// Leaderboard
// ─────────────────────────────────────────────────
export interface LeaderboardEntry {
    rank: number;
    userId: string;
    username: string;
    score: number;
    recordedAt: string;
}

// ─────────────────────────────────────────────────
// Socket event payloads
// ─────────────────────────────────────────────────
export interface ClientToServerEvents {
    'room:join': (data: { roomCode: string }) => void;
    'room:ready': (data: { roomCode: string }) => void;
    'room:leave': (data: { roomCode: string }) => void;
    'room:start': (data: { roomCode: string }) => void;
    'game:action': (data: { roomCode: string; action: GameAction }) => void;
    'friends:invite': (data: { targetUserId: string; roomCode: string }) => void;
    'friends:inviteAccept': (data: { roomCode: string }) => void;
}

export interface ServerToClientEvents {
    'room:update': (data: { room: RoomInfo }) => void;
    'room:error': (data: { message: string }) => void;
    'room:started': (data: { roomCode: string }) => void;
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
// Snusking specific
// ─────────────────────────────────────────────────
export type GameEndReason = 'score_threshold' | 'slut_snus';

/** Static card definition from the card catalog */
export interface SnuskingCardDefinition {
  id: string;
  name: string;
  empirePoints: number;
}

export interface SnuskingCardInstance {
  instanceId: string;
  definitionId: string;
  name: string;
  empirePoints: number;
}

export interface SnuskingTradeOffer {
  offerId: string;
  fromPlayerId: string;
  toPlayerId: string;
  cardInstanceId: string;   // stable card ID — NOT array position
  displayName: string;      // Phase 1: same as real name. Phase 2: may differ.
  expiresAtTurn: number;
}

export interface SnuskingPlayerState {
  userId: string;
  username: string;
  hand: SnuskingCardInstance[];
  empireScore: number;
  hasCommitted: boolean;
  isConnected: boolean;
  beer: number;
}

export interface SnuskingOpponentState {
  userId: string;
  username: string;
  handCount: number;
  empireScore: number;
  hasCommitted: boolean;
  isConnected: boolean;
  beer: number;
}

export interface SnuskingProjectedState {
  phase: 'draw' | 'planning' | 'reveal' | 'resolve' | 'ended';
  self: SnuskingPlayerState;
  opponents: SnuskingOpponentState[];
  deckCount: number;
  discardCount: number;
  turnNumber: number;
  pendingTradeOffers: SnuskingTradeOffer[];
  status: 'active' | 'ended';
  endReason: GameEndReason | null;
  results: GameResult[] | null;
}

/** Server-only master state — NEVER emitted directly (contains all players' hands) */
export interface SnuskingMasterState {
  roomId: string;
  phase: 'draw' | 'planning' | 'reveal' | 'resolve' | 'ended';
  players: Record<string, SnuskingPlayerState>;
  deck: SnuskingCardInstance[];
  discardPile: SnuskingCardInstance[];
  currentEvent: null;
  turnNumber: number;
  pendingTradeOffers: SnuskingTradeOffer[];
  status: 'active' | 'ended';
  endReason: GameEndReason | null;
  results: GameResult[] | null;
}

// Snusking action discriminated union — validated by Zod at Socket.IO boundary (server-only)
export type SnuskingAction =
  | { type: 'snusking:spend'; cardIds: string[] }
  | { type: 'snusking:pass' }
  | { type: 'snusking:trade-offer'; targetPlayerId: string; cardInstanceId: string }
  | { type: 'snusking:trade-accept'; offerId: string }
  | { type: 'snusking:trade-decline'; offerId: string };
