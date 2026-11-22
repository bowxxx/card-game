// Sounds for Ember Court: every sound is a small WebAudio oscillator, made on the
// spot. No audio files are loaded, so the game stays silent on the network.

let audioContext = null;
let muted = false;

/** Create (or reuse) the AudioContext. Called only from a user gesture. */
export function ensureAudio() {
  if (typeof window === 'undefined') return null;
  try {
    if (!audioContext) {
      const Ctor = window.AudioContext || window.webkitAudioContext;
      if (!Ctor) return null;
      audioContext = new Ctor();
    }
    if (audioContext.state === 'suspended') void audioContext.resume();
    return audioContext;
  } catch (err) {
    return null;
  }
}

/** True when the player has silenced the game (key M or the mute button). */
export function isMuted() {
  return muted;
}

/** Flip the mute flag and report the new state. */
export function toggleMute() {
  muted = !muted;
  return muted;
}

/** One short tone: `freq` in Hz, `seconds` long, `kind` an oscillator type. */
export function tone(freq, seconds, kind, when) {
  if (muted) return;
  const ctx = ensureAudio();
  if (!ctx) return;
  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = kind || 'sine';
    osc.frequency.value = freq;
    const start = ctx.currentTime + (when || 0);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.18, start + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + seconds);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(start);
    osc.stop(start + seconds + 0.05);
  } catch (err) {
    // A blocked AudioContext must never break the game.
  }
}

/** The named game sound: a card slide, a hit, a heal, a win flourish, a loss. */
export function playSound(name) {
  if (muted) return;
  switch (name) {
    case 'deal':
      tone(520, 0.08, 'triangle');
      break;
    case 'play':
      tone(660, 0.09, 'triangle');
      tone(880, 0.12, 'sine', 0.06);
      break;
    case 'hit':
      tone(180, 0.16, 'sawtooth');
      tone(120, 0.2, 'square', 0.03);
      break;
    case 'heal':
      tone(523, 0.12, 'sine');
      tone(784, 0.18, 'sine', 0.08);
      break;
    case 'shield':
      tone(392, 0.12, 'triangle');
      tone(523, 0.14, 'triangle', 0.07);
      break;
    case 'turn':
      tone(440, 0.08, 'sine');
      break;
    case 'win':
      [523, 659, 784, 1047].forEach((freq, i) => tone(freq, 0.22, 'triangle', i * 0.11));
      break;
    case 'lose':
      [392, 330, 262, 196].forEach((freq, i) => tone(freq, 0.25, 'sine', i * 0.13));
      break;
    default:
      break;
  }
}
