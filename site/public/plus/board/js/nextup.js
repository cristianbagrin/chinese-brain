/* ---------- Next up: the next five words to card. Owner: C
   board/data nextUp: [word, pinyin, gloss (example in parentheses), lane].
   A row shows the word, its pinyin and the short gloss; hovering it (tapping on a phone) adds only what isn't on screen:
   the example. No heading, no lane marks (his picks 2026-11-01), no later words under the five (2026-11-04: they
   pushed the trees and the year down). ---------- */
const NU={list:[],cur:null,pin:null,ptr:'mouse'};
const NU_EL=document.getElementById('next');
// "survey (做一個小調查; 問卷 = the questionnaire itself)" -> ["survey", "做一個小調查; 問卷 = …"]
function NU_split(g){
  g=String(g||'');
  const m=g.match(/^(.*?)\s*[(（](.*)[)）]\s*$/);
  return m&&/[㐀-鿿]/.test(m[2])?[m[1],m[2]]:[g,''];
}
const NU_ex=ex=>String(ex||'').split(/\s*[;；]\s*/).filter(Boolean).map(x=>`<span class="nu-ex">${zh(x)}</span>`).join('');
function renderNext(D){
  NU_hide();
  // words he has carded on the board leave the list at once (cards.js); the 10 pm task files them
  NU.list=(typeof NU_pool==='function'?NU_pool():D.nextUp||[]).map(([w,py,g,l])=>{const [gl,ex]=NU_split(g);return {w,py,gl,ex,l:LANES[l]?l:'life'};});
  const top=NU.list.slice(0,5);
  NU_EL.innerHTML=`<div class="nu-top">${top.map((q,i)=>`<div class="nu-row${q.ex?' has-ex':''}" data-i="${i}"${q.ex?' tabindex="0"':''}>
      <span class="nu-w zh" lang="zh-Hant">${esc(q.w)}</span>
      <span class="nu-m"><span class="nu-py">${esc(q.py)}</span><span class="nu-gl">${zh(q.gl)}</span></span></div>`).join('')}</div>
    <div class="nu-pop" id="nu-pop" role="tooltip" hidden></div>`;
}
function NU_show(t){
  const i=+t.dataset.i, q=NU.list[i], pop=document.getElementById('nu-pop');
  if(!q||!pop){NU_hide();return;}
  const top=true, html=NU_ex(q.ex);
  if(!html){NU_hide();return;}
  if(NU.cur&&NU.cur!==t) NU.cur.classList.remove('on');
  pop.innerHTML=html; pop.className='nu-pop'+(top?' ex':''); pop.hidden=false;
  NU_place(t,pop,top);
  NU.cur=t; t.classList.add('on');
}
// beside the word column, under the row (or above it): wherever it hides the fewest other words. Never over the hovered word.
function NU_place(t,pop,top){
  const R=NU_EL.getBoundingClientRect(), b=t.getBoundingClientRect(), m=(top?t.querySelector('.nu-m'):t).getBoundingClientRect();
  const x0=Math.max(0,m.left-R.left);
  pop.style.maxWidth=Math.max(240,Math.min(360,R.width-x0))+'px';
  const w=pop.offsetWidth, h=pop.offsetHeight, gap=6;
  const words=[...NU_EL.querySelectorAll('.nu-w')].filter(e=>!t.contains(e)).map(e=>{const r=e.getBoundingClientRect();return [r.left-R.left,r.top-R.top,r.right-R.left,r.bottom-R.top];});
  const below=b.bottom-R.top+gap, above=b.top-R.top-h-gap, xr=Math.max(0,R.width-w), xl=Math.max(0,Math.min(x0,xr));
  // the spot nearest the word where no other word is under it: slide along under the word first, then above it
  let best=null;
  for(const [y,pen] of [[below,0],[above,200]]) for(let x=0;x<=xr+.5;x+=Math.max(8,xr/40)){
    const hit=words.reduce((n,[l,tp,r,bt])=>n+Math.max(0,Math.min(r,x+w)-Math.max(l,x))*Math.max(0,Math.min(bt,y+h)-Math.max(tp,y)),0);
    const cost=hit*1000+Math.abs(x-xl)+pen;
    if(!best||cost<best.cost) best={x,y,cost};
  }
  pop.style.left=best.x+'px'; pop.style.top=best.y+'px';
}
function NU_hide(){
  const pop=document.getElementById('nu-pop'); if(pop) pop.hidden=true;
  if(NU.cur) NU.cur.classList.remove('on');
  NU.cur=null; NU.pin=null;
}
// a mouse shows it on hover; a finger taps to open and taps again (or anywhere else) to close
NU_EL.addEventListener('pointerdown',e=>{NU.ptr=e.pointerType||'mouse';});
NU_EL.addEventListener('pointerover',e=>{
  if(e.pointerType!=='mouse'||NU.pin) return;
  const t=e.target.closest('[data-i]'); if(t&&t!==NU.cur) NU_show(t);
});
NU_EL.addEventListener('pointerout',e=>{
  if(e.pointerType!=='mouse'||NU.pin) return;
  const t=e.target.closest('[data-i]'); if(t&&!t.contains(e.relatedTarget)) NU_hide();
});
NU_EL.addEventListener('focusin',e=>{const t=e.target.closest('[data-i]'); if(t&&!NU.pin) NU_show(t);});
NU_EL.addEventListener('focusout',()=>{if(!NU.pin) NU_hide();});
NU_EL.addEventListener('click',e=>{
  const t=e.target.closest('[data-i]'); if(!t||NU.ptr==='mouse') return;
  if(NU.pin===t){NU_hide();return;}
  NU_show(t); if(NU.cur===t){NU.pin=t;sfx('tap');}
});
document.addEventListener('click',e=>{if(NU.pin&&!e.target.closest('#next [data-i]')) NU_hide();});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&NU.cur) NU_hide();});
let NU_W=innerWidth; addEventListener('resize',()=>{if(innerWidth!==NU_W){NU_W=innerWidth;if(NU.cur)NU_hide();}});
BUS.on('leave',()=>NU_hide());
BUS.on('data',D=>renderNext(D));

/* ---------- Today's layout (today.css): on a wide screen the two columns stack on their own. Every block spans as many
   4px grid rows as it is tall (plus the space after it), so the essay never waits for the side column's rows and the
   side column never waits for the test. The blocks stay direct children of .today; their owners fill them. ---------- */
(()=>{
  const g=document.querySelector('#view-today .today'); if(!g||!window.ResizeObserver) return;
  const fit=el=>{
    const h=el.getBoundingClientRect().height, mb=h>.5?parseFloat(getComputedStyle(el).marginBottom)||0:0;
    const n=Math.max(1,Math.ceil((h+mb)/4));
    if(el.style.getPropertyValue('--nu-span')!==String(n)) el.style.setProperty('--nu-span',n);
  };
  const ro=new ResizeObserver(es=>es.forEach(e=>fit(e.target)));
  [...g.children].forEach(el=>{fit(el);ro.observe(el);});
  g.classList.add('nu-stack');
  try{['(min-width:960px)','(min-width:1180px)'].forEach(q=>matchMedia(q).addEventListener('change',()=>[...g.children].forEach(fit)));}catch(e){}
  BUS.on('lab',id=>{if(id==='board-k')requestAnimationFrame(()=>[...g.children].forEach(fit));});
})();

// voices load late on some browsers; asking early makes the first Listen use the Taiwan voice
try{if('speechSynthesis' in window){speechSynthesis.getVoices();speechSynthesis.onvoiceschanged=()=>speechSynthesis.getVoices();}}catch(e){}
