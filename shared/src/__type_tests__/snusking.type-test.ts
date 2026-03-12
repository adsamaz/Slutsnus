/**
 * Type-level test: Snusking types contract
 *
 * RED: Asserts precise shapes for SnuskingTradeOffer (will fail until fixed).
 * GREEN: Once types match plan spec, tsc --noEmit passes.
 */
import type {
  GameType,
  GameEndReason,
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

// SnuskingCardDefinition shape
const _cardDef: SnuskingCardDefinition = { id: 'a', name: 'b', empirePoints: 5 };
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

// SnuskingPlayerState shape
const _playerState: SnuskingPlayerState = {
  userId: 'u1',
  username: 'Alice',
  hand: [],
  empireScore: 0,
  hasCommitted: false,
  isConnected: true,
  beer: 0,
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

// SnuskingProjectedState shape
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

// SnuskingAction discriminated union
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
