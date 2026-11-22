// The card catalogue for Ember Court: every card kind in the game, its house, cost,
// power and what it does. Six kinds, three houses, no card copied from any other game.

export const HOUSE_EMBER = 'ember';
export const HOUSE_TIDE = 'tide';
export const HOUSE_GALE = 'gale';

export const HOUSES = {
  [HOUSE_EMBER]: { name: 'Ember', color: '#c0392b', soft: '#f5b7b1', shape: 'flame' },
  [HOUSE_TIDE]: { name: 'Tide', color: '#2471a3', soft: '#aed6f1', shape: 'wave' },
  [HOUSE_GALE]: { name: 'Gale', color: '#1e8449', soft: '#a9dfbf', shape: 'leaf' },
};

// kind -> { name, house, cost, power, blurb, effect }
// effect: strike (damage), lance (damage that ignores shield), guard (shield),
// mend (heal), draw (draw cards), siphon (damage and heal).
export const CARD_KINDS = {
  strike: {
    name: 'Ember Strike', house: HOUSE_EMBER, cost: 1, power: 3,
    effect: 'strike', blurb: 'Deal 3 damage to the rival.',
  },
  lance: {
    name: 'Ember Lance', house: HOUSE_EMBER, cost: 3, power: 7,
    effect: 'lance', blurb: 'Deal 7 damage. Ignores shield.',
  },
  guard: {
    name: 'Tide Guard', house: HOUSE_TIDE, cost: 1, power: 4,
    effect: 'guard', blurb: 'Gain 4 shield. Shield soaks damage.',
  },
  mend: {
    name: 'Tide Mend', house: HOUSE_TIDE, cost: 2, power: 5,
    effect: 'mend', blurb: 'Restore 5 life.',
  },
  draft: {
    name: 'Gale Draft', house: HOUSE_GALE, cost: 1, power: 2,
    effect: 'draw', blurb: 'Draw 2 cards.',
  },
  siphon: {
    name: 'Gale Siphon', house: HOUSE_GALE, cost: 2, power: 3,
    effect: 'siphon', blurb: 'Deal 3 damage and restore 3 life.',
  },
};

export const KIND_IDS = Object.keys(CARD_KINDS);
export const DECK_COPIES_PER_KIND = 4;
export const DECK_SIZE = KIND_IDS.length * DECK_COPIES_PER_KIND;

/** A fresh 24-card deck: four copies of each kind, shuffled with `rng`. */
export function buildDeck(rng) {
  const deck = [];
  for (const kind of KIND_IDS) {
    for (let i = 0; i < DECK_COPIES_PER_KIND; i += 1) {
      deck.push({ kind, uid: `${kind}-${i}` });
    }
  }
  // Shuffle with the same helper the rest of the game uses.
  for (let i = deck.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = deck[i];
    deck[i] = deck[j];
    deck[j] = tmp;
  }
  return deck;
}

/** The full definition of a card object (a `{ kind, uid }` from a deck). */
export function cardDef(card) {
  return CARD_KINDS[card.kind];
}

/** One line describing what a card does, for the log and the card face. */
export function cardText(card) {
  return CARD_KINDS[card.kind].blurb;
}
