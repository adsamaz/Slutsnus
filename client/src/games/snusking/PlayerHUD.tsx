import { Component, For, Show } from 'solid-js';
import type { SnuskingPlayerState } from '@slutsnus/shared';

interface PlayerHUDProps {
  self: SnuskingPlayerState;
}

interface BeerMugsProps {
  count: number;
  max?: number;
}

const BeerMugs: Component<BeerMugsProps> = (props) => {
  const max = () => props.max ?? 3;
  return (
    <div class="beer-mugs">
      <For each={Array.from({ length: max() }, (_, i) => i)}>
        {(i) => (
          <span class={`beer-mug ${i < props.count ? 'filled' : 'empty'}`}>
            {i < props.count ? '\u{1F37A}' : '\u{1FAD7}'}
          </span>
        )}
      </For>
    </div>
  );
};

export const PlayerHUD: Component<PlayerHUDProps> = (props) => {
  return (
    <div class="player-hud">
      {/* Self info */}
      <div class="hud-self">
        <span class="hud-name">{props.self.username}</span>
        <span class="hud-score">{props.self.empireScore} poäng</span>
        <Show when={props.self.beer > 0}>
          <BeerMugs count={props.self.beer} />
        </Show>
        <Show when={props.self.skipNextTurn}>
          <div class="debuff-banner skip">⛔ Tur hoppad</div>
        </Show>
        <Show when={props.self.highNicEffect}>
          <div class="debuff-banner highnic">⚡ Hög-nic</div>
        </Show>
        <Show when={props.self.immunityActive}>
          <div class="debuff-banner immunity">🛡 Immunitet</div>
        </Show>
      </div>

    </div>
  );
};
