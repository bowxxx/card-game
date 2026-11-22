// Rook, the rival: how the opponent picks its cards. Greedy but readable — it takes
// a killing blow when it sees one, guards when it is hurting, and otherwise spends
// its energy on the best value in hand, so its choices can be read and countered.
// It picks one card at a time, because playing a card shifts the hand under the
// indexes that follow it.

import { cardDef } from './cards.js';

/**
 * Score one card in `side`'s hand against `foe`, from the playing side's view.
 * Damage is worth its face value (more when it kills), healing only what is
 * missing, shield only while it is thin, and drawing always a little.
 */
export function scoreCard(card, side, foe) {
  const def = cardDef(card);
  switch (def.effect) {
    case 'strike': {
      const hurt = Math.min(def.power, foe.life + (foe.shield > 0 ? foe.shield : 0));
      return hurt + (foe.life <= def.power ? 10 : 0);
    }
    case 'lance': {
      return Math.min(def.power, foe.life) + (foe.life <= def.power ? 10 : 0);
    }
    case 'guard': {
      if (side.shield >= 8) return 0.4;
      return def.power * 0.8;
    }
    case 'mend': {
      const missing = side.maxLife - side.life;
      if (missing <= 0) return 0;
      return Math.min(def.power, missing);
    }
    case 'draw': {
      return 2.5;
    }
    case 'siphon': {
      const hurt = Math.min(def.power, foe.life + foe.shield);
      const missing = side.maxLife - side.life;
      return hurt * 0.8 + Math.min(def.power, missing) * 0.7;
    }
    default:
      return 0;
  }
}

/**
 * The single best hand index for `side` to play now, or -1 to pass. `policy` is
 * 'greedy' (the real rival, and the staged-play autopilot), 'weak' (one random
 * affordable card, then pass) or 'idle' (never play). The caller plays the pick
 * through `playCard` and asks again, so the index is always fresh.
 */
export function chooseNextPlay(state, side, policy) {
  const foe = side === state.player ? state.ai : state.player;
  if (policy === 'idle') return -1;
  const affordable = [];
  for (let i = 0; i < side.hand.length; i += 1) {
    if (cardDef(side.hand[i]).cost <= side.energy) affordable.push(i);
  }
  if (affordable.length === 0) return -1;
  if (policy === 'weak') {
    return affordable[Math.floor(state.rng() * affordable.length)];
  }
  let bestIndex = -1;
  let bestScore = 0.6;
  for (const i of affordable) {
    const score = scoreCard(side.hand[i], side, foe) + state.rng() * 0.4;
    if (score > bestScore) {
      bestScore = score;
      bestIndex = i;
    }
  }
  return bestIndex;
}

/**
 * One line telegraphing the rival's next move, shown before it acts, so the
 * player can read the threat and answer it with a guard or a race.
 */
export function intentLine(state) {
  const pick = chooseNextPlay(state, state.ai, 'greedy');
  if (pick < 0) return 'Rook holds its cards close.';
  const first = cardDef(state.ai.hand[pick]);
  return `Rook plots: ${first.name}.`;
}
