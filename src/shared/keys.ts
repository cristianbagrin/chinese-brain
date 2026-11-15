import type { Settings } from './types.ts';

/** Everything a single key can do; each can be changed in Settings. */
export const KEY_ACTIONS = {
  fresh: { label: '新 Fresh', group: 'card', key: '1' },
  learning: { label: '學 Learning', group: 'card', key: '2' },
  known: { label: '熟 Known', group: 'card', key: '3' },
  remove: { label: 'Remove from your list', group: 'card', key: '0' },
  say: { label: 'Say it', group: 'card', key: 'v' },
  images: { label: 'Images', group: 'card', key: 'i' },
  prev: { label: 'Previous line', group: 'yt', key: 'a' },
  replay: { label: 'Replay line', group: 'yt', key: 's' },
  next: { label: 'Next line', group: 'yt', key: 'd' },
  loop: { label: 'Loop line', group: 'yt', key: 'r' },
  shadow: { label: 'Shadowing', group: 'yt', key: 'q' },
  pinyin: { label: 'Pinyin', group: 'yt', key: 'p' },
  english: { label: 'English line', group: 'yt', key: 'x' },
  transcript: { label: 'Transcript', group: 'yt', key: 'e' },
} as const;

export type KeyAction = keyof typeof KEY_ACTIONS;
export type KeyGroup = 'card' | 'yt';

/** The key for an action ('' when you switched it off). */
export function keyOf(s: Settings, action: KeyAction): string {
  return s.keys?.[action] ?? KEY_ACTIONS[action].key;
}

/** How a key is written on a button or in a hint. */
export function keyLabel(key: string): string {
  if (key === ' ') return 'Space';
  return key.length === 1 ? key.toUpperCase() : key.replace(/^Arrow/, '');
}

/** A key event as it is stored: one lowercase character, or the key's name. */
export function keyName(e: { key: string }): string {
  return e.key.length === 1 ? e.key.toLowerCase() : e.key;
}

/** Which action in this group the pressed key stands for. */
export function actionFor(s: Settings, e: { key: string }, group: KeyGroup): KeyAction | undefined {
  const k = keyName(e);
  for (const a of Object.keys(KEY_ACTIONS) as KeyAction[]) {
    if (KEY_ACTIONS[a].group === group && keyOf(s, a) === k) return a;
  }
  return undefined;
}
