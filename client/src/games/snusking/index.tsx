import './snusking.css';
import { Component, createEffect, createSignal, Match, Show, Switch } from 'solid-js';
import type { SnuskingProjectedState } from '@slutsnus/shared';
import { Board } from './Board';
import { Hand } from './Hand';
import { OpponentStatus } from './OpponentStatus';
import { PlayerHUD } from './PlayerHUD';
import { EndScreen } from './EndScreen';
import { RevealOverlay } from './RevealOverlay';
import { ToastContainer } from '../../components/Toast';

interface SnuskingGameProps {
  state: SnuskingProjectedState;
  roomCode: string;
  onAction: (action: unknown) => void;
}

export const SnuskingGame: Component<SnuskingGameProps> = (props) => {
  const [eventFlashActive, setEventFlashActive] = createSignal(false);
  const [lastEventId, setLastEventId] = createSignal<string | null>(null);
  const [timeRemaining, setTimeRemaining] = createSignal(45);

  // Trigger flash when a new event arrives in draw phase
  createEffect(() => {
    const event = props.state.currentEvent;
    const phase = props.state.phase;
    if (phase === 'draw' && event && event.id !== lastEventId()) {
      setLastEventId(event.id);
      setEventFlashActive(true);
      setTimeout(() => setEventFlashActive(false), 2500);
    }
  });

  // Reset timer on each new planning phase
  createEffect(() => {
    if (props.state.phase === 'planning') {
      setTimeRemaining(45);
    }
  });

  const gameClass = () => {
    const base = 'snusking-game';
    const highnic =
      props.state.self.highNicEffect && props.state.phase === 'planning'
        ? ' snusking-highnic-blur'
        : '';
    return base + highnic;
  };

  return (
    <div class={gameClass()}>
      <ToastContainer />

      <Show when={props.state.status !== 'ended'}>
        <PlayerHUD
          self={props.state.self}
          opponents={props.state.opponents}
          timeRemaining={timeRemaining()}
          maxTime={45}
        />

        <Board
          phase={props.state.phase}
          deckCount={props.state.deckCount}
          discardCount={props.state.discardCount}
          turnNumber={props.state.turnNumber}
          currentEvent={props.state.currentEvent}
          eventFlashActive={eventFlashActive()}
        />

        <OpponentStatus
          opponents={props.state.opponents}
          phase={props.state.phase}
        />

        <Switch>
          <Match when={props.state.phase === 'planning'}>
            <Hand
              self={props.state.self}
              opponents={props.state.opponents}
              pendingTradeOffers={props.state.pendingTradeOffers}
              onAction={props.onAction}
            />
          </Match>
          <Match when={props.state.phase === 'reveal'}>
            <RevealOverlay
              opponents={props.state.opponents}
              selfCards={props.state.self.hand}
              currentEvent={props.state.currentEvent}
            />
          </Match>
          <Match when={props.state.phase === 'draw' || props.state.phase === 'resolve'}>
            <div class="phase-indicator">
              {props.state.phase === 'draw' ? 'Drar kort...' : 'Räknar poäng...'}
            </div>
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
