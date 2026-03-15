import { Component, createSignal, For, Show } from 'solid-js';
import type { SnuskingCardInstance, SnuskingEventCard } from '@slutsnus/shared';
import { SnuskingCard } from './SnuskingCard';

interface BoardProps {
  phase: string;
  deckCount: number;
  discardCount: number;
  discardTop: SnuskingCardInstance | null;
  turnNumber: number;
  currentEvent: SnuskingEventCard | null;
  eventFlashActive: boolean;
  timeRemaining: number;
  maxTime?: number;
  // Drag-and-drop
  draggingCardId?: string | null;
  onPlayDrop?: () => void;
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
  playing: 'Pågående',
  ended:   'Avslutad',
};

export const Board: Component<BoardProps> = (props) => {
  const [hoverPile, setHoverPile] = createSignal(false);

  const phaseLabel = () => PHASE_LABELS[props.phase] ?? props.phase;
  const maxTime = () => props.maxTime ?? 45;
  const timerRatio = () => props.timeRemaining / maxTime();
  const timerClass = () => {
    const r = timerRatio();
    if (r > 0.5) return 'green';
    if (r > 0.2) return 'yellow';
    return 'red';
  };
  const circumference = 2 * Math.PI * 24;
  const offset = () => circumference * (1 - timerRatio());

  const isDraggingCard = () => !!props.draggingCardId;

  const onPileDragOver = (e: DragEvent) => {
    if (!isDraggingCard()) return;
    e.preventDefault();
    setHoverPile(true);
  };
  const onPileDragLeave = () => setHoverPile(false);
  const onPileDrop = (e: DragEvent) => {
    e.preventDefault();
    setHoverPile(false);
    props.onPlayDrop?.();
  };

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

        {/* Piles row: small deck on left, large discard centered */}
        <div class="table-piles">
          {/* Deck — small, left edge */}
          <div class="table-deck">
            <div class="deck-stack">
              <div class="deck-card deck-card--3" />
              <div class="deck-card deck-card--2" />
              <div class="deck-card deck-card--1" />
            </div>
            <span class="pile-label">{props.deckCount} kort</span>
          </div>

          {/* Discard pile — large, centered, drop target */}
          <div
            class={`discard-pile${isDraggingCard() ? ' drop-active' : ''}${hoverPile() ? ' drop-hover' : ''}`}
            id="discard-pile-anchor"
            onDragOver={onPileDragOver}
            onDragLeave={onPileDragLeave}
            onDrop={onPileDrop}
          >
            <Show when={props.discardCount > 1}>
              <div class="discard-pile-card discard-pile-card--back2" />
            </Show>
            <Show
              when={props.discardTop}
              fallback={
                <div class="discard-pile-card discard-pile-card--empty">
                  <span class="discard-pile-icon">{'\u{1FAD9}'}</span>
                </div>
              }
            >
              {(top) => (
                <div class="discard-pile-top">
                  <SnuskingCard card={top()} />
                </div>
              )}
            </Show>
            <span class="pile-label">{props.discardCount} spelade</span>
          </div>

          {/* Spacer to balance deck on left and keep discard centered */}
          <div class="table-piles-spacer" />
        </div>

        {/* Round + phase info at the bottom of the circle */}
        <div class="table-meta">
          <span class="table-turn">Runda {props.turnNumber}</span>
          <span class="table-phase-badge">{phaseLabel()}</span>
          <Show when={props.phase === 'playing'}>
            <div class={`timer-ring timer-ring--center ${timerClass()}`}>
              <svg width="56" height="56" viewBox="0 0 56 56">
                <circle cx="28" cy="28" r="24" class="timer-track" />
                <circle
                  cx="28"
                  cy="28"
                  r="24"
                  class="timer-fill"
                  style={{
                    'stroke-dasharray': `${circumference}`,
                    'stroke-dashoffset': `${offset()}`,
                  }}
                />
              </svg>
              <span class="timer-text">{Math.ceil(props.timeRemaining)}</span>
            </div>
          </Show>
        </div>
      </div>
    </div>
  );
};
