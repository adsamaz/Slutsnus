import { Component, Show, For } from 'solid-js';
import type { GameResult, GameEndReason } from '@slutsnus/shared';

interface EndScreenProps {
  endReason: GameEndReason | null;
  results: GameResult[] | null;
  selfUserId: string;
}

export const EndScreen: Component<EndScreenProps> = (props) => {
  const winner = () => props.results?.find((r) => r.rank === 1);

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
          <h1>{winner()?.userId === props.selfUserId ? 'Du har byggt riket! 👑' : 'Riket är byggt!'}</h1>
          <Show when={winner()?.userId !== props.selfUserId}>
            <p class="winner-name">{winner()?.username} vann!</p>
          </Show>
        </div>
      </Show>

      <div class="final-results">
        <h2>Slutresultat</h2>
        <For each={props.results ?? []}>
          {(result) => (
            <div
              class={`result-row${result.userId === props.selfUserId ? ' self' : ''}${result.rank === 1 ? ' winner' : ''}`}
            >
              <span class="rank">#{result.rank}</span>
              <span class="username">{result.username}</span>
              <span class="score">{result.score} poäng</span>
            </div>
          )}
        </For>
      </div>

      <button class="btn btn-primary" onClick={() => (window.location.href = '/')}>
        Tillbaka till lobbyn
      </button>
    </div>
  );
};
