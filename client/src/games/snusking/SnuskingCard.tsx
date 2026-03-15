import { Component, Show } from 'solid-js';
import type {
  SnuskingCardInstance,
  SnuskingCardStrength,
  SnuskingCardFlavor,
} from '@slutsnus/shared';

interface SnuskingCardProps {
  card?: SnuskingCardInstance;
  selected?: boolean;
  disabled?: boolean;
  staged?: boolean;
  comboLevel?: 'gold' | 'silver' | null;
  discarding?: boolean;
  sm?: boolean;
  onClick?: () => void;
}

const STRENGTH_LABELS: Record<SnuskingCardStrength, string> = {
  low: 'LOW',
  medium: 'MED',
  high: 'HIGH',
  extreme: 'XTREME',
};

// Large decorative art glyph per flavor — SVG path or unicode symbol
const FLAVOR_ART: Record<SnuskingCardFlavor, string> = {
  tobacco: '🌿',
  mint:    '❄️',
  citrus:  '🍋',
  licorice:'🍫',
  sweet:   '🍬',
};

const FLAVOR_LABELS: Record<SnuskingCardFlavor, string> = {
  tobacco: 'Tobacco',
  mint:    'Mint',
  citrus:  'Citrus',
  licorice:'Licorice',
  sweet:   'Sweet',
};

// Pip counts: low=1, medium=2, high=3, extreme=4
const STRENGTH_PIPS: Record<SnuskingCardStrength, number> = {
  low: 1, medium: 2, high: 3, extreme: 4,
};

const STRENGTH_LABELS_SHORT: Record<SnuskingCardStrength, string> = {
  low: 'LOW', medium: 'MED', high: 'HIGH', extreme: 'XTREME',
};

export const SnuskingCard: Component<SnuskingCardProps> = (props) => {
  const classes = () => {
    const parts = ['snusking-card'];
    if (!props.card) {
      parts.push('face-down');
    } else {
      if (props.card.flavor) parts.push(`card-flavor-${props.card.flavor}`);
      if (props.card.strength) parts.push(`card-strength-${props.card.strength}`);
    }
    if (props.selected) parts.push('selected');
    if (props.disabled) parts.push('disabled');
    if (props.comboLevel === 'gold') parts.push('combo-gold');
    if (props.comboLevel === 'silver') parts.push('combo-silver');
    if (props.discarding) parts.push('discarding');
    if (props.staged) parts.push('card-staged');
    if (props.card?.traded) parts.push('card-traded');
    if (props.sm) parts.push('card-sm');
    return parts.join(' ');
  };

  return (
    <div class={classes()} onClick={props.onClick}>
      <Show
        when={props.card}
        fallback={
          <div class="face-down-back">
            <div class="face-down-pattern" />
            <span class="face-down-icon">🫙</span>
            <span class="face-down-label">SNUS</span>
          </div>
        }
      >
        {(card) => (
          <div class="card-face">
            {/* Top row: name + strength badge */}
            <div class="card-header">
              <span class="card-name">{card().name}</span>
              <Show when={card().strength}>
                {(strength) => (
                  <span class={`card-strength-badge card-strength-badge--${strength()}`}>
                    {STRENGTH_LABELS_SHORT[strength()]}
                  </span>
                )}
              </Show>
            </div>

            {/* Decorative inner frame + art */}
            <div class="card-art-frame">
              <div class="card-art-inner">
                <Show when={card().flavor}>
                  {(flavor) => (
                    <span class="card-art-glyph">{FLAVOR_ART[flavor()]}</span>
                  )}
                </Show>
              </div>
            </div>

            {/* Bottom row: flavor label + pips + points */}
            <div class="card-footer">
              <Show when={card().flavor}>
                {(flavor) => (
                  <span class="card-flavor-label">{FLAVOR_LABELS[flavor()]}</span>
                )}
              </Show>
              <div class="card-footer-right">
                <Show when={card().strength}>
                  {(strength) => (
                    <div class="card-pips">
                      {Array.from({ length: STRENGTH_PIPS[strength()] }).map((_, i) => (
                        <span class={`card-pip card-pip--${strength()}`} />
                      ))}
                    </div>
                  )}
                </Show>
                <span class="card-points-badge">{card().empirePoints}</span>
              </div>
            </div>
          </div>
        )}
      </Show>
    </div>
  );
};
