// The stamp sounds, made with Web Audio (no files). Used by the card and by the website's dashboard.
import type { Status } from './types.ts';

let ctx: AudioContext | undefined;
export function audio(): AudioContext {
  ctx ??= new AudioContext();
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

/** Where the stamp sounds go: a compressor lets the hits be loud without clipping. */
let sfx: { out: GainNode; noise: AudioBuffer } | undefined;
function stampOut(ac: AudioContext) {
  if (!sfx) {
    const comp = ac.createDynamicsCompressor();
    comp.threshold.value = -12;
    comp.knee.value = 8;
    comp.ratio.value = 4;
    comp.attack.value = 0.002;
    comp.release.value = 0.15;
    const out = ac.createGain();
    out.gain.value = 0.8;
    out.connect(comp).connect(ac.destination);
    const noise = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
    const d = noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    sfx = { out, noise };
  }
  return sfx;
}

function envelope(g: GainNode, at: number, peak: number, attack: number, len: number) {
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(peak, at + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, at + len);
}

/** A note with a fast attack and an exponential tail (no clicks); with `to`, its pitch falls there. */
function note(ac: AudioContext, freq: number, at: number, len: number, gain: number, type: OscillatorType = 'sine', to?: number, drop = len / 2) {
  const o = ac.createOscillator();
  const g = ac.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, at);
  if (to) o.frequency.exponentialRampToValueAtTime(to, at + drop);
  envelope(g, at, gain, 0.003, len);
  o.connect(g).connect(stampOut(ac).out);
  o.start(at);
  o.stop(at + len + 0.03);
}

/** A burst of filtered noise: the rubber and the paper. */
function noise(ac: AudioContext, at: number, len: number, gain: number, type: BiquadFilterType, freq: number, q = 0.8) {
  const s = ac.createBufferSource();
  const f = ac.createBiquadFilter();
  const g = ac.createGain();
  s.buffer = stampOut(ac).noise;
  f.type = type;
  f.frequency.value = freq;
  f.Q.value = q;
  envelope(g, at, gain, 0.001, len);
  s.connect(f).connect(g).connect(stampOut(ac).out);
  s.start(at, Math.random() * 0.5);
  s.stop(at + len + 0.03);
}

/** The weight of a stamp: a falling sine plus its octave, so laptop speakers carry it too. */
function thump(ac: AudioContext, at: number, freq: number, gain: number, len: number) {
  note(ac, freq, at, len, gain, 'sine', freq * 0.42, len * 0.55);
  note(ac, freq * 2, at, len * 0.55, gain * 0.35, 'sine', freq * 0.84, len * 0.4);
}

/** Thud and ink tick per status: 新 the brightest, 學 in the middle, 熟 the lowest with a fifth. */
const STAMP: Record<Status, [thud: number, tick: number]> = { fresh: [190, 1320], learning: [160, 880], known: [135, 660] };

/**
 * A rubber stamp hitting paper on a desk: slap, thud, then a short ink tick in the status's own
 * pitch. Clearing a status is the stamp lifting off: lighter, no tick.
 */
export function playStamp(status: Status | null) {
  try {
    const ac = audio();
    const t = ac.currentTime + 0.005;
    if (!status) {
      noise(ac, t, 0.03, 0.2, 'bandpass', 1800, 0.9);
      thump(ac, t, 120, 0.25, 0.09);
      return;
    }
    const [thud, tick] = STAMP[status];
    noise(ac, t, 0.035, 0.5, 'bandpass', 1100, 0.9);
    noise(ac, t, 0.07, 0.35, 'lowpass', 420);
    thump(ac, t, thud, 0.75, 0.15);
    note(ac, tick, t + 0.03, 0.12, 0.07, 'triangle');
    if (status === 'known') note(ac, tick * 1.5, t + 0.03, 0.16, 0.05, 'triangle');
  } catch {
    /* audio unavailable */
  }
}

/** Saving a sentence: just the ink tick, so it isn't mistaken for a stamp. */
export function playSave() {
  try {
    const ac = audio();
    const t = ac.currentTime + 0.005;
    noise(ac, t, 0.02, 0.18, 'bandpass', 2400, 1);
    note(ac, 1320, t, 0.1, 0.06, 'triangle');
    note(ac, 1980, t + 0.045, 0.12, 0.04, 'triangle');
  } catch {
    /* audio unavailable */
  }
}
