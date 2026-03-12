import { Component, Switch, Match, Show } from 'solid-js';
import type { SnuskingProjectedState } from '@slutsnus/shared';
import { Board } from './Board';
import { Hand } from './Hand';
import { OpponentStatus } from './OpponentStatus';
import { PlayerHUD } from './PlayerHUD';
import { EndScreen } from './EndScreen';

interface SnuskingGameProps {
  state: SnuskingProjectedState;
  roomCode: string;
  onAction: (action: unknown) => void;
}

export const SnuskingGame: Component<SnuskingGameProps> = (props) => {
  const handleSpend = (cardIds: string[]) => {
    props.onAction({ type: 'snusking:spend', cardIds });
  };

  const handlePass = () => {
    props.onAction({ type: 'snusking:pass' });
  };

  return (
    <div class="snusking-game">
      <Show when={props.state.status !== 'ended'}>
        <PlayerHUD self={props.state.self} opponents={props.state.opponents} />
        <Board
          phase={props.state.phase}
          deckCount={props.state.deckCount}
          discardCount={props.state.discardCount}
          turnNumber={props.state.turnNumber}
        />
        <OpponentStatus opponents={props.state.opponents} />
        <Switch>
          <Match when={props.state.phase === 'planning'}>
            <Hand
              cards={props.state.self.hand}
              phase={props.state.phase}
              onSpend={handleSpend}
              onPass={handlePass}
            />
          </Match>
          <Match when={props.state.phase === 'reveal'}>
            <div class="reveal-overlay">Cards revealed!</div>
          </Match>
          <Match when={props.state.phase === 'draw' || props.state.phase === 'resolve'}>
            <div class="phase-indicator">{props.state.phase}...</div>
          </Match>
        </Switch>
      </Show>
      <Show when={props.state.status === 'ended'}>
        <EndScreen
          endReason={props.state.endReason}
          results={props.state.results}
          selfUserId={props.state.self.userId}
        />
      </Show>
    </div>
  );
};
