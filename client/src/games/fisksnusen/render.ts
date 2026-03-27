import type { FiskeSnusState, FiskeSnusPlayerState, FiskePhase, FiskeFishSize } from '@slutsnus/shared';
import {
    CANVAS_W, CANVAS_H, PANEL_W, WATERLINE_Y, SERVER_TICK_MS,
    COLOR_SKY_TOP, COLOR_SKY_BOT, COLOR_WATER_SURFACE, COLOR_WATER_DEEP,
    COLOR_DOCK, COLOR_PERFECT, COLOR_GOOD, COLOR_MISS, COLOR_METER_BG,
    COLOR_NEEDLE, COLOR_FISH, COLOR_HOOK,
    METER_CY, METER_RADIUS,
    METER_ARC_START, METER_ARC_END,
    ZONE_PERFECT_MIN, ZONE_PERFECT_MAX, ZONE_GOOD_MIN, ZONE_GOOD_MAX,
    REEL_BAR_W, REEL_BAR_H, REEL_BAR_Y,
    REEL_ZONE_PERFECT_MIN, REEL_ZONE_PERFECT_MAX, REEL_ZONE_GOOD_MIN, REEL_ZONE_GOOD_MAX,
    FISH_W, FISH_H, STAGE_LABELS,
} from './constants';

// ─── Flash helper ────────────────────────────────
export interface ScreenFlash {
    color: string;
    alpha: number;
    expiresAt: number;
    duration: number;
}

export interface HitLabel {
    text: string;
    color: string;
    expiresAt: number;
    duration: number;
}

// ─── Tree / Island ────────────────────────────────
// Small island in the middle of the water with a tree on it.
// castX ≈ 0.47–0.60 maps to the island zone (UW_X_MIN=120, UW_X_MAX=420 → x≈261–300).
export const TREE_X = 280;
export const TREE_CAST_X_MIN = 0.44;
export const TREE_CAST_X_MAX = 0.62;

// ─── Main draw entry ─────────────────────────────
export function drawFrame(
    ctx: CanvasRenderingContext2D,
    canvas: HTMLCanvasElement,
    state: FiskeSnusState,
    selfId: string,
    prevState: FiskeSnusState | null,
    elapsedMs: number,
    now: number,
    flashes: ScreenFlash[],
    aimMouseX: number,
    hitLabels: HitLabel[],
    treeStuckUntil: number,
): void {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const p0 = state.players[0];
    const p1 = state.players[1];

    // Determine which side is self
    const selfIsP0 = p0.userId === selfId || (p0.isBot && p1.userId !== selfId);
    const leftPlayer = selfIsP0 ? p0 : p1;
    const rightPlayer = selfIsP0 ? p1 : p0;

    const prevLeft = prevState
        ? (selfIsP0 ? prevState.players[0] : prevState.players[1])
        : leftPlayer;
    const prevRight = prevState
        ? (selfIsP0 ? prevState.players[1] : prevState.players[0])
        : rightPlayer;

    const alpha = Math.min(1, elapsedMs / SERVER_TICK_MS);

    // Draw panels — self always gets aimMouseX, opponent gets 0.5
    drawPanel(ctx, 0, leftPlayer, prevLeft, alpha, now, true, aimMouseX, hitLabels, treeStuckUntil);
    drawPanel(ctx, PANEL_W, rightPlayer, prevRight, alpha, now, false, 0.5, [], 0);

    // Divider
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(PANEL_W, 0);
    ctx.lineTo(PANEL_W, CANVAS_H);
    ctx.stroke();

    // Flashes (per-panel — for simplicity, flash the whole canvas)
    for (const flash of flashes) {
        const progress = 1 - (flash.expiresAt - now) / flash.duration;
        const a = flash.alpha * (1 - progress);
        ctx.fillStyle = flash.color;
        ctx.globalAlpha = Math.max(0, a);
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.globalAlpha = 1;
    }
}

// ─── Panel ───────────────────────────────────────
function drawPanel(
    ctx: CanvasRenderingContext2D,
    offsetX: number,
    p: FiskeSnusPlayerState,
    prev: FiskeSnusPlayerState,
    alpha: number,
    now: number,
    isSelf: boolean,
    aimMouseX: number,
    hitLabels: HitLabel[],
    treeStuckUntil: number,
): void {
    ctx.save();
    ctx.translate(offsetX, 0);

    // Clip to panel
    ctx.beginPath();
    ctx.rect(0, 0, PANEL_W, CANVAS_H);
    ctx.clip();

    const treeStuck = p.treeStuck || (isSelf && now < treeStuckUntil);

    drawSky(ctx, now);
    drawTree(ctx, now);
    drawWaterline(ctx, now);
    drawUnderwater(ctx, p, prev, alpha, now, isSelf ? aimMouseX : -1);
    // Scale boat + fisherman up from waterline anchor
    ctx.save();
    ctx.translate(0, WATERLINE_Y);
    ctx.scale(1.45, 1.45);
    ctx.translate(0, -WATERLINE_Y);
    drawBoat(ctx, now);
    drawFisherman(ctx, p, now, treeStuck);
    ctx.restore();
    if (treeStuck) {
        drawLineStuckInTree(ctx, now);
        if (isSelf && now < treeStuckUntil) drawTreeStuckLabel(ctx, now, treeStuckUntil);
    } else {
        drawLineAndRod(ctx, p, now);
    }
    drawHUD(ctx, p, isSelf);
    drawStageUI(ctx, p, prev, alpha, now, isSelf ? aimMouseX : -1, isSelf);
    if (hitLabels.length > 0) drawHitLabels(ctx, now, hitLabels);

    ctx.restore();
}

// ─── Sky ─────────────────────────────────────────
function drawSky(ctx: CanvasRenderingContext2D, now: number): void {
    const grad = ctx.createLinearGradient(0, 0, 0, WATERLINE_Y);
    grad.addColorStop(0, COLOR_SKY_TOP);
    grad.addColorStop(1, COLOR_SKY_BOT);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, PANEL_W, WATERLINE_Y);

    // Stars (static, seeded by panel width)
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    for (let i = 0; i < 20; i++) {
        const sx = ((i * 73 + 17) % PANEL_W);
        const sy = ((i * 31 + 11) % (WATERLINE_Y - 20)) + 5;
        const twinkle = 0.3 + 0.3 * Math.sin(now / 800 + i);
        ctx.globalAlpha = twinkle;
        ctx.fillRect(sx, sy, 1.5, 1.5);
    }
    ctx.globalAlpha = 1;
}

// ─── Tree / Island ────────────────────────────────
const ISLAND_Y = WATERLINE_Y + 4;        // island sits just on the waterline
const TREE_BASE_Y = ISLAND_Y - 10;       // trunk base on top of island mound
const TREE_HOOK_X = TREE_X + 2;          // where the hook gets snagged (upper branch)
const TREE_HOOK_Y = TREE_BASE_Y - 90;

function drawTree(ctx: CanvasRenderingContext2D, now: number): void {
    const tx = TREE_X;
    const bob = Math.sin(now / 900) * 2;  // bobs with the water
    const by = TREE_BASE_Y + bob;
    const iy = ISLAND_Y + bob;

    // Island mound
    ctx.fillStyle = '#3a5a2a';
    ctx.beginPath();
    ctx.ellipse(tx, iy, 38, 12, 0, Math.PI, 0);
    ctx.fill();
    // Sandy shore edge
    ctx.fillStyle = '#8a7a3a';
    ctx.beginPath();
    ctx.ellipse(tx, iy, 38, 7, 0, 0, Math.PI);
    ctx.fill();

    // Trunk
    ctx.fillStyle = '#5a3a1a';
    ctx.fillRect(tx - 6, by - 40, 12, 40);

    // Foliage layers (pine-style, bigger)
    const layers = [
        { y: by - 38, w: 60, h: 34 },
        { y: by - 66, w: 46, h: 30 },
        { y: by - 90, w: 32, h: 26 },
        { y: by - 110, w: 20, h: 22 },
    ];
    for (const l of layers) {
        ctx.fillStyle = '#1a4a1a';
        ctx.beginPath();
        ctx.moveTo(tx - l.w / 2, l.y);
        ctx.lineTo(tx + l.w / 2, l.y);
        ctx.lineTo(tx, l.y - l.h);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#2a6a2a';
        ctx.lineWidth = 1;
        ctx.stroke();
    }
}

function drawLineStuckInTree(ctx: CanvasRenderingContext2D, now: number): void {
    const bob = Math.sin(now / 900) * 2;
    const hookX = TREE_HOOK_X;
    const hookY = TREE_HOOK_Y + bob;

    const rodBaseX = 58;
    const rodBaseY = WATERLINE_Y - 91;
    const rodAngle = -0.3;
    const rodLen = 85;
    const rodTipX = rodBaseX + Math.cos(rodAngle) * rodLen;
    const rodTipY = rodBaseY + Math.sin(rodAngle) * rodLen;

    // Rod
    ctx.strokeStyle = '#6a4a1a';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(rodBaseX, rodBaseY);
    ctx.lineTo(rodTipX, rodTipY);
    ctx.stroke();

    // Taut line from rod tip to snag point — slight jiggle
    const jiggle = Math.sin(now / 60) * 1.5;
    ctx.strokeStyle = 'rgba(200,200,200,0.85)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(rodTipX, rodTipY);
    ctx.quadraticCurveTo(
        (rodTipX + hookX) / 2 + jiggle,
        Math.min(rodTipY, hookY) - 20,
        hookX + jiggle, hookY,
    );
    ctx.stroke();

    // Hook dot in tree
    ctx.fillStyle = COLOR_HOOK;
    ctx.beginPath();
    ctx.arc(hookX, hookY, 3, 0, Math.PI * 2);
    ctx.fill();
}

function drawTreeStuckLabel(ctx: CanvasRenderingContext2D, now: number, stuckUntil: number): void {
    const progress = 1 - (stuckUntil - now) / 3000;
    const slideY = progress < 0.15 ? (1 - progress / 0.15) * 20 : 0;
    const alpha = progress > 0.75 ? 1 - (progress - 0.75) / 0.25 : 1;

    const cx = PANEL_W / 2;
    const cy = WATERLINE_Y - 80 + slideY;

    ctx.save();
    ctx.globalAlpha = Math.max(0, alpha);

    ctx.fillStyle = '#ffdd55';
    ctx.font = 'bold 18px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Säg det inte!', cx, cy);

    ctx.restore();
}

// ─── Waterline ───────────────────────────────────
function drawWaterline(ctx: CanvasRenderingContext2D, now: number): void {
    ctx.fillStyle = COLOR_WATER_SURFACE;
    ctx.beginPath();
    ctx.moveTo(0, WATERLINE_Y);
    for (let x = 0; x <= PANEL_W; x += 8) {
        const y = WATERLINE_Y + Math.sin(x / 30 + now / 600) * 3 + Math.sin(x / 12 + now / 300) * 1.5;
        ctx.lineTo(x, y);
    }
    ctx.lineTo(PANEL_W, CANVAS_H);
    ctx.lineTo(0, CANVAS_H);
    ctx.closePath();

    // Underwater gradient
    const grad = ctx.createLinearGradient(0, WATERLINE_Y, 0, CANVAS_H);
    grad.addColorStop(0, COLOR_WATER_SURFACE);
    grad.addColorStop(1, COLOR_WATER_DEEP);
    ctx.fillStyle = grad;
    ctx.fill();
}

// ─── Boat ─────────────────────────────────────────
function drawBoat(ctx: CanvasRenderingContext2D, now: number): void {
    const bob = Math.sin(now / 900) * 2;
    const bY = WATERLINE_Y + bob;

    // Hull outer (dark wood) — wider and taller
    ctx.fillStyle = '#3a2010';
    ctx.beginPath();
    ctx.moveTo(-6, bY - 16);
    ctx.lineTo(110, bY - 16);
    ctx.lineTo(98, bY + 16);
    ctx.lineTo(8, bY + 16);
    ctx.closePath();
    ctx.fill();

    // Hull inner (lighter deck)
    ctx.fillStyle = COLOR_DOCK;
    ctx.beginPath();
    ctx.moveTo(2, bY - 10);
    ctx.lineTo(102, bY - 10);
    ctx.lineTo(92, bY + 9);
    ctx.lineTo(10, bY + 9);
    ctx.closePath();
    ctx.fill();

    // Plank lines
    ctx.strokeStyle = '#3a2010';
    ctx.lineWidth = 1;
    for (let i = 1; i < 6; i++) {
        const px = 10 + i * 16;
        ctx.beginPath();
        ctx.moveTo(px, bY - 10);
        ctx.lineTo(px - 2, bY + 9);
        ctx.stroke();
    }

    // Gunwale trim (top edge highlight)
    ctx.strokeStyle = '#5a3820';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-6, bY - 16);
    ctx.lineTo(110, bY - 16);
    ctx.stroke();

    // Sitting passenger with beer (right side of boat)
    drawPassenger(ctx, now, bY);

    // Second passenger: short woman reading a book (middle of boat)
    drawBookWoman(ctx, now, bY);

    // Small electric engine on the right (stern) side
    drawElectricEngine(ctx, now, bY);
}

function drawElectricEngine(ctx: CanvasRenderingContext2D, now: number, bY: number): void {
    // Clamp bracket onto the stern (right hull edge at x≈100, top of hull at bY-16)
    const clampX = 100;
    const clampY = bY - 16;

    ctx.save();
    ctx.translate(clampX, clampY);

    // Clamp that grips the gunwale — two jaws
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, -4, 10, 4);   // top jaw (over gunwale)
    ctx.fillRect(0, 0, 10, 4);    // bottom jaw (under gunwale)
    ctx.fillRect(4, 4, 3, 10);    // vertical tiller shaft going down

    // Motor head (small black box hanging off the shaft)
    ctx.fillStyle = '#111';
    ctx.beginPath();
    ctx.roundRect(0, 14, 14, 9, 2);
    ctx.fill();
    // Subtle sheen
    ctx.fillStyle = '#333';
    ctx.fillRect(2, 15, 8, 2);

    // Submerged shaft
    ctx.strokeStyle = '#222';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(7, 23);
    ctx.lineTo(7, 32);
    ctx.stroke();

    // Propeller blades (spinning)
    const spin = now / 80;
    ctx.save();
    ctx.translate(7, 33);
    ctx.strokeStyle = '#444';
    ctx.lineWidth = 2;
    for (let i = 0; i < 3; i++) {
        const angle = spin + (i * Math.PI * 2) / 3;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos(angle) * 6, Math.sin(angle) * 2.5);
        ctx.stroke();
    }
    ctx.restore();

    // Propeller wash bubbles
    for (let i = 0; i < 3; i++) {
        const bt = (now / 300 + i * 0.4) % 1;
        const bx = Math.sin(now / 200 + i * 2.1) * 3;
        ctx.globalAlpha = 0.35 * (1 - bt);
        ctx.fillStyle = '#aaddff';
        ctx.beginPath();
        ctx.arc(7 + bx, 35 + bt * 8, 1.2, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.globalAlpha = 1;

    ctx.restore();
}

function drawPassenger(ctx: CanvasRenderingContext2D, now: number, bY: number): void {
    // Seated position — torso at deck level, legs tucked in
    const px = 82;
    const py = bY - 10; // sitting on the deck edge

    ctx.save();
    ctx.translate(px, py);

    // Legs (short, bent — sitting)
    ctx.fillStyle = '#2a4a6a';
    ctx.fillRect(-5, 2, 4, 12);  // left leg
    ctx.fillRect(2, 2, 4, 12);   // right leg
    // Feet
    ctx.fillStyle = '#1a1a2a';
    ctx.fillRect(-6, 13, 6, 3);
    ctx.fillRect(1, 13, 6, 3);

    // Torso (shorter than fisherman)
    ctx.fillStyle = '#7a3a1a';
    ctx.fillRect(-7, -10, 14, 13);

    // Head (smaller)
    ctx.beginPath();
    ctx.arc(0, -17, 7, 0, Math.PI * 2);
    ctx.fillStyle = '#c8a070';
    ctx.fill();

    // Orange goatee — chin patch + mustache
    ctx.fillStyle = '#cc5500';
    // Chin patch
    ctx.beginPath();
    ctx.ellipse(0, -11.5, 1.8, 1.4, 0, 0, Math.PI * 2);
    ctx.fill();
    // Mustache (two wings)
    ctx.beginPath();
    ctx.ellipse(-2, -13.5, 2.2, 0.9, 0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(2, -13.5, 2.2, 0.9, -0.3, 0, Math.PI * 2);
    ctx.fill();

    // Bucket hat (green)
    // Crown: trapezoid — narrow top, wider bottom
    ctx.fillStyle = '#2a7a2a';
    ctx.beginPath();
    ctx.moveTo(-4, -28);  // top-left
    ctx.lineTo(4, -28);   // top-right
    ctx.lineTo(6, -23);   // bottom-right
    ctx.lineTo(-6, -23);  // bottom-left
    ctx.closePath();
    ctx.fill();
    // Flat top
    ctx.beginPath();
    ctx.ellipse(0, -28, 4, 1.5, 0, 0, Math.PI * 2);
    ctx.fill();
    // Brim
    ctx.fillStyle = '#1a5a1a';
    ctx.beginPath();
    ctx.ellipse(0, -23, 9, 1.8, 0, 0, Math.PI * 2);
    ctx.fill();

    // Left arm resting on knee
    ctx.fillStyle = '#7a3a1a';
    ctx.fillRect(-10, -5, 4, 9);

    // Right arm holding beer — slightly raised
    ctx.save();
    ctx.translate(8, -4);
    ctx.rotate(-0.4);
    ctx.fillStyle = '#7a3a1a';
    ctx.fillRect(0, -3, 4, 9);
    // Hand wrapped around can
    ctx.fillStyle = '#c8a070';
    ctx.beginPath();
    ctx.ellipse(2, 8, 3, 2, 0, 0, Math.PI * 2);
    ctx.fill();
    // Beer can held in hand
    ctx.save();
    ctx.translate(2, 6);
    // Can body
    ctx.fillStyle = '#c8a020';
    ctx.fillRect(-3, -9, 6, 9);
    // Can top
    ctx.fillStyle = '#e0c040';
    ctx.fillRect(-3, -11, 6, 3);
    // Can label stripe
    ctx.fillStyle = '#e04010';
    ctx.fillRect(-3, -4, 6, 3);
    // Pull tab
    ctx.strokeStyle = '#aaaaaa';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, -11);
    ctx.lineTo(2, -13);
    ctx.stroke();
    ctx.restore();
    ctx.restore();

    ctx.restore();
}

function drawBookWoman(ctx: CanvasRenderingContext2D, now: number, bY: number): void {
    // Short woman sitting in the middle of the boat, reading a book
    const px = 58;
    const py = bY - 10;

    ctx.save();
    ctx.translate(px, py);

    // Legs (short, bent — sitting, slightly to the side)
    ctx.fillStyle = '#4a2a6a';
    ctx.fillRect(-5, 2, 4, 10);
    ctx.fillRect(2, 2, 4, 10);
    // Feet
    ctx.fillStyle = '#1a1a2a';
    ctx.fillRect(-6, 11, 6, 3);
    ctx.fillRect(1, 11, 6, 3);

    // Skirt / lower body
    ctx.fillStyle = '#7a3a8a';
    ctx.beginPath();
    ctx.moveTo(-7, 2);
    ctx.lineTo(7, 2);
    ctx.lineTo(9, 12);
    ctx.lineTo(-9, 12);
    ctx.closePath();
    ctx.fill();

    // Torso (shorter than fisherman)
    ctx.fillStyle = '#9a5aaa';
    ctx.fillRect(-6, -9, 12, 12);

    // Head (smaller — short woman)
    ctx.beginPath();
    ctx.arc(0, -16, 6, 0, Math.PI * 2);
    ctx.fillStyle = '#c8a070';
    ctx.fill();

    // Hair (long, flowing down sides)
    ctx.fillStyle = '#3a1a0a';
    // Top of hair over head
    ctx.beginPath();
    ctx.arc(0, -16, 7, Math.PI, 0);
    ctx.fill();
    // Left side — long strand down to shoulder
    ctx.beginPath();
    ctx.moveTo(-7, -16);
    ctx.bezierCurveTo(-10, -10, -11, 0, -9, 8);
    ctx.lineTo(-6, 8);
    ctx.bezierCurveTo(-8, 0, -7, -10, -5, -16);
    ctx.fill();
    // Right side — long strand down to shoulder
    ctx.beginPath();
    ctx.moveTo(7, -16);
    ctx.bezierCurveTo(10, -10, 11, 0, 9, 8);
    ctx.lineTo(6, 8);
    ctx.bezierCurveTo(8, 0, 7, -10, 5, -16);
    ctx.fill();

    // Both arms angled down holding book
    ctx.fillStyle = '#9a5aaa';
    // Left arm
    ctx.save();
    ctx.translate(-6, -4);
    ctx.rotate(0.7);
    ctx.fillRect(0, 0, 3, 9);
    // Ring band
    ctx.strokeStyle = '#d4aa00';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(1.5, 7, 3, 1.2, 0, 0, Math.PI * 2);
    ctx.stroke();
    // Green center stone
    ctx.fillStyle = '#22cc55';
    ctx.beginPath();
    ctx.ellipse(1.5, 5.5, 2.2, 1.8, 0, 0, Math.PI * 2);
    ctx.fill();
    // Stone highlight
    ctx.fillStyle = 'rgba(180,255,200,0.6)';
    ctx.beginPath();
    ctx.ellipse(0.8, 4.8, 0.9, 0.6, -0.4, 0, Math.PI * 2);
    ctx.fill();
    // Small diamonds around stone (4 points)
    ctx.fillStyle = '#eef8ff';
    const dAngles = [0, Math.PI / 2, Math.PI, 3 * Math.PI / 2];
    for (const a of dAngles) {
        const dx = 1.5 + Math.cos(a) * 3.2;
        const dy = 5.5 + Math.sin(a) * 2.6;
        ctx.beginPath();
        ctx.arc(dx, dy, 0.8, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.restore();
    // Right arm
    ctx.save();
    ctx.translate(6, -4);
    ctx.rotate(-0.7);
    ctx.fillRect(-3, 0, 3, 9);
    ctx.restore();

    // Book (open, held in lap — slight page-turn bob)
    const pageTurn = Math.sin(now / 2200) * 0.5;
    ctx.save();
    ctx.translate(0, 4);

    // Left page
    ctx.save();
    ctx.rotate(-0.15 + pageTurn * 0.05);
    ctx.fillStyle = '#f0e8d0';
    ctx.fillRect(-9, -5, 9, 7);
    ctx.strokeStyle = '#aaa090';
    ctx.lineWidth = 0.5;
    // Text lines on left page
    for (let i = 1; i < 4; i++) {
        ctx.beginPath();
        ctx.moveTo(-8, -5 + i * 1.5);
        ctx.lineTo(-1, -5 + i * 1.5);
        ctx.stroke();
    }
    ctx.restore();

    // Right page
    ctx.save();
    ctx.rotate(0.15 - pageTurn * 0.05);
    ctx.fillStyle = '#e8e0c8';
    ctx.fillRect(0, -5, 9, 7);
    ctx.strokeStyle = '#aaa090';
    ctx.lineWidth = 0.5;
    // Text lines on right page
    for (let i = 1; i < 4; i++) {
        ctx.beginPath();
        ctx.moveTo(1, -5 + i * 1.5);
        ctx.lineTo(8, -5 + i * 1.5);
        ctx.stroke();
    }
    ctx.restore();

    // Book spine
    ctx.fillStyle = '#6a4a8a';
    ctx.fillRect(-1, -5, 2, 7);

    ctx.restore(); // book

    ctx.restore(); // woman
}

// ─── Fisherman ───────────────────────────────────
function drawFisherman(ctx: CanvasRenderingContext2D, p: FiskeSnusPlayerState, now: number, treeStuck: boolean = false): void {
    const bodyX = 30;
    const bodyY = WATERLINE_Y - 60;

    ctx.save();
    ctx.translate(bodyX, bodyY);

    const isResult = p.phase === 'result';
    const isPerfectFish = isResult && p.lastStageResult !== null && p.fishCaught > 0;
    const isSnusResult = isResult && p.stageResults.length >= 4;

    // Body (simple geometric figure)
    // Legs
    ctx.fillStyle = '#2a4a6a';
    ctx.fillRect(-6, 20, 5, 22);
    ctx.fillRect(2, 20, 5, 22);

    // Torso
    ctx.fillStyle = '#3a5a7a';
    ctx.fillRect(-8, 2, 16, 20);

    // Head (thin ellipse)
    ctx.beginPath();
    ctx.ellipse(0, -4, 7, 9, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#c8a070';
    ctx.fill();

    // Black full beard — lower face, stays within head ellipse
    ctx.fillStyle = '#111111';
    ctx.beginPath();
    ctx.moveTo(-5.5, -1);
    ctx.bezierCurveTo(-6, 1, -3, 2, 0, 2);
    ctx.bezierCurveTo(3, 2, 6, 1, 5.5, -1);
    ctx.ellipse(0, -4, 7, 9, 0, Math.PI - 0.45, 0.45, true);
    ctx.closePath();
    ctx.fill();
    // Mustache — slightly lighter strip across upper lip
    ctx.fillStyle = '#2a2a2a';
    ctx.beginPath();
    ctx.ellipse(0, -2, 5, 1.3, 0, 0, Math.PI * 2);
    ctx.fill();

    // Bucket hat (blue)
    // Crown: trapezoid — narrow top, wider bottom, short height
    ctx.fillStyle = '#14357a';
    ctx.beginPath();
    ctx.moveTo(-5, -18);  // top-left
    ctx.lineTo(5, -18);   // top-right
    ctx.lineTo(8, -12);   // bottom-right (wider)
    ctx.lineTo(-8, -12);  // bottom-left (wider)
    ctx.closePath();
    ctx.fill();
    // Flat top
    ctx.beginPath();
    ctx.ellipse(0, -18, 5, 1.5, 0, 0, Math.PI * 2);
    ctx.fill();
    // Brim — sits on head, slopes slightly downward
    ctx.fillStyle = '#0e2a60';
    ctx.beginPath();
    ctx.ellipse(0, -12, 11, 2, 0, 0, Math.PI * 2);
    ctx.fill();

    // Fish emblem on front of hat
    ctx.save();
    ctx.translate(0, -15);
    ctx.scale(0.55, 0.55);
    ctx.fillStyle = '#aaddff';
    // Fish body
    ctx.beginPath();
    ctx.ellipse(0, 0, 6, 3, 0, 0, Math.PI * 2);
    ctx.fill();
    // Tail
    ctx.beginPath();
    ctx.moveTo(6, 0);
    ctx.lineTo(10, -3);
    ctx.lineTo(10, 3);
    ctx.closePath();
    ctx.fill();
    // Eye
    ctx.fillStyle = '#003388';
    ctx.beginPath();
    ctx.arc(-3, -0.5, 1, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Arm holding rod (right arm)
    const rodAngle = p.phase === 'boat'
        ? -1.1   // rod wrenched back hard — fish clearing the water
        : p.phase === 'bite' || p.phase === 'reel'
            ? -0.6   // rod bent down under tension
            : p.phase === 'casting'
                ? -0.4 - p.castProgress * 0.8  // sweeping forward
                : -0.3;  // default resting

    // Left arm — resting at side
    ctx.save();
    ctx.translate(-8, 5);
    ctx.rotate(0.3);
    ctx.fillStyle = '#3a5a7a';
    ctx.fillRect(-4, -3, 4, 14);
    // Left hand
    ctx.fillStyle = '#c8a070';
    ctx.beginPath();
    ctx.ellipse(-2, 13, 3.5, 2.5, 0, 0, Math.PI * 2);
    ctx.fill();
    // Fingers
    ctx.fillStyle = '#b89060';
    for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.ellipse(-3 + i * 2, 15, 1, 1.8, 0.1, 0, Math.PI * 2);
        ctx.fill();
    }
    // Golden ring on finger
    ctx.fillStyle = '#ffcc00';
    ctx.beginPath();
    ctx.ellipse(-1, 16, 2.2, 0.9, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#cc9900';
    ctx.lineWidth = 0.5;
    ctx.stroke();
    ctx.restore();

    // Right arm — holding rod
    ctx.save();
    ctx.translate(8, 5);
    ctx.rotate(rodAngle);
    ctx.fillStyle = '#3a5a7a';
    ctx.fillRect(0, -3, 4, 14);
    // Hand
    ctx.fillStyle = '#c8a070';
    ctx.beginPath();
    ctx.ellipse(2, 13, 3.5, 2.5, 0, 0, Math.PI * 2);
    ctx.fill();
    // Fingers
    ctx.fillStyle = '#b89060';
    for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.ellipse(-1 + i * 2, 15, 1, 1.8, 0.1, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.restore();

    // Fishing rod — drawn in body-local space, pointing right (+x) from hand position
    // Hand world-local position: arm at (8,5) rotated by rodAngle, hand tip at arm-local (2,13)
    const handLX = 8 + Math.cos(rodAngle) * 2 - Math.sin(rodAngle) * 13;
    const handLY = 5 + Math.sin(rodAngle) * 2 + Math.cos(rodAngle) * 13;
    const rodOutAngle = p.phase === 'casting'
        ? -0.15 - p.castProgress * 1.4  // sweeps up to ~-1.55 rad (nearly vertical) at full cast
        : -0.15;
    if (!treeStuck) {
        ctx.strokeStyle = '#6a4a1a';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(handLX, handLY);
        ctx.lineTo(handLX + Math.cos(rodOutAngle) * 58, handLY + Math.sin(rodOutAngle) * 58);
        ctx.stroke();
        ctx.strokeStyle = '#9a7a3a';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(handLX + Math.cos(rodOutAngle) * 40, handLY + Math.sin(rodOutAngle) * 40);
        ctx.lineTo(handLX + Math.cos(rodOutAngle) * 58, handLY + Math.sin(rodOutAngle) * 58);
        ctx.stroke();
    }

    // Snus moment: other hand to mouth
    if (isSnusResult && p.lastStageResult !== 'miss') {
        // Left arm raised to mouth
        ctx.save();
        ctx.translate(-8, 3);
        ctx.rotate(-1.2);
        ctx.fillStyle = '#3a5a7a';
        ctx.fillRect(0, -3, 4, 10);
        ctx.restore();

        // Tiny snus tin near mouth
        ctx.fillStyle = '#4080c0';
        ctx.fillRect(-12, -12, 8, 6);
        ctx.fillStyle = '#6aafef';
        ctx.fillRect(-12, -12, 8, 2);

        // Glow effect
        const glowPulse = 0.4 + 0.3 * Math.sin(now / 120);
        const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, 35);
        glow.addColorStop(0, `rgba(255, 220, 0, ${glowPulse})`);
        glow.addColorStop(1, 'rgba(255, 220, 0, 0)');
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(0, 0, 35, 0, Math.PI * 2);
        ctx.fill();
    } else if (isPerfectFish) {
        // Arm raised holding fish
        ctx.save();
        ctx.translate(-8, 2);
        ctx.rotate(-0.8);
        ctx.fillStyle = '#3a5a7a';
        ctx.fillRect(0, -3, 4, 10);
        ctx.restore();
        // Small fish silhouette above head
        ctx.save();
        ctx.translate(-12, -30);
        drawFishShape(ctx, 20, 9, COLOR_FISH, 1);
        ctx.restore();
    }

    ctx.restore();
}

// ─── Rod and line ────────────────────────────────
function drawLineAndRod(ctx: CanvasRenderingContext2D, p: FiskeSnusPlayerState, now: number): void {
    const S = 1.45;
    const rodAngle = p.phase === 'boat'
        ? -1.1
        : p.phase === 'bite' || p.phase === 'reel'
            ? -0.6 : p.phase === 'casting' ? -0.4 - p.castProgress * 0.8 : -0.3;
    const rodOutAngle = p.phase === 'casting' ? -0.15 - p.castProgress * 1.4 : -0.15;
    // Hand position in body-local space (arm at (8,5) rotated by rodAngle, hand tip at arm-local (2,13))
    const handLX = 8 + Math.cos(rodAngle) * 2 - Math.sin(rodAngle) * 13;
    const handLY = 5 + Math.sin(rodAngle) * 2 + Math.cos(rodAngle) * 13;
    // Rod tip in body-local space
    const tipLX = handLX + Math.cos(rodOutAngle) * 58;
    const tipLY = handLY + Math.sin(rodOutAngle) * 58;
    // Body → world (body at (30, WL-60), scaled 1.45 from WL)
    const rodTipX = 30 * S + tipLX * S;
    const rodTipY = WATERLINE_Y + (-60 + tipLY) * S;

    if (p.phase === 'idle' || p.phase === 'aiming' || p.phase === 'casting' || p.phase === 'boat' || p.phase === 'snus' || p.phase === 'result' || p.phase === 'transition') return;

    // Hook position — use cast coordinates so line connects to the underwater hook
    const hookUWX = UW_X_MIN + (p.castX ?? 0.5) * (UW_X_MAX - UW_X_MIN);
    const hookUWY = UW_Y_TOP + (p.castDepth ?? 0.5) * (UW_Y_BOT - UW_Y_TOP);
    // Where the line enters the water (same X, waterline level)
    const waterEntryX = hookUWX;
    const waterEntryY = WATERLINE_Y + Math.sin(now / 700) * 2;

    ctx.strokeStyle = 'rgba(200,200,200,0.7)';
    ctx.lineWidth = 1;

    if (p.phase === 'reel') {
        // Line fades out as fish is reeled up (fishDepth 0→1 = fish at hook depth→surface)
        const reelProgress = p.fishDepth ?? 0;
        const aboveAlpha = 0.7 * (1 - reelProgress);
        if (aboveAlpha > 0.01) {
            ctx.strokeStyle = `rgba(200,200,200,${aboveAlpha})`;
            ctx.beginPath();
            ctx.moveTo(rodTipX, rodTipY);
            ctx.lineTo(waterEntryX, waterEntryY);
            ctx.stroke();
            const uwAlpha = 0.25 * (1 - reelProgress);
            ctx.strokeStyle = `rgba(200,200,200,${uwAlpha})`;
            ctx.beginPath();
            ctx.moveTo(waterEntryX, waterEntryY);
            ctx.lineTo(hookUWX, hookUWY);
            ctx.stroke();
        }
    } else if (p.phase === 'bite') {
        // Taut line from rod tip straight to water entry then down to hook
        ctx.beginPath();
        ctx.moveTo(rodTipX, rodTipY);
        ctx.lineTo(waterEntryX, waterEntryY);
        ctx.stroke();
        ctx.strokeStyle = 'rgba(200,200,200,0.4)';
        ctx.beginPath();
        ctx.moveTo(waterEntryX, waterEntryY);
        ctx.lineTo(hookUWX, hookUWY);
        ctx.stroke();
    } else {
        // Drooping line from rod tip to water entry
        const midX = (rodTipX + waterEntryX) / 2;
        const midY = (rodTipY + waterEntryY) / 2 + 20;
        ctx.beginPath();
        ctx.moveTo(rodTipX, rodTipY);
        ctx.quadraticCurveTo(midX, midY, waterEntryX, waterEntryY);
        ctx.stroke();
        // Faint line underwater down to hook
        ctx.strokeStyle = 'rgba(200,200,200,0.25)';
        ctx.beginPath();
        ctx.moveTo(waterEntryX, waterEntryY);
        ctx.lineTo(hookUWX, hookUWY);
        ctx.stroke();
    }

    // Float (during waiting/nibble)
    if (p.phase === 'waiting' || p.phase === 'nibble') {
        const floatY = waterEntryY - 3 + (p.phase === 'nibble' ? Math.sin(now / 80) * 4 : 0);
        ctx.fillStyle = '#cc2222';
        ctx.beginPath();
        ctx.arc(waterEntryX, floatY, 5, 0, Math.PI * 2);
        ctx.fill();
    }
}

// ─── Underwater ──────────────────────────────────
function drawUnderwater(
    ctx: CanvasRenderingContext2D,
    p: FiskeSnusPlayerState,
    prev: FiskeSnusPlayerState,
    alpha: number,
    now: number,
    _aimMouseX: number, // -1 = opponent panel (no aim preview), 0–1 = self aim position
): void {
    // Ambient bubbles
    ctx.fillStyle = 'rgba(100,160,200,0.3)';
    for (let i = 0; i < 8; i++) {
        const bx = ((i * 67 + 23) % PANEL_W);
        const by = WATERLINE_Y + 30 + ((now / (200 + i * 30) + i * 40) % (CANVAS_H - WATERLINE_Y - 30));
        ctx.beginPath();
        ctx.arc(bx, by, 1.5 + (i % 3), 0, Math.PI * 2);
        ctx.fill();
    }

    // Ambient fish; skip any that are currently approaching the hook (rendered separately below)
    const ambientFishPrev = prev.ambientFish ?? [];
    for (let i = 0; i < p.ambientFish.length; i++) {
        const fc = p.ambientFish[i];
        if (fc.approaching) continue;
        const fp = ambientFishPrev[i] ?? fc;
        const fx = UW_X_MIN + (fp.x + (fc.x - fp.x) * alpha) * (UW_X_MAX - UW_X_MIN);
        const fy = UW_Y_TOP + (fp.y + (fc.y - fp.y) * alpha) * (UW_Y_BOT - UW_Y_TOP);
        ctx.save();
        ctx.translate(fx, fy);
        if (fc.dir < 0) ctx.scale(-1, 1);
        if (fc.canBite) {
            // Subtle glow ring
            const glow = ctx.createRadialGradient(0, 0, 4, 0, 0, 22);
            glow.addColorStop(0, 'rgba(255,220,80,0.22)');
            glow.addColorStop(1, 'rgba(255,220,80,0)');
            ctx.fillStyle = glow;
            ctx.beginPath();
            ctx.ellipse(0, 0, 22, 14, 0, 0, Math.PI * 2);
            ctx.fill();
            drawFishShape(ctx, FISH_W * 0.75, FISH_H * 0.75, COLOR_FISH, 1);
        } else {
            drawFishShape(ctx, FISH_W * 0.55, FISH_H * 0.55, '#7a9060', 0.5);
        }
        ctx.restore();
    }

    // Hook position based on cast
    const hookX = getHookVisualX(p.castX ?? 0.5);
    const hookY = getHookVisualY(p.castDepth ?? 0.5);

    // Draw fish if in active fishing phases (boat phase: fish is above water, drawn separately)
    const showFish = ['waiting', 'nibble', 'bite', 'reel'].includes(p.phase);
    if (showFish) {
        // Interpolate fish approach
        const approach = (prev.fishApproachProgress ?? 0) + (p.fishApproachProgress - (prev.fishApproachProgress ?? 0)) * alpha;
        const depth = (prev.fishDepth ?? 0) + (p.fishDepth - (prev.fishDepth ?? 0)) * alpha;

        // Fish swims from its actual starting position toward the hook
        const startX = UW_X_MIN + (p.approachFishStartX ?? 1) * (UW_X_MAX - UW_X_MIN);
        const startY = UW_Y_TOP + (p.approachFishStartY ?? p.castDepth) * (UW_Y_BOT - UW_Y_TOP);
        const fishX = startX + (hookX - startX) * approach;
        const fishBaseY = startY + (hookY - startY) * approach;
        const fishSineY = Math.sin(now / 500 + fishX / 40) * 12;
        const reelRise = depth * (hookY - UW_Y_TOP - 10);
        const fishY = fishBaseY + fishSineY - reelRise;

        const scale = 0.4 + approach * 0.6;
        const nibbleOffset = p.phase === 'nibble' ? Math.sin(now / 60) * 6 : 0;

        // Face toward the hook
        const facingLeft = hookX < startX;
        ctx.save();
        ctx.translate(fishX + nibbleOffset, fishY);
        if (facingLeft) ctx.scale(-1, 1);
        drawFishShape(ctx, FISH_W * scale, FISH_H * scale, COLOR_FISH, 1);
        ctx.restore();

        // Hook
        ctx.strokeStyle = COLOR_HOOK;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(hookX, hookY, 5, 0, Math.PI * 1.5);
        ctx.stroke();

        // Bait (worm) — hide once fish has bitten
        if (p.phase !== 'bite' && p.phase !== 'reel') {
            const wiggle = Math.sin(now / 150) * 2;
            ctx.save();
            ctx.translate(hookX + 3, hookY + 5);
            ctx.strokeStyle = '#cc4433';
            ctx.lineWidth = 2.5;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.bezierCurveTo(4 + wiggle, 3, -2 + wiggle, 6, 3, 9);
            ctx.bezierCurveTo(6 + wiggle, 12, 0, 15, 2 + wiggle, 18);
            ctx.stroke();
            ctx.restore();
        }
    }
}

function drawFishShape(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    color: string,
    opacity: number,
): void {
    ctx.save();
    ctx.globalAlpha = opacity;
    // Body
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(-w * 0.1, 0, w * 0.45, h * 0.45, 0, 0, Math.PI * 2);
    ctx.fill();
    // Tail
    ctx.beginPath();
    ctx.moveTo(w * 0.3, 0);
    ctx.lineTo(w * 0.55, -h * 0.45);
    ctx.lineTo(w * 0.55, h * 0.45);
    ctx.closePath();
    ctx.fill();
    // Eye
    ctx.fillStyle = '#1a1a1a';
    ctx.beginPath();
    ctx.arc(-w * 0.28, -h * 0.1, h * 0.12, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
}

// ─── Boat phase: fish dangling above water ────────
function drawBoatPhaseAboveWater(ctx: CanvasRenderingContext2D, now: number): void {
    // Fish swings pendulum-style on the line above the waterline
    const swing = Math.sin(now / 300) * 18;
    const boatFishX = PANEL_W * 0.55 + swing;
    const boatFishY = WATERLINE_Y - 28;

    // Splash droplets at waterline entry point (persistent while in boat phase)
    ctx.save();
    for (let i = 0; i < 6; i++) {
        const angle = (i / 6) * Math.PI + Math.PI * 0.1;  // semicircle upward
        const dist = 8 + (i % 3) * 5;
        const t = (now / 200 + i * 0.4) % 1;
        const dx = Math.cos(angle) * dist * t;
        const dy = -Math.abs(Math.sin(angle)) * dist * t - t * 12;
        ctx.globalAlpha = (1 - t) * 0.7;
        ctx.fillStyle = '#aaddee';
        ctx.beginPath();
        ctx.arc(PANEL_W * 0.55 + dx, WATERLINE_Y + dy, 2.5 - t * 1.5, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Ripple rings at surface entry
    for (let r = 0; r < 2; r++) {
        const t = ((now / 400 + r * 0.5) % 1);
        ctx.beginPath();
        ctx.ellipse(PANEL_W * 0.55, WATERLINE_Y + 2, (6 + t * 14), (2 + t * 4), 0, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(150,220,240,${0.5 * (1 - t)})`;
        ctx.lineWidth = 1.5;
        ctx.stroke();
    }

    // Fish dangling — flipping/struggling
    const flipAngle = Math.sin(now / 150) * 0.6;
    ctx.save();
    ctx.translate(boatFishX, boatFishY);
    ctx.rotate(flipAngle - Math.PI * 0.5);  // vertical by default, flapping around it
    drawFishShape(ctx, FISH_W * 1.0, FISH_H * 1.0, COLOR_FISH, 1);
    ctx.restore();

    ctx.restore();
}

// ─── Stage UI (meters etc.) ───────────────────────
function drawStageUI(
    ctx: CanvasRenderingContext2D,
    p: FiskeSnusPlayerState,
    prev: FiskeSnusPlayerState,
    alpha: number,
    now: number,
    aimMouseX: number,
    isSelf: boolean,
): void {
    switch (p.phase) {
        case 'aiming':
            if (aimMouseX >= 0) drawAimingUI(ctx, p, prev, alpha, now, aimMouseX);
            break;
        case 'bite':
            if (isSelf) drawArcMeter(ctx, p, prev, alpha, now, 'STRIKE! [Space]');
            break;
        case 'boat':
            drawBoatPhaseAboveWater(ctx, now);
            if (isSelf) drawArcMeter(ctx, p, prev, alpha, now, 'HAUL IN! [Space]');
            break;
        case 'reel':
            if (isSelf) drawReelBalanceBar(ctx, p, prev, alpha, now);
            break;
        case 'snus':
            if (isSelf) drawSnusTin(ctx, p, prev, alpha, now);
            break;
        case 'result':
            drawResultOverlay(ctx, p, now);
            break;
    }
}

// ─── Aiming UI ────────────────────────────────────
// Shared coordinate helpers for hook position in panel space
const UW_X_MIN = 120;
const UW_X_MAX = 420;
const UW_Y_TOP = WATERLINE_Y + 30;
const UW_Y_BOT = CANVAS_H - 30;

function getHookVisualX(castX: number): number {
    return UW_X_MIN + castX * (UW_X_MAX - UW_X_MIN);
}
function getHookVisualY(castDepth: number): number {
    return UW_Y_TOP + castDepth * (UW_Y_BOT - UW_Y_TOP);
}

function drawAimingUI(
    ctx: CanvasRenderingContext2D,
    p: FiskeSnusPlayerState,
    prev: FiskeSnusPlayerState,
    alpha: number,
    _now: number,
    mouseX: number,
): void {
    // Rod tip position (matches drawLineAndRod at default angle -0.3)
    const _S = 1.45, _a = -0.3, _o = -0.15;
    const _hLX = 8 + Math.cos(_a) * 2 - Math.sin(_a) * 13;
    const _hLY = 5 + Math.sin(_a) * 2 + Math.cos(_a) * 13;
    const rodTipX = 30 * _S + (_hLX + Math.cos(_o) * 58) * _S;
    const rodTipY = WATERLINE_Y + (-60 + _hLY + Math.sin(_o) * 58) * _S;

    // Where the hook will land horizontally based on mouse
    const landX = getHookVisualX(mouseX);

    // Interpolate power meter for depth preview
    const meter = (prev.meterValue ?? 0) + (p.meterValue - (prev.meterValue ?? 0)) * alpha;
    const previewY = getHookVisualY(meter);

    // Dotted trajectory arc: rod tip → water surface at landX
    ctx.save();
    ctx.setLineDash([5, 7]);
    ctx.strokeStyle = 'rgba(255,255,180,0.7)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(rodTipX, rodTipY);
    const ctrlX = (rodTipX + landX) / 2;
    const ctrlY = Math.min(rodTipY, WATERLINE_Y) - 40;
    ctx.quadraticCurveTo(ctrlX, ctrlY, landX, WATERLINE_Y - 2);
    ctx.stroke();

    // Depth preview: vertical dashed line from surface down to projected depth
    ctx.strokeStyle = 'rgba(255,255,180,0.35)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(landX, WATERLINE_Y + 5);
    ctx.lineTo(landX, previewY);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();

    // Landing circle at surface
    ctx.beginPath();
    ctx.arc(landX, WATERLINE_Y + 2, 5, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,150,0.8)';
    ctx.fill();

    // Hook depth preview dot
    ctx.beginPath();
    ctx.arc(landX, previewY, 4, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,200,80,0.9)';
    ctx.fill();
}


// ─── Arc meter ───────────────────────────────────
function drawArcMeter(
    ctx: CanvasRenderingContext2D,
    p: FiskeSnusPlayerState,
    prev: FiskeSnusPlayerState,
    alpha: number,
    now: number,
    label: string,
): void {
    const cx = PANEL_W / 2;
    const cy = METER_CY;
    const r = METER_RADIUS;

    // Interpolate meter value
    const mPrev = prev.meterValue;
    const mCurr = p.meterValue;
    const meter = mPrev + (mCurr - mPrev) * alpha;

    // Background track
    ctx.beginPath();
    ctx.arc(cx, cy, r, Math.PI, 0, false);
    ctx.strokeStyle = COLOR_METER_BG;
    ctx.lineWidth = 12;
    ctx.stroke();

    // Color zones
    const zones: Array<{ min: number; max: number; color: string }> = [
        { min: 0, max: ZONE_GOOD_MIN, color: COLOR_MISS },
        { min: ZONE_GOOD_MIN, max: ZONE_PERFECT_MIN, color: COLOR_GOOD },
        { min: ZONE_PERFECT_MIN, max: ZONE_PERFECT_MAX, color: COLOR_PERFECT },
        { min: ZONE_PERFECT_MAX, max: ZONE_GOOD_MAX, color: COLOR_GOOD },
        { min: ZONE_GOOD_MAX, max: 1, color: COLOR_MISS },
    ];

    for (const zone of zones) {
        const startAngle = Math.PI + zone.min * Math.PI;
        const endAngle = Math.PI + zone.max * Math.PI;
        ctx.beginPath();
        ctx.arc(cx, cy, r, startAngle, endAngle, false);
        ctx.strokeStyle = zone.color;
        ctx.lineWidth = 10;
        ctx.stroke();
    }

    // Needle
    const needleAngle = Math.PI + meter * Math.PI;
    const nx = cx + Math.cos(needleAngle) * (r + 6);
    const ny = cy + Math.sin(needleAngle) * (r + 6);
    ctx.strokeStyle = COLOR_NEEDLE;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(nx, ny);
    ctx.stroke();

    // Center pivot
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(cx, cy, 5, 0, Math.PI * 2);
    ctx.fill();

    // Prompt text
    const pulse = 0.7 + 0.3 * Math.sin(now / 200);
    ctx.globalAlpha = pulse;
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 14px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(label, cx, cy - r - 18);
    ctx.globalAlpha = 1;

    // Live zone label
    const inPerfect = meter >= ZONE_PERFECT_MIN && meter <= ZONE_PERFECT_MAX;
    const inGood = meter >= ZONE_GOOD_MIN && meter <= ZONE_GOOD_MAX;
    const zoneText = inPerfect ? 'PERFECT' : inGood ? 'GOOD' : 'MISS';
    const zoneColor = inPerfect ? COLOR_PERFECT : inGood ? COLOR_GOOD : COLOR_MISS;
    const zonePulse = inPerfect ? 0.8 + 0.2 * Math.sin(now / 80) : 1;
    ctx.globalAlpha = zonePulse;
    ctx.font = `bold ${inPerfect ? 15 : 13}px monospace`;
    ctx.fillStyle = zoneColor;
    ctx.textAlign = 'center';
    ctx.fillText(zoneText, cx, cy + 18);
    ctx.globalAlpha = 1;
}

// ─── Reel balance bar ─────────────────────────────
function drawReelBalanceBar(
    ctx: CanvasRenderingContext2D,
    p: FiskeSnusPlayerState,
    prev: FiskeSnusPlayerState,
    alpha: number,
    now: number,
): void {
    const bx = (PANEL_W - REEL_BAR_W) / 2;
    const by = REEL_BAR_Y;
    const bw = REEL_BAR_W;
    const bh = REEL_BAR_H;

    // Interpolate bar position
    const barPos = (prev.reelBarPosition ?? 0.5) + (p.reelBarPosition - (prev.reelBarPosition ?? 0.5)) * alpha;
    const inPerfect = barPos >= REEL_ZONE_PERFECT_MIN && barPos <= REEL_ZONE_PERFECT_MAX;
    const inGood = barPos >= REEL_ZONE_GOOD_MIN && barPos <= REEL_ZONE_GOOD_MAX;

    // ── Track background ──
    ctx.fillStyle = COLOR_METER_BG;
    ctx.beginPath();
    ctx.roundRect(bx, by, bw, bh, 4);
    ctx.fill();

    // ── Zone bands ──
    const goodX = bx + REEL_ZONE_GOOD_MIN * bw;
    const goodW = (REEL_ZONE_GOOD_MAX - REEL_ZONE_GOOD_MIN) * bw;
    ctx.fillStyle = 'rgba(204,204,34,0.20)';
    ctx.fillRect(goodX, by, goodW, bh);

    const perfX = bx + REEL_ZONE_PERFECT_MIN * bw;
    const perfW = (REEL_ZONE_PERFECT_MAX - REEL_ZONE_PERFECT_MIN) * bw;
    ctx.fillStyle = 'rgba(68,204,68,0.32)';
    ctx.fillRect(perfX, by, perfW, bh);

    // ── Center marker ──
    const centerX = bx + 0.5 * bw;
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(centerX, by - 4);
    ctx.lineTo(centerX, by + bh + 4);
    ctx.stroke();

    // ── Danger flash overlay ──
    if (p.reelInDanger) {
        const dangerPulse = 0.15 + 0.15 * Math.sin(now / 60);
        ctx.fillStyle = `rgba(220,50,50,${dangerPulse})`;
        ctx.fillRect(bx, by, bw, bh);
    }

    // ── Sliding indicator ──
    const indX = bx + barPos * bw;
    const indW = 14;
    const indH = bh + 10;

    // Glow when in perfect zone
    if (inPerfect) {
        const glow = 0.5 + 0.4 * Math.sin(now / 80);
        ctx.shadowColor = COLOR_PERFECT;
        ctx.shadowBlur = 12 * glow;
    }
    const indColor = inPerfect ? COLOR_PERFECT : inGood ? COLOR_GOOD : COLOR_MISS;
    ctx.fillStyle = indColor;
    ctx.beginPath();
    ctx.roundRect(indX - indW / 2, by - 5, indW, indH, 3);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.shadowColor = 'transparent';

    // Arrow chevrons on indicator
    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.lineWidth = 2;
    const cy2 = by + bh / 2;
    ctx.beginPath();
    ctx.moveTo(indX - 3, cy2 - 4);
    ctx.lineTo(indX, cy2);
    ctx.lineTo(indX - 3, cy2 + 4);
    ctx.moveTo(indX + 3, cy2 - 4);
    ctx.lineTo(indX, cy2);
    ctx.lineTo(indX + 3, cy2 + 4);
    ctx.stroke();

    // ── Track border ──
    ctx.strokeStyle = inPerfect
        ? `rgba(68,204,68,${0.6 + 0.4 * Math.sin(now / 80)})`
        : inGood ? COLOR_GOOD : 'rgba(255,255,255,0.3)';
    ctx.lineWidth = inPerfect ? 2 : 1;
    ctx.beginPath();
    ctx.roundRect(bx, by, bw, bh, 4);
    ctx.stroke();

    // ── Progress bar (below balance bar) ──
    const pbY = by + bh + 10;
    const pbH = 6;
    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    ctx.beginPath();
    ctx.roundRect(bx, pbY, bw, pbH, 3);
    ctx.fill();
    const pbFillW = (prev.reelProgress + (p.reelProgress - prev.reelProgress) * alpha) * bw;
    if (pbFillW > 0) {
        ctx.fillStyle = '#4aabee';
        ctx.beginPath();
        ctx.roundRect(bx, pbY, pbFillW, pbH, 3);
        ctx.fill();
    }

    // ── Static instruction ──
    ctx.globalAlpha = 0.75;
    ctx.fillStyle = '#ffffff';
    ctx.font = '11px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('Keep bar centered — press [Space] to nudge', PANEL_W / 2, by - 26);
    ctx.globalAlpha = 1;

    // ── Dynamic feedback label ──
    const pulse = 0.75 + 0.25 * Math.sin(now / 180);
    ctx.globalAlpha = pulse;
    ctx.fillStyle = inPerfect ? COLOR_PERFECT : inGood ? COLOR_GOOD : COLOR_MISS;
    ctx.font = `bold 13px monospace`;
    ctx.textAlign = 'center';
    ctx.fillText(
        inPerfect ? 'PERFECT — keep it here!' : inGood ? 'GOOD — stay centered!' : 'DRIFTING — press Space!',
        PANEL_W / 2, by - 12,
    );
    ctx.globalAlpha = 1;

    // ── Progress label ──
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = '#aaccff';
    ctx.font = '11px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('Reel progress', PANEL_W / 2, by + bh + pbH + 22);
    ctx.globalAlpha = 1;
}

// ─── Snus tin ────────────────────────────────────
function drawSnusTin(
    ctx: CanvasRenderingContext2D,
    p: FiskeSnusPlayerState,
    prev: FiskeSnusPlayerState,
    alpha: number,
    now: number,
): void {
    const cx = PANEL_W / 2;
    const cy = CANVAS_H / 2 + 20;

    const mPrev = prev.meterValue;
    const mCurr = p.meterValue;
    const meter = mPrev + (mCurr - mPrev) * alpha;

    if (p.snusStep === 0) {
        drawSnusOpenStep(ctx, cx, cy, meter, now);
    } else {
        drawSnusPopStep(ctx, cx, cy, meter, now);
    }
}

function drawTinBase(ctx: CanvasRenderingContext2D): void {
    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath();
    ctx.ellipse(3, 28, 26, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    // Cylinder
    const tinGrad = ctx.createLinearGradient(-26, -20, 26, -20);
    tinGrad.addColorStop(0, '#2060a0');
    tinGrad.addColorStop(0.5, '#4090d0');
    tinGrad.addColorStop(1, '#0f3060');
    ctx.fillStyle = tinGrad;
    ctx.fillRect(-26, -20, 52, 30);
    // Bottom
    ctx.fillStyle = '#0f3060';
    ctx.beginPath();
    ctx.ellipse(0, 10, 26, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    // Label dots
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.arc(-10 + i * 10, -5, 3, 0, Math.PI * 2);
        ctx.fill();
    }
}

function drawTinLid(ctx: CanvasRenderingContext2D, offsetY: number): void {
    ctx.save();
    ctx.translate(0, offsetY);
    const lidGrad = ctx.createLinearGradient(-28, -28, 28, -20);
    lidGrad.addColorStop(0, '#50a0e0');
    lidGrad.addColorStop(1, '#2060a0');
    ctx.fillStyle = lidGrad;
    ctx.beginPath();
    ctx.ellipse(0, -20, 28, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
}

function drawSnusOpenStep(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    meter: number,
    now: number,
): void {
    // Subtle glow near perfect zone
    const distFromPerfect = Math.abs(meter - 0.50);
    const glowAlpha = Math.max(0, 1 - distFromPerfect / 0.25);
    if (glowAlpha > 0) {
        const glow = ctx.createRadialGradient(cx, cy, 30, cx, cy, 75);
        glow.addColorStop(0, `rgba(255,220,0,${glowAlpha * 0.35})`);
        glow.addColorStop(1, 'rgba(255,220,0,0)');
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(cx, cy, 75, 0, Math.PI * 2);
        ctx.fill();
    }

    ctx.save();
    ctx.translate(cx, cy);
    drawTinBase(ctx);
    drawTinLid(ctx, 0);
    ctx.restore();

    // Arc meter below tin
    const arcCy = cy + 90;
    ctx.beginPath();
    ctx.arc(cx, arcCy, 50, Math.PI, 0, false);
    ctx.strokeStyle = '#1a1a2a';
    ctx.lineWidth = 12;
    ctx.stroke();

    const zones: Array<{ min: number; max: number; color: string }> = [
        { min: 0,    max: 0.35, color: '#cc3333' },
        { min: 0.35, max: 0.45, color: '#cccc22' },
        { min: 0.45, max: 0.55, color: '#44cc44' },
        { min: 0.55, max: 0.65, color: '#cccc22' },
        { min: 0.65, max: 1,    color: '#cc3333' },
    ];
    for (const z of zones) {
        ctx.beginPath();
        ctx.arc(cx, arcCy, 50, Math.PI + z.min * Math.PI, Math.PI + z.max * Math.PI, false);
        ctx.strokeStyle = z.color;
        ctx.lineWidth = 10;
        ctx.stroke();
    }

    const needleAngle = Math.PI + meter * Math.PI;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(cx, arcCy);
    ctx.lineTo(cx + Math.cos(needleAngle) * 56, arcCy + Math.sin(needleAngle) * 56);
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(cx, arcCy, 5, 0, Math.PI * 2);
    ctx.fill();

    const pulse = 0.6 + 0.4 * Math.sin(now / 160);
    ctx.globalAlpha = pulse;
    ctx.fillStyle = '#ffe033';
    ctx.font = 'bold 15px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('OPEN THE TIN! [Space]', cx, cy - 52);
    ctx.globalAlpha = 1;

    // Live zone label
    const snusOpenInPerf = meter >= 0.45 && meter <= 0.55;
    const snusOpenInGood = meter >= 0.35 && meter <= 0.65;
    const snusOpenZoneText = snusOpenInPerf ? 'PERFECT' : snusOpenInGood ? 'GOOD' : 'MISS';
    const snusOpenZoneColor = snusOpenInPerf ? COLOR_PERFECT : snusOpenInGood ? COLOR_GOOD : COLOR_MISS;
    ctx.globalAlpha = snusOpenInPerf ? 0.8 + 0.2 * Math.sin(now / 80) : 1;
    ctx.font = `bold ${snusOpenInPerf ? 15 : 13}px monospace`;
    ctx.fillStyle = snusOpenZoneColor;
    ctx.textAlign = 'center';
    ctx.fillText(snusOpenZoneText, cx, arcCy + 18);
    ctx.globalAlpha = 1;
}

function drawSnusPopStep(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    meter: number,
    now: number,
): void {
    // Lid flies upward as meter fills
    const lidOffset = -meter * 30;

    ctx.save();
    ctx.translate(cx, cy);
    drawTinBase(ctx);

    // Portioner rising from the open tin
    const pouchY = 2 - meter * 20;
    ctx.fillStyle = '#d4b896';
    ctx.beginPath();
    ctx.ellipse(0, pouchY, 14, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#a08060';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    drawTinLid(ctx, lidOffset);
    ctx.restore();

    // Rising fill bar to the right of the tin
    const barX = cx + 46;
    const barY = cy - 30;
    const barW = 18;
    const barH = 60;

    ctx.fillStyle = '#1a1a2a';
    ctx.fillRect(barX, barY, barW, barH);

    const goodMin = 0.38, goodMax = 0.62, perfMin = 0.44, perfMax = 0.56;
    ctx.fillStyle = 'rgba(204,204,34,0.25)';
    ctx.fillRect(barX, barY + barH - goodMax * barH, barW, (goodMax - goodMin) * barH);
    ctx.fillStyle = 'rgba(68,204,68,0.35)';
    ctx.fillRect(barX, barY + barH - perfMax * barH, barW, (perfMax - perfMin) * barH);

    const inPerf = meter >= perfMin && meter <= perfMax;
    const inGood = meter >= goodMin && meter <= goodMax;
    ctx.fillStyle = inPerf ? '#44cc44' : inGood ? '#cccc22' : '#cc3333';
    ctx.fillRect(barX, barY + barH - meter * barH, barW, meter * barH);

    if (inPerf) {
        ctx.strokeStyle = `rgba(68,204,68,${0.6 + 0.4 * Math.sin(now / 70)})`;
        ctx.lineWidth = 3;
        ctx.strokeRect(barX - 1, barY - 1, barW + 2, barH + 2);
    } else {
        ctx.strokeStyle = 'rgba(255,255,255,0.3)';
        ctx.lineWidth = 1;
        ctx.strokeRect(barX, barY, barW, barH);
    }

    // Arrow pointing at perfect zone
    const arrowY = barY + barH * (1 - 0.50);
    ctx.fillStyle = '#ffffff';
    ctx.globalAlpha = 0.7;
    ctx.beginPath();
    ctx.moveTo(barX - 4, arrowY);
    ctx.lineTo(barX - 10, arrowY - 5);
    ctx.lineTo(barX - 10, arrowY + 5);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;

    const pulse = 0.6 + 0.4 * Math.sin(now / 110);
    ctx.globalAlpha = pulse;
    ctx.fillStyle = '#ff8833';
    ctx.font = 'bold 15px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('POP IT IN! [Space]', cx, cy - 52);
    ctx.globalAlpha = 1;

    // Live zone label
    const snusPopZoneText = inPerf ? 'PERFECT' : inGood ? 'GOOD' : 'MISS';
    const snusPopZoneColor = inPerf ? COLOR_PERFECT : inGood ? COLOR_GOOD : COLOR_MISS;
    ctx.globalAlpha = inPerf ? 0.8 + 0.2 * Math.sin(now / 80) : 1;
    ctx.font = `bold ${inPerf ? 15 : 13}px monospace`;
    ctx.fillStyle = snusPopZoneColor;
    ctx.textAlign = 'center';
    ctx.fillText(snusPopZoneText, cx, barY + barH + 22);
    ctx.globalAlpha = 1;
}

// ─── Result overlay ───────────────────────────────
function drawResultOverlay(
    ctx: CanvasRenderingContext2D,
    p: FiskeSnusPlayerState,
    now: number,
): void {
    const cx = PANEL_W / 2;
    const cy = CANVAS_H / 2;

    const fishSize = p.lastFishSize;
    const fishCaught = p.stageResults.length >= 3 && p.stageResults[2] !== 'miss';
    const hasSnus = p.stageResults.length >= 4 && p.stageResults[3] !== 'miss';

    if (fishSize === 'big') {
        // Golden flash overlay — all-perfect big fish
        const pulse = 0.15 + 0.1 * Math.sin(now / 100);
        ctx.fillStyle = `rgba(255,220,0,${pulse})`;
        ctx.fillRect(0, 0, PANEL_W, CANVAS_H);

        ctx.font = '12px monospace';
        ctx.fillStyle = 'rgba(255,255,255,0.45)';
        ctx.textAlign = 'center';
        ctx.fillText('(big fish)', cx, cy - 15);

        // Big fish drawn in result
        ctx.save();
        ctx.translate(cx, cy + 22);
        drawFishShape(ctx, FISH_W * 1.5, FISH_H * 1.5, '#ffe033', 1);
        ctx.restore();

        // Stars
        for (let i = 0; i < 8; i++) {
            const angle = (i / 8) * Math.PI * 2 + now / 500;
            const sr = 60 + Math.sin(now / 200 + i) * 10;
            const sx = cx + Math.cos(angle) * sr;
            const sy = cy + Math.sin(angle) * sr;
            ctx.fillStyle = '#ffe033';
            ctx.font = '16px serif';
            ctx.fillText('★', sx - 8, sy);
        }
    } else if (!fishCaught) {
        ctx.fillStyle = 'rgba(200,50,50,0.15)';
        ctx.fillRect(0, 0, PANEL_W, CANVAS_H);
        ctx.fillStyle = COLOR_MISS;
        ctx.font = 'bold 18px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('FISH ESCAPED!', cx, cy);
    } else if (fishCaught && !hasSnus) {
        ctx.fillStyle = '#88aaff';
        ctx.font = 'bold 16px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('The snus fell in the water...', cx, cy - 20);
    } else if (fishSize === 'medium') {
        // Medium fish — green burst, standard fish
        const rayCount = 16;
        for (let i = 0; i < rayCount; i++) {
            const angle = (i / rayCount) * Math.PI * 2 + now / 1200;
            const len = 55 + Math.sin(now / 180 + i) * 10;
            const alpha2 = 0.25 + 0.15 * Math.sin(now / 140 + i * 0.7);
            ctx.strokeStyle = `rgba(136,255,136,${alpha2})`;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(cx + Math.cos(angle) * 28, cy + Math.sin(angle) * 28);
            ctx.lineTo(cx + Math.cos(angle) * len, cy + Math.sin(angle) * len);
            ctx.stroke();
        }
        const burstGlow = ctx.createRadialGradient(cx, cy, 10, cx, cy, 70);
        burstGlow.addColorStop(0, `rgba(136,255,136,${0.18 + 0.08 * Math.sin(now / 160)})`);
        burstGlow.addColorStop(1, 'rgba(136,255,136,0)');
        ctx.fillStyle = burstGlow;
        ctx.beginPath();
        ctx.arc(cx, cy, 70, 0, Math.PI * 2);
        ctx.fill();

        ctx.font = '12px monospace';
        ctx.fillStyle = 'rgba(255,255,255,0.45)';
        ctx.textAlign = 'center';
        ctx.fillText('(medium fish)', cx, cy - 5);

        ctx.save();
        ctx.translate(cx, cy + 10);
        drawFishShape(ctx, FISH_W * 1.1, FISH_H * 1.1, COLOR_FISH, 1);
        ctx.restore();
    } else if (fishSize === 'small') {
        // Small fish — muted, small catch
        ctx.fillStyle = 'rgba(160,120,60,0.12)';
        ctx.fillRect(0, 0, PANEL_W, CANVAS_H);

        ctx.font = '12px monospace';
        ctx.fillStyle = 'rgba(255,255,255,0.45)';
        ctx.textAlign = 'center';
        ctx.fillText('(small fish)', cx, cy - 5);

        ctx.save();
        ctx.translate(cx, cy + 14);
        drawFishShape(ctx, FISH_W * 0.7, FISH_H * 0.7, '#a07040', 1);
        ctx.restore();
    }
}

// ─── HUD ──────────────────────────────────────────
function drawHUD(
    ctx: CanvasRenderingContext2D,
    p: FiskeSnusPlayerState,
    isSelf: boolean,
): void {
    const cx = PANEL_W / 2;
    const topY = 18;

    // Score progress bar (totalScore / 10)
    const SCORE_TO_WIN = 10;
    const barW = 160;
    const barH = 8;
    const barX = cx - barW / 2;
    const barY = topY - 10;
    const progress = Math.min(1, p.totalScore / SCORE_TO_WIN);
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillRect(barX, barY, barW, barH);
    const barColor = progress >= 1 ? '#ffe033' : progress >= 0.6 ? '#88ff88' : '#4499ff';
    ctx.fillStyle = barColor;
    ctx.fillRect(barX, barY, barW * progress, barH);
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.lineWidth = 1;
    ctx.strokeRect(barX, barY, barW, barH);
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.font = '9px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`${p.totalScore} / ${SCORE_TO_WIN}`, cx, barY - 2);

    // Recent fish icons — last up to 5 caught, sized by quality
    const sizes = p.caughtFishSizes ?? [];
    const showCount = Math.min(sizes.length, 5);
    const recentSizes = sizes.slice(-showCount);
    const iconSpacing = 22;
    const startX = cx - (showCount * iconSpacing) / 2 + iconSpacing / 2;
    for (let i = 0; i < showCount; i++) {
        const fishSize = recentSizes[i];
        const ix = startX + i * iconSpacing;
        const scale = fishSize === 'big' ? 0.6 : fishSize === 'medium' ? 0.45 : 0.3;
        const color = fishSize === 'big' ? '#ffe033' : fishSize === 'medium' ? COLOR_FISH : '#a07040';
        ctx.save();
        ctx.translate(ix, topY + 6);
        ctx.scale(scale, scale);
        drawFishShape(ctx, FISH_W, FISH_H, color, 1);
        ctx.restore();
    }

    // Username
    ctx.fillStyle = isSelf ? '#aaddff' : '#cccccc';
    ctx.font = `${isSelf ? 'bold ' : ''}12px monospace`;
    ctx.textAlign = 'center';
    ctx.fillText(p.username + (p.isBot ? ' 🤖' : ''), cx, topY + 22);

    // Stage indicator
    const phases: FiskePhase[] = ['bite', 'reel', 'boat', 'snus'];
    const currentStageIdx = phases.indexOf(p.phase as FiskePhase);

    ctx.font = '10px monospace';
    const labelSpacing = 52;
    const labelStartX = cx - (STAGE_LABELS.length * labelSpacing) / 2 + labelSpacing / 2;
    STAGE_LABELS.forEach((label, i) => {
        const lx = labelStartX + i * labelSpacing;
        const isActive = i === currentStageIdx;
        ctx.fillStyle = isActive ? '#ffe033' : 'rgba(255,255,255,0.3)';
        ctx.textAlign = 'center';
        ctx.fillText(label, lx, topY + 40);
    });
}

// ─── Hit Labels ───────────────────────────────────
function drawHitLabels(
    ctx: CanvasRenderingContext2D,
    now: number,
    labels: HitLabel[],
): void {
    const cx = PANEL_W / 2;
    // Stack multiple active labels (most recent on top)
    for (let i = 0; i < labels.length; i++) {
        const label = labels[i];
        const elapsed = label.duration - (label.expiresAt - now);
        const t = Math.min(1, elapsed / label.duration);
        // Float upward and fade out in last 40%
        const rise = t * 40;
        const alpha = t < 0.6 ? 1 : 1 - (t - 0.6) / 0.4;
        // Scale: pop in fast, then settle
        const scale = t < 0.15 ? 0.5 + (t / 0.15) * 0.7 : 1.2 - t * 0.2;

        ctx.save();
        ctx.globalAlpha = Math.max(0, alpha);
        ctx.translate(cx, METER_CY - 90 - rise);
        ctx.scale(scale, scale);
        ctx.font = 'bold 22px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        // Outline for legibility
        ctx.strokeStyle = 'rgba(0,0,0,0.6)';
        ctx.lineWidth = 3;
        ctx.strokeText(label.text, 0, 0);
        ctx.fillStyle = label.color;
        ctx.fillText(label.text, 0, 0);
        ctx.restore();
    }
    ctx.textBaseline = 'alphabetic';
}
