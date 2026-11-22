// The rules of Ember Court, with no DOM in them: state, turns, card effects and
// the win/loss check. The renderer and the screenshot stager both drive the game
// through these functions, so a simulated game and a played game follow one ruleset.

import { buildDeck, cardDef } from './cards.js';
import { mulberry32 } from './rng.js';

export const START_LIFE = 20;
export const START_HAND = 5;
export const MAX_HAND = 7;
export const MAX_ENERGY = 6;

export const PHASE_TITLE = 'title';
export const PHASE_PLAYER = 'player';
export const PHASE_AI = 'ai';
export const PHASE_OVER = 'over';

/** One side of the table: life, shield, energy, deck, hand and discard pile. */
export function freshSide(rng) {
  return {
    life: START_LIFE,
    maxLife: START_LIFE,
    shield: 0,
    energy: 0,
    maxEnergy: 0,
    turnsTaken: 0,
    deck: buildDeck(rng),
    hand: [],
    discard: [],
  };
}

/** A new duel. Nothing is drawn until `beginDuel` runs, so the title screen is clean. */
export function createGame(seed) {
  const rng = mulberry32(seed);
  const state = {
    seed,
    rng,
    turn: 0,
    phase: PHASE_TITLE,
    player: freshSide(rng),
    ai: freshSide(rng),
    log: [],
    renown: 0,
    cardsPlayed: 0,
    winner: null,
    aiIntent: '',
    lastEvents: [],
  };
  return state;
}

/** Shuffle a side's discard pile back into its deck, driven by the game's rng. */
export function reshuffleDiscard(state, side) {
  const rng = state.rng;
  const pile = side.discard;
  side.discard = [];
  for (let i = pile.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = pile[i];
    pile[i] = pile[j];
    pile[j] = tmp;
  }
  side.deck = pile;
}

/** Draw that reshuffles when the deck runs out. */
export function drawWithReshuffle(state, side, count) {
  const drawn = [];
  for (let i = 0; i < count; i += 1) {
    if (side.hand.length >= MAX_HAND) break;
    if (side.deck.length === 0) {
      if (side.discard.length === 0) break;
      reshuffleDiscard(state, side);
    }
    drawn.push(side.deck.pop());
  }
  side.hand.push(...drawn);
  return drawn;
}

/** Deal the opening hands and start the player's first turn. */
export function beginDuel(state) {
  drawWithReshuffle(state, state.player, START_HAND);
  drawWithReshuffle(state, state.ai, START_HAND);
  state.turn = 1;
  startTurn(state, state.player);
  state.phase = PHASE_PLAYER;
  pushLog(state, 'The duel begins. Your move, courtier.');
  return state;
}

/** Give a side its energy for a new turn and draw one card. */
export function startTurn(state, side) {
  side.turnsTaken += 1;
  side.maxEnergy = Math.min(side.turnsTaken, MAX_ENERGY);
  side.energy = side.maxEnergy;
  drawWithReshuffle(state, side, 1);
}

/** Append a line to the table log, keeping the last few. */
export function pushLog(state, line) {
  state.log.push(line);
  if (state.log.length > 6) state.log.shift();
}

/** Apply `amount` damage to `target`, shield first unless `pierce` is set. */
export function dealDamage(target, amount, pierce) {
  let remaining = amount;
  let soaked = 0;
  if (!pierce && target.shield > 0) {
    soaked = Math.min(target.shield, remaining);
    target.shield -= soaked;
    remaining -= soaked;
  }
  target.life = Math.max(0, target.life - remaining);
  return { dealt: remaining, soaked };
}

/**
 * Play the card at `handIndex` from `side`'s hand. Returns `{ ok, events }` where
 * each event names what happened, so the renderer can animate it. A failed play
 * returns `{ ok: false, reason }` and changes nothing.
 */
export function playCard(state, side, handIndex) {
  const foe = side === state.player ? state.ai : state.player;
  const me = side;
  const card = me.hand[handIndex];
  if (!card) return { ok: false, reason: 'no card there' };
  const def = cardDef(card);
  if (me.energy < def.cost) return { ok: false, reason: 'not enough energy' };
  me.energy -= def.cost;
  me.hand.splice(handIndex, 1);
  me.discard.push(card);
  state.cardsPlayed += 1;
  if (side === state.player) state.renown += def.cost;

  const events = [{ type: 'play', side: side === state.player ? 'player' : 'ai', card }];
  const who = side === state.player ? 'You' : 'Rook';
  const whom = side === state.player ? 'Rook' : 'you';
  switch (def.effect) {
    case 'strike':
    case 'lance': {
      const hit = dealDamage(foe, def.power, def.effect === 'lance');
      events.push({ type: 'damage', side: foe === state.player ? 'player' : 'ai', amount: hit.dealt, soaked: hit.soaked, pierce: def.effect === 'lance' });
      pushLog(state, `${who} played ${def.name} — ${hit.dealt} damage to ${whom}${hit.soaked ? ` (${hit.soaked} soaked by shield)` : ''}.`);
      break;
    }
    case 'guard': {
      me.shield += def.power;
      events.push({ type: 'shield', side: side === state.player ? 'player' : 'ai', amount: def.power });
      pushLog(state, `${who} played ${def.name} — +${def.power} shield.`);
      break;
    }
    case 'mend': {
      const healed = Math.min(def.power, me.maxLife - me.life);
      me.life += healed;
      events.push({ type: 'heal', side: side === state.player ? 'player' : 'ai', amount: healed });
      pushLog(state, `${who} played ${def.name} — restored ${healed} life.`);
      break;
    }
    case 'draw': {
      const drawn = drawWithReshuffle(state, me, def.power);
      events.push({ type: 'draw', side: side === state.player ? 'player' : 'ai', amount: drawn.length });
      pushLog(state, `${who} played ${def.name} — drew ${drawn.length} card${drawn.length === 1 ? '' : 's'}.`);
      break;
    }
    case 'siphon': {
      const hit = dealDamage(foe, def.power, false);
      const healed = Math.min(def.power, me.maxLife - me.life);
      me.life += healed;
      events.push({ type: 'damage', side: foe === state.player ? 'player' : 'ai', amount: hit.dealt, soaked: hit.soaked, pierce: false });
      events.push({ type: 'heal', side: side === state.player ? 'player' : 'ai', amount: healed });
      pushLog(state, `${who} played ${def.name} — ${hit.dealt} damage to ${whom}, restored ${healed} life.`);
      break;
    }
    default:
      break;
  }
  state.lastEvents = events;
  checkEnd(state);
  return { ok: true, events };
}

/** Set the winner when either life total reaches zero. */
export function checkEnd(state) {
  if (state.phase === PHASE_OVER) return;
  if (state.ai.life <= 0) {
    state.winner = 'player';
    state.phase = PHASE_OVER;
    pushLog(state, 'Rook falls. You take the Ember Court!');
  } else if (state.player.life <= 0) {
    state.winner = 'ai';
    state.phase = PHASE_OVER;
    pushLog(state, 'Your light gutters out. Rook takes the court.');
  }
}

/** End the player's turn: the rival acts, then a fresh player turn begins. */
export function endPlayerTurn(state) {
  if (state.phase !== PHASE_PLAYER) return false;
  state.phase = PHASE_AI;
  return true;
}

/** After the rival's turn, open the player's next turn (unless the duel is over). */
export function openNextPlayerTurn(state) {
  if (state.phase === PHASE_OVER) return;
  state.turn += 1;
  startTurn(state, state.player);
  state.phase = PHASE_PLAYER;
  pushLog(state, `Turn ${state.turn} — your move.`);
}
