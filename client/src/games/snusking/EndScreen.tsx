import { Component, Show, For } from 'solid-js';
import type { GameResult, GameEndReason } from '@slutsnus/shared';

interface EndScreenProps {
  endReason: GameEndReason | null;
  results: GameResult[] | null;
  selfUserId: string;
}

export const EndScreen: Component<EndScreenProps> = (props) => {
  const winner = () => props.results?.find((r) => r.rank === 1);
  const isSelfWinner = () => winner()?.userId === props.selfUserId;

  return (
    <div class="end-screen">
      <Show when={props.endReason === 'slut_snus'}>
        <div class="slut-snus-banner">
          <h1>SLUT SNUS 🫙</h1>
          <p>Snuset är slut. Spelet är slut.</p>
        </div>
      </Show>

      <Show when={props.endReason === 'score_threshold'}>
        <div class="winner-banner">
          <Show
            when={isSelfWinner()}
            fallback={
              <>
                <h1>Snusen är slut</h1>
                <p class="winner-name">{winner()?.username} vann spelet!</p>
              </>
            }
          >
            <h1>Snusen är din! 👑</h1>
            <p class="winner-name">Grattis till segern!</p>
          </Show>
        </div>
      </Show>

      <div class="final-results">
        <h2>Slutresultat</h2>
        <For each={props.results ?? []}>
          {(result) => (
            <div
              class={[
                'result-row',
                result.userId === props.selfUserId ? 'self' : '',
                result.rank === 1 ? 'winner' : '',
              ].filter(Boolean).join(' ')}
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
