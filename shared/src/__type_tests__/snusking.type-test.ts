/**
 * Type-level test: Snusking types contract
 *
 * GREEN: tsc --noEmit passes once all Phase 2 type additions are present.
 */
import type {
  GameType,
  GameEndReason,
  SnuskingCardStrength,
  SnuskingCardFlavor,
  SnuskingEventCard,
  SnuskingCardDefinition,
  SnuskingCardInstance,
  SnuskingTradeOffer,
  SnuskingPlayerState,
  SnuskingOpponentState,
  SnuskingProjectedState,
  SnuskingMasterState,
  SnuskingAction,
} from '../types';

// GameType must include 'snusking'
const _gameType: GameType = 'snusking';
void _gameType;

// GameEndReason values
const _scoreThreshold: GameEndReason = 'score_threshold';
const _slutSnus: GameEndReason = 'slut_snus';
void _scoreThreshold; void _slutSnus;

// SnuskingCardDefinition shape — requires strength and flavor (Phase 2)
const _cardDef: SnuskingCardDefinition = { id: 'a', name: 'b', empirePoints: 5, strength: 'medium', flavor: 'tobacco' };
void _cardDef;

// SnuskingCardInstance shape
const _cardInst: SnuskingCardInstance = {
  instanceId: 'uuid-1',
  definitionId: 'def-1',
  name: 'Test Card',
  empirePoints: 10,
};
void _cardInst;

// SnuskingTradeOffer must have the plan-specified shape (not the old fromUserId/toUserId shape)
const _tradeOffer: SnuskingTradeOffer = {
  offerId: 'offer-uuid',
  fromPlayerId: 'player-a',
  toPlayerId: 'player-b',
  cardInstanceId: 'card-uuid',
  displayName: 'Sneaky Card',
  expiresAtTurn: 3,
};
void _tradeOffer;

// SnuskingPlayerState shape — includes Phase 2 sabotage flags
const _playerState: SnuskingPlayerState = {
  userId: 'u1',
  username: 'Alice',
  hand: [],
  empireScore: 0,
  hasCommitted: false,
  isConnected: true,
  beer: 0,
  skipNextTurn: false,
  pendingDiscard: false,
  highNicEffect: false,
  immunityActive: false,
};
void _playerState;

// SnuskingOpponentState must have handCount (NOT hand)
const _opponentState: SnuskingOpponentState = {
  userId: 'u2',
  username: 'Bob',
  handCount: 3,
  empireScore: 100,
  hasCommitted: true,
  isConnected: true,
  beer: 1,
};
void _opponentState;

// SnuskingProjectedState shape — includes Phase 2 currentEvent
const _projState: SnuskingProjectedState = {
  phase: 'planning',
  self: _playerState,
  opponents: [_opponentState],
  deckCount: 20,
  discardCount: 5,
  turnNumber: 2,
  pendingTradeOffers: [],
  status: 'active',
  endReason: null,
  results: null,
  currentEvent: null,
};
void _projState;

// SnuskingMasterState shape
const _masterState: SnuskingMasterState = {
  roomId: 'room-1',
  phase: 'reveal',
  players: { u1: _playerState },
  deck: [],
  discardPile: [],
  currentEvent: null,
  turnNumber: 2,
  pendingTradeOffers: [],
  status: 'active',
  endReason: null,
  results: null,
};
void _masterState;

// SnuskingCardStrength and SnuskingCardFlavor literal types
const _strength: SnuskingCardStrength = 'high';
const _flavor: SnuskingCardFlavor = 'mint';
void _strength; void _flavor;

// SnuskingEventCard shape
const _eventCard: SnuskingEventCard = {
  id: 'event-1',
  name: 'Nicotine Rush',
  strengthAffinity: ['high', 'extreme'],
  flavorAffinity: ['tobacco', 'mint'],
};
void _eventCard;

// SnuskingAction discriminated union — Phase 1 variants
const _spendAction: SnuskingAction = { type: 'snusking:spend', cardIds: ['uuid-1'] };
const _passAction: SnuskingAction = { type: 'snusking:pass' };
const _tradeOfferAction: SnuskingAction = {
  type: 'snusking:trade-offer',
  targetPlayerId: 'p2',
  cardInstanceId: 'card-1',
};
const _tradeAcceptAction: SnuskingAction = { type: 'snusking:trade-accept', offerId: 'offer-1' };
const _tradeDeclineAction: SnuskingAction = { type: 'snusking:trade-decline', offerId: 'offer-1' };
void _spendAction; void _passAction; void _tradeOfferAction; void _tradeAcceptAction; void _tradeDeclineAction;

// SnuskingAction — Phase 2 variants
const _spendWithBeer: SnuskingAction = { type: 'snusking:spend-with-beer', cardIds: ['uuid-1'], beerCardId: 'beer-1' };
const _sabotageSpentSnus: SnuskingAction = { type: 'snusking:sabotage-spentsnus', targetPlayerId: 'p2', cardInstanceId: 'card-1' };
const _sabotageHighNic: SnuskingAction = { type: 'snusking:sabotage-highnic', targetPlayerId: 'p2', cardInstanceId: 'card-2' };
const _activateImmunity: SnuskingAction = { type: 'snusking:activate-immunity' };
void _spendWithBeer; void _sabotageSpentSnus; void _sabotageHighNic; void _activateImmunity;
