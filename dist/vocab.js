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

  // src/shared/export.ts
  var clean = (s) => (s ?? "").replace(/[\t\r\n]+/g, " ").trim(), iso = (t) => {
    let d = new Date(t);
    return `${dayKeyLocal(t)} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  };
  function videoLink(url, t) {
    if (t == null) return url;
    try {
      let u = new URL(url);
      if (u.hostname.endsWith("youtube.com") && u.searchParams.get("v"))
        return `https://youtu.be/${u.searchParams.get("v")}?t=${Math.floor(t)}`;
    } catch {
    }
    return url;
  }
  function buildWordsTsv(words2, since = 0) {
    let head = ["word", "status", "pinyin", "gloss", "added", "updated", "lookups", "history", "sentence", "source"], rows = words2.filter((w) => w.updated > since).sort((a, b) => a.added - b.added).map((w) => {
      let c = w.ctx[0], hist = w.hist.map((h2) => `${h2.s}@${dayKeyLocal(h2.t)}`).join(">");
      return [w.w, w.s, w.p, w.g, iso(w.added), iso(w.updated), String(w.looks), hist, c?.text, c ? videoLink(c.url, c.t) : ""].map(clean).join("	");
    });
    return [head.join("	"), ...rows].join(`
`) + `
`;
  }
  function buildEventsTsv(logs2, since = 0) {
    let head = ["time", "event", "word", "detail", "url"], rows = logs2.filter((e) => e.at > since).map((e) => {
      switch (e.k) {
        case "look":
          return [iso(e.at), "lookup", e.w, e.src, e.url ?? ""];
        case "status":
          return [iso(e.at), "status", e.w, `${e.from ?? "untracked"}>${e.s ?? "untracked"}`, ""];
        case "watch":
          return [
            iso(e.at),
            "watch",
            "",
            `${Math.round(e.secs / 60)} min${e.coverage != null ? `, knew ${Math.round(e.coverage * 100)}% of words` : ""}${e.title ? ` | ${e.title}` : ""}`,
            e.url
          ];
      }
    }).map((r) => r.map((x) => clean(x)).join("	"));
    return [head.join("	"), ...rows].join(`
`) + `
`;
  }
  function buildAnkiCsv(words2) {
    let q = (s) => `"${(s ?? "").replace(/"/g, '""')}"`;
    return ["word,pinyin,meaning,sentence,source,status", ...words2.map((w) => {
      let c = w.ctx[0];
      return [w.w, w.p, w.g, c?.text, c ? videoLink(c.url, c.t) : "", w.s].map(q).join(",");
    })].join(`
`) + `
`;
  }
  function buildClaudeMarkdown(words2, logs2, since = 0) {
    let now = Date.now(), changed = words2.filter((w) => w.updated > since), evs = logs2.filter((e) => e.at > since), looks = evs.filter((e) => e.k === "look"), watches = evs.filter((e) => e.k === "watch"), statusEvs = evs.filter((e) => e.k === "status"), by = (s) => changed.filter((w) => w.s === s).length, slipped = [...new Set(statusEvs.filter((e) => e.s === "difficult" && e.from && e.from !== "difficult").map((e) => e.w))], lookCount = /* @__PURE__ */ new Map();
    for (let e of looks) lookCount.set(e.w, (lookCount.get(e.w) ?? 0) + 1);
    let top = [...lookCount].sort((a, b) => b[1] - a[1]).slice(0, 15), mins = Math.round(watches.reduce((n, e) => n + e.secs, 0) / 60), lines = [
      "# Chinese Brain export",
      "",
      `Exported ${iso(now)}. ${since ? `Covers everything after ${iso(since)}.` : "Covers everything recorded so far."}`,
      "",
      "## Summary",
      `- Words added or changed: ${changed.length} (now ${by("fresh")} fresh, ${by("difficult")} difficult, ${by("known")} known)`,
      `- Whole list: ${words2.length} words (${words2.filter((w) => w.s === "known").length} known)`,
      `- Deliberate lookups: ${looks.length} (YouTube ${looks.filter((e) => e.src === "yt").length}, web ${looks.filter((e) => e.src === "web").length})`,
      `- Videos watched with subtitles: ${watches.length} (${mins} min)`,
      slipped.length ? `- Slipped back to difficult: ${slipped.join("\u3001")}` : "",
      top.length ? `- Most looked up: ${top.map(([w, n]) => n > 1 ? `${w} \xD7${n}` : w).join("\u3001")}` : "",
      "",
      "Statuses: fresh = met recently and learning; difficult = should know but keeps slipping; known = known. Pinyin is the Taiwan standard reading.",
      "",
      "## Words",
      "```tsv",
      buildWordsTsv(words2, since).trimEnd(),
      "```",
      "",
      "## Events",
      "```tsv",
      buildEventsTsv(logs2, since).trimEnd(),
      "```",
      ""
    ];
    return lines.filter((l, i) => l !== "" || lines[i - 1] !== "").join(`
`);
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
    ["fresh", "\u65B0"],
    ["difficult", "\u96E3"],
    ["known", "\u719F"]
  ], words = [], logs = [], filter = "all", PAGE = 300, limit = PAGE;
  async function load() {
    let data = await browser.runtime.sendMessage({ type: "allData" });
    words = data.words, logs = data.logs, render(), renderExportInfo();
  }
  function render() {
    let n = (s) => words.filter((w) => w.s === s).length;
    $("counts").replaceChildren(
      ...STAMPS.map(([s, zh]) => h("div", { class: s }, h("b", null, String(n(s))), h("span", null, `${zh} ${s}`))),
      h("div", null, h("b", null, String(words.length)), h("span", null, "total"))
    );
    let q = $("q").value.trim().toLowerCase(), sort = $("sort").value, list = words.filter((w) => filter === "all" || w.s === filter).filter((w) => !q || w.w.includes(q) || (w.p ?? "").toLowerCase().includes(q) || (w.g ?? "").toLowerCase().includes(q)).sort((a, b) => b[sort] - a[sort]);
    $("shown").textContent = `${list.length} shown`, $("rows").replaceChildren(...list.slice(0, limit).map(row)), $("more").textContent = list.length > limit ? `Showing ${limit} of ${list.length}. Search to narrow down.` : "";
  }
  function row(w) {
    let c = w.ctx[0], link = null;
    if (c) {
      let yt = c.src === "yt" && c.t != null, href = yt ? `${c.url}&t=${c.t}s` : c.url;
      link = h("a", { href, target: "_blank", title: c.title ?? c.url }, yt ? `\u25B6 ${clock(c.t)}` : new URL(c.url).hostname);
    }
    let stamps = h(
      "div",
      { class: "stamps" },
      ...STAMPS.map(([s, zh]) => {
        let b = h("button", { class: `stamp ${s}${w.s === s ? " on" : ""}`, title: s }, zh);
        return b.addEventListener("click", () => setStatus(w, s)), b;
      })
    ), del = h("button", { class: "stamp del", title: "remove from list" }, "\xD7");
    return del.addEventListener("click", () => setStatus(w, null)), stamps.append(del), h(
      "tr",
      null,
      h("td", { class: `word st-${w.s}` }, w.w),
      h("td", { class: "py" }, w.p ?? ""),
      h("td", null, w.g ?? ""),
      h("td", { class: "ctx" }, c ? c.text : "", c ? " " : "", link),
      h("td", { class: "when" }, ago(w.added)),
      h("td", null, stamps)
    );
  }
  async function setStatus(w, s) {
    await browser.runtime.sendMessage({ type: "setStatus", word: w.w, status: s }), await load();
  }
  async function renderExportInfo() {
    let { lastExportAt, lastAnkiAt, feedWrittenAt, settings } = await browser.storage.local.get(["lastExportAt", "lastAnkiAt", "feedWrittenAt", "settings"]);
    $("lastExport").textContent = lastExportAt ? `Last export ${ago(lastExportAt)}.` : "Nothing exported yet.";
    let folder = settings?.feedFolder ?? "chinese-brain";
    $("feedInfo").textContent = folder ? `Kept up to date automatically in Downloads/${folder}/ (words.tsv, events.tsv, README.md). ${feedWrittenAt ? `Last written ${ago(feedWrittenAt)}.` : ""}` : "Live feed is off (Settings).", $("ankiNew").title = lastAnkiAt ? `Since ${new Date(lastAnkiAt).toLocaleString()}` : "Nothing exported yet";
  }
  $("q").addEventListener("input", () => {
    limit = PAGE, render();
  });
  $("sort").addEventListener("change", render);
  $("filter").addEventListener("click", (e) => {
    let b = e.target.closest("button");
    b && (filter = b.dataset.f, $("filter").querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", String(x === b))), render());
  });
  $("exportNew").addEventListener("click", async () => {
    let { lastExportAt } = await browser.storage.local.get("lastExportAt");
    download(`chinese-brain-${today()}.md`, buildClaudeMarkdown(words, logs, lastExportAt ?? 0)), await browser.storage.local.set({ lastExportAt: Date.now() }), renderExportInfo();
  });
  $("exportAll").addEventListener("click", () => download(`chinese-brain-all-${today()}.md`, buildClaudeMarkdown(words, logs, 0)));
  $("feedNow").addEventListener("click", async () => {
    $("feedNow").textContent = "Writing\u2026", await browser.runtime.sendMessage({ type: "writeFeed" }), $("feedNow").textContent = "Write feed now", renderExportInfo();
  });
  $("ankiAll").addEventListener("click", () => download(`chinese-brain-anki-${today()}.csv`, buildAnkiCsv(words), "text/csv;charset=utf-8"));
  $("ankiNew").addEventListener("click", async () => {
    let { lastAnkiAt } = await browser.storage.local.get("lastAnkiAt"), fresh = words.filter((w) => w.added > (lastAnkiAt ?? 0));
    download(`chinese-brain-anki-new-${today()}.csv`, buildAnkiCsv(fresh), "text/csv;charset=utf-8"), await browser.storage.local.set({ lastAnkiAt: Date.now() }), renderExportInfo();
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
  function wordsFromText(text) {
    let out = [];
    for (let line of text.split(/\r?\n/)) {
      let m = /[㐀-鿿豈-﫿]+/.exec(line);
      m && out.push(m[0]);
    }
    return out;
  }
  $("knownFile").addEventListener("change", async (e) => {
    let f = e.target.files?.[0];
    f && ($("knownText").value = await f.text());
  });
  $("knownGo").addEventListener("click", async () => {
    let list = wordsFromText($("knownText").value);
    if (!list.length) return;
    let n = await browser.runtime.sendMessage({ type: "bulkStatus", words: list, status: "known", onlyNew: !1 });
    $("knownOk").textContent = `${n} words marked known`, load();
  });
  $("tocflGo").addEventListener("click", async () => {
    let level = Number($("tocfl").value), list = await browser.runtime.sendMessage({ type: "tocflWords", level }), n = await browser.runtime.sendMessage({ type: "bulkStatus", words: list, status: "known", onlyNew: !0 });
    $("tocflOk").textContent = `${n} words marked known`, load();
  });
  browser.storage.onChanged.addListener((ch) => {
    Object.keys(ch).some((k) => k.startsWith("w:")) && (clearTimeout(window._t), window._t = window.setTimeout(load, 500));
  });
  load();
})();
