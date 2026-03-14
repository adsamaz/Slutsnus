import type { SenusCatcherState } from '@slutsnus/shared';

const COLORS = {
    background: '#0d1117',
    fresh: '#39d353',       // green — fresh snus pouch
    spent: '#da3633',       // red — spent snus pouch
    bar: '#e6edf3',         // light gray — player bar
    barOpponent: '#6e7681', // muted — opponent bar
    hudText: '#e6edf3',
    livesActive: '#39d353',
    livesLost: '#30363d',
} as const;

const BAR_HEIGHT = 12;
const BAR_WIDTH_FRACTION = 0.15;  // matches PHYSICS.BAR_WIDTH_FRACTION
const POUCH_RADIUS = 10;

export function drawFrame(
    ctx: CanvasRenderingContext2D,
    canvas: HTMLCanvasElement,
    state: SenusCatcherState,
    selfId: string,
    localBarX: number,  // pixel X — client-authoritative, from mousemove
): void {
    const { width, height } = canvas;

    // Clear
    ctx.fillStyle = COLORS.background;
    ctx.fillRect(0, 0, width, height);

    const self = state.players.find(p => p.userId === selfId);
    const opponent = state.players.find(p => p.userId !== selfId);

    if (!self) return;

    // Draw falling objects (self's independent playfield)
    for (const obj of self.objects) {
        const px = obj.x * width;
        const py = obj.y * height;
        ctx.beginPath();
        ctx.arc(px, py, POUCH_RADIUS, 0, Math.PI * 2);
        ctx.fillStyle = obj.type === 'fresh' ? COLORS.fresh : COLORS.spent;
        ctx.fill();
    }

    // Draw self bar (client-authoritative position)
    const barW = BAR_WIDTH_FRACTION * width;
    ctx.fillStyle = COLORS.bar;
    ctx.fillRect(localBarX - barW / 2, height - BAR_HEIGHT - 4, barW, BAR_HEIGHT);

    // Draw opponent bar (server position — from state)
    if (opponent) {
        const opponentBarX = opponent.barXFraction * width;
        ctx.fillStyle = COLORS.barOpponent;
        ctx.fillRect(opponentBarX - barW / 2, height - BAR_HEIGHT - 4, barW, BAR_HEIGHT);
    }

    // HUD: score
    ctx.font = 'bold 20px monospace';
    ctx.fillStyle = COLORS.hudText;
    ctx.fillText(`Poäng: ${self.score}`, 12, 28);

    // HUD: lives (filled circles)
    for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.arc(width - 24 - i * 28, 20, 10, 0, Math.PI * 2);
        ctx.fillStyle = i < self.lives ? COLORS.livesActive : COLORS.livesLost;
        ctx.fill();
    }

    // HUD: opponent score and lives (top center)
    if (opponent) {
        ctx.font = '14px monospace';
        ctx.fillStyle = COLORS.hudText;
        ctx.fillText(`Motståndare: ${opponent.score}pts, ${opponent.lives}❤`, width / 2 - 80, 20);
    }
}
