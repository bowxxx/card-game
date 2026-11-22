// Boot and input for Ember Court: builds the table, wires mouse and keyboard, and
// walks the rival through its turn one card at a time so every play can be seen.
// `?shot=start|play|win|loss` stages a screenshot scene instead of a live duel.

import { chooseNextPlay, intentLine } from './ai.js';
import { ensureAudio, isMuted, playSound, toggleMute } from './audio.js';
import {
  burstConfetti,
  floatNumber,
  mountTable,
  paintMute,
  renderAll,
  shakeTable,
} from './render.js';
import { stageShot } from './shots.js';
import {
  beginDuel,
  createGame,
  endPlayerTurn,
  openNextPlayerTurn,
  PHASE_AI,
  PHASE_OVER,
  PHASE_PLAYER,
  PHASE_TITLE,
  playCard,
  startTurn,
} from './state.js';

const AI_CARD_PAUSE_MS = 750;
const BEST_KEY = 'ember-court-best-renown';

/** The best renown this browser has seen, or 0 when nothing is stored. */
function loadBestRenown() {
  try {
    return Number(window.localStorage.getItem(BEST_KEY) || 0) || 0;
  } catch (err) {
    return 0;
  }
}

/** Remember a new best renown, quietly ignoring a browser that refuses storage. */
function saveBestRenown(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch (err) {
    // Storage is a nicety, never a requirement.
  }
}

/** The floating numbers and sounds for one card's events. */
function showEvents(ui, events) {
  for (const event of events) {
    if (event.type === 'damage') {
      floatNumber(ui, event.side, `-${event.amount}`, 'damage');
      shakeTable(ui, event.amount >= 5);
      playSound('hit');
    } else if (event.type === 'heal') {
      if (event.amount > 0) {
        floatNumber(ui, event.side, `+${event.amount}`, 'heal');
        playSound('heal');
      }
    } else if (event.type === 'shield') {
      floatNumber(ui, event.side, `+${event.amount} shield`, 'shield');
      playSound('shield');
    } else if (event.type === 'draw') {
      playSound('deal');
    }
  }
}

/** What happens when the duel ends: sounds, confetti, and the best renown. */
function onDuelOver(state, ui, best) {
  if (state.winner === 'player') {
    playSound('win');
    burstConfetti(ui, 60);
    if (state.renown > best.value) {
      best.value = state.renown;
      saveBestRenown(state.renown);
    }
  } else {
    playSound('lose');
  }
}

function main() {
  const params = new URLSearchParams(window.location.search);
  const shot = params.get('shot');
  const seedParam = Number(params.get('seed') || 0);
  const root = document.getElementById('table');
  const best = { value: loadBestRenown() };
  let state = null;
  let aiTimer = 0;
  let aiToken = 0;

  const callbacks = {
    onCardClick(index) {
      if (!state || state.phase !== PHASE_PLAYER) return;
      const result = playCard(state, state.player, index);
      if (!result.ok) return;
      playSound('play');
      showEvents(ui, result.events);
      renderAll(state, ui, callbacks, best.value);
      if (state.phase === PHASE_OVER) onDuelOver(state, ui, best);
    },
    onEndTurn() {
      if (!state || state.phase !== PHASE_PLAYER) return;
      if (!endPlayerTurn(state)) return;
      playSound('turn');
      runAiTurn();
      renderAll(state, ui, callbacks, best.value);
    },
    onStart() {
      ensureAudio();
      beginDuel(state);
      playSound('deal');
      renderAll(state, ui, callbacks, best.value);
    },
    onRestart() {
      window.clearTimeout(aiTimer);
      aiToken += 1;
      state = createGame((Math.random() * 0xffffffff) >>> 0);
      beginDuel(state);
      playSound('deal');
      renderAll(state, ui, callbacks, best.value);
    },
    onMute() {
      paintMute(ui, toggleMute());
    },
  };

  const ui = mountTable(root, callbacks);

  /** The rival's turn, one card per beat, then the player's next turn opens. */
  function runAiTurn() {
    if (!state || state.phase !== PHASE_AI) return;
    startTurn(state, state.ai);
    state.aiIntent = intentLine(state);
    renderAll(state, ui, callbacks, best.value);
    const token = aiToken;
    const step = () => {
      if (!state || token !== aiToken || state.phase !== PHASE_AI) return;
      const pick = chooseNextPlay(state, state.ai, 'greedy');
      if (pick < 0) {
        openNextPlayerTurn(state);
        if (state.phase === PHASE_OVER) onDuelOver(state, ui, best);
        else playSound('turn');
        renderAll(state, ui, callbacks, best.value);
        return;
      }
      const result = playCard(state, state.ai, pick);
      if (result.ok) {
        playSound('play');
        showEvents(ui, result.events);
      }
      renderAll(state, ui, callbacks, best.value);
      if (state.phase === PHASE_OVER) {
        onDuelOver(state, ui, best);
        return;
      }
      aiTimer = window.setTimeout(step, AI_CARD_PAUSE_MS);
    };
    aiTimer = window.setTimeout(step, AI_CARD_PAUSE_MS);
  }

  if (shot) {
    // A staged scene: render it and stop. No input, no sound, no timers.
    state = stageShot(shot);
    renderAll(state, ui, callbacks, best.value);
    if (state.phase === PHASE_OVER && state.winner === 'player') burstConfetti(ui, 60);
  } else {
    state = createGame(seedParam || (Math.random() * 0xffffffff) >>> 0);
    renderAll(state, ui, callbacks, best.value);
  }

  window.addEventListener('keydown', (event) => {
    if (!state) return;
    const key = event.key;
    if (key === 'm' || key === 'M') {
      paintMute(ui, toggleMute());
      return;
    }
    if (state.phase === PHASE_TITLE && (key === 'Enter' || key === ' ')) {
      event.preventDefault();
      callbacks.onStart();
      return;
    }
    if (state.phase === PHASE_OVER && (key === 'r' || key === 'R' || key === 'Enter')) {
      callbacks.onRestart();
      return;
    }
    if (state.phase === PHASE_PLAYER) {
      if (key === ' ' || key === 'Enter') {
        event.preventDefault();
        callbacks.onEndTurn();
        return;
      }
      const slot = Number(key) - 1;
      if (slot >= 0 && slot < state.player.hand.length) callbacks.onCardClick(slot);
    }
  });

  // A small test hook for automated play-throughs: the real state and the real
  // moves, so a driver can play full duels through the same code a player uses.
  window.__emberCourt = {
    get state() {
      return state;
    },
    playCardIndex(index) {
      callbacks.onCardClick(index);
    },
    endTurn() {
      callbacks.onEndTurn();
    },
    start() {
      callbacks.onStart();
    },
    restart() {
      callbacks.onRestart();
    },
    aiIsDone() {
      return state && state.phase !== PHASE_AI;
    },
  };
}

main();
