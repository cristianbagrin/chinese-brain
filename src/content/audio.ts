import type { Status } from '../shared/types.ts';
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

const azureCache = new Map<string, AudioBuffer>();

/**
 * Speak a word. With an Azure key it uses a Taiwan neural voice, played through
 * Web Audio with a short fade so it ends cleanly. Otherwise the system voice
 * (on a Mac: Meijia), with a trailing full stop so the voice ends on a natural
 * pause instead of a hard cut.
 */
export async function speak(text: string) {
  const s = state.settings;
  if (s.azureKey) {
    try {
      await speakAzure(text);
      return;
    } catch (e) {
      console.warn('[chinese-brain] Azure speech failed, using the system voice', e);
    }
  }
  speakSystem(text);
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

async function speakAzure(text: string) {
  const s = state.settings;
  const key = `${s.azureVoice}|${s.speechRate}|${text}`;
  const ac = audio();
  let buf = azureCache.get(key);
  if (!buf) {
    const pct = Math.round((s.speechRate - 1) * 100);
    const ssml = `<speak version="1.0" xml:lang="zh-TW"><voice name="${s.azureVoice}"><prosody rate="${pct}%">${text.replace(/[<&>]/g, '')}</prosody></voice></speak>`;
    const data: ArrayBuffer = await browser.runtime.sendMessage({ type: 'azureTTS', ssml });
    if (!data) throw new Error('no audio');
    buf = await ac.decodeAudioData(data.slice(0));
    azureCache.set(key, buf);
  }
  const src = ac.createBufferSource();
  const g = ac.createGain();
  src.buffer = buf;
  const t = ac.currentTime;
  g.gain.setValueAtTime(1, t);
  g.gain.setValueAtTime(1, t + Math.max(0, buf.duration - 0.06));
  g.gain.linearRampToValueAtTime(0, t + buf.duration);
  src.connect(g).connect(ac.destination);
  src.start();
}
