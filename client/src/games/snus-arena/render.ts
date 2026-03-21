import type { ArenaState, ArenaPlayer, ArenaClass, ArenaGameMode } from '@slutsnus/shared';
import {
    CANVAS_W, CANVAS_H, PLAYER_RADIUS, POWERUP_RADIUS,
    TEAM_COLORS, CLASS_COLORS, PROJECTILE_COLORS, EFFECT_COLORS,
    POWERUP_COLORS, CLASS_INFO,
} from './constants';

// ── Class selection screen ───────────────────────────────────────────────────

const CLASS_ICONS: Record<string, string> = { warrior: '⚔️', archer: '🏹', mage: '🔮' };

export function drawClassSelect(
    ctx: CanvasRenderingContext2D,
    myUserId: string,
    state: ArenaState,
    onSelectClass: (cls: ArenaClass) => void,
    clickHandler: ((cls: ArenaClass) => void) | null,
): (cls: ArenaClass) => void {
    void clickHandler;
    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

    const now = Date.now();

    // Animated starfield background
    ctx.fillStyle = '#0a0a1a';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    // Scanlines
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    for (let sy = 0; sy < CANVAS_H; sy += 4) {
        ctx.fillRect(0, sy, CANVAS_W, 2);
    }

    const me = state.players.find(p => p.userId === myUserId);
    const alreadySelected = me?.class !== null;

    // Title with glow
    const titlePulse = 0.75 + 0.25 * Math.sin(now / 600);
    ctx.save();
    ctx.textAlign = 'center';
    ctx.font = 'bold 32px monospace';
    ctx.shadowColor = '#4a9eff';
    ctx.shadowBlur = 20 * titlePulse;
    ctx.fillStyle = '#ffffff';
    ctx.fillText('— CHOOSE YOUR CLASS —', CANVAS_W / 2, 48);
    ctx.shadowBlur = 0;
    ctx.restore();

    if (alreadySelected) {
        const pulse = 0.6 + 0.4 * Math.sin(now / 400);
        ctx.save();
        ctx.textAlign = 'center';
        ctx.font = 'bold 15px monospace';
        ctx.shadowColor = '#00ff88';
        ctx.shadowBlur = 12 * pulse;
        ctx.fillStyle = '#00ff88';
        ctx.fillText(`✓ ${me!.class!.toUpperCase()} SELECTED — WAITING FOR OTHERS...`, CANVAS_W / 2, 76);
        ctx.shadowBlur = 0;
        ctx.restore();
    }

    const classes: ArenaClass[] = ['warrior', 'archer', 'mage'];
    const gap = 16;
    const cardW = Math.floor((CANVAS_W - gap * 4) / 3);
    const cardH = CANVAS_H - 90;
    const startX = gap * 2;
    const startY = 82;

    const regions: { cls: ArenaClass; x: number; y: number; w: number; h: number }[] = [];

    classes.forEach((cls, i) => {
        const x = startX + i * (cardW + gap);
        const y = startY;
        const info = CLASS_INFO[cls];
        const isSelected = me?.class === cls;
        const clsColor = CLASS_COLORS[cls];
        const pad = 14;

        regions.push({ cls, x, y, w: cardW, h: cardH });

        // Card glow
        ctx.save();
        ctx.shadowColor = isSelected ? '#4a9eff' : clsColor;
        ctx.shadowBlur = isSelected ? 28 + 8 * Math.sin(now / 300) : 12;

        // Card background gradient
        const grad = ctx.createLinearGradient(x, y, x, y + cardH);
        if (isSelected) {
            grad.addColorStop(0, '#1e3558');
            grad.addColorStop(1, '#0d1a30');
        } else {
            grad.addColorStop(0, '#1a1a3a');
            grad.addColorStop(1, '#0d0d1e');
        }
        ctx.fillStyle = grad;
        ctx.strokeStyle = isSelected ? '#4a9eff' : clsColor;
        ctx.lineWidth = isSelected ? 3 : 1.5;
        roundRect(ctx, x, y, cardW, cardH, 14);
        ctx.fill();
        ctx.stroke();
        ctx.restore();

        // Top color stripe
        const stripe = ctx.createLinearGradient(x, y, x + cardW, y);
        stripe.addColorStop(0, 'transparent');
        stripe.addColorStop(0.3, clsColor + 'aa');
        stripe.addColorStop(0.7, clsColor + 'aa');
        stripe.addColorStop(1, 'transparent');
        ctx.fillStyle = stripe;
        roundRect(ctx, x, y, cardW, 5, 14);
        ctx.fill();

        // Layout cursor
        let cy = y + pad + 5;

        // Icon circle backdrop
        const iconR = 34;
        const iconCX = x + cardW / 2;
        const iconCY = cy + iconR;
        ctx.save();
        ctx.shadowColor = clsColor;
        ctx.shadowBlur = 20;
        ctx.fillStyle = clsColor + '33';
        ctx.beginPath();
        ctx.arc(iconCX, iconCY, iconR, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = clsColor;
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.restore();

        ctx.font = '36px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(CLASS_ICONS[cls] ?? '?', iconCX, iconCY);
        ctx.textBaseline = 'alphabetic';
        cy += iconR * 2 + 12;

        // Class name
        ctx.save();
        ctx.textAlign = 'center';
        ctx.font = 'bold 20px monospace';
        ctx.shadowColor = clsColor;
        ctx.shadowBlur = 10;
        ctx.fillStyle = '#ffffff';
        ctx.fillText(info.name.toUpperCase(), x + cardW / 2, cy);
        ctx.restore();
        cy += 22;

        // Stat bars
        const hpPct = info.hp / 200;
        const speedPct = info.speed === 'Fast' ? 1 : info.speed === 'Medium' ? 0.6 : 0.35;
        drawStatBar(ctx, x + pad, cy, cardW - pad * 2, 'HP ', hpPct, '#ff4466');
        cy += 18;
        drawStatBar(ctx, x + pad, cy, cardW - pad * 2, 'SPD', speedPct, '#44ddff');
        cy += 22;

        // Description
        ctx.fillStyle = '#99aacc';
        ctx.font = '12px monospace';
        ctx.textAlign = 'left';
        cy = wrapTextTracked(ctx, info.description, x + pad, cy, cardW - pad * 2, 16) + 10;

        // Divider
        ctx.strokeStyle = clsColor + '55';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x + pad, cy);
        ctx.lineTo(x + cardW - pad, cy);
        ctx.stroke();
        cy += 10;

        // Abilities
        const abBoxH = Math.floor((y + cardH - 26 - cy) / 3);
        info.abilities.forEach((ab, ai) => {
            const ay = cy + ai * (abBoxH + 4);

            const abGrad = ctx.createLinearGradient(x + pad, ay, x + pad, ay + abBoxH);
            abGrad.addColorStop(0, '#0d1f3c');
            abGrad.addColorStop(1, '#081428');
            ctx.fillStyle = abGrad;
            ctx.strokeStyle = clsColor + '66';
            ctx.lineWidth = 1;
            roundRect(ctx, x + pad, ay, cardW - pad * 2, abBoxH, 6);
            ctx.fill();
            ctx.stroke();

            // Slot badge
            const badgeW = 32, badgeH = 18;
            ctx.fillStyle = clsColor;
            roundRect(ctx, x + pad + 4, ay + 6, badgeW, badgeH, 4);
            ctx.fill();
            ctx.fillStyle = '#000000';
            ctx.font = 'bold 11px monospace';
            ctx.textAlign = 'center';
            ctx.fillText(ab.slot, x + pad + 4 + badgeW / 2, ay + 18);

            const textX = x + pad + 4 + badgeW + 6;
            const textW = cardW - pad * 2 - badgeW - 14;

            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 12px monospace';
            ctx.textAlign = 'left';
            ctx.fillText(ab.name, textX, ay + 16);

            ctx.fillStyle = '#778899';
            ctx.font = '11px monospace';
            wrapText(ctx, ab.desc, textX, ay + 30, textW, 13);
        });

        // CLICK TO SELECT hint
        if (!alreadySelected) {
            const hint = 0.5 + 0.5 * Math.sin(now / 500 + i);
            ctx.save();
            ctx.globalAlpha = hint;
            ctx.textAlign = 'center';
            ctx.font = 'bold 12px monospace';
            ctx.fillStyle = clsColor;
            ctx.fillText('[ CLICK TO SELECT ]', x + cardW / 2, y + cardH - 8);
            ctx.restore();
        }
    });

    ctx.textAlign = 'left';
    return (cls: ArenaClass) => onSelectClass(cls);
}

function drawStatBar(
    ctx: CanvasRenderingContext2D,
    x: number, y: number, w: number,
    label: string, pct: number, color: string,
): void {
    const barX = x + 30;
    const barW = w - 32;
    ctx.fillStyle = '#555555';
    ctx.font = '9px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(label, x, y + 8);
    ctx.fillStyle = '#222233';
    ctx.fillRect(barX, y, barW, 8);
    const barGrad = ctx.createLinearGradient(barX, y, barX + barW * pct, y);
    barGrad.addColorStop(0, color + 'bb');
    barGrad.addColorStop(1, color);
    ctx.fillStyle = barGrad;
    ctx.fillRect(barX, y, barW * pct, 8);
}

export function getClassCardAtPoint(
    x: number, y: number,
    canvasRect: DOMRect,
): ArenaClass | null {
    const scaleX = CANVAS_W / canvasRect.width;
    const scaleY = CANVAS_H / canvasRect.height;
    const cx = (x - canvasRect.left) * scaleX;
    const cy = (y - canvasRect.top) * scaleY;

    const classes: ArenaClass[] = ['warrior', 'archer', 'mage'];
    const gap = 16;
    const cardW = Math.floor((CANVAS_W - gap * 4) / 3);
    const cardH = CANVAS_H - 90;
    const startX = gap * 2;
    const startY = 82;

    for (let i = 0; i < classes.length; i++) {
        const rx = startX + i * (cardW + gap);
        if (cx >= rx && cx <= rx + cardW && cy >= startY && cy <= startY + cardH) {
            return classes[i];
        }
    }
    return null;
}

// ── Damage number particles ───────────────────────────────────────────────────

interface DamageNumber {
    x: number;
    y: number;
    text: string;
    color: string;
    born: number;
    duration: number; // ms
}

const dmgParticles: DamageNumber[] = [];

export function spawnDamageNumber(x: number, y: number, amount: number, isEnemy: boolean): void {
    dmgParticles.push({
        x,
        y: y - PLAYER_RADIUS - 18,
        text: `-${amount}`,
        color: isEnemy ? '#44ff88' : '#ff4444',
        born: Date.now(),
        duration: 900,
    });
}

// ── Playing screen ───────────────────────────────────────────────────────────

export function drawGame(
    ctx: CanvasRenderingContext2D,
    state: ArenaState,
    prevState: ArenaState | null,
    alpha: number,
    myUserId: string,
): void {
    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

    // Background
    ctx.fillStyle = '#111827';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    // Obstacles
    ctx.fillStyle = '#374151';
    for (const obs of state.obstacles) {
        ctx.fillRect(obs.x, obs.y, obs.w, obs.h);
    }
    ctx.strokeStyle = '#4b5563';
    ctx.lineWidth = 1;
    for (const obs of state.obstacles) {
        ctx.strokeRect(obs.x, obs.y, obs.w, obs.h);
    }

    // Powerups
    const now = Date.now();
    for (const pw of state.powerups) {
        if (!pw.active) continue;
        const pulse = 0.75 + 0.25 * Math.sin(now / 400);
        ctx.globalAlpha = pulse;
        ctx.fillStyle = POWERUP_COLORS[pw.type];
        ctx.beginPath();
        ctx.arc(pw.x, pw.y, POWERUP_RADIUS, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.strokeStyle = '#ffffff44';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Icon label
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 11px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(pw.type === 'heal' ? '+HP' : 'DMG', pw.x, pw.y + 4);
    }

    // Projectiles (interpolated)
    for (const proj of state.projectiles) {
        let px = proj.x, py = proj.y;
        if (prevState) {
            const prev = prevState.projectiles.find(p => p.id === proj.id);
            if (prev) {
                px = lerp(prev.x, proj.x, alpha);
                py = lerp(prev.y, proj.y, alpha);
            }
        }
        ctx.fillStyle = PROJECTILE_COLORS[proj.type] ?? '#ffffff';
        ctx.beginPath();
        ctx.arc(px, py, proj.radius, 0, Math.PI * 2);
        ctx.fill();
    }

    // Players (interpolated)
    for (const player of state.players) {
        let px = player.x, py = player.y;
        if (prevState) {
            const prev = prevState.players.find(p => p.userId === player.userId);
            if (prev) {
                px = lerp(prev.x, player.x, alpha);
                py = lerp(prev.y, player.y, alpha);
            }
        }

        const isMe = player.userId === myUserId;
        const color = TEAM_COLORS[player.team];
        const opacity = player.alive ? 1 : 0.3;

        ctx.globalAlpha = opacity;

        // Ability windup indicator
        if (player.castingAbility) {
            const cast = player.castingAbility;
            const progress = 1 - cast.remainingTicks / cast.totalTicks;
            const castColor = CLASS_COLORS[player.class ?? 'warrior'] ?? '#ffffff';
            const cls = player.class;
            const slot = cast.slot;

            const isMelee = cls === 'warrior' && (slot === 'Q' || slot === 'W');
            const isMultiShot = cls === 'archer' && slot === 'W';

            if (isMelee) {
                // Cone showing the melee range in the cast angle
                const range = cls === 'warrior' && slot === 'Q' ? 55 : 60;
                const halfAngle = Math.PI / 4; // 45° half-cone
                ctx.save();
                ctx.globalAlpha = opacity * progress * 0.55;
                ctx.fillStyle = castColor;
                ctx.shadowColor = castColor;
                ctx.shadowBlur = 10;
                ctx.beginPath();
                ctx.moveTo(px, py);
                ctx.arc(px, py, range, cast.angle - halfAngle, cast.angle + halfAngle);
                ctx.closePath();
                ctx.fill();
                ctx.shadowBlur = 0;
                // Cone outline
                ctx.globalAlpha = opacity * (0.4 + 0.6 * progress);
                ctx.strokeStyle = castColor;
                ctx.lineWidth = 2;
                ctx.stroke();
                ctx.restore();
            } else if (isMultiShot) {
                // Three arrow indicators spread apart
                const SPREAD = (15 * Math.PI) / 180;
                for (let i = -1; i <= 1; i++) {
                    drawWindupArrow(ctx, px, py, cast.angle + i * SPREAD, progress, castColor, opacity, 90);
                }
            } else {
                // Single arrow indicator for all other ranged abilities
                const arrowLen = cls === 'mage' && slot === 'W' ? 70 : 90;
                drawWindupArrow(ctx, px, py, cast.angle, progress, castColor, opacity, arrowLen);
            }
        }

        // Effect aura
        for (const effect of player.effects) {
            const ec = EFFECT_COLORS[effect.type];
            if (!ec) continue;
            ctx.strokeStyle = ec;
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(px, py, PLAYER_RADIUS + 5, 0, Math.PI * 2);
            ctx.stroke();
        }

        // Body circle
        ctx.fillStyle = player.class ? CLASS_COLORS[player.class] : color;
        ctx.beginPath();
        ctx.arc(px, py, PLAYER_RADIUS, 0, Math.PI * 2);
        ctx.fill();

        // Team ring
        ctx.strokeStyle = color;
        ctx.lineWidth = isMe ? 3 : 2;
        ctx.stroke();

        // Class icon inside player circle
        if (player.class) {
            const classIcons: Record<string, string> = { warrior: '⚔️', archer: '🏹', mage: '🔮' };
            const icon = classIcons[player.class];
            if (icon) {
                ctx.font = '14px sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(icon, px, py);
                ctx.textBaseline = 'alphabetic';
            }
        }

        // Facing direction indicator
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(
            px + Math.cos(player.facingAngle) * (PLAYER_RADIUS + 8),
            py + Math.sin(player.facingAngle) * (PLAYER_RADIUS + 8),
        );
        ctx.stroke();

        ctx.globalAlpha = 1;

        // HP bar above player
        drawHpBar(ctx, px, py - PLAYER_RADIUS - 12, player.hp, player.maxHp, color);

        // Username label
        ctx.fillStyle = '#ffffff';
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(player.username, px, py - PLAYER_RADIUS - 16);
    }

    // Damage numbers
    const nowMs = Date.now();
    for (let i = dmgParticles.length - 1; i >= 0; i--) {
        const p = dmgParticles[i];
        const elapsed = nowMs - p.born;
        if (elapsed >= p.duration) { dmgParticles.splice(i, 1); continue; }
        const t = elapsed / p.duration;
        const alpha = 1 - t;
        const rise = 30 * t;
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.font = `bold ${14 + Math.round(4 * (1 - t))}px monospace`;
        ctx.textAlign = 'center';
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 6;
        ctx.fillText(p.text, p.x, p.y - rise);
        ctx.restore();
    }

    // Ability cooldown strip (bottom HUD for local player)
    const me = state.players.find(p => p.userId === myUserId);
    if (me) drawAbilityHUD(ctx, me);

    ctx.textAlign = 'left';
}

// ── End screen ───────────────────────────────────────────────────────────────

export function drawEndScreen(
    ctx: CanvasRenderingContext2D,
    state: ArenaState,
    myUserId: string,
): void {
    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
    ctx.fillStyle = '#111827';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    if (!state.results) return;

    const winner = state.results.find(r => r.rank === 1);
    const isWinner = winner?.userId === myUserId;

    ctx.font = 'bold 40px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = isWinner ? '#ffd700' : '#ff4444';
    ctx.fillText(isWinner ? 'Victory!' : 'Defeat', CANVAS_W / 2, 100);

    if (winner) {
        ctx.font = '22px sans-serif';
        ctx.fillStyle = '#ffffff';
        ctx.fillText(`Winner: ${winner.username}`, CANVAS_W / 2, 150);
    }

    ctx.font = '18px sans-serif';
    ctx.fillStyle = '#aaaaaa';
    ctx.fillText('Results', CANVAS_W / 2, 200);

    state.results.forEach((r, i) => {
        ctx.font = '16px sans-serif';
        ctx.fillStyle = r.rank === 1 ? '#ffd700' : '#cccccc';
        ctx.fillText(`#${r.rank}  ${r.username}  (HP remaining: ${r.score})`, CANVAS_W / 2, 230 + i * 30);
    });

    ctx.textAlign = 'left';
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t;
}

function drawWindupArrow(
    ctx: CanvasRenderingContext2D,
    ox: number, oy: number,
    angle: number,
    progress: number,
    color: string,
    playerOpacity: number,
    totalLen: number,
): void {
    const start = PLAYER_RADIUS + 4;
    const end = start + totalLen * progress;
    if (end <= start) return;

    const cos = Math.cos(angle);
    const sin = Math.sin(angle);

    const x1 = ox + cos * start;
    const y1 = oy + sin * start;
    const x2 = ox + cos * end;
    const y2 = oy + sin * end;

    ctx.save();
    ctx.globalAlpha = playerOpacity * (0.5 + 0.5 * progress);
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 6;
    ctx.lineWidth = 2.5;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.setLineDash([]);

    // Arrowhead
    const headLen = 10;
    const headAngle = Math.PI / 5;
    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(
        x2 - headLen * Math.cos(angle - headAngle),
        y2 - headLen * Math.sin(angle - headAngle),
    );
    ctx.lineTo(
        x2 - headLen * Math.cos(angle + headAngle),
        y2 - headLen * Math.sin(angle + headAngle),
    );
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.restore();
}

function drawHpBar(
    ctx: CanvasRenderingContext2D,
    cx: number, y: number,
    hp: number, maxHp: number,
    color: string,
): void {
    if (maxHp <= 0) return;
    const w = 40, h = 5;
    const x = cx - w / 2;
    ctx.fillStyle = '#333333';
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w * Math.max(0, hp / maxHp), h);
}

function drawAbilityHUD(ctx: CanvasRenderingContext2D, player: ArenaPlayer): void {
    const slots = player.abilities;
    const boxW = 70, boxH = 50, gap = 10;
    const totalW = slots.length * boxW + (slots.length - 1) * gap;
    const startX = (CANVAS_W - totalW) / 2;
    const y = CANVAS_H - boxH - 10;

    slots.forEach((ab, i) => {
        const x = startX + i * (boxW + gap);
        const ready = ab.cooldownRemainingTicks === 0;

        ctx.fillStyle = ready ? '#1e3a5f' : '#1a1a1a';
        roundRect(ctx, x, y, boxW, boxH, 6);
        ctx.fill();
        ctx.strokeStyle = ready ? '#4a9eff' : '#555555';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Cooldown fill overlay
        if (!ready) {
            const pct = ab.cooldownRemainingTicks / ab.cooldownTotalTicks;
            ctx.fillStyle = '#00000066';
            ctx.fillRect(x, y + boxH * (1 - pct), boxW, boxH * pct);
        }

        ctx.fillStyle = ready ? '#ffffff' : '#888888';
        ctx.font = 'bold 16px sans-serif';
        ctx.textAlign = 'center';
        const slotLabel = ab.slot === 'Q' ? 'M1' : ab.slot === 'E' ? 'M2' : ab.slot === 'W' ? 'R' : ab.slot;
        ctx.fillText(`[${slotLabel}]`, x + boxW / 2, y + 20);

        if (!ready) {
            ctx.font = '11px sans-serif';
            ctx.fillStyle = '#aaaaaa';
            const secs = (ab.cooldownRemainingTicks * 20 / 1000).toFixed(1);
            ctx.fillText(`${secs}s`, x + boxW / 2, y + 38);
        }
    });
}

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

function wrapText(
    ctx: CanvasRenderingContext2D,
    text: string, x: number, y: number,
    maxWidth: number, lineHeight: number,
): void {
    const words = text.split(' ');
    let line = '';
    let cy = y;
    for (const word of words) {
        const test = line + word + ' ';
        if (ctx.measureText(test).width > maxWidth && line !== '') {
            ctx.fillText(line.trim(), x, cy);
            line = word + ' ';
            cy += lineHeight;
        } else {
            line = test;
        }
    }
    ctx.fillText(line.trim(), x, cy);
}

// Like wrapText but returns the Y position after the last line
function wrapTextTracked(
    ctx: CanvasRenderingContext2D,
    text: string, x: number, y: number,
    maxWidth: number, lineHeight: number,
): number {
    const words = text.split(' ');
    let line = '';
    let cy = y;
    for (const word of words) {
        const test = line + word + ' ';
        if (ctx.measureText(test).width > maxWidth && line !== '') {
            ctx.fillText(line.trim(), x, cy);
            line = word + ' ';
            cy += lineHeight;
        } else {
            line = test;
        }
    }
    ctx.fillText(line.trim(), x, cy);
    return cy + lineHeight;
}

// Export a helper to draw the game-mode selector overlay on the lobby (used in index.tsx)
export function drawModeSelect(
    ctx: CanvasRenderingContext2D,
    currentMode: ArenaGameMode,
): void {
    void ctx; void currentMode; // handled in HTML overlay, not canvas
}
