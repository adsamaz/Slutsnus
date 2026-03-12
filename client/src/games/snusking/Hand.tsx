import { Component, createSignal, For, Show } from 'solid-js';
import type { SnuskingCardInstance } from '@slutsnus/shared';

interface HandProps {
  cards: SnuskingCardInstance[];
  phase: string;
  onSpend: (cardIds: string[]) => void;
  onPass: () => void;
}

export const Hand: Component<HandProps> = (props) => {
  const [selectedIds, setSelectedIds] = createSignal<Set<string>>(new Set());

  const toggleCard = (instanceId: string) => {
    if (props.phase !== 'planning') return;
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(instanceId)) next.delete(instanceId);
      else next.add(instanceId);
      return next;
    });
  };

  const handleSpend = () => {
    const ids = [...selectedIds()];
    if (ids.length > 0) props.onSpend(ids);
  };

  return (
    <div class="snusking-hand">
      <For each={props.cards}>
        {(card) => (
          <div
            class={`card ${selectedIds().has(card.instanceId) ? 'selected' : ''} ${props.phase !== 'planning' ? 'disabled' : ''}`}
            onClick={() => toggleCard(card.instanceId)}
          >
            <div class="card-name">{card.name}</div>
            <div class="card-points">{card.empirePoints} pts</div>
          </div>
        )}
      </For>
      <Show when={props.phase === 'planning'}>
        <button onClick={handleSpend} disabled={selectedIds().size === 0}>
          Spend Selected
        </button>
        <button onClick={props.onPass}>Pass</button>
      </Show>
    </div>
  );
};
