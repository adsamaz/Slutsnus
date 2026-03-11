import { For } from 'solid-js';
import Button from '../../components/Button';
import type { SnusPlayer } from '@slutsnus/shared';

interface EndScreenProps {
  players: Record<string, SnusPlayer>;
  myId: string;
  onPlayAgain: () => void;
  onLeaderboard: () => void;
}

export default function EndScreen(props: EndScreenProps) {
  const sorted = () => Object.values(props.players).sort((a, b) => b.score - a.score);
  const winner = () => sorted()[0];
  const isWinner = () => winner()?.userId === props.myId;

  return (
    <div class="end-screen-overlay">
      <div class="end-screen">
        <h1 class="end-title">{isWinner() ? 'You Win!' : 'Game Over'}</h1>
        <p class="end-winner">
          {isWinner() ? 'You are the Snus King!' : `${winner()?.username ?? '?'} is the Snus King!`}
        </p>
        <table class="end-scoreboard">
          <thead>
            <tr>
              <th>#</th>
              <th>Player</th>
              <th>Score</th>
              <th>Snus</th>
            </tr>
          </thead>
          <tbody>
            <For each={sorted()}>
              {(p, i) => (
                <tr class={p.userId === props.myId ? 'highlight-row' : ''}>
                  <td>{i() + 1}</td>
                  <td>{p.username}</td>
                  <td>{p.score}</td>
                  <td>{p.inventory.length}</td>
                </tr>
              )}
            </For>
          </tbody>
        </table>
        <div class="end-actions">
          <Button class="btn btn-primary" onClick={props.onPlayAgain}>
            Play Again
          </Button>
          <Button class="btn btn-secondary" onClick={props.onLeaderboard}>
            Leaderboard
          </Button>
        </div>
      </div>
    </div>
  );
}
