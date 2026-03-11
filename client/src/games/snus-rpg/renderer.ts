import type { SnusRpgState } from '@slutsnus/shared';

const TILE = 30;
const CANVAS_W = 750;
const CANVAS_H = 750;

const COLORS = ['#39d353', '#f78166', '#79c0ff', '#ffa657', '#ff7b72', '#d2a8ff', '#56d364'];

const playerColorMap = new Map<string, string>();
let colorIndex = 0;

function getPlayerColor(id: string): string {
    if (!playerColorMap.has(id)) {
        playerColorMap.set(id, COLORS[colorIndex % COLORS.length]);
        colorIndex++;
    }
    return playerColorMap.get(id)!;
}

const MAX_HP = 100;

export function render(ctx: CanvasRenderingContext2D, state: SnusRpgState): void {
    const { map, npcs } = state;
    const players = Object.values(state.players);
    const items = state.items.filter((i) => !i.collected);

    ctx.fillStyle = '#0f0f0f';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    // Draw tiles (map is number[][])
    for (let y = 0; y < map.length; y++) {
        for (let x = 0; x < map[y].length; x++) {
            const tile = map[y][x];
            const px = x * TILE;
            const py = y * TILE;

            if (tile === 1) {
                ctx.fillStyle = '#1a1200';
                ctx.fillRect(px, py, TILE, TILE);
                ctx.strokeStyle = '#2a2000';
                ctx.lineWidth = 0.5;
                ctx.strokeRect(px, py, TILE, TILE);
            } else {
                ctx.fillStyle = '#2a2a2a';
                ctx.fillRect(px, py, TILE, TILE);
            }
        }
    }

    // Draw snus collectibles
    ctx.fillStyle = '#8B4513';
    for (const item of items) {
        const px = item.x * TILE + TILE / 2;
        const py = item.y * TILE + TILE / 2;
        ctx.beginPath();
        ctx.arc(px, py, TILE / 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#d2a679';
        ctx.font = 'bold 7px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('S', px, py);
        ctx.fillStyle = '#8B4513';
    }

    // Draw NPCs
    for (const npc of npcs) {
        if (npc.hp <= 0) continue;
        const px = npc.x * TILE + TILE / 2;
        const py = npc.y * TILE + TILE / 2;

        ctx.fillStyle = '#cc2222';
        ctx.beginPath();
        ctx.arc(px, py, TILE / 2.5, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        const r = TILE / 4;
        ctx.beginPath();
        ctx.moveTo(px - r, py - r);
        ctx.lineTo(px + r, py + r);
        ctx.moveTo(px + r, py - r);
        ctx.lineTo(px - r, py + r);
        ctx.stroke();
    }

    // Draw players
    for (const player of players) {
        if (!player.alive) continue;
        const color = getPlayerColor(player.userId);
        const px = player.x * TILE + TILE / 2;
        const py = player.y * TILE + TILE / 2;

        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.beginPath();
        ctx.ellipse(px, py + TILE / 3, TILE / 2.5, TILE / 6, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(px, py, TILE / 2.2, 0, Math.PI * 2);
        ctx.fill();

        const hasBoost = player.effects.some((e) => e.type === 'nicotine_boost');
        if (hasBoost) {
            ctx.strokeStyle = '#ffd700';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(px, py, TILE / 2.2 + 3, 0, Math.PI * 2);
            ctx.stroke();
        }

        // HP bar
        const barW = TILE - 2;
        const hpRatio = player.hp / MAX_HP;
        ctx.fillStyle = '#333';
        ctx.fillRect(px - barW / 2, py - TILE / 2 - 7, barW, 4);
        ctx.fillStyle = hpRatio > 0.5 ? '#39d353' : hpRatio > 0.25 ? '#ffa657' : '#ff4444';
        ctx.fillRect(px - barW / 2, py - TILE / 2 - 7, barW * hpRatio, 4);

        // Username
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 9px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText(player.username, px, py - TILE / 2 - 9);
    }
}
