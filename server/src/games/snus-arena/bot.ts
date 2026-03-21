import type { ArenaPlayer, ArenaAbilitySlot } from '@slutsnus/shared';
import {
    ABILITIES,
    BOT_APPROACH_RANGE,
    BOT_RETREAT_HP_THRESHOLD,
    BOT_ABILITY_JITTER,
    BOT_STRAFE_CHANGE_TICKS,
} from './constants';

type BotState = 'approach' | 'strafe' | 'retreat';

export class BotController {
    private state: BotState = 'approach';
    private strafeDir = 1;
    private strafeTick = 0;

    tick(
        bot: ArenaPlayer,
        targets: ArenaPlayer[],
        fireAbility: (slot: ArenaAbilitySlot) => void,
    ): { dx: number; dy: number; aimAngle: number | null } {
        const target = this.pickTarget(targets);
        if (!target || !bot.alive) return { dx: 0, dy: 0, aimAngle: null };

        const dx = target.x - bot.x;
        const dy = target.y - bot.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const aimAngle = Math.atan2(dy, dx);

        // State transitions
        const hpRatio = bot.hp / bot.maxHp;
        if (hpRatio < BOT_RETREAT_HP_THRESHOLD) {
            this.state = 'retreat';
        } else if (dist > BOT_APPROACH_RANGE) {
            this.state = 'approach';
        } else {
            this.state = 'strafe';
        }

        const normDx = dx / dist;
        const normDy = dy / dist;
        let moveDx = 0, moveDy = 0;

        if (this.state === 'approach') {
            moveDx = normDx; moveDy = normDy;
        } else if (this.state === 'retreat') {
            moveDx = -normDx; moveDy = -normDy;
        } else {
            this.strafeTick++;
            if (this.strafeTick >= BOT_STRAFE_CHANGE_TICKS) {
                this.strafeTick = 0;
                if (Math.random() < 0.4) this.strafeDir *= -1;
            }
            moveDx = -normDy * this.strafeDir;
            moveDy = normDx * this.strafeDir;
        }

        this.tryAbilities(bot, dist, fireAbility);

        return { dx: moveDx, dy: moveDy, aimAngle };
    }

    private pickTarget(targets: ArenaPlayer[]): ArenaPlayer | null {
        const alive = targets.filter(t => t.alive);
        if (alive.length === 0) return null;
        return alive.reduce((a, b) => a.hp < b.hp ? a : b);
    }

    private tryAbilities(bot: ArenaPlayer, dist: number, fire: (slot: ArenaAbilitySlot) => void): void {
        if (!bot.class) return;
        const defs = ABILITIES[bot.class];

        for (const slot of ['Q', 'W', 'E'] as ArenaAbilitySlot[]) {
            const def = defs[slot];
            const state = bot.abilities.find(a => a.slot === slot);
            if (!state || state.cooldownRemainingTicks > 0) continue;
            if (Math.random() < BOT_ABILITY_JITTER) continue;
            if (def.range > 0 && dist > def.range) continue;

            // Class-specific hold conditions
            if (bot.class === 'warrior' && slot === 'E' && bot.hp / bot.maxHp > 0.6) continue;
            if (bot.class === 'mage' && slot === 'E' && bot.hp / bot.maxHp > 0.35) continue;

            fire(slot);
        }
    }
}
