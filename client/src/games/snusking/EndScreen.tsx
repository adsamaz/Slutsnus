import { Component, Show, For } from 'solid-js';
import type { GameResult, GameEndReason } from '@slutsnus/shared';

interface EndScreenProps {
  endReason: GameEndReason | null;
  results: GameResult[] | null;
  selfUserId: string;
}

export const EndScreen: Component<EndScreenProps> = (props) => {
  return (
    <div class="end-screen">
      <Show when={props.endReason === 'slut_snus'}>
        <div class="slut-snus-banner">
          <h1>SLUT SNUS</h1>
          <p>Snuset är slut. Spelet är slut.</p>
        </div>
      </Show>
      <Show when={props.endReason === 'score_threshold'}>
        <div class="winner-banner">
          <h1>Riket är byggt!</h1>
        </div>
      </Show>
      <div class="final-results">
        <h2>Slutresultat</h2>
        <For each={props.results ?? []}>
          {(result) => (
            <div class={`result-row ${result.userId === props.selfUserId ? 'self' : ''}`}>
              <span class="rank">#{result.rank}</span>
              <span class="username">{result.username}</span>
              <span class="score">{result.score} poäng</span>
            </div>
          )}
        </For>
      </div>
    </div>
  );
};
