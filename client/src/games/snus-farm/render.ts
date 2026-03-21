import type { FarmState } from '@slutsnus/shared';
import {
    CANVAS_W, CANVAS_H,
    PEN_LEFT, PEN_RIGHT, PEN_RADIUS,
    FARMER_RADIUS, CHICKEN_RADIUS,
    COLOR_LEFT, COLOR_RIGHT, COLOR_GRASS, COLOR_FIELD, COLOR_PEN, COLOR_PEN_STROKE,
} from './constants';

function farmerColor(side: 'left' | 'right'): string {
    return side === 'left' ? COLOR_LEFT : COLOR_RIGHT;
}

export function drawGame(ctx: CanvasRenderingContext2D, state: FarmState, myUserId: string): void {
    // ── Background ───────────────────────────────────────────────────────────
    ctx.fillStyle = COLOR_GRASS;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    // ── Field ────────────────────────────────────────────────────────────────
    ctx.fillStyle = COLOR_FIELD;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    // ── Pen zones ────────────────────────────────────────────────────────────
    // Left pen
    const leftPlayer = state.players.find(p => p.side === 'left');
    const rightPlayer = state.players.find(p => p.side === 'right');
    const myPlayer = state.players.find(p => p.userId === myUserId);

    drawPen(ctx, 'left', leftPlayer?.score ?? 0, myPlayer?.side === 'left');
    drawPen(ctx, 'right', rightPlayer?.score ?? 0, myPlayer?.side === 'right');

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

function drawPen(
    ctx: CanvasRenderingContext2D,
    side: 'left' | 'right',
    score: number,
    isMyPen: boolean,
): void {
    const pen = side === 'left' ? PEN_LEFT : PEN_RIGHT;
    const color = side === 'left' ? COLOR_LEFT : COLOR_RIGHT;
    const outerR = PEN_RADIUS + 10;

    // Pen background circle
    ctx.beginPath();
    ctx.arc(pen.x, pen.y, outerR, 0, Math.PI * 2);
    ctx.fillStyle = COLOR_PEN;
    ctx.fill();
    ctx.strokeStyle = isMyPen ? color : COLOR_PEN_STROKE;
    ctx.lineWidth = isMyPen ? 3 : 1.5;
    ctx.stroke();

    // Capture zone inner circle
    ctx.beginPath();
    ctx.arc(pen.x, pen.y, PEN_RADIUS, 0, Math.PI * 2);
    ctx.fillStyle = isMyPen ? `${color}33` : 'rgba(255,255,255,0.1)';
    ctx.fill();
    ctx.strokeStyle = isMyPen ? color : 'rgba(255,255,255,0.3)';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 4]);
    ctx.stroke();
    ctx.setLineDash([]);

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
    const myPlayer = state.players.find(p => p.userId === myUserId);

    const hudY = 14;
    const hudH = 36;
    const hudW = 200;
    const hudX = (CANVAS_W - hudW) / 2;

    // HUD background
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    roundRect(ctx, hudX, hudY - 6, hudW, hudH, 8);
    ctx.fill();

    ctx.textBaseline = 'middle';
    const midY = hudY + hudH / 2 - 6;

    // Left score
    ctx.font = 'bold 18px sans-serif';
    ctx.fillStyle = leftPlayer?.userId === myUserId ? COLOR_LEFT : 'rgba(74,158,255,0.8)';
    ctx.textAlign = 'left';
    ctx.fillText(`${leftPlayer?.score ?? 0}`, hudX + 12, midY);

    // Right score
    ctx.fillStyle = rightPlayer?.userId === myUserId ? COLOR_RIGHT : 'rgba(255,74,74,0.8)';
    ctx.textAlign = 'right';
    ctx.fillText(`${rightPlayer?.score ?? 0}`, hudX + hudW - 12, midY);

    // "First to 5" subtext
    ctx.font = '10px sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.textAlign = 'center';
    ctx.fillText('first to 5 wins', CANVAS_W / 2, midY + 14);
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
