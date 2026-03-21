import type { FarmState } from '@slutsnus/shared';
import {
    CANVAS_W, CANVAS_H,
    PEN_LEFT, PEN_RIGHT, PEN_RADIUS,
    FARMER_RADIUS,
    COLOR_LEFT, COLOR_RIGHT, COLOR_PEN, COLOR_PEN_STROKE,
} from './constants';
import freshSnusSrc from '../../assets/freshsnus.svg';

const snusImg = new Image();
snusImg.src = freshSnusSrc;

// ── Pre-rendered grass background ────────────────────────────────────────────
const grassCanvas = document.createElement('canvas');
grassCanvas.width = CANVAS_W;
grassCanvas.height = CANVAS_H;
(function buildGrass() {
    const gc = grassCanvas.getContext('2d')!;

    // Base fill — a mid-grass green
    gc.fillStyle = '#4a9a30';
    gc.fillRect(0, 0, CANVAS_W, CANVAS_H);

    // Mow-stripe pattern: alternating slightly lighter/darker horizontal bands
    const stripeH = 40;
    for (let y = 0; y < CANVAS_H; y += stripeH) {
        gc.fillStyle = (Math.floor(y / stripeH) % 2 === 0) ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)';
        gc.fillRect(0, y, CANVAS_W, stripeH);
    }

    // Individual grass blades — short random strokes
    const rng = mulberry32(42);
    const bladeColors = ['#3d8a22', '#5cb035', '#3a7520', '#62b838', '#2e6b18'];
    gc.lineWidth = 1.5;
    for (let i = 0; i < 1800; i++) {
        const x = rng() * CANVAS_W;
        const y = rng() * CANVAS_H;
        const h = 6 + rng() * 8;
        const lean = (rng() - 0.5) * 6;
        gc.strokeStyle = bladeColors[Math.floor(rng() * bladeColors.length)];
        gc.globalAlpha = 0.5 + rng() * 0.5;
        gc.beginPath();
        gc.moveTo(x, y);
        gc.lineTo(x + lean, y - h);
        gc.stroke();
    }
    gc.globalAlpha = 1;

    // Subtle dirt patches
    for (let i = 0; i < 18; i++) {
        const x = rng() * CANVAS_W;
        const y = rng() * CANVAS_H;
        const r = 8 + rng() * 18;
        gc.beginPath();
        gc.ellipse(x, y, r, r * 0.55, rng() * Math.PI, 0, Math.PI * 2);
        gc.fillStyle = `rgba(120,80,30,${0.06 + rng() * 0.08})`;
        gc.fill();
    }
})();

function mulberry32(seed: number) {
    return function () {
        seed |= 0; seed = seed + 0x6D2B79F5 | 0;
        let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
        t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
}

function farmerColor(side: 'left' | 'right'): string {
    return side === 'left' ? COLOR_LEFT : COLOR_RIGHT;
}

export function drawGame(ctx: CanvasRenderingContext2D, state: FarmState, myUserId: string): void {
    // ── Background ───────────────────────────────────────────────────────────
    ctx.drawImage(grassCanvas, 0, 0);

    // ── Pen zones ────────────────────────────────────────────────────────────
    // Left pen
    const leftPlayer = state.players.find(p => p.side === 'left');
    const rightPlayer = state.players.find(p => p.side === 'right');
    const myPlayer = state.players.find(p => p.userId === myUserId);

    drawPen(ctx, 'left', leftPlayer?.score ?? 0, myPlayer?.side === 'left');
    drawPen(ctx, 'right', rightPlayer?.score ?? 0, myPlayer?.side === 'right');

    // ── Snus powerup ─────────────────────────────────────────────────────────
    if (state.snus) {
        ctx.save();
        const s = state.snus;
        const pulse = 0.6 + 0.4 * Math.sin(Date.now() / 200);
        ctx.beginPath();
        ctx.arc(s.x, s.y, 20, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 220, 50, ${pulse * 0.35})`;
        ctx.fill();
        const size = 32;
        ctx.globalAlpha = 1;
        ctx.drawImage(snusImg, s.x - size / 2, s.y - size / 2, size, size);
        ctx.restore();
    }

    // ── Chickens ─────────────────────────────────────────────────────────────
    ctx.font = '22px serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const chicken of state.chickens) {
        ctx.fillText('🐔', chicken.x, chicken.y);
    }

    // ── Farmers ──────────────────────────────────────────────────────────────
    for (const player of state.players) {
        const color = farmerColor(player.side);
        const isMe = player.userId === myUserId;

        // Shadow
        ctx.beginPath();
        ctx.arc(player.x + 2, player.y + 3, FARMER_RADIUS, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0,0,0,0.25)';
        ctx.fill();

        // Body circle
        ctx.beginPath();
        ctx.arc(player.x, player.y, FARMER_RADIUS, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
        ctx.strokeStyle = isMe ? '#fff' : 'rgba(255,255,255,0.5)';
        ctx.lineWidth = isMe ? 2.5 : 1.5;
        ctx.stroke();

        // Hat (simple trapezoid above the circle)
        ctx.fillStyle = '#5a3a10';
        ctx.beginPath();
        ctx.rect(player.x - 8, player.y - FARMER_RADIUS - 10, 16, 7);
        ctx.fill();
        ctx.beginPath();
        ctx.rect(player.x - 11, player.y - FARMER_RADIUS - 5, 22, 3);
        ctx.fill();

        // Pitchfork (held to the right side of the body)
        drawPitchfork(ctx, player.x, player.y, FARMER_RADIUS);

        // Speed boost glow
        if (player.speedBoostTicks > 0) {
            ctx.beginPath();
            ctx.arc(player.x, player.y, FARMER_RADIUS + 5, 0, Math.PI * 2);
            ctx.strokeStyle = '#ffe030';
            ctx.lineWidth = 3;
            ctx.stroke();
            ctx.font = '12px serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'bottom';
            ctx.fillText('⚡', player.x, player.y - FARMER_RADIUS - 12);
        }

        // Username label
        ctx.fillStyle = isMe ? '#fff' : 'rgba(255,255,255,0.75)';
        ctx.font = isMe ? 'bold 11px sans-serif' : '10px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText(player.username, player.x, player.y + FARMER_RADIUS + 3);
    }

    // ── HUD ──────────────────────────────────────────────────────────────────
    drawHud(ctx, state, myUserId);
}

function drawPitchfork(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number): void {
    // Pitchfork extends diagonally up-right from the farmer's body edge
    const angle = -Math.PI / 4; // 45° up-right
    const startX = cx + Math.cos(angle) * (r - 2);
    const startY = cy + Math.sin(angle) * (r - 2);
    const handleLen = 22;
    const endX = startX + Math.cos(angle) * handleLen;
    const endY = startY + Math.sin(angle) * handleLen;

    ctx.save();

    // Handle
    ctx.strokeStyle = '#7a4b10';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.lineTo(endX, endY);
    ctx.stroke();

    // Three tines at the top, perpendicular to handle
    const tineLen = 7;
    const tineSpacing = 3.5;
    const perpAngle = angle - Math.PI / 2;
    const tineOffsets = [-tineSpacing, 0, tineSpacing];
    ctx.strokeStyle = '#aaa';
    ctx.lineWidth = 1.5;
    for (const offset of tineOffsets) {
        const tx = endX + Math.cos(perpAngle) * offset;
        const ty = endY + Math.sin(perpAngle) * offset;
        ctx.beginPath();
        ctx.moveTo(tx, ty);
        ctx.lineTo(tx + Math.cos(angle) * tineLen, ty + Math.sin(angle) * tineLen);
        ctx.stroke();
    }

    // Crossbar (collar where tines meet handle)
    const barW = tineSpacing * 2 + 3;
    ctx.strokeStyle = '#7a4b10';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(endX + Math.cos(perpAngle) * -barW, endY + Math.sin(perpAngle) * -barW);
    ctx.lineTo(endX + Math.cos(perpAngle) * barW, endY + Math.sin(perpAngle) * barW);
    ctx.stroke();

    ctx.restore();
}

function drawPen(
    ctx: CanvasRenderingContext2D,
    side: 'left' | 'right',
    score: number,
    isMyPen: boolean,
): void {
    const pen = side === 'left' ? PEN_LEFT : PEN_RIGHT;
    const color = side === 'left' ? COLOR_LEFT : COLOR_RIGHT;
    const outerR = PEN_RADIUS + 10;

    // Pen dirt floor
    ctx.beginPath();
    ctx.arc(pen.x, pen.y, outerR, 0, Math.PI * 2);
    ctx.fillStyle = COLOR_PEN;
    ctx.fill();

    // Capture zone inner circle
    ctx.beginPath();
    ctx.arc(pen.x, pen.y, PEN_RADIUS, 0, Math.PI * 2);
    ctx.fillStyle = isMyPen ? `${color}22` : 'rgba(255,255,255,0.07)';
    ctx.fill();

    // Fence posts + rails around the outer circle
    const fenceR = outerR + 6;
    const postCount = 14;
    const postW = 5;
    const postH = 12;
    const railColor = '#8b5e1a';
    const postColor = '#6b3f0e';

    // Two horizontal rails (drawn as arcs)
    for (const railOffset of [-3, 3]) {
        ctx.beginPath();
        ctx.arc(pen.x, pen.y, fenceR + railOffset, 0, Math.PI * 2);
        ctx.strokeStyle = railColor;
        ctx.lineWidth = 2.5;
        ctx.setLineDash([]);
        ctx.stroke();
    }

    // Posts on top of rails
    for (let i = 0; i < postCount; i++) {
        const angle = (i / postCount) * Math.PI * 2;
        const px = pen.x + Math.cos(angle) * fenceR;
        const py = pen.y + Math.sin(angle) * fenceR;
        ctx.save();
        ctx.translate(px, py);
        ctx.rotate(angle);
        ctx.fillStyle = postColor;
        ctx.fillRect(-postW / 2, -postH / 2, postW, postH);
        // Post cap highlight
        ctx.fillStyle = 'rgba(255,255,255,0.2)';
        ctx.fillRect(-postW / 2, -postH / 2, postW, 2);
        ctx.restore();
    }

    // Pen entry gap highlight (small opening on the inner side)
    const gapAngle = side === 'left' ? 0 : Math.PI; // gap faces center of field
    ctx.beginPath();
    ctx.arc(pen.x, pen.y, fenceR, gapAngle - 0.22, gapAngle + 0.22);
    ctx.strokeStyle = isMyPen ? color : 'rgba(255,255,255,0.4)';
    ctx.lineWidth = 5;
    ctx.stroke();

    // Owner color ring
    ctx.beginPath();
    ctx.arc(pen.x, pen.y, outerR, 0, Math.PI * 2);
    ctx.strokeStyle = isMyPen ? color : COLOR_PEN_STROKE;
    ctx.lineWidth = isMyPen ? 2.5 : 1.5;
    ctx.stroke();

    // Chicken count inside pen
    ctx.font = 'bold 16px sans-serif';
    ctx.fillStyle = isMyPen ? color : '#8b6914';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${score} 🐔`, pen.x, pen.y);
}

function drawHud(ctx: CanvasRenderingContext2D, state: FarmState, myUserId: string): void {
    const leftPlayer = state.players.find(p => p.side === 'left');
    const rightPlayer = state.players.find(p => p.side === 'right');

    const hudW = 200;
    const hudX = (CANVAS_W - hudW) / 2;
    // Two rows: score (18px) + gap (4px) + subtext (9px) = 31px content, 8px padding each side
    const hudH = 47;
    const hudTop = 8;

    // HUD background
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    roundRect(ctx, hudX, hudTop, hudW, hudH, 8);
    ctx.fill();

    ctx.textBaseline = 'middle';
    const boxCenterY = hudTop + hudH / 2;
    const scoreY = boxCenterY - 8;
    const subtextY = boxCenterY + 9;

    // Left score
    ctx.font = 'bold 18px sans-serif';
    ctx.fillStyle = leftPlayer?.userId === myUserId ? COLOR_LEFT : 'rgba(74,158,255,0.8)';
    ctx.textAlign = 'left';
    ctx.fillText(`${leftPlayer?.score ?? 0}`, hudX + 12, scoreY);

    // Right score
    ctx.fillStyle = rightPlayer?.userId === myUserId ? COLOR_RIGHT : 'rgba(255,74,74,0.8)';
    ctx.textAlign = 'right';
    ctx.fillText(`${rightPlayer?.score ?? 0}`, hudX + hudW - 12, scoreY);

    // "First to 5" subtext
    ctx.font = 'bold 9px monospace';
    ctx.fillStyle = 'rgba(255,220,50,0.8)';
    ctx.textAlign = 'center';
    ctx.fillText('★ FIRST TO 5 WINS ★', CANVAS_W / 2, subtextY);
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.arcTo(x + w, y, x + w, y + r, r);
    ctx.lineTo(x + w, y + h - r);
    ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
    ctx.lineTo(x + r, y + h);
    ctx.arcTo(x, y + h, x, y + h - r, r);
    ctx.lineTo(x, y + r);
    ctx.arcTo(x, y, x + r, y, r);
    ctx.closePath();
}

export function drawEndScreen(ctx: CanvasRenderingContext2D, state: FarmState, myUserId: string): void {
    // Darken background
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    if (!state.results) return;

    const myResult = state.results.find(r => r.userId === myUserId);
    const won = myResult?.rank === 1;

    // Main result text
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 52px sans-serif';
    ctx.fillStyle = won ? '#ffd700' : '#aaa';
    ctx.fillText(won ? '🏆 You Win!' : '😢 You Lose', CANVAS_W / 2, CANVAS_H / 2 - 70);

    // Egg flavor text
    ctx.font = 'bold 18px sans-serif';
    ctx.fillStyle = won ? '#ffe066' : '#888';
    ctx.fillText(
        won ? '🥚 Egg champion! Your chickens provide you with infinite eggs!' : '🥚 Your chickens refuse to lay eggs for a loser...',
        CANVAS_W / 2,
        CANVAS_H / 2 - 30,
    );

    // Scores
    const sorted = [...state.results].sort((a, b) => a.rank - b.rank);
    ctx.font = 'bold 22px sans-serif';
    const dotX = CANVAS_W / 2 - 140;
    const textX = dotX + 18;
    const scoreX = CANVAS_W / 2 + 80;
    const scoresStartY = CANVAS_H / 2 + 15;
    sorted.forEach((r, i) => {
        const player = state.players.find(p => p.userId === r.userId);
        const color = player?.side === 'left' ? COLOR_LEFT : COLOR_RIGHT;
        const rowY = scoresStartY + i * 36;
        // Color dot
        ctx.beginPath();
        ctx.arc(dotX, rowY, 7, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
        // Name (left-aligned)
        ctx.fillStyle = r.userId === myUserId ? '#fff' : '#bbb';
        ctx.textAlign = 'left';
        ctx.fillText(`${i + 1}. ${r.username}`, textX, rowY);
        // Score (right-aligned at fixed column)
        ctx.textAlign = 'right';
        ctx.fillText(`${r.score} 🐔`, scoreX, rowY);
    });
}
