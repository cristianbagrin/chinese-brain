export type Status = 'fresh' | 'learning' | 'known';
export const STATUSES: Status[] = ['fresh', 'learning', 'known'];
/** Codes used in known-words.txt and the Claude export. */
export const STATUS_CODE: Record<Status, string> = { fresh: 'F', learning: 'L', known: 'K' };

/** One CC-CEDICT entry, with Taiwan reading and stats. */
export interface Entry {
  trad: string;
  simp: string;
  /** Numbered pinyin from CC-CEDICT, e.g. "xing1 qi1". */
  py: string;
  /** Numbered Taiwan (MOE) pinyin when it differs, else "". */
  tw: string;
  defs: string[];
  /** Zipf frequency * 10 (0 = unknown). 70+ very common, <30 rare. */
  zipf: number;
  /** TOCFL level 1..7 (0 = not in the list). Not shown; kept in the data. */
  tocfl: number;
  /** Frequency rank of the headword (1 = most common, 0 = unknown). */
  rank?: number;
}

export interface LookupMatch {
  /** The text that matched (as written on the page). */
  text: string;
  /** Canonical headword (traditional) used as the word-list key. */
  word: string;
  entries: Entry[];
}

export interface Token {
  text: string;
  /** Canonical traditional headword when the token is a dictionary word. */
  word?: string;
  /** Taiwan pinyin (numbered) for the token, if known. */
  py?: string;
  /** Traditional form of the token text (differs when the source is simplified). */
  trad?: string;
}

export interface Context {
  text: string;
  url: string;
  title?: string;
  /** Seconds into the video, for YouTube contexts. */
  t?: number;
  at: number;
  src: 'yt' | 'web';
}

export interface WordRecord {
  w: string;
  s: Status;
  /** Taiwan pinyin with tone marks, captured when saved. */
  p?: string;
  /** Short gloss captured when saved. */
  g?: string;
  added: number;
  updated: number;
  /** Status changes over time (oldest first). */
  hist: { t: number; s: Status }[];
  /** How many times the word was looked up. */
  looks: number;
  ctx: Context[];
}

export type LogEvent =
  | { at: number; k: 'look'; w: string; src: 'yt' | 'web'; url?: string }
  | { at: number; k: 'status'; w: string; s: Status | null; from?: Status | null }
  | { at: number; k: 'watch'; url: string; title?: string; secs: number; coverage?: number; lang?: string };

export type TranslationMode = 'show' | 'blur' | 'hide';
export type HoverMode = 'hover' | 'shift' | 'off';
export type VoiceEngine = 'google' | 'system' | 'azure';

export interface Settings {
  hoverMode: HoverMode;
  disabledSites: string[];
  /** Our subtitles on YouTube (the switch in the player). */
  ytEnabled: boolean;
  /** Pinyin everywhere: above subtitle words, in the card and in word hints (P toggles it). */
  pinyin: boolean;
  /** Show the English line. */
  translation: TranslationMode;
  /** Pause while the mouse is over the subtitles. */
  pauseOnHover: boolean;
  /** Clicking a new word in subtitles marks it Fresh (clicking again undoes it). */
  autoFreshOnClick: boolean;
  subFontSize: number;
  /** Subtitle band: light (default) or dark. */
  subStyle: 'light' | 'dark';
  /** Shadowing: seconds to wait = line duration * factor. */
  shadowFactor: number;
  /** Lookup card text size. */
  cardSize: 'normal' | 'large';
  /** Color the Chinese words inside the card by status. */
  cardColors: boolean;
  /** Short sound when stamping a status. */
  sounds: boolean;
  /** Color words by status on every page (highlighter style). */
  pageColors: boolean;
  speechRate: number;
  /** Who reads words aloud: Google's online voice, the system voice, or Azure (own key). */
  voice: VoiceEngine;
  /** Optional Azure neural voice (free tier). */
  azureKey: string;
  azureRegion: string;
  azureVoice: string;
  /** Optional Gemini key for transcribing caption-less videos (opt-in per video). */
  geminiKey: string;
  geminiModel: string;
}

export const DEFAULT_SETTINGS: Settings = {
  hoverMode: 'hover',
  disabledSites: [],
  ytEnabled: true,
  pinyin: true,
  translation: 'blur',
  pauseOnHover: true,
  autoFreshOnClick: true,
  subFontSize: 30,
  subStyle: 'light',
  shadowFactor: 1.5,
  cardSize: 'normal',
  cardColors: true,
  sounds: true,
  pageColors: false,
  speechRate: 0.9,
  voice: 'google',
  azureKey: '',
  azureRegion: 'eastasia',
  azureVoice: 'zh-TW-HsiaoChenNeural',
  geminiKey: '',
  geminiModel: 'gemini-3.8-flash',
};

/** Stored settings (possibly from an older version) merged over the defaults. */
export function normalizeSettings(raw: Record<string, unknown> | undefined): Settings {
  const r = { ...(raw ?? {}) };
  // One pinyin switch replaced the separate subtitle and card ones.
  if (r.pinyin === undefined && (r.subPinyin !== undefined || r.cardPinyin !== undefined)) {
    r.pinyin = r.subPinyin === true || r.cardPinyin !== 'hover';
  }
  // Before the voice choice existed, an Azure key meant "use Azure".
  if (r.voice === undefined && typeof r.azureKey === 'string' && r.azureKey) r.voice = 'azure';
  delete r.subPinyin;
  delete r.cardPinyin;
  delete r.markUntracked; // the dotted underline on new subtitle words was dropped
  return { ...DEFAULT_SETTINGS, ...(r as Partial<Settings>) };
}

/** Language of the second subtitle line. */
export const TRANS_LANG = 'en';

export type Msg =
  | { type: 'lookup'; text: string }
  | { type: 'segment'; lines: string[] }
  | { type: 'statuses' }
  | { type: 'setStatus'; word: string; status: Status | null; entry?: Entry; ctx?: Context }
  | { type: 'looked'; word: string; src: 'yt' | 'web'; url?: string; entry?: Entry; ctx?: Context }
  | { type: 'getWord'; word: string }
  | { type: 'settings' }
  | { type: 'saveSettings'; settings: Partial<Settings> }
  | { type: 'watch'; url: string; title?: string; secs: number; coverage?: number; lang?: string };
