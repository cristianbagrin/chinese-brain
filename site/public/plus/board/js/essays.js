/* ---------- Essays view: the diary, newest day first, in Mon–Sun weeks counted from DAY 1. Owner: essays agent ----------
   essays/dNNN: {day, date, text, created, edited, tz}, written here. reviews/dNNN: {day, review, marks}, written by
   the weekly review; marks in reading order: {t: fix|better|good|word, mine, nat, note}. A mark is found by its
   words (`mine`) from where the last one ended; one whose words he has since changed drops.
   Each day is a sheet of paper (paper.css, B's); a day the weekly review has read carries the red stamp. Reading is the default: the
   essay reads as the corrected text, only the changed characters marked with one light, slightly messy highlighter
   (every kind of correction alike; well done is plain text). The tip opens only with the pointer on highlighted
   characters (one hit test, ES_hit). Editing is a double-click on the text (or Enter on it) and happens on the
   page itself, with the same type: his own words come back with the corrected spots faintly marked; Esc, Cmd+Enter or a click
   away ends it, and the whole edit is one Cmd+Z step. ---------- */
document.getElementById('view-essays').innerHTML=`<div class="es">
  <div class="es-main">
    <div class="es-top" id="es-top">
      <button class="es-sw" id="mine" type="button" role="switch" aria-checked="false">My version<i aria-hidden="true"></i></button>
    </div>
    <div class="es-days" id="ess-days"></div>
  </div>
  <aside class="es-side" aria-labelledby="ess-lh">
    <button class="es-disc" id="es-disc" type="button" aria-expanded="false" aria-controls="ess-stick"><span>To improve</span><span class="es-dd" id="es-dd"></span><svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true"><path d="M3.5 2 7 5 3.5 8" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
    <div class="es-stick" id="ess-stick">
    <div class="im-head"><h2 class="side-h" id="ess-lh">To improve</h2></div>
    <div id="ess-open"></div>
    <button class="im-new" id="ess-new" type="button"><span aria-hidden="true">+</span>New</button>
    <div id="ess-done"></div>
  </div></aside>
</div>`;
let IMP=null;
const ES_D=document.getElementById('ess-days');
const ES_PIN='<i class="es-pin" aria-label="on your list"></i>';
const ES_ICON_ON='<svg width="13" height="13" viewBox="0 0 12 12" aria-hidden="true"><path d="M2.5 6.2 5 8.6l4.6-5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
// 2026-11-01: sizes, the yellow highlighter at 30%, black ink and double-click editing are his picks (css/essays.css).
// The page type is still open: a different page each week (Noted's different pages), or one he picks.

// where each mark sits: the most marks that still appear in reading order. A mark whose words he changed drops, and
// only that one (a short mark like 他 can't jump to a later 他 and push the marks after it out).
function ES_anchor(text,marks){
  const ms=[];
  (Array.isArray(marks)?marks:[]).forEach((m,k)=>{
    const mine=String(m&&m.mine||'');
    if(!mine.trim()||mine.includes('\n')||!['fix','better','good','word'].includes(m.t)) return;
    const occ=[];for(let i=text.indexOf(mine);i>=0&&occ.length<40;i=text.indexOf(mine,i+1))occ.push(i);
    if(occ.length) ms.push({m,mine,k,occ});
  });
  const N=[];ms.forEach((x,a)=>x.occ.forEach(i=>N.push({a,i,j:i+x.mine.length})));
  const best=N.map(()=>1), prev=N.map(()=>-1);
  for(let q=0;q<N.length;q++)for(let p=0;p<q;p++)
    if(N[p].a<N[q].a&&N[p].j<=N[q].i&&best[p]+1>best[q]){best[q]=best[p]+1;prev[q]=p;}
  let e=-1;N.forEach((_,q)=>{if(e<0||best[q]>best[e])e=q;});
  const out=[];
  for(let q=e;q>=0;q=prev[q]){const x=ms[N[q].a];out.push({...x.m,mine:x.mine,k:x.k,i:N[q].i,j:N[q].j});}
  return out.reverse();
}
const ES_chunk=(t,a,b)=>a<b?`<span data-o="${a}">${mix(t.slice(a,b)).replace(/\n/g,'<br>')}</span>`:'';
function ES_essayHTML(e){
  const text=norm(e.text), rv=ES.reviews[e.day];
  const marks=ES_anchor(text,rv&&rv.marks);
  // one Enter or a blank line: a paragraph either way (the board's sheet saves single breaks)
  const paras=[]; const re=/\n+/g; let last=0,m;
  while((m=re.exec(text))){paras.push([last,m.index]);last=re.lastIndex;}
  paras.push([last,text.length]);
  let mi=0;
  return paras.map(([a,b])=>{
    let h='',pos=a;
    while(mi<marks.length&&marks[mi].i<b){
      const mk=marks[mi++]; if(mk.i<pos) continue;
      const s={...mk,id:e.day+'-'+mk.k,day:e.day}; ES.seg[s.id]=s;
      h+=ES_chunk(text,pos,mk.i)+ES_segHTML(s); pos=mk.j;
    }
    return `<p>${h+ES_chunk(text,pos,b)}</p>`;
  }).join('');
}
// a real highlighter is never the same twice: each mark gets its own slight tilt and height (from its id,
// so it doesn't change between renders)
function ES_messy(id){
  let h=2166136261;for(const c of String(id)){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}
  const r=n=>{h=Math.imul(h^(h>>>15),2246822507);h^=h>>>13;return ((h>>>0)%1000)/1000*n;};
  return `--hl-t:${(178.6+r(2.8)).toFixed(2)}deg;--hl-0:${(14+r(14)).toFixed(1)}%;--hl-1:${(82+r(13)).toFixed(1)}%;`
    +`--hl-e:${(.45+r(.5)).toFixed(2)}`;
}
// only the characters that changed get the highlighter; a correction that only deletes marks the whole corrected run
function ES_hlHTML(s){
  if(s.t==='word') return `<u class="d">${mix(s.nat)}</u>`;
  const h=diffHTML(s.mine,s.nat);
  return h.includes('<u')?h:`<u class="d">${mix(s.nat)}</u>`;
}
function ES_segHTML(s){
  // well done, or nothing to say: his text, plain
  if(s.t==='good'||!s.nat) return `<span data-o="${s.i}">${mix(s.mine)}</span>`;
  // what he wrote shows in the tip, or inline (struck) with My version
  return `<span class="es-c ${s.t}" data-k="${s.id}" data-i="${s.i}"><s class="x-out">${mix(s.mine)}</s><span class="es-n" tabindex="0" role="button" style="${ES_messy(s.id)}">${ES_hlHTML(s)}</span></span>`;
}
// editing shows his own words; the spots Claude corrected keep a faint mark until he changes them
function ES_editHTML(e){
  const text=norm(e.text), rv=ES.reviews[e.day];
  let h='',pos=0;
  ES_anchor(text,rv&&rv.marks).forEach(m=>{
    if(m.i<pos||m.t==='good'||!m.nat) return;
    h+=esc(text.slice(pos,m.i))+`<span class="es-was ${m.t}" data-mine="${esc(m.mine)}" style="${ES_messy(e.day+'-'+m.k)}">${esc(m.mine)}</span>`; pos=m.j;
  });
  return h+esc(text.slice(pos));
}

/* weeks: "Week N" (Week 1 = the Mon–Sun week of DAY 1) and seven dots, Monday to Sunday; green = a written day,
   gold ring = today. The count is the point: it grows with every week he keeps going. */
function ES_weekNo(mon){
  const d1=ES.essays.find(e=>e&&+e.day===1&&e.date)||sorted().slice(-1)[0];
  if(!d1) return 1;
  return Math.max(1,Math.floor(days(monday(P(d1.date)),mon)/7)+1);
}
function ES_dots(mon,have){
  const t=P(essayToday()); let n=0;
  const dots=[0,1,2,3,4,5,6].map(i=>{
    const d=add(mon,i), k=K(d), on=have.has(k); if(on) n++;
    const c=on?'on':k===K(t)?'now':d>t?'later':'miss';
    return `<i class="${c}"></i>`;
  }).join('');
  return `<span class="es-dots" role="img" aria-label="${n} of 7 days written">${dots}</span>`;
}
// a day the weekly review has read carries the teacher's red stamp. A hand-pressed stamp never lands the same way
// twice: its spot, tilt, ink and wear come from the day number, so a day keeps its own stamp between renders.
function ES_stampHTML(e){
  if(!ES.reviews[e.day]) return '';
  let h=e.day*2654435761>>>0;const r=()=>{h=Math.imul(h^h>>>15,2246822507)>>>0;h^=h>>>13;return (h>>>0)%10000/10000;};
  const st=`--st-rot:${(-15+r()*19).toFixed(1)}deg;--st-x:${(r()*34).toFixed(0)}px;--st-y:${(r()*18-4).toFixed(0)}px;`
    +`--st-o:${(.66+r()*.24).toFixed(2)};--st-fade:${(r()*360).toFixed(0)}deg;--st-fa:${(.18+r()*.62).toFixed(2)}`;
  return `<i class="paper-stamp read wear-${1+(e.day*7%6)}" style="${st}" aria-hidden="true"></i>`;
}
// a day the review read in the last five days is fresh: its 閱 stamp in wet ink, until it ages out
const ES_FRESH_DAYS=5;
function ES_fresh(e){
  const r=ES.reviews[e.day], d=r&&String(r.review||'');
  return !!d&&/^\d{4}-\d\d-\d\d/.test(d)&&(P(essayToday())-P(d.slice(0,10)))/864e5<ES_FRESH_DAYS;
}
function ES_dayHTML(e,wk){
  const fr=ES_fresh(e);
  return `<article class="es-day paper${fr?' fresh':''}" data-paper="plain" id="day-${e.day}"><i class="paper-tex" aria-hidden="true"></i>
    <header class="es-dh"><b>Day ${e.day}</b><span>${fmtDate(e.date)}</span><span class="saved" data-saved="${e.date}" aria-live="polite"></span></header>
    <div class="es-text pen" lang="zh-Hant" data-day="${e.day}" tabindex="0">${ES_essayHTML(e)}</div>${ES_stampHTML(e)}</article>`;
}
function ES_render(){
  if(VIEW!=='essays'||ES.editDay!=null){ES.stale=true;return;}
  ES.stale=false;
  const all=sorted();
  ES.seg={};
  if(!all.length){ES_closeTip();ES_D._h=null;ES_D.innerHTML=ES.loaded?'<p class="es-none">Your essays show up here.</p>':'';return;}
  // the newest days, rounded out to whole weeks
  let n=Math.min(ES.show,all.length);
  if(n<all.length){const wk=K(monday(P(all[n-1].date)));while(n<all.length&&K(monday(P(all[n].date)))===wk)n++;}
  const have=new Set(all.map(e=>e.date)), weeks=[];
  all.slice(0,n).forEach(e=>{const mon=monday(P(e.date)),k=K(mon);let w=weeks[weeks.length-1];if(!w||w.k!==k){w={k,mon,days:[]};weeks.push(w);}w.days.push(e);});
  const html=weeks.map(w=>{const n=ES_weekNo(w.mon),l='Week '+n;return `<section class="es-wk" aria-label="${l}"><header class="es-wh"><h2>${l}</h2>${ES_dots(w.mon,have)}</header>${w.days.map(e=>ES_dayHTML(e,n)).join('')}</section>`;}).join('')
    +(all.length>n?'<button class="es-more btn-q" id="es-more" type="button">Earlier weeks</button>':'');
  // the same diary (a snapshot that changed nothing here): leave it, and any open tip, alone. Pins come from ES_refreshPins.
  if(ES_D._h===html) return;
  ES_closeTip(); ES_D._h=html; ES_D.innerHTML=html;
}
// one day again (after an edit), so the rest of the diary doesn't move
function ES_renderDay(e,box,art){
  Object.keys(ES.seg).forEach(k=>{if(ES.seg[k].day===e.day)delete ES.seg[k];});
  box.innerHTML=ES_essayHTML(e);
  art.classList.add('back');setTimeout(()=>art.classList.remove('back'),600);
}
function ES_refreshPins(){
  document.querySelectorAll('.es-c[data-k]').forEach(el=>{
    const s=ES.seg[el.dataset.k], pin=el.querySelector('.es-pin');
    if(!s) return;
    if(IM_listed(s)&&!pin) el.insertAdjacentHTML('beforeend',ES_PIN);
    if(!IM_listed(s)&&pin) pin.remove();
  });
}

/* a place in his text (offsets i..j in what he wrote, e.g. where he got a crossed-off item right): the view goes
   there and the words light up for a moment. Runs of his text carry data-o, marks data-i; a point inside a mark
   snaps to the edge of its corrected words. */
function ES_point(box,o,end){
  for(const el of box.querySelectorAll('[data-o],.es-c[data-k]')){
    if(el.classList.contains('es-c')){
      const s=ES.seg[el.dataset.k], a=+el.dataset.i, b=a+(s?s.mine.length:0);
      if(end?(o>a&&o<=b):(o>=a&&o<b)){const n=el.querySelector('.es-n'),w=document.createTreeWalker(n,NodeFilter.SHOW_TEXT);let t=w.nextNode(),l=t;if(end)while(t){l=t;t=w.nextNode();}return l?{node:l,off:end?l.length:0}:null;}
      continue;
    }
    if(el.closest('.es-c')) continue;
    let n=+el.dataset.o; const w=document.createTreeWalker(el,NodeFilter.SHOW_TEXT|NodeFilter.SHOW_ELEMENT);
    for(let x=w.nextNode();x;x=w.nextNode()){
      if(x.nodeType===3){if(end?(o>n&&o<=n+x.length):(o>=n&&o<n+x.length))return {node:x,off:o-n};n+=x.length;}
      else if(x.nodeName==='BR') n+=1;
    }
  }
  return null;
}
function ES_goPlace(p){
  if(!p) return;
  if(VIEW!=='essays') setView('essays');
  if(ES.editDay!=null) ES_stopEdit();
  if(!document.getElementById('day-'+p.day)){const idx=sorted().findIndex(e=>e.day===p.day);if(idx>=0){ES.show=Math.max(ES.show,idx+1);ES_render();ES_refreshPins();}}
  const box=document.querySelector(`#day-${p.day} .es-text`); if(!box) return;
  const a=ES_point(box,p.i,false), b=ES_point(box,p.j,true); if(!a||!b) return;
  const r=document.createRange(); try{r.setStart(a.node,a.off);r.setEnd(b.node,b.off);}catch(e){return;}
  ES_D.querySelectorAll('.es-spot').forEach(x=>x.remove());
  // the glyphs' own boxes (text nodes only), one band per line
  const h=ES_D.getBoundingClientRect(), rs=[], w=document.createTreeWalker(r.commonAncestorContainer.nodeType===3?r.commonAncestorContainer.parentNode:r.commonAncestorContainer,NodeFilter.SHOW_TEXT);
  for(let t=w.nextNode();t;t=w.nextNode()){
    if(!r.intersectsNode(t)) continue;
    const q=document.createRange(); q.selectNodeContents(t);
    if(t===a.node) q.setStart(t,a.off); if(t===b.node) q.setEnd(t,b.off);
    for(const c of q.getClientRects()){
      if(c.width<1) continue;
      const l=rs.find(x=>Math.abs((x.top+x.bottom)/2-(c.top+c.bottom)/2)<c.height/2);
      if(l){l.left=Math.min(l.left,c.left);l.right=Math.max(l.right,c.right);l.top=Math.min(l.top,c.top);l.bottom=Math.max(l.bottom,c.bottom);}
      else rs.push({left:c.left,right:c.right,top:c.top,bottom:c.bottom});
    }
  }
  if(!rs.length) return;
  rs.forEach(q=>{q.width=q.right-q.left;q.height=q.bottom-q.top;});
  rs.forEach(q=>{const d=document.createElement('i');d.className='es-spot';d.setAttribute('aria-hidden','true');
    d.style.cssText=`left:${q.left-h.left-3}px;top:${q.top-h.top}px;width:${q.width+6}px;height:${q.height}px`;ES_D.appendChild(d);});
  const top=rs[0].top+scrollY-innerHeight/2+rs[0].height/2;
  window.scrollTo({top:Math.max(0,top),behavior:REDUCED()?'auto':'smooth'});
  setTimeout(()=>ES_D.querySelectorAll('.es-spot').forEach(x=>x.remove()),2200);
}

/* the tip, Brain's card: what he wrote (struck) unless My version shows it already, a note that adds something,
   and the list button */
const ES_FINE=matchMedia('(hover:hover) and (pointer:fine)').matches;
/* the one hit test, for hover, click and tap alike: the mark whose highlighted characters are under the point. Only
   the glyphs count: not the line's leading, never his struck words (My version).
   `tol` (px) widens it for a finger. */
function ES_hit(x,y,tol=0){
  const pts=tol?[[x,y],[x-tol,y],[x+tol,y],[x,y-tol],[x,y+tol]]:[[x,y]];
  for(const [px,py] of pts){
    const el=document.elementFromPoint(px,py), u=el&&el.closest&&el.closest('.es-c[data-k] .es-n u.d');
    if(!u||!ES_D.contains(u)) continue;
    const cs=getComputedStyle(u), pl=parseFloat(cs.paddingLeft)||0, pr=parseFloat(cs.paddingRight)||0;
    for(const r of u.getClientRects())
      if(px>=r.left+pl-tol&&px<=r.right-pr+tol&&py>=r.top-tol&&py<=r.bottom+tol) return u.closest('.es-c[data-k]');
  }
  return null;
}
// the only way from the highlight to the tip: the strip between the line it opened on and the tip itself
function ES_bridge(x,y){
  const tip=document.getElementById('es-tip'),L=ES.tipLine;if(!tip||!L) return false;
  const t=tip.getBoundingClientRect(),top=Math.min(L.t,t.top),bot=Math.max(L.b,t.bottom);
  if(x>=t.left&&x<=t.right&&y>=t.top&&y<=t.bottom) return true;
  return x>=Math.max(t.left,L.l-6)&&x<=Math.min(t.right,L.r+6)&&y>=top&&y<=bot;
}
function ES_closeTip(){clearTimeout(ES.timer);document.getElementById('es-tip')?.remove();document.querySelectorAll('.es-c.on').forEach(c=>c.classList.remove('on'));ES.tip=null;ES.pinned=false;}
const ES_addLabel=on=>on?ES_ICON_ON+'On my list':'Add to my list';
function ES_tipHTML(s){
  const on=!!IM_listed(s);
  const was=ES_D.classList.contains('es-hide-mine')?`<p class="es-tw"><s class="x-out">${mix(s.mine.trim())}</s></p>`:'';
  return `${was}${s.note?`<p class="es-tn">${zh(s.note)}</p>`:''}<button class="es-add" id="es-add" type="button" aria-pressed="${on}">${ES_addLabel(on)}</button>`;
}
function ES_openTip(c,pin,px,py){
  clearTimeout(ES.timer);
  const s=ES.seg[c.dataset.k]; if(!s) return;
  if(ES.tip===s.id){ES.pinned=ES.pinned||pin;return;}
  ES_closeTip();
  ES.tip=s.id;ES.pinned=pin;c.classList.add('on');
  const tip=document.createElement('div');
  tip.className='es-tip';tip.id='es-tip';tip.innerHTML=ES_tipHTML(s);ES_D.appendChild(tip);
  const rs=[...c.querySelector('.es-n').getClientRects()], h=ES_D.getBoundingClientRect();
  if(!rs.length){ES_closeTip();return;}
  // the line of the mark the pointer is on (a mark can wrap), else its first line
  let r=rs[0];
  if(py!=null) r=rs.reduce((b,q)=>Math.abs((q.top+q.bottom)/2-py)<Math.abs((b.top+b.bottom)/2-py)?q:b,rs[0]);
  const ax=px!=null?Math.min(Math.max(px,r.left),r.right):r.left+Math.min(24,r.width/2);
  const left=Math.max(0,Math.min(ax-h.left-28,h.width-tip.offsetWidth));
  // above, unless the app bar would cover it
  const barBottom=BAR.getBoundingClientRect().bottom;
  if(r.top-tip.offsetHeight-12>=barBottom) tip.style.top=(r.top-h.top-tip.offsetHeight-12)+'px';
  else{tip.classList.add('below');tip.style.top=(r.bottom-h.top+12)+'px';}
  tip.style.left=left+'px';
  tip.style.setProperty('--ox',Math.max(14,ax-h.left-left)+'px');
  // the bridge to the tip starts from the highlighted characters on that line, not the whole correction
  const hl=[...c.querySelectorAll('.es-n u.d')].flatMap(u=>[...u.getClientRects()]).filter(q=>Math.abs((q.top+q.bottom)/2-(r.top+r.bottom)/2)<r.height/2);
  ES.tipLine=hl.length?{l:Math.min(...hl.map(q=>q.left)),r:Math.max(...hl.map(q=>q.right)),t:r.top,b:r.bottom}:{l:r.left,r:r.right,t:r.top,b:r.bottom};
  tip.onmouseenter=()=>clearTimeout(ES.timer);
  tip.onmouseleave=e=>{if(!ES.pinned&&!ES_bridge(e.clientX,e.clientY)&&!ES_hit(e.clientX,e.clientY))ES_closeTip();};
  tip.addEventListener('click',e=>{
    e.stopPropagation();
    if(!e.target.closest('#es-add')) return;
    IM_toggle(s);
    const on=!!IM_listed(s), b=tip.querySelector('#es-add');
    sfx(on?'save':'unstamp');
    b.setAttribute('aria-pressed',on);b.innerHTML=ES_addLabel(on);
  });
}

/* editing a past day, in place: the same box, the same type; it saves as he types */
function ES_caretOffset(ev,box){
  let node=null,off=0;
  try{
    if(document.caretPositionFromPoint){const p=document.caretPositionFromPoint(ev.clientX,ev.clientY);if(p){node=p.offsetNode;off=p.offset;}}
    else if(document.caretRangeFromPoint){const r=document.caretRangeFromPoint(ev.clientX,ev.clientY);if(r){node=r.startContainer;off=r.startOffset;}}
  }catch(e){}
  if(!node) return null;
  const el=node.nodeType===1?node:node.parentElement;
  const mk=el&&el.closest('[data-i]'); if(mk&&box.contains(mk)) return +mk.dataset.i;
  const host=el&&el.closest('[data-o]'); if(!host||!box.contains(host)) return null;
  // characters before the caret inside this run of his text; a <br> stands for one newline
  let n=0; const w=document.createTreeWalker(host,NodeFilter.SHOW_TEXT|NodeFilter.SHOW_ELEMENT);
  for(let x=w.nextNode();x;x=w.nextNode()){
    if(x===node){n+=x.nodeType===3?off:0;break;}
    if(x.nodeType===3) n+=x.length; else if(x.nodeName==='BR') n+=1;
  }
  return +host.dataset.o+n;
}
function ES_startEdit(day,offset){
  if(ES.editDay===day) return;
  ES_stopEdit(); ES_closeTip();
  const e=ES.essays.find(x=>x.day===day), art=document.getElementById('day-'+day), box=art&&art.querySelector('.es-text');
  if(!e||!box) return;
  ES.editDay=day; ES.editBefore=e.text||'';
  box.innerHTML=ES_editHTML(e);
  editable(box); box.spellcheck=false;
  box.setAttribute('role','textbox'); box.setAttribute('aria-multiline','true'); box.setAttribute('aria-label','Day '+day);
  art.classList.add('editing');
  box.focus({preventScroll:true});
  placeCaret(box,offset==null?null:Math.max(0,Math.min(offset,norm(e.text).length)));
}
function ES_stopEdit(){
  const day=ES.editDay; if(day==null) return;
  ES.editDay=null;
  const e=ES.essays.find(x=>x.day===day), art=document.getElementById('day-'+day), box=art&&art.querySelector('.es-text');
  if(e) flushNow(e.date);
  // a past-day edit is one step for Cmd+Z
  if(e&&ES.editBefore!=null&&norm(e.text)!==norm(ES.editBefore)) record({essay:{day,date:e.date,before:ES.editBefore,after:e.text||''}});
  ES.editBefore=null;
  if(box){box.removeAttribute('contenteditable');['role','aria-multiline','aria-label'].forEach(a=>box.removeAttribute(a));}
  if(art) art.classList.remove('editing');
  if(ES.stale||!e||!String(e.text||'').trim()||!box||VIEW!=='essays') ES_render(); else ES_renderDay(e,box,art);
  ES_refreshPins(); IM_render(); renderHints();
}
ES_D.addEventListener('input',ev=>{
  const box=ev.target.closest&&ev.target.closest('.es-text'); if(!box||+box.dataset.day!==ES.editDay) return;
  const e=ES.essays.find(x=>x.day===ES.editDay); if(!e) return;
  if(!getText(box)&&box.innerHTML) box.innerHTML='';
  // a corrected spot he has rewritten loses its mark (the correction drops when he leaves)
  box.querySelectorAll('.es-was').forEach(s=>s.classList.toggle('gone',s.textContent!==s.dataset.mine));
  scheduleSave(e.day,e.date,getText(box));
});
ES_D.addEventListener('focusout',ev=>{
  const box=ev.target.closest&&ev.target.closest('.es-text'); if(!box||+box.dataset.day!==ES.editDay) return;
  setTimeout(()=>{if(ES.editDay===+box.dataset.day&&document.activeElement!==box)ES_stopEdit();},0);
});
ES_D.addEventListener('click',e=>{
  if(e.target.closest('#es-tip')) return;
  if(e.target.id==='es-more'){sfx('tap');ES.show+=14;ES_render();ES_refreshPins();return;}
  const box=e.target.closest('.es-text');
  if(box&&+box.dataset.day===ES.editDay) return;
  const c=e.clientX||e.clientY?ES_hit(e.clientX,e.clientY,ES_FINE?0:8):e.target.closest('.es-c[data-k]');
  if(c){
    e.stopPropagation();
    if(ES.tip===c.dataset.k&&ES.pinned){ES_closeTip();return;}
    ES_openTip(c,true,e.clientX||null,e.clientY||null);
    return;
  }
  if(ES.tip) ES_closeTip();
});
ES_D.addEventListener('dblclick',e=>{
  const box=e.target.closest('.es-text'); if(!box||+box.dataset.day===ES.editDay) return;
  ES_startEdit(+box.dataset.day,ES_caretOffset(e,box));
});
ES_D.addEventListener('keydown',e=>{
  const box=e.target.closest('.es-text');
  if(box&&+box.dataset.day===ES.editDay){
    if(e.key==='Escape'||(e.key==='Enter'&&(e.metaKey||e.ctrlKey))){e.preventDefault();e.stopPropagation();box.blur();}
    return;
  }
  const c=e.target.closest('.es-c[data-k]');
  if(c&&(e.key==='Enter'||e.key===' ')){e.preventDefault();ES_openTip(c,true);return;}
  if(e.target.classList.contains('es-text')&&e.key==='Enter'){e.preventDefault();ES_startEdit(+e.target.dataset.day,null);}
});
// hover: the same hit test on every move (one frame at a time); off the highlight, the tip waits a beat, so the
// pointer can reach it
if(ES_FINE){
  let raf=0,last=null;
  const hover=()=>{
    raf=0; if(!last||ES.pinned) return;
    if(last.target&&last.target.closest&&last.target.closest('#es-tip')){clearTimeout(ES.timer);return;}
    const c=ES_hit(last.x,last.y);
    if(c){clearTimeout(ES.timer);if(ES.tip!==c.dataset.k)ES_openTip(c,false,last.x,last.y);}
    else if(ES.tip&&!ES_bridge(last.x,last.y)) ES_closeTip();
  };
  ES_D.addEventListener('pointermove',e=>{if(e.pointerType!=='mouse'&&e.pointerType!=='pen')return;last={x:e.clientX,y:e.clientY,target:e.target};if(!raf)raf=requestAnimationFrame(hover);});
  ES_D.addEventListener('pointerleave',()=>{last=null;if(ES.tip&&!ES.pinned)ES_closeTip();});
}
document.addEventListener('click',e=>{if(ES.tip&&!e.target.closest('#es-tip')&&!e.target.closest('#ess-days'))ES_closeTip();});
document.addEventListener('keydown',e=>{if(e.key==='Escape')ES_closeTip();});
// his own text inline is off by default (the essay reads clean); the choice stays on this device
const ES_MINE=document.getElementById('mine');
function ES_showMine(on){ES_MINE.setAttribute('aria-checked',String(on));ES_D.classList.toggle('es-hide-mine',!on);}
ES_showMine(lsGet('show-mine')==='1');
// phones: To improve is folded above the diary; the disclosure opens it
document.getElementById('es-disc').onclick=function(){
  const side=this.closest('.es-side'), on=!side.classList.contains('open');
  side.classList.toggle('open',on);this.setAttribute('aria-expanded',String(on));sfx('tap');
};
// it rides along at the top while he scrolls (sticky, css), and only then gets a soft pill behind it
const ES_TOP=document.getElementById('es-top');
const ES_stuck=()=>{if(VIEW!=='essays')return;const t=parseFloat(getComputedStyle(ES_TOP).top)||0;ES_TOP.classList.toggle('stuck',ES_D.getBoundingClientRect().top<t-6);};
addEventListener('scroll',ES_stuck,{passive:true});BUS.on('view',v=>{if(v==='essays')setTimeout(ES_stuck,0);});
ES_MINE.onclick=()=>{ES_closeTip();const on=ES_MINE.getAttribute('aria-checked')!=='true';ES_showMine(on);lsSet('show-mine',on?'1':'0');sfx('tap');};

BUS.on('leave',()=>{ES_closeTip();ES_stopEdit();});
// on every visit: a day he finished on Today since gets its stamp (the render is a no-op when nothing changed)
BUS.on('view',v=>{if(v==='essays'){ES_render();ES_refreshPins();}});
BUS.on('essays',()=>{ES_render();ES_refreshPins();});
BUS.on('reviews',()=>{ES_render();ES_refreshPins();});
BUS.on('items',()=>ES_refreshPins());
