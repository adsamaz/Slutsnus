import { Component, For } from 'solid-js';
import type { SnuskingOpponentState } from '@slutsnus/shared';

interface OpponentStatusProps {
  opponents: SnuskingOpponentState[];
}

export const OpponentStatus: Component<OpponentStatusProps> = (props) => {
  return (
    <div class="opponent-status">
      <For each={props.opponents}>
        {(opponent) => (
          <div class={`opponent-zone ${!opponent.isConnected ? 'disconnected' : ''}`}>
            <span class="opponent-name">{opponent.username}</span>
            <span class="opponent-score">{opponent.empireScore} pts</span>
            <span class="opponent-hand">{opponent.handCount} cards</span>
            <span class={`commit-status ${opponent.hasCommitted ? 'committed' : 'pending'}`}>
              {opponent.hasCommitted ? 'Ready' : 'Thinking...'}
            </span>
          </div>
        )}
      </For>
    </div>
  );
};
