import type { Status, VoiceEngine } from '../shared/types.ts';
import { state } from './state.ts';

let ctx: AudioContext | undefined;
function audio(): AudioContext {
  ctx ??= new AudioContext();
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

/** One soft note with a fast attack and an exponential tail (no clicks). */
function note(ac: AudioContext, freq: number, at: number, len: number, gain: number, type: OscillatorType = 'sine') {
  const o = ac.createOscillator();
  const g = ac.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, at);
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(gain, at + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, at + len);
  o.connect(g).connect(ac.destination);
  o.start(at);
  o.stop(at + len + 0.02);
}

/** Short, quiet confirmation sounds: each status has its own little figure. */
export function stampSound(status: Status | null) {
  if (!state.settings.sounds) return;
  try {
    const ac = audio();
    const t = ac.currentTime + 0.005;
    switch (status) {
      case 'fresh': // a bright double tap
        note(ac, 1046.5, t, 0.09, 0.05, 'triangle');
        note(ac, 1568, t + 0.055, 0.12, 0.04, 'triangle');
        break;
      case 'learning': // a single warm marimba-ish knock
        note(ac, 523.25, t, 0.16, 0.07);
        note(ac, 1046.5, t, 0.08, 0.02);
        break;
      case 'known': // a quick rising major arpeggio
        note(ac, 784, t, 0.1, 0.045);
        note(ac, 988, t + 0.05, 0.1, 0.045);
        note(ac, 1175, t + 0.1, 0.18, 0.05);
        break;
      default: // cleared: a soft falling blip
        note(ac, 440, t, 0.07, 0.035);
        note(ac, 330, t + 0.045, 0.1, 0.03);
    }
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
