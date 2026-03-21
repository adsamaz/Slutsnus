import type { GameEngine } from '../registry';
import type {
    GameAction, PlayerInfo, GameResult,
    ArenaPlayer, ArenaProjectile, ArenaPowerup, ArenaState,
    ArenaClass, ArenaAbilitySlot, ArenaTeam, ArenaEffect,
    ArenaGameMode, ArenaCast,
} from '@slutsnus/shared';
import {
    TICK_MS, PLAYER_RADIUS, PLAYER_SPEED, BASE_HP, ABILITIES,
    BERSERKER_MULT, HEAL_AMOUNT, DAMAGE_BOOST_MULT, DAMAGE_BOOST_TICKS,
    HEAL_RESPAWN_TICKS, DAMAGE_BOOST_RESPAWN_TICKS,
    ARROW_RADIUS, FIREBALL_RADIUS, MULTI_ARROW_SPREAD_RAD,
    STUN_TICKS, CLASS_SELECT_TIMEOUT_TICKS,
} from './constants';
import { ARENA_OBSTACLES, POWERUP_SPAWN_LOCATIONS, SPAWN_POINTS } from './map';
import { resolveCircleVsObstacles, circlesOverlap, sweptCircleHitsObstacle } from './physics';
import { BotController } from './bot';

interface PlayerInternal extends ArenaPlayer {
    inputDx: number;
    inputDy: number;
    hasSelectedClass: boolean;
    pendingDashTarget: { x: number; y: number } | null;
    damageMultiplier: number;
    castingAbility: ArenaCast | null;
}

interface PowerupInternal extends ArenaPowerup {}

let _projId = 0;
const nextProjId = () => `p${_projId++}`;

export class SnusArenaEngine implements GameEngine {
    private players: PlayerInternal[] = [];
    private projectiles: ArenaProjectile[] = [];
    private powerups: PowerupInternal[] = [];
    private bots = new Map<string, BotController>();
    private onStateUpdate: ((state: unknown) => void) | null = null;
    private intervalId: ReturnType<typeof setInterval> | null = null;
    private tickCount = 0;
    private gameStatus: ArenaState['status'] = 'selecting';
    private classSelectRemaining = CLASS_SELECT_TIMEOUT_TICKS;
    private gameMode: ArenaGameMode = '1v1';

    init(roomId: string, playerInfos: PlayerInfo[], onStateUpdate: (state: unknown) => void): void {
        void roomId;
        this.onStateUpdate = onStateUpdate;
        this.tickCount = 0;
        _projId = 0;
        this.gameStatus = 'selecting';
        this.classSelectRemaining = CLASS_SELECT_TIMEOUT_TICKS;

        // Team assignment: first half alpha, second half beta
        const teamOf = (i: number, total: number): ArenaTeam =>
            i < Math.ceil(total / 2) ? 'alpha' : 'beta';

        this.players = playerInfos.map((info, i) => {
            const isBot = info.userId.startsWith('bot-');
            const team = teamOf(i, playerInfos.length);
            const spawn = SPAWN_POINTS[team];
            const jitter = () => Math.random() * 30 - 15;
            const p: PlayerInternal = {
                userId: info.userId,
                username: info.username,
                isBot,
                team,
                class: null,
                x: spawn.x + jitter(),
                y: spawn.y + jitter(),
                hp: 0,
                maxHp: 0,
                alive: true,
                effects: [],
                abilities: [],
                facingAngle: team === 'alpha' ? Math.PI / 4 : Math.PI + Math.PI / 4,
                inputDx: 0,
                inputDy: 0,
                hasSelectedClass: false,
                pendingDashTarget: null,
                damageMultiplier: 1,
                castingAbility: null,
            };
            return p;
        });

        // Bots auto-select class immediately
        const botClasses: ArenaClass[] = ['warrior', 'mage'];
        let botIdx = 0;
        for (const p of this.players) {
            if (p.isBot) {
                this.bots.set(p.userId, new BotController());
                this.applyClassSelection(p, botClasses[botIdx % botClasses.length]);
                botIdx++;
            }
        }

        this.powerups = POWERUP_SPAWN_LOCATIONS.map((loc, i) => ({
            id: `pw${i}`,
            type: loc.type,
            x: loc.x,
            y: loc.y,
            active: true,
            respawnRemainingTicks: 0,
        }));

        this.intervalId = setInterval(() => this.tick(), TICK_MS);
    }

    handleEvent(playerId: string, action: GameAction): void {
        const player = this.players.find(p => p.userId === playerId);
        if (!player || player.isBot) return;

        switch (action.type) {
            case 'arena:select-class': {
                const { class: cls } = action.payload as { class: ArenaClass };
                if (!player.hasSelectedClass) this.applyClassSelection(player, cls);
                break;
            }
            case 'arena:move': {
                const { dx, dy } = action.payload as { dx: number; dy: number };
                player.inputDx = Math.max(-1, Math.min(1, dx));
                player.inputDy = Math.max(-1, Math.min(1, dy));
                break;
            }
            case 'arena:aim': {
                const { angle } = action.payload as { angle: number };
                player.facingAngle = angle;
                break;
            }
            case 'arena:ability': {
                const { slot } = action.payload as { slot: ArenaAbilitySlot };
                if (this.gameStatus === 'playing') this.tryFireAbility(player, slot);
                break;
            }
        }
    }

    getState(): unknown {
        return this.buildState();
    }

    destroy(): void {
        if (this.intervalId !== null) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
    }

    // ── Class selection ──────────────────────────────────────────────────────

    private applyClassSelection(player: PlayerInternal, cls: ArenaClass): void {
        player.class = cls;
        player.hp = BASE_HP[cls];
        player.maxHp = BASE_HP[cls];
        player.hasSelectedClass = true;
        player.abilities = (['Q', 'W', 'E'] as ArenaAbilitySlot[]).map(slot => ({
            slot,
            cooldownRemainingTicks: 0,
            cooldownTotalTicks: ABILITIES[cls][slot].cooldownTicks,
        }));
    }

    // ── Ability firing ───────────────────────────────────────────────────────

    private tryFireAbility(player: PlayerInternal, slot: ArenaAbilitySlot): void {
        if (!player.class || !player.alive) return;
        if (this.hasEffect(player, 'stun') || this.hasEffect(player, 'frozen')) return;
        const abilityState = player.abilities.find(a => a.slot === slot);
        if (!abilityState || abilityState.cooldownRemainingTicks > 0) return;
        // Already winding up this slot — ignore duplicate input
        if (player.castingAbility?.slot === slot) return;

        const def = ABILITIES[player.class][slot];
        abilityState.cooldownRemainingTicks = def.cooldownTicks;

        // Start windup — ability fires after windupTicks
        player.castingAbility = {
            slot,
            remainingTicks: def.windupTicks,
            totalTicks: def.windupTicks,
            angle: player.facingAngle,
        };
    }

    private executeAbility(player: PlayerInternal, cast: ArenaCast): void {
        if (!player.class || !player.alive) return;

        const { slot, angle } = cast;
        const def = ABILITIES[player.class][slot];
        const cls = player.class;

        if (cls === 'warrior') {
            if (slot === 'Q') {
                // Melee Strike: damage to adjacent enemies
                for (const enemy of this.getEnemies(player)) {
                    const dx = enemy.x - player.x, dy = enemy.y - player.y;
                    if (dx * dx + dy * dy <= def.range * def.range) {
                        this.dealDamage(player, enemy, def.damage);
                    }
                }
            } else if (slot === 'W') {
                // Shield Bash: AoE melee stun
                for (const enemy of this.getEnemies(player)) {
                    const dx = enemy.x - player.x, dy = enemy.y - player.y;
                    if (dx * dx + dy * dy <= def.range * def.range) {
                        this.dealDamage(player, enemy, def.damage);
                        this.addEffect(enemy, 'stun', STUN_TICKS);
                    }
                }
            } else if (slot === 'E') {
                // Charge: dash in facing direction
                const tx = player.x + Math.cos(angle) * def.range;
                const ty = player.y + Math.sin(angle) * def.range;
                const resolved = resolveCircleVsObstacles(tx, ty, PLAYER_RADIUS, ARENA_OBSTACLES);
                for (const enemy of this.getEnemies(player)) {
                    if (circlesOverlap(resolved.x, resolved.y, PLAYER_RADIUS * 2, enemy.x, enemy.y, PLAYER_RADIUS)) {
                        this.dealDamage(player, enemy, def.damage);
                    }
                }
                player.pendingDashTarget = resolved;
            }
        } else if (cls === 'archer') {
            if (slot === 'Q') {
                this.spawnProjectile(player, 'arrow', angle, def);
            } else if (slot === 'W') {
                // Multi-shot: 3 arrows spread
                for (let i = -1; i <= 1; i++) {
                    this.spawnProjectile(player, 'multi-arrow', angle + i * MULTI_ARROW_SPREAD_RAD, def);
                }
            } else if (slot === 'E') {
                // Evasive Roll: dash + brief invincibility
                const tx = player.x + Math.cos(angle) * def.range;
                const ty = player.y + Math.sin(angle) * def.range;
                player.pendingDashTarget = resolveCircleVsObstacles(tx, ty, PLAYER_RADIUS, ARENA_OBSTACLES);
                this.addEffect(player, 'invincible', def.durationTicks);
            }
        } else if (cls === 'mage') {
            if (slot === 'Q') {
                this.spawnProjectile(player, 'wand-bolt', angle, def);
            } else if (slot === 'W') {
                this.spawnProjectile(player, 'fireball', angle, def);
            } else if (slot === 'E') {
                // Blink: teleport in facing direction
                const tx = player.x + Math.cos(angle) * def.range;
                const ty = player.y + Math.sin(angle) * def.range;
                player.pendingDashTarget = resolveCircleVsObstacles(tx, ty, PLAYER_RADIUS, ARENA_OBSTACLES);
            }
        }
    }

    private spawnProjectile(
        owner: PlayerInternal,
        type: ArenaProjectile['type'],
        angle: number,
        def: { damage: number; durationTicks: number; speed?: number },
    ): void {
        const speed = def.speed ?? 12;
        const radius = type === 'fireball' ? FIREBALL_RADIUS : ARROW_RADIUS;
        this.projectiles.push({
            id: nextProjId(),
            ownerId: owner.userId,
            type,
            x: owner.x + Math.cos(angle) * (PLAYER_RADIUS + radius + 2),
            y: owner.y + Math.sin(angle) * (PLAYER_RADIUS + radius + 2),
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            radius,
            damage: def.damage,
            remainingTicks: def.durationTicks,
        });
    }

    // ── Main tick ────────────────────────────────────────────────────────────

    private tick(): void {
        if (!this.onStateUpdate) return;
        this.tickCount++;

        if (this.gameStatus === 'selecting') {
            this.classSelectRemaining--;
            if (this.classSelectRemaining <= 0) {
                for (const p of this.players) {
                    if (!p.hasSelectedClass) this.applyClassSelection(p, 'warrior');
                }
            }
            if (this.players.every(p => p.hasSelectedClass)) {
                this.gameStatus = 'playing';
            }
            this.onStateUpdate(this.buildState());
            return;
        }

        // 1. Bot AI
        for (const [botId, bot] of this.bots) {
            const botPlayer = this.players.find(p => p.userId === botId)!;
            if (!botPlayer.alive) continue;
            const enemies = this.getEnemies(botPlayer);
            const result = bot.tick(botPlayer, enemies, slot => this.tryFireAbility(botPlayer, slot));
            botPlayer.inputDx = result.dx;
            botPlayer.inputDy = result.dy;
            if (result.aimAngle !== null) botPlayer.facingAngle = result.aimAngle;
        }

        // 2. Tick down effects, ability cooldowns, and cast windups
        for (const p of this.players) {
            p.effects = p.effects.filter(e => {
                e.remainingTicks--;
                if (e.remainingTicks <= 0) {
                    if (e.type === 'damage-boost') p.damageMultiplier = 1;
                    return false;
                }
                return true;
            });
            for (const ab of p.abilities) {
                if (ab.cooldownRemainingTicks > 0) ab.cooldownRemainingTicks--;
            }
            // Interrupt cast if stunned/frozen
            if (p.castingAbility && (this.hasEffect(p, 'stun') || this.hasEffect(p, 'frozen'))) {
                // Refund cooldown on interrupt
                const ab = p.abilities.find(a => a.slot === p.castingAbility!.slot);
                if (ab) ab.cooldownRemainingTicks = 0;
                p.castingAbility = null;
            }
            // Tick down windup and fire when ready
            if (p.castingAbility) {
                p.castingAbility.remainingTicks--;
                if (p.castingAbility.remainingTicks <= 0) {
                    const cast = p.castingAbility;
                    p.castingAbility = null;
                    this.executeAbility(p, cast);
                }
            }
        }

        // 3. Apply instant dashes
        for (const p of this.players) {
            if (p.pendingDashTarget) {
                p.x = p.pendingDashTarget.x;
                p.y = p.pendingDashTarget.y;
                p.pendingDashTarget = null;
            }
        }

        // 4. Move players
        for (const p of this.players) {
            if (!p.alive || !p.class) continue;
            if (this.hasEffect(p, 'stun') || this.hasEffect(p, 'frozen')) continue;

            const speed = PLAYER_SPEED[p.class];
            let dx = p.inputDx * speed;
            let dy = p.inputDy * speed;
            const mag = Math.sqrt(dx * dx + dy * dy);
            if (mag > speed) { dx = (dx / mag) * speed; dy = (dy / mag) * speed; }

            const resolved = resolveCircleVsObstacles(p.x + dx, p.y + dy, PLAYER_RADIUS, ARENA_OBSTACLES);
            p.x = resolved.x;
            p.y = resolved.y;
        }

        // 5. Move projectiles and check hits
        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            const proj = this.projectiles[i];
            proj.remainingTicks--;
            if (proj.remainingTicks <= 0) { this.projectiles.splice(i, 1); continue; }

            const nx = proj.x + proj.vx;
            const ny = proj.y + proj.vy;

            if (sweptCircleHitsObstacle(proj.x, proj.y, nx, ny, proj.radius, ARENA_OBSTACLES)) {
                this.projectiles.splice(i, 1);
                continue;
            }

            proj.x = nx;
            proj.y = ny;

            const owner = this.players.find(p => p.userId === proj.ownerId);
            if (!owner) { this.projectiles.splice(i, 1); continue; }

            let hit = false;
            for (const target of this.getEnemies(owner)) {
                if (circlesOverlap(proj.x, proj.y, proj.radius, target.x, target.y, PLAYER_RADIUS)) {
                    this.dealDamage(owner, target, proj.damage);
                    hit = true;
                    break;
                }
            }
            if (hit) this.projectiles.splice(i, 1);
        }

        // 6. Powerup collection
        for (const pw of this.powerups) {
            if (!pw.active) {
                pw.respawnRemainingTicks--;
                if (pw.respawnRemainingTicks <= 0) pw.active = true;
                continue;
            }
            for (const p of this.players) {
                if (!p.alive) continue;
                if (circlesOverlap(pw.x, pw.y, 20, p.x, p.y, PLAYER_RADIUS)) {
                    if (pw.type === 'heal') {
                        p.hp = Math.min(p.maxHp, p.hp + HEAL_AMOUNT);
                    } else {
                        this.addEffect(p, 'damage-boost', DAMAGE_BOOST_TICKS);
                        p.damageMultiplier = Math.max(p.damageMultiplier, DAMAGE_BOOST_MULT);
                    }
                    pw.active = false;
                    pw.respawnRemainingTicks = pw.type === 'heal' ? HEAL_RESPAWN_TICKS : DAMAGE_BOOST_RESPAWN_TICKS;
                    break;
                }
            }
        }

        // 7. Win condition check
        const results = this.checkWinCondition();
        if (results) {
            this.gameStatus = 'ended';
            this.onStateUpdate(this.buildState(results));
            this.destroy();
            return;
        }

        this.onStateUpdate(this.buildState());
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    private getEnemies(player: PlayerInternal): PlayerInternal[] {
        return this.players.filter(p => p.team !== player.team && p.alive) as PlayerInternal[];
    }

    private hasEffect(player: ArenaPlayer, type: ArenaEffect['type']): boolean {
        return player.effects.some(e => e.type === type);
    }

    private addEffect(player: PlayerInternal, type: ArenaEffect['type'], durationTicks: number): void {
        player.effects = player.effects.filter(e => e.type !== type);
        player.effects.push({ type, remainingTicks: durationTicks });
    }

    private dealDamage(attacker: PlayerInternal, target: PlayerInternal, baseDamage: number): void {
        if (!target.alive || this.hasEffect(target, 'invincible')) return;
        target.hp -= Math.round(baseDamage * attacker.damageMultiplier);
        if (target.hp <= 0) {
            target.hp = 0;
            target.alive = false;
        }
    }

    private checkWinCondition(): GameResult[] | null {
        const alphaAll = this.players.filter(p => p.team === 'alpha');
        const betaAll = this.players.filter(p => p.team === 'beta');
        const alphaAlive = alphaAll.filter(p => p.alive);
        const betaAlive = betaAll.filter(p => p.alive);
        // Need at least one player on each team before win condition can trigger
        if (alphaAll.length === 0 || betaAll.length === 0) return null;
        if (alphaAlive.length > 0 && betaAlive.length > 0) return null;

        const winners = alphaAlive.length > 0 ? this.players.filter(p => p.team === 'alpha') : this.players.filter(p => p.team === 'beta');
        const losers = alphaAlive.length > 0 ? this.players.filter(p => p.team === 'beta') : this.players.filter(p => p.team === 'alpha');

        const results: GameResult[] = [
            ...winners.map(p => ({ userId: p.userId, username: p.username, score: p.hp, rank: 1 })),
            ...losers.map(p => ({ userId: p.userId, username: p.username, score: 0, rank: 2 })),
        ];
        return results;
    }

    private buildState(results?: GameResult[]): ArenaState {
        // Strip internal-only fields before sending
        const players: ArenaPlayer[] = this.players.map(p => ({
            userId: p.userId,
            username: p.username,
            isBot: p.isBot,
            team: p.team,
            class: p.class,
            x: p.x,
            y: p.y,
            hp: p.hp,
            maxHp: p.maxHp,
            alive: p.alive,
            effects: p.effects,
            abilities: p.abilities,
            facingAngle: p.facingAngle,
            castingAbility: p.castingAbility,
        }));

        return {
            status: this.gameStatus,
            tickCount: this.tickCount,
            players,
            projectiles: this.projectiles,
            powerups: this.powerups,
            obstacles: ARENA_OBSTACLES,
            results,
        };
    }
}
