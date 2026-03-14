import { Component, For, Show } from 'solid-js';
import type { SnuskingOpponentState } from '@slutsnus/shared';
import { SnuskingCard } from './SnuskingCard';

interface OpponentStatusProps {
  opponents: SnuskingOpponentState[];
  phase: string;
}

// Map player count + seat index to a CSS class that places the zone
// around the top arc of the table.
function seatClass(total: number, index: number): string {
  if (total === 1) return 'seat-top';
  if (total === 2) return index === 0 ? 'seat-top-left' : 'seat-top-right';
  if (total === 3) {
    const positions = ['seat-top-left', 'seat-top', 'seat-top-right'];
    return positions[index] ?? 'seat-top';
  }
  // 4-5 players: spread across an arc
  const positions = ['seat-left', 'seat-top-left', 'seat-top', 'seat-top-right', 'seat-right'];
  // center around the middle slot
  const offset = Math.floor((positions.length - total) / 2);
  return positions[offset + index] ?? 'seat-top';
}

export const OpponentStatus: Component<OpponentStatusProps> = (props) => {
  const showCards = () => props.phase === 'planning' || props.phase === 'reveal';

  return (
    <div class="opponents-area">
      <For each={props.opponents}>
        {(opponent: SnuskingOpponentState, i) => (
          <div
            class={`opponent-zone ${seatClass(props.opponents.length, i())}${!opponent.isConnected ? ' disconnected' : ''}`}
          >
            {/* Face-down cards fanned toward the table center */}
            <Show when={showCards() && opponent.handCount > 0}>
              <div class="opponent-hand-fan">
                <For each={Array.from({ length: Math.min(opponent.handCount, 7) }, (_, i) => i)}>
                  {(fanIdx) => (
                    <div
                      class="opponent-fan-card"
                      style={`--fan-i:${fanIdx};--fan-total:${Math.min(opponent.handCount, 7)}`}
                    >
                      <SnuskingCard sm />
                    </div>
                  )}
                </For>
                <Show when={opponent.handCount > 7}>
                  <span class="opponent-fan-overflow">+{opponent.handCount - 7}</span>
                </Show>
              </div>
            </Show>

            {/* Name plate */}
            <div class="opponent-nameplate">
              <span class={`commit-dot${opponent.hasCommitted ? ' committed' : ' pending'}`} />
              <span class="opponent-name">{opponent.username}</span>
              <span class="opponent-score">{opponent.empireScore}</span>
              <Show when={opponent.beer > 0}>
                <span class="opponent-beer">
                  {'🍺'.repeat(Math.min(opponent.beer, 3))}
                </span>
              </Show>
              <Show when={!opponent.isConnected}>
                <span class="opponent-disconnected-label">✕</span>
              </Show>
            </div>
          </div>
        )}
      </For>
    </div>
  );
};
