import { Component } from 'solid-js';

interface BoardProps {
  phase: string;
  deckCount: number;
  discardCount: number;
  turnNumber: number;
}

export const Board: Component<BoardProps> = (props) => {
  return (
    <div class="snusking-board">
      <div class="board-info">
        <span>Turn {props.turnNumber}</span>
        <span>Phase: {props.phase}</span>
        <span>Deck: {props.deckCount} cards</span>
        <span>Discard: {props.discardCount} cards</span>
      </div>
    </div>
  );
};
