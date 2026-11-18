"use strict";
(() => {
  // site/src/edit.ts
  var PRE = "/edit", KEY = "edit-key", root = document.documentElement, page = location.pathname.replace(/\/$/, "").slice(PRE.length) || (location.hostname.startsWith("account.") ? "/account" : "/brain"), conf = null, raw = {}, start = {}, changed = {}, editing = null, savedGone = {}, css = `
[data-edit] [data-copy]{cursor:text;border-radius:.2em;outline:1px dashed rgb(11 127 163/.45);outline-offset:2px}
[data-edit] [data-copy]:hover{background:rgb(11 127 163/.08)}
[data-edit] .now-editing{outline:2px solid #0b7fa3!important;background:#fff;color:#051230;white-space:pre-wrap}
[data-edit] .was-edited{outline:2px solid #b58500}
[data-edit] [data-gone]{opacity:.32;outline:2px dashed #c0392b!important;outline-offset:3px}
[data-edit] main :is(section,form,div,p)[hidden]{display:block!important}
[data-edit] main :is(a,span)[hidden]{display:inline!important}
.edit-hover{outline:2px solid #c0392b!important;outline-offset:3px}
.edit-tool{position:absolute;z-index:2147483600;display:flex;gap:.3rem;font:600 .78rem/1 system-ui,sans-serif}
.edit-tool button{padding:.42rem .6rem;border:0;border-radius:.4rem;background:#c0392b;color:#fff;cursor:pointer;white-space:nowrap;box-shadow:0 .3rem .8rem -.2rem rgb(0 0 0/.35)}
.edit-tool button.back{background:#1a6e4b}
.edit-bar{position:fixed;left:50%;bottom:1rem;z-index:2147483601;transform:translateX(-50%);display:flex;flex-wrap:wrap;align-items:center;gap:.6rem 1rem;
width:min(50rem,calc(100% - 2rem));padding:.75rem .8rem .75rem 1.1rem;border-radius:.9rem;background:#051230;color:#faf5df;
font:500 .92rem/1.35 system-ui,sans-serif;box-shadow:0 1rem 2rem -.6rem rgb(0 0 0/.4)}
.edit-bar .msg{flex:1 1 16rem}
.edit-bar button,.edit-bar select{font:600 .92rem/1 system-ui,sans-serif;padding:.65rem .95rem;border-radius:.55rem;border:0;cursor:pointer}
.edit-bar .save{background:#fff;color:#051230}.edit-bar .save:disabled{opacity:.45;cursor:default}
.edit-bar .undo-all,.edit-bar select{background:transparent;color:#faf5df;box-shadow:inset 0 0 0 1px rgb(255 255 255/.4)}
.edit-bar select option{color:#051230}
[data-edit] body{padding-bottom:6rem}`, style = document.createElement("style");
  style.textContent = css;
  document.head.append(style);
  function store(k, v) {
    try {
      if (v === void 0) return localStorage.getItem(k);
      localStorage.setItem(k, v);
    } catch {
    }
    return null;
  }
  var all = (sel) => [...document.querySelectorAll(sel)], byKey = (k) => all(`[data-copy="${k}"]`), bar = document.createElement("div");
  bar.className = "edit-bar";
  bar.innerHTML = '<span class="msg">Click any text to change it. Point at anything to remove it.</span><select class="pages" aria-label="Page to edit" hidden></select><button type="button" class="undo-all" hidden>Undo all</button><button type="button" class="save" disabled>Save</button>';
  document.body.append(bar);
  var msg = bar.querySelector(".msg"), save = bar.querySelector(".save"), undoAll = bar.querySelector(".undo-all"), pages = bar.querySelector(".pages");
  function count() {
    let n = Object.keys(changed).length;
    save.disabled = !n, undoAll.hidden = !n, save.textContent = n ? `Save ${n} ${n === 1 ? "change" : "changes"}` : "Save", n && (msg.textContent = "Not saved yet.");
  }
  function begin(node) {
    if (editing === node) return;
    editing && finish(editing, !0), hideTool(), editing = node, node.contentEditable = "true", node.classList.add("now-editing"), node.focus();
    let r = document.createRange();
    r.selectNodeContents(node), r.collapse(!1);
    let sel = getSelection();
    sel.removeAllRanges(), sel.addRange(r), msg.textContent = "Enter keeps it, Esc undoes it.";
  }
  function finish(node, keep) {
    let k = node.dataset.copy, v = node.innerHTML.replace(/<br\s*\/?>\s*$/i, "").replace(/&nbsp;/g, " ").trim();
    keep && v && v !== raw[k] && (raw[k] = v, v === start[k] ? delete changed[k] : changed[k] = v), node.removeAttribute("contenteditable"), node.classList.remove("now-editing");
    for (let n of byKey(k))
      n.innerHTML = raw[k], n.classList.toggle("was-edited", k in changed);
    editing = null, count();
  }
  var tool = document.createElement("div");
  tool.className = "edit-tool";
  tool.hidden = !0;
  document.body.append(tool);
  var target = null, hideTimer = 0;
  function kind(el) {
    if (el.hasAttribute("data-copy") && !el.hasAttribute("data-block")) return "text";
    let t = el.tagName.toLowerCase();
    return { section: "section", figure: "picture", li: "item", blockquote: "quote", article: "article" }[t] ?? "block";
  }
  var keyOf = (el) => el.getAttribute("data-block") ?? el.getAttribute("data-copy");
  function setGone(el, on) {
    let k = keyOf(el);
    for (let n of all(`[data-block="${k}"],[data-copy="${k}"]`)) n.toggleAttribute("data-gone", on);
    !!savedGone[k] === on ? delete changed[`-${k}`] : changed[`-${k}`] = on ? !0 : null, count();
  }
  function showTool(el) {
    clearTimeout(hideTimer), target?.classList.remove("edit-hover"), target = el, tool.replaceChildren();
    let list = [];
    for (let n = el; n && list.length < 3; n = n.parentElement) n.matches("[data-copy],[data-block]") && list.push(n);
    for (let x of list) {
      let gone = x.hasAttribute("data-gone"), b = document.createElement("button");
      if (b.type = "button", b.textContent = gone ? "Put back" : `Remove ${kind(x)}`, gone && (b.className = "back"), b.addEventListener("mouseenter", () => {
        for (let h of all(".edit-hover")) h.classList.remove("edit-hover");
        x.classList.add("edit-hover");
      }), b.addEventListener("mouseleave", () => x.classList.remove("edit-hover")), b.addEventListener("click", (e) => {
        e.preventDefault(), e.stopPropagation(), x.classList.remove("edit-hover"), setGone(x, !gone), showTool(el);
      }), tool.append(b), gone) break;
    }
    let r = el.getBoundingClientRect();
    tool.hidden = !1, tool.style.top = `${Math.max(0, r.top + scrollY - tool.offsetHeight - 4)}px`, tool.style.left = `${Math.max(4, Math.min(r.right + scrollX - tool.offsetWidth, root.clientWidth - tool.offsetWidth - 4))}px`;
  }
  function hideTool() {
    tool.hidden = !0, target = null;
    for (let h of all(".edit-hover")) h.classList.remove("edit-hover");
  }
  document.addEventListener("mouseover", (e) => {
    if (!conf || editing) return;
    let t = e.target;
    if (tool.contains(t)) return clearTimeout(hideTimer);
    if (bar.contains(t)) return;
    let el = t.closest("[data-copy],[data-block]");
    el && el !== target ? showTool(el) : el || (clearTimeout(hideTimer), hideTimer = window.setTimeout(hideTool, 700));
  });
  fetch(`/api/copy?page=${encodeURIComponent(page)}`, { cache: "no-store" }).then((r) => r.ok ? r.json() : Promise.reject(new Error(String(r.status)))).then((c) => {
    conf = c;
    for (let [k, e] of Object.entries(c.edits)) e.gone && (savedGone[k] = !0);
    for (let node of all("[data-copy]")) {
      let k = node.dataset.copy;
      k in raw || (raw[k] = c.edits[k]?.to ?? c.texts[k] ?? node.innerHTML), start[k] = raw[k], node.tabIndex = 0, node.addEventListener("keydown", (e) => {
        if (editing !== node) {
          e.key === "Enter" && e.target === node && (e.preventDefault(), begin(node));
          return;
        }
        e.key === "Enter" && (e.preventDefault(), node.blur()), e.key === "Escape" && (e.preventDefault(), finish(node, !1));
      }), node.addEventListener("blur", () => {
        editing === node && finish(node, !0);
      }), node.addEventListener("paste", (e) => {
        editing === node && (e.preventDefault(), document.execCommand("insertText", !1, (e.clipboardData?.getData("text/plain") ?? "").replace(/\s*\n\s*/g, " ")));
      });
    }
    root.classList.add("editing");
    for (let [label, path] of c.pages) {
      let o = document.createElement("option");
      o.value = path, o.textContent = label, o.selected = path === page, pages.append(o);
    }
    pages.hidden = c.pages.length < 2, pages.addEventListener("change", () => {
      location.href = PRE + pages.value;
    });
  }).catch(() => {
    msg.textContent = "Could not load the page\u2019s words. Reload the page.";
  });
  document.addEventListener(
    "click",
    (e) => {
      let t = e.target;
      if (!conf || bar.contains(t) || tool.contains(t)) return;
      t.closest("a,button,label,summary,[role=button]") && e.preventDefault();
      let node = t.closest("[data-copy]");
      node && editing !== node && begin(node);
    },
    !0
  );
  document.addEventListener("submit", (e) => e.preventDefault(), !0);
  undoAll.addEventListener("click", () => {
    editing && finish(editing, !1);
    for (let k of Object.keys(changed)) {
      if (k.startsWith("-")) {
        let key = k.slice(1);
        for (let n of all(`[data-block="${key}"],[data-copy="${key}"]`)) n.toggleAttribute("data-gone", !!savedGone[key]);
        continue;
      }
      raw[k] = start[k];
      for (let n of byKey(k))
        n.innerHTML = raw[k], n.classList.remove("was-edited");
    }
    changed = {}, count(), hideTool(), msg.textContent = "Back to the saved page.";
  });
  save.addEventListener("click", () => {
    editing && finish(editing, !0);
    let key = store(KEY) || prompt("Password for editing this site:");
    key && (save.disabled = !0, msg.textContent = "Saving\u2026", fetch("/api/copy", { method: "POST", headers: { "Content-Type": "application/json", "X-Edit-Key": key }, body: JSON.stringify({ page, changes: changed }) }).then((r) => {
      if (r.status === 401)
        return store(KEY, ""), msg.textContent = "Wrong password. Try Save again.", count();
      if (!r.ok) throw new Error(String(r.status));
      store(KEY, key);
      for (let k of Object.keys(changed))
        k.startsWith("-") ? changed[k] ? savedGone[k.slice(1)] = !0 : delete savedGone[k.slice(1)] : start[k] = raw[k];
      changed = {}, count();
      for (let n of all(".was-edited")) n.classList.remove("was-edited");
      msg.textContent = "Saved. The site shows it within a minute.";
    }).catch(() => {
      msg.textContent = "Not saved: no connection. Try again.", count();
    }));
  });
  addEventListener("beforeunload", (e) => {
    Object.keys(changed).length && e.preventDefault();
  });
})();
