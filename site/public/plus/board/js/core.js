/* ---------- core: data snapshot, helpers, sound, undo, views, the contract. Owner: lead (agents read, never edit) ---------- */
const SNAPSHOT = {"months":{},"nextUp":[],"tests":{},"total":0,"words":{}};

const LANES={life:{c:'var(--lane-life)',n:'Everyday'},tw:{c:'var(--lane-tw)',n:'Taiwan'},test:{c:'var(--lane-test)',n:'Test'}};
const MO=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const MONTH=['January','February','March','April','May','June','July','August','September','October','November','December'];
const WD=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const DAY=864e5;
function today(){const n=new Date();return new Date(n.getFullYear(),n.getMonth(),n.getDate());}
const P=s=>{const [y,m,d]=String(s).split('-').map(Number);return new Date(y,m-1,d||1);};
const K=d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
const MK=d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');
const add=(d,n)=>new Date(d.getFullYear(),d.getMonth(),d.getDate()+n);
const days=(a,b)=>Math.round((b-a)/DAY);
const md=d=>(d.getMonth()+1)+'/'+d.getDate();
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const zh=s=>esc(s).replace(/([㐀-鿿　-〿＀-￯]+)/g,'<span class="zh">$1</span>');
// English inside Chinese text gets the English face
const mix=s=>String(s??'').split(/([A-Za-z][A-Za-z ’'.\-()]*[A-Za-z)]|[A-Za-z])/).map((p,i)=>i%2?`<span class="es-en">${esc(p)}</span>`:esc(p)).join('');
const tries=s=>'<span class="tries" aria-label="recent tries">'+[...String(s||'')].slice(-4).map(c=>`<i class="t ${'sfp'.includes(c)?c:'p'}"></i>`).join('')+'</span>';
const monday=d=>add(d,-((d.getDay()+6)%7));
// a date as he wants it everywhere: "Oct 31", no weekday; the year only when it isn't this year ("Dec 30, 2026")
const fmtDate=d=>{d=d instanceof Date?d:P(d);return MO[d.getMonth()]+' '+d.getDate()+(d.getFullYear()!==today().getFullYear()?', '+d.getFullYear():'');};
const pct=([p,t])=>t?Math.round(p/t*100):null;
function sumW(map,a,b){let s=0;for(let d=a;d<=b;d=add(d,1))s+=Number((map||{})[K(d)]||0);return s;}
function sumT(map,a,b){let p=0,t=0;for(let d=a;d<=b;d=add(d,1)){const v=(map||{})[K(d)];if(Array.isArray(v)){p+=+v[0]||0;t+=+v[1]||0;}}return [p,t];}
const lsGet=k=>{try{return localStorage.getItem(k);}catch(e){return null;}};
const lsSet=(k,v)=>{try{localStorage.setItem(k,v);}catch(e){}};
// the essay day turns over at 4 am, so a late-night essay belongs to the evening it was written
const essayToday=()=>{const n=new Date();return K(new Date(n.getFullYear(),n.getMonth(),n.getDate()-(n.getHours()<4?1:0)));};
const dayId=d=>'d'+String(d).padStart(3,'0');
const REDUCED=()=>matchMedia('(prefers-reduced-motion:reduce)').matches;

/* ---------- the contract between the files ----------
   BUS: modules never call each other's render functions; they listen.
     'data' (D, source)  board/data arrived (STATE is set)        'test'   board/test changed (TEST)
     'essays' ({first})  ES.essays changed                        'reviews' ES.reviews changed
     'items'             ES.items (To improve) changed            'view' (v, prev)  a view was opened
     'leave' (prev)      a view is being left (close tips, stop edits)   'lab' (id, value)  an experiment changed
     'nodb'              no database in this view (saved copy only)
   LAB: the choices in Settings (lab.js); each sets data-<id> on <html> so CSS can switch too.
   celebrate(kind, opts): fun moments (fun.js); kinds: essay, test, week, crossoff, cards. */
const BUS={h:{},on(ev,fn){(this.h[ev]=this.h[ev]||[]).push(fn);},emit(ev,...a){(this.h[ev]||[]).forEach(fn=>{try{fn(...a);}catch(e){console.error(ev,e);}});}};
const LAB={defs:{},order:[],
  // define('essay-ui','Writing page',[['ruled','Ruled'],['open','Open page']],'ruled','Today')
  define(id,label,options,def,group){
    if(!this.defs[id]) this.order.push(id);
    this.defs[id]={id,label,options,def,group:group||'Board'};
    const q=new URLSearchParams(location.search).get('lab')||'';
    const fromUrl=q.split(',').map(x=>x.split(':')).find(([k])=>k===id);
    let v=fromUrl?fromUrl[1]:lsGet('lab:'+id);
    if(!options.some(([o])=>o===v)) v=def;
    this.defs[id].v=v;
    document.documentElement.setAttribute('data-'+id,v);
    return v;
  },
  get(id){return this.defs[id]?this.defs[id].v:null;},
  set(id,v){const d=this.defs[id];if(!d||d.v===v)return;d.v=v;lsSet('lab:'+id,v);
    document.documentElement.setAttribute('data-'+id,v);
    BUS.emit('lab',id,v);}
};
// 2026-11-01: fonts and sizes are decided (base.css): board 92%, his writing 117% on Today and 110% on Essays, 0.25px.
function celebrate(kind,opts){try{window.FUN&&window.FUN.celebrate&&window.FUN.celebrate(kind,opts||{});}catch(e){console.error(e);}}
// a moment that happens once: once('essay:2026-10-31') is true the first time only (kept on this device)
function once(k){if(lsGet('once:'+k))return false;lsSet('once:'+k,'1');return true;}

/* ---------- editable text: contenteditable, not textarea, so Chinese Brain's hover can read it ---------- */
const PT=(()=>{try{const d=document.createElement('div');d.contentEditable='plaintext-only';return d.contentEditable==='plaintext-only';}catch(e){return false;}})();
const CE=PT?'plaintext-only':'true';
function editable(el){el.setAttribute('contenteditable',CE);return el;}
// where plaintext-only is missing, a paste still goes in as plain text
if(!PT) document.addEventListener('paste',e=>{const t=e.target.closest&&e.target.closest('[contenteditable]');if(!t)return;e.preventDefault();document.execCommand('insertText',false,(e.clipboardData||window.clipboardData).getData('text/plain'));});
const getText=el=>{const t=String(el.innerText||'').replace(/ /g,' ');return t.trim()?t:'';};
const setText=(el,t)=>{el.textContent=t||'';};
function caretAt(el){
  try{const s=getSelection();if(!s.rangeCount||!el.contains(s.anchorNode))return null;
    const r=s.getRangeAt(0),pre=r.cloneRange();pre.selectNodeContents(el);pre.setEnd(r.startContainer,r.startOffset);return pre.toString().length;}catch(e){return null;}
}
function placeCaret(el,o){
  try{const s=getSelection(),r=document.createRange();let n=o,node=null;
    if(o!=null){const w=document.createTreeWalker(el,NodeFilter.SHOW_TEXT);for(let x=w.nextNode();x;x=w.nextNode()){if(n<=x.length){node=x;break;}n-=x.length;}}
    if(node)r.setStart(node,n);else{r.selectNodeContents(el);r.collapse(false);}
    r.collapse(true);s.removeAllRanges();s.addRange(r);}catch(e){}
}
// the characters of b that aren't in a (longest common subsequence), so only what changed gets marked
function diffSegs(a,b){
  a=[...String(a||'')];b=[...String(b||'')];
  const n=a.length,m=b.length;
  if(!n||n*m>40000) return [[b.join(''),true]];
  const L=Array.from({length:n+1},()=>new Uint16Array(m+1));
  for(let i=n-1;i>=0;i--)for(let j=m-1;j>=0;j--)L[i][j]=a[i]===b[j]?L[i+1][j+1]+1:Math.max(L[i+1][j],L[i][j+1]);
  const keep=new Array(m).fill(false);let i=0,j=0;
  while(i<n&&j<m){if(a[i]===b[j]){keep[j]=true;i++;j++;}else if(L[i+1][j]>=L[i][j+1])i++;else j++;}
  const out=[];
  b.forEach((c,k)=>{const ch=!keep[k]&&!/[\s，。、！？,.!?]/.test(c);const l=out[out.length-1];if(l&&l[1]===ch)l[0]+=c;else out.push([c,ch]);});
  return out.some(x=>x[1])?out:[[b.join(''),true]];
}
const diffHTML=(a,b)=>diffSegs(a,b).map(([s,ch])=>ch?`<u class="d">${mix(s)}</u>`:mix(s)).join('');

/* ---------- sound: tiny Web Audio sounds; where the board does what Chinese Brain does, Chinese Brain's own sound ---------- */
const SND={on:lsGet('sound')!=='0',ctx:null,out:null,noise:null};
function audio(){
  if(!SND.ctx){
    const C=window.AudioContext||window.webkitAudioContext;if(!C)return null;
    const c=new C(),comp=c.createDynamicsCompressor();
    comp.threshold.value=-12;comp.knee.value=8;comp.ratio.value=4;comp.attack.value=.002;comp.release.value=.15;
    const g=c.createGain();g.gain.value=.7;g.connect(comp).connect(c.destination);
    const b=c.createBuffer(1,c.sampleRate,c.sampleRate),d=b.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1;
    SND.ctx=c;SND.out=g;SND.noise=b;
  }
  if(SND.ctx.state==='suspended')SND.ctx.resume();
  return SND.ctx;
}
function env(g,at,peak,att,len){g.gain.setValueAtTime(1e-4,at);g.gain.exponentialRampToValueAtTime(peak,at+att);g.gain.exponentialRampToValueAtTime(1e-4,at+len);}
function tone(c,f,at,len,gain,type='sine',to){const o=c.createOscillator(),g=c.createGain();o.type=type;o.frequency.setValueAtTime(f,at);if(to)o.frequency.exponentialRampToValueAtTime(to,at+len*.6);env(g,at,gain,.004,len);o.connect(g).connect(SND.out);o.start(at);o.stop(at+len+.03);}
function hiss(c,at,len,gain,type,f,q=.8,to){const s=c.createBufferSource(),fl=c.createBiquadFilter(),g=c.createGain();s.buffer=SND.noise;fl.type=type;fl.frequency.setValueAtTime(f,at);if(to)fl.frequency.exponentialRampToValueAtTime(to,at+len);fl.Q.value=q;env(g,at,gain,.002,len);s.connect(fl).connect(g).connect(SND.out);s.start(at,Math.random()*.5);s.stop(at+len+.03);}
/* Chinese Brain's own sounds, ported note for note from its audio.ts (2026-11-05), so the board and the extension
   sound like one thing. Its stamp has three weights, by the status a word gets: new (light), learning, known (heaviest,
   with a fifth on top); unstamp = taking a status off; save = saving a sentence. CB_K matches its louder master gain. */
const CB_K=.8/.7, CB_STAMP={fresh:[190,1320],learning:[160,880],known:[135,660]};
function cbNote(c,f,at,len,gain,type='sine',to,drop=len/2){const o=c.createOscillator(),g=c.createGain();o.type=type;o.frequency.setValueAtTime(f,at);if(to)o.frequency.exponentialRampToValueAtTime(to,at+drop);env(g,at,gain*CB_K,.003,len);o.connect(g).connect(SND.out);o.start(at);o.stop(at+len+.03);}
function cbNoise(c,at,len,gain,type,f,q=.8){const s=c.createBufferSource(),fl=c.createBiquadFilter(),g=c.createGain();s.buffer=SND.noise;fl.type=type;fl.frequency.value=f;fl.Q.value=q;env(g,at,gain*CB_K,.001,len);s.connect(fl).connect(g).connect(SND.out);s.start(at,Math.random()*.5);s.stop(at+len+.03);}
function cbThump(c,at,f,gain,len){cbNote(c,f,at,len,gain,'sine',f*.42,len*.55);cbNote(c,f*2,at,len*.55,gain*.35,'sine',f*.84,len*.4);}
function cbStamp(c,t,st){const [thud,tick]=CB_STAMP[st];cbNoise(c,t,.035,.5,'bandpass',1100,.9);cbNoise(c,t,.07,.35,'lowpass',420);cbThump(c,t,thud,.75,.15);cbNote(c,tick,t+.03,.12,.07,'triangle');if(st==='known')cbNote(c,tick*1.5,t+.03,.16,.05,'triangle');}
const SOUNDS={
  // Chinese Brain
  'stamp-new':(c,t)=>cbStamp(c,t,'fresh'),
  stamp:(c,t)=>cbStamp(c,t,'learning'),
  'stamp-known':(c,t)=>cbStamp(c,t,'known'),
  unstamp:(c,t)=>{cbNoise(c,t,.03,.2,'bandpass',1800,.9);cbThump(c,t,120,.25,.09);},
  save:(c,t)=>{cbNoise(c,t,.02,.18,'bandpass',2400,1);cbNote(c,1320,t,.1,.06,'triangle');cbNote(c,1980,t+.045,.12,.04,'triangle');},
  // the board's own
  pop:(c,t)=>{tone(c,520,t,.09,.12,'sine',820);hiss(c,t,.012,.08,'bandpass',3200,1.2);},
  swish:(c,t)=>{hiss(c,t,.16,.16,'bandpass',2600,.7,700);},
  tap:(c,t)=>{hiss(c,t,.014,.08,'bandpass',3000,1.4);},
  drop:(c,t)=>{tone(c,210,t,.08,.22,'sine',120);hiss(c,t,.02,.12,'bandpass',1400);},
  undo:(c,t)=>{tone(c,700,t,.08,.07,'triangle',470);},
  pass:(c,t)=>{tone(c,784,t,.22,.07,'triangle');tone(c,1175,t+.09,.3,.06,'triangle');},
  partial:(c,t)=>{tone(c,660,t,.2,.06,'triangle');},
  fail:(c,t)=>{tone(c,300,t,.22,.08,'sine',240);}
};
function sfx(name){if(!SND.on||!SOUNDS[name])return;try{const c=audio();if(c)SOUNDS[name](c,c.currentTime+.005);}catch(e){}}
const SNDB=document.getElementById('snd');
function sndIcon(){SNDB.setAttribute('aria-pressed',String(SND.on));SNDB.setAttribute('aria-label',SND.on?'Sound on':'Sound off');
  SNDB.innerHTML=`<svg width="17" height="17" viewBox="0 0 14 14" aria-hidden="true"><path d="M2 5h2.5L8 2.2v9.6L4.5 9H2z" fill="currentColor"/>${SND.on?'<path d="M10 4.5a3.2 3.2 0 0 1 0 5M11.6 3a5.4 5.4 0 0 1 0 8" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>':'<path d="M10 5l3 3M13 5l-3 3" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>'}</svg>`;}
sndIcon();
SNDB.onclick=()=>{SND.on=!SND.on;lsSet('sound',SND.on?'1':'0');sndIcon();sfx('tap');};

/* ---------- undo: every list change and every past-day edit; text being typed keeps the browser's own undo ---------- */
const HIST={undo:[],redo:[]};
function record(e){HIST.undo.push(e);if(HIST.undo.length>100)HIST.undo.shift();HIST.redo=[];}
let TOAST=null;
function toast(msg){
  hideToast(true);
  const el=document.createElement('div');el.className='toast';el.setAttribute('role','status');
  el.innerHTML=`<span>${esc(msg)}</span><button type="button">Undo</button>`;document.body.appendChild(el);
  el.querySelector('button').onclick=()=>{undo();hideToast();};
  TOAST={el,t:setTimeout(hideToast,4500)};
}
function hideToast(now){if(!TOAST)return;const {el,t}=TOAST;TOAST=null;clearTimeout(t);if(now){el.remove();return;}el.classList.add('out');setTimeout(()=>el.remove(),220);}


/* ---------- views ---------- */
const VIEWS=['today','essays','progress'];
let VIEW=null; const SCROLL={};
const TABS=document.getElementById('tabs'), THUMB=TABS.querySelector('.thumb');
// the essays state is shared: essays.js and improve.js fill it, Today reads it
const ES={db:null,loaded:false,essays:[],reviews:{},lastReview:'',items:{},seg:{},tip:null,pinned:false,timer:null,show:matchMedia('(min-width:880px)').matches?14:7,editDay:null,editItem:null,nodb:false,stale:true};
let STATE=null;
// essays: text normalised, the days with text newest first, the next DAY number
const norm=t=>String(t||'').replace(/\r\n?/g,'\n').replace(/\s+$/,'');
const sorted=()=>ES.essays.filter(e=>e&&e.day&&String(e.text||'').trim()).sort((a,b)=>b.day-a.day);
const nextDay=()=>ES.essays.reduce((m,e)=>Math.max(m,+e.day||0),0)+1;
function moveThumb(){
  const b=document.getElementById('tab-'+VIEW); if(!b||!b.offsetWidth) return;
  THUMB.style.width=b.offsetWidth+'px'; THUMB.style.transform=`translateX(${b.offsetLeft}px)`;
}
function setView(v,first){
  if(!VIEWS.includes(v)) v='today';
  if(v===VIEW) return;
  const prev=VIEW;
  if(VIEW){SCROLL[VIEW]=window.scrollY;BUS.emit('leave',VIEW);}
  hideToast(true);
  VIEW=v;
  VIEWS.forEach(x=>{
    document.getElementById('view-'+x).hidden=x!==v;
    const t=document.getElementById('tab-'+x); t.setAttribute('aria-selected',String(x===v)); t.tabIndex=x===v?0:-1;
  });
  moveThumb();
  if(!first) window.scrollTo(0,SCROLL[v]||0);
  if(v==='essays'&&ES.lastReview) lsSet('seen-review',ES.lastReview);
  BUS.emit('view',v,prev);
  dots();
}
function dots(){
  const seen=lsGet('seen-review')||'';
  document.getElementById('dot-essays').hidden=!(ES.lastReview&&ES.lastReview>seen&&VIEW!=='essays');
  document.getElementById('dot-today').hidden=!(typeof testOpen==='function'&&testOpen()&&!steps().every(s=>s.a.answer)&&VIEW!=='today');
}
TABS.addEventListener('click',e=>{const b=e.target.closest('[role="tab"]');if(b&&b.id.slice(4)!==VIEW){sfx('tap');setView(b.id.slice(4));}});
TABS.addEventListener('keydown',e=>{
  const i=VIEWS.indexOf(VIEW); let n=null;
  if(e.key==='ArrowRight') n=(i+1)%3; else if(e.key==='ArrowLeft') n=(i+2)%3; else if(e.key==='Home') n=0; else if(e.key==='End') n=2;
  if(n!==null){e.preventDefault();setView(VIEWS[n]);document.getElementById('tab-'+VIEWS[n]).focus();}
});
const BAR=document.getElementById('bar');
addEventListener('scroll',()=>BAR.classList.toggle('lift',scrollY>4),{passive:true});
addEventListener('resize',moveThumb);
try{document.fonts&&document.fonts.ready.then(moveThumb);}catch(e){}

