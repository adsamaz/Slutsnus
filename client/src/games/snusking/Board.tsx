import { Component, For, Show } from 'solid-js';
import type { SnuskingEventCard } from '@slutsnus/shared';

interface BoardProps {
  phase: string;
  deckCount: number;
  discardCount: number;
  turnNumber: number;
  currentEvent: SnuskingEventCard | null;
  eventFlashActive: boolean;
}

const PHASE_LABELS: Record<string, string> = {
  planning: 'Planering',
  reveal:   'Avslöjning',
  draw:     'Kortdragning',
  resolve:  'Poängrakning',
};

export const Board: Component<BoardProps> = (props) => {
  const phaseLabel = () => PHASE_LABELS[props.phase] ?? props.phase;

  return (
    <div class="snusking-board">
      <Show when={props.eventFlashActive && props.currentEvent !== null}>
        <div class="event-flash">
          <div class="event-flash-content">
            <div class="event-flash-eyebrow">Ny händelse</div>
            <h2 class="event-flash-title">{props.currentEvent!.name}</h2>
            <div class="event-flash-affinities">
              <For each={props.currentEvent!.strengthAffinity}>
                {(s) => <span class="event-flash-affinity-tag">{s}</span>}
              </For>
              <For each={props.currentEvent!.flavorAffinity}>
                {(f) => <span class="event-flash-affinity-tag">{f}</span>}
              </For>
            </div>
          </div>
        </div>
      </Show>

      <Show when={props.currentEvent !== null && !props.eventFlashActive}>
        <div class="event-banner">
          <span class="event-banner-label">Händelse</span>
          <strong>{props.currentEvent!.name}</strong>
          <span class="event-affinity">
            {[
              ...props.currentEvent!.strengthAffinity,
              ...props.currentEvent!.flavorAffinity,
            ].join(' · ')}
          </span>
        </div>
      </Show>

      <div class="board-info">
        <span>Runda {props.turnNumber}</span>
        <span>Kortlek: {props.deckCount}</span>
        <span id="discard-pile-anchor">Kasserad: {props.discardCount}</span>
        <span class="board-phase">{phaseLabel()}</span>
      </div>
    </div>
  );
};
