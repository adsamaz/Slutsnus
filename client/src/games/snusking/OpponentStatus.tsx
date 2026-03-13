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
              <div class="beer-icons">
                <For each={Array.from({ length: Math.min(opponent.beer, 3) }, (_, i) => i)}>
                  {() => <span class="beer-icon">🍺</span>}
                </For>
              </div>
            </div>

            <div class={`opponent-commit-indicator${opponent.hasCommitted ? ' committed' : ' pending'}`}>
              <span class={`commit-dot${opponent.hasCommitted ? ' committed' : ' pending'}`} />
              {opponent.hasCommitted ? 'Redo' : 'Tänker...'}
            </div>

            <Show when={showCards()}>
              <div class="opponent-face-down-cards">
                <For each={Array.from({ length: opponent.handCount }, (_, i) => i)}>
                  {() => <SnuskingCard />}
                </For>
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
