// The table itself: every pixel of Ember Court is DOM built here — the felt, the
// hands, the life bars, the overlays — plus the motion: cards that slide and flip,
// floating damage numbers, a shake on a heavy hit and confetti on a win.

import { cardDef, HOUSES } from './cards.js';
import { PHASE_AI, PHASE_OVER, PHASE_PLAYER, PHASE_TITLE } from './state.js';

/** Inline SVG for a house's shape: flame, wave or leaf, coloured by the house. */
export function houseIcon(shape, color) {
  const paths = {
    flame: 'M12 2 C10 6 5 8 5 13 A7 7 0 0 0 19 13 C19 9 15 6 12 2 Z',
    wave: 'M2 13 Q7 7 12 12 T22 12 L22 17 Q17 11 12 16 T2 16 Z',
    leaf: 'M20 4 C10 4 4 10 4 20 C14 20 20 14 20 4 Z M4 20 L12 12',
  };
  const path = paths[shape] || paths.flame;
  return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${path}" fill="${color}"/></svg>`;
}

/** A face-down card: the patterned back the rival's hand shows. */
export function cardBackElement() {
  const back = document.createElement('div');
  back.className = 'card back';
  back.innerHTML = '<div class="card-back-mark">EC</div>';
  return back;
}

/** A face-up card element for `card` at hand position `index` (0-based). */
export function cardElement(card, index, playable) {
  const def = cardDef(card);
  const house = HOUSES[def.house];
  const el = document.createElement('button');
  el.type = 'button';
  el.className = `card ${def.house}${playable ? ' playable' : ' unplayable'}`;
  el.dataset.index = String(index);
  el.setAttribute('aria-label', `${def.name}, cost ${def.cost}, ${def.blurb}`);
  el.innerHTML =
    `<span class="card-cost" title="Energy cost">${def.cost}</span>` +
    `<span class="card-house">${houseIcon(house.shape, house.color)}</span>` +
    `<span class="card-name">${def.name}</span>` +
    `<span class="card-power">${def.power}</span>` +
    `<span class="card-blurb">${def.blurb}</span>` +
    `<span class="card-key">${index + 1}</span>`;
  return el;
}

/** Build the table skeleton under `root`. Returns the element refs the game needs. */
export function mountTable(root, callbacks) {
  root.innerHTML =
    '<header class="topbar">' +
    '<div class="brand">EMBER COURT</div>' +
    '<div class="turn-line" id="turnLine">A duel of ember cards</div>' +
    '<div class="score-line">Renown <b id="renownScore">0</b>' +
    '<button type="button" class="mute-btn" id="muteBtn" aria-label="Mute or unmute sound">Sound: on</button></div>' +
    '</header>' +
    '<section class="rival-zone">' +
    '<div class="duelist rival-duelist"><div class="avatar">R</div>' +
    '<div class="duelist-name">Rook <span class="duelist-tag">the Rival</span></div>' +
    '<div class="life-wrap"><div class="life-bar"><div class="life-fill" id="aiLifeFill"></div></div>' +
    '<div class="life-text" id="aiLifeText"></div></div>' +
    '<div class="shield-badge" id="aiShield"></div></div>' +
    '<div class="rival-hand" id="aiHand"></div>' +
    '<div class="intent" id="intentLine"></div>' +
    '</section>' +
    '<section class="middle-zone">' +
    '<div class="played-slot" id="playedSlot"><div class="played-hint">Played cards land here</div></div>' +
    '<div class="table-log" id="tableLog" aria-live="polite"></div>' +
    '</section>' +
    '<section class="player-zone">' +
    '<div class="duelist player-duelist"><div class="avatar">Y</div>' +
    '<div class="duelist-name">You <span class="duelist-tag">the Challenger</span></div>' +
    '<div class="life-wrap"><div class="life-bar"><div class="life-fill" id="playerLifeFill"></div></div>' +
    '<div class="life-text" id="playerLifeText"></div></div>' +
    '<div class="shield-badge" id="playerShield"></div>' +
    '<div class="energy-row" id="energyRow" title="Energy: spend it to play cards"></div></div>' +
    '<div class="player-hand" id="playerHand"></div>' +
    '<button type="button" class="end-turn" id="endTurnBtn">End turn <span class="key-hint">Space</span></button>' +
    '</section>' +
    '<div class="overlay" id="overlay"></div>' +
    '<div class="fx-layer" id="fxLayer"></div>';

  const ui = {
    turnLine: root.querySelector('#turnLine'),
    renownScore: root.querySelector('#renownScore'),
    muteBtn: root.querySelector('#muteBtn'),
    aiLifeFill: root.querySelector('#aiLifeFill'),
    aiLifeText: root.querySelector('#aiLifeText'),
    aiShield: root.querySelector('#aiShield'),
    aiHand: root.querySelector('#aiHand'),
    intentLine: root.querySelector('#intentLine'),
    playedSlot: root.querySelector('#playedSlot'),
    tableLog: root.querySelector('#tableLog'),
    playerLifeFill: root.querySelector('#playerLifeFill'),
    playerLifeText: root.querySelector('#playerLifeText'),
    playerShield: root.querySelector('#playerShield'),
    energyRow: root.querySelector('#energyRow'),
    playerHand: root.querySelector('#playerHand'),
    endTurnBtn: root.querySelector('#endTurnBtn'),
    overlay: root.querySelector('#overlay'),
    fxLayer: root.querySelector('#fxLayer'),
  };
  ui.endTurnBtn.addEventListener('click', () => callbacks.onEndTurn());
  ui.muteBtn.addEventListener('click', () => callbacks.onMute());
  return ui;
}

/** Paint one life bar: width by remaining life, text with the numbers. */
function paintLife(fill, text, side) {
  const pct = Math.max(0, Math.min(100, (side.life / side.maxLife) * 100));
  fill.style.width = `${pct}%`;
  fill.classList.toggle('low', side.life <= 6);
  text.textContent = `${side.life} / ${side.maxLife} life`;
}

/** Paint a shield badge, hidden when the side holds no shield. */
function paintShield(badge, side) {
  badge.textContent = side.shield > 0 ? `Shield ${side.shield}` : '';
  badge.classList.toggle('has-shield', side.shield > 0);
}

/** Paint the energy pips: filled for energy left, dim for spent. */
function paintEnergy(row, side) {
  row.innerHTML = '';
  for (let i = 0; i < side.maxEnergy; i += 1) {
    const pip = document.createElement('span');
    pip.className = `energy-pip${i < side.energy ? ' lit' : ''}`;
    pip.textContent = '●';
    row.appendChild(pip);
  }
  const label = document.createElement('span');
  label.className = 'energy-text';
  label.textContent = `${side.energy} energy`;
  row.appendChild(label);
}

/** Rebuild the player's hand; click a card to play it on your turn. */
function paintPlayerHand(ui, state, callbacks) {
  ui.playerHand.innerHTML = '';
  state.player.hand.forEach((card, index) => {
    const playable = state.phase === PHASE_PLAYER && cardDef(card).cost <= state.player.energy;
    const el = cardElement(card, index, playable);
    el.addEventListener('click', () => callbacks.onCardClick(index));
    ui.playerHand.appendChild(el);
  });
}

/** Rebuild the rival's hand as face-down backs. */
function paintAiHand(ui, state) {
  ui.aiHand.innerHTML = '';
  state.ai.hand.forEach(() => ui.aiHand.appendChild(cardBackElement()));
}

/** The last played card, shown large in the middle of the table. */
function paintPlayedCard(ui, state) {
  const play = (state.lastEvents || []).find((event) => event.type === 'play');
  if (!play) {
    ui.playedSlot.innerHTML = '<div class="played-hint">Played cards land here</div>';
    return;
  }
  ui.playedSlot.innerHTML = '';
  const el = cardElement(play.card, 0, false);
  el.classList.add('played');
  el.disabled = true;
  ui.playedSlot.appendChild(el);
}

/** The title screen: name, rules in three lines, and the Start button. */
function titleOverlay(callbacks, bestRenown) {
  return (
    '<div class="overlay-card title-card">' +
    '<div class="overlay-kicker">A duel of ember cards</div>' +
    '<h1>EMBER<br>COURT</h1>' +
    '<p class="overlay-sub">Outplay Rook at the gilded table. Spend energy, play your hand, ' +
    'and bring the rival&rsquo;s life to zero before yours falls.</p>' +
    '<ul class="rules-list">' +
    '<li><b>1&ndash;7</b> or click a card to play it &mdash; each card costs energy.</li>' +
    '<li><b>Space</b> ends your turn. Energy grows every turn, up to 6.</li>' +
    '<li>Ember hurts, Tide shields and heals, Gale draws and siphons.</li>' +
    '</ul>' +
    `<p class="best-line">${bestRenown > 0 ? `Best renown so far: ${bestRenown}` : 'No duel fought yet — the court awaits.'}</p>` +
    '<button type="button" class="big-btn" id="startBtn">Take your seat</button>' +
    '<p class="hint-line">Click the button or press Enter</p>' +
    '</div>'
  );
}

/** The win or loss screen, with the duel's numbers and a Play again button. */
function endOverlay(state, won) {
  const turns = state.turn;
  const cards = state.cardsPlayed;
  return (
    '<div class="overlay-card end-card">' +
    `<div class="overlay-kicker">${won ? 'The court is yours' : 'The court keeps its champion'}</div>` +
    `<h1>${won ? 'YOU WIN' : 'YOU LOSE'}</h1>` +
    `<p class="overlay-sub">${won
      ? 'Rook bows and slides the ember crown across the table. A flawless flourish.'
      : 'Rook gathers the cards with a small, practised smile. The crown stays where it was.'}</p>` +
    '<dl class="stats-list">' +
    `<div><dt>Renown</dt><dd>${state.renown}</dd></div>` +
    `<div><dt>Turns</dt><dd>${turns}</dd></div>` +
    `<div><dt>Cards played</dt><dd>${cards}</dd></div>` +
    `<div><dt>Your life</dt><dd>${state.player.life} / ${state.player.maxLife}</dd></div>` +
    `<div><dt>Rook&rsquo;s life</dt><dd>${state.ai.life} / ${state.ai.maxLife}</dd></div>` +
    '</dl>' +
    '<button type="button" class="big-btn" id="againBtn">Play again</button>' +
    '<p class="hint-line">Click the button or press R</p>' +
    '</div>'
  );
}

/** Paint the whole table from the state: bars, hands, log, overlay. */
export function renderAll(state, ui, callbacks, bestRenown) {
  ui.renownScore.textContent = String(state.renown);
  paintLife(ui.playerLifeFill, ui.playerLifeText, state.player);
  paintLife(ui.aiLifeFill, ui.aiLifeText, state.ai);
  paintShield(ui.playerShield, state.player);
  paintShield(ui.aiShield, state.ai);
  paintEnergy(ui.energyRow, state.player);
  paintPlayerHand(ui, state, callbacks);
  paintAiHand(ui, state);
  paintPlayedCard(ui, state);
  ui.tableLog.innerHTML = state.log.map((line) => `<div>${line}</div>`).join('');
  ui.tableLog.scrollTop = ui.tableLog.scrollHeight;

  if (state.phase === PHASE_PLAYER) {
    ui.turnLine.textContent = `Turn ${state.turn} — your move`;
    ui.intentLine.textContent = state.aiIntent || '';
    ui.endTurnBtn.disabled = false;
  } else if (state.phase === PHASE_AI) {
    ui.turnLine.textContent = `Turn ${state.turn} — Rook is thinking…`;
    ui.intentLine.textContent = state.aiIntent || '';
    ui.endTurnBtn.disabled = true;
  } else {
    ui.turnLine.textContent = state.phase === PHASE_TITLE ? 'A duel of ember cards' : 'Duel over';
    ui.endTurnBtn.disabled = true;
  }

  if (state.phase === PHASE_TITLE) {
    ui.overlay.innerHTML = titleOverlay(callbacks, bestRenown);
    ui.overlay.classList.add('visible');
    const startBtn = ui.overlay.querySelector('#startBtn');
    if (startBtn) startBtn.addEventListener('click', () => callbacks.onStart());
  } else if (state.phase === PHASE_OVER) {
    ui.overlay.innerHTML = endOverlay(state, state.winner === 'player');
    ui.overlay.classList.add('visible');
    const againBtn = ui.overlay.querySelector('#againBtn');
    if (againBtn) againBtn.addEventListener('click', () => callbacks.onRestart());
  } else {
    ui.overlay.innerHTML = '';
    ui.overlay.classList.remove('visible');
  }
}

/** A floating number over a duelist's life bar: damage, healing or shield. */
export function floatNumber(ui, target, text, kind) {
  const anchor = target === 'player' ? ui.playerLifeText : ui.aiLifeText;
  const rect = anchor.getBoundingClientRect();
  const layerRect = ui.fxLayer.getBoundingClientRect();
  const span = document.createElement('span');
  span.className = `float-num ${kind}`;
  span.textContent = text;
  span.style.left = `${rect.left - layerRect.left + rect.width / 2}px`;
  span.style.top = `${rect.top - layerRect.top}px`;
  ui.fxLayer.appendChild(span);
  window.setTimeout(() => span.remove(), 1400);
}

/** Shake the table, hard for a heavy hit, gently for a small one. */
export function shakeTable(ui, hard) {
  const table = ui.fxLayer.parentElement;
  if (!table) return;
  table.classList.remove('shake', 'shake-hard');
  void table.offsetWidth;
  table.classList.add(hard ? 'shake-hard' : 'shake');
}

/** Confetti over the table: coloured flecks that fall and fade. */
export function burstConfetti(ui, count) {
  const colors = ['#d4af37', '#c0392b', '#2471a3', '#1e8449', '#f5b7b1', '#aed6f1'];
  const layerRect = ui.fxLayer.getBoundingClientRect();
  for (let i = 0; i < count; i += 1) {
    const fleck = document.createElement('span');
    fleck.className = 'confetti';
    fleck.style.left = `${Math.random() * layerRect.width}px`;
    fleck.style.background = colors[i % colors.length];
    fleck.style.animationDelay = `${Math.random() * 0.4}s`;
    fleck.style.animationDuration = `${1.6 + Math.random() * 1.2}s`;
    ui.fxLayer.appendChild(fleck);
    window.setTimeout(() => fleck.remove(), 3400);
  }
}

/** Update the mute button's label after a toggle. */
export function paintMute(ui, mutedNow) {
  ui.muteBtn.textContent = mutedNow ? 'Sound: off' : 'Sound: on';
}
