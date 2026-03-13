import { Component, Show } from 'solid-js';
import type { SnuskingEventCard } from '@slutsnus/shared';

interface BoardProps {
  phase: string;
  deckCount: number;
  discardCount: number;
  turnNumber: number;
  currentEvent: SnuskingEventCard | null;
  eventFlashActive: boolean;
}

export const Board: Component<BoardProps> = (props) => {
  return (
    <div class="snusking-board">
      <Show when={props.eventFlashActive && props.currentEvent !== null}>
        <div class="event-flash">
          <div class="event-flash-content">
            <h2 class="event-flash-title">{props.currentEvent!.name}</h2>
            <p class="event-flash-desc">
              Styrka: {props.currentEvent!.strengthAffinity.join(', ')} |{' '}
              Smak: {props.currentEvent!.flavorAffinity.join(', ')}
            </p>
          </div>
        </div>
      </Show>

      <Show when={props.currentEvent !== null && !props.eventFlashActive}>
        <div class="event-banner">
          <span class="event-banner-label">Händelse</span>
          <strong>{props.currentEvent!.name}</strong>
          <span class="event-affinity">
            {props.currentEvent!.strengthAffinity.join('/')} &middot;{' '}
            {props.currentEvent!.flavorAffinity.join('/')}
          </span>
        </div>
      </Show>

      <div class="board-info">
        <span>Runda {props.turnNumber}</span>
        <span>Kortlek: {props.deckCount}</span>
        <span>Kasserad: {props.discardCount}</span>
        <span class="board-phase">Fas: {props.phase}</span>
      </div>
    </div>
  );
};
