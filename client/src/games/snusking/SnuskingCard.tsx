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
  comboLevel?: 'gold' | 'silver' | null;
  discarding?: boolean;
  onClick?: () => void;
}

const STRENGTH_LABELS: Record<SnuskingCardStrength, string> = {
  low: 'LOW',
  medium: 'MED',
  high: 'HIGH',
  extreme: 'XTREME',
};

const FLAVOR_EMOJIS: Record<SnuskingCardFlavor, string> = {
  tobacco: '\u{1F33F}',
  mint: '\u{2744}\u{FE0F}',
  citrus: '\u{1F34B}',
  licorice: '\u{1F36B}',
  sweet: '\u{1F36C}',
};

const FLAVOR_LABELS: Record<SnuskingCardFlavor, string> = {
  tobacco: 'TOBACCO',
  mint: 'MINT',
  citrus: 'CITRUS',
  licorice: 'LICORICE',
  sweet: 'SWEET',
};

export const SnuskingCard: Component<SnuskingCardProps> = (props) => {
  const classes = () => {
    const parts = ['snusking-card'];
    if (!props.card) parts.push('face-down');
    if (props.selected) parts.push('selected');
    if (props.disabled) parts.push('disabled');
    if (props.comboLevel === 'gold') parts.push('combo-gold');
    if (props.comboLevel === 'silver') parts.push('combo-silver');
    if (props.discarding) parts.push('discarding');
    return parts.join(' ');
  };

  return (
    <div class={classes()} onClick={props.onClick}>
      <Show
        when={props.card}
        fallback={
          <div class="face-down-back">
            <span class="face-down-icon">{'\u{1FAD9}'}</span>
            <span class="face-down-label">SNUS</span>
          </div>
        }
      >
        {(card) => (
          <>
            <div class="card-name">{card().name}</div>
            <Show when={card().strength}>
              {(strength) => (
                <div class="card-strength-row">
                  <span class={`strength-dot strength-${strength()}`}>&#9679;</span>
                  <span class={`strength-badge strength-${strength()}`}>
                    {STRENGTH_LABELS[strength()]}
                  </span>
                </div>
              )}
            </Show>
            <Show when={card().flavor}>
              {(flavor) => (
                <div class="card-flavor-row">
                  <span class="flavor-emoji">{FLAVOR_EMOJIS[flavor()]}</span>
                  <span class="flavor-badge">{FLAVOR_LABELS[flavor()]}</span>
                </div>
              )}
            </Show>
            <div class="card-points">{card().empirePoints} pts</div>
          </>
        )}
      </Show>
    </div>
  );
};
