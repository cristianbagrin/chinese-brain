import { audioIn } from '../platform/compat.ts';
import { audio, playSave, playStamp } from '../shared/sounds.ts';
import type { Status, VoiceEngine } from '../shared/types.ts';
import { state } from './state.ts';

/** A rubber stamp on paper (see shared/sounds.ts), unless you switched sounds off. */
export function stampSound(status: Status | null) {
  if (state.settings.sounds) playStamp(status);
}

/** Saving a sentence: just the ink tick. */
export function saveSound() {
  if (state.settings.sounds) playSave();
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
    // Chrome's messages are JSON, so the audio comes as base64 there.
    buf = await ac.decodeAudioData(__CHROME__ ? audioIn(res.audio) : res.audio.slice(0));
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
