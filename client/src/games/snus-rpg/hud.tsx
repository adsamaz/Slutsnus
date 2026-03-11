import { For, Show } from 'solid-js';
import type { SnusRpgState, SnusPlayer } from '@slutsnus/shared';

interface HudProps {
  state: SnusRpgState;
  myId: string;
}

const MAX_HP = 100;

function formatTime(ticks: number): string {
  const secs = Math.floor(ticks / 10);
  const m = Math.floor(secs / 60).toString().padStart(2, '0');
  const s = (secs % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

export default function Hud(props: HudProps) {
  const me = (): SnusPlayer | undefined =>
    Object.values(props.state.players).find((p) => p.userId === props.myId);

  const sortedPlayers = (): SnusPlayer[] =>
    Object.values(props.state.players).sort((a, b) => b.score - a.score);

  const hasBoost = () => me()?.effects.some((e) => e.type === 'nicotine_boost') ?? false;
  const hasShake = () => me()?.effects.some((e) => e.type === 'shake') ?? false;
  const hpRatio = () => (me()?.hp ?? 0) / MAX_HP;

  return (
    <div class="hud">
      <div class="hud-panel hud-topleft">
        <div class="hud-hp">
          <span class="hud-label">HP</span>
          <div class="hp-bar-bg">
            <div
              class="hp-bar-fill"
              style={{
                width: `${hpRatio() * 100}%`,
                background: hpRatio() > 0.5 ? '#39d353' : hpRatio() > 0.25 ? '#ffa657' : '#ff4444',
              }}
            />
          </div>
          <span class="hud-value">{me()?.hp ?? 0}/{MAX_HP}</span>
        </div>
        <div class="hud-row">
          <span class="hud-label">Score</span>
          <span class="hud-value">{me()?.score ?? 0}</span>
        </div>
        <div class="hud-row">
          <span class="hud-label">Snus</span>
          <span class="hud-value">{me()?.inventory.length ?? 0}</span>
        </div>
      </div>
      <div class="hud-panel hud-topright">
        <span class="hud-timer">{formatTime(props.state.timeRemainingTicks)}</span>
      </div>
      <div class="hud-panel hud-topcenter">
        <For each={sortedPlayers().slice(0, 4)}>
          {(p, i) => (
            <div class={`hud-score-row ${p.userId === props.myId ? 'me' : ''}`}>
              <span class="rank">#{i() + 1}</span>
              <span class="name">{p.username}</span>
              <span class="pts">{p.score}</span>
            </div>
          )}
        </For>
      </div>
      <div class="hud-panel hud-bottomleft">
        <Show when={hasBoost()}>
          <span class="effect-badge boost">Speed Boost</span>
        </Show>
        <Show when={hasShake()}>
          <span class="effect-badge debuff">Shake</span>
        </Show>
      </div>
      <div class="hud-panel hud-bottomcenter">
        <span class="controls-hint">WASD / Arrows = Move | Space = Attack</span>
      </div>
    </div>
  );
}
