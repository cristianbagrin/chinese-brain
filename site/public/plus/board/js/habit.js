/* ---------- the habit tracker: a heatmap of the year, on Today (#habit-today) and on Progress (#pr-habit). Owner: C
   Anki's review heatmap, his way: the current year from January, one column a week (Monday on top), a new column every
   Monday and never a column for a week that hasn't started. Darker green = more done that day: cards or a test alone
   is the palest, an essay is the real green, an essay plus cards and a test the deepest. Today wears the gold ring.
   On Today the weeks so far fill the width; on Progress the whole year does (every month named, the weeks to come
   left blank), so the forest under it can stand each tree over its month. HB_render(el, full) draws into any
   container (full = Progress).
   Also here: the one hover/tap tip anything on the board can use ([data-tip]). Styles: css/today.css. ---------- */
const HB={done:null,pop:false,k:null};
// Chinese characters only: English words inside an essay don't count as writing Chinese
const HB_han=t=>(String(t||'').match(/[㐀-鿿豈-﫿]/g)||[]).length;
const HB_fmt=n=>Number(n||0).toLocaleString('en-US');

// date -> {essay: characters, cards, test:[passed,answered]}
function HB_map(){
  const m={}, D=STATE||{};
  const get=k=>m[k]||(m[k]={essay:0,cards:0,test:null});
  (ES.essays||[]).forEach(e=>{if(e&&e.date&&String(e.text||'').trim())get(e.date).essay=Math.max(1,HB_han(e.text));});
  for(const [k,v] of Object.entries(D.words||{})) if(+v>0) get(k).cards+=+v;
  for(const [k,v] of Object.entries(D.tests||{})) if(Array.isArray(v)&&+v[1]>0) get(k).test=[+v[0]||0,+v[1]];
  // the open test: answers given that board/data hasn't counted yet
  try{
    const live={};
    steps().forEach(s=>{const a=s.a||{};if(a.answer&&a.at){const x=live[a.at]||(live[a.at]=[0,0]);x[1]++;if(a.result==='pass')x[0]++;}});
    for(const [k,v] of Object.entries(live)){const d=get(k);if(!d.test)d.test=v;}
  }catch(e){}
  return m;
}

// how much a day holds: the essay is the habit (2), cards and a test add one each
const HB_lv=d=>(d.essay?2:0)+(d.cards?1:0)+(d.test?1:0);

function HB_tip(d,k,st){
  const L=[];
  if(d.essay) L.push(`<span class="hb-tl"><i class="hm-k l2"></i>Essay, ${HB_fmt(d.essay)} characters</span>`);
  if(d.cards) L.push(`<span class="hb-tl"><i class="hm-k l1"></i>${d.cards} new card${d.cards>1?'s':''}</span>`);
  if(d.test) L.push(`<span class="hb-tl"><i class="hm-k l1"></i>Test, ${d.test[0]} of ${d.test[1]} clean</span>`);
  if(!L.length){
    if(st==='pre') return '';
    L.push(`<span class="hb-tl q">${st==='today'?'Not yet':'Nothing'}</span>`);
  }
  return `<span class="hb-th">${st==='today'?'Today':fmtDate(P(k))}</span>${L.join('')}`;
}

function HB_heat(full){
  const m=HB_map(), tk=essayToday(), T=P(tk), D=STATE||{};
  const y=T.getFullYear(), j1=new Date(y,0,1), d31=new Date(y,11,31);
  const first=monday(j1), lastMon=monday(T);
  const total=days(first,monday(d31))/7+1, W=full?total:days(first,lastMon)/7+1;
  const start=D.dataStart||Object.keys(m).sort()[0]||tk;
  const cells=[], heads=[];
  for(let w=0;w<W;w++){
    const mon=add(first,7*w);
    for(let i=0;i<7;i++){
      const dt=add(mon,i), k=K(dt);
      if(dt.getDate()===1&&dt.getFullYear()===y&&(dt<=T||full)) heads.push(`<span style="grid-column:${w+1}"${dt.getMonth()===T.getMonth()?' class="now"':dt>T?' class="later"':''}>${MO[dt.getMonth()]}</span>`);
      if(dt<j1||dt>T){cells.push('<i class="hm-c off" aria-hidden="true"></i>');continue;}
      const d=m[k]||{essay:0,cards:0,test:null}, st=k===tk?'today':k<start?'pre':'past';
      const tip=HB_tip(d,k,st), pop=st==='today'&&d.essay&&HB.pop;
      cells.push(`<i class="hm-c l${HB_lv(d)}${st!=='past'?' '+st:''}${pop?' pop':''}"${tip?` data-tip="${esc(tip)}"`:''}></i>`);
    }
  }
  // the 1st of January sits mid-week: its label goes on the first column anyway
  if(!heads.length||!/grid-column:1"/.test(heads[0])) heads.unshift(`<span style="grid-column:1">${MO[0]}</span>`);
  return `<div class="hm-in" style="--w:${W};--wt:${total}" data-cols="${W}" data-y="${y}">
    <div class="hm-mo" aria-hidden="true">${heads.join('')}</div>
    <div class="hm-wd" aria-hidden="true"><span>M</span><span></span><span>W</span><span></span><span>F</span><span></span><span></span></div>
    <div class="hm-g" role="img" aria-label="Every day this year">${cells.join('')}</div></div>`;
}

// el gets the tracker; full = Progress (bigger cells)
function HB_render(el,full){
  if(!el) return;
  let html='';
  try{html=HB_heat(!!full);}catch(e){console.error(e);}
  el.innerHTML=`<div class="hm ${full?'hm-full':'hm-today'}">${html}</div>`;
}
function HB_today(){
  const el=document.getElementById('habit-today'); if(!el) return;
  const d=HB_map()[essayToday()]||{};
  // today's essay just landed: its cell pops once
  HB.pop=HB.done===false&&!!d.essay;
  HB.done=!!d.essay;
  HB_render(el,false);
  HB.pop=false;
}
['data','essays','test','nodb'].forEach(ev=>BUS.on(ev,()=>HB_today()));
BUS.on('view',v=>{if(v==='today')HB_today();});
// the day turns over at 4 am: a board left open overnight moves on by itself (and a new week gets its column)
setInterval(()=>{if(HB.k&&HB.k!==essayToday())HB_today();HB.k=essayToday();},60000);

/* ---------- the tip: one small floating note for anything with data-tip (hover, tap, focus) ---------- */
(()=>{
  const tip=document.createElement('div');
  tip.className='hb-tip';tip.setAttribute('role','tooltip');tip.hidden=true;
  document.body.appendChild(tip);
  let cur=null;
  const find=e=>e.target&&e.target.closest?e.target.closest('[data-tip]'):null;
  function show(el){
    const h=el.getAttribute('data-tip');if(!h){hide();return;}
    if(cur&&cur!==el)cur.classList.remove('hb-hot');
    cur=el;el.classList.add('hb-hot');
    tip.innerHTML=h;tip.hidden=false;
    const r=el.getBoundingClientRect(), w=tip.offsetWidth, ht=tip.offsetHeight;
    const x=Math.max(8,Math.min(innerWidth-w-8,r.left+r.width/2-w/2));
    let y=r.top-ht-10; if(y<76) y=r.bottom+10;
    tip.style.left=Math.round(x)+'px';tip.style.top=Math.round(y)+'px';
  }
  function hide(){if(cur)cur.classList.remove('hb-hot');cur=null;tip.hidden=true;}
  document.addEventListener('pointerover',e=>{if(e.pointerType==='touch')return;const el=find(e);if(el){if(el!==cur)show(el);}else if(cur)hide();});
  document.addEventListener('click',e=>{const el=find(e);if(el){if(el===cur&&matchMedia('(hover:none)').matches)hide();else show(el);}else if(cur)hide();});
  addEventListener('scroll',()=>{if(cur)hide();},{passive:true});
  addEventListener('resize',()=>{if(cur)hide();});
  BUS.on('leave',hide);
})();
