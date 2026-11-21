/* Chinese Brain Plus: the card he adds, under the study card in the card window (Stage 3). /plus only: it hooks into the
   board's card window (plus/board/js/cards.js, copied from life/chinese/board) without changing it.
   His Anki note type "Chinese", as an editor that behaves like Anki's: every field takes anything (bold, italics, Cmd+U
   to mark the word, which shows as a highlight, pictures pasted, dropped or dragged in from anywhere, as many as he
   likes). Fields: Sentence, Word, Picture, Notes; Pinyin is done for him from the sentence (src/cbp/cards.ts pinyin) and
   never shown; Audio comes when he presses V (Azure, YunJhe or HsiaoChen).
   Pictures to choose from sit in one strip under the fields: two drawings in his flashcard style, then photos from
   Wikimedia Commons (straight from Commons, so they show fast); a click puts one in Picture (again takes it out), a drag
   puts it anywhere. "More" brings two more drawings and more photos.
   Add (the button, Cmd+Enter in a field, or the board's Enter) keeps every picture on the site, saves db
   `notes/<card id>` and cards the word. Unsaved fields survive a reload (localStorage, per word). Until reviews move
   here (Stage 4), the Mac's nightly hands new notes to Anki (scripts/cbp-push.py --anki). */
(() => {
  const RV = { notes: {}, st: {}, pics: {}, busy: {}, saving: false, shown: '', kept: {}, pending: new Set() };
  const FIELDS = [['chinese', 'Sentence'], ['word', 'Word'], ['picture', 'Picture'], ['notes', 'Notes']];
  const token = () => {
    try {
      return localStorage.getItem('cb-token') ?? '';
    } catch {
      return '';
    }
  };
  const call = async (path, body) => {
    const r = await fetch('/api/plus/' + path, { method: 'POST', headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw Object.assign(new Error(j.error || 'It didn’t come through.'), { code: j.code });
    return j;
  };
  const say = (msg) => {
    hideToast(true);
    const el = document.createElement('div');
    el.className = 'toast';
    el.setAttribute('role', 'status');
    el.innerHTML = `<span>${esc(msg)}</span>`;
    document.body.appendChild(el);
    TOAST = { el, t: setTimeout(hideToast, 5000) };
  };
  const plain = (html) => {
    const t = document.createElement('div');
    t.innerHTML = String(html).replace(/<br\s*\/?>/gi, '\n').replace(/<\/(div|p|li)>/gi, '\n');
    t.querySelectorAll('img').forEach((i) => i.remove());
    return t.textContent.replace(/\n{2,}/g, '\n').trim();
  };
  const draftKey = (w) => 'cbp-draft:' + w;
  const draft = {
    get(w) {
      try {
        const d = JSON.parse(localStorage.getItem(draftKey(w)) || 'null');
        return d && d.v === 1 ? d : null;
      } catch {
        return null;
      }
    },
    set(w, st) {
      try {
        localStorage.setItem(draftKey(w), JSON.stringify({ v: 1, ...Object.fromEntries(FIELDS.map(([k]) => [k, st[k]])), audio: st.audio }));
      } catch {}
    },
    drop(w) {
      try {
        localStorage.removeItem(draftKey(w));
      } catch {}
    },
  };

  // ---------- what goes in the fields ----------
  const strip = (s) => String(s || '').replace(/^[AB]\s*[：:]\s*/, '').replace(/\*\*/g, '').trim();
  /** A sentence of the study card: one line per speaker ("- " in front), the word marked. */
  function fromSentence(s, w) {
    const zs = turnsOf(s.zh), ps = turnsOf(s.py);
    const c = CD_ankiCopy(zs, w);
    const tail = esc(w || '');
    const pre = zs.length > 1 ? '- ' : '';
    return { chinese: tail && c.html.endsWith(tail) ? c.html.slice(0, -tail.length) : c.html, py: ps.map((p) => pre + strip(p)).join('\n') };
  }
  function state(w) {
    if (RV.st[w]) return RV.st[w];
    const n = RV.notes[cardId(w)];
    if (n) return (RV.st[w] = { chinese: n.chinese || '', word: n.word || w, picture: n.picture || '', notes: n.notes || '', audio: n.audio || '', py: n.pinyin || '', pyFor: plain(n.chinese || ''), saved: true });
    const d = cardOf(w);
    if (!cardOK(d)) return null;
    const c = parseCard(d.text), first = c.mine[0] || c.ex[0], s = first ? fromSentence(first, c.word || w) : { chinese: '', py: '' };
    const st = { chinese: s.chinese, word: esc(c.word || w), picture: '', notes: '', audio: '', py: s.py, pyFor: plain(s.chinese), saved: false };
    const dr = draft.get(w);
    if (dr) Object.assign(st, Object.fromEntries(FIELDS.map(([k]) => [k, dr[k] ?? st[k]])), { audio: dr.audio || '', dirty: true });
    return (RV.st[w] = st);
  }

  // ---------- pasted things, made safe (formatting and pictures stay, everything else becomes text) ----------
  const KEEP = new Set(['B', 'STRONG', 'I', 'EM', 'U', 'BR', 'DIV', 'P', 'SPAN', 'IMG', 'UL', 'OL', 'LI', 'SUB', 'SUP', 'FONT']);
  const DROP = new Set(['SCRIPT', 'STYLE', 'META', 'LINK', 'TITLE', 'IFRAME', 'OBJECT', 'SVG', 'NOSCRIPT', 'TEMPLATE']);
  function clean(html) {
    const t = document.createElement('template');
    t.innerHTML = html;
    (function walk(node) {
      for (const n of [...node.childNodes]) {
        if (n.nodeType === 8) n.remove();
        if (n.nodeType !== 1) continue;
        if (DROP.has(n.tagName)) {
          n.remove();
          continue;
        }
        walk(n);
        if (!KEEP.has(n.tagName)) {
          n.replaceWith(...n.childNodes);
          continue;
        }
        const src = n.tagName === 'IMG' ? n.getAttribute('src') || '' : '';
        const color = n.style?.color, bg = n.style?.backgroundColor, fw = n.style?.fontWeight;
        for (const a of [...n.attributes]) n.removeAttribute(a.name);
        if (n.tagName === 'IMG') {
          if (/^(https:|data:image\/|blob:|\/api\/plus\/media\/)/.test(src)) n.setAttribute('src', src);
          else n.remove();
        }
        if (color) n.style.color = color;
        if (bg) n.style.backgroundColor = bg;
        if (fw && +fw >= 600) n.style.fontWeight = 'bold';
      }
    })(t.content);
    return t.innerHTML;
  }
  const kept = (html) => String(html).replace(/src="([^"]+)"/g, (m, s) => (RV.kept[s.replace(/&amp;/g, '&')] ? `src="${esc(RV.kept[s.replace(/&amp;/g, '&')])}"` : m));
  /** Every picture in a field that isn't on the site yet goes there now (in the background); its address swaps in. */
  function keepPictures(root) {
    root.querySelectorAll('img').forEach((im) => {
      const src = im.getAttribute('src') || '';
      if (/^\/api\/plus\/media\//.test(src) || RV.kept[src]) {
        if (RV.kept[src]) im.setAttribute('src', RV.kept[src]);
        return;
      }
      if (RV.pending.has(src) || /^blob:/.test(src)) return;
      const job = (async () => {
        let url;
        if (/^data:/.test(src)) {
          const b = await (await fetch(src)).blob();
          url = await upload(b);
        } else url = (await call('grab', { url: src })).url;
        RV.kept[src] = url;
      })()
        .catch((e) => {
          console.error(e);
          say('A picture couldn’t be kept: it was taken out.');
          RV.kept[src] = '';
        })
        .finally(() => {
          RV.pending.delete(src);
          RV.jobs.delete(job);
          settle();
        });
      RV.pending.add(src);
      RV.jobs.add(job);
    });
  }
  RV.jobs = new Set();
  /** Swap kept addresses into the fields on screen and in every word's state; drop pictures that failed. */
  function settle() {
    EL.querySelectorAll('.rv-f img').forEach((im) => {
      const k = RV.kept[im.getAttribute('src')];
      if (k === '') im.remove();
      else if (k) im.setAttribute('src', k);
    });
    for (const st of Object.values(RV.st)) for (const [k] of FIELDS) st[k] = kept(st[k]).replace(/<img src=""[^>]*>/g, '');
    if (CD.cur && RV.shown === CD.cur) readFields();
  }
  async function upload(blob) {
    const r = await fetch('/api/plus/upload', { method: 'POST', headers: { Authorization: `Bearer ${token()}`, 'Content-Type': blob.type }, body: blob });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error);
    return j.url;
  }
  /** Files dropped or pasted: shown at once, kept in the background. */
  function insertFiles(files) {
    const imgs = [...files].filter((f) => /^image\//.test(f.type));
    if (!imgs.length) return false;
    const html = imgs
      .map((f) => {
        const b = URL.createObjectURL(f);
        const job = upload(f)
          .then((u) => (RV.kept[b] = u))
          .catch((e) => {
            console.error(e);
            say('A picture didn’t upload.');
            RV.kept[b] = '';
          })
          .finally(() => {
            RV.jobs.delete(job);
            settle();
          });
        RV.jobs.add(job);
        return `<img src="${b}">`;
      })
      .join('');
    document.execCommand('insertHTML', false, html);
    return true;
  }

  // ---------- the editor ----------
  const EL = document.createElement('section');
  EL.className = 'rv';
  EL.hidden = true;
  EL.innerHTML = `<div class="rv-fields">${FIELDS.map(([k, label]) => `<div class="rv-field rv-${k}"><span class="rv-l" id="rv-l-${k}">${label}</span><div class="rv-f${k === 'chinese' || k === 'word' ? ' zh' : ''}" data-f="${k}" contenteditable="true" spellcheck="false" lang="${k === 'notes' ? 'en' : 'zh-Hant'}" role="textbox" aria-multiline="true" aria-labelledby="rv-l-${k}"></div>${k === 'chinese' ? '<button type="button" class="rv-say" data-rv="say" aria-label="Read it aloud (V)">V</button>' : ''}</div>`).join('')}</div>
  <div class="rv-strip" aria-label="Pictures to choose from"></div>
  <div class="rv-bar"><button type="button" class="rv-add" data-rv="add"></button></div>`;
  CD_MAIN.appendChild(EL);
  const $ = (s) => EL.querySelector(s);
  const field = (k) => EL.querySelector(`.rv-f[data-f="${k}"]`);

  function readFields() {
    const st = CD.cur && state(CD.cur);
    if (!st) return;
    for (const [k] of FIELDS) st[k] = field(k).innerHTML;
  }
  function paintBar() {
    const w = CD.cur, st = w && state(w);
    if (!st) return;
    const added = cardCarded(w) && st.saved;
    const b = $('.rv-add');
    b.textContent = RV.saving ? 'Adding' : added && !st.dirty ? 'Added' : added ? 'Save' : 'Add';
    b.disabled = RV.saving || !plain(st.chinese);
    b.classList.toggle('done', added && !st.dirty);
    $('.rv-say').classList.toggle('on', !!st.audio);
    $('.rv-say').classList.toggle('busy', !!RV.voiceBusy);
  }
  function paintStrip() {
    const w = CD.cur, st = w && state(w);
    if (!st) return;
    const p = RV.pics[w] || {}, busy = RV.busy[w] || {};
    const inPic = new Set([...field('picture').querySelectorAll('img')].map((i) => i.getAttribute('data-from') || i.getAttribute('src')));
    const tiles = [
      ...(busy.draw ? ['<div class="rv-tile wait" aria-hidden="true"></div>', '<div class="rv-tile wait" aria-hidden="true"></div>'] : []),
      ...(p.drawn || []).map((u) => ({ thumb: u, full: u, drawn: true })),
      ...(p.photos || []),
    ].map((x) =>
      typeof x === 'string'
        ? x
        : `<div class="rv-tile${x.drawn ? ' drawn' : ''}" role="button" tabindex="0" data-rv="pick" data-full="${esc(x.full)}" aria-pressed="${inPic.has(x.full)}"><img src="${esc(x.thumb)}" alt="" draggable="true" data-full="${esc(x.full)}" loading="lazy"></div>`,
    );
    if (busy.photos && !(p.photos || []).length) tiles.push(...Array(4).fill('<div class="rv-tile wait" aria-hidden="true"></div>'));
    tiles.push(`<button type="button" class="rv-tile rv-more" data-rv="more"${busy.draw || busy.photos ? ' disabled' : ''}>More</button>`);
    $('.rv-strip').innerHTML = tiles.join('');
    $('.rv-strip').querySelectorAll('img').forEach((im) => (im.onerror = () => im.closest('.rv-tile')?.remove()));
  }
  function paint() {
    const w = CD.cur, st = w && state(w);
    EL.hidden = !st;
    if (!st) return;
    if (RV.shown !== w) {
      // the fields only when the word changes, so typing is never interrupted
      RV.shown = w;
      for (const [k] of FIELDS) field(k).innerHTML = kept(st[k]);
      pictures(w);
    }
    paintBar();
    paintStrip();
  }

  // ---------- pictures to choose from ----------
  const searchWords = (meaning) =>
    String(meaning || '')
      .replace(/\([^)]*\)|（[^）]*）|\*\*/g, ' ')
      .replace(/[㐀-鿿]+/g, ' ')
      .split(/[;,，；]/)[0]
      .replace(/^\s*(to|a|an|the)\s+/i, '')
      .trim();
  async function morePhotos(w, q, first) {
    const p = (RV.pics[w] ||= {});
    if (!q) return;
    (RV.busy[w] ||= {}).photos = true;
    if (CD.cur === w) paintStrip();
    try {
      const off = p.q === q ? p.next || 0 : 0;
      const r = await call('photos', { q, offset: off });
      const have = new Set((p.photos || []).map((x) => x.full));
      const fresh = r.photos.filter((x) => !have.has(x.full));
      p.photos = first ? [...fresh, ...(p.photos || [])] : [...(p.photos || []), ...fresh];
      p.q = q;
      p.next = r.next;
    } catch (e) {
      console.error(e);
    } finally {
      RV.busy[w].photos = false;
      if (CD.cur === w) paintStrip();
    }
  }
  async function moreDrawings(w, again) {
    const d = cardOf(w);
    if (!cardOK(d)) return;
    const c = parseCard(d.text), p = (RV.pics[w] ||= {}), st = state(w);
    (RV.busy[w] ||= {}).draw = true;
    if (CD.cur === w) paintStrip();
    try {
      const r = await call('drawings', { word: c.word || w, meaning: c.meaning, sentence: st ? plain(st.chinese) : '', again: !!again });
      p.drawn = r.drawn;
      if (r.errs?.length) console.error(r.errs);
      // Claude's search words find better photos than the gloss: those go first
      if (r.query && r.query !== p.q && !p.better) {
        p.better = true;
        morePhotos(w, r.query, true);
      }
    } catch (e) {
      console.error(e);
      if (CD.cur === w) say(e.code === 'rate_limited' ? 'Drawings: not now, try again later.' : 'The drawings didn’t come through.');
    } finally {
      RV.busy[w].draw = false;
      if (CD.cur === w) paintStrip();
    }
  }
  function pictures(w) {
    const d = cardOf(w);
    if (!cardOK(d) || RV.pics[w]) return;
    RV.pics[w] = {};
    morePhotos(w, searchWords(parseCard(d.text).meaning) || w);
    moreDrawings(w);
  }
  /** A picture from the strip into Picture (at the end), or out of it again. */
  function pick(full) {
    const f = field('picture');
    const there = [...f.querySelectorAll('img')].find((i) => (i.getAttribute('data-from') || i.getAttribute('src')) === full);
    if (there) there.remove();
    else {
      f.focus();
      const r = document.createRange();
      r.selectNodeContents(f);
      r.collapse(false);
      const sel = getSelection();
      sel.removeAllRanges();
      sel.addRange(r);
      document.execCommand('insertHTML', false, `<img src="${esc(full)}" data-from="${esc(full)}">`);
    }
    changed();
    sfx('tap');
  }

  // ---------- the voice ----------
  let player = null;
  async function speak() {
    const w = CD.cur, st = w && state(w);
    if (!st || RV.voiceBusy || !plain(st.chinese)) return;
    if (!st.audio) {
      RV.voiceBusy = true;
      paintBar();
      try {
        st.audio = (await call('voice', { text: plain(st.chinese) })).url;
        st.dirty = true;
        draft.set(w, st);
      } catch (e) {
        console.error(e);
        say('The voice didn’t come through.');
      } finally {
        RV.voiceBusy = false;
        paintBar();
      }
    }
    if (!st.audio) return;
    player?.pause();
    player = new Audio(st.audio);
    player.play().catch(() => {});
  }

  // ---------- pinyin, done for him ----------
  async function pinyinOf(st) {
    const text = plain(st.chinese);
    if (text === st.pyFor) return st.py;
    const r = await call('pinyin', { text });
    st.py = r.pinyin;
    st.pyFor = text;
    return st.py;
  }

  // ---------- Add ----------
  async function save(w) {
    const st = state(w);
    if (!st || !plain(st.chinese)) return false;
    RV.saving = true;
    paintBar();
    try {
      if (CD.cur === w) {
        readFields();
        keepPictures(EL);
      }
      await Promise.all([...RV.jobs]);
      settle();
      const py = await pinyinOf(st);
      const d = cardOf(w) || {}, c = parseCard(d.text), prev = RV.notes[cardId(w)];
      const note = {
        word: st.word.replace(/<[^>]+>/g, '').trim() ? st.word : esc(c.word || w),
        chinese: st.chinese,
        pinyin: esc(py).replace(/\n/g, '<br>'),
        picture: st.picture,
        notes: st.notes,
        audio: st.audio,
        made: prev?.made || new Date().toISOString(),
        edited: new Date().toISOString(),
        exported: prev?.exported || null,
      };
      if (/src="(blob:|data:|https:)/.test(note.chinese + note.word + note.picture + note.notes)) throw new Error('A picture is still on its way: try again in a moment.');
      await DBH.doc('notes/' + cardId(w)).set(note);
      RV.notes[cardId(w)] = note;
      st.saved = true;
      st.dirty = false;
      draft.drop(w);
      return true;
    } catch (e) {
      console.error(e);
      say(e.code === 'read_only' ? 'Saving on the website isn’t on yet.' : String(e.message || 'It didn’t save.'));
      return false;
    } finally {
      RV.saving = false;
      paintBar();
    }
  }
  // the board's Card it (its button is hidden here; Enter still calls it): carding saves the card first
  const cardIt = CD_cardIt;
  CD_cardIt = async () => {
    const w = CD.cur, d = cardOf(w);
    if (d && d.text && !d.carded && state(w) && !(await save(w))) return;
    cardIt();
  };
  async function add() {
    const w = CD.cur;
    if (cardCarded(w)) {
      if (await save(w)) sfx('save');
    } else CD_cardIt();
  }

  // ---------- events ----------
  function changed() {
    const w = CD.cur, st = w && state(w);
    if (!st) return;
    const before = plain(st.chinese);
    readFields();
    if (plain(st.chinese) !== before) st.audio = '';
    st.dirty = true;
    draft.set(w, st);
    paintBar();
    paintStrip();
  }
  EL.addEventListener('input', (e) => {
    if (!e.target.closest('.rv-f')) return;
    keepPictures(e.target.closest('.rv-f'));
    changed();
  });
  // the sentence's reading is worked out once he leaves the field, so Add doesn't wait for it
  EL.addEventListener('focusout', (e) => {
    const f = e.target.closest('.rv-f[data-f="chinese"]'), st = CD.cur && state(CD.cur);
    if (f && st) pinyinOf(st).catch(() => {});
  });
  EL.addEventListener('paste', (e) => {
    const f = e.target.closest('.rv-f');
    if (!f) return;
    e.preventDefault();
    const files = e.clipboardData?.files;
    if (files && files.length && insertFiles(files)) return changed();
    const html = e.clipboardData?.getData('text/html');
    if (html) document.execCommand('insertHTML', false, clean(html));
    else document.execCommand('insertText', false, e.clipboardData?.getData('text/plain') || '');
    keepPictures(f);
    changed();
  });
  EL.addEventListener('dragstart', (e) => {
    const im = e.target.closest?.('.rv-tile img');
    if (!im) return;
    e.dataTransfer.setData('text/html', `<img src="${esc(im.dataset.full)}" data-from="${esc(im.dataset.full)}">`);
    e.dataTransfer.setData('text/uri-list', im.dataset.full);
  });
  EL.addEventListener('drop', (e) => {
    const f = e.target.closest('.rv-f');
    if (!f) return;
    const files = e.dataTransfer?.files;
    if (!files || !files.length) {
      // HTML from the strip or another page: the browser drops it where the pointer is; cleaned and kept on input
      setTimeout(() => {
        f.innerHTML = clean(f.innerHTML);
        keepPictures(f);
        changed();
      });
      return;
    }
    e.preventDefault();
    const pos = document.caretRangeFromPoint?.(e.clientX, e.clientY);
    f.focus();
    if (pos) {
      getSelection().removeAllRanges();
      getSelection().addRange(pos);
    }
    if (insertFiles(files)) changed();
  });
  EL.addEventListener('keydown', (e) => {
    const tile = e.target.closest?.('.rv-tile[data-rv="pick"]');
    if (tile && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      e.stopPropagation();
      pick(tile.dataset.full);
      return;
    }
    if (!e.target.closest('.rv-f')) return;
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      add();
    }
  });
  EL.addEventListener('click', (e) => {
    const b = e.target.closest('[data-rv]'), w = CD.cur;
    if (!b || !w) return;
    e.stopPropagation();
    const k = b.dataset.rv;
    if (k === 'add') add();
    else if (k === 'say') speak();
    else if (k === 'pick') pick(b.dataset.full);
    else if (k === 'more') {
      const p = RV.pics[w] || {};
      morePhotos(w, p.q || searchWords(parseCard(cardOf(w).text).meaning) || w);
      moreDrawings(w, true);
    }
  });
  // a sentence of the study card, clicked: it becomes the card's Sentence (and is still copied, as on the board)
  const copy = CD_copy;
  CD_copy = (sn) => {
    const w = CD.cur, d = cardOf(w), st = w && state(w), m = /^(mine)?(\d+):/.exec(sn.dataset.k || '');
    if (st && d && m) {
      const c = parseCard(d.text), s = (m[1] ? c.mine : c.ex)[+m[2]];
      if (s) {
        const f = fromSentence(s, c.word || w);
        Object.assign(st, { chinese: f.chinese, py: f.py, pyFor: plain(f.chinese), audio: '', dirty: true });
        field('chinese').innerHTML = st.chinese;
        draft.set(w, st);
        paintBar();
      }
    }
    return copy(sn);
  };
  document.addEventListener('keydown', (e) => {
    if (CD.open === null || e.isComposing || e.metaKey || e.ctrlKey || e.altKey) return;
    const t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
    if (e.key === 'v' || e.key === 'V') {
      e.preventDefault();
      speak();
    }
  });

  // ---------- with the board ----------
  const paintAll = CD_paintAll;
  CD_paintAll = () => {
    paintAll();
    if (CD.open !== null) paint();
    else RV.shown = '';
  };
  // a card written ahead gets its pictures ahead too (a computer only, as the board writes ahead)
  const make = makeCard;
  makeCard = async (word, ...rest) => {
    await make(word, ...rest);
    if (CD_DESK() && cardOK(cardOf(word))) pictures(word);
  };
  (function wait(n) {
    if (DBH) {
      DBH.collection('notes').onSnapshot(
        (s) => {
          const m = {};
          s.docs.forEach((d) => (m[d.id] = JSON.parse(JSON.stringify(d.data() || {}))));
          RV.notes = m;
          if (CD.open !== null) paint();
        },
        (e) => console.error(e),
      );
      return;
    }
    if (n < 200) setTimeout(() => wait(n + 1), 100);
  })(0);
})();
