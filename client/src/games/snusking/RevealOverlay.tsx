import { Component, For } from 'solid-js';
import type {
  SnuskingOpponentState,
  SnuskingCardInstance,
  SnuskingEventCard,
  SnuskingCardStrength,
  SnuskingCardFlavor,
} from '@slutsnus/shared';
import { SnuskingCard } from './SnuskingCard';

interface RevealOverlayProps {
  opponents: SnuskingOpponentState[];
  selfCards: SnuskingCardInstance[];
  currentEvent: SnuskingEventCard | null;
}

function comboLevel(
  card: SnuskingCardInstance,
  event: SnuskingEventCard | null,
): 'gold' | 'silver' | null {
  if (!event || !card.strength || !card.flavor) return null;
  const strMatch = event.strengthAffinity.includes(card.strength as SnuskingCardStrength);
  const flvMatch = event.flavorAffinity.includes(card.flavor as SnuskingCardFlavor);
  if (strMatch && flvMatch) return 'gold';
  if (strMatch || flvMatch) return 'silver';
  return null;
}

export const RevealOverlay: Component<RevealOverlayProps> = (props) => {
  return (
    <div class="reveal-overlay">
      <div class="reveal-row self-reveal">
        <For each={props.selfCards}>
          {(card) => (
            <div class="reveal-card-flip">
              <SnuskingCard
                card={card}
                comboLevel={comboLevel(card, props.currentEvent)}
              />
            </div>
          )}
        </For>
      </div>

      <For each={props.opponents}>
        {(opp) => (
          <div class="reveal-row opponent-reveal">
            <span class="reveal-player-label">{opp.username}</span>
            <For each={Array.from({ length: opp.handCount })}>
              {() => (
                <div class="reveal-card-flip">
                  <SnuskingCard sm />
                </div>
              )}
            </For>
          </div>
        )}
      </For>
    </div>
  );
};
