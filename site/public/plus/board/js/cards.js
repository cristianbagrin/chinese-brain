/* ---------- cards: Claude writes his cards on the board (from 2026-11-04). Owner: card maker
   Tap a Next up word, or type any word under the list: a sheet opens and Claude writes the card through `sample` (his
   own usage, Opus unless the Lab says Sonnet), from db `board/cardkit` (his card rules from chinese.md, his word
   lists, known characters and components, saved sentences: life/chinese/words.py kit writes it).
   The card is written in a line format (CARD_FORMAT below) so the board, not the model, decides how it looks, and
   the board checks every character against his known list itself: a known character is never taken apart.
   If Claude judges that one more word belongs with this one (a `second:` line, or `card:` in a follow-up answer), the
   board writes that card too and shows it as the tab after it.
   The window's tabs are every card waiting to be carded: the Next up five, then any other card already written and not
   carded yet (an "Any word", a second card), each second card right after its word. Carding one takes it out of the
   tabs; × on a tab that isn't Next up drops it (Undo, Cmd+Z).
   "Card it" = typed into Anki: the word leaves Next up at once (Undo in a toast, and Cmd+Z), and the 10 pm task files it.
   Collection `cards`, one doc per word, id "w" + the code points: {word, text, chat:[{q,a}], made, model,
   src: next|any|second, parent, carded, filed, making, dropped, knows:{char:true|false}}. The five Next up words are written
   ahead when the board opens on a computer. ---------- */
const CD={docs:{},kit:null,busy:{},open:null,cur:null,ahead:false,loaded:false};
const CD_MODELS={opus:'claude-opus-5-5',sonnet:'claude-sonnet-5-5'};
LAB.define('card-model','Cards written by',[['opus','Opus'],['sonnet','Sonnet']],'opus','Cards');
LAB.define('card-ahead','Next five written ahead',[['on','On'],['off','Off']],'on','Cards');
const cardId=w=>'w'+[...String(w)].map(c=>c.codePointAt(0).toString(16)).join('-');
const cardOf=w=>CD.docs[cardId(w)]||null;
// a card in the line format (the first cards, from Nov 4, were plain text: those get rewritten when opened)
const cardOK=d=>!!(d&&d.text&&/^\s*word\s*[:：]/im.test(d.text));
const cardCarded=w=>{const d=cardOf(w);return !!(d&&d.carded);};
const CD_HAN=/[㐀-鿿⺀-⿕]/;
const imgURL=w=>`https://duckduckgo.com/?q=${encodeURIComponent(w)}&iax=images&ia=images&kl=tw-tzh`;
// he makes cards on his Mac only: no writing ahead on a phone
const CD_DESK=()=>matchMedia('(min-width:700px) and (pointer:fine)').matches;

async function cardKit(){
  if(CD.kit) return CD.kit;
  if(!DBH) return null;
  try{const s=await DBH.doc('board/cardkit').get();CD.kit=s.exists?JSON.parse(JSON.stringify(s.data())):null;/* snapshots arrive frozen: work on a copy */}catch(e){console.error(e);}
  if(CD.kit){CD.kit.charSet=new Set([...String(CD.kit.chars||'')]);CD.kit.compSet=new Set(String(CD.kit.components||'').split(/\s+/).filter(Boolean));
    CD.kit.kSet=new Set(String(CD.kit.known||'').split(/\s+/));}
  return CD.kit;
}
const knownChar=c=>!!(CD.kit&&(CD.kit.charSet.has(c)||CD.kit.compSet.has(c)));

const CARD_FORMAT=`Write the card as lines that each start with one of these tags, in this order. Nothing else: no headings, no markdown except **bold**, no closing remarks.
word: the word
pinyin: its Taiwan reading
meaning: short English
mine: Chinese | pinyin | English            (one per saved sentence of his, if any)
ex: Chinese | pinyin | English              (exactly two; a short exchange fits on one line: A：… B：…)
char: 字 | its meaning                       (one per character of the word, in order)
part: 扌 | hand                              (a component of the char above)
part: 巨 | giant, huge | ask                 (a common character on neither of his lists: meaning only, not taken apart; the board asks him if he knows it)
sub: 隹 | short-tailed bird                  (a component of the part above, when that part is unfamiliar)
story: the story, 2 or 3 short sentences, with the characters and parts written inside it in Chinese
know: one proactive-knowledge point, one sentence     (2 to 4; two strong ones beat four)
second: word | why he should learn it right now, one short line     (only when your judgment says so)

For a character he knows, write its char line and nothing under it. Write no "do you know…" question: the ask flag does that. Skip "Suggested next": the board shows his queue.

The story is the one place the characters get made sense of. It explains them through their parts the way a Taiwanese friend would, down to earth, so he sees it every time he looks at the character ("耂 is an old person hunched over with long hair, the top of 老"). Wild and funny when it helps it stick, never long. No separate logic or mnemonic lines.

Before you send, check: every line is as short as it can be; every word and phrase is what people in Taiwan say (mainland-only usage is wrong here: 揹黑鍋, not 背鍋); every pinyin tone mark is right; the story is 2 or 3 sentences and has the characters in it; each know point is about real use (which word a Taiwanese person reaches for, register, collocations), not grammar talk; nothing is introduced by a label or title before the point ("The 'progress' trap: …" becomes just the point); Chinese text has only Chinese punctuation.`;

function cardPrompt(kit,word){
  const saved=(kit.saved||{})[word.replace(/臺/g,'台')]||[];   // words.py kit keys them in 台 form
  const nu=(STATE&&STATE.nextUp||[]).find(r=>r[0]===word);
  const chars=[...word].filter(c=>CD_HAN.test(c));
  const recent=Object.values(CD.docs).filter(d=>d.word&&d.word!==word&&(d.carded||d.text)).sort((a,b)=>String(b.made||'').localeCompare(String(a.made||''))).slice(0,15).map(d=>d.word);
  const queue=(STATE&&STATE.nextUp||[]).map(r=>r[0]).filter(w=>w!==word);
  return `You are Chris's Taiwan Mandarin tutor. He is high A2, learns Traditional characters and Taiwan usage, and makes his Anki cards by hand from what you write. Write ONE card for: ${word}${nu?` (his queue says: ${nu[1]}, ${nu[2]})`:''}

=== HIS CARD RULES (his words; they decide what goes in a card) ===
${kit.spec}
${kit.sprint?`\nRight now: ${kit.sprint}\n`:''}
The layout these rules describe is replaced by the line format at the end. Everything else in them holds. "Companion words" becomes the second: line.

=== WHAT HE KNOWS (checked by the board, exact) ===
The characters of ${word}: ${chars.map(c=>`${c} ${knownChar(c)?'KNOWN: char line only, nothing under it':'new to him'}`).join('; ')||'none'}
Every single character he knows: ${kit.chars}
Known components: ${kit.components}
Words he knows: ${kit.known}
Words he is learning: ${kit.learning}
His saved sentences for ${word}: ${saved.length?'\n'+saved.map(s=>'- '+s).join('\n'):'none'}
Carded lately: ${recent.join(' ')||'none'}
Queued next: ${queue.join(' ')||'none'}

=== A SECOND CARD ===
Judge it the way a good tutor sitting next to him would. Is there one other word he should learn right now, together with this one, so the pair does more than either alone? It earns a card when, for example, the target has a fixed partner, it is half of a pair, Taiwanese people actually reach for another word in its place, or the meaning leans on a word he lacks. Use your judgment beyond these: the test is whether he would be stuck, misled or clearly short-changed without it. A merely related word, a synonym list or a word he already knows or carded lately does not count. Most cards need none. At most one.

=== FORMAT ===
${CARD_FORMAT}`;
}
function cardCall(sm,input,opts){
  const m=CD_MODELS[LAB.get('card-model')]||CD_MODELS.opus;
  return sm(input,{model:m,modelTier:'complex',cache:false,...opts});
}

/* ---------- the line format, parsed (it works on a half-written card while it streams) ---------- */
function parseCard(t){
  const c={mine:[],ex:[],chars:[],know:[],second:null,cards:[]};
  let last=null;
  String(t||'').split('\n').forEach(raw=>{
    const l=raw.trim(); if(!l) return;
    const m=/^(word|pinyin|meaning|mine|ex|char|part|sub|logic|story|hook|know|second|card)\s*[:：]\s*(.*)$/i.exec(l);
    if(!m){ // a wrapped line belongs to the field above it
      if(last&&typeof last.o[last.k]==='string') last.o[last.k]+=(last.o[last.k]?' ':'')+l;
      return;
    }
    const k=m[1].toLowerCase(), v=m[2].trim(), f=v.split(/\s*\|\s*/);
    const ch=c.chars[c.chars.length-1], pt=ch&&ch.parts[ch.parts.length-1];
    // a glyph field holds the character alone; a note after it ("㠭 (squashed into the middle)") moves to the end of the meaning
    if(/^(char|part|sub)$/.test(k)&&f[0]){const g=/^(\S+?)\s*(\(.*\)|（.*）|\s.+)$/.exec(f[0].trim());if(g){f[0]=g[1];f[1]=((f[1]||'')+' '+g[2].trim()).trim();}}
    if(k==='word'||k==='pinyin'||k==='meaning'||k==='story'||k==='hook'){c[k]=v;last={o:c,k};}
    else if(k==='mine'||k==='ex'){const s={zh:f[0]||'',py:f[1]||'',en:f.slice(2).join(' | ')};c[k].push(s);last={o:s,k:'en'};}
    else if(k==='char'){const x={c:f[0]||'',m:f.slice(1).join(' | '),parts:[],logic:''};c.chars.push(x);last={o:x,k:'m'};}
    else if(k==='part'&&ch){const ask=/^ask$/i.test(f[f.length-1]||'')&&f.length>2;const x={c:f[0]||'',m:(ask?f.slice(1,-1):f.slice(1)).join(' | '),ask,subs:[]};ch.parts.push(x);last={o:x,k:'m'};}
    else if(k==='sub'&&pt){const x={c:f[0]||'',m:f.slice(1).join(' | ')};pt.subs.push(x);last={o:x,k:'m'};}
    else if(k==='logic'&&ch){ch.logic=v;last={o:ch,k:'logic'};}
    else if(k==='know'){c.know.push(v);last={o:c.know,k:c.know.length-1};}
    else if(k==='second'||k==='card'){const x={w:(f[0]||'').trim(),why:f.slice(1).join(' | ')};if(k==='second')c.second=x;else c.cards.push(x);last={o:x,k:'why'};}
  });
  return c;
}
const inl=s=>zh(s).replace(/\*\*(.+?)\*\*/g,'<b>$1</b>');

/* ---------- writing a card ---------- */
async function makeCard(word,src,opt={}){
  const id=cardId(word);
  if(CD.busy[id]) return;
  const sm=await sampler(), kit=await cardKit();
  if(!sm||!kit||!DBH){CD.docs[id]={...(CD.docs[id]||{word}),err:!kit?'nokit':'nosample'};CD_paintAll();return;}
  const prev=CD.docs[id];
  if(!opt.redo&&cardOK(prev)) return;
  if(!opt.redo&&prev&&prev.making&&Date.now()-Date.parse(prev.making)<4*60e3) return;   // another device is on it
  CD.busy[id]={text:''}; CD_paintAll();
  const ref=DBH.doc('cards/'+id), now=new Date().toISOString();
  const base={word,src:prev&&prev.src||src||'any',parent:prev&&prev.parent||opt.parent||null,chat:opt.redo?[]:(prev&&prev.chat||[]),
    carded:prev&&prev.carded||null,filed:prev&&prev.filed||null,knows:prev&&prev.knows||{}};
  try{await ref.set({...base,text:'',made:null,model:null,making:now});}catch(e){console.error(e);}
  let raf=0;
  try{
    const r=await cardCall(sm,cardPrompt(kit,word),{onText:({text})=>{
      CD.busy[id].text=text;
      if(!raf) raf=requestAnimationFrame(()=>{raf=0;CD_paintAll();});
    }});
    const doc={...base,text:r.text,made:new Date().toISOString(),model:r.modelApplied||r.modelTierApplied||'',making:null,err:null};
    CD.docs[id]=doc;
    await ref.set(doc);
    const sec=parseCard(r.text).second;
    if(sec) secondCard(word,sec.w);
  }catch(e){
    if(e&&e.code!=='cancelled') console.error(e);
    CD.docs[id]={...base,text:'',making:null,err:e&&e.code||'error'};
    // the reason stays on the doc, so a session can see why a card didn't come
    try{await ref.update({making:null,err:String(e&&e.code||'error')+(e&&e.message?': '+String(e.message).slice(0,300):'')});}catch(_){}
  }finally{
    delete CD.busy[id];
    CD_paintAll(); NU_refresh();
  }
}
// a second card Claude asked for: written once, shown beside its parent
function secondCard(parent,w){
  w=String(w||'').trim(); if(!w||w===parent||!CD_HAN.test(w)) return;
  if(CD.kit&&CD.kit.kSet.has(w)) return;
  const d=cardOf(w);
  if(!cardOK(d)) makeCard(w,'second',{parent});
  CD_paintAll();
}

async function askCard(word,q){
  const id=cardId(word), d=CD.docs[id];
  if(!d||!d.text||CD.busy[id]) return;
  const sm=await sampler(), kit=await cardKit(); if(!sm||!kit) return;
  const chat=[...(d.chat||[]),{q,a:''}];
  CD.docs[id]={...d,chat}; CD.busy[id]={chat:true}; CD_paintAll();
  const turns=[{role:'user',content:cardPrompt(kit,word)},{role:'assistant',content:d.text}];
  chat.slice(0,-1).forEach(c=>{turns.push({role:'user',content:c.q});if(c.a)turns.push({role:'assistant',content:c.a});});
  turns.push({role:'user',content:`Chris asks about this card: ${q}

Answer as his tutor: direct, few words, Traditional characters, Taiwan usage. Plain sentences; "- " for a list, **bold** sparingly, no headings. If he asks for a card for another word, or your answer shows one more word he should card now, end with one line "card: word | why" and the board writes that card beside this one.`});
  let raf=0;
  try{
    const r=await cardCall(sm,turns,{effort:'medium',onText:({text})=>{
      chat[chat.length-1].a=text;
      if(!raf) raf=requestAnimationFrame(()=>{raf=0;CD_paintAll();});
    }});
    chat[chat.length-1].a=r.text;
    parseCard(r.text).cards.forEach(x=>secondCard(word,x.w));
  }catch(e){
    if(e&&e.code!=='cancelled') console.error(e);
    chat[chat.length-1].a=chat[chat.length-1].a||(e&&e.code==='rate_limited'?'Usage limit reached. Ask again later.':'No answer came back. Ask again.');
  }finally{
    delete CD.busy[id];
    CD.docs[id]={...CD.docs[id],chat};
    try{await DBH.doc('cards/'+id).update({chat});}catch(e){console.error(e);}
    CD_paintAll();
  }
}

// Card it and the "Do you know it?" answers go on the board's undo history (Cmd+Z / Cmd+Shift+Z, improve.js)
async function CD_write(word,patch){
  const id=cardId(word), d=CD.docs[id]; if(!d) return;
  CD.docs[id]={...d,...patch}; CD_paintAll(); NU_refresh();
  try{await DBH.doc('cards/'+id).update(patch);}catch(e){console.error(e);}
}
function CD_apply(e,side){const c=e.card;CD_write(c.word,{[c.field]:c[side]});}
// the time with his own offset (2026-11-05T22:10:00+08:00), so the 10 pm task files the card on his day, wherever it runs
const localStamp=()=>{const n=new Date(),o=-n.getTimezoneOffset(),p=x=>String(Math.floor(Math.abs(x))).padStart(2,'0');
  return K(n)+'T'+p(n.getHours())+':'+p(n.getMinutes())+':'+p(n.getSeconds())+(o<0?'-':'+')+p(o/60)+':'+p(o%60);};
async function setCarded(word,on){
  const d=cardOf(word); if(!d||!d.text) return;
  const before=d.carded||null, after=on?localStamp():null;
  record({card:{word,field:'carded',before,after}});
  await CD_write(word,{carded:after});
}
function cardedToast(word){
  hideToast(true);
  const el=document.createElement('div');el.className='toast';el.setAttribute('role','status');
  el.innerHTML=`<span>Carded <span class="zh">${esc(word)}</span></span><button type="button">Undo</button>`;document.body.appendChild(el);
  el.querySelector('button').onclick=()=>{undo();hideToast();};
  TOAST={el,t:setTimeout(hideToast,6000)};
}
async function setKnows(word,c,v){
  const d=cardOf(word); if(!d) return;
  const before=d.knows||{}, after={...before,[c]:v};
  record({card:{word,field:'knows',before,after}});
  sfx(v===true?'stamp-known':v===false?'stamp-new':'unstamp'); await CD_write(word,{knows:after});
}

// the Next up words, one at a time, quietly (a computer only)
async function writeAhead(){
  // only from the live Next up: the saved copy the page opens with is days old, and its words may be carded already
  if(CD.ahead||LAB.get('card-ahead')!=='on'||!DBH||!CD.loaded||!CD_DESK()||!STATE||STATE===SNAPSHOT) return;
  CD.ahead=true;
  try{
    for(const [w] of NU_pool().slice(0,5)){
      const d=cardOf(w);
      if(d&&(cardOK(d)||d.carded)) continue;
      await makeCard(w,'next');
      if(cardOf(w)&&cardOf(w).err) break;
    }
  }finally{CD.ahead=false;}
}

/* ---------- the card window ----------
   One window, wide. Tabs on top: every card waiting to be carded (CD_words). ‹ › (or ← →) walk the tabs, so a batch of
   cards is one open window; walking writes nothing. Enter writes a card not written yet, and cards a written one (then
   the next tab comes up). One layout (his pick, 2026-11-05): the word with its characters and story on the left, the
   sentences and what's worth knowing on the right, each column stacked on its own so neither waits for the other.
   Everything behind the window is inert while it's open (no hover sounds, no clicks, no focus). */
const CD_EL=document.createElement('div');
CD_EL.className='cd-back'; CD_EL.hidden=true;
CD_EL.innerHTML=`<article class="cd-sheet" role="dialog" aria-modal="true" aria-label="Card">
  <div class="cd-bar">
    <div class="cd-tabs" role="tablist"></div>
    <span class="cd-sp"></span>
    <span class="cd-nav"><button type="button" class="cd-ib" data-act="prev" aria-label="Previous card (←)">‹</button><button type="button" class="cd-ib" data-act="next" aria-label="Next card (→)">›</button></span>
    <a class="cd-btn" data-act="img" target="_blank" rel="noopener">Images</a>
    <button type="button" class="cd-btn cd-done" data-act="carded"></button>
    <button type="button" class="cd-x" aria-label="Close (Esc)" data-act="close">×</button>
  </div>
  <div class="cd-main"><div class="cd-colL"><div class="cd-headwrap"></div><div class="cd-left"></div></div><div class="cd-colR"></div><div class="cd-thread"></div></div>
  <form class="cd-ask"><input type="text" class="cd-q" autocomplete="off" lang="zh-Hant"><button type="submit" class="cd-send" aria-label="Ask">↑</button></form>
</article>`;
document.body.appendChild(CD_EL);
const CD_SH=CD_EL.querySelector('.cd-sheet'), CD_MAIN=CD_EL.querySelector('.cd-main');

// the target word, marked inside the example sentences
function markTarget(html,w){
  if(!w) return html;
  const e=esc(w).replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  let n=0;
  return html.replace(new RegExp(e,'g'),()=>`<mark class="cd-t hl" style="${ES_messy(w+(n++))}">${esc(w)}</mark>`);
}
function charsHTML(c,word,d){
  const knows=d.knows||{};
  return c.chars.map(ch=>{
    const k=knownChar(ch.c);
    if(k||!ch.parts.length) return `<div class="cd-ch${k?' known':''}"><span class="cd-big zh" lang="zh-Hant">${esc(ch.c)}</span><span class="cd-chm">${inl(ch.m)}</span></div>`;
    return `<div class="cd-ch"><div class="cd-chtop"><span class="cd-big zh" lang="zh-Hant">${esc(ch.c)}</span><span class="cd-chm">${inl(ch.m)}</span></div>
      <ul class="cd-parts">${ch.parts.map(p=>{
        const pk=knownChar(p.c), asked=p.ask&&!pk, ans=knows[p.c];
        return `<li class="cd-part${pk||ans===true?' known':''}${asked?' ask':''}"><span class="cd-pc zh" lang="zh-Hant">${esc(p.c)}</span><span class="cd-pm">${inl(p.m)}</span>${asked?`<span class="cd-q2" role="group" aria-label="Do you know ${esc(p.c)}?"><button type="button" data-know="${esc(p.c)}" data-v="1" aria-pressed="${ans===true}">I know it</button><button type="button" data-know="${esc(p.c)}" data-v="0" aria-pressed="${ans===false}">New</button></span>`:''}
          ${p.subs.length?`<ul class="cd-subs">${p.subs.map(s=>`<li class="${knownChar(s.c)?'known':''}"><span class="cd-pc zh" lang="zh-Hant">${esc(s.c)}</span><span class="cd-pm">${inl(s.m)}</span></li>`).join('')}</ul>`:''}</li>`;}).join('')}</ul>
      ${ch.logic?`<p class="cd-logic">${inl(ch.logic)}</p>`:''}</div>`;}).join('');
}
// an exchange (A：… B：…) gets one line per speaker, in all three rows
const turnsOf=s=>String(s||'').split(/\s+(?=B\s*[：:])/);
function sentHTML(list,cls,w){
  return list.map((s,n)=>{
    const key=cls+n+':'+w, on=CD.py.has(key);
    const zs=turnsOf(s.zh), ps=turnsOf(s.py), es=turnsOf(s.en);
    CD.cp[key]=CD_ankiCopy(zs,w);
    return `<div class="cd-sent ${cls}${on?' py':''}" data-k="${esc(key)}" role="button" tabindex="0" aria-expanded="${on}">${zs.map((z,i)=>`<div class="cd-turnl"><p class="cd-szh zh" lang="zh-Hant">${(m=>m?`<i class="cd-sp">${m[1]}</i>${markTarget(zh(z.slice(m[0].length)),w)}`:markTarget(zh(z),w))(/^([AB])\s*[：:]\s*/.exec(z))}</p>${ps[i]?`<p class="cd-spy">${esc(ps[i].replace(/^[AB]\s*[：:]\s*/,''))}</p>`:''}${es[i]?`<p class="cd-sen">${inl(es[i].replace(/^[AB]\s*[：:]\s*/,''))}</p>`:''}</div>`).join('')}</div>`;}).join('');
}
/* ---------- copy for Anki: the Chinese only, the target word underlined, nothing else (no fonts, colours or spans,
   so Anki's paste keeps just the underline). An exchange is one line per speaker, each starting "- "; a single sentence
   loses its closing full stop. The word itself follows at the end, after a space, for him to cut into the next field. ---------- */
CD.cp={};
function CD_ankiCopy(zs,w){
  let lines=zs.map(z=>String(z).replace(/^[AB]\s*[：:]\s*/,'').replace(/\*\*/g,'').trim()).filter(Boolean);
  if(lines.length===1) lines=[lines[0].replace(/[。．.]+$/,'').trim()];
  const pre=lines.length>1?'- ':'', we=w?esc(w).replace(/[.*+?^${}()|[\]\\]/g,'\\$&'):'', tail=w||'';
  return {
    html:lines.map(l=>pre+(we?esc(l).replace(new RegExp(we,'g'),'<u>$&</u>'):esc(l))).join('<br>')+esc(tail),
    text:lines.map(l=>pre+l).join('\n')+tail};
}
async function CD_copy(sn){
  const c=CD.cp[sn.dataset.k]; if(!c) return;
  let ok=false;
  const on=e=>{e.clipboardData.setData('text/html',c.html);e.clipboardData.setData('text/plain',c.text);e.preventDefault();ok=true;};
  document.addEventListener('copy',on);
  try{document.execCommand('copy');}catch(_){}
  document.removeEventListener('copy',on);
  if(!ok){try{await navigator.clipboard.write([new ClipboardItem({'text/html':new Blob([c.html],{type:'text/html'}),'text/plain':new Blob([c.text],{type:'text/plain'})})]);ok=true;}catch(e){console.error(e);}}
  if(!ok) return;
  sfx('save'); sn.classList.remove('copied'); void sn.offsetWidth; sn.classList.add('copied'); clearTimeout(sn._t); sn._t=setTimeout(()=>sn.classList.remove('copied'),260);
}
function answerHTML(t){
  const out=[];let ul=false;
  t.split('\n').forEach(raw=>{const l=raw.trim();
    if(!l){if(ul){out.push('</ul>');ul=false;}return;}
    const b=/^[-•*]\s+(.*)$/.exec(l);
    if(b){if(!ul){out.push('<ul>');ul=true;}out.push(`<li>${inl(b[1])}</li>`);return;}
    if(ul){out.push('</ul>');ul=false;}
    out.push(`<p>${inl(l.replace(/^#+\s*/,''))}</p>`);});
  if(ul)out.push('</ul>');
  return out.join('');
}
const CD_waitText=(d,b)=>b?'Writing the card':String(d.err||'').startsWith('rate_limited')?'Usage limit reached. Try again later.':d.err==='nokit'?'The board has no card rules yet.':d.err==='nosample'?'Claude isn\'t reachable from this view.':d.err?'It didn\'t come through.':'';
// the parts of one card, each in its own block; the layout (CSS) decides where each block goes
function cardParts(word,d,b){
  const text=b&&!b.chat?b.text:d.text, c=parseCard(text), w=c.word||word;
  const blk=(area,title,h)=>h?`<section class="cd-blk" data-area="${area}">${title?`<h3 class="cd-h">${title}</h3>`:''}${h}</section>`:'';
  const head=`<header class="cd-head"><h2 class="cd-w zh" lang="zh-Hant">${esc(w)}</h2><div class="cd-hm"><p class="cd-py">${esc(c.pinyin||'')}</p><p class="cd-en">${inl(c.meaning||'')}</p></div>
    ${!text?(!b&&!d.err?`<button type="button" class="cd-btn cd-write" data-act="retry">Write it <kbd>↵</kbd></button>`:`<p class="cd-wait">${CD_waitText(d,b)}</p>${d.err&&!b?'<button type="button" class="cd-btn" data-act="retry">Try again</button>':''}`):''}</header>`;
  if(!text) return {head,left:'',right:''};
  let left='', right='';
  right+=blk('ex',c.mine.length?'His sentences and examples':'Examples',sentHTML(c.mine,'mine',w)+sentHTML(c.ex,'',w));
  left+=blk('chars','',c.chars.length?`<div class="cd-chars">${charsHTML(c,word,d)}</div>`:'');
  left+=blk('story','Story',(c.story?`<p class="cd-story">${inl(c.story)}</p>`:'')+(c.hook?`<p class="cd-hook"><span class="hl" style="${ES_messy('hook'+w)}">${inl(c.hook)}</span></p>`:''));
  right+=blk('know','Worth knowing',c.know.length?`<ul class="cd-know">${c.know.map(k=>`<li>${inl(k)}</li>`).join('')}</ul>`:'');
  if(b&&!b.chat) left+='<p class="cd-wait cd-more" aria-hidden="true"></p>';
  return {head,left,right};
}
function threadHTML(d){
  return (d.chat||[]).map(t=>{
    const a=String(t.a||'').split('\n').filter(l=>!/^card\s*[:：]/i.test(l.trim())).join('\n');
    return `<div class="cd-turn"><p class="cd-me zh">${zh(t.q)}</p><div class="cd-a">${a?answerHTML(a):'<p class="cd-wait"></p>'}</div></div>`;
  }).join('');
}
// the words a card asked for beside it: its second: line and any card: line in its follow-ups
function CD_kids(w){
  const d=cardOf(w)||{}, c=parseCard(d.text), out=[];
  if(c.second) out.push(c.second.w);
  (d.chat||[]).forEach(t=>parseCard(t.a).cards.forEach(x=>out.push(x.w)));
  return out.map(x=>String(x||'').trim()).filter(x=>x&&x!==w&&CD_HAN.test(x)&&!(CD.kit&&CD.kit.kSet.has(x)));
}
// the tabs: the Next up five, then every other card written (or being written) and not carded or dropped, oldest first;
// a second card right after its word. The card on screen stays a tab until he moves on, so carding it doesn't yank it away.
function CD_words(){
  if(CD.open===null) return [];
  const out=[], seen=new Set();
  const live=w=>{const d=cardOf(w);return !(d&&(d.carded||d.dropped));};
  const walk=w=>{if(!w||seen.has(w))return;seen.add(w);if(live(w))out.push(w);CD_kids(w).forEach(walk);};
  // the five in Next up (the one on screen holds its place even once carded, so its second card stays right after it)
  (STATE&&STATE.nextUp||[]).filter(r=>!cardCarded(r[0])||r[0]===CD.cur).slice(0,5).forEach(r=>walk(r[0]));
  Object.values(CD.docs).filter(d=>d.word&&!d.carded&&!d.dropped&&(cardOK(d)||d.making))
    .sort((a,b)=>String(a.made||a.making||'').localeCompare(String(b.made||b.making||'')))
    .forEach(d=>walk(d.parent&&cardOf(d.parent)?d.parent:d.word));
  Object.values(CD.docs).forEach(d=>{if(d.word&&!seen.has(d.word)&&!d.carded&&!d.dropped&&(cardOK(d)||d.making))walk(d.word);});
  if(CD.cur&&!out.includes(CD.cur)) out.splice(Math.min(CD.at||0,out.length),0,CD.cur);
  return out;
}
// why Claude added a second card: from the card it came with
function CD_whyFor(w){
  const d=cardOf(w)||{}, pw=d.parent||(CD_words().find(x=>x!==w&&CD_kids(x).includes(w)));
  if(!pw) return {why:'',parent:''};
  const pd=cardOf(pw)||{}, c=parseCard(pd.text);
  if(c.second&&c.second.w===w) return {why:c.second.why,parent:pw};
  for(const t of pd.chat||[]){const x=parseCard(t.a).cards.find(y=>y.w===w);if(x)return {why:x.why,parent:pw};}
  return {why:'',parent:''};
}
const CD_pool=()=>new Set(NU_pool().slice(0,5).map(r=>r[0]));
// repaint without losing the scroll position or what he is typing
function CD_paintAll(){
  if(CD.open===null) return;
  const words=CD_words(), w=CD.cur, id=cardId(w), d=CD.docs[id]||{}, b=CD.busy[id], at=words.indexOf(w), nu=CD_pool();
  CD.at=at;
  CD_SH.setAttribute('aria-label','Card: '+w);
  CD_EL.querySelector('.cd-tabs').innerHTML=words.map(x=>{const dx=cardOf(x)||{};return `<button type="button" role="tab" class="cd-tab${dx.text||CD.busy[cardId(x)]?'':' todo'}" data-tab="${esc(x)}" aria-selected="${x===w}"><span class="zh" lang="zh-Hant">${esc(x)}</span>${dx.carded?'<i class="cd-tick" aria-label="carded">✓</i>':!nu.has(x)&&dx.word?`<i class="cd-tx" data-drop="${esc(x)}" role="button" aria-label="Drop ${esc(x)}">×</i>`:''}</button>`;}).join('');
  const sel=CD_EL.querySelector('.cd-tab[aria-selected="true"]'); if(sel&&CD.tabT!==w){CD.tabT=w;sel.scrollIntoView({block:'nearest',inline:'nearest'});}
  const img=CD_EL.querySelector('[data-act="img"]'); img.href=imgURL(w);
  const done=CD_EL.querySelector('.cd-done'); done.setAttribute('aria-pressed',String(!!d.carded)); done.textContent=d.carded?'Carded':'Card it'; done.disabled=!d.text;
  CD_EL.querySelector('[data-act="prev"]').disabled=at<=0;
  CD_EL.querySelector('[data-act="next"]').disabled=at<0||at>=words.length-1;
  CD_EL.querySelector('.cd-nav').hidden=words.length<2;
  const q=CD_EL.querySelector('.cd-q'), send=CD_EL.querySelector('.cd-send');
  q.placeholder='Ask about '+w; q.disabled=send.disabled=!d.text||!!b;
  const thr=CD_EL.querySelector('.cd-thread');
  const same=CD_SH.dataset.w===w, top=same?CD_MAIN.scrollTop:0, ttop=same?thr.scrollTop:0;
  const stick=thr.scrollHeight-thr.scrollTop-thr.clientHeight<40;
  const wy=CD_whyFor(w);
  const p=cardParts(w,d,b);
  CD_EL.querySelector('.cd-headwrap').innerHTML=(wy.why?`<p class="cd-why">With <span class="zh">${esc(wy.parent)}</span>: ${inl(wy.why)}</p>`:'')+p.head;
  CD_EL.querySelector('.cd-left').innerHTML=p.left; CD_EL.querySelector('.cd-colR').innerHTML=p.right;
  thr.innerHTML=threadHTML(d); thr.hidden=!(d.chat||[]).length;
  CD_SH.dataset.w=w;
  CD_MAIN.scrollTop=top;
  thr.scrollTop=b&&b.chat&&stick?thr.scrollHeight:ttop;
  if(b&&b.chat&&stick) CD_MAIN.scrollTop=CD_MAIN.scrollHeight;
}
// a sentence's pinyin shows while he wants it (click or Enter on the sentence); it stays shown through repaints
CD.py=new Set();
function CD_py(sn){const k=sn.dataset.k;CD.py.has(k)?CD.py.delete(k):CD.py.add(k);sn.classList.toggle('py',CD.py.has(k));sn.setAttribute('aria-expanded',String(CD.py.has(k)));sfx('tap');}
function CD_inert(on){document.querySelectorAll('body > header, body > main, #settings').forEach(el=>{if(on)el.setAttribute('inert','');else el.removeAttribute('inert');});}
function openCard(word,src,opt={}){
  word=String(word||'').trim(); if(!word) return;
  const first=CD.open===null;
  if(first) CD.at=0;
  CD.open=word; CD.cur=word; clearTimeout(CD.advT);
  CD_EL.hidden=false; document.documentElement.classList.add('cd-on'); CD_inert(true);
  // two frames: the closed state is painted first, so the sheet always eases in (one frame sometimes skipped it)
  if(first){clearTimeout(CD.hideT);requestAnimationFrame(()=>requestAnimationFrame(()=>CD_EL.classList.add('in')));}
  CD_paintAll();
  const d=cardOf(word);
  if(!cardOK(d)&&!CD.busy[cardId(word)]){if(opt.write!==false||d&&d.making)makeCard(word,src);}
  else {const c=parseCard(d.text);if(c.second&&!cardOK(cardOf(c.second.w)))secondCard(word,c.second.w);}
  if(first) sfx('tap');
}
function closeCard(){
  if(CD.open===null) return;
  CD.open=null; CD.cur=null; CD_EL.classList.remove('in'); document.documentElement.classList.remove('cd-on'); CD_inert(false);
  // hidden only once the sheet has finished leaving (its transform runs .24 s)
  clearTimeout(CD.hideT); CD.hideT=setTimeout(()=>{if(CD.open===null)CD_EL.hidden=true;},260);
}
// a tab: show its card; looking writes nothing (Enter or Write it does), but a second card it asks for gets written
function CD_go(w){
  if(!w||w===CD.cur) return;
  clearTimeout(CD.advT); CD.cur=w; CD_paintAll();
  const d=cardOf(w);
  if(cardOK(d)){const c=parseCard(d.text);if(c.second&&!cardOK(cardOf(c.second.w)))secondCard(w,c.second.w);}
}
// ‹ › and ← →: the next or previous tab
function CD_step(dir){
  const L=CD_words(), i=L.indexOf(CD.cur)+dir;
  if(i<0||i>=L.length) return;
  CD_go(L[i]); sfx('tap');
}
// Card it (the button or Enter): stamped, confetti, a toast with Undo; a moment later the next tab comes up
function CD_cardIt(){
  const w=CD.cur, d=cardOf(w); if(!d||!d.text) return;
  const on=!d.carded; setCarded(w,on);
  if(!on){sfx('unstamp');return;}
  sfx('stamp-known');
  const r=CD_EL.querySelector('.cd-done').getBoundingClientRect(); celebrate('card',{x:r.left+r.width/2,y:r.top+r.height/2}); cardedToast(w);
  clearTimeout(CD.advT);
  CD.advT=setTimeout(()=>{
    if(CD.open===null||CD.cur!==w||!cardCarded(w)) return;
    const L=CD_words(), i=L.indexOf(w), nx=L[i+1]||L[i-1];
    if(nx&&nx!==w) CD_go(nx);
  },650);
}
// × on a tab: the card leaves the tabs (Undo and Cmd+Z bring it back); the 10 pm task ignores it
function CD_drop(w){
  const d=cardOf(w); if(!d) return;
  if(w===CD.cur){const L=CD_words(), i=L.indexOf(w), nx=L[i+1]||L[i-1];if(nx&&nx!==w)CD_go(nx);}
  record({card:{word:w,field:'dropped',before:d.dropped||null,after:localStamp()}});
  CD_write(w,{dropped:localStamp()}); sfx('unstamp');
  hideToast(true);
  const el=document.createElement('div');el.className='toast';el.setAttribute('role','status');
  el.innerHTML=`<span>Dropped <span class="zh">${esc(w)}</span></span><button type="button">Undo</button>`;document.body.appendChild(el);
  el.querySelector('button').onclick=()=>{undo();hideToast();};
  TOAST={el,t:setTimeout(hideToast,6000)};
}
/* a sentence: a click copies it for Anki, a hold (350 ms, or a right-click) shows its pinyin (as in Money in Order) */
const CD_HOLD={t:0,el:null,x:0,y:0,fired:false};
function CD_holdEnd(){clearTimeout(CD_HOLD.t);CD_HOLD.t=0;if(CD_HOLD.el)CD_HOLD.el.classList.remove('press');CD_HOLD.el=null;}
CD_EL.addEventListener('pointerdown',e=>{
  const sn=e.target.closest('.cd-sent'); if(!sn||e.pointerType==='mouse'&&e.button!==0) return;
  CD_holdEnd(); CD_HOLD.fired=false; CD_HOLD.el=sn; CD_HOLD.x=e.clientX; CD_HOLD.y=e.clientY; sn.classList.add('press');
  CD_HOLD.t=setTimeout(()=>{CD_HOLD.t=0;CD_HOLD.fired=true;sn.classList.remove('press');CD_py(sn);try{navigator.vibrate&&navigator.vibrate(10);}catch(_){}},350);
});
CD_EL.addEventListener('pointermove',e=>{if(CD_HOLD.t&&Math.hypot(e.clientX-CD_HOLD.x,e.clientY-CD_HOLD.y)>8)CD_holdEnd();});
['pointerup','pointercancel','pointerleave'].forEach(t=>CD_EL.addEventListener(t,CD_holdEnd));
CD_EL.addEventListener('contextmenu',e=>{
  const sn=e.target.closest('.cd-sent'); if(!sn) return;
  e.preventDefault(); if(!CD_HOLD.fired){CD_holdEnd();CD_HOLD.fired=true;CD_py(sn);}
});
CD_EL.addEventListener('click',e=>{
  if(e.target===CD_EL){closeCard();return;}
  const w=CD.cur, a=e.target.closest('[data-act]'), k=e.target.closest('[data-know]'), t=e.target.closest('[data-tab]');
  const dr=e.target.closest('[data-drop]'); if(dr){e.stopPropagation();CD_drop(dr.dataset.drop);return;}
  if(t){CD_go(t.dataset.tab);sfx('tap');if(e.detail)t.blur();return;}
  const sn=e.target.closest('.cd-sent');
  if(sn){if(CD_HOLD.fired){CD_HOLD.fired=false;return;}CD_copy(sn);return;}
  if(k){const d=cardOf(w)||{},v=k.dataset.v==='1';setKnows(w,k.dataset.know,(d.knows||{})[k.dataset.know]===v?null:v);return;}
  if(!a) return;
  const act=a.dataset.act;
  if(act==='close') closeCard();
  else if(act==='retry') makeCard(w,CD_src(w),{redo:true});
  else if(act==='prev'||act==='next'){CD_step(act==='next'?1:-1);if(e.detail)a.blur();}
  else if(act==='carded'){CD_cardIt();if(e.detail)a.blur();}
});
CD_EL.querySelector('.cd-ask').addEventListener('submit',e=>{
  e.preventDefault();
  const inp=CD_EL.querySelector('.cd-q'), q=inp.value.trim(); if(!q||!CD.cur) return;
  inp.value=''; askCard(CD.cur,q);
});
document.addEventListener('keydown',e=>{
  if(CD.open===null||e.isComposing) return;
  if(e.key==='Escape'){closeCard();return;}
  const t=e.target; if(t&&(t.tagName==='INPUT'||t.isContentEditable)||e.metaKey||e.ctrlKey||e.altKey) return;
  if(e.key==='i'){e.preventDefault();window.open(imgURL(CD.cur),'_blank','noopener');}
  else if(e.key==='ArrowRight'){e.preventDefault();CD_step(1);}
  else if(e.key==='ArrowLeft'){e.preventDefault();CD_step(-1);}
  else if(e.key===' '&&t&&t.classList&&t.classList.contains('cd-sent')){e.preventDefault();CD_copy(t);}
  else if(e.key==='Enter'&&!e.shiftKey){
    // Enter writes a card not written yet, else cards it (a focused tab or ‹ › doesn't take Enter for itself)
    const on=t&&t.closest&&t.closest('button,a'); if(on&&!on.matches('.cd-tab,.cd-ib,.cd-done')) return;
    e.preventDefault();
    const d=cardOf(CD.cur);
    if(!cardOK(d)){if(!CD.busy[cardId(CD.cur)])makeCard(CD.cur,CD_src(CD.cur),{redo:true});}
    else if(!d.carded) CD_cardIt();
  }
  else if(e.key==='Enter'&&e.shiftKey&&t&&t.classList&&t.classList.contains('cd-sent')){e.preventDefault();CD_py(t);}
});

/* ---------- Next up: carded words leave at once; the "any word" box ---------- */
// the queue without what he has carded (the 10 pm task files them, then the list itself moves on)
const CD_src=w=>NU_pool().some(r=>r[0]===w)?'next':null;
function NU_pool(){return (STATE&&STATE.nextUp||[]).filter(r=>!cardCarded(r[0]));}
function NU_refresh(){if(STATE){renderNext(STATE);NU_extras();}}
function NU_extras(){
  let f=document.getElementById('cd-any');
  if(!f&&document.querySelector('#next .nu-top')){
    f=document.createElement('form'); f.id='cd-any'; f.className='cd-any';
    f.innerHTML='<input type="text" autocomplete="off" lang="zh-Hant" aria-label="Card any word" placeholder="Any word">';
    f.addEventListener('submit',e=>{e.preventDefault();const i=f.querySelector('input'),w=i.value.trim();if(w){i.value='';i.blur();openCard(w,'any');}});
    document.querySelector('#next .nu-top').after(f);
  }
}
document.getElementById('next').addEventListener('click',e=>{
  const t=e.target.closest('.nu-row'); if(!t) return;
  const q=NU.list[+t.dataset.i]; if(!q) return;
  e.stopPropagation(); NU_hide(); openCard(q.w,'next');
},true);

BUS.on('data',()=>{NU_extras();writeAhead();});
BUS.on('lab',id=>{if(id==='card-ahead')writeAhead();});
(function wait(n){
  if(DBH){
    cardKit();
    DBH.collection('cards').onSnapshot(s=>{
      const m={};s.docs.forEach(d=>{m[d.id]=JSON.parse(JSON.stringify(d.data()||{}));});
      Object.keys(CD.busy).forEach(id=>{if(CD.docs[id])m[id]={...m[id],...CD.docs[id]};});
      const before=NU_pool().map(r=>r[0]).join();
      CD.docs=m; CD.loaded=true;
      if(NU_pool().map(r=>r[0]).join()!==before) NU_refresh();
      CD_paintAll(); writeAhead();
    },e=>console.error(e));
    return;
  }
  if(n<200) setTimeout(()=>wait(n+1),100);
})(0);
