import { Component, For, Show } from 'solid-js';
import type { SnuskingOpponentState } from '@slutsnus/shared';
import { SnuskingCard } from './SnuskingCard';

interface OpponentStatusProps {
  opponents: SnuskingOpponentState[];
  phase: string;
}

export const OpponentStatus: Component<OpponentStatusProps> = (props) => {
  const showCards = () => props.phase === 'planning' || props.phase === 'reveal';

  return (
    <div class="opponent-status">
      <For each={props.opponents}>
        {(opponent: SnuskingOpponentState) => (
          <div class={`opponent-zone${!opponent.isConnected ? ' disconnected' : ''}`}>
            <div class="opponent-header">
              <span class="opponent-name">{opponent.username}</span>
              <span class="opponent-score">{opponent.empireScore} poäng</span>
              <Show when={opponent.beer > 0}>
                <div class="beer-icons">
                  <For each={Array.from({ length: Math.min(opponent.beer, 3) }, (_, i) => i)}>
                    {() => <span class="beer-icon" style="font-size:0.8rem">🍺</span>}
                  </For>
                </div>
              </Show>
            </div>

            <div class="opponent-commit-indicator">
              <span class={`commit-dot${opponent.hasCommitted ? ' committed' : ' pending'}`} />
              <span style={opponent.hasCommitted ? 'color:var(--color-accent)' : ''}>
                {opponent.hasCommitted ? 'Redo' : 'Tänker...'}
              </span>
            </div>

            <Show when={showCards() && opponent.handCount > 0}>
              <div class="opponent-face-down-cards">
                <For each={Array.from({ length: Math.min(opponent.handCount, 6) }, (_, i) => i)}>
                  {() => <SnuskingCard />}
                </For>
                <Show when={opponent.handCount > 6}>
                  <span style="font-size:0.7rem;color:var(--color-muted);align-self:center">
                    +{opponent.handCount - 6}
                  </span>
                </Show>
              </div>
            </Show>

            <Show when={!opponent.isConnected}>
              <div class="opponent-disconnected-label">Frånkopplad</div>
            </Show>
          </div>
        )}
      </For>
    </div>
  );
};
