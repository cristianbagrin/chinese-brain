import type { Status, VoiceEngine } from '../shared/types.ts';
import { state } from './state.ts';

let ctx: AudioContext | undefined;
function audio(): AudioContext {
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
export function stampSound(status: Status | null) {
  if (!state.settings.sounds) return;
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
export function saveSound() {
  if (!state.settings.sounds) return;
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

// --- Speech -----------------------------------------------------------------

const clipCache = new Map<string, AudioBuffer>();
let playing: { src: AudioBufferSourceNode; gain: GainNode } | undefined;

/**
 * Speak a word with the chosen voice: Google's online Taiwan voice (default),
 * an Azure neural voice (own key), or the system voice. Google and Azure audio
 * is played through Web Audio with a short fade in and out, so it never ends
 * on a click; if they fail, the next voice in line takes over.
 */
export async function speak(text: string): Promise<{ engine: VoiceEngine; errors: string[] }> {
  const s = state.settings;
  const order: VoiceEngine[] = s.voice === 'azure' ? ['azure', 'google', 'system'] : s.voice === 'google' ? ['google', 'system'] : ['system'];
  const errors: string[] = [];
  for (const engine of order) {
    try {
      if (engine === 'system') {
        speakSystem(text);
        return { engine, errors };
      }
      if (engine === 'azure' && !s.azureKey) {
        errors.push('No Azure key yet.');
        continue;
      }
      await playClip(engine, text);
      return { engine, errors };
    } catch (e) {
      const msg = String(e instanceof Error ? e.message : e);
      errors.push(msg);
      console.warn(`[chinese-brain] ${engine} voice failed, trying the next one:`, msg);
    }
  }
  return { engine: 'system', errors };
}

async function playClip(engine: 'google' | 'azure', text: string) {
  const s = state.settings;
  const key = `${engine}|${engine === 'azure' ? s.azureVoice : ''}|${s.speechRate}|${text}`;
  const ac = audio();
  let buf = clipCache.get(key);
  if (!buf) {
    const res: { audio?: ArrayBuffer; error?: string } = await browser.runtime.sendMessage({ type: 'tts', engine, text });
    if (!res?.audio) throw new Error(res?.error ?? 'no audio');
    buf = await ac.decodeAudioData(res.audio.slice(0));
    if (clipCache.size > 100) clipCache.clear();
    clipCache.set(key, buf);
  }
  stopPlaying(ac);
  const src = ac.createBufferSource();
  const gain = ac.createGain();
  src.buffer = buf;
  const t = ac.currentTime + 0.01;
  const end = t + buf.duration;
  const fade = Math.min(0.04, buf.duration / 4);
  gain.gain.setValueAtTime(0, t);
  gain.gain.linearRampToValueAtTime(1, t + 0.008);
  gain.gain.setValueAtTime(1, end - fade);
  gain.gain.linearRampToValueAtTime(0, end);
  src.connect(gain).connect(ac.destination);
  src.start(t);
  src.stop(end + 0.02);
  playing = { src, gain };
  src.onended = () => {
    if (playing?.src === src) playing = undefined;
  };
}

/** Fade out whatever is still speaking (pressing V again mid-word). */
function stopPlaying(ac: AudioContext) {
  if (!playing) return;
  const { src, gain } = playing;
  const t = ac.currentTime;
  gain.gain.cancelScheduledValues(t);
  gain.gain.setValueAtTime(gain.gain.value, t);
  gain.gain.linearRampToValueAtTime(0, t + 0.02);
  try {
    src.stop(t + 0.03);
  } catch {
    /* already stopped */
  }
  playing = undefined;
}

let voice: SpeechSynthesisVoice | undefined;
function pickVoice() {
  const voices = speechSynthesis.getVoices();
  voice =
    voices.find((v) => /zh[-_]TW/i.test(v.lang) && /meijia|美佳/i.test(v.name)) ??
    voices.find((v) => /zh[-_]TW/i.test(v.lang)) ??
    voices.find((v) => /taiwan|台灣|臺灣/i.test(v.name)) ??
    voices.find((v) => v.lang.startsWith('zh'));
}
if ('speechSynthesis' in window) speechSynthesis.addEventListener?.('voiceschanged', pickVoice);

/** The browser's own voice (on a Mac: Meijia). Its audio can't be faded, so it may end with a click. */
function speakSystem(text: string) {
  if (!('speechSynthesis' in window)) return;
  if (!voice) pickVoice();
  if (speechSynthesis.speaking) speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(/[。！？.!?]$/.test(text) ? text : text + '。');
  u.lang = 'zh-TW';
  if (voice) u.voice = voice;
  u.rate = state.settings.speechRate;
  speechSynthesis.speak(u);
}
