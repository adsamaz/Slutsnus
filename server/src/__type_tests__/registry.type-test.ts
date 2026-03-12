/**
 * Type-level test: TurnBasedGameEngine interface
 *
 * RED: This file intentionally fails tsc until TurnBasedGameEngine and TurnPhase
 * are added to registry.ts.
 *
 * GREEN: Once registry.ts exports those types, tsc --noEmit passes.
 */
import { TurnBasedGameEngine, TurnPhase } from '../games/registry';
import type { GameEngine } from '../games/registry';

// TurnBasedGameEngine must extend GameEngine
const _engineAssignment: GameEngine = {} as TurnBasedGameEngine;
void _engineAssignment;

// TurnBasedGameEngine must have projectState(playerId: string): unknown
type _HasProjectState = TurnBasedGameEngine extends { projectState(playerId: string): unknown }
  ? true
  : false;
const _projectStateCheck: _HasProjectState = true;
void _projectStateCheck;

// TurnBasedGameEngine must have getCurrentPhase(): TurnPhase
type _HasGetCurrentPhase = TurnBasedGameEngine extends { getCurrentPhase(): TurnPhase }
  ? true
  : false;
const _getCurrentPhaseCheck: _HasGetCurrentPhase = true;
void _getCurrentPhaseCheck;

// TurnPhase must be the union of exactly these values
const _drawPhase: TurnPhase = 'draw';
const _planningPhase: TurnPhase = 'planning';
const _revealPhase: TurnPhase = 'reveal';
const _resolvePhase: TurnPhase = 'resolve';
const _endedPhase: TurnPhase = 'ended';
void _drawPhase; void _planningPhase; void _revealPhase; void _resolvePhase; void _endedPhase;
