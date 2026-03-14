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

const FLAVOR_EMOJI: Record<string, string> = {
  tobacco:  '🍂',
  mint:     '🌿',
  citrus:   '🍋',
  licorice: '⚫',
  sweet:    '🍬',
};

const STRENGTH_EMOJI: Record<string, string> = {
  low:     '🟢',
  medium:  '🟠',
  high:    '🔥',
  extreme: '💀',
};

function getEventEmoji(event: { strengthAffinity: string[]; flavorAffinity: string[] }): string {
  if (event.strengthAffinity.includes('extreme')) return '💀';
  if (event.strengthAffinity.includes('high'))    return '🔥';
  if (event.flavorAffinity[0]) return FLAVOR_EMOJI[event.flavorAffinity[0]] ?? '🃏';
  if (event.strengthAffinity[0]) return STRENGTH_EMOJI[event.strengthAffinity[0]] ?? '🃏';
  return '🃏';
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
    <div class="table-center-area">
      {/* Event flash overlay */}
      <Show when={props.eventFlashActive && props.currentEvent !== null}>
        <div class="event-flash">
          <div class="event-flash-bg-ring" />
          <div class="event-flash-bg-ring event-flash-bg-ring--2" />
          <div class="event-flash-emoji">{getEventEmoji(props.currentEvent!)}</div>
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

      {/* The round table surface */}
      <div class="table-surface">
        {/* Event ribbon above pile */}
        <Show when={props.currentEvent !== null && !props.eventFlashActive}>
          <div class="table-event-badge">
            <span class="table-event-icon">{getEventEmoji(props.currentEvent!)}</span>
            <span class="table-event-name">{props.currentEvent!.name}</span>
          </div>
        </Show>

        {/* Center content: deck + discard side by side */}
        <div class="table-piles">
          {/* Deck */}
          <div class="table-deck">
            <div class="deck-stack">
              <div class="deck-card deck-card--3" />
              <div class="deck-card deck-card--2" />
              <div class="deck-card deck-card--1" />
            </div>
            <span class="pile-label">{props.deckCount} kort</span>
          </div>

          {/* Discard pile — visual anchor for card-fly animation */}
          <div class="discard-pile" id="discard-pile-anchor">
            <Show when={props.discardCount > 1}>
              <div class="discard-pile-card discard-pile-card--back2" />
            </Show>
            <Show
              when={props.discardCount > 0}
              fallback={
                <div class="discard-pile-card discard-pile-card--empty">
                  <span class="discard-pile-icon">{'\u{1FAD9}'}</span>
                </div>
              }
            >
              <div class="discard-pile-card discard-pile-card--back1" />
            </Show>
            <span class="pile-label">{props.discardCount} spelade</span>
          </div>
        </div>

        {/* Round + phase info at the bottom of the circle */}
        <div class="table-meta">
          <span class="table-turn">Runda {props.turnNumber}</span>
          <span class="table-phase-badge">{phaseLabel()}</span>
        </div>
      </div>
    </div>
  );
};
