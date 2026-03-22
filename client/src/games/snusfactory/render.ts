import type { FactoryState, FactoryStation, FactoryPlayer, SnusFlavorType, FactoryItemType, GameResult } from '@slutsnus/shared';
import {
    CANVAS_W, CANVAS_H, STATION_RECTS, PLAYER_COLORS, PLAYER_RADIUS,
    FLAVOR_COLORS, FLAVOR_LABEL, ORDER_EXPIRY_TICKS,
} from './constants';

// ─── Particle system ──────────────────────────────────────────────────────────

interface Particle {
    x: number; y: number;
    vx: number; vy: number;
    life: number; maxLife: number;
    size: number;
    color: string;
    type: 'spark' | 'smoke' | 'score' | 'steam' | 'leaf';
    text?: string;
    alpha: number;
}

const particles: Particle[] = [];
let frameCount = 0;
let shakeFrames = 0;
let shakeIntensity = 0;
let lastScore = 0;
let scoreFlashFrames = 0;
let scoreFlashColor = '#ffe04a';

export function triggerShake(intensity = 5, frames = 10): void {
    shakeIntensity = intensity;
    shakeFrames = frames;
}

export function triggerScoreFlash(color = '#ffe04a'): void {
    scoreFlashFrames = 20;
    scoreFlashColor = color;
    shakeIntensity = 4;
    shakeFrames = 8;
}

function spawnSparks(x: number, y: number, count: number, color: string): void {
    for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 2 + Math.random() * 6;
        particles.push({
            x, y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed - 1.5,
            life: 22 + Math.random() * 25,
            maxLife: 47,
            size: 3 + Math.random() * 4,
            color,
            type: 'spark',
            alpha: 1,
        });
    }
}

function spawnSmoke(x: number, y: number, color = 'rgba(120,120,120,0.6)'): void {
    particles.push({
        x: x + (Math.random() - 0.5) * 14,
        y,
        vx: (Math.random() - 0.5) * 0.7,
        vy: -0.9 - Math.random() * 1.1,
        life: 50 + Math.random() * 35,
        maxLife: 85,
        size: 9 + Math.random() * 12,
        color,
        type: 'smoke',
        alpha: 0.5,
    });
}

function spawnScoreText(x: number, y: number, text: string, color: string): void {
    particles.push({
        x, y,
        vx: (Math.random() - 0.5) * 1.2,
        vy: -3.5,
        life: 70,
        maxLife: 70,
        size: 26,
        color,
        type: 'score',
        text,
        alpha: 1,
    });
}

function spawnLeafParticle(x: number, y: number): void {
    const angle = -Math.PI / 2 + (Math.random() - 0.5) * 0.8;
    particles.push({
        x, y,
        vx: Math.cos(angle) * (1.5 + Math.random() * 1.5),
        vy: Math.sin(angle) * (1.5 + Math.random() * 1.5),
        life: 36 + Math.random() * 24,
        maxLife: 60,
        size: 7 + Math.random() * 5,
        color: '#4dba4d',
        type: 'leaf',
        alpha: 1,
    });
}

function updateParticles(): void {
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.life--;
        if (p.type === 'smoke') { p.size += 0.2; p.vy *= 0.98; }
        if (p.type === 'spark') { p.vy += 0.22; p.vx *= 0.96; }
        p.alpha = p.life / p.maxLife;
        if (p.life <= 0) particles.splice(i, 1);
    }
}

function drawParticles(ctx: CanvasRenderingContext2D): void {
    for (const p of particles) {
        ctx.save();
        ctx.globalAlpha = p.alpha;
        if (p.type === 'spark') {
            ctx.fillStyle = p.color;
            ctx.shadowColor = p.color;
            ctx.shadowBlur = 8;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size / 2, 0, Math.PI * 2);
            ctx.fill();
        } else if (p.type === 'smoke' || p.type === 'steam') {
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fill();
        } else if (p.type === 'score') {
            ctx.fillStyle = p.color;
            ctx.shadowColor = p.color;
            ctx.shadowBlur = 16;
            ctx.font = `bold ${p.size}px monospace`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(p.text!, p.x, p.y);
        } else if (p.type === 'leaf') {
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.ellipse(p.x, p.y, p.size, p.size * 0.6, frameCount * 0.1 + p.x, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();
    }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
}

function progressBar(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, frac: number, color: string): void {
    // Track
    roundRect(ctx, x, y, w, h, h / 2);
    ctx.fillStyle = '#0a0a12';
    ctx.fill();
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 0.8;
    ctx.stroke();
    // Fill
    if (frac > 0) {
        const fw = w * Math.max(0, Math.min(1, frac));
        roundRect(ctx, x, y, fw, h, h / 2);
        ctx.fillStyle = color;
        ctx.shadowColor = color;
        ctx.shadowBlur = 10;
        ctx.fill();
        ctx.shadowBlur = 0;
    }
}

function flavorFromItem(item: FactoryItemType): SnusFlavorType | null {
    if (item.startsWith('flavor-')) return item.slice(7) as SnusFlavorType;
    if (item.startsWith('ground-')) return item.slice(7) as SnusFlavorType;
    if (item.startsWith('can-')) return item.slice(4) as SnusFlavorType;
    return null;
}

// ─── Item icon drawing ─────────────────────────────────────────────────────────

function drawItemIcon(ctx: CanvasRenderingContext2D, item: FactoryItemType, cx: number, cy: number, scale = 1): void {
    const flavor = flavorFromItem(item);
    const flavorColor = flavor ? FLAVOR_COLORS[flavor] : '#888';
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(scale, scale);

    if (item === 'leaf') {
        ctx.fillStyle = '#2ea82e';
        ctx.shadowColor = '#4dba4d';
        ctx.shadowBlur = 6;
        ctx.beginPath();
        ctx.ellipse(0, 0, 16, 10, -0.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#1a7a1a';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(-13, 0); ctx.lineTo(13, 0);
        ctx.stroke();
        ctx.shadowBlur = 0;
    } else if (item === 'ripe-leaf') {
        ctx.fillStyle = '#5eff5e';
        ctx.shadowColor = '#7eff7e';
        ctx.shadowBlur = 16;
        ctx.beginPath();
        ctx.ellipse(0, 0, 16, 10, -0.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#7eff7e';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(-13, 0); ctx.lineTo(13, 0);
        ctx.stroke();
        ctx.shadowBlur = 0;
    } else if (item.startsWith('flavor-')) {
        ctx.shadowColor = flavorColor;
        ctx.shadowBlur = 12;
        if (flavor === 'mint') {
            // Two mint leaves on a stem
            ctx.strokeStyle = '#1a7a3a';
            ctx.lineWidth = 1.5;
            ctx.lineCap = 'round';
            // Stem
            ctx.beginPath(); ctx.moveTo(0, 12); ctx.lineTo(0, -4); ctx.stroke();
            // Left leaf
            ctx.fillStyle = flavorColor;
            ctx.beginPath();
            ctx.moveTo(0, 4);
            ctx.bezierCurveTo(-12, 0, -14, -10, -2, -12);
            ctx.bezierCurveTo(-1, -4, 0, 0, 0, 4);
            ctx.fill();
            ctx.strokeStyle = 'rgba(0,0,0,0.25)';
            ctx.lineWidth = 0.8;
            ctx.beginPath(); ctx.moveTo(0, 4); ctx.lineTo(-8, -6); ctx.stroke();
            // Right leaf
            ctx.fillStyle = flavorColor;
            ctx.beginPath();
            ctx.moveTo(0, 4);
            ctx.bezierCurveTo(12, 0, 14, -10, 2, -12);
            ctx.bezierCurveTo(1, -4, 0, 0, 0, 4);
            ctx.fill();
            ctx.strokeStyle = 'rgba(0,0,0,0.25)';
            ctx.lineWidth = 0.8;
            ctx.beginPath(); ctx.moveTo(0, 4); ctx.lineTo(8, -6); ctx.stroke();
        } else if (flavor === 'juniper') {
            // Pine/juniper berry cluster
            ctx.fillStyle = '#2d5a27';
            // Branches
            ctx.strokeStyle = '#2d5a27';
            ctx.lineWidth = 2;
            ctx.lineCap = 'round';
            ctx.beginPath(); ctx.moveTo(0, 6); ctx.lineTo(0, -10); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(0, -2); ctx.lineTo(-8, -8); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(0, -2); ctx.lineTo(8, -8); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(0, 2); ctx.lineTo(-9, 2); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(0, 2); ctx.lineTo(9, 2); ctx.stroke();
            // Berries
            const berries = [{ x: -8, y: -8 }, { x: 8, y: -8 }, { x: -9, y: 2 }, { x: 9, y: 2 }, { x: 0, y: -10 }];
            for (const b of berries) {
                ctx.fillStyle = flavorColor;
                ctx.beginPath(); ctx.arc(b.x, b.y, 3.5, 0, Math.PI * 2); ctx.fill();
                ctx.fillStyle = 'rgba(255,255,255,0.3)';
                ctx.beginPath(); ctx.arc(b.x - 1, b.y - 1, 1.2, 0, Math.PI * 2); ctx.fill();
            }
        } else if (flavor === 'licorice') {
            // Candy/licorice spiral coil
            ctx.strokeStyle = flavorColor;
            ctx.lineWidth = 3;
            ctx.lineCap = 'round';
            ctx.beginPath();
            for (let t = 0; t <= Math.PI * 4; t += 0.05) {
                const r = 2 + t * 1.4;
                const px = Math.cos(t) * r;
                const py = Math.sin(t) * r;
                if (t === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
            }
            ctx.stroke();
            // Center dot
            ctx.fillStyle = flavorColor;
            ctx.beginPath(); ctx.arc(0, 0, 2.5, 0, Math.PI * 2); ctx.fill();
        } else {
            // Original — tobacco leaf shape
            ctx.fillStyle = flavorColor;
            ctx.strokeStyle = flavorColor;
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.ellipse(0, -2, 9, 13, 0.1, 0, Math.PI * 2);
            ctx.fill();
            // Veins
            ctx.strokeStyle = 'rgba(0,0,0,0.35)';
            ctx.lineWidth = 1;
            ctx.beginPath(); ctx.moveTo(0, -14); ctx.lineTo(0, 10); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(0, -6); ctx.lineTo(-6, 2); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(0, -6); ctx.lineTo(6, 2); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-5, 7); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(5, 7); ctx.stroke();
        }
        ctx.shadowBlur = 0;
    } else if (item.startsWith('ground-')) {
        ctx.shadowColor = flavorColor;
        ctx.shadowBlur = 10;
        const clumps = [
            { ox: 0, oy: 0, rx: 10, ry: 7, rot: 0.2 },
            { ox: -5, oy: 4, rx: 7, ry: 5, rot: 1.1 },
            { ox: 5, oy: -4, rx: 8, ry: 5, rot: -0.5 },
            { ox: -4, oy: -5, rx: 5, ry: 4, rot: 0.8 },
            { ox: 7, oy: 4, rx: 5, ry: 4, rot: -1.2 },
        ];
        for (const c of clumps) {
            ctx.fillStyle = '#3d2000';
            ctx.beginPath();
            ctx.ellipse(c.ox, c.oy, c.rx, c.ry, c.rot, 0, Math.PI * 2);
            ctx.fill();
        }
        const specks = [
            { ox: 1, oy: -3, r: 3.5 },
            { ox: -4, oy: 3, r: 3 },
            { ox: 5, oy: 1, r: 2.5 },
            { ox: -1, oy: 5, r: 3 },
            { ox: 4, oy: -5, r: 2.5 },
        ];
        ctx.fillStyle = flavorColor;
        ctx.globalAlpha = 0.7;
        for (const s of specks) {
            ctx.beginPath();
            ctx.arc(s.ox, s.oy, s.r, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;
        ctx.shadowBlur = 0;
    } else if (item.startsWith('can-')) {
        // Round snus tin — top-down view
        const r = 15;
        ctx.shadowColor = flavorColor;
        ctx.shadowBlur = 14;
        // Tin body
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.fillStyle = '#e8e8e8';
        ctx.fill();
        // Flavor color ring
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.strokeStyle = flavorColor;
        ctx.lineWidth = 4;
        ctx.stroke();
        ctx.shadowBlur = 0;
        // Inner lid rim
        ctx.beginPath();
        ctx.arc(0, 0, r - 5, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(0,0,0,0.15)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        // Shine highlight
        ctx.beginPath();
        ctx.arc(-4, -4, 5, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255,255,255,0.35)';
        ctx.fill();
        // Brand text
        ctx.fillStyle = '#333';
        ctx.font = 'bold 6px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('SNUS', 0, 2);
    }
    ctx.restore();
}

// ─── Conveyor belt ─────────────────────────────────────────────────────────────

function drawConveyorBelt(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number): void {
    const beltW = 28;
    const dx = x2 - x1, dy = y2 - y1;
    const len = Math.sqrt(dx * dx + dy * dy);
    const nx = dy / len, ny = -dx / len;

    ctx.save();
    // Belt body
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = beltW;
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    ctx.strokeStyle = '#2a2a2a';
    ctx.lineWidth = beltW - 6;
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();

    // Animated segments
    const segSpacing = 28;
    const offset = (frameCount * 1.8) % segSpacing;
    ctx.strokeStyle = '#404040';
    ctx.lineWidth = 2.5;
    for (let d = offset; d < len; d += segSpacing) {
        const t = d / len;
        const mx = x1 + dx * t, my = y1 + dy * t;
        ctx.beginPath();
        ctx.moveTo(mx - nx * (beltW / 2 - 3), my - ny * (beltW / 2 - 3));
        ctx.lineTo(mx + nx * (beltW / 2 - 3), my + ny * (beltW / 2 - 3));
        ctx.stroke();
    }

    // Edge highlights
    ctx.strokeStyle = '#555';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x1 + nx * (beltW / 2), y1 + ny * (beltW / 2));
    ctx.lineTo(x2 + nx * (beltW / 2), y2 + ny * (beltW / 2));
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x1 - nx * (beltW / 2), y1 - ny * (beltW / 2));
    ctx.lineTo(x2 - nx * (beltW / 2), y2 - ny * (beltW / 2));
    ctx.stroke();

    ctx.restore();
}

// ─── Pipe ──────────────────────────────────────────────────────────────────────

function drawPipe(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, color = '#666'): void {
    ctx.save();
    ctx.strokeStyle = '#222';
    ctx.lineWidth = 16;
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 13;
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    ctx.strokeStyle = color;
    ctx.lineWidth = 9;
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    // Highlight
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    ctx.restore();
}

// ─── Gear drawing ─────────────────────────────────────────────────────────────

function drawGear(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, teeth: number, angle: number, color: string): void {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(angle);
    ctx.strokeStyle = color;
    ctx.fillStyle = color + '33';
    ctx.lineWidth = 2.5;
    const toothDepth = r * 0.28;
    ctx.beginPath();
    for (let i = 0; i < teeth; i++) {
        const a1 = (i / teeth) * Math.PI * 2;
        const a2 = ((i + 0.4) / teeth) * Math.PI * 2;
        const a3 = ((i + 0.6) / teeth) * Math.PI * 2;
        const a4 = ((i + 1) / teeth) * Math.PI * 2;
        if (i === 0) ctx.moveTo(Math.cos(a1) * r, Math.sin(a1) * r);
        else ctx.lineTo(Math.cos(a1) * r, Math.sin(a1) * r);
        ctx.lineTo(Math.cos(a2) * (r + toothDepth), Math.sin(a2) * (r + toothDepth));
        ctx.lineTo(Math.cos(a3) * (r + toothDepth), Math.sin(a3) * (r + toothDepth));
        ctx.lineTo(Math.cos(a4) * r, Math.sin(a4) * r);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // Hub
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.35, 0, Math.PI * 2);
    ctx.fillStyle = color + '88';
    ctx.fill();
    ctx.stroke();
    ctx.restore();
}

// ─── Station drawing ───────────────────────────────────────────────────────────

function drawStation(ctx: CanvasRenderingContext2D, station: FactoryStation, hovered = false, canInteract = false): void {
    const rect = STATION_RECTS[station.id];
    if (!rect) return;
    const { x, y, w, h, label } = rect;

    const isActive = station.state > 0 || station.hasItem || station.leafLoaded || !!station.flavorLoaded;
    let glowColor: string | null = null;
    let fillColor = '#1c1c28';
    let borderColor = '#3a3a50';

    if (station.id === 'planter-l' || station.id === 'planter-r') {
        fillColor = '#1e1208';
        borderColor = '#5a3a18';
        glowColor = '#5a3a18';
    } else if (station.id.startsWith('patch-')) {
        if (station.state === -1) {
            fillColor = '#0a2a06';
            borderColor = '#3dba3d';
            glowColor = '#4dba4d';
        } else {
            fillColor = '#0e1a08';
            borderColor = '#2a4a18';
        }
    } else if (station.id.startsWith('flavor-shelf-')) {
        const flavor = station.id.split('-')[2] as SnusFlavorType;
        const base = FLAVOR_COLORS[flavor];
        fillColor = base + '18';
        borderColor = base + '88';
        glowColor = base;
    } else if (station.id === 'grinder') {
        fillColor = '#12121e';
        borderColor = station.state > 0 ? '#ff9a3c' : '#2e2e4a';
        if (station.state > 0) glowColor = '#ff6600';
    } else if (station.id === 'packager') {
        fillColor = '#0a121e';
        borderColor = station.state > 0 ? '#3a9fff' : '#1a2a3a';
        if (station.state > 0) glowColor = '#3a9fff';
    } else if (station.id === 'storage-l-1' || station.id === 'storage-l-2' || station.id === 'storage-r-1' || station.id === 'storage-r-2') {
        fillColor = '#120e04';
        borderColor = station.hasItem ? '#c8922a' : '#5a4010';
        if (station.hasItem) glowColor = '#c8922a';
    }

    // Glow effect
    if (glowColor) {
        ctx.save();
        ctx.shadowColor = glowColor;
        ctx.shadowBlur = 28;
        roundRect(ctx, x, y, w, h, 12);
        ctx.strokeStyle = glowColor + '66';
        ctx.lineWidth = 3;
        ctx.stroke();
        ctx.restore();
    }

    // Hover / interact highlight
    if (canInteract) {
        ctx.save();
        ctx.shadowColor = '#ffffff';
        ctx.shadowBlur = 32 + 14 * Math.sin(frameCount * 0.15);
        roundRect(ctx, x - 3, y - 3, w + 6, h + 6, 15);
        ctx.strokeStyle = `rgba(255,255,255,${0.55 + 0.3 * Math.sin(frameCount * 0.15)})`;
        ctx.lineWidth = 3;
        ctx.stroke();
        ctx.restore();
    } else if (hovered) {
        ctx.save();
        ctx.shadowColor = '#aaaaff';
        ctx.shadowBlur = 18;
        roundRect(ctx, x - 2, y - 2, w + 4, h + 4, 14);
        ctx.strokeStyle = 'rgba(180,180,255,0.45)';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.restore();
    }

    // Station body
    roundRect(ctx, x, y, w, h, 12);
    ctx.fillStyle = fillColor;
    ctx.fill();

    // Inner highlight
    roundRect(ctx, x + 3, y + 3, w - 6, h / 3, 9);
    ctx.fillStyle = 'rgba(255,255,255,0.04)';
    ctx.fill();

    // Border
    roundRect(ctx, x, y, w, h, 12);
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Corner rivets — bigger
    const rivets = [[x + 9, y + 9], [x + w - 9, y + 9], [x + 9, y + h - 9], [x + w - 9, y + h - 9]];
    for (const [rx, ry] of rivets) {
        ctx.beginPath();
        ctx.arc(rx, ry, 4, 0, Math.PI * 2);
        ctx.fillStyle = '#222';
        ctx.fill();
        ctx.strokeStyle = '#555';
        ctx.lineWidth = 1;
        ctx.stroke();
    }

    // ── Order slots ──────────────────────────────────────────────────────────
    if (station.id.startsWith('order-')) {
        if (station.state > 0 && station.itemFlavor) {
            const frac = station.state / ORDER_EXPIRY_TICKS;
            const urgent = frac < 0.33;
            const flavorCol = FLAVOR_COLORS[station.itemFlavor];

            const pulse = urgent ? 0.6 + 0.4 * Math.sin(frameCount * 0.25) : 1;
            ctx.save();
            ctx.shadowColor = urgent ? '#ff4444' : flavorCol;
            ctx.shadowBlur = 24 * pulse;
            roundRect(ctx, x, y, w, h, 12);
            ctx.strokeStyle = (urgent ? '#ff4444' : flavorCol) + Math.floor(200 * pulse).toString(16).padStart(2, '0');
            ctx.lineWidth = 3;
            ctx.stroke();
            ctx.restore();

            // Countdown arc — larger
            const arcCx = x + w - 32, arcCy = y + 32, arcR = 22;
            ctx.fillStyle = '#0a0a14';
            ctx.beginPath(); ctx.arc(arcCx, arcCy, arcR, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = urgent ? '#ff4444' : flavorCol;
            ctx.shadowColor = urgent ? '#ff4444' : flavorCol;
            ctx.shadowBlur = 10;
            ctx.beginPath();
            ctx.moveTo(arcCx, arcCy);
            ctx.arc(arcCx, arcCy, arcR, -Math.PI / 2, -Math.PI / 2 + frac * Math.PI * 2);
            ctx.closePath(); ctx.fill();
            ctx.shadowBlur = 0;
            ctx.strokeStyle = '#333';
            ctx.lineWidth = 1.5;
            ctx.beginPath(); ctx.arc(arcCx, arcCy, arcR, 0, Math.PI * 2); ctx.stroke();

            // Can icon — bigger
            drawItemIcon(ctx, `can-${station.itemFlavor}` as FactoryItemType, x + 40, y + h / 2 + 4, 1.5);

            // Flavor label
            ctx.fillStyle = flavorCol;
            ctx.shadowColor = flavorCol;
            ctx.shadowBlur = 8;
            ctx.font = 'bold 15px monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(FLAVOR_LABEL[station.itemFlavor], x + w / 2 + 14, y + h / 2 + 4);
            ctx.shadowBlur = 0;
        } else {
            const pulse = 0.5 + 0.5 * Math.sin(frameCount * 0.06);
            ctx.fillStyle = `rgba(100,100,130,${0.4 + 0.3 * pulse})`;
            ctx.font = 'bold 42px monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('?', x + w / 2, y + h / 2);
        }
        return;
    }

    // ── Label ────────────────────────────────────────────────────────────────
    if (station.id !== 'packager') {
        ctx.fillStyle = '#606080';
        ctx.font = '12px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText(label, x + w / 2, y + 10);
    }

    // ── Storage ──────────────────────────────────────────────────────────────
    if (station.id === 'storage-l-1' || station.id === 'storage-l-2' || station.id === 'storage-r-1' || station.id === 'storage-r-2') {
        const cx = x + w / 2;
        const cy = y + h / 2 + 8;

        // Draw a simple crate / box
        ctx.fillStyle = '#1a1208';
        roundRect(ctx, x + 10, y + 26, w - 20, h - 36, 6);
        ctx.fill();
        ctx.strokeStyle = '#7a5a20';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Cross-brace lines on the crate
        ctx.strokeStyle = '#5a4010';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(x + 10, y + 26); ctx.lineTo(x + w - 10, y + h - 10);
        ctx.moveTo(x + w - 10, y + 26); ctx.lineTo(x + 10, y + h - 10);
        ctx.stroke();

        if (station.hasItem && station.flavorLoaded) {
            // Show the stored item icon
            drawItemIcon(ctx, station.flavorLoaded as unknown as FactoryItemType, cx, cy, 1.1);
        } else {
            // Empty: draw a faint "..." indicator
            ctx.fillStyle = 'rgba(120,100,60,0.4)';
            ctx.font = 'bold 20px monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('···', cx, cy);
        }
        return;
    }

    // ── Planter ──────────────────────────────────────────────────────────────
    if (station.id === 'planter-l' || station.id === 'planter-r') {
        ctx.fillStyle = '#2a1a08';
        roundRect(ctx, x + 12, y + 30, w - 24, h - 48, 6);
        ctx.fill();
        ctx.strokeStyle = '#5a3810';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        for (let i = 0; i < 4; i++) {
            const sy = y + 40 + i * 12;
            const sx = x + 20, ex = x + w - 20;
            ctx.strokeStyle = i % 2 === 0 ? '#3a2408' : '#4a3010';
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.moveTo(sx, sy);
            ctx.lineTo(ex, sy);
            ctx.stroke();
        }

        if (station.hasItem) {
            const sproutOffsets = [-34, -14, 6, 26];
            for (const ox of sproutOffsets) {
                const cx2 = x + w / 2 + ox;
                const baseY = y + h - 22;
                ctx.strokeStyle = '#2ea82e';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(cx2, baseY);
                ctx.lineTo(cx2, baseY - 16);
                ctx.stroke();
                ctx.fillStyle = '#2ea82e';
                ctx.shadowColor = '#4dba4d';
                ctx.shadowBlur = 4;
                ctx.beginPath();
                ctx.ellipse(cx2 - 5, baseY - 20, 7, 4, -0.5, 0, Math.PI * 2);
                ctx.fill();
                ctx.beginPath();
                ctx.ellipse(cx2 + 5, baseY - 20, 7, 4, 0.5, 0, Math.PI * 2);
                ctx.fill();
                ctx.shadowBlur = 0;
            }
            if (Math.random() < 0.04) spawnLeafParticle(x + w / 2, y + h / 2);
        } else {
            const frac = 1 - station.state / 400;
            const nubs = [-34, -14, 6, 26];
            for (const ox of nubs) {
                const cx2 = x + w / 2 + ox;
                const baseY = y + h - 22;
                const nubH = 6 * frac;
                ctx.strokeStyle = '#4a8a2a';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(cx2, baseY);
                ctx.lineTo(cx2, baseY - nubH);
                ctx.stroke();
            }
            progressBar(ctx, x + 14, y + h - 18, w - 28, 8, frac, '#6dc96d');
        }
    }

    // ── Patch ────────────────────────────────────────────────────────────────
    if (station.id.startsWith('patch-')) {
        ctx.fillStyle = '#1a1006';
        roundRect(ctx, x + 8, y + 28, w - 16, h - 44, 6);
        ctx.fill();
        ctx.strokeStyle = '#3a2808';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        for (let i = 0; i < 3; i++) {
            ctx.strokeStyle = '#2a1a06';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(x + 14, y + 38 + i * 14);
            ctx.lineTo(x + w - 14, y + 38 + i * 14);
            ctx.stroke();
        }

        if (station.state === -1) {
            const leafPositions = [
                { ox: -26, oy: 0, rot: -0.5 },
                { ox: 0, oy: -5, rot: 0.1 },
                { ox: 26, oy: 0, rot: 0.5 },
            ];
            for (const lp of leafPositions) {
                const lx = x + w / 2 + lp.ox;
                const ly = y + h / 2 + lp.oy;
                ctx.save();
                ctx.translate(lx, ly);
                ctx.rotate(lp.rot);
                ctx.fillStyle = '#5eff5e';
                ctx.shadowColor = '#7eff7e';
                ctx.shadowBlur = 14;
                ctx.beginPath();
                ctx.ellipse(0, 0, 19, 10, 0, 0, Math.PI * 2);
                ctx.fill();
                ctx.strokeStyle = '#7eff7e';
                ctx.lineWidth = 1.5;
                ctx.beginPath();
                ctx.moveTo(-16, 0); ctx.lineTo(16, 0);
                ctx.stroke();
                ctx.shadowBlur = 0;
                ctx.restore();
            }
            const r = (frameCount * 0.8) % 40;
            ctx.strokeStyle = `rgba(126,255,126,${0.5 - r / 80})`;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(x + w / 2, y + h / 2, 28 + r, 0, Math.PI * 2);
            ctx.stroke();
        } else if (station.state > 0) {
            const frac = 1 - station.state / 300;
            const plantDefs = [
                { ox: -26, wavePhase: 0 },
                { ox: 0, wavePhase: 1.1 },
                { ox: 26, wavePhase: 2.2 },
            ];
            for (const pd of plantDefs) {
                const px = x + w / 2 + pd.ox;
                const baseY = y + h - 20;
                const maxStemH = 40;
                const stemH = maxStemH * frac;
                const sway = frac > 0.4 ? Math.sin(frameCount * 0.05 + pd.wavePhase) * 3 * frac : 0;
                const tipX = px + sway;
                const tipY = baseY - stemH;

                ctx.strokeStyle = `rgb(${Math.round(20 + 26 * frac)}, ${Math.round(120 + 48 * frac)}, ${Math.round(20 + 26 * frac)})`;
                ctx.lineWidth = 1.5 + frac * 2;
                ctx.beginPath();
                if (stemH > 8) {
                    ctx.moveTo(px, baseY);
                    ctx.quadraticCurveTo(px + sway * 0.5, baseY - stemH * 0.5, tipX, tipY);
                } else {
                    ctx.moveTo(px, baseY);
                    ctx.lineTo(tipX, tipY);
                }
                ctx.stroke();

                if (frac > 0.3) {
                    const leafSize = 7 * ((frac - 0.3) / 0.7);
                    const lmidY = baseY - stemH * 0.55;
                    const lmidX = px + sway * 0.4;
                    for (const side of [-1, 1]) {
                        ctx.save();
                        ctx.translate(lmidX + side * 3, lmidY);
                        ctx.rotate(side * (0.6 + 0.3 * frac));
                        ctx.fillStyle = `rgba(46,${Math.round(140 + 48 * frac)},46,0.9)`;
                        ctx.beginPath();
                        ctx.ellipse(leafSize * 0.6, 0, leafSize, leafSize * 0.5, 0, 0, Math.PI * 2);
                        ctx.fill();
                        ctx.restore();
                    }
                }

                if (frac > 0.55) {
                    const leafW = 14 * ((frac - 0.55) / 0.45);
                    const leafH = 8 * ((frac - 0.55) / 0.45);
                    ctx.save();
                    ctx.translate(tipX, tipY);
                    ctx.rotate(-0.2 + sway * 0.05);
                    ctx.fillStyle = `rgb(46, ${Math.round(150 + 58 * frac)}, 46)`;
                    ctx.shadowColor = '#4dba4d';
                    ctx.shadowBlur = 5 * frac;
                    ctx.beginPath();
                    ctx.ellipse(0, 0, leafW, leafH, 0, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.shadowBlur = 0;
                    ctx.strokeStyle = '#1a7a1a';
                    ctx.lineWidth = 1;
                    ctx.beginPath();
                    ctx.moveTo(-leafW + 2, 0); ctx.lineTo(leafW - 2, 0);
                    ctx.stroke();
                    ctx.restore();
                }
            }
            progressBar(ctx, x + 10, y + h - 14, w - 20, 8, frac, '#4dba4d');
        } else {
            const holeOffsets = [-26, 0, 26];
            for (const ox of holeOffsets) {
                ctx.fillStyle = '#0e0a04';
                ctx.beginPath();
                ctx.ellipse(x + w / 2 + ox, y + h - 20, 5, 3, 0, 0, Math.PI * 2);
                ctx.fill();
                ctx.strokeStyle = '#2a1a06';
                ctx.lineWidth = 1;
                ctx.stroke();
            }
        }
    }

    // ── Flavor shelf ──────────────────────────────────────────────────────────
    if (station.id.startsWith('flavor-shelf-')) {
        const flavor = station.id.split('-')[2] as SnusFlavorType;
        const fCol = FLAVOR_COLORS[flavor];
        // Shelf board — thicker
        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(x + 10, y + h - 40, w - 20, 6);
        ctx.strokeStyle = '#555';
        ctx.lineWidth = 0.8;
        ctx.strokeRect(x + 10, y + h - 40, w - 20, 6);
        // Bottles
        for (let i = -1; i <= 1; i++) {
            ctx.save();
            ctx.globalAlpha = i === 0 ? 1 : 0.45;
            drawItemIcon(ctx, `flavor-${flavor}` as FactoryItemType, x + w / 2 + i * 22, y + h / 2 - 4, 1.2);
            ctx.restore();
        }
        ctx.fillStyle = fCol;
        ctx.shadowColor = fCol;
        ctx.shadowBlur = 6;
        ctx.font = 'bold 11px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText(FLAVOR_LABEL[flavor], x + w / 2, y + h - 8);
        ctx.shadowBlur = 0;
    }

    // ── Grinder ───────────────────────────────────────────────────────────────
    if (station.id === 'grinder') {
        const gearAngle = (frameCount * (station.state > 0 ? 0.07 : 0.006));
        drawGear(ctx, x + 42, y + h / 2 + 6, 24, 9, gearAngle, station.state > 0 ? '#ff9a3c' : '#3a3a5a');
        drawGear(ctx, x + w - 42, y + h / 2 + 6, 18, 7, -gearAngle * 1.3 + Math.PI / 6, station.state > 0 ? '#ffc066' : '#2a2a4a');

        // Input slots — centered inside the grinder, vertically stacked
        const slotW = 32, slotH = 32, slotGap = 6;
        const slotX = x + w / 2 - slotW / 2;
        const leafSlotY = y + (h - slotH * 2 - slotGap) / 2;
        const flavSlotY = leafSlotY + slotH + slotGap;
        ctx.fillStyle = 'rgba(26,26,42,0.35)';
        ctx.strokeStyle = 'rgba(100,100,120,0.4)';
        ctx.lineWidth = 1.5;
        roundRect(ctx, slotX, leafSlotY, slotW, slotH, 5); ctx.fill(); ctx.stroke();
        roundRect(ctx, slotX, flavSlotY, slotW, slotH, 5); ctx.fill(); ctx.stroke();
        if (station.leafLoaded) {
            drawItemIcon(ctx, 'ripe-leaf', slotX + slotW / 2, leafSlotY + slotH / 2, 1.2);
        }
        if (station.flavorLoaded) {
            drawItemIcon(ctx, `flavor-${station.flavorLoaded}` as FactoryItemType, slotX + slotW / 2, flavSlotY + slotH / 2, 1.2);
        }
        if (station.state > 0) {
            const frac = 1 - station.state / 80;
            progressBar(ctx, x + 14, y + h - 22, w - 28, 10, frac, '#ff9a3c');
            if (Math.random() < 0.3) spawnSparks(x + w / 2, y + h / 2, 3, '#ff9a3c');
            if (Math.random() < 0.2) spawnSmoke(x + w / 2 - 15, y + 10, 'rgba(80,60,40,0.5)');
        } else if (station.hasItem && station.itemFlavor) {
            drawItemIcon(ctx, `ground-${station.itemFlavor}` as FactoryItemType, x + w / 2, y + h / 2 + 6, 1.3);
        }
    }

    // ── Packager ──────────────────────────────────────────────────────────────
    if (station.id === 'packager') {
        const isProcessing = station.state > 0;
        const frac = isProcessing ? 1 - station.state / 60 : 0;
        const flavorCol = station.itemFlavor ? FLAVOR_COLORS[station.itemFlavor] : '#3a9fff';
        const activeCol = isProcessing ? flavorCol : '#3a9fff';

        // Hopper (input funnel)
        const hopperX = x + 14, hopperTopY = y + 22, hopperBotY = y + 64, hopperW = 38;
        ctx.fillStyle = '#1a1a2a';
        ctx.strokeStyle = '#2a3a4a';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(hopperX, hopperTopY);
        ctx.lineTo(hopperX + hopperW, hopperTopY);
        ctx.lineTo(hopperX + hopperW - 8, hopperBotY);
        ctx.lineTo(hopperX + 8, hopperBotY);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.strokeStyle = '#3a4a5a';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(hopperX - 3, hopperTopY);
        ctx.lineTo(hopperX + hopperW + 3, hopperTopY);
        ctx.stroke();

        if (station.flavorLoaded || isProcessing) {
            const dColor = station.flavorLoaded ? FLAVOR_COLORS[station.flavorLoaded] : flavorCol;
            ctx.fillStyle = dColor + 'aa';
            ctx.beginPath();
            ctx.ellipse(hopperX + hopperW / 2, hopperBotY - 6, 10, 4, 0, 0, Math.PI * 2);
            ctx.fill();
        }
        if (station.flavorLoaded) {
            drawItemIcon(ctx, `ground-${station.flavorLoaded}` as FactoryItemType, hopperX + hopperW / 2, hopperTopY + 14, 1.0);
        } else {
            ctx.fillStyle = '#2a3a4a';
            ctx.font = '9px monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('IN', hopperX + hopperW / 2, hopperTopY + 20);
        }

        // Press mechanism
        const pressX = x + w / 2, pressMidY = y + h / 2;
        ctx.fillStyle = '#12121e';
        ctx.strokeStyle = '#2a3a5a';
        ctx.lineWidth = 2;
        roundRect(ctx, pressX - 22, y + 14, 44, 28, 4);
        ctx.fill(); ctx.stroke();

        const pistDrop = isProcessing ? Math.abs(Math.sin(frac * Math.PI)) * 26 : 0;
        const pistY = y + 40 + pistDrop;
        ctx.fillStyle = isProcessing ? activeCol + 'cc' : '#2a3a5a';
        ctx.shadowColor = isProcessing ? activeCol : 'transparent';
        ctx.shadowBlur = isProcessing ? 16 : 0;
        roundRect(ctx, pressX - 14, pistY, 28, 16, 3);
        ctx.fill();
        ctx.strokeStyle = isProcessing ? activeCol : '#3a4a6a';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.shadowBlur = 0;

        ctx.strokeStyle = isProcessing ? activeCol + '88' : '#222';
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.moveTo(pressX, y + 42);
        ctx.lineTo(pressX, pistY);
        ctx.stroke();
        ctx.strokeStyle = '#111';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(pressX, y + 42);
        ctx.lineTo(pressX, pistY);
        ctx.stroke();

        ctx.fillStyle = '#0a0a14';
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 1.5;
        roundRect(ctx, pressX - 20, pressMidY + 6, 40, 22, 3);
        ctx.fill(); ctx.stroke();

        if (isProcessing && station.itemFlavor) {
            const canW = 32 * Math.min(frac * 2, 1);
            const canH = 14 * Math.min(frac * 1.5, 1);
            ctx.fillStyle = flavorCol + Math.floor(180 * frac).toString(16).padStart(2, '0');
            ctx.shadowColor = flavorCol;
            ctx.shadowBlur = 8 * frac;
            roundRect(ctx, pressX - canW / 2, pressMidY + 8, canW, canH, 3);
            ctx.fill();
            ctx.shadowBlur = 0;
            if (pistDrop > 20 && Math.random() < 0.4) spawnSparks(pressX, pistY + 16, 4, activeCol);
            if (Math.random() < 0.12) spawnSmoke(pressX, y + 18, 'rgba(60,80,140,0.4)');
        }

        // Output tray
        const trayX = x + w - 54, trayY = y + 50, trayW = 40, trayH = 28;
        ctx.fillStyle = '#111118';
        ctx.strokeStyle = '#2a3a4a';
        ctx.lineWidth = 1.5;
        roundRect(ctx, trayX, trayY, trayW, trayH, 4);
        ctx.fill(); ctx.stroke();
        ctx.strokeStyle = '#222230';
        ctx.lineWidth = 1.5;
        for (let ti = 0; ti < 4; ti++) {
            ctx.beginPath();
            ctx.moveTo(trayX + 5 + ti * 9, trayY + 3);
            ctx.lineTo(trayX + 5 + ti * 9, trayY + trayH - 3);
            ctx.stroke();
        }
        ctx.fillStyle = '#2a3a4a';
        ctx.font = '8px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('OUT', trayX + trayW / 2, trayY - 7);

        if (station.hasItem && station.itemFlavor) {
            const bounce = 0.5 + 0.5 * Math.sin(frameCount * 0.08);
            ctx.save();
            ctx.translate(trayX + trayW / 2, trayY + trayH / 2 - bounce);
            const canFlavorCol = FLAVOR_COLORS[station.itemFlavor];
            ctx.shadowColor = canFlavorCol;
            ctx.shadowBlur = 14 + 5 * bounce;
            drawItemIcon(ctx, `can-${station.itemFlavor}` as FactoryItemType, 0, 0, 1.2);
            ctx.shadowBlur = 0;
            ctx.restore();
        }

        // Belt from press to tray
        const beltY = y + h - 38;
        ctx.fillStyle = '#1a1a28';
        roundRect(ctx, x + 60, beltY, w - 74, 14, 3);
        ctx.fill();
        ctx.strokeStyle = '#2a2a3a';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        const beltOffset = (frameCount * (isProcessing ? 2.5 : 0.6)) % 14;
        ctx.strokeStyle = isProcessing ? '#2a4a6a' : '#1e1e2e';
        ctx.lineWidth = 1.5;
        for (let bi = -beltOffset; bi < w - 74; bi += 14) {
            ctx.beginPath();
            ctx.moveTo(x + 60 + bi, beltY + 3);
            ctx.lineTo(x + 60 + bi, beltY + 11);
            ctx.stroke();
        }

        if (isProcessing) {
            progressBar(ctx, x + 10, y + h - 18, w - 20, 10, frac, activeCol);
        }

        // Label drawn last so it renders above all internals
        ctx.fillStyle = '#606080';
        ctx.font = '12px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText(label, x + w / 2, y + 10);
    }
}

// ─── Player drawing ────────────────────────────────────────────────────────────

function drawPlayer(ctx: CanvasRenderingContext2D, player: FactoryPlayer, isMe: boolean): void {
    const { x, y, colorIndex, carrying, username } = player;
    const color = PLAYER_COLORS[colorIndex] ?? '#888';

    // Drop shadow
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath();
    ctx.ellipse(x, y + PLAYER_RADIUS + 3, PLAYER_RADIUS * 0.85, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Glow for "me"
    if (isMe) {
        ctx.save();
        ctx.shadowColor = color;
        ctx.shadowBlur = 28;
        ctx.beginPath();
        ctx.arc(x, y, PLAYER_RADIUS, 0, Math.PI * 2);
        ctx.strokeStyle = color;
        ctx.lineWidth = 0.1;
        ctx.stroke();
        ctx.restore();
    }

    // Body gradient
    ctx.save();
    const grad = ctx.createRadialGradient(x - PLAYER_RADIUS * 0.3, y - PLAYER_RADIUS * 0.3, 1, x, y, PLAYER_RADIUS);
    grad.addColorStop(0, color + 'ff');
    grad.addColorStop(1, color + '99');
    ctx.beginPath();
    ctx.arc(x, y, PLAYER_RADIUS, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();

    // Face overlay
    ctx.fillStyle = 'rgba(0,0,0,0.1)';
    ctx.beginPath();
    ctx.arc(x, y, PLAYER_RADIUS, 0, Math.PI * 2);
    ctx.fill();
    // Eyes
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.beginPath(); ctx.arc(x - 6, y - 4, 3.5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(x + 6, y - 4, 3.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#111';
    ctx.beginPath(); ctx.arc(x - 5, y - 4, 1.7, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(x + 7, y - 4, 1.7, 0, Math.PI * 2); ctx.fill();
    ctx.restore();

    // Speed boost aura
    if (player.speedBoostTicks > 0) {
        const pulse = 0.6 + 0.4 * Math.abs(Math.sin(frameCount * 0.2));
        ctx.save();
        ctx.globalAlpha = pulse * 0.7;
        ctx.strokeStyle = '#ffe04a';
        ctx.lineWidth = 4;
        ctx.shadowColor = '#ffe04a';
        ctx.shadowBlur = 14;
        ctx.beginPath();
        ctx.arc(x, y, PLAYER_RADIUS + 6, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
    }

    // Border
    ctx.strokeStyle = isMe ? '#fff' : 'rgba(0,0,0,0.5)';
    ctx.lineWidth = isMe ? 3 : 1.5;
    ctx.beginPath(); ctx.arc(x, y, PLAYER_RADIUS, 0, Math.PI * 2); ctx.stroke();

    // Hard hat
    ctx.save();
    ctx.fillStyle = isMe ? '#fff' : '#bbb';
    ctx.beginPath();
    ctx.arc(x, y - PLAYER_RADIUS + 3, PLAYER_RADIUS * 0.7, Math.PI, 0);
    ctx.fill();
    ctx.fillStyle = isMe ? '#ddd' : '#999';
    ctx.fillRect(x - PLAYER_RADIUS * 0.85, y - PLAYER_RADIUS + 3, PLAYER_RADIUS * 1.7, 4);
    ctx.restore();

    // Username tag
    ctx.font = `${isMe ? 'bold ' : ''}12px monospace`;
    const tagW = ctx.measureText(username).width + 14;
    ctx.fillStyle = isMe ? 'rgba(255,255,255,0.88)' : 'rgba(0,0,0,0.68)';
    roundRect(ctx, x - tagW / 2, y + PLAYER_RADIUS + 5, tagW, 17, 4);
    ctx.fill();
    ctx.fillStyle = isMe ? '#111' : '#ccc';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(username, x, y + PLAYER_RADIUS + 13.5);

    // Carried item — bobbing
    if (carrying) {
        const bob = Math.sin(frameCount * 0.12 + x) * 2.5;
        drawItemIcon(ctx, carrying, x, y - PLAYER_RADIUS - 20 + bob, 1.5);
    }
}

// ─── HUD ──────────────────────────────────────────────────────────────────────

function drawHud(ctx: CanvasRenderingContext2D, state: FactoryState): void {
    const { score, targetScore, timeRemainingTicks } = state;
    const totalSec = Math.ceil(timeRemainingTicks / 50);
    const min = Math.floor(totalSec / 60);
    const sec = totalSec % 60;
    const timeStr = `${min}:${sec.toString().padStart(2, '0')}`;
    const urgent = timeRemainingTicks <= 1500;
    const scoreFlashing = scoreFlashFrames > 0;

    if (score !== lastScore) {
        if (score > lastScore) {
            spawnScoreText(CANVAS_W / 2, 100, `+${score - lastScore}`, '#4eff8a');
        }
        lastScore = score;
    }
    if (scoreFlashFrames > 0) scoreFlashFrames--;

    // Top HUD bar — wider for larger canvas
    const hudH = 50;
    const hudW = 520;
    const hudX = CANVAS_W / 2 - hudW / 2;

    ctx.save();
    const hudGrad = ctx.createLinearGradient(hudX, 6, hudX, 6 + hudH);
    hudGrad.addColorStop(0, 'rgba(30,30,50,0.96)');
    hudGrad.addColorStop(1, 'rgba(15,15,30,0.96)');
    roundRect(ctx, hudX, 6, hudW, hudH, 10);
    ctx.fillStyle = hudGrad;
    ctx.fill();
    ctx.strokeStyle = scoreFlashing ? scoreFlashColor : (urgent ? '#ff4444' : '#3a3a60');
    ctx.lineWidth = scoreFlashing ? 2.5 : 2;
    if (scoreFlashing) {
        ctx.shadowColor = scoreFlashColor;
        ctx.shadowBlur = 18;
    }
    ctx.stroke();
    ctx.shadowBlur = 0;

    const barX = hudX + 16, barY = 36, barW = hudW - 32, barH = 8;
    progressBar(ctx, barX, barY, barW, barH, score / targetScore, '#4eff8a');

    ctx.fillStyle = scoreFlashing ? scoreFlashColor : '#eee';
    ctx.shadowColor = scoreFlashing ? scoreFlashColor : 'transparent';
    ctx.shadowBlur = scoreFlashing ? 12 : 0;
    ctx.font = 'bold 16px monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(`SCORE  ${score} / ${targetScore}`, hudX + 16, 6 + hudH / 2 - 5);
    ctx.shadowBlur = 0;

    ctx.fillStyle = urgent ? '#ff4444' : '#aaa';
    if (urgent) {
        ctx.shadowColor = '#ff4444';
        ctx.shadowBlur = 10 * (0.6 + 0.4 * Math.sin(frameCount * 0.3));
    }
    ctx.font = 'bold 18px monospace';
    ctx.textAlign = 'right';
    ctx.fillText(timeStr, hudX + hudW - 16, 6 + hudH / 2 - 5);
    ctx.shadowBlur = 0;
    ctx.restore();
}

// ─── Floor ────────────────────────────────────────────────────────────────────

function drawFloor(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#0d0d18';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    // Large tile pattern
    const tileSize = 64;
    ctx.strokeStyle = 'rgba(255,255,255,0.022)';
    ctx.lineWidth = 1;
    for (let row = 0; row * tileSize < CANVAS_H; row++) {
        for (let col = 0; col * tileSize < CANVAS_W; col++) {
            const ox = (row % 2) * (tileSize / 2);
            const tx = col * tileSize + ox;
            const ty = row * tileSize;
            ctx.strokeRect(tx, ty, tileSize, tileSize);
        }
    }

    // Subtle zone color tints
    const zoneGradGrow = ctx.createLinearGradient(0, 0, 0, 260);
    zoneGradGrow.addColorStop(0, 'rgba(20,60,20,0.07)');
    zoneGradGrow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = zoneGradGrow;
    ctx.fillRect(0, 0, CANVAS_W, 260);

    const zoneGradOrders = ctx.createLinearGradient(0, 740, 0, CANVAS_H);
    zoneGradOrders.addColorStop(0, 'rgba(0,0,0,0)');
    zoneGradOrders.addColorStop(1, 'rgba(74,158,255,0.06)');
    ctx.fillStyle = zoneGradOrders;
    ctx.fillRect(0, 740, CANVAS_W, CANVAS_H - 740);

    // Caution stripes at order zone
    const stripeY = 760;
    const stripeH = 20;
    ctx.save();
    ctx.globalAlpha = 0.1;
    for (let sx = 0; sx < CANVAS_W; sx += 32) {
        ctx.fillStyle = sx % 64 < 32 ? '#ffcc00' : '#000';
        ctx.fillRect(sx, stripeY, 32, stripeH);
    }
    ctx.restore();

    // Zone dividers
    ctx.strokeStyle = 'rgba(255,255,255,0.055)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([12, 8]);
    ctx.beginPath(); ctx.moveTo(0, 265); ctx.lineTo(CANVAS_W, 265); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, 470); ctx.lineTo(CANVAS_W, 470); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, 760); ctx.lineTo(CANVAS_W, 760); ctx.stroke();
    ctx.setLineDash([]);

    // Zone watermark labels
    ctx.fillStyle = 'rgba(255,255,255,0.045)';
    ctx.font = 'bold 64px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('GROW', CANVAS_W / 2, 175);
    ctx.fillText('PROCESS', CANVAS_W / 2, 370);
    ctx.fillText('PACKAGE', CANVAS_W / 2, 620);
    ctx.fillText('ORDERS', CANVAS_W / 2, 855);
}

// ─── Infrastructure (pipes & belts) ──────────────────────────────────────────

function drawInfrastructure(ctx: CanvasRenderingContext2D): void {
    const gr = STATION_RECTS['grinder'];
    const p2 = STATION_RECTS['patch-2'];
    drawConveyorBelt(ctx,
        p2.x + p2.w / 2, p2.y + p2.h,
        gr.x + gr.w / 2, gr.y);

    drawConveyorBelt(ctx,
        gr.x + gr.w, gr.y + gr.h / 2,
        STATION_RECTS['packager'].x, STATION_RECTS['packager'].y + STATION_RECTS['packager'].h / 2);

    const fMint = STATION_RECTS['flavor-shelf-mint'];
    const fJuniper = STATION_RECTS['flavor-shelf-juniper'];
    const fLicorice = STATION_RECTS['flavor-shelf-licorice'];
    drawPipe(ctx, fMint.x + fMint.w / 2, fMint.y + fMint.h, gr.x + 30, gr.y, FLAVOR_COLORS.mint);
    drawPipe(ctx, fJuniper.x + fJuniper.w / 2, fJuniper.y + fJuniper.h, gr.x + gr.w / 2, gr.y, FLAVOR_COLORS.juniper);
    drawPipe(ctx, fLicorice.x + fLicorice.w / 2, fLicorice.y + fLicorice.h, gr.x + gr.w - 30, gr.y, FLAVOR_COLORS.licorice);

    const pk = STATION_RECTS['packager'];
    drawPipe(ctx, pk.x + pk.w / 2, pk.y + pk.h, pk.x + pk.w / 2, 760, '#4a9eff');
}

// ─── End screen ───────────────────────────────────────────────────────────────

function drawEndScreen(ctx: CanvasRenderingContext2D, state: FactoryState, myUserId: string): void {
    drawFloor(ctx);

    ctx.fillStyle = 'rgba(0,0,0,0.78)';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    const won = state.score >= state.targetScore;

    const panelW = 600, panelH = 380;
    const px = CANVAS_W / 2 - panelW / 2, py = CANVAS_H / 2 - panelH / 2 - 20;
    const panelGrad = ctx.createLinearGradient(px, py, px, py + panelH);
    panelGrad.addColorStop(0, '#1a1a2e');
    panelGrad.addColorStop(1, '#0d0d18');
    roundRect(ctx, px, py, panelW, panelH, 20);
    ctx.fillStyle = panelGrad;
    ctx.fill();
    ctx.strokeStyle = won ? '#ffe04a' : '#3a3a60';
    ctx.lineWidth = 2.5;
    if (won) { ctx.shadowColor = '#ffe04a'; ctx.shadowBlur = 26; }
    ctx.stroke();
    ctx.shadowBlur = 0;

    ctx.textAlign = 'center';
    ctx.fillStyle = won ? '#ffe04a' : '#ccc';
    ctx.shadowColor = won ? '#ffe04a' : 'transparent';
    ctx.shadowBlur = won ? 20 : 0;
    ctx.font = 'bold 38px monospace';
    ctx.textBaseline = 'middle';
    ctx.fillText(won ? 'FACTORY CLOSED! 🏆' : 'FACTORY CLOSED', CANVAS_W / 2, py + 62);
    ctx.shadowBlur = 0;

    ctx.fillStyle = '#eee';
    ctx.font = '22px monospace';
    ctx.fillText(`Score: ${state.score} / ${state.targetScore}`, CANVAS_W / 2, py + 112);

    if (won) {
        ctx.fillStyle = '#4eff8a';
        ctx.shadowColor = '#4eff8a';
        ctx.shadowBlur = 10;
        ctx.font = 'bold 17px monospace';
        ctx.fillText('TARGET REACHED!', CANVAS_W / 2, py + 148);
        ctx.shadowBlur = 0;
    }

    ctx.strokeStyle = '#2a2a40';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(px + 30, py + 176); ctx.lineTo(px + panelW - 30, py + 176);
    ctx.stroke();

    const results: GameResult[] = state.results ?? [];
    ctx.font = '16px monospace';
    let ry = py + 202;
    for (const r of results) {
        const isMe = r.userId === myUserId;
        ctx.fillStyle = isMe ? '#ffe04a' : '#888';
        if (isMe) { ctx.shadowColor = '#ffe04a'; ctx.shadowBlur = 8; }
        ctx.fillText(`${r.username}${isMe ? ' (you)' : ''}  —  ${r.score} pts`, CANVAS_W / 2, ry);
        ctx.shadowBlur = 0;
        ry += 30;
    }

    if (won && Math.random() < 0.4) {
        spawnSparks(
            CANVAS_W * Math.random(),
            CANVAS_H * 0.3,
            4,
            ['#ffe04a', '#4eff8a', '#4a9eff', '#ff4a4a'][Math.floor(Math.random() * 4)]
        );
    }
    updateParticles();
    drawParticles(ctx);
}

// ─── Snus pouch pickup ────────────────────────────────────────────────────────

function drawSnusPouch(ctx: CanvasRenderingContext2D, x: number, y: number): void {
    const r = 18;
    const pulse = 0.85 + 0.15 * Math.sin(frameCount * 0.15);
    ctx.save();
    ctx.shadowColor = '#ffe04a';
    ctx.shadowBlur = 18 * pulse;
    // Can body
    ctx.beginPath();
    ctx.arc(x, y, r * pulse, 0, Math.PI * 2);
    ctx.fillStyle = '#e8c84a';
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.stroke();
    // Label text
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#1a1a2e';
    ctx.font = `bold ${Math.round(9 * pulse)}px monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('SNUS', x, y - 2);
    ctx.font = `bold ${Math.round(7 * pulse)}px monospace`;
    ctx.fillText('⚡', x, y + 8);
    ctx.restore();
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function drawGame(ctx: CanvasRenderingContext2D, state: FactoryState, myUserId: string, hoveredStationId?: string | null, interactableStationId?: string | null): void {
    frameCount++;
    updateParticles();

    ctx.save();
    if (shakeFrames > 0) {
        const sx = (Math.random() - 0.5) * shakeIntensity * 2;
        const sy = (Math.random() - 0.5) * shakeIntensity * 2;
        ctx.translate(sx, sy);
        shakeFrames--;
    }

    drawFloor(ctx);
    drawInfrastructure(ctx);

    for (const station of state.stations) {
        const hovered = station.id === hoveredStationId;
        const canInteract = station.id === interactableStationId;
        drawStation(ctx, station, hovered, canInteract);
    }

    if (state.snusPouch) drawSnusPouch(ctx, state.snusPouch.x, state.snusPouch.y);

    const me = state.players.find(p => p.userId === myUserId);
    const others = state.players.filter(p => p.userId !== myUserId);
    for (const p of others) drawPlayer(ctx, p, false);
    if (me) drawPlayer(ctx, me, true);

    drawParticles(ctx);
    drawHud(ctx, state);

    ctx.restore();
}

export { drawEndScreen };
