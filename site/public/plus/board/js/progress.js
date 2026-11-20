/* ---------- Progress. Owner: progress agent
   Words known: Brain's line, interactive (hover or tap a point: its total and the change), with a forecast at his real
   average pace of new cards to the end of next month (and the exam, when it is close). The goals are gold circles on
   the climb: the passed ones where he passed them, the next one only when his pace gets there inside the chart; the
   note under it says when the next goal comes (2026-11-04: a long line out to a far goal wasted the width). Each
   month's name and its new cards (a soft bar on its own scale) sit under that month's point on the line. The pace and
   every forecast are computed from board/data each time, so they follow his cards by themselves. Then the habit tracker across the whole year, then his forest (a
   tree over each month; fun.js fills #pr-forest). Months only, never weeks. ---------- */
const PR={hover:null,C:null,S:null,F:null,G:null,w:0,h:0,k:.92,px:0,py:0};
document.getElementById('view-progress').innerHTML=`<div class="pr">
  <section class="pr-hero" aria-label="Words known">
    <p class="side-h">Words known</p>
    <div class="pr-head" id="pr-head" aria-live="polite"></div>
    <div class="pr-chart" id="pr-chart" tabindex="0" role="group" aria-label="Words known and new cards, month by month; arrow keys move between months"></div>
    <p class="pr-note" id="pr-note"></p>
  </section>
  <section class="pr-days" aria-label="Habit"><div id="pr-habit"></div></section>
  <section class="pr-forest" aria-label="Forest"><div id="pr-forest"></div></section>
</div>`;

const PR_r10=v=>Math.round(v/10)*10;
// new cards in a month: the frozen count wins; the live month adds up the days (null = not tracked then)
function PR_cards(D,k,T){
  const h=(D.months||{})[k]||{};
  if(h.new!=null) return +h.new;
  const [y,m]=k.split('-').map(Number), a=new Date(y,m-1,1), b=new Date(y,m,0);
  const s=sumW(D.words,a,b>T?T:b)+(+h.extra||0);
  return s>0||(D.dataStart&&P(D.dataStart)<=b)?s:null;
}
// the month-end totals, then today's
function PR_series(){
  const D=STATE, T=today(), cur=MK(T);
  const pts=Object.keys(D.months||{}).filter(k=>k<cur&&D.months[k]&&D.months[k].total!=null).sort()
    .map(k=>{const [y,m]=k.split('-').map(Number);return {k,date:new Date(y,m,0),v:+D.months[k].total};});
  pts.push({k:cur,date:T,v:+D.total||0,now:true});
  pts.forEach((p,i)=>{
    const [y,m]=p.k.split('-').map(Number), q=pts[i-1];
    p.name=MONTH[m-1];p.short=MO[m-1];
    p.delta=q&&q.k===MK(new Date(y,m-2,1))?p.v-q.v:null;
  });
  return pts;
}
/* his real pace: new cards a day, averaged over the last 90 days (to yesterday, so a day still in progress doesn't
   drag it down). 90 days is long enough that one busy weekend or one dead week doesn't swing it, short enough to follow
   how he studies now; rest days count as zeros, because that's what a real average is. Each month contributes its
   cards pro rata to the days of it inside the window; a month the board has no count for (before dataStart) is left
   out and the window shrinks to what's known. */
const PR_WIN=90;
function PR_pace(){
  const D=STATE, T=today(), end=add(T,-1), start=add(T,-PR_WIN);
  let cards=0, span=0;
  for(let a=new Date(start.getFullYear(),start.getMonth(),1);a<=end;a=new Date(a.getFullYear(),a.getMonth()+1,1)){
    const ms=a, me=new Date(a.getFullYear(),a.getMonth()+1,0), c=PR_cards(D,MK(a),end);
    if(c==null) continue;
    const lo=ms<start?start:ms, hi=me>end?end:me, n=days(lo,hi)+1;
    const len=me>end?days(ms,end)+1:days(ms,me)+1;      // the days that month has counted so far
    cards+=c/len*n; span+=n;
  }
  return span?{rate:cards/span,span,from:add(T,-span),to:end}:null;
}
const PR_fr=r=>{const v=Math.round(r*10)/10;return v<.1?'under 0.1':String(v);};
const PR_pl=r=>`${PR_fr(r)} new card${Math.round(r*10)/10===1?'':'s'} a day`;
// to the exam at that pace; once the exam has passed (or there is none), to the end of next month
function PR_forecast(){
  const D=STATE, T=today(), pace=PR_pace();
  if(!pace) return null;
  const exam=!!D.toc&&P(D.toc)>T;
  const ex=exam?P(D.toc):new Date(T.getFullYear(),T.getMonth()+2,0), n=days(T,ex);
  const tot=+D.total||0, rate=pace.rate;
  return {ex,n,exam,rate,pace,proj:Math.round(tot+rate*n)};
}

/* the next goal: TOCFL's own vocabulary bands (the official 8,000-word list: Level 1 500, Level 2 1,000, Level 3 2,500,
   Level 4 5,000, Levels 5 and 6 8,000), each with the CEFR level TOCFL aligns it to. Only these: nothing else I could
   say a true thing about. The first one above his total is the goal; passing it moves the next one in by itself. */
const PR_GOALS=[
  {v:500,name:'TOCFL Level 1',what:'Band A, CEFR A1: simple everyday words and phrases.'},
  {v:1000,name:'TOCFL Level 2',what:'Band A, CEFR A2: simple, routine exchanges about familiar things.'},
  {v:2500,name:'TOCFL Level 3',what:'Band B, CEFR B1: get by in most everyday situations, and describe experiences and plans.'},
  {v:5000,name:'TOCFL Level 4',what:'Band B, CEFR B2: follow the main ideas of complex text, and talk with native speakers without strain on either side.'},
  {v:8000,name:'TOCFL Levels 5 and 6',what:'Band C, CEFR C1 to C2: the whole official word list, enough for demanding, longer texts.'}
];
function PR_goal(F){
  const D=STATE, T=today(), tot=+D.total||0, g=PR_GOALS.find(x=>x.v>tot);
  if(!g) return null;
  const need=g.v-tot, rate=F?F.rate:0, nd=rate>0.02?Math.ceil(need/rate):null;
  let when=null, eta=null;
  if(nd!=null&&nd<=365*5){
    eta=add(T,nd);
    when=nd>90?MO[eta.getMonth()]+' '+eta.getFullYear():fmtDate(eta);
  }
  return {...g,need,eta,when,short:when?`${when} at your pace`:'not within 5 years at this pace'};
}
const PR_lastCard=()=>Object.keys((STATE&&STATE.words)||{}).filter(k=>+STATE.words[k]>0).sort().pop()||null;

/* the goals on the climb: the ones he has passed sit on the line where he passed them (gold, filled); the next one
   sits where his pace reaches it (gold, hollow). Each tells its story under the pointer. */
function PR_goalPts(S,F,G,x1){
  const out=[];
  PR_GOALS.forEach(g=>{
    for(let i=1;i<S.length;i++){const a=S[i-1],b=S[i];
      if(a.v<g.v&&b.v>=g.v){const u=(g.v-a.v)/(b.v-a.v);out.push({g,reached:true,date:new Date(+a.date+u*(b.date-a.date)),v:g.v});break;}}
  });
  if(G){const far=!G.eta||G.eta>x1;out.push({g:G,reached:false,date:far?x1:G.eta,v:G.v,far});}
  return out;
}
// the month-end point for this month, at his pace (none on the month's last day: today's point is it)
function PR_monthEnd(F){
  const T=today(), me=new Date(T.getFullYear(),T.getMonth()+1,0);
  if(!F||days(T,me)<1) return null;
  return {date:me,v:Math.round((+STATE.total||0)+F.rate*days(T,me))};
}

/* ---------- the big number: today's total, or the point under the pointer. Two lines at most beside it, in a box of
   its own height, so nothing below moves ---------- */
function PR_head(c){
  const S=PR.S, F=PR.F, el=document.getElementById('pr-head');
  if(!S) return;
  if(c&&c.t==='fc'){
    el.innerHTML=`<span class="pr-big">≈${HB_fmt(PR_r10(c.v))}</span><span class="pr-sub">${c.exam?`on ${fmtDate(c.date)}, the TOCFL`:`at the start of ${MONTH[(c.date.getMonth()+1)%12]}`}<span class="pr-sub2">at ${PR_pl(F.rate)}, your average over the last ${F.pace.span} days</span></span>`;
    return;
  }
  if(c&&c.t==='goal'){
    const G=c.p.g;
    el.innerHTML=`<span class="pr-big">${HB_fmt(G.v)}</span><span class="pr-sub">${G.name}<span class="pr-sub2">${c.p.reached?`reached in ${MONTH[c.p.date.getMonth()]}`:`${HB_fmt(G.need)} to go${G.when?`, around ${G.when}`:''}`}</span></span>`;
    return;
  }
  const p=S[c?c.i:S.length-1];
  el.innerHTML=`<span class="pr-big">${HB_fmt(p.v)}</span><span class="pr-sub">${p.delta!=null
    ?`<b>${p.delta>=0?'+':'−'}${HB_fmt(Math.abs(p.delta))}</b> in ${p.name}`:p.now?'known today':`at the start of ${MONTH[p.date.getMonth()+1>11?0:p.date.getMonth()+1]}`}${p.now&&p.delta!=null?'<span class="pr-sub2">so far</span>':''}</span>`;
}

/* ---------- the line: to scale in time and from zero. Each month's name sits under its own stretch (from the end of
   the month before to its end, where its total is), with its new cards as a soft bar in the same stretch. Dotted where
   it's a forecast: to this month's end, past the exam, on to the next goal. ---------- */
function PR_chart(){
  const el=document.getElementById('pr-chart'), D=STATE;
  const W=el.clientWidth;
  if(!D||!W) return;
  const k=PR.k=parseFloat(getComputedStyle(el).getPropertyValue('--k'))||.92;
  const S=PR.S=PR_series(), F=PR.F=PR_forecast(), G=PR.G=PR_goal(F), T=today(), last=S[S.length-1];
  const narrow=W<640, H=PR.h=narrow?230:Math.max(200,Math.min(300,Math.round(innerHeight*.27)));
  PR.w=W;
  const ME=PR_monthEnd(F), examAll=F&&F.exam?{date:F.ex,v:F.proj}:null;
  // one month ahead: to the end of next month, or to the exam when it falls a little after that; the next goal is on
  // the chart only when his pace reaches it in that time
  const x0=new Date(S[0].date.getFullYear(),S[0].date.getMonth(),1), nm=new Date(T.getFullYear(),T.getMonth()+2,0);
  const x1=examAll&&examAll.date>nm&&days(T,examAll.date)<=100?examAll.date:nm, exam=examAll&&examAll.date<=x1?examAll:null;
  const reach=!!(G&&G.eta&&G.eta<=x1);
  const L=narrow?46:Math.round(58*k), R=narrow?18:Math.round(48*k), Tp=Math.round(34*k), B=Math.round(46*k);
  // time to scale
  const Wp=W-L-R, X=d=>L+Wp*((d-x0)/((x1-x0)||1));
  const GP=PR_goalPts(S,F,reach?G:null,x1);
  const top=Math.max(...S.map(p=>p.v),exam?exam.v:0,ME?ME.v:0,...GP.map(g=>g.v));
  const scaleTo=top*1.1, step=scaleTo>8000?2000:scaleTo>4000?1000:500, ymax=Math.ceil(scaleTo/step)*step||step;
  const Y=v=>Tp+(H-Tp-B)*(1-v/ymax);
  const f1=v=>v.toFixed(1);
  let g='';
  for(let v=0;v<=ymax;v+=step) g+=`<line x1="${L}" x2="${f1(W-R)}" y1="${f1(Y(v))}" y2="${f1(Y(v))}" class="pr-grid"/><text x="${L-12}" y="${f1(Y(v)+4)}" text-anchor="end" class="pr-tick">${HB_fmt(v)}</text>`;
  const lx=X(last.date), ly=Y(last.v);
  // the forecast: one dotted line from today at his pace; the month's end and the exam are points on it
  let fc='';
  const C=S.map((p,i)=>({x:X(p.date),y:Y(p.v),t:'pt',i}));
  if(F){
    const endD=x1, endV=Math.round((+D.total||0)+F.rate*days(T,endD));
    fc+=`<path d="M${f1(lx)} ${f1(ly)}L${f1(X(endD))} ${f1(Y(endV))}" class="pr-proj"/>`;
    if(exam){const ex=X(exam.date);g+=`<line x1="${f1(ex)}" x2="${f1(ex)}" y1="${Tp-16}" y2="${H-B}" class="pr-exam"/><text x="${f1(ex)}" y="${Tp-22}" text-anchor="middle" class="pr-x pr-xe">TOCFL</text>`;}
    [[ME,false],[exam,true]].forEach(([q,isEx])=>{if(!q)return;const x=X(q.date),y=Y(q.v);
      fc+=`<circle cx="${f1(x)}" cy="${f1(y)}" r="${f1(4.6*k)}" class="pr-end"/>`;
      if(isEx||!exam||X(exam.date)-x>90*k) fc+=`<text x="${f1(x)}" y="${f1(y-14*k)}" text-anchor="middle" class="pr-fv${isEx?'':' sm'}">≈${HB_fmt(PR_r10(q.v))}</text>`;
      C.push({x,y,t:'fc',date:q.date,v:q.v,exam:isEx});});
  }
  // the goals: gold circles; filled where he passed one, hollow where his pace meets the next
  let gp='';
  GP.forEach(p=>{const x=X(p.date),y=Y(p.v),r=(p.reached?5.5:6.5)*k;
    gp+=`<circle cx="${f1(x)}" cy="${f1(y)}" r="${f1(r)}" class="pr-gd${p.reached?' won':''}"/>`;
    if(!p.reached)gp+=`<text x="${f1(x)}" y="${f1(y+r+16*k)}" text-anchor="${x>W-R-60*k?'end':'middle'}" class="pr-gl next">${HB_fmt(p.g.v)} · ${p.g.name.replace('TOCFL ','')}</text>`;
    C.push({x,y,t:'goal',p});});
  // each month under its own point (the month's total at its end; this month's is its end at his pace, the hollow
  // point, since today's sits right on top of last month's early in a month): its name, and its new cards as a soft bar
  let cb='', xl='';
  {const band=(H-Tp-B)*.26, ms=[];
    for(let a=new Date(x0);a<x1;a=new Date(a.getFullYear(),a.getMonth()+1,1)){
      const e=new Date(a.getFullYear(),a.getMonth()+1,0), cur=MK(a)===MK(T);
      ms.push({a,cx:X(cur&&!ME?T:e>x1?x1:e),w:X(e)-X(a),cur,past:a<=T,n:a<=T?PR_cards(D,MK(a),T):null});}
    const mx=Math.max(1,...ms.map(m=>m.n||0)), used=[];
    ms.forEach(m=>{
      const cx=m.cx, w=m.w;
      if(m.n){const bw=Math.max(6*k,Math.min(26*k,w*.42)), bh=Math.max(3,m.n/mx*band);
        cb+=`<rect x="${f1(cx-bw/2)}" y="${f1(H-B-bh)}" width="${f1(bw)}" height="${f1(bh)}" rx="${f1(Math.min(4,bw/3))}" class="pr-cb${m.cur?' now':''}"/>`
          +(w>26*k?`<text x="${f1(cx)}" y="${f1(H-B-bh-6*k)}" text-anchor="middle" class="pr-cv">${HB_fmt(m.n)}</text>`:'');}
      const nx=new Date(m.a.getFullYear(),m.a.getMonth()+1,1), t=MO[nx.getMonth()]+(nx.getMonth()===0&&nx.getFullYear()!==T.getFullYear()?' '+nx.getFullYear():''), tw=t.length*8.2*k;
      if(w<tw*.9&&!m.cur) return;
      if(used.some(u=>cx-tw/2<u[1]+10&&cx+tw/2>u[0]-10)) return;
      used.push([cx-tw/2,cx+tw/2]);
      xl+=`<text x="${f1(cx)}" y="${H-B+Math.round(28*k)}" text-anchor="middle" class="pr-x${m.cur?' pr-xn':m.past?'':' pr-xf'}">${t}</text>`;
    });}
  const path=S.map((p,i)=>`${i?'L':'M'}${f1(X(p.date))} ${f1(Y(p.v))}`).join('');
  let pts='';
  // a month that ended only days ago sits on top of today's point: today's point speaks for both
  S.forEach((p,i)=>{
    const x=X(p.date), y=Y(p.v);
    if(!p.now&&i===S.length-2&&lx-x<24*k) return;
    if(p.now) pts+=`<circle cx="${f1(x)}" cy="${f1(y)}" r="${f1(9*k)}" class="pr-ring"/><circle cx="${f1(x)}" cy="${f1(y)}" r="${f1(6*k)}" class="pr-now"/>`;
    else pts+=`<circle cx="${f1(x)}" cy="${f1(y)}" r="${f1(4.6*k)}" class="pr-pt"/><text x="${f1(i===0?x-4:x)}" y="${f1(y-14*k)}" text-anchor="${i===0?'start':'middle'}" class="pr-pv">${HB_fmt(p.v)}</text>`;
  });
  PR.C=C.filter(c=>!(c.t==='pt'&&!S[c.i].now&&c.i===S.length-2&&lx-c.x<24*k));
  el.innerHTML=`<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" aria-hidden="true">
    ${g}${cb}<line id="pr-cx" class="pr-cx" x1="0" x2="0" y1="${Tp-14}" y2="${H-B}"/>${fc}
    <path d="${path}" class="pr-line"/>${gp}${pts}${xl}<circle id="pr-hl" class="pr-hl" r="${f1(8*k)}" cx="0" cy="0"/></svg>`;
  PR.hover=null;
}
/* a goal's note: what it is, what it means, when he got (or gets) there. One floating note, the tracker's look. */
const PR_gtip=(()=>{
  const t=document.createElement('div');t.className='hb-tip pr-gtip';t.setAttribute('role','tooltip');t.hidden=true;document.body.appendChild(t);
  return {
    show(p,F,x,y){
      const G=p.g;
      t.innerHTML=`<span class="hb-th">${p.reached?'Reached':'Next goal'}</span><span class="hb-tl">${HB_fmt(G.v)} words · ${G.name}</span><span class="pr-gw">${G.what}</span>${p.reached?'':`<span class="pr-gw">${G.when?`At ${PR_pl(F.rate)} you get there around <b>${G.when}</b>`:'At this pace that is more than five years away'}</span>`}`;
      t.hidden=false;
      const w=t.offsetWidth, h=t.offsetHeight;
      t.style.left=Math.round(Math.max(8,Math.min(innerWidth-w-8,x-w/2)))+'px';
      t.style.top=Math.round(Math.max(8,y-h-16))+'px';
    },
    hide(){t.hidden=true;}
  };
})();
function PR_pick(j){
  const cx=document.getElementById('pr-cx'), hl=document.getElementById('pr-hl'), el=document.getElementById('pr-chart');
  if(!cx) return;
  el.querySelectorAll('.pr-gd.on').forEach(d=>d.classList.remove('on'));
  if(j==null||!PR.C||!PR.C[j]){PR.hover=null;cx.classList.remove('on');hl.classList.remove('on');PR_gtip.hide();PR_head(null);return;}
  const c=PR.C[j];PR.hover=j;
  cx.setAttribute('x1',c.x);cx.setAttribute('x2',c.x);cx.classList.add('on');
  if(c.t==='goal'){
    hl.classList.remove('on');
    const ds=[...el.querySelectorAll('.pr-gd')], i=PR.C.filter(q=>q.t==='goal').indexOf(c);if(ds[i])ds[i].classList.add('on');
    const r=el.getBoundingClientRect();PR_gtip.show(c.p,PR.F,r.left+c.x,r.top+c.y-10*PR.k);
  }else{
    PR_gtip.hide();
    hl.setAttribute('cx',c.x);hl.setAttribute('cy',c.y);hl.classList.add('on');
  }
  PR_head(c);
}
(()=>{
  const el=document.getElementById('pr-chart');
  // a goal when the pointer is on its diamond; otherwise the nearest point by x
  const near=e=>{
    if(!PR.C||!PR.C.length)return null;
    const r=el.getBoundingClientRect(), x=e.clientX-r.left, y=e.clientY-r.top;
    let gi=-1,gd=1e9;PR.C.forEach((c,i)=>{if(c.t!=='goal')return;const d=Math.hypot(c.x-x,c.y-y);if(d<gd){gd=d;gi=i;}});
    if(gi>=0&&gd<=16*PR.k) return gi;
    let b=-1;PR.C.forEach((c,i)=>{if(c.t==='goal')return;if(b<0||Math.abs(c.x-x)<Math.abs(PR.C[b].x-x))b=i;});
    return b<0?null:b;
  };
  el.addEventListener('pointermove',e=>{const j=near(e);if(j!==PR.hover)PR_pick(j);});
  el.addEventListener('pointerdown',e=>{const j=near(e);if(j!==PR.hover){PR_pick(j);sfx('tap');}});
  el.addEventListener('pointerleave',e=>{if(e.pointerType==='mouse')PR_pick(null);});
  document.addEventListener('pointerdown',e=>{if(PR.hover!=null&&!el.contains(e.target))PR_pick(null);});
  // arrow keys walk the points left to right
  el.addEventListener('keydown',e=>{
    if(!PR.C)return;
    const ord=PR.C.map((c,i)=>i).sort((a,b)=>PR.C[a].x-PR.C[b].x), now=PR.C.findIndex(c=>c.t==='pt'&&PR.S[c.i].now);
    const at=ord.indexOf(PR.hover==null?now:PR.hover);
    if(e.key==='ArrowRight'){e.preventDefault();PR_pick(ord[Math.min(ord.length-1,at+(PR.hover==null?0:1))]);}
    else if(e.key==='ArrowLeft'){e.preventDefault();PR_pick(ord[Math.max(0,at-(PR.hover==null?0:1))]);}
    else if(e.key==='Escape') PR_pick(null);
  });
  el.addEventListener('blur',()=>PR_pick(null));
  try{new ResizeObserver(()=>{if(VIEW==='progress'&&el.clientWidth&&(el.clientWidth!==PR.w))PR_chart();}).observe(el);}catch(e){}
  addEventListener('resize',()=>{if(VIEW==='progress'&&el.clientWidth)PR_chart();});
})();

/* ---------- the note under the chart: his card pace, a gap if there is one, and when the next goal comes. No full
   stops (his pick 2026-11-04): each piece is its own short line of thought, spaced apart ---------- */
function PR_note(){
  const F=PR.F||PR_forecast(), G=PR.G||PR_goal(F), lc=PR_lastCard(), gap=lc?days(P(lc),today()):null, out=[];
  if(F) out.push(`New cards: <b>${PR_fr(F.rate)}</b> a day over the last ${F.pace.span} days`);
  if(lc&&gap>=3) out.push(`<span class="r">None since ${fmtDate(lc)}</span>`);
  if(G) out.push(`Next goal: <b>${HB_fmt(G.v)}</b> words, ${G.name}${G.when?`, around <b>${G.when}</b>`:', more than five years away at this pace'}`);
  document.getElementById('pr-note').innerHTML=out.map(x=>`<span>${x}</span>`).join('');
}

function PR_render(){
  if(!STATE) return;
  if(VIEW!=='progress') return;
  PR_chart();
  PR_head(null);
  PR_note();
  HB_render(document.getElementById('pr-habit'),true);
}
['data','essays','reviews','test','nodb'].forEach(ev=>BUS.on(ev,()=>PR_render()));
BUS.on('lab',id=>{if(id==='habit'||id==='board-k')PR_render();});
BUS.on('view',v=>{if(v==='progress')PR_render();});
BUS.on('leave',v=>{if(v==='progress'){PR.hover=null;PR_gtip.hide();}});
