"use strict";
(() => {
  // src/shared/time.ts
  function dayKeyLocal(t) {
    let d = new Date(t);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }
  function clock(secs) {
    let s = Math.max(0, Math.floor(secs)), h2 = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), ss = String(s % 60).padStart(2, "0");
    return h2 ? `${h2}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
  }

  // src/shared/types.ts
  var STATUS_CODE = { fresh: "F", learning: "L", known: "K" };

  // src/shared/export.ts
  var clean = (s) => (s ?? "").replace(/[\t\r\n]+/g, " ").trim(), stamp = (t) => {
    let d = new Date(t);
    return `${dayKeyLocal(t)} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  }, code = (s) => s ? STATUS_CODE[s] : "-";
  function shortSource(url, t) {
    try {
      let u = new URL(url);
      return u.hostname.endsWith("youtube.com") && u.searchParams.get("v") ? `youtu.be/${u.searchParams.get("v")}${t != null ? `?t=${Math.floor(t)}` : ""}` : u.hostname.replace(/^www\./, "");
    } catch {
      return "";
    }
  }
  function duration(secs) {
    let m = Math.round(secs / 60);
    return m >= 60 ? `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, "0")} min` : `${m} min`;
  }
  function buildClaudeExport(words2, logs2, since = 0) {
    let now = Date.now(), evs = logs2.filter((e) => e.at > since), looks = /* @__PURE__ */ new Map(), yt = 0;
    for (let e of evs)
      e.k === "look" && (looks.set(e.w, (looks.get(e.w) ?? 0) + 1), e.src === "yt" && yt++);
    let watches = evs.filter((e) => e.k === "watch"), byWord = new Map(words2.map((w) => [w.w, w])), before = /* @__PURE__ */ new Map();
    for (let e of evs) e.k === "status" && !before.has(e.w) && before.set(e.w, e.from ?? null);
    let rows = [];
    if (since)
      for (let w of /* @__PURE__ */ new Set([...before.keys(), ...looks.keys()])) {
        let rec = byWord.get(w), cur = rec?.s ?? null, was = before.has(w) ? before.get(w) : cur;
        was === cur && !looks.has(w) || rows.push({ w, now: cur, was, date: rec?.updated ?? now, rec });
      }
    else {
      for (let w of words2) rows.push({ w: w.w, now: w.s, was: null, date: w.updated, rec: w });
      for (let w of looks.keys()) byWord.has(w) || rows.push({ w, now: null, was: null, date: now });
    }
    let order = { K: 0, L: 1, F: 2, "-": 3 };
    rows.sort((a, b) => order[code(a.now)] - order[code(b.now)] || a.date - b.date);
    let changedCount = rows.filter((r) => r.now !== r.was).length, lines = [
      `# Chinese Brain export \xB7 ${stamp(now)} \xB7 ${since ? `since ${stamp(since)}` : "everything so far"}`,
      "# Codes as in known-words.txt: K known, L learning, F fresh (met, not studied yet), - not in the list.",
      "# was = status before this period (- = new). looks = deliberate lookups in this period (a K word looked up = forgotten).",
      `# ${changedCount} status changes \xB7 ${[...looks.values()].reduce((a, b) => a + b, 0)} lookups (YouTube ${yt}) \xB7 ${watches.length} videos with subtitles (${duration(watches.reduce((n, e) => n + e.secs, 0))})`,
      ["word", "now", "was", "date", "looks", "pinyin", "meaning", "sentence", "source"].join("	")
    ];
    for (let r of rows) {
      let c = r.rec?.ctx[0];
      lines.push(
        [r.w, code(r.now), code(r.was), dayKeyLocal(r.date), String(looks.get(r.w) ?? 0), r.rec?.p?.toLowerCase(), r.rec?.g, c?.text, c ? shortSource(c.url, c.t) : ""].map((x) => clean(x)).join("	")
      );
    }
    return lines.join(`
`) + `
`;
  }
  function parseWordList(text) {
    let out = [];
    for (let raw of text.split(/\r?\n/)) {
      let line = raw.trim();
      if (!line || line.startsWith("#")) continue;
      let cols = line.split(/\t|,|;/).map((c) => c.trim()), m = /[㐀-鿿豈-﫿]+/.exec(cols[0]) ?? /[㐀-鿿豈-﫿]+/.exec(line);
      if (!m) continue;
      let codeCol = cols.find((c, i) => i > 0 && /^[KLF]$/i.test(c))?.toUpperCase(), s = codeCol === "L" ? "learning" : codeCol === "F" ? "fresh" : "known", dateCol = cols.find((c) => /^\d{4}-\d{2}-\d{2}$/.test(c)), t = dateCol ? (/* @__PURE__ */ new Date(`${dateCol}T12:00:00`)).getTime() : 0;
      out.push({ w: m[0], s, t });
    }
    return out;
  }

  // src/pages/common.ts
  function download(name, content, type = "text/plain;charset=utf-8") {
    let url = URL.createObjectURL(new Blob([content], { type })), a = document.createElement("a");
    a.href = url, a.download = name, document.body.append(a), a.click(), a.remove(), setTimeout(() => URL.revokeObjectURL(url), 1e4);
  }
  function h(tag, attrs, ...kids) {
    let el = document.createElement(tag);
    if (attrs) for (let [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
    for (let k of kids) k && el.append(k);
    return el;
  }
  var $ = (id) => document.getElementById(id);
  function today() {
    let d = /* @__PURE__ */ new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }
  function ago(t) {
    let s = (Date.now() - t) / 1e3;
    return s < 90 ? "just now" : s < 3600 ? `${Math.round(s / 60)} min ago` : s < 86400 * 2 ? `${Math.round(s / 3600)} h ago` : new Date(t).toLocaleDateString();
  }

  // src/pages/vocab.ts
  var STAMPS = [
    ["fresh", "\u65B0", "Fresh"],
    ["learning", "\u5B78", "Learning"],
    ["known", "\u719F", "Known"]
  ], words = [], logs = [], filter = "all", PAGE = 300;
  async function load() {
    let data = await browser.runtime.sendMessage({ type: "allData" });
    words = data.words, logs = data.logs, render(), renderExportInfo();
  }
  function render() {
    let n = (s) => words.filter((w) => w.s === s).length;
    $("counts").replaceChildren(
      ...STAMPS.map(([s, zh, label]) => h("div", { class: `count ${s}` }, h("b", null, String(n(s))), h("span", null, `${zh} ${label}`))),
      h("div", { class: "count" }, h("b", null, String(words.length)), h("span", null, "in your list"))
    );
    let q = $("q").value.trim().toLowerCase(), sort = $("sort").value, list = words.filter((w) => filter === "all" || w.s === filter).filter((w) => !q || w.w.includes(q) || (w.p ?? "").toLowerCase().includes(q) || (w.g ?? "").toLowerCase().includes(q)).sort((a, b) => b[sort] - a[sort]);
    $("rows").replaceChildren(...list.slice(0, PAGE).map(row)), $("more").textContent = list.length > PAGE ? `Showing ${PAGE} of ${list.length}. Search to narrow it down.` : `${list.length} words`;
  }
  function row(w) {
    let c = w.ctx[0], link = null;
    if (c) {
      let yt = c.src === "yt" && c.t != null;
      link = h("a", { href: yt ? `${c.url}&t=${c.t}s` : c.url, target: "_blank", title: c.title ?? c.url }, yt ? `\u25B6 ${clock(c.t)}` : shortSource(c.url));
    }
    let pills = h(
      "div",
      { class: "pills" },
      ...STAMPS.map(([s, zh, label]) => {
        let b = h("button", { class: `pill ${s}${w.s === s ? " on" : ""}`, title: label }, zh);
        return b.addEventListener("click", () => setStatus(w, s)), b;
      })
    ), del = h("button", { class: "pill del", title: "Remove from the list" }, "\xD7");
    return del.addEventListener("click", () => setStatus(w, null)), pills.append(del, h("span", { class: "when" }, ago(w.updated))), h(
      "div",
      { class: `row ${w.s}` },
      h("div", { class: "w" }, h("b", null, w.w), h("span", null, (w.p ?? "").toLowerCase())),
      h("div", { class: "mean" }, w.g ?? "", c ? h("span", { class: "ctx" }, c.text.split(" \u2014 ")[0], link) : null),
      pills
    );
  }
  async function setStatus(w, s) {
    await browser.runtime.sendMessage({ type: "setStatus", word: w.w, status: s }), await load();
  }
  async function renderExportInfo() {
    let { lastExportAt } = await browser.storage.local.get("lastExportAt");
    $("lastExport").textContent = lastExportAt ? `Last export ${ago(lastExportAt)}. "Export what's new" covers everything since then.` : `Nothing exported yet. "Export what's new" will include everything so far.`;
  }
  $("q").addEventListener("input", render);
  $("sort").addEventListener("change", render);
  $("filter").addEventListener("click", (e) => {
    let b = e.target.closest("button");
    b && (filter = b.dataset.f, $("filter").querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", String(x === b))), render());
  });
  async function exportNew() {
    let at = Date.now(), data = await browser.runtime.sendMessage({ type: "allData" });
    words = data.words, logs = data.logs;
    let { lastExportAt } = await browser.storage.local.get("lastExportAt"), text = buildClaudeExport(words, logs, lastExportAt ?? 0);
    return await browser.storage.local.set({ lastExportAt: at }), render(), renderExportInfo(), text;
  }
  $("exportNew").addEventListener("click", async () => {
    download(`chinese-brain-${today()}.tsv`, await exportNew(), "text/tab-separated-values;charset=utf-8");
  });
  $("copyNew").addEventListener("click", async () => {
    await navigator.clipboard.writeText(await exportNew()), $("copyOk").textContent = "Copied. Paste it into Claude.";
  });
  $("exportAll").addEventListener("click", async () => {
    let data = await browser.runtime.sendMessage({ type: "allData" });
    download(`chinese-brain-all-${today()}.tsv`, buildClaudeExport(data.words, data.logs, 0), "text/tab-separated-values;charset=utf-8");
  });
  $("backup").addEventListener("click", async () => {
    let all = await browser.storage.local.get(null);
    download(`chinese-brain-backup-${today()}.json`, JSON.stringify({ app: "chinese-brain", v: 1, at: Date.now(), data: all }), "application/json");
  });
  $("restore").addEventListener("change", async (e) => {
    let f = e.target.files?.[0];
    if (!f) return;
    let json = JSON.parse(await f.text());
    if (json.app !== "chinese-brain") return alert("Not a Chinese Brain backup.");
    let recs = Object.entries(json.data).filter(([k]) => k.startsWith("w:")).map(([, v]) => v), n = await browser.runtime.sendMessage({ type: "importWords", words: recs, mode: "merge" }), existing = await browser.storage.local.get(null), extra = {};
    for (let [k, v] of Object.entries(json.data)) !k.startsWith("w:") && !(k in existing) && (extra[k] = v);
    await browser.storage.local.set(extra), alert(`Restored ${n} words.`), load();
  });
  $("knownFile").addEventListener("change", async (e) => {
    let f = e.target.files?.[0];
    f && ($("knownText").value = await f.text());
  });
  $("knownGo").addEventListener("click", async () => {
    let items = parseWordList($("knownText").value);
    if (!items.length) return;
    let n = await browser.runtime.sendMessage({ type: "importList", items }), { lastExportAt } = await browser.storage.local.get("lastExportAt");
    lastExportAt || await browser.storage.local.set({ lastExportAt: Date.now() });
    let by = (s) => items.filter((i) => i.s === s).length;
    $("knownOk").textContent = `${n} words updated (file: ${by("known")} K, ${by("learning")} L${by("fresh") ? `, ${by("fresh")} F` : ""})`, load();
  });
  var reloadTimer;
  browser.storage.onChanged.addListener((ch) => {
    Object.keys(ch).some((k) => k.startsWith("w:")) && (clearTimeout(reloadTimer), reloadTimer = setTimeout(load, 500));
  });
  load();
})();
