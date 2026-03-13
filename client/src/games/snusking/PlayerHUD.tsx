import { Component, For, Show } from 'solid-js';
import type { SnuskingPlayerState, SnuskingOpponentState } from '@slutsnus/shared';

interface PlayerHUDProps {
  self: SnuskingPlayerState;
  opponents: SnuskingOpponentState[];
  timeRemaining: number;  // 0–45, drives the timer ring
  maxTime?: number;       // default 45
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
  const maxTime = () => props.maxTime ?? 45;

  const timerRatio = () => props.timeRemaining / maxTime();

  const timerClass = () => {
    const ratio = timerRatio();
    if (ratio > 0.5) return 'green';
    if (ratio > 0.2) return 'yellow';
    return 'red';
  };

  const circumference = 2 * Math.PI * 17; // ~106.8
  const offset = () => circumference * (1 - timerRatio());

  return (
    <div class="player-hud">
      {/* Timer */}
      <div class={`timer-ring ${timerClass()}`}>
        <svg width="44" height="44" viewBox="0 0 44 44">
          <circle cx="22" cy="22" r="17" class="timer-track" />
          <circle
            cx="22"
            cy="22"
            r="17"
            class="timer-fill"
            style={{
              'stroke-dasharray': `${circumference}`,
              'stroke-dashoffset': `${offset()}`,
            }}
          />
        </svg>
        <span class="timer-text">{Math.ceil(props.timeRemaining)}</span>
      </div>

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

      {/* Opponent pills */}
      <div class="hud-opponents">
        <For each={props.opponents}>
          {(opp) => (
            <div class="hud-entry">
              <span>{opp.username}</span>
              <span class="hud-opp-score">{opp.empireScore}</span>
              <Show when={opp.beer > 0}>
                <span style="font-size:0.78rem">{'🍺'.repeat(Math.min(opp.beer, 3))}</span>
              </Show>
            </div>
          )}
        </For>
      </div>
    </div>
  );
};
