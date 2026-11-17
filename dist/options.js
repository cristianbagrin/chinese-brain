"use strict";
(() => {
  // src/shared/sounds.ts
  var ctx;
  function audio() {
    return ctx ??= new AudioContext(), ctx.state === "suspended" && ctx.resume(), ctx;
  }

  // src/shared/types.ts
  var DEFAULT_SETTINGS = {
    hoverMode: "hover",
    disabledSites: [],
    ytEnabled: !0,
    pinyin: !0,
    translation: "blur",
    pauseOnHover: !0,
    autoFreshOnClick: !0,
    subFontSize: 30,
    subStyle: "light",
    shadowFactor: 1.5,
    cardSize: "normal",
    cardColors: !0,
    sounds: !0,
    pageColors: !1,
    siteColors: {},
    speechRate: 0.9,
    voice: "google",
    azureKey: "",
    azureRegion: "eastasia",
    azureVoice: "zh-TW-HsiaoChenNeural",
    geminiKey: "",
    geminiModel: "gemini-3.8-flash",
    keys: {}
  };
  function normalizeSettings(raw) {
    let r = { ...raw ?? {} };
    return r.pinyin === void 0 && (r.subPinyin !== void 0 || r.cardPinyin !== void 0) && (r.pinyin = r.subPinyin === !0 || r.cardPinyin !== "hover"), r.voice === void 0 && typeof r.azureKey == "string" && r.azureKey && (r.voice = "azure"), r.hoverMode === "shift" && (r.hoverMode = "alt"), delete r.subPinyin, delete r.cardPinyin, delete r.markUntracked, { ...DEFAULT_SETTINGS, ...r };
  }
  function colorsOn(s, host) {
    return s.siteColors[host] ?? s.pageColors;
  }

  // src/content/state.ts
  var State = class {
    settings = { ...DEFAULT_SETTINGS };
    statuses = /* @__PURE__ */ new Map();
    statusesLoaded;
    settingsLoaded;
    listeners = /* @__PURE__ */ new Set();
    constructor() {
      this.settingsLoaded = browser.storage.local.get("settings").then(({ settings: settings2 }) => {
        this.settings = normalizeSettings(settings2);
      }), browser.storage.onChanged.addListener((changes, area) => {
        if (area !== "local") return;
        let dirty = !1;
        for (let [k, ch] of Object.entries(changes))
          if (k === "settings")
            this.settings = normalizeSettings(ch.newValue), dirty = !0;
          else if (k.startsWith("w:") && this.statusesLoaded) {
            let rec = ch.newValue;
            rec ? this.statuses.set(k.slice(2), rec.s) : this.statuses.delete(k.slice(2)), dirty = !0;
          }
        dirty && this.listeners.forEach((l) => l());
      });
    }
    ready() {
      return this.settingsLoaded;
    }
    loadStatuses() {
      return this.statusesLoaded ??= browser.runtime.sendMessage({ type: "statuses" }).then((s) => {
        this.statuses = new Map(Object.entries(s)), this.listeners.forEach((l) => l());
      }), this.statusesLoaded;
    }
    status(word) {
      return word ? this.statuses.get(word) : void 0;
    }
    onChange(l) {
      return this.listeners.add(l), () => this.listeners.delete(l);
    }
    /** Color the words on this page? */
    colorsEnabled() {
      return this.siteEnabled() && colorsOn(this.settings, location.hostname);
    }
    siteEnabled() {
      return this.settings.hoverMode !== "off" && !this.settings.disabledSites.includes(location.hostname);
    }
  }, state = new State();

  // src/content/audio.ts
  var clipCache = /* @__PURE__ */ new Map(), playing;
  async function speak(text) {
    let s = state.settings, order = s.voice === "azure" ? ["azure", "google", "system"] : s.voice === "google" ? ["google", "system"] : ["system"], errors = [];
    for (let engine of order)
      try {
        if (engine === "system")
          return speakSystem(text), { engine, errors };
        if (engine === "azure" && !s.azureKey) {
          errors.push("No Azure key yet.");
          continue;
        }
        return await playClip(engine, text), { engine, errors };
      } catch (e) {
        let msg = String(e instanceof Error ? e.message : e);
        errors.push(msg), console.warn(`[chinese-brain] ${engine} voice failed, trying the next one:`, msg);
      }
    return { engine: "system", errors };
  }
  async function playClip(engine, text) {
    let s = state.settings, key = `${engine}|${engine === "azure" ? s.azureVoice : ""}|${s.speechRate}|${text}`, ac = audio(), buf = clipCache.get(key);
    if (!buf) {
      let res = await browser.runtime.sendMessage({ type: "tts", engine, text });
      if (!res?.audio) throw new Error(res?.error ?? "no audio");
      buf = await ac.decodeAudioData(res.audio.slice(0)), clipCache.size > 100 && clipCache.clear(), clipCache.set(key, buf);
    }
    stopPlaying(ac);
    let src = ac.createBufferSource(), gain = ac.createGain();
    src.buffer = buf;
    let t = ac.currentTime + 0.01, end = t + buf.duration, fade = Math.min(0.04, buf.duration / 4);
    gain.gain.setValueAtTime(0, t), gain.gain.linearRampToValueAtTime(1, t + 8e-3), gain.gain.setValueAtTime(1, end - fade), gain.gain.linearRampToValueAtTime(0, end), src.connect(gain).connect(ac.destination), src.start(t), src.stop(end + 0.02), playing = { src, gain }, src.onended = () => {
      playing?.src === src && (playing = void 0);
    };
  }
  function stopPlaying(ac) {
    if (!playing) return;
    let { src, gain } = playing, t = ac.currentTime;
    gain.gain.cancelScheduledValues(t), gain.gain.setValueAtTime(gain.gain.value, t), gain.gain.linearRampToValueAtTime(0, t + 0.02);
    try {
      src.stop(t + 0.03);
    } catch {
    }
    playing = void 0;
  }
  var voice;
  function pickVoice() {
    let voices = speechSynthesis.getVoices();
    voice = voices.find((v) => /zh[-_]TW/i.test(v.lang) && /meijia|美佳/i.test(v.name)) ?? voices.find((v) => /zh[-_]TW/i.test(v.lang)) ?? voices.find((v) => /taiwan|台灣|臺灣/i.test(v.name)) ?? voices.find((v) => v.lang.startsWith("zh"));
  }
  "speechSynthesis" in window && speechSynthesis.addEventListener?.("voiceschanged", pickVoice);
  function speakSystem(text) {
    if (!("speechSynthesis" in window)) return;
    voice || pickVoice(), speechSynthesis.speaking && speechSynthesis.cancel();
    let u = new SpeechSynthesisUtterance(/[。！？.!?]$/.test(text) ? text : text + "\u3002");
    u.lang = "zh-TW", voice && (u.voice = voice), u.rate = state.settings.speechRate, speechSynthesis.speak(u);
  }

  // src/shared/keys.ts
  var KEY_ACTIONS = {
    fresh: { label: "\u65B0 Fresh", group: "card", key: "1" },
    learning: { label: "\u5B78 Learning", group: "card", key: "2" },
    known: { label: "\u719F Known", group: "card", key: "3" },
    remove: { label: "Remove from your list", group: "card", key: "0" },
    say: { label: "Say it", group: "card", key: "v" },
    images: { label: "Images", group: "card", key: "i" },
    prev: { label: "Previous line", group: "yt", key: "a" },
    replay: { label: "Replay line", group: "yt", key: "s" },
    next: { label: "Next line", group: "yt", key: "d" },
    loop: { label: "Loop line", group: "yt", key: "r" },
    shadow: { label: "Shadowing", group: "yt", key: "q" },
    pinyin: { label: "Pinyin", group: "yt", key: "p" },
    english: { label: "English line", group: "yt", key: "x" },
    transcript: { label: "Transcript", group: "yt", key: "e" }
  };
  function keyOf(s, action) {
    return s.keys?.[action] ?? KEY_ACTIONS[action].key;
  }
  function keyLabel(key) {
    return key === " " ? "Space" : key.length === 1 ? key.toUpperCase() : key.replace(/^Arrow/, "");
  }
  function keyName(e) {
    return e.key.length === 1 ? e.key.toLowerCase() : e.key;
  }

  // src/shared/time.ts
  function today() {
    let d = /* @__PURE__ */ new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  // src/pages/common.ts
  function download(name, content, type = "text/plain;charset=utf-8") {
    let url = URL.createObjectURL(new Blob([content], { type })), a = document.createElement("a");
    a.href = url, a.download = name, document.body.append(a), a.click(), a.remove(), setTimeout(() => URL.revokeObjectURL(url), 1e4);
  }
  var $ = (id) => document.getElementById(id);
  function ago(t) {
    let s = (Date.now() - t) / 1e3;
    if (s < 90) return "just now";
    if (s < 3600) return `${Math.round(s / 60)} min ago`;
    if (s < 86400 * 2) return `${Math.round(s / 3600)} h ago`;
    if (s < 86400 * 30) return `${Math.round(s / 86400)} days ago`;
    let d = new Date(t);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", ...d.getFullYear() === (/* @__PURE__ */ new Date()).getFullYear() ? {} : { year: "numeric" } });
  }
  var SUPPORT = "chris@cristianbagrin.com", DASHBOARD = "https://chinese.cristianbagrin.com/brain/dashboard", MAC = /Mac|iPhone|iPad/.test(navigator.platform), ALT = MAC ? "\u2325 Option" : "Alt", shortcutLabel = (key) => key ? MAC ? key.replace("Alt", "\u2325 Option").replace("Ctrl", "\u2303 Control").replace("Command", "\u2318") : key : "not set";
  function feedbackLink() {
    let body = `


(Reporting a bug? Say what happened and on which page or video. A screenshot helps a lot.)
--
Chinese Brain ${browser.runtime.getManifest().version} \xB7 ${navigator.userAgent}`;
    return `mailto:${SUPPORT}?subject=${encodeURIComponent("Chinese Brain feedback")}&body=${encodeURIComponent(body)}`;
  }

  // src/pages/options.ts
  var AZURE_REGIONS = [
    "eastasia",
    "southeastasia",
    "japaneast",
    "japanwest",
    "koreacentral",
    "centralindia",
    "australiaeast",
    "westeurope",
    "northeurope",
    "uksouth",
    "francecentral",
    "germanywestcentral",
    "swedencentral",
    "switzerlandnorth",
    "norwayeast",
    "italynorth",
    "eastus",
    "eastus2",
    "westus",
    "westus2",
    "westus3",
    "centralus",
    "northcentralus",
    "southcentralus",
    "westcentralus",
    "canadacentral",
    "brazilsouth",
    "southafricanorth",
    "uaenorth",
    "qatarcentral"
  ], settings, savedTimer;
  function setStatus(id, text, kind = "") {
    let el = $(id);
    el.textContent = text, el.className = `status ${kind}`;
  }
  function ensureOption(el, value, label = value) {
    value && ![...el.options].some((o) => o.value === value) && el.append(new Option(label, value));
  }
  function fill(el, key) {
    let v = settings[key];
    el instanceof HTMLInputElement && el.type === "checkbox" ? el.checked = !!v : Array.isArray(v) ? el.value = v.join(`
`) : (el instanceof HTMLSelectElement && ensureOption(el, String(v)), el.value = String(v));
  }
  async function save(key, el) {
    let def = DEFAULT_SETTINGS[key], value;
    if (el instanceof HTMLInputElement && el.type === "checkbox" ? value = el.checked : typeof def == "number" ? value = Number(el.value) || def : Array.isArray(def) ? value = el.value.split(/\s+/).map((x) => x.trim()).filter(Boolean) : value = el.value.trim(), JSON.stringify(settings[key]) === JSON.stringify(value)) return;
    settings = { ...settings, [key]: value }, state.settings = settings, await browser.runtime.sendMessage({ type: "saveSettings", settings: { [key]: value } });
    let tag = $("saved");
    tag.classList.add("show"), clearTimeout(savedTimer), savedTimer = setTimeout(() => tag.classList.remove("show"), 1400), key === "voice" && showAzure(), key === "azureKey" && setStatus("azureStatus", ""), key === "geminiKey" && setStatus("geminiStatus", "");
  }
  function showSites() {
    let sites = Object.entries(settings.siteColors).sort(([a], [b]) => a.localeCompare(b));
    $("siteColorsRow").hidden = !sites.length, $("siteColors").replaceChildren(
      ...sites.map(([host, on]) => {
        let b = document.createElement("button");
        b.type = "button", b.className = on ? "on" : "off", b.title = "Forget this website\u2019s own setting";
        let flag = document.createElement("b");
        flag.textContent = on ? "on" : "off";
        let x = document.createElement("i");
        return x.textContent = "\xD7", b.append(host.replace(/^www\./, ""), flag, x), b.addEventListener("click", async () => {
          let siteColors = { ...settings.siteColors };
          delete siteColors[host], settings = { ...settings, siteColors }, state.settings = settings, await browser.runtime.sendMessage({ type: "saveSettings", settings: { siteColors } }), showSites();
        }), b;
      })
    );
  }
  function segmented(sel) {
    let seg = document.createElement("div");
    seg.className = "seg still", seg.setAttribute("role", "radiogroup");
    let label = document.querySelector(`label[for="${sel.id}"]`)?.textContent?.trim();
    label && seg.setAttribute("aria-label", label);
    let thumb = document.createElement("i");
    thumb.className = "thumb";
    let buttons = [...sel.options].map((o) => {
      let b = document.createElement("button");
      return b.type = "button", b.setAttribute("role", "radio"), b.dataset.v = o.value, b.textContent = o.dataset.short ?? o.textContent, o.title && (b.title = o.title), b.addEventListener("click", () => pick(o.value)), b;
    }), sync = () => {
      for (let b of buttons) {
        let on = b.dataset.v === sel.value;
        b.setAttribute("aria-checked", String(on)), b.tabIndex = on ? 0 : -1, on && b.offsetWidth && (thumb.style.width = `${b.offsetWidth}px`, thumb.style.transform = `translateX(${b.offsetLeft}px)`);
      }
    }, pick = (v) => {
      sel.value !== v && (seg.classList.remove("still"), sel.value = v, sel.dispatchEvent(new Event("change")), sync());
    };
    seg.addEventListener("keydown", (e) => {
      let step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
      if (!step) return;
      e.preventDefault();
      let i = Math.min(buttons.length - 1, Math.max(0, sel.selectedIndex + step));
      pick(sel.options[i].value), buttons[i].focus();
    }), seg.append(thumb, ...buttons), sel.hidden = !0, sel.after(seg), sync(), new ResizeObserver(() => {
      seg.classList.add("still"), sync();
    }).observe(seg);
  }
  function stepper(input) {
    let wrap = document.createElement("span");
    wrap.className = "stepper";
    let btn = (text, label, dir) => {
      let b = document.createElement("button");
      return b.type = "button", b.textContent = text, b.setAttribute("aria-label", label), b.addEventListener("click", () => {
        dir > 0 ? input.stepUp() : input.stepDown(), input.dispatchEvent(new Event("change")), sync();
      }), b;
    }, minus = btn("\u2212", "Less", -1), plus = btn("+", "More", 1), sync = () => {
      minus.disabled = Number(input.value) <= Number(input.min), plus.disabled = Number(input.value) >= Number(input.max);
    }, val = document.createElement("span");
    if (val.className = "val", input.replaceWith(wrap), val.append(input), input.dataset.unit) {
      let u = document.createElement("span");
      u.className = "unit", u.textContent = input.dataset.unit, val.append(u);
    }
    wrap.append(minus, val, plus), input.addEventListener("input", sync), sync();
  }
  function followSections() {
    let links = [...document.querySelectorAll(".toc a")], mark = (id) => links.forEach((a) => a.setAttribute("aria-current", String(a.hash === `#${id}`))), secs = [...document.querySelectorAll("main .sec")], update = () => {
      let line = Math.min(window.innerHeight * 0.3, 240), current = secs[0];
      for (let s of secs) s.getBoundingClientRect().top <= line && (current = s);
      window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2 && (current = secs[secs.length - 1]), mark(current.id), links.find((a) => a.hash === `#${current.id}`)?.scrollIntoView({ block: "nearest", inline: "nearest" });
    }, raf = 0;
    window.addEventListener("scroll", () => {
      cancelAnimationFrame(raf), raf = requestAnimationFrame(update);
    }, { passive: !0 }), new ResizeObserver(update).observe(document.querySelector("main"));
  }
  function showAzure() {
    document.querySelectorAll(".azure").forEach((el) => el.hidden = settings.voice !== "azure");
  }
  async function init() {
    settings = await browser.runtime.sendMessage({ type: "settings" }), state.settings = settings;
    let region = $("azureRegion");
    for (let r of AZURE_REGIONS) region.append(new Option(r, r));
    let model = $("geminiModel");
    ensureOption(model, settings.geminiModel);
    for (let key of Object.keys(DEFAULT_SETTINGS)) {
      let el = $(key);
      if (el && (fill(el, key), el.addEventListener("change", () => void save(key, el)), el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement && /^(text|password|number)$/.test(el.type))) {
        let t;
        el.addEventListener("input", () => {
          clearTimeout(t), t = setTimeout(() => void save(key, el), 500);
        });
      }
    }
    for (let sel of document.querySelectorAll("select[data-seg]")) segmented(sel);
    for (let input of document.querySelectorAll('input[type="number"]')) stepper(input);
    showAzure(), showSites(), showKeys(), followSections(), settings.geminiKey && loadModels(!1), showAccount().finally(() => {
      location.hash && document.getElementById(location.hash.slice(1))?.scrollIntoView({ behavior: "instant" });
    });
  }
  function renderAccount(a, note = "") {
    if ($("acct").hidden = !1, $("signedOut").hidden = a.signedIn, $("signedIn").hidden = !a.signedIn, a.signedIn) {
      $("acctEmail").textContent = a.email, $("acctEmail").title = a.email, $("acctInitial").textContent = a.email.trim().charAt(0);
      let el = $("acctSync");
      el.textContent = a.error ?? (a.at ? `Synced ${ago(a.at)}` : "Syncing\u2026"), el.className = a.error ? "err" : a.at ? "" : "busy";
    } else
      a.email && !$("email").value && ($("email").value = a.email), setStatus("acctStatus", note || a.error || "", note ? "ok" : "err");
  }
  async function showAccount() {
    renderAccount(await browser.runtime.sendMessage({ type: "account" }));
  }
  async function signIn(create) {
    if (!$("signedOut").reportValidity()) return;
    try {
      if (!await browser.permissions.request({ data_collection: ["personallyIdentifyingInfo", "authenticationInfo"] })) return setStatus("acctStatus", "An account needs that permission.", "err");
    } catch {
    }
    setStatus("acctStatus", create ? "Creating your account\u2026" : "Signing in\u2026");
    let a = await browser.runtime.sendMessage({ type: "signIn", email: $("email").value, password: $("password").value, create });
    $("password").value = "", renderAccount(a);
  }
  $("signedOut").addEventListener("submit", (e) => {
    e.preventDefault(), signIn(!1);
  });
  $("signUp").addEventListener("click", () => void signIn(!0));
  $("forgot").addEventListener("click", async () => {
    let email = $("email");
    if (!email.value || !email.checkValidity())
      return email.focus(), setStatus("acctStatus", "Type your email first.", "err");
    setStatus("acctStatus", "Sending\u2026");
    let res = await browser.runtime.sendMessage({ type: "forgot", email: email.value });
    setStatus("acctStatus", res.ok ? "Check your inbox for a link to set a new password." : res.error ?? "That didn\u2019t work.", res.ok ? "ok" : "err");
  });
  $("syncNow").addEventListener("click", async () => {
    $("acctSync").textContent = "Syncing\u2026", $("acctSync").className = "busy", renderAccount(await browser.runtime.sendMessage({ type: "syncNow" }));
  });
  $("signOut").addEventListener("click", async () => renderAccount(await browser.runtime.sendMessage({ type: "signOut" }), "Signed out. Your words stay in this browser."));
  var recording;
  function showKeys() {
    for (let [id, group] of [["keysCard", "card"], ["keysYt", "yt"]])
      $(id).replaceChildren(
        ...Object.keys(KEY_ACTIONS).filter((a) => KEY_ACTIONS[a].group === group).map((a) => {
          let key = keyOf(settings, a), b = document.createElement("button");
          b.type = "button", b.textContent = key ? keyLabel(key) : "\u2014", b.className = key ? "" : "none", b.title = "Click, then press the new key (Backspace: no key)", b.addEventListener("click", () => record(a, b));
          let row = document.createElement("div");
          return row.append(KEY_ACTIONS[a].label, b), row;
        })
      );
  }
  function record(action, b) {
    recording?.(), b.textContent = "Press a key", b.className = "rec";
    let onKey = (e) => {
      if (/^(Shift|Control|Alt|Meta|CapsLock)$/.test(e.key) || (e.preventDefault(), e.stopPropagation(), recording?.(), e.key === "Escape")) return;
      let clear = e.key === "Backspace" || e.key === "Delete";
      if (!clear && (e.ctrlKey || e.metaKey || e.altKey || /^(Enter|Tab|Arrow|F\d|Page|Home|End)/.test(e.key))) return;
      let k = clear ? "" : keyName(e), keys = { ...settings.keys };
      if (k) for (let other of Object.keys(KEY_ACTIONS)) other !== action && keyOf(settings, other) === k && (keys[other] = "");
      k === KEY_ACTIONS[action].key ? delete keys[action] : keys[action] = k, saveKeys(keys);
    };
    recording = () => {
      window.removeEventListener("keydown", onKey, !0), recording = void 0, showKeys();
    }, window.addEventListener("keydown", onKey, !0);
  }
  async function saveKeys(keys) {
    settings = { ...settings, keys }, state.settings = settings, await browser.runtime.sendMessage({ type: "saveSettings", settings: { keys } }), showKeys();
  }
  $("resetKeys").addEventListener("click", () => void saveKeys({}));
  for (let el of document.querySelectorAll(".altKey")) el.textContent = ALT;
  $("altOption").textContent = `while holding ${ALT}`;
  $("altOption").dataset.short = `Hold ${ALT}`;
  browser.commands.getAll().then((cmds) => {
    $("colorKey").textContent = shortcutLabel(cmds.find((c) => c.name === "toggle-colors")?.shortcut), $("colorAllKey").textContent = shortcutLabel(cmds.find((c) => c.name === "toggle-colors-all")?.shortcut);
  }).catch(() => {
  });
  for (let b of document.querySelectorAll(".changeKey"))
    b.addEventListener("click", () => {
      {
        let f = browser.commands[["open", "ShortcutSettings"].join("")];
        f ? f() : alert('Open about:addons, click the gear, then "Manage Extension Shortcuts".');
      }
    });
  for (let a of document.querySelectorAll("a.words")) a.href = DASHBOARD;
  $("backup").addEventListener("click", async () => {
    let all = await browser.storage.local.get(null);
    delete all.acct, delete all["acct:dirty"], download(`chinese-brain-backup-${today()}.json`, JSON.stringify({ app: "chinese-brain", v: 1, at: Date.now(), data: all }), "application/json");
  });
  $("restore").addEventListener("change", async (e) => {
    let f = e.target.files?.[0];
    if (!f) return;
    let data;
    try {
      let json = JSON.parse(await f.text());
      json.app === "chinese-brain" && (data = json.data);
    } catch {
    }
    if (!data) return setStatus("backupStatus", "That isn\u2019t a Chinese Brain backup.", "err");
    let recs = Object.entries(data).filter(([k]) => k.startsWith("w:")).map(([, v]) => v), n = await browser.runtime.sendMessage({ type: "importWords", words: recs, mode: "merge" }), existing = await browser.storage.local.get(null), extra = {};
    for (let [k, v] of Object.entries(data)) !k.startsWith("w:") && !k.startsWith("acct") && !(k in existing) && (extra[k] = v);
    await browser.storage.local.set(extra), setStatus("backupStatus", `\u2713 Restored ${n} word${n === 1 ? "" : "s"}.`, "ok");
  });
  $("version").textContent = browser.runtime.getManifest().version;
  $("feedback").href = feedbackLink();
  $("testVoice").addEventListener("click", async () => {
    setStatus("voiceStatus", "Playing\u2026");
    let res = await speak("\u4F60\u597D\uFF0C\u5F88\u9AD8\u8208\u8A8D\u8B58\u4F60"), names = { google: "Google voice", azure: "Azure voice", system: "system voice" };
    res.engine === settings.voice ? setStatus("voiceStatus", `\u2713 ${names[res.engine]}`, "ok") : setStatus("voiceStatus", `${res.errors[0] ?? "Failed"} Used the ${names[res.engine]} instead.`, "err");
  });
  $("checkAzure").addEventListener("click", async () => {
    let key = $("azureKey");
    await save("azureKey", key), setStatus("azureStatus", "Checking\u2026");
    let res = await browser.runtime.sendMessage({
      type: "azureCheck",
      key: key.value,
      region: settings.azureRegion
    });
    if (!res.ok) return setStatus("azureStatus", res.error ?? "The key did not work.", "err");
    let region = $("azureRegion");
    res.region && res.region !== settings.azureRegion && (ensureOption(region, res.region), region.value = res.region, await save("azureRegion", region)), setStatus("azureStatus", `\u2713 The key works (region ${res.region}).`, "ok");
  });
  async function loadModels(report) {
    let key = $("geminiKey").value.trim();
    if (!key) return setStatus("geminiStatus", "Paste your Gemini API key first.", "err");
    report && setStatus("geminiStatus", "Checking\u2026");
    let res = await browser.runtime.sendMessage({ type: "geminiModels", key });
    if (!res.models) return setStatus("geminiStatus", res.error ?? "The key did not work.", "err");
    let sel = $("geminiModel");
    sel.replaceChildren(...res.models.map((m) => new Option(`${m.name}  (${m.id})`, m.id)));
    let current = settings.geminiModel;
    if (res.models.some((m) => m.id === current)) sel.value = current;
    else {
      let pick = res.models.find((m) => /flash/.test(m.id) && !/lite|preview|exp/.test(m.id)) ?? res.models[0];
      pick && (sel.value = pick.id, await save("geminiModel", sel));
    }
    report && setStatus("geminiStatus", `\u2713 The key works. ${res.models.length} models available.`, "ok");
  }
  $("checkGemini").addEventListener("click", async () => {
    await save("geminiKey", $("geminiKey")), await loadModels(!0);
  });
  init();
})();
