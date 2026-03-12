import { Component, For } from 'solid-js';
import type { SnuskingPlayerState, SnuskingOpponentState } from '@slutsnus/shared';

interface PlayerHUDProps {
  self: SnuskingPlayerState;
  opponents: SnuskingOpponentState[];
}

export const PlayerHUD: Component<PlayerHUDProps> = (props) => {
  return (
    <div class="player-hud">
      <div class="hud-entry self">
        <span>{props.self.username}</span>
        <span>{props.self.empireScore} pts</span>
      </div>
      <For each={props.opponents}>
        {(opp) => (
          <div class="hud-entry opponent">
            <span>{opp.username}</span>
            <span>{opp.empireScore} pts</span>
          </div>
        )}
      </For>
    </div>
  );
};
