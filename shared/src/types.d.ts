export interface UserPublic {
    id: string;
    username: string;
}
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
export type RoomStatus = 'waiting' | 'playing' | 'ended';
export type GameType = 'snusregn';
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
export type FriendshipStatus = 'pending' | 'accepted' | 'blocked';
export interface FriendInfo {
    userId: string;
    username: string;
    friendshipStatus: FriendshipStatus;
    direction: 'incoming' | 'outgoing' | 'mutual';
    online: boolean;
    currentRoom?: {
        code: string;
        gameType: GameType;
    } | null;
}
export interface LeaderboardEntry {
    rank: number;
    userId: string;
    username: string;
    score: number;
    recordedAt: string;
}
export interface ClientToServerEvents {
    'room:join': (data: {
        roomCode: string;
    }) => void;
    'room:ready': (data: {
        roomCode: string;
    }) => void;
    'room:leave': (data: {
        roomCode: string;
    }) => void;
    'room:start': (data: {
        roomCode: string;
    }) => void;
    'game:action': (data: {
        roomCode: string;
        action: GameAction;
    }) => void;
    'friends:invite': (data: {
        targetUserId: string;
        roomCode: string;
    }) => void;
    'friends:inviteAccept': (data: {
        roomCode: string;
    }) => void;
}
export interface ServerToClientEvents {
    'room:update': (data: {
        room: RoomInfo;
    }) => void;
    'room:error': (data: {
        message: string;
    }) => void;
    'room:started': (data: {
        roomCode: string;
    }) => void;
    'game:state': (data: {
        state: unknown;
    }) => void;
    'game:end': (data: {
        results: GameResult[];
    }) => void;
    'friends:status': (data: {
        userId: string;
        online: boolean;
    }) => void;
    'friends:invite': (data: {
        fromUserId: string;
        fromUsername: string;
        roomCode: string;
        gameType: GameType;
    }) => void;
    'friends:update': () => void;
}
export interface SnusBrand {
    id: string;
    name: string;
    nicotineStrength: number;
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
    patrolDir: {
        dx: number;
        dy: number;
    };
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
export interface SenusCatcherObject {
    id: string;
    type: 'fresh' | 'spent';
    x: number;
    y: number;
}
export interface SenusCatcherPlayerState {
    userId: string;
    username: string;
    score: number;
    lives: number;
    barXFraction: number;
    objects: SenusCatcherObject[];
}
export interface SenusCatcherState {
    status: 'playing' | 'ended';
    tickCount: number;
    players: SenusCatcherPlayerState[];
    results?: GameResult[];
}
export type SnusregnItemType = 'fresh' | 'spent' | 'wideBar' | 'slowRain' | 'fastRain' | 'shrinkBar' | 'blind' | 'beer' | 'beerSnus';
export type SnusregnEffectType = 'wideBar' | 'slowRain' | 'fastRain' | 'shrinkBar' | 'blind' | 'beer';
export interface SnusregnEffect {
    type: SnusregnEffectType;
    remainingTicks: number;
}
export interface SnusregnItem {
    id: string;
    type: SnusregnItemType;
    x: number;
    y: number;
    speedMult: number;
}
export interface SnusregnPlayerState {
    userId: string;
    username: string;
    score: number;
    lives: number;
    barXFraction: number;
    items: SnusregnItem[];
    effects: SnusregnEffect[];
}
export interface SnusregnState {
    status: 'playing' | 'ended';
    tickCount: number;
    players: SnusregnPlayerState[];
    results?: GameResult[];
}
export type SnusregnAction = {
    type: 'snusregn:bar-move';
    payload: {
        xFraction: number;
    };
};
//# sourceMappingURL=types.d.ts.map