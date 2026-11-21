/* Chinese Brain Plus: his review card, under the study card in the card window (Stage 3). /plus only: it hooks into the
   board's card window (plus/board/js/cards.js, copied from life/chinese/board) without changing it.
   The fields are his Anki note type "Chinese": Chinese (the sentence, the word underlined), Word, Picture, Notes, Pinyin,
   Audio. A sentence in the study card, clicked, comes over with its pinyin. Pictures: a Taiwan image search for a concrete
   word, two drawings in his flashcard style for the rest (src/cbp/cards.ts), the other kind one tap away; he can paste or
   drop his own. V reads the sentence (Azure, YunJhe or HsiaoChen). Add (or Enter, the board's "Card it") saves the note
   to db `notes/<card id>` and cards the word. Until reviews move here (Stage 4), the Mac's nightly hands new notes to
   Anki (scripts/cbp-push.py --anki). */
(() => {
  const RV = { notes: {}, st: {}, pics: {}, picBusy: {}, voiceBusy: false, saving: false, shown: '', tab: {} };
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

  // ---------- the fields ----------
  const strip = (s) => String(s || '').replace(/^[AB]\s*[：:]\s*/, '').replace(/\*\*/g, '').trim();
  /** A sentence of the study card as his Anki fields: one line per speaker ("- " in front), the word underlined. */
  function fromSentence(s, w) {
    const zs = turnsOf(s.zh), ps = turnsOf(s.py);
    const c = CD_ankiCopy(zs, w);
    const tail = esc(w || '');
    const chinese = tail && c.html.endsWith(tail) ? c.html.slice(0, -tail.length) : c.html;
    const pre = zs.length > 1 ? '- ' : '';
    return { chinese, pinyin: ps.map((p) => pre + esc(strip(p))).join('<br>') };
  }
  function state(w) {
    if (RV.st[w]) return RV.st[w];
    const n = RV.notes[cardId(w)];
    if (n) return (RV.st[w] = { chinese: n.chinese || '', pinyin: n.pinyin || '', picture: n.picture || '', notes: n.notes || '', audio: n.audio || '', saved: true });
    const d = cardOf(w);
    if (!cardOK(d)) return null;
    const c = parseCard(d.text), first = c.mine[0] || c.ex[0];
    return (RV.st[w] = { ...(first ? fromSentence(first, c.word || w) : { chinese: '', pinyin: '' }), picture: '', notes: '', audio: '', saved: false });
  }
  const plain = (html) => {
    const t = document.createElement('div');
    t.innerHTML = String(html).replace(/<br\s*\/?>/gi, '\n');
    return t.textContent;
  };

  // ---------- the panel ----------
  const EL = document.createElement('section');
  EL.className = 'rv';
  EL.hidden = true;
  EL.innerHTML = `<div class="rv-pic" tabindex="0"></div>
  <div class="rv-fields">
    <div class="rv-zh zh" lang="zh-Hant" contenteditable="true" spellcheck="false" data-f="chinese"></div>
    <div class="rv-py" contenteditable="true" spellcheck="false" data-f="pinyin"></div>
    <textarea class="rv-notes" rows="3" placeholder="Notes" data-f="notes"></textarea>
    <div class="rv-row"><button type="button" class="rv-say" data-rv="say" aria-label="Read it (V)"><kbd>V</kbd></button><span class="rv-sp"></span><button type="button" class="cd-btn rv-add" data-rv="add"></button></div>
  </div>
  <div class="rv-choose">
    <div class="rv-tabs" role="tablist"><button type="button" role="tab" data-rv="tab" data-k="search">Photos</button><button type="button" role="tab" data-rv="tab" data-k="draw">Drawn</button><button type="button" class="rv-again" data-rv="again" aria-label="Others">↻</button></div>
    <div class="rv-grid"></div>
  </div>`;
  CD_MAIN.appendChild(EL);
  const $ = (s) => EL.querySelector(s);

  function paintPic(w, st) {
    const box = $('.rv-pic');
    box.innerHTML = st.picture ? `<img src="${esc(st.picture)}" alt="">` : '<span class="rv-empty">Paste or drop a picture</span>';
    const im = box.querySelector('img');
    if (im) im.onerror = () => {
      const alt = im.dataset.alt || st.thumb;
      if (alt && im.src !== new URL(alt, location.href).href) im.src = alt;
    };
  }
  function paintChoices(w, st) {
    const p = RV.pics[w], busy = RV.picBusy[w], tab = RV.tab[w] || (p && p.want) || 'search';
    EL.querySelectorAll('[data-rv="tab"]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.k === tab)));
    const grid = $('.rv-grid');
    const list = !p ? [] : tab === 'search' ? (p.search || []).map((x) => ({ src: x.thumb, full: x.full })) : (p.drawn || []).filter(Boolean).map((u) => ({ src: u, full: u }));
    if (busy) grid.innerHTML = `<p class="cd-wait">${busy === 'draw' ? 'Drawing' : 'Finding pictures'}</p>`;
    else if (!list.length) grid.innerHTML = p && ((tab === 'search' && p.search) || (tab === 'draw' && p.drawn)) ? '<p class="rv-none">Nothing came back.</p>' : '';
    else grid.innerHTML = list.map((x) => `<button type="button" class="rv-opt" data-rv="pick" data-full="${esc(x.full)}" data-thumb="${esc(x.src)}" aria-pressed="${st.picture === x.full}"><img src="${esc(x.src)}" alt="" loading="lazy"></button>`).join('');
    grid.querySelectorAll('img').forEach((im) => (im.onerror = () => im.closest('.rv-opt')?.remove()));
  }
  function paint(force) {
    const w = CD.cur;
    const st = w && state(w);
    EL.hidden = !st;
    if (!st) return;
    const added = cardCarded(w) && st.saved;
    $('.rv-add').textContent = added && !st.dirty ? 'Added' : added ? 'Save' : 'Add';
    $('.rv-add').disabled = RV.saving || !st.chinese;
    $('.rv-say').classList.toggle('on', !!st.audio);
    $('.rv-say').disabled = RV.voiceBusy;
    paintChoices(w, st);
    if (RV.shown === w && !force) return;
    RV.shown = w;
    // the fields only when the word changes, so typing is never interrupted
    $('.rv-zh').innerHTML = st.chinese;
    $('.rv-py').innerHTML = st.pinyin;
    $('.rv-notes').value = st.notes;
    paintPic(w, st);
    pictures(w);
  }

  // ---------- pictures ----------
  async function pictures(w, want, again) {
    const d = cardOf(w);
    if (!cardOK(d) || RV.picBusy[w] || (RV.pics[w] && !want && !again)) return;
    const have = RV.pics[w];
    if (want && !again && have && ((want === 'search' && have.search) || (want === 'draw' && have.drawn && have.drawn.some(Boolean)))) return;
    const c = parseCard(d.text), st = state(w);
    RV.picBusy[w] = want || 'search';
    if (!want && !have) RV.picBusy[w] = 'auto';
    if (CD.cur === w) paint();
    try {
      const p = await call('pictures', { word: c.word || w, meaning: c.meaning, sentence: st ? plain(st.chinese) : '', want: want || 'auto', again: !!again });
      RV.pics[w] = { ...(RV.pics[w] || {}), ...Object.fromEntries(Object.entries(p).filter(([, v]) => v !== null)) };
      if (!RV.tab[w] || want) RV.tab[w] = p.want;
      if (p.want === 'draw' && p.errs && p.errs.length && !(p.drawn || []).some(Boolean)) console.error(p.errs);
    } catch (e) {
      console.error(e);
      if (CD.cur === w) say(e.code === 'rate_limited' ? 'Pictures: not now, try again later.' : 'The pictures didn’t come through.');
    } finally {
      delete RV.picBusy[w];
      if (CD.cur === w) paint();
    }
  }
  function choose(w, url, thumb) {
    const st = state(w);
    if (!st) return;
    st.picture = st.picture === url ? '' : url;
    st.thumb = thumb;
    st.dirty = true;
    sfx('tap');
    paintPic(w, st);
    paint();
  }
  async function upload(file) {
    const w = CD.cur, st = w && state(w);
    if (!st || !file || !/^image\//.test(file.type)) return;
    st.picture = URL.createObjectURL(file);
    st.dirty = true;
    paintPic(w, st);
    paint();
    try {
      const r = await fetch('/api/plus/upload', { method: 'POST', headers: { Authorization: `Bearer ${token()}`, 'Content-Type': file.type }, body: file });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      st.picture = j.url;
    } catch (e) {
      console.error(e);
      st.picture = '';
      say('That picture didn’t upload.');
    }
    if (CD.cur === w) {
      paintPic(w, st);
      paint();
    }
  }

  // ---------- the voice ----------
  let player = null;
  async function speak() {
    const w = CD.cur, st = w && state(w);
    if (!st || RV.voiceBusy || !st.chinese) return;
    if (!st.audio) {
      RV.voiceBusy = true;
      paint();
      try {
        st.audio = (await call('voice', { text: plain(st.chinese) })).url;
        st.dirty = true;
      } catch (e) {
        console.error(e);
        say('The voice didn’t come through.');
      } finally {
        RV.voiceBusy = false;
        paint();
      }
    }
    if (!st.audio) return;
    player?.pause();
    player = new Audio(st.audio);
    player.play().catch(() => {});
  }

  // ---------- Add ----------
  async function save(w) {
    const st = state(w);
    if (!st || !st.chinese) return false;
    RV.saving = true;
    paint();
    try {
      if (/^\/api\/plus\/img\?/.test(st.picture)) st.picture = (await call('keep', { url: st.picture })).url;
      if (/^blob:/.test(st.picture)) throw new Error('The picture is still uploading.');
      const d = cardOf(w) || {}, c = parseCard(d.text), prev = RV.notes[cardId(w)];
      const note = { word: c.word || w, chinese: st.chinese, pinyin: st.pinyin, picture: st.picture, notes: st.notes, audio: st.audio, made: prev?.made || new Date().toISOString(), edited: new Date().toISOString(), exported: prev?.exported || null };
      await DBH.doc('notes/' + cardId(w)).set(note);
      RV.notes[cardId(w)] = note;
      st.saved = true;
      st.dirty = false;
      return true;
    } catch (e) {
      console.error(e);
      say(e.code === 'read_only' ? 'Saving on the website isn’t on yet.' : String(e.message || 'It didn’t save.'));
      return false;
    } finally {
      RV.saving = false;
      paint();
    }
  }
  // the board's Card it (its button is hidden here; Enter still calls it): carding saves the note first
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
  EL.addEventListener('input', (e) => {
    const f = e.target.closest('[data-f]'), st = CD.cur && state(CD.cur);
    if (!f || !st) return;
    st[f.dataset.f] = f.dataset.f === 'notes' ? f.value : f.innerHTML;
    if (f.dataset.f === 'chinese') st.audio = '';
    st.dirty = true;
    paint();
  });
  EL.addEventListener('click', (e) => {
    const b = e.target.closest('[data-rv]'), w = CD.cur;
    if (!b || !w) return;
    e.stopPropagation();
    const k = b.dataset.rv;
    if (k === 'add') add();
    else if (k === 'say') speak();
    else if (k === 'pick') choose(w, b.dataset.full, b.dataset.thumb);
    else if (k === 'tab') {
      RV.tab[w] = b.dataset.k;
      sfx('tap');
      paint();
      pictures(w, b.dataset.k);
    } else if (k === 'again') pictures(w, RV.tab[w] || 'search', true);
  });
  // a sentence of the study card, clicked: it becomes the review card's (and is still copied, as on the board)
  const copy = CD_copy;
  CD_copy = (sn) => {
    const w = CD.cur, d = cardOf(w), st = w && state(w), m = /^(mine)?(\d+):/.exec(sn.dataset.k || '');
    if (st && d && m) {
      const c = parseCard(d.text), s = (m[1] ? c.mine : c.ex)[+m[2]];
      if (s) {
        Object.assign(st, fromSentence(s, c.word || w), { audio: '', dirty: true });
        paint(true);
      }
    }
    return copy(sn);
  };
  document.addEventListener('paste', (e) => {
    if (CD.open === null) return;
    const f = [...(e.clipboardData?.files || [])].find((x) => /^image\//.test(x.type));
    if (!f) return;
    e.preventDefault();
    upload(f);
  });
  EL.addEventListener('dragover', (e) => {
    if ([...(e.dataTransfer?.items || [])].some((x) => x.kind === 'file')) {
      e.preventDefault();
      EL.classList.add('drop');
    }
  });
  EL.addEventListener('dragleave', () => EL.classList.remove('drop'));
  EL.addEventListener('drop', (e) => {
    EL.classList.remove('drop');
    const f = [...(e.dataTransfer?.files || [])].find((x) => /^image\//.test(x.type));
    if (!f) return;
    e.preventDefault();
    upload(f);
  });
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
