import { Component, createEffect, createSignal, For, Show } from 'solid-js';
import type {
  SnuskingCardInstance,
  SnuskingOpponentState,
  SnuskingPlayerState,
  SnuskingTradeOffer,
} from '@slutsnus/shared';
import Modal from '../../components/Modal';
import { showToast } from '../../components/Toast';
import { SnuskingCard } from './SnuskingCard';

interface HandProps {
  self: SnuskingPlayerState;
  opponents: SnuskingOpponentState[];
  pendingTradeOffers: SnuskingTradeOffer[];
  onAction: (action: unknown) => void;
}

const shownOffers = new Set<string>();

export const Hand: Component<HandProps> = (props) => {
  const [activeTab, setActiveTab] = createSignal<'play' | 'sabotage' | 'trade'>('play');
  const [selectedIds, setSelectedIds] = createSignal<Set<string>>(new Set());
  const [saboTarget, setSaboTarget] = createSignal<string | null>(null);
  const [tradeCardId, setTradeCardId] = createSignal<string | null>(null);
  const [tradeTarget, setTradeTarget] = createSignal<string | null>(null);
  const [tradeFakeName, setTradeFakeName] = createSignal<string>('');
  const [tradeModalOpen, setTradeModalOpen] = createSignal<boolean>(false);

  createEffect(() => {
    for (const offer of props.pendingTradeOffers) {
      if (!shownOffers.has(offer.offerId)) {
        shownOffers.add(offer.offerId);
        const fromName =
          props.opponents.find((o) => o.userId === offer.fromPlayerId)?.username ?? 'Spelare';
        showToast(
          `${fromName} erbjuder "${offer.displayName}" — svara i Handla-fliken`,
          'info',
          8000,
        );
      }
    }
  });

  const switchTab = (tab: 'play' | 'sabotage' | 'trade') => {
    setActiveTab(tab);
    setSelectedIds(new Set<string>());
    setSaboTarget(null);
  };

  const toggleCard = (instanceId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(instanceId)) next.delete(instanceId);
      else next.add(instanceId);
      return next;
    });
  };

  const isActionDisabled = () => props.self.hasCommitted || props.self.skipNextTurn;

  // Animate selected cards flying to the discard pile, then fire the action.
  const flyAndPlay = (action: unknown, ids: string[]) => {
    const anchor = document.getElementById('discard-pile-anchor');
    const anchorRect = anchor?.getBoundingClientRect();

    const targetX = anchorRect ? anchorRect.left + anchorRect.width / 2 : window.innerWidth / 2;
    const targetY = anchorRect ? anchorRect.top + anchorRect.height / 2 : 0;

    const cardEls = ids
      .map((id) => {
        const wrapper = document.querySelector<HTMLElement>(`[data-instance-id="${id}"]`);
        // wrapper is display:contents — grab its first rendered child (the card div)
        return (wrapper?.firstElementChild as HTMLElement | null) ?? wrapper;
      })
      .filter((el): el is HTMLElement => el !== null);

    if (cardEls.length === 0) {
      props.onAction(action);
      setSelectedIds(new Set<string>());
      return;
    }

    const clones: HTMLElement[] = cardEls.map((el) => {
      const rect = el.getBoundingClientRect();
      const clone = el.cloneNode(true) as HTMLElement;
      clone.style.cssText = `
        position:fixed;
        left:${rect.left}px;
        top:${rect.top}px;
        width:${rect.width}px;
        height:${rect.height}px;
        margin:0;
        z-index:999;
        pointer-events:none;
        transform-origin:center center;
        will-change:transform,opacity;
      `;
      document.body.appendChild(clone);
      return clone;
    });

    let done = 0;
    clones.forEach((clone, i) => {
      const rect = cardEls[i]!.getBoundingClientRect();
      const dx = targetX - (rect.left + rect.width / 2);
      const dy = targetY - (rect.top + rect.height / 2);
      const delay = i * 40;

      const anim = clone.animate(
        [
          { transform: 'translate(0,0) scale(1) rotate(0deg)', opacity: '1' },
          { transform: `translate(${dx}px,${dy}px) scale(0.35) rotate(${(i % 2 === 0 ? 1 : -1) * 20}deg)`, opacity: '0' },
        ],
        { duration: 380, delay, easing: 'cubic-bezier(0.4,0,0.6,1)', fill: 'forwards' },
      );

      anim.onfinish = () => {
        clone.remove();
        done++;
        if (done === clones.length) {
          props.onAction(action);
          setSelectedIds(new Set<string>());
        }
      };
    });
  };

  return (
    <div class={`snusking-hand${props.self.highNicEffect ? ' highnic-blur' : ''}`}>
      <Show when={props.self.highNicEffect}>
        <div class="debuff-banner highnic">Hög nikotineffekt. Fokus störd.</div>
      </Show>
      <Show when={props.self.skipNextTurn}>
        <div class="debuff-banner skip">Din tur hoppas över. Du kan inte spela denna runda.</div>
      </Show>

      <div class="hand-tabs">
        <button
          class={`hand-tab${activeTab() === 'play' ? ' active' : ''}`}
          onClick={() => switchTab('play')}
        >
          Spela
        </button>
        <button
          class={`hand-tab${activeTab() === 'sabotage' ? ' active' : ''}`}
          onClick={() => switchTab('sabotage')}
        >
          Sabotera
        </button>
        <button
          class={`hand-tab${activeTab() === 'trade' ? ' active' : ''}`}
          onClick={() => switchTab('trade')}
        >
          Handla
        </button>
      </div>

      <div class="hand-tab-content">
        {/* ── PLAY TAB ── */}
        <Show when={activeTab() === 'play'}>
          <div class="hand-tab-panel">
            <div class="hand-cards">
              <For each={props.self.hand}>
                {(card: SnuskingCardInstance) => (
                  <div data-instance-id={card.instanceId} style="display:contents">
                    <SnuskingCard
                      card={card}
                      selected={selectedIds().has(card.instanceId)}
                      disabled={isActionDisabled()}
                      onClick={() => !isActionDisabled() && toggleCard(card.instanceId)}
                    />
                  </div>
                )}
              </For>
            </div>
            <div class="hand-actions">
              <button
                class="hand-btn primary"
                disabled={isActionDisabled() || selectedIds().size === 0}
                onClick={() => {
                  const ids = [...selectedIds()];
                  flyAndPlay({ type: 'snusking:spend', cardIds: ids }, ids);
                }}
              >
                Spela valda
              </button>
              <Show when={props.self.beer > 0 && selectedIds().size > 0}>
                <button
                  class="hand-btn beer"
                  disabled={isActionDisabled()}
                  onClick={() => {
                    const ids = [...selectedIds()];
                    flyAndPlay(
                      { type: 'snusking:spend-with-beer', cardIds: ids, beerCardId: 'beer' },
                      ids,
                    );
                  }}
                >
                  Spela + Öl 🍺
                </button>
              </Show>
              <Show when={props.self.immunityActive}>
                <button
                  class="hand-btn immunity"
                  disabled={isActionDisabled()}
                  onClick={() => props.onAction({ type: 'snusking:activate-immunity' })}
                >
                  Aktivera immunitet
                </button>
              </Show>
              <button
                class="hand-btn pass"
                disabled={isActionDisabled()}
                onClick={() => props.onAction({ type: 'snusking:pass' })}
              >
                Passa
              </button>
            </div>
          </div>
        </Show>

        {/* ── SABOTAGE TAB ── */}
        <Show when={activeTab() === 'sabotage'}>
          <div class="hand-tab-panel">
            <Show
              when={saboTarget() !== null}
              fallback={
                <>
                  <div class="hand-cards">
                    <For each={props.self.hand}>
                      {(card: SnuskingCardInstance) => (
                        <SnuskingCard
                          card={card}
                          selected={selectedIds().has(card.instanceId)}
                          disabled={props.self.hasCommitted}
                          onClick={() =>
                            !props.self.hasCommitted &&
                            setSelectedIds(new Set<string>([card.instanceId]))
                          }
                        />
                      )}
                    </For>
                  </div>
                  <div class="sabo-target-row">
                    <span class="sabo-label">Välj mål:</span>
                    <For each={props.opponents}>
                      {(opp: SnuskingOpponentState) => (
                        <button
                          class="hand-btn sabo-target-btn"
                          disabled={props.self.hasCommitted || selectedIds().size === 0}
                          onClick={() => setSaboTarget(opp.userId)}
                        >
                          {opp.username}
                        </button>
                      )}
                    </For>
                  </div>
                </>
              }
            >
              <div class="sabo-confirm">
                <p>
                  Skicka till{' '}
                  {props.opponents.find((o) => o.userId === saboTarget())?.username ??
                    saboTarget()}
                  ?
                </p>
                <div class="hand-actions">
                  <button
                    class="hand-btn sabo-spent"
                    onClick={() => {
                      const ids = [...selectedIds()];
                      if (!ids[0] || !saboTarget()) return;
                      props.onAction({
                        type: 'snusking:sabotage-spentsnus',
                        targetPlayerId: saboTarget()!,
                        cardInstanceId: ids[0],
                      });
                      setSaboTarget(null);
                      setSelectedIds(new Set<string>());
                    }}
                  >
                    Skicka spent snus
                  </button>
                  <button
                    class="hand-btn sabo-highnic"
                    onClick={() => {
                      const ids = [...selectedIds()];
                      if (!ids[0] || !saboTarget()) return;
                      props.onAction({
                        type: 'snusking:sabotage-highnic',
                        targetPlayerId: saboTarget()!,
                        cardInstanceId: ids[0],
                      });
                      setSaboTarget(null);
                      setSelectedIds(new Set<string>());
                    }}
                  >
                    Skicka hög-nic
                  </button>
                  <button
                    class="hand-btn pass"
                    onClick={() => {
                      setSaboTarget(null);
                      setSelectedIds(new Set<string>());
                    }}
                  >
                    Avbryt
                  </button>
                </div>
              </div>
            </Show>
          </div>
        </Show>

        {/* ── TRADE TAB ── */}
        <Show when={activeTab() === 'trade'}>
          <div class="hand-tab-panel">
            <Show when={props.pendingTradeOffers.length > 0}>
              <div class="incoming-trades">
                <h4 class="incoming-trades-header">Inkommande erbjudanden</h4>
                <For each={props.pendingTradeOffers}>
                  {(offer: SnuskingTradeOffer) => {
                    const fromName =
                      props.opponents.find((o) => o.userId === offer.fromPlayerId)?.username ??
                      'Spelare';
                    return (
                      <div class="trade-offer-row">
                        <span>
                          {fromName} erbjuder &ldquo;{offer.displayName}&rdquo;
                        </span>
                        <button
                          class="hand-btn primary"
                          onClick={() =>
                            props.onAction({ type: 'snusking:trade-accept', offerId: offer.offerId })
                          }
                        >
                          Acceptera
                        </button>
                        <button
                          class="hand-btn pass"
                          onClick={() =>
                            props.onAction({ type: 'snusking:trade-decline', offerId: offer.offerId })
                          }
                        >
                          Avvisa
                        </button>
                      </div>
                    );
                  }}
                </For>
              </div>
            </Show>

            <h4 class="trade-section-header">Erbjud ett kort</h4>
            <div class="hand-cards">
              <For each={props.self.hand}>
                {(card: SnuskingCardInstance) => (
                  <SnuskingCard
                    card={card}
                    selected={tradeCardId() === card.instanceId}
                    disabled={props.self.hasCommitted}
                    onClick={() => {
                      if (!props.self.hasCommitted) {
                        setTradeCardId(card.instanceId);
                        setTradeFakeName(card.name);
                        setTradeModalOpen(true);
                      }
                    }}
                  />
                )}
              </For>
            </div>

            <Modal
              open={tradeModalOpen()}
              onClose={() => setTradeModalOpen(false)}
              title="Erbjud kort"
            >
              <div class="trade-modal-body">
                <Show when={props.self.hand.find((c) => c.instanceId === tradeCardId())}>
                  {(card) => (
                    <div class="trade-card-info">
                      <strong>{card().name}</strong> — {card().empirePoints} pts
                    </div>
                  )}
                </Show>
                <label class="trade-label">
                  Visa som:
                  <input
                    class="trade-name-input"
                    value={tradeFakeName()}
                    onInput={(e) => setTradeFakeName(e.currentTarget.value)}
                  />
                </label>
                <label class="trade-label">
                  Till:
                  <select
                    class="trade-target-select"
                    onChange={(e) => setTradeTarget(e.currentTarget.value || null)}
                  >
                    <option value="">Välj spelare</option>
                    <For each={props.opponents}>
                      {(opp: SnuskingOpponentState) => (
                        <option value={opp.userId}>{opp.username}</option>
                      )}
                    </For>
                  </select>
                </label>
                <div class="trade-modal-actions">
                  <button
                    class="hand-btn primary"
                    disabled={!tradeTarget()}
                    onClick={() => {
                      if (!tradeCardId() || !tradeTarget()) return;
                      props.onAction({
                        type: 'snusking:trade-offer',
                        targetPlayerId: tradeTarget()!,
                        cardInstanceId: tradeCardId()!,
                        displayName: tradeFakeName(),
                      });
                      setTradeModalOpen(false);
                      setTradeCardId(null);
                      setTradeTarget(null);
                      setTradeFakeName('');
                    }}
                  >
                    Skicka
                  </button>
                  <button class="hand-btn pass" onClick={() => setTradeModalOpen(false)}>
                    Avbryt
                  </button>
                </div>
              </div>
            </Modal>
          </div>
        </Show>
      </div>
    </div>
  );
};
