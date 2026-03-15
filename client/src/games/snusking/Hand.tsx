import { Component, For, Show } from 'solid-js';
import type {
  SnuskingCardInstance,
  SnuskingOpponentState,
  SnuskingPlayerState,
} from '@slutsnus/shared';
import { SnuskingCard } from './SnuskingCard';
import bjudlocketImg from '../../assets/bjudlocket.png';

interface HandProps {
  self: SnuskingPlayerState;
  opponents: SnuskingOpponentState[];
  isMyTurn: boolean;
  onAction: (action: unknown) => void;
  onDone: () => void;
  // Drag state owned by parent
  draggingCardId: string | null;
  draggingSpentId: boolean;
  onDragCardStart: (id: string) => void;
  onDragCardEnd: () => void;
  onDragSpentStart: () => void;
  onDragSpentEnd: () => void;
  // Decoy picker state owned by parent
  decoyTarget: { opponentId: string } | null;
  onDecoyPick: (cardId: string) => void;
  onDecoyCancel: () => void;
}

export const Hand: Component<HandProps> = (props) => {
  // Disable interactions when not your turn, already committed, or skipping
  const isActionDisabled = () => !props.isMyTurn || props.self.hasCommitted || props.self.skipNextTurn;

  const onCardDragStart = (e: DragEvent, card: SnuskingCardInstance) => {
    if (isActionDisabled()) { e.preventDefault(); return; }
    e.dataTransfer!.effectAllowed = 'move';
    props.onDragCardStart(card.instanceId);
  };

  const onSpentDragStart = (e: DragEvent) => {
    if (isActionDisabled()) { e.preventDefault(); return; }
    e.dataTransfer!.effectAllowed = 'move';
    props.onDragSpentStart();
  };

  return (
    <div class={`snusking-hand${props.self.highNicEffect ? ' highnic-blur' : ''}`}>
      <Show when={props.self.highNicEffect}>
        <div class="debuff-banner highnic">Hög nikotineffekt. Fokus störd.</div>
      </Show>
      <Show when={props.self.skipNextTurn}>
        <div class="debuff-banner skip">Din tur hoppas över. Du kan inte spela denna runda.</div>
      </Show>
      <Show when={!props.isMyTurn && !props.self.hasCommitted}>
        <div class="debuff-banner waiting">Väntar på din tur...</div>
      </Show>


      {/* Decoy picker: shown after dropping a spent snus on an opponent */}
      <Show when={props.decoyTarget !== null}>
        <div class="decoy-picker">
          <p class="decoy-picker-title">
            Välj vilket kort{' '}
            {props.opponents.find(o => o.userId === props.decoyTarget!.opponentId)?.username}{' '}
            faktiskt får:
          </p>
          <div class="hand-cards">
            <For each={props.self.hand}>
              {(card: SnuskingCardInstance) => (
                <div data-instance-id={card.instanceId} style="display:contents">
                  <SnuskingCard card={card} onClick={() => props.onDecoyPick(card.instanceId)} />
                </div>
              )}
            </For>
          </div>
          <button class="hand-btn pass" onClick={props.onDecoyCancel}>Avbryt</button>
        </div>
      </Show>

      {/* Hand cards */}
      <div class="hand-cards-area">
        <div class="hand-cards">
          <For each={props.self.hand}>
            {(card: SnuskingCardInstance) => (
              <div
                data-instance-id={card.instanceId}
                style="display:contents"
                draggable={!isActionDisabled()}
                onDragStart={(e) => onCardDragStart(e, card)}
                onDragEnd={props.onDragCardEnd}
              >
                <SnuskingCard
                  card={card}
                  disabled={isActionDisabled()}
                  selected={props.draggingCardId === card.instanceId}
                />
              </div>
            )}
          </For>
        </div>

        <div class="hand-actions">
          <button
            class="hand-btn done"
            disabled={isActionDisabled()}
            onClick={props.onDone}
          >
            Passa
          </button>
        </div>
      </div>

      {/* Spent snus pile */}
      <Show when={props.self.spentSnus > 0}>
        <div class="spent-snus-area">
          <span class="spent-snus-label">Bjudlocket</span>
          <div class="spent-snus-pile">
            <div
              class="spent-snus-card-wrapper"
              draggable={!isActionDisabled()}
              onDragStart={onSpentDragStart}
              onDragEnd={props.onDragSpentEnd}
              title="Bjudlocket — dra till motståndare för fejkhandel"
            >
              <div class="bjudlocket-token">
                <img src={bjudlocketImg} class="bjudlocket-img" alt="Bjudlocket" />
              </div>
              <span class="spent-snus-count">{props.self.spentSnus}</span>
            </div>
          </div>
        </div>
      </Show>
    </div>
  );
};
