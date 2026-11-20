/* ---------- Today's essay: the writing page. Owner: B (writing + tests)
   A sheet of paper on the ground (css/paper.css, shared with the Essays view): Day and the save status in its header,
   his text in blue ink on the ruling, two other pages askew underneath. Writes through store.js (scheduleSave /
   flushNow / saveState). The day turns over at 4 am (essayToday()). The sheet stays contenteditable plain text: Chinese
   Brain's hover reads its text nodes. Today dims while he types; a real mouse move, a scroll, Esc or leaving brings it back.
   No finishing step (2026-11-01): a day he wrote in is a day written. Lined paper, his pick. ---------- */
// the feel of every sheet on the board (css/paper.css .paper-tex): a touch of yellow, clean edges, ruling at 60% (his
// picks 2026-11-01); grain .5 and crumple .3 are the fallbacks in paper.css

const WR_EL=document.getElementById('write');
WR_EL.innerHTML=`
  <div class="paper stacked w-paper" id="w-paper" data-paper="lined"><i class="paper-tex" aria-hidden="true"></i>
    <div class="w-top"><h2 class="w-day" id="w-day">Day</h2><span class="saved" id="w-saved" aria-live="polite"></span></div>
    <div class="sheet" id="sheet" role="textbox" aria-multiline="true" data-ph="今天發生了什麼事？" aria-label="Today's essay" lang="zh-Hant" spellcheck="false"></div>
  </div>`;
const SHEET=document.getElementById('sheet'), SAVED=document.getElementById('w-saved');
const WR_PAPER=document.getElementById('w-paper'), WR_DAY=document.getElementById('w-day');
const W={date:null,day:null,waiting:false};
const WR={move:0,xy:null};

function renderWrite(){
  // the sheet moves to the new day only while he isn't writing in it, so a late essay stays one essay
  const date=essayToday();
  if(W.date!==date&&(!W.date||document.activeElement!==SHEET)){
    if(W.date)setText(SHEET,'');
    W.date=date; SAVED.dataset.saved=date; SAVED.className='saved';
  }
  const cur=ES.essays.find(e=>e.date===W.date);
  W.day=cur?cur.day:(ES.loaded?nextDay():null);
  WR_DAY.textContent=W.day?`Day ${W.day}`:'Day';
  const s=SV[W.date];
  if(cur&&document.activeElement!==SHEET&&!(s&&(s.next||s.busy))&&getText(SHEET)!==(cur.text||''))setText(SHEET,cur.text||'');
  if(W.waiting&&W.day){W.waiting=false;scheduleSave(W.day,W.date,getText(SHEET),true);}
}

/* ---------- focus: Today dims while he types ---------- */
function WR_dim(){if(WR_EL.classList.contains('wr-dim'))return;WR.move=0;WR.xy=null;WR_EL.classList.add('wr-dim');}
function WR_undim(){WR_EL.classList.remove('wr-dim');}
document.addEventListener('pointermove',e=>{
  if(!WR_EL.classList.contains('wr-dim')||e.pointerType==='touch') return;
  const p=[e.clientX,e.clientY];
  if(WR.xy){WR.move+=Math.hypot(p[0]-WR.xy[0],p[1]-WR.xy[1]);if(WR.move>40)WR_undim();}
  WR.xy=p;
},{passive:true});
addEventListener('wheel',()=>{if(WR_EL.classList.contains('wr-dim'))WR_undim();},{passive:true});
SHEET.addEventListener('keydown',e=>{if(e.key==='Escape')WR_undim();});

/* ---------- typing and saving ---------- */
editable(SHEET);
SHEET.addEventListener('input',()=>{
  const v=getText(SHEET);
  if(!v&&SHEET.innerHTML) SHEET.innerHTML='';
  WR_dim();
  if(!W.day){W.waiting=true;draftPut(W.date,null,v);if(ES.nodb)saveState(W.date,'local');return;}
  scheduleSave(W.day,W.date,v);
});
SHEET.addEventListener('blur',()=>{
  if(W.date)flushNow(W.date);
  WR_undim();
  setTimeout(()=>{if(essayToday()!==W.date)renderWrite();},0);
});
// a click anywhere on the paper (below the text, in the margins) writes at the end
WR_EL.addEventListener('mousedown',e=>{
  if(e.button!==0||e.target.closest('#sheet')) return;
  e.preventDefault(); SHEET.focus(); placeCaret(SHEET,null);
});
// a page left open overnight moves to the new day
setInterval(()=>{if(essayToday()!==W.date)renderWrite();},60000);
document.addEventListener('visibilitychange',()=>{if(document.hidden)Object.keys(SV).forEach(flushNow);else renderWrite();});
BUS.on('essays',()=>renderWrite());
BUS.on('draft',(date,text)=>{if(date===W.date&&document.activeElement!==SHEET)setText(SHEET,text);});
BUS.on('nodb',()=>{if(getText(SHEET))saveState(W.date,'local');});
BUS.on('leave',v=>{if(v==='today')WR_undim();});
renderWrite();
