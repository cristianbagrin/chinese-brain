/* ---------- boot: the live data, then the first render. Owner: lead ---------- */
function render(D, source){
  STATE=D;
  const T=today();
  const tocDays=D.toc?days(T,P(D.toc)):null;
  const toc=document.getElementById('toc');
  toc.innerHTML=tocDays!==null&&tocDays>=0?`<span class="l">TOCFL in </span><span class="s">TOCFL </span><b>${tocDays}</b><span class="l"> days</span><span class="s"> d</span>`:'';
  toc.hidden=!toc.innerHTML;
  const note=document.getElementById('note');
  const upd=D.updated?P(D.updated):null;
  if(source==='saved'){note.textContent=`Saved copy from ${upd?MO[upd.getMonth()]+' '+upd.getDate():'the last publish'}; live data didn't load.`;note.hidden=false;}
  else if(upd && days(upd,T)>2){note.textContent=`Last updated ${MO[upd.getMonth()]} ${upd.getDate()}.`;note.hidden=false;}
  else note.hidden=true;
  BUS.emit('data',D,source);
}
function startEssays(db){
  ES.db=db;
  db.collection('essays').onSnapshot(s=>{
    ES.essays=s.docs.map(d=>JSON.parse(JSON.stringify(d.data()||{}))).filter(e=>e&&e.day);
    // text still on its way up stays as he typed it
    Object.values(SV).forEach(v=>{if(v.next){const e=ES.essays.find(x=>x.date===v.next.date);if(e)e.text=v.next.text;}});
    const first=!ES.loaded; ES.loaded=true;
    BUS.emit('essays',{first});
    if(first) restoreDrafts();
  },e=>console.error(e));
  db.collection('reviews').onSnapshot(s=>{
    const m={};let last='';
    s.docs.forEach(d=>{const v=JSON.parse(JSON.stringify(d.data()||{}));if(v.day){m[v.day]=v;if(String(v.review||'')>last)last=String(v.review||'');}});
    ES.reviews=m;ES.lastReview=last;
    if(VIEW==='essays'&&last) lsSet('seen-review',last);
    BUS.emit('reviews');dots();
  },e=>console.error(e));
  IMP=db.collection('improve');
  IMP.onSnapshot(s=>{
    const m={};s.docs.forEach(d=>{m[d.id]={...JSON.parse(JSON.stringify(d.data()||{})),id:d.id};});
    ES.items=m;
    BUS.emit('items');
  },e=>console.error(e));
}

let live=false;
// a fresh open starts at the top. The page arrives in pieces (the test, the essays, the forest), and something in that
// (the browser restoring an old position, or the host page) pushed it down, hiding the cat on the test under the bar
// (2026-11-04). So on Today, for the first seconds, until he scrolls, types or clicks, any scroll goes back to the top.
try{history.scrollRestoration='manual';}catch(e){}
(()=>{
  let his=false;const until=performance.now()+5000;
  ['wheel','touchstart','keydown','pointerdown'].forEach(ev=>addEventListener(ev,()=>{his=true;},{passive:true,once:true,capture:true}));
  const back=()=>{if(his||VIEW!=='today'||performance.now()>until){removeEventListener('scroll',back);return;}if(scrollY>0)scrollTo(0,0);};
  addEventListener('scroll',back,{passive:true});
})();
setView((location.hash||'').slice(1)||new URLSearchParams(location.search).get('view')||'',true);
requestAnimationFrame(()=>{moveThumb();requestAnimationFrame(()=>TABS.classList.add('ready'));});
try{render(SNAPSHOT,'saved');document.getElementById('note').hidden=true;}catch(e){console.error(e);}
(async()=>{
  let db=null;
  try{db=await window.claude?.use?.('db');}catch(e){db=null;}
  if(!db){ES.nodb=true;try{render(SNAPSHOT,'saved');}catch(e){}BUS.emit('nodb');BUS.emit('essays',{first:true});BUS.emit('items');return;}
  DBH=db;
  try{startEssays(db);}catch(e){console.error(e);}
  try{
    db.doc('board/data').onSnapshot(s=>{
      if(s.exists){live=true;try{render(s.data(),'live');}catch(e){console.error(e);}}
      else if(!live){render(SNAPSHOT,'saved');}
    },()=>{if(!live)render(SNAPSHOT,'saved');});
    db.doc('board/test').onSnapshot(s=>{
      const prev=TEST&&TEST.id, next=s.exists?s.data():null;
      // our own write is on its way, or a grade is in flight on the live objects: an echo would undo newer local changes
      if((writes>0||s.metadata?.hasPendingWrites||Object.keys(Q.grading).length)&&next&&next.id===prev) return;
      // snapshots arrive frozen: answers and grades are written onto TEST, so keep a plain copy
      TEST=next?JSON.parse(JSON.stringify(next)):null;
      if(!TEST||TEST.id!==prev){Q.view=null;Q.t0=null;Q.grading={};Q.fin=false;}
      BUS.emit('test');dots();
    },()=>{});
  }catch(e){render(SNAPSHOT,'saved');}
})();
