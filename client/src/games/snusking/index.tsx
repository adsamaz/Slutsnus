import './snusking.css';
import { Component, createEffect, createSignal, onCleanup, Show, untrack } from 'solid-js';
import type { SnuskingCardInstance, SnuskingProjectedState } from '@slutsnus/shared';
import { Board } from './Board';
import { Hand } from './Hand';
import { OpponentStatus } from './OpponentStatus';
import { PlayerHUD } from './PlayerHUD';
import { EndScreen } from './EndScreen';
import { ToastContainer } from '../../components/Toast';

interface SnuskingGameProps {
  state: SnuskingProjectedState;
  roomCode: string;
  onAction: (action: unknown) => void;
}

/** Fly a card element toward the discard pile anchor, then call onDone. */
function flyCard(cardId: string, onDone: () => void) {
  const anchor = document.getElementById('discard-pile-anchor');
  const anchorRect = anchor?.getBoundingClientRect();
  const targetCX = anchorRect ? anchorRect.left + anchorRect.width / 2 : window.innerWidth / 2;
  const targetCY = anchorRect ? anchorRect.top + anchorRect.height / 2 : 0;
  const pileCardSize = anchorRect ? Math.min(anchorRect.width, anchorRect.height) : 0;

  const wrapper = document.querySelector<HTMLElement>(`[data-instance-id="${cardId}"]`);
  const el = (wrapper?.firstElementChild as HTMLElement | null) ?? wrapper;
  if (!el) { onDone(); return; }

  const rect = el.getBoundingClientRect();
  const clone = el.cloneNode(true) as HTMLElement;
  clone.classList.remove('selected', 'disabled', 'discarding');
  clone.style.cssText = `
    position:fixed;left:${rect.left}px;top:${rect.top}px;
    width:${rect.width}px;height:${rect.height}px;
    margin:0;transform:none;z-index:500;pointer-events:none;
    transform-origin:center center;will-change:transform,opacity;
    border-radius:10px;box-shadow:0 8px 24px rgba(0,0,0,0.6);
  `;
  document.body.appendChild(clone);

  const dx = targetCX - (rect.left + rect.width / 2);
  const dy = targetCY - (rect.top + rect.height / 2);
  const endScale = pileCardSize > 0 ? pileCardSize / rect.height : 0.45;
  const rot = 12;

  const anim = clone.animate(
    [
      { transform: 'translate(0,0) scale(1) rotate(0deg)', opacity: '1', offset: 0 },
      { transform: `translate(${dx * 0.5}px,${dy * 0.5 - 30}px) scale(${(1 + endScale) / 2}) rotate(${rot * 0.5}deg)`, opacity: '1', offset: 0.45 },
      { transform: `translate(${dx}px,${dy}px) scale(${endScale}) rotate(${rot}deg)`, opacity: '0.15', offset: 0.85 },
      { transform: `translate(${dx}px,${dy}px) scale(${endScale}) rotate(${rot}deg)`, opacity: '0', offset: 1 },
    ],
    { duration: 420, easing: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)', fill: 'both' },
  );
  anim.onfinish = () => { clone.remove(); onDone(); };
}

/** Fly a face-down card clone FROM originRect TO the discard pile anchor. */
function flyFaceDownToDiscard(originRect: DOMRect) {
  const anchor = document.getElementById('discard-pile-anchor');
  if (!anchor) return;
  const anchorRect = anchor.getBoundingClientRect();
  const targetCX = anchorRect.left + anchorRect.width / 2;
  const targetCY = anchorRect.top + anchorRect.height / 2;
  const cardH = anchorRect.height * 0.8;
  const cardW = cardH * 0.7;

  const clone = document.createElement('div');
  clone.style.cssText = `
    position:fixed;
    left:${originRect.left + originRect.width / 2 - cardW / 2}px;
    top:${originRect.top + originRect.height / 2 - cardH / 2}px;
    width:${cardW}px;height:${cardH}px;
    background:linear-gradient(135deg,#1a4a2e 0%,#0d2618 100%);
    border:2px solid rgba(255,255,255,0.15);
    border-radius:10px;box-shadow:0 8px 24px rgba(0,0,0,0.6);
    z-index:500;pointer-events:none;
    transform-origin:center center;will-change:transform,opacity;
  `;
  document.body.appendChild(clone);

  const dx = targetCX - (originRect.left + originRect.width / 2);
  const dy = targetCY - (originRect.top + originRect.height / 2);
  const endScale = Math.min(anchorRect.width, anchorRect.height) / cardH;

  const anim = clone.animate(
    [
      { transform: 'translate(0,0) scale(1) rotate(0deg)', opacity: '1', offset: 0 },
      { transform: `translate(${dx * 0.5}px,${dy * 0.5 - 20}px) scale(${(1 + endScale) / 2}) rotate(6deg)`, opacity: '1', offset: 0.45 },
      { transform: `translate(${dx}px,${dy}px) scale(${endScale}) rotate(12deg)`, opacity: '0.2', offset: 0.85 },
      { transform: `translate(${dx}px,${dy}px) scale(${endScale}) rotate(12deg)`, opacity: '0', offset: 1 },
    ],
    { duration: 400, easing: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)', fill: 'both' },
  );
  anim.onfinish = () => clone.remove();
}

/** Fly a face-down card clone FROM originRect TO the card element in hand, then call onDone. */
function flyCardFromOrigin(originRect: DOMRect, destCardId: string, onDone: () => void) {
  const wrapper = document.querySelector<HTMLElement>(`[data-instance-id="${destCardId}"]`);
  const destEl = (wrapper?.firstElementChild as HTMLElement | null) ?? wrapper;
  if (!destEl) { onDone(); return; }

  const destRect = destEl.getBoundingClientRect();
  const originCX = originRect.left + originRect.width / 2;
  const originCY = originRect.top + originRect.height / 2;
  const destCX = destRect.left + destRect.width / 2;
  const destCY = destRect.top + destRect.height / 2;

  const clone = destEl.cloneNode(true) as HTMLElement;
  clone.style.cssText = `
    position:fixed;left:${originCX - destRect.width / 2}px;top:${originCY - destRect.height / 2}px;
    width:${destRect.width}px;height:${destRect.height}px;
    margin:0;transform:none;z-index:500;pointer-events:none;
    transform-origin:center center;will-change:transform,opacity;
    border-radius:10px;box-shadow:0 8px 24px rgba(0,0,0,0.6);
  `;
  document.body.appendChild(clone);

  const dx = destCX - originCX;
  const dy = destCY - originCY;

  const anim = clone.animate(
    [
      { transform: 'translate(0,0) scale(0.6)', opacity: '0', offset: 0 },
      { transform: `translate(${dx * 0.5}px,${dy * 0.5}px) scale(0.8)`, opacity: '1', offset: 0.3 },
      { transform: `translate(${dx}px,${dy}px) scale(1)`, opacity: '1', offset: 1 },
    ],
    { duration: 380, easing: 'cubic-bezier(0.22, 1, 0.36, 1)', fill: 'forwards' },
  );
  anim.onfinish = () => { clone.remove(); onDone(); };
}

export const SnuskingGame: Component<SnuskingGameProps> = (props) => {
  const [eventFlashActive, setEventFlashActive] = createSignal(false);
  const [lastEventId, setLastEventId] = createSignal<string | null>(null);
  const [timeRemaining, setTimeRemaining] = createSignal(45);

  // Drag state — lifted so Board (play drop) and OpponentStatus (trade drop) can receive drops
  const [draggingCardId, setDraggingCardId] = createSignal<string | null>(null);
  const [draggingSpentId, setDraggingSpentId] = createSignal(false);
  // When a spent snus is dropped on an opponent, Hand shows the decoy picker
  const [decoyTarget, setDecoyTarget] = createSignal<{ opponentId: string } | null>(null);
  // Local discard pile preview (optimistic, cleared when turn ends)
  const [stagedTopCard, setStagedTopCard] = createSignal<SnuskingCardInstance | null>(null);
  // Track hand IDs to detect newly arrived cards for fly-in animation
  const [prevHandIds, setPrevHandIds] = createSignal<Set<string>>(new Set());
  // Track last seen discard top to detect opponent plays
  const [prevDiscardTopId, setPrevDiscardTopId] = createSignal<string | null>(null);
  // Track last known active player to identify who just played when discardTop changes
  const [prevActivePlayerId, setPrevActivePlayerId] = createSignal<string | null>(null);

  // Trigger flash when a new event arrives
  createEffect(() => {
    const event = props.state.currentEvent;
    if (event && event.id !== lastEventId()) {
      setLastEventId(event.id);
      setEventFlashActive(true);
      setTimeout(() => setEventFlashActive(false), 2500);
    }
  });

  // Reset and tick timer for this player's turn; interval is always cleaned up when turn ends
  createEffect(() => {
    const isMyTurn = props.state.phase === 'playing' && props.state.activePlayerId === props.state.self.userId;
    if (!isMyTurn) return;
    setStagedTopCard(null);
    setTimeRemaining(45);
    const id = setInterval(() => {
      setTimeRemaining((t) => Math.max(0, t - 1));
    }, 1000);
    onCleanup(() => clearInterval(id));
  });

  // Animate a face-down card from opponent zone to discard pile when an opponent plays
  createEffect(() => {
    const top = props.state.discardTop;
    const topId = top?.instanceId ?? null;
    const prevTop = untrack(prevDiscardTopId);
    const whoJustPlayed = untrack(prevActivePlayerId);
    setPrevDiscardTopId(topId);
    setPrevActivePlayerId(props.state.activePlayerId);
    // Only fire when discardTop changes to a new card played by an opponent
    if (!top || topId === prevTop) return;
    if (!whoJustPlayed || whoJustPlayed === props.state.self.userId) return;

    const originEl = document.querySelector(`[data-opponent-id="${whoJustPlayed}"]`) as HTMLElement | null
      ?? document.querySelector('.opponents-area') as HTMLElement | null;
    const originRect = originEl
      ? originEl.getBoundingClientRect()
      : new DOMRect(window.innerWidth / 2, 0, 60, 90);

    flyFaceDownToDiscard(originRect);
  });

  // Detect newly arrived cards and animate them from their origin
  createEffect(() => {
    const currentHand = props.state.self.hand;
    const ids = untrack(prevHandIds);
    const newCards = currentHand.filter(c => !ids.has(c.instanceId));
    setPrevHandIds(new Set(currentHand.map(c => c.instanceId)));
    if (newCards.length === 0) return;

    for (const card of newCards) {
      let originEl: Element | null;
      if (card.traded) {
        // Find the opponent zone of the sender
        const offer = props.state.pendingTradeOffers?.find(
          o => o.toPlayerId === props.state.self.userId,
        );
        const senderId = offer?.fromPlayerId;
        originEl = senderId
          ? (document.querySelector(`[data-opponent-id="${senderId}"]`) ?? document.querySelector('.opponents-area'))
          : document.querySelector('.opponents-area');
      } else {
        originEl = document.querySelector('.table-deck');
      }

      const originRect = originEl
        ? originEl.getBoundingClientRect()
        : new DOMRect(window.innerWidth / 2, 0, 60, 90);

      // Small delay so Solid has rendered the card element before we query it
      setTimeout(() => flyCardFromOrigin(originRect, card.instanceId, () => {}), 30);
    }
  });

  const gameClass = () => {
    const base = 'snusking-game';
    const highnic = props.state.self.highNicEffect ? ' snusking-highnic-blur' : '';
    return base + highnic;
  };

  // Called by Board when a card is dropped on the discard pile — send immediately
  const handlePlayDrop = () => {
    const cardId = draggingCardId();
    if (!cardId) return;
    const card = props.state.self.hand.find(c => c.instanceId === cardId) ?? null;
    setDraggingCardId(null);
    flyCard(cardId, () => {
      if (card) setStagedTopCard(card);
      props.onAction({ type: 'snusking:spend', cardIds: [cardId] });
    });
  };

  // Called when the player presses Pass
  const handleDone = () => {
    setStagedTopCard(null);
    props.onAction({ type: 'snusking:pass' });
  };

  // Called by OpponentStatus when a hand card is dropped on an opponent
  const handleTradeDrop = (opponentId: string) => {
    const cardId = draggingCardId();
    if (!cardId) return;
    setDraggingCardId(null);
    props.onAction({ type: 'snusking:trade-offer', targetPlayerId: opponentId, cardInstanceId: cardId });
  };

  // Called by OpponentStatus when a spent snus is dropped on an opponent
  const handleDecoyDrop = (opponentId: string) => {
    if (!draggingSpentId()) return;
    setDraggingSpentId(false);
    setDecoyTarget({ opponentId });
  };

  return (
    <div class={gameClass()}>
      <ToastContainer />

      <Show when={props.state.status !== 'ended'}>
        {/* Opponents — each zone is a trade drop target */}
        <OpponentStatus
          opponents={props.state.opponents}
          phase={props.state.phase}
          draggingCardId={draggingCardId()}
          draggingSpentId={draggingSpentId()}
          onTradeDrop={handleTradeDrop}
          onDecoyDrop={handleDecoyDrop}
        />

        {/* Center table — discard pile is the play drop target */}
        <Board
          phase={props.state.phase}
          deckCount={props.state.deckCount}
          discardCount={props.state.discardCount}
          discardTop={stagedTopCard() ?? props.state.discardTop}
          turnNumber={props.state.turnNumber}
          currentEvent={props.state.currentEvent}
          eventFlashActive={eventFlashActive()}
          timeRemaining={timeRemaining()}
          maxTime={45}
          draggingCardId={draggingCardId()}
          onPlayDrop={handlePlayDrop}
        />

        {/* Player's hand at the bottom */}
        <Hand
          self={props.state.self}
          opponents={props.state.opponents}
          isMyTurn={props.state.activePlayerId === props.state.self.userId}
          onAction={props.onAction}
          onDone={handleDone}
          draggingCardId={draggingCardId()}
          draggingSpentId={draggingSpentId()}
          decoyTarget={decoyTarget()}
          onDragCardStart={setDraggingCardId}
          onDragCardEnd={() => setDraggingCardId(null)}
          onDragSpentStart={() => setDraggingSpentId(true)}
          onDragSpentEnd={() => setDraggingSpentId(false)}
          onDecoyCancel={() => setDecoyTarget(null)}
          onDecoyPick={(decoyCardId) => {
            const dt = decoyTarget();
            if (!dt) return;
            props.onAction({
              type: 'snusking:trade-offer-decoy',
              targetPlayerId: dt.opponentId,
              decoyCardInstanceId: decoyCardId,
            });
            setDecoyTarget(null);
          }}
        />

        {/* Player HUD pinned to bottom */}
        <PlayerHUD self={props.state.self} />
      </Show>

      <Show when={props.state.status === 'ended'}>
        <EndScreen
          endReason={props.state.endReason}
          results={props.state.results}
          selfUserId={props.state.self.userId}
        />
      </Show>
    </div>
  );
};
