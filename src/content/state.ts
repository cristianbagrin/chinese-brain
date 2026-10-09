import { DEFAULT_SETTINGS, normalizeSettings, type Settings, type Status, type WordRecord } from '../shared/types.ts';

type Listener = () => void;

/** Settings and word statuses, kept live through storage.onChanged. */
class State {
  settings: Settings = { ...DEFAULT_SETTINGS };
  statuses = new Map<string, Status>();
  private statusesLoaded: Promise<void> | undefined;
  private settingsLoaded: Promise<void>;
  private listeners = new Set<Listener>();

  constructor() {
    this.settingsLoaded = browser.storage.local.get('settings').then(({ settings }) => {
      this.settings = normalizeSettings(settings as Record<string, unknown> | undefined);
    });
    browser.storage.onChanged.addListener((changes, area) => {
      if (area !== 'local') return;
      let dirty = false;
      for (const [k, ch] of Object.entries(changes)) {
        if (k === 'settings') {
          this.settings = normalizeSettings(ch.newValue as Record<string, unknown> | undefined);
          dirty = true;
        } else if (k.startsWith('w:') && this.statusesLoaded) {
          const rec = ch.newValue as WordRecord | undefined;
          if (rec) this.statuses.set(k.slice(2), rec.s);
          else this.statuses.delete(k.slice(2));
          dirty = true;
        }
      }
      if (dirty) this.listeners.forEach((l) => l());
    });
  }

  ready() {
    return this.settingsLoaded;
  }

  loadStatuses(): Promise<void> {
    this.statusesLoaded ??= browser.runtime.sendMessage({ type: 'statuses' }).then((s: Record<string, Status>) => {
      this.statuses = new Map(Object.entries(s));
      this.listeners.forEach((l) => l());
    });
    return this.statusesLoaded;
  }

  status(word: string | undefined): Status | undefined {
    return word ? this.statuses.get(word) : undefined;
  }

  onChange(l: Listener) {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  }

  siteEnabled(): boolean {
    return this.settings.hoverMode !== 'off' && !this.settings.disabledSites.includes(location.hostname);
  }
}

export const state = new State();
