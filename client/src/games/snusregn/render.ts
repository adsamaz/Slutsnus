import type { SnusregnState, SnusregnPlayerState, SnusregnItemType, SnusregnEffectType } from '@slutsnus/shared';

export const LANE_W = 450;
export const LANE_GAP = 40;
const CANVAS_H = 900;
const BAR_Y = CANVAS_H - 20 - 18;   // top edge of bar
const BAR_HEIGHT = 18;
export const BAR_WIDTH_DEFAULT = 100;
const ITEM_RADIUS = 18;

const SERVER_TICK_MS = 20;

const COLORS = {
    bg: '#0d1117',
    divider: '#30363d',
    fresh: '#39d353',
    spent: '#f85149',
    wideBar: '#388bfd',
    slowRain: '#e3b341',
    fastRain: '#8b6914',
    shrinkBar: '#a371f7',
    blind: '#484f58',
    selfBar: '#e6edf3',
    opponentBar: '#6e7681',
    hud: '#e6edf3',
    hudMuted: '#8b949e',
    livesOn: '#39d353',
    livesOff: '#30363d',
} as const;

const EFFECT_COLORS: Record<SnusregnEffectType, string> = {
    wideBar: '#388bfd',
    slowRain: '#e3b341',
    fastRain: '#f85149',
    shrinkBar: '#a371f7',
    blind: '#484f58',
    beer: '#ffe033',
};

const ITEM_BORDER_COLOR: Record<SnusregnItemType, string> = {
    fresh: '',
    spent: '',
    wideBar: '#388bfd',
    slowRain: '#e3b341',
    fastRain: '#8b6914',
    shrinkBar: '#a371f7',
    blind: '#484f58',
    beer: '#ffe033',
    beerSnus: '',
};

const EFFECT_LABELS: Record<SnusregnEffectType, string> = {
    wideBar: 'WIDE',
    slowRain: 'SLOW',
    fastRain: 'FAST',
    shrinkBar: 'SHRINK',
    blind: 'BLIND',
    beer: 'BEER x3',
};

const EFFECT_MAX_TICKS: Record<SnusregnEffectType, number> = {
    wideBar: 250,
    slowRain: 200,
    fastRain: 150,
    shrinkBar: 200,
    blind: 100,
    beer: 250,
};

interface EffectFlags { blind: boolean; beer: boolean; wideBar: boolean; shrinkBar: boolean; }

function computeEffectFlags(player: SnusregnPlayerState): EffectFlags {
    let blind = false, beer = false, wideBar = false, shrinkBar = false;
    for (const e of player.effects) {
        if (e.type === 'blind') blind = true;
        else if (e.type === 'beer') beer = true;
        else if (e.type === 'wideBar') wideBar = true;
        else if (e.type === 'shrinkBar') shrinkBar = true;
    }
    return { blind, beer, wideBar, shrinkBar };
}

export type ItemImages = Partial<Record<SnusregnItemType, HTMLImageElement>>;
export type ItemBitmaps = Partial<Record<SnusregnItemType, ImageBitmap>>;

/** Pre-render each loaded image into a circular ImageBitmap at render size. Call once after images load. */
export async function bakeItemBitmaps(imgs: ItemImages): Promise<ItemBitmaps> {
    const size = ITEM_RADIUS * 2;
    const bitmaps: ItemBitmaps = {};
    const entries = Object.entries(imgs) as [SnusregnItemType, HTMLImageElement][];
    await Promise.all(entries.map(async ([type, img]) => {
        if (!img.complete || img.naturalWidth === 0) return;
        const oc = new OffscreenCanvas(size, size);
        const octx = oc.getContext('2d')!;
        const borderColor = ITEM_BORDER_COLOR[type];
        // Circular clip
        octx.beginPath();
        octx.arc(ITEM_RADIUS, ITEM_RADIUS, ITEM_RADIUS - BORDER_WIDTH / 2, 0, Math.PI * 2);
        octx.clip();
        octx.drawImage(img, 0, 0, size, size);
        // Border
        if (borderColor) {
            octx.beginPath();
            octx.arc(ITEM_RADIUS, ITEM_RADIUS, ITEM_RADIUS - BORDER_WIDTH / 2, 0, Math.PI * 2);
            octx.strokeStyle = borderColor;
            octx.lineWidth = BORDER_WIDTH;
            octx.stroke();
        }
        bitmaps[type] = await createImageBitmap(oc);
    }));
    return bitmaps;
}

export interface ScorePopup {
    text: string;
    color: string;
    x: number;        // logical px within lane
    y: number;        // logical px (start position)
    expiresAt: number;
    duration: number; // total ms
    large?: boolean;  // true for life-loss popups
    milestone?: boolean; // true for 100-point milestone flash
}

export interface ScreenFlash {
    color: string;    // e.g. 'rgba(248,81,73,'
    expiresAt: number;
    duration: number;
}

export function drawFrame(
    ctx: CanvasRenderingContext2D,
    canvas: HTMLCanvasElement,
    state: SnusregnState,
    selfId: string,
    localBarXFraction: number,
    imgs: ItemImages,
    popups: ScorePopup[],
    bitmaps: ItemBitmaps,
    flashes: ScreenFlash[],
    prevState: SnusregnState | null = null,
    elapsedMs: number = 0,
    now: number = performance.now(),
): void {
    const self = state.players.find(p => p.userId === selfId);
    const opponent = state.players.find(p => p.userId !== selfId);
    const prevSelf = prevState?.players.find(p => p.userId === selfId) ?? null;
    const prevOpponent = prevState?.players.find(p => p.userId !== selfId) ?? null;

    if (!self) return;

    const hasOpponent = !!opponent;
    const totalW = hasOpponent ? LANE_W * 2 + LANE_GAP : LANE_W;
    // Only resize when necessary — resizing resets all canvas state and is expensive
    if (canvas.width !== totalW) canvas.width = totalW;
    const opponentXOffset = LANE_W + LANE_GAP;

    // Clear
    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, totalW, CANVAS_H);

    // Lanes
    const selfFlags = computeEffectFlags(self);
    drawLane(ctx, self, 0, localBarXFraction, true, imgs, bitmaps, prevSelf, elapsedMs, now, selfFlags);
    if (hasOpponent) {
        const oppFlags = computeEffectFlags(opponent!);
        drawLane(ctx, opponent!, opponentXOffset, opponent!.barXFraction, false, imgs, bitmaps, prevOpponent, elapsedMs, now, oppFlags);
        // Divider at the boundary of self's lane
        ctx.strokeStyle = COLORS.divider;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(LANE_W, 0);
        ctx.lineTo(LANE_W, CANVAS_H);
        ctx.stroke();
    }

    // HUDs
    drawHUD(ctx, self, 0);
    if (hasOpponent) drawHUD(ctx, opponent!, opponentXOffset);

    // Eliminated overlay
    if (self.lives <= 0) drawEliminated(ctx, 0);
    if (hasOpponent && opponent!.lives <= 0) drawEliminated(ctx, opponentXOffset);

    // Screen flashes (self lane only)
    for (const f of flashes) {
        const t = 1 - (f.expiresAt - now) / f.duration; // 0→1
        const alpha = Math.max(0, 0.09 * (1 - t));       // fade out
        ctx.globalAlpha = alpha;
        ctx.fillStyle = f.color;
        ctx.fillRect(0, 0, LANE_W, CANVAS_H);
    }
    ctx.globalAlpha = 1;

    // Score popups (self lane only)
    for (const p of popups) {
        const t = 1 - (p.expiresAt - now) / p.duration; // 0→1
        // Ease-out upward drift: fast at start, slows down
        const drift = 60 * (1 - (1 - t) * (1 - t));
        ctx.font = p.milestone ? FONT_POPUP_52 : p.large ? FONT_POPUP_32 : FONT_POPUP_22;
        // Milestone: start fading immediately, max alpha 0.45
        const alpha = p.milestone
            ? Math.max(0, 0.45 * (1 - t))
            : Math.max(0, 1 - Math.max(0, t - 0.4) / 0.6);
        ctx.globalAlpha = alpha;
        ctx.fillStyle = p.color;
        ctx.textAlign = 'center';
        ctx.fillText(p.text, p.x, p.y - drift);
    }
    ctx.globalAlpha = 1;
    ctx.textAlign = 'left';

}

function drawLane(
    ctx: CanvasRenderingContext2D,
    player: SnusregnPlayerState,
    xOffset: number,
    barXFraction: number,
    isSelf: boolean,
    imgs: ItemImages,
    bitmaps: ItemBitmaps,
    prevPlayer: SnusregnPlayerState | null = null,
    elapsedMs: number = 0,
    now: number = performance.now(),
    flags?: EffectFlags,
): void {
    const { blind: isBlind, beer: hasBeer, wideBar: isWideBar, shrinkBar: isShrinkBar } =
        flags ?? computeEffectFlags(player);

    // Build a lookup of previous Y positions by item id for interpolation
    _prevYById.clear();
    if (prevPlayer) {
        for (const item of prevPlayer.items) _prevYById.set(item.id, item.y);
    }

    // elapsedMs can exceed SERVER_TICK_MS under jitter — extrapolate freely rather than clamp
    const ticksElapsed = elapsedMs / SERVER_TICK_MS;

    // Items — skip those inside the blind zone
    // Extrapolation is blended out near the bar so visual position stays in sync with
    // server collision checks. Above 70% canvas: full extrapolation. Below 85%: none.
    const EXTRAP_FADE_START = 0.82; // fraction — full extrapolation above this
    const EXTRAP_FADE_END   = 0.93; // fraction — no extrapolation below this
    for (const item of player.items) {
        const px = item.x * LANE_W + xOffset;
        // If item is new (no prev state), synthesise prevY one tick behind so it interpolates smoothly
        const oneTickDelta = item.spawnSpeed * item.speedMult / CANVAS_H;
        const prevY = _prevYById.get(item.id) ?? (item.y - oneTickDelta);
        // Interpolate from prevY to item.y for the first tick
        const interpY = prevY + (item.y - prevY) * Math.min(1, ticksElapsed);
        // Extrapolate beyond one tick using the item's frozen spawn speed
        const extraTicks = Math.max(0, ticksElapsed - 1);
        const extraDelta = (item.spawnSpeed * item.speedMult / CANVAS_H) * extraTicks;
        const blend = 1 - Math.max(0, Math.min(1, (interpY - EXTRAP_FADE_START) / (EXTRAP_FADE_END - EXTRAP_FADE_START)));
        const extrapolatedY = interpY + extraDelta * blend;
        const py = extrapolatedY * CANVAS_H;
        if (isBlind && py > CANVAS_H * 0.75) continue;
        drawItem(ctx, item.type, px, py, imgs, bitmaps, hasBeer, item.targeted, now);
    }

    // Blind: blurry fog over bottom quarter — drawn before the bar so the bar remains visible
    if (isBlind) {
        const blindY = CANVAS_H * 0.75;
        const fadeH = CANVAS_H * 0.2;
        // Wide gradient starting well above the blind zone for a prominent fog look
        if (!_blindGradient) {
            _blindGradient = ctx.createLinearGradient(0, blindY - fadeH, 0, blindY + fadeH * 0.5);
            _blindGradient.addColorStop(0, 'rgba(20,15,30,0)');
            _blindGradient.addColorStop(0.5, 'rgba(20,15,30,0.75)');
            _blindGradient.addColorStop(1, 'rgba(20,15,30,1)');
        }
        ctx.fillStyle = _blindGradient;
        ctx.fillRect(xOffset, blindY - fadeH, LANE_W, fadeH * 1.5);
        // Fully opaque fill for the rest
        ctx.fillStyle = 'rgba(20,15,30,1)';
        ctx.fillRect(xOffset, blindY + fadeH * 0.5, LANE_W, CANVAS_H - (blindY + fadeH * 0.5));
    }

    // Bar (always on top)
    let barW = BAR_WIDTH_DEFAULT;
    if (isWideBar) barW *= 2;
    if (isShrinkBar) barW *= 0.5;
    const barX = barXFraction * LANE_W + xOffset;
    ctx.fillStyle = isSelf ? COLORS.selfBar : COLORS.opponentBar;
    ctx.fillRect(barX - barW / 2, BAR_Y, barW, BAR_HEIGHT);
}


const BORDER_WIDTH = 3;

// Pre-defined font strings to avoid repeated CSS font parsing
const FONT_HUD_SCORE = 'bold 32px monospace';
const FONT_HUD_NAME = '13px monospace';
const FONT_HUD_HEARTS = 'bold 22px sans-serif';
const FONT_ELIMINATED = 'bold 36px monospace';
const FONT_POPUP_22 = 'bold 22px monospace';
const FONT_POPUP_32 = 'bold 32px monospace';
const FONT_POPUP_52 = 'bold 52px monospace';

// Cached blind fog gradient — parameters are all compile-time constants
let _blindGradient: CanvasGradient | null = null;

// Reusable Map for item Y interpolation — avoids per-frame allocation
const _prevYById = new Map<string, number>();

function drawItem(ctx: CanvasRenderingContext2D, type: SnusregnItemType, px: number, py: number, imgs: ItemImages, bitmaps: ItemBitmaps, hasBeer: boolean, targeted: boolean | undefined, now: number): void {
    const borderColor = ITEM_BORDER_COLOR[type];
    // fresh+beer and beerSnus both use the gold snus bitmap
    const bitmapKey = (type === 'fresh' && hasBeer) ? 'beerSnus' : type;
    const bitmap = bitmaps[bitmapKey];
    if (bitmap) {
        ctx.drawImage(bitmap, px - ITEM_RADIUS, py - ITEM_RADIUS, ITEM_RADIUS * 2, ITEM_RADIUS * 2);
    } else {
        // Fallback: draw directly from source image or plain circle
        ctx.save();
        ctx.translate(px, py);

        const img = imgs[type];

        if (img && img.complete && img.naturalWidth > 0) {
            ctx.beginPath();
            ctx.arc(0, 0, ITEM_RADIUS, 0, Math.PI * 2);
            ctx.clip();
            ctx.drawImage(img, -ITEM_RADIUS, -ITEM_RADIUS, ITEM_RADIUS * 2, ITEM_RADIUS * 2);
            ctx.restore();
            if (borderColor) {
                ctx.save();
                ctx.translate(px, py);
                ctx.beginPath();
                ctx.arc(0, 0, ITEM_RADIUS, 0, Math.PI * 2);
                ctx.strokeStyle = borderColor;
                ctx.lineWidth = BORDER_WIDTH;
                ctx.stroke();
                ctx.restore();
            }
        } else {
            ctx.beginPath();
            ctx.arc(0, 0, ITEM_RADIUS, 0, Math.PI * 2);
            ctx.fillStyle = borderColor;
            ctx.fill();
            ctx.restore();
        }
    }

    if (targeted) {
        // Bright pulsing ring to indicate this item targets the opponent, not you
        const pulse = 0.6 + 0.4 * Math.abs(Math.sin(now / 300));
        ctx.save();
        ctx.globalAlpha = pulse;
        ctx.beginPath();
        ctx.arc(px, py, ITEM_RADIUS + 5, 0, Math.PI * 2);
        ctx.strokeStyle = '#ff6b35';
        ctx.lineWidth = 3;
        ctx.stroke();
        ctx.restore();
    }
}

function drawEliminated(ctx: CanvasRenderingContext2D, xOffset: number): void {
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    ctx.fillRect(xOffset, 0, LANE_W, CANVAS_H);
    ctx.font = FONT_ELIMINATED;
    ctx.fillStyle = '#f85149';
    ctx.textAlign = 'center';
    ctx.fillText('ELIMINATED', xOffset + LANE_W / 2, CANVAS_H / 2);
    ctx.textAlign = 'left';
}

function drawHUD(
    ctx: CanvasRenderingContext2D,
    player: SnusregnPlayerState,
    xOffset: number,
): void {
    // Score
    ctx.font = FONT_HUD_SCORE;
    ctx.fillStyle = COLORS.hud;
    ctx.fillText(`${player.score}p`, xOffset + 10, 36);

    // Username
    ctx.font = FONT_HUD_NAME;
    ctx.fillStyle = COLORS.hudMuted;
    ctx.fillText(player.username, xOffset + 10, 54);

    // Lives (hearts, right side)
    ctx.font = FONT_HUD_HEARTS;
    for (let i = 0; i < 3; i++) {
        const x = xOffset + LANE_W - 12 - i * 28;
        ctx.fillStyle = i < player.lives ? '#f85149' : COLORS.livesOff;
        ctx.textAlign = 'center';
        ctx.fillText('♥', x, 32);
    }
    ctx.textAlign = 'left';
}

// Effects that originate from the opponent (debuffs applied to self)
const OPPONENT_EFFECTS = new Set<SnusregnEffectType>(['fastRain', 'shrinkBar', 'blind', 'slowRain']);

export { EFFECT_COLORS, EFFECT_LABELS, EFFECT_MAX_TICKS, OPPONENT_EFFECTS };
