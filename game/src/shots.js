// The screenshot scenes behind `?shot=start|play|win|loss`. Each one plays the real
// rules forward from a fresh duel — the same `playCard` and AI the player meets —
// steered by a simple autopilot, so the frame is what a real game looks like and
// the same seed always gives the same frame.

import { chooseNextPlay, intentLine } from './ai.js';
import {
  beginDuel,
  createGame,
  endPlayerTurn,
  openNextPlayerTurn,
  PHASE_OVER,
  playCard,
  startTurn,
} from './state.js';

const MAX_ROUNDS = 60;
const PLAY_ROUNDS = 3;
const SEED_TRIES = 300;

/** Play one whole turn for `side` under `policy`, through the real `playCard`. */
export function simulateTurn(state, side, policy) {
  if (state.phase === PHASE_OVER) return;
  for (;;) {
    const pick = chooseNextPlay(state, side, policy);
    if (pick < 0) break;
    const result = playCard(state, side, pick);
    if (!result.ok || state.phase === PHASE_OVER) return;
  }
}

/** Play a full round (player turn, then rival turn) under the two policies. */
export function simulateRound(state, playerPolicy, aiPolicy) {
  if (state.phase === PHASE_OVER) return;
  simulateTurn(state, state.player, playerPolicy);
  if (state.phase === PHASE_OVER) return;
  endPlayerTurn(state);
  startTurn(state, state.ai);
  state.aiIntent = intentLine(state);
  simulateTurn(state, state.ai, aiPolicy);
  if (state.phase === PHASE_OVER) return;
  openNextPlayerTurn(state);
}

/**
 * A whole duel from `seed`, both sides steered by their policy, until someone wins
 * or `MAX_ROUNDS` rounds pass. Returns the finished (or stalled) state.
 */
export function simulateDuel(seed, playerPolicy, aiPolicy) {
  const state = createGame(seed);
  beginDuel(state);
  for (let round = 0; round < MAX_ROUNDS && state.phase !== PHASE_OVER; round += 1) {
    simulateRound(state, playerPolicy, aiPolicy);
  }
  return state;
}

/** A mid-duel table worth screenshotting: both sides hurt, both hands full. */
function findPlayState() {
  for (let seed = 1; seed <= SEED_TRIES; seed += 1) {
    const state = createGame(seed);
    beginDuel(state);
    for (let round = 0; round < PLAY_ROUNDS && state.phase !== PHASE_OVER; round += 1) {
      simulateRound(state, 'greedy', 'greedy');
    }
    if (state.phase === PHASE_OVER) continue;
    if (state.player.life >= 20 || state.ai.life >= 20) continue;
    if (state.player.hand.length < 3 || state.ai.hand.length < 3) continue;
    return state;
  }
  // Fallback: the first seed's mid-duel state, whatever it looks like.
  const state = createGame(1);
  beginDuel(state);
  for (let round = 0; round < PLAY_ROUNDS && state.phase !== PHASE_OVER; round += 1) {
    simulateRound(state, 'greedy', 'greedy');
  }
  return state;
}

/** A finished duel that ends the way `wanted` says: 'player' wins or 'ai' wins. */
function findEndState(wanted) {
  const playerPolicy = wanted === 'player' ? 'greedy' : 'idle';
  const aiPolicy = wanted === 'player' ? 'weak' : 'greedy';
  for (let seed = 1; seed <= SEED_TRIES; seed += 1) {
    const state = simulateDuel(seed, playerPolicy, aiPolicy);
    if (state.phase === PHASE_OVER && state.winner === wanted) return state;
  }
  return null;
}

/**
 * Stage the named scene and return the state to render. 'start' is the title
 * screen over a fresh duel; 'play' a mid-duel table; 'win' and 'loss' the two
 * end screens, reached by playing real duels to their real endings.
 */
export function stageShot(name) {
  if (name === 'play') return findPlayState();
  if (name === 'win') return findEndState('player') || createGame(1);
  if (name === 'loss') return findEndState('ai') || createGame(1);
  return createGame(1);
}