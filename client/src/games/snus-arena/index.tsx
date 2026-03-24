import { createSignal, onMount, onCleanup, Show } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import { useSocket } from '../../stores/socket';
import { useAuth } from '../../stores/auth';
import type { ArenaState, GameAction } from '@slutsnus/shared';
import { drawClassSelect, drawGame, drawEndScreen, getClassCardAtPoint, spawnDamageNumber } from './render';
import { CANVAS_W, CANVAS_H } from './constants';
import {
    soundArenaStart, soundShoot, soundFireball, soundHit, soundDeath,
    soundHeal, soundDamageBoost, soundArenaWin, soundArenaLose,
    soundMeleeStrike, soundShieldBash, startBgMusic, stopBgMusic,
} from './sounds';

interface SnusArenaProps {
    state: ArenaState;
    roomCode: string;
    isSolo: boolean;
    onAction: (action: GameAction) => void;
}

const TICK_MS = 20;

export function SnusArenaGame(props: SnusArenaProps) {
    const socket = useSocket();
    const [authState] = useAuth();
    const navigate = useNavigate();

    let canvasRef!: HTMLCanvasElement;

    const [currentState, setCurrentState] = createSignal<ArenaState>(props.state);
    const [prevState, setPrevState] = createSignal<ArenaState | null>(null);
    const [lastStateAt, setLastStateAt] = createSignal(Date.now());
    let rafId = 0;

    const myUserId = () => authState.user?.id ?? '';

    // ── Sound state tracking ─────────────────────────────────────────────────

    let prevProjectileIds = new Set<string>();
    let prevPlayerHp = new Map<string, number>();
    let prevPlayerAlive = new Map<string, boolean>();
    let prevPowerupActive = new Map<string, boolean>();
    let prevCastingSlot = new Map<string, string | null>();
    let soundedGameEnd = false;

    // ── Input state ──────────────────────────────────────────────────────────

    const keys = new Set<string>();
    let lastMoveEmit = 0;
    let lastAimEmit = 0;

    const getInputDelta = (): { dx: number; dy: number } => {
        let dx = 0, dy = 0;
        if (keys.has('KeyW') || keys.has('ArrowUp'))    dy -= 1;
        if (keys.has('KeyS') || keys.has('ArrowDown'))  dy += 1;
        if (keys.has('KeyA') || keys.has('ArrowLeft'))  dx -= 1;
        if (keys.has('KeyD') || keys.has('ArrowRight')) dx += 1;
        const mag = Math.sqrt(dx * dx + dy * dy);
        if (mag > 1) { dx /= mag; dy /= mag; }
        return { dx, dy };
    };

    const onKeyDown = (e: KeyboardEvent) => {
        keys.add(e.code);

        // Ability keys
        if (currentState().status === 'playing') {
            if (e.code === 'KeyR' && !e.repeat) props.onAction({ type: 'arena:ability', payload: { slot: 'W' } } as GameAction);
        }
    };

    const onKeyUp = (e: KeyboardEvent) => {
        keys.delete(e.code);
    };

    const onMouseMove = (e: MouseEvent) => {
        if (currentState().status !== 'playing') return;
        const now = Date.now();
        if (now - lastAimEmit < 16) return;
        lastAimEmit = now;

        const rect = canvasRef.getBoundingClientRect();
        const me = currentState().players.find(p => p.userId === myUserId());
        if (!me) return;

        // Scale mouse coords to logical canvas coords
        const scaleX = CANVAS_W / rect.width;
        const scaleY = CANVAS_H / rect.height;
        const cx = (e.clientX - rect.left) * scaleX;
        const cy = (e.clientY - rect.top) * scaleY;
        const angle = Math.atan2(cy - me.y, cx - me.x);
        props.onAction({ type: 'arena:aim', payload: { angle } } as GameAction);
    };

    const onMouseDown = (e: MouseEvent) => {
        if (currentState().status === 'selecting') {
            // Class selection only works within the canvas
            const rect = canvasRef.getBoundingClientRect();
            const inside = e.clientX >= rect.left && e.clientX <= rect.right &&
                           e.clientY >= rect.top  && e.clientY <= rect.bottom;
            if (!inside) return;
            const me = currentState().players.find(p => p.userId === myUserId());
            if (me?.class !== null) return;
            const cls = getClassCardAtPoint(e.clientX, e.clientY, rect);
            if (cls) {
                props.onAction({ type: 'arena:select-class', payload: { class: cls } } as GameAction);
            }
            return;
        }
        if (currentState().status === 'playing') {
            if (e.button === 0) props.onAction({ type: 'arena:ability', payload: { slot: 'Q' } } as GameAction);
            if (e.button === 2) props.onAction({ type: 'arena:ability', payload: { slot: 'E' } } as GameAction);
        }
    };

    // ── Render loop ──────────────────────────────────────────────────────────

    const renderLoop = () => {
        const ctx = canvasRef?.getContext('2d');
        if (!ctx) { rafId = requestAnimationFrame(renderLoop); return; }

        const state = currentState();
        const alpha = Math.min(1, (Date.now() - lastStateAt()) / TICK_MS);

        if (state.status === 'selecting') {
            drawClassSelect(ctx, myUserId(), state, () => {}, null);
        } else if (state.status === 'playing') {
            // Emit movement throttled to 50ms
            const now = Date.now();
            if (now - lastMoveEmit >= 50) {
                lastMoveEmit = now;
                const { dx, dy } = getInputDelta();
                props.onAction({ type: 'arena:move', payload: { dx, dy } } as GameAction);
            }
            drawGame(ctx, state, prevState(), alpha, myUserId());
        } else {
            drawEndScreen(ctx, state, myUserId());
        }

        rafId = requestAnimationFrame(renderLoop);
    };

    // ── Sound logic ──────────────────────────────────────────────────────────

    const processSounds = (next: ArenaState) => {
        const me = next.players.find(p => p.userId === myUserId());

        // Game start: fire sound and reset tracking when entering 'selecting' (new game began)
        const prev = prevState();
        if ((prev === null || prev.status === 'ended') && next.status === 'selecting') {
            soundArenaStart();
            soundedGameEnd = false;
            prevProjectileIds = new Set();
            prevPlayerHp = new Map();
            prevPlayerAlive = new Map();
            prevPowerupActive = new Map();
            prevCastingSlot = new Map();
        }
        if (prev?.status === 'selecting' && next.status === 'playing') {
            startBgMusic();
        }
        if (next.status !== 'playing' && prev?.status === 'playing') {
            stopBgMusic();
        }

        if (next.status === 'playing') {
            // New projectiles spawned — detect by id
            const nextIds = new Set(next.projectiles.map(p => p.id));
            for (const id of nextIds) {
                if (!prevProjectileIds.has(id)) {
                    const proj = next.projectiles.find(p => p.id === id);
                    if (proj?.type === 'fireball') soundFireball();
                    else soundShoot();
                }
            }
            prevProjectileIds = nextIds;

            // Melee ability cast completed — detect by castingAbility slot transitioning null
            for (const player of next.players) {
                const wasSlot = prevCastingSlot.get(player.userId) ?? null;
                const nowSlot = player.castingAbility?.slot ?? null;
                if (wasSlot !== null && nowSlot === null && player.class === 'warrior') {
                    if (wasSlot === 'Q') soundMeleeStrike();
                    else if (wasSlot === 'W') soundShieldBash();
                }
                prevCastingSlot.set(player.userId, nowSlot);
            }

            // Player HP decreased (hit) or died
            for (const player of next.players) {
                const prevHp = prevPlayerHp.get(player.userId) ?? player.hp;
                const prevAlive = prevPlayerAlive.get(player.userId) ?? player.alive;
                if (!player.alive && prevAlive) {
                    soundDeath();
                } else if (player.hp < prevHp && player.alive) {
                    if (player.userId === myUserId()) soundHit();
                    const lost = prevHp - player.hp;
                    const isEnemy = player.userId !== myUserId();
                    spawnDamageNumber(player.x, player.y, lost, isEnemy);
                }
                prevPlayerHp.set(player.userId, player.hp);
                prevPlayerAlive.set(player.userId, player.alive);
            }

            // Powerup collected (active went from true → false = collected)
            for (const pu of next.powerups) {
                const wasActive = prevPowerupActive.get(pu.id) ?? pu.active;
                if (wasActive && !pu.active) {
                    if (pu.type === 'heal') soundHeal();
                    else soundDamageBoost();
                }
                prevPowerupActive.set(pu.id, pu.active);
            }
        }

        // Game ended
        if (next.status === 'ended' && !soundedGameEnd) {
            soundedGameEnd = true;
            const myResult = next.results?.find(r => r.userId === myUserId());
            const won = myResult?.rank === 1;
            if (won) soundArenaWin();
            else soundArenaLose();
        }
    };

    // ── Socket listener ──────────────────────────────────────────────────────

    const onGameState = ({ state }: { state: unknown }) => {
        const next = state as ArenaState;
        processSounds(next);
        setPrevState(currentState());
        setCurrentState(next);
        setLastStateAt(Date.now());
    };

    const onContextMenu = (e: MouseEvent) => e.preventDefault();

    onMount(() => {
        // Seed tracking maps from initial state
        const init = props.state;
        prevProjectileIds = new Set(init.projectiles.map(p => p.id));
        for (const p of init.players) {
            prevPlayerHp.set(p.userId, p.hp);
            prevPlayerAlive.set(p.userId, p.alive);
        }
        for (const pu of init.powerups) {
            prevPowerupActive.set(pu.id, pu.active);
        }

        socket.on('game:state', onGameState);
        window.addEventListener('keydown', onKeyDown);
        window.addEventListener('keyup', onKeyUp);
        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mousedown', onMouseDown);
        canvasRef.addEventListener('contextmenu', onContextMenu);
        rafId = requestAnimationFrame(renderLoop);
    });

    onCleanup(() => {
        socket.off('game:state', onGameState);
        window.removeEventListener('keydown', onKeyDown);
        window.removeEventListener('keyup', onKeyUp);
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mousedown', onMouseDown);
        if (canvasRef) {
            canvasRef.removeEventListener('contextmenu', onContextMenu);
        }
        cancelAnimationFrame(rafId);
        stopBgMusic();
    });

    return (
        <div class="snus-arena-wrapper" style={{ display: 'flex', 'flex-direction': 'column', 'align-items': 'center', gap: '8px' }}>
            <Show when={currentState().status === 'selecting'}>
                <div style={{ color: '#aaa', 'font-size': '13px' }}>
                    Click a class card on the canvas to select your class
                </div>
            </Show>
            <canvas
                ref={canvasRef}
                width={CANVAS_W}
                height={CANVAS_H}
                style={{ cursor: 'crosshair', 'max-width': '100%' }}
            />
            <Show when={currentState().status === 'playing'}>
                <div style={{ color: '#888', 'font-size': '12px' }}>
                    WASD to move &nbsp;|&nbsp; LMB / RMB / R for abilities
                </div>
            </Show>
            <Show when={currentState().status === 'ended'}>
                <div style={{ display: 'flex', gap: '12px', 'margin-top': '8px' }}>
                    <button
                        onClick={() => {
                            if (props.isSolo) {
                                socket.emit('room:start', { roomCode: props.roomCode });
                            } else {
                                navigate(`/lobby/${props.roomCode}`);
                            }
                        }}
                        style={{ padding: '0.75rem 2rem', background: '#1f6feb', color: '#e6edf3', border: 'none', 'border-radius': '8px', cursor: 'pointer', 'font-size': '1.1rem', 'font-weight': '700', 'font-family': 'monospace' }}
                    >
                        Play again
                    </button>
                    <button
                        onClick={() => { window.location.href = '/'; }}
                        style={{ padding: '0.75rem 2rem', background: '#238636', color: '#e6edf3', border: 'none', 'border-radius': '8px', cursor: 'pointer', 'font-size': '1.1rem', 'font-weight': '700', 'font-family': 'monospace' }}
                    >
                        Back to start
                    </button>
                </div>
            </Show>
        </div>
    );
}
