/* ---------- fun: celebrations and the forest. Owner: C
   FUN.celebrate(kind,opts): test, crossoff (a tiny burst at opts.x,opts.y). (Essay, week and new-card moments went
   2026-11-01: there is no finishing step any more, and Claude adds the cards, so he'd never see them.)
   Canvas and its own physics, no library; one fixed overlay that never takes a click and goes away when done.
   The forest (#companion on Today, FUN.forest(el) or #pr-forest on Progress): one tree a month, Forest-app style. Every
   essay day that month grows it and adds a cluster of its leaves or blossoms; things crossed off and new cards that
   month hang flowers or fruit on it; today's cluster waits as a bud until he writes. Each month is its
   own species, in season (plum in January ... maple in November), so a year is twelve different trees. On Today this
   month's tree stands in front and this year's earlier months recede behind it; Progress shows the year, Jan to Dec,
   each tree over its month in the heatmap (a sapling for a month with nothing). The forest starts again each January.
   Only a tree itself answers the pointer: it sways, and leaves swish as fast as the hand moves (quieter for a small one).
   (The cat that lived here is gone, 2026-11-20; what it taught is in ../online-plan/character-lessons.md.) ---------- */
(()=>{
const TAU=Math.PI*2;
const rm=()=>{try{return REDUCED();}catch(e){return false;}};
const clamp=(v,a,b)=>v<a?a:v>b?b:v;
const lerp=(a,b,u)=>a+(b-a)*u;
const css=n=>{try{return getComputedStyle(document.documentElement).getPropertyValue(n).trim();}catch(e){return '';}};
let PAL=null;
function pal(){
  if(PAL) return PAL;
  const g=(n,f)=>(/^#[0-9a-f]{6}$/i.test(css(n))?css(n):f);
  return PAL={red:g('--red','#B83A3A'),gold:g('--gold','#F2C230'),goldE:g('--gold-edge','#E2B627'),green:g('--green','#3C8A5F'),
    greenS:g('--green-soft','#AAD3BA'),greenD:g('--green-deep','#2A6B47'),plum:g('--lane-tw','#C25B80'),slate:g('--lane-life','#7D93B8'),
    petal:'#F2B6CA',petalL:'#FADCE6',goldL:'#FBE39A'};
}
const rgb=h=>{const n=parseInt(h.slice(1),16);return [n>>16&255,n>>8&255,n&255];};
const shade=(h,k)=>{const f=v=>Math.round(k<0?v*(1+k):v+(255-v)*k);const [r,g,b]=rgb(h);return `rgb(${f(r)},${f(g)},${f(b)})`;};
const rgba=(h,a)=>{const [r,g,b]=rgb(h);return `rgba(${r},${g},${b},${a})`;};
function rng(s){return ()=>{s|=0;s=s+0x6D2B79F5|0;let t=Math.imul(s^s>>>15,1|s);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
const R=Math.random;
/* a tree's stir eases in the way it eases out (2026-11-04: it snapped into motion when the pointer arrived). A hand on
   a tree raises what the stir wants (o.w); the stir itself (o.g) climbs to it over a few tenths of a second, and as the
   want fades on its own the stir follows it down. */
const stirTo=(o,dt,fade)=>{o.w=(o.w||0)*Math.exp(-dt*fade);const u=o.w>o.g?1-Math.exp(-dt*4.2):1;o.g+=(o.w-o.g)*u;if(o.g<1e-4)o.g=0;};

/* ---------- sounds: same family as core's (soft triangles, a breath of noise) ---------- */
SOUNDS.tada=(c,t)=>{tone(c,784,t,.16,.045,'triangle');tone(c,988,t,.16,.035,'triangle');tone(c,1047,t+.13,.55,.05,'triangle');tone(c,1319,t+.13,.55,.04,'triangle');tone(c,2637,t+.2,.4,.012);hiss(c,t+.12,.05,.08,'bandpass',3000,.9);};
/* ---------- the overlay: particles + timed effects on one fixed canvas ---------- */
const FX={cv:null,c:null,ps:[],fx:[],raf:0,last:0,w:0,h:0,dpr:1};
function fxSize(){if(!FX.cv)return;FX.dpr=Math.min(2,devicePixelRatio||1);FX.w=innerWidth;FX.h=innerHeight;FX.cv.width=Math.round(FX.w*FX.dpr);FX.cv.height=Math.round(FX.h*FX.dpr);}
function fxStart(){
  if(!FX.cv){FX.cv=document.createElement('canvas');FX.cv.className='fun-fx';FX.cv.setAttribute('aria-hidden','true');document.body.appendChild(FX.cv);FX.c=FX.cv.getContext('2d');fxSize();addEventListener('resize',fxSize);}
  if(!FX.raf){FX.last=performance.now();FX.raf=requestAnimationFrame(fxTick);}
}
function fxTick(now){
  const dt=Math.min(1/20,Math.max(0,(now-FX.last)/1000));FX.last=now;
  const c=FX.c;c.setTransform(FX.dpr,0,0,FX.dpr,0,0);c.clearRect(0,0,FX.w,FX.h);
  const cur=FX.fx;FX.fx=[];
  const keep=cur.filter(e=>{c.globalAlpha=1;return e.step(dt,c)!==false;});FX.fx=keep.concat(FX.fx);
  FX.ps=FX.ps.filter(p=>stepP(p,dt));
  for(const p of FX.ps)drawP(c,p);
  c.globalAlpha=1;
  if(FX.ps.length||FX.fx.length){FX.raf=requestAnimationFrame(fxTick);return;}
  FX.raf=0;removeEventListener('resize',fxSize);FX.cv.remove();FX.cv=null;FX.c=null;
}
function mkP(o){return Object.assign({x:0,y:0,vx:0,vy:0,r:R()*TAU,vr:0,f:R()*TAU,vf:0,t:0,life:1.6,g:700,drag:2.8,wob:0,wf:4,wp:R()*TAU,a:1,fo:.7,w:8,h:11,k:'rect',c:'#000',c2:'#000'},o);}
function stepP(p,dt){
  p.t+=dt;if(p.t>=p.life||p.y>FX.h+60)return false;
  if(p.tr){p.tr.push(p.x,p.y);if(p.tr.length>p.tl*2)p.tr.splice(0,2);}
  const d=Math.exp(-p.drag*dt);p.vx*=d;p.vy=p.vy*d+p.g*dt;
  p.x+=(p.vx+Math.sin(p.t*p.wf+p.wp)*p.wob)*dt;p.y+=p.vy*dt;p.r+=p.vr*dt;p.f+=p.vf*dt;
  const u=p.t/p.life;p.a=Math.min(1,p.t/.05)*(u<p.fo?1:Math.max(0,1-(u-p.fo)/(1-p.fo)));
  if(p.tw&&u>.55&&R()<.35)p.a*=.3;
  return true;
}
function petalPath(c,w,h){c.beginPath();c.moveTo(0,h*.5);c.bezierCurveTo(w*.95,h*.18,w*.62,-h*.62,0,-h*.34);c.bezierCurveTo(-w*.62,-h*.62,-w*.95,h*.18,0,h*.5);}
function starPath(c,s){c.beginPath();c.moveTo(0,-s);c.quadraticCurveTo(s*.14,-s*.14,s,0);c.quadraticCurveTo(s*.14,s*.14,0,s);c.quadraticCurveTo(-s*.14,s*.14,-s,0);c.quadraticCurveTo(-s*.14,-s*.14,0,-s);}
function drawP(c,p){
  if(p.a<=.01)return;
  c.globalAlpha=p.a;
  if(p.k==='spark'){
    const tr=p.tr,rr=p.w*(1-.5*p.t/p.life);
    if(tr.length>=2){const g=c.createLinearGradient(tr[0],tr[1],p.x,p.y);g.addColorStop(0,rgba(p.c,0));g.addColorStop(1,rgba(p.c,.5));
      c.strokeStyle=g;c.lineCap='round';c.lineJoin='round';c.lineWidth=rr*1.15;c.beginPath();c.moveTo(tr[0],tr[1]);for(let i=2;i<tr.length;i+=2)c.lineTo(tr[i],tr[i+1]);c.lineTo(p.x,p.y);c.stroke();}
    c.globalAlpha=p.a;c.fillStyle=p.c;c.beginPath();c.arc(p.x,p.y,rr,0,TAU);c.fill();return;
  }
  c.save();c.translate(p.x,p.y);c.rotate(p.r);
  if(p.k==='rect'){const s=Math.cos(p.f);c.scale(1,Math.abs(s)<.08?.08:s);c.fillStyle=s<0?p.c2:p.c;c.beginPath();c.roundRect?c.roundRect(-p.w/2,-p.h/2,p.w,p.h,1.5):c.rect(-p.w/2,-p.h/2,p.w,p.h);c.fill();}
  else if(p.k==='dot'){c.fillStyle=p.c;c.beginPath();c.arc(0,0,p.w/2,0,TAU);c.fill();}
  else if(p.k==='petal'){c.scale(.55+.45*Math.abs(Math.cos(p.f)),1);c.fillStyle=p.c;petalPath(c,p.w,p.h);c.fill();c.fillStyle='rgba(255,255,255,.35)';c.beginPath();c.ellipse(0,p.h*.2,p.w*.16,p.h*.22,0,0,TAU);c.fill();}
  else if(p.k==='ribbon'){c.strokeStyle=p.c;c.lineWidth=p.w;c.lineCap='round';c.beginPath();for(let i=0;i<=8;i++){const x=(i-4)*2.6,y=Math.sin(i*.95+p.f)*3.2;i?c.lineTo(x,y):c.moveTo(x,y);}c.stroke();}
  else if(p.k==='star'){const s=p.w*(.75+.25*Math.sin(p.f));c.fillStyle=p.c;starPath(c,s);c.fill();}
  c.restore();
}
const vscale=()=>clamp(Math.min(innerWidth,innerHeight*1.3)/1000,.55,1);
const pick=a=>a[Math.random()*a.length|0];
function burst(x,y,n,o={}){
  const C=pal(),k=vscale();
  const colors=o.colors||[C.gold,C.gold,C.goldE,C.red,C.red,C.green,C.green,C.plum,C.plum,C.slate,C.greenS];
  const kinds=o.kinds||[['rect',.42],['petal',.2],['dot',.15],['ribbon',.12],['star',.11]];
  n=Math.round(n*(.6+.4*k));
  for(let i=0;i<n;i++){
    const ang=(o.dir??-Math.PI/2)+(R()-.5)*(o.spread??Math.PI*.95);
    const sp=((o.v0??340)+Math.pow(R(),.75)*(o.v1??760))*k;
    let kind='rect',acc=0;const kr=R();for(const [kk,w] of kinds){acc+=w;if(kr<acc){kind=kk;break;}}
    let col=pick(colors);
    if(kind==='petal')col=R()<.7?C.petal:C.plum;
    if(kind==='star')col=R()<.75?C.gold:C.goldE;
    const p=mkP({k:kind,x,y,vx:Math.cos(ang)*sp,vy:Math.sin(ang)*sp,c:col,c2:shade(col,-.3),life:(o.life??1.35)+R()*(o.lifeR??.7),vr:(R()-.5)*9,vf:7+R()*9});
    if(kind==='rect'){p.w=5.5+R()*3.5;p.h=8+R()*5;p.drag=2.6+R()*.8;p.g=760;p.wob=16;p.wf=5+R()*5;}
    else if(kind==='petal'){p.w=7.5+R()*2.5;p.h=8.5+R()*2.5;p.drag=3.6;p.g=380;p.wob=42;p.wf=2.5+R()*2.5;p.vr=(R()-.5)*5;p.vf=3+R()*4;}
    else if(kind==='dot'){p.w=4+R()*3;p.drag=2.3;p.g=880;}
    else if(kind==='ribbon'){p.w=2.2;p.drag=3;p.g=620;p.wob=22;p.vf=8+R()*6;}
    else if(kind==='star'){p.w=6+R()*5;p.drag=3.3;p.g=330;p.vr=(R()-.5)*3;p.tw=true;}
    if(o.g!=null)p.g*=o.g;
    if(o.drag)p.drag*=o.drag;
    FX.ps.push(p);
  }
  fxStart();
}
function ring(x,y,r,col,dur=.45,lw=2.5,delay=0){FX.fx.push({t:-delay,step(dt,c){this.t+=dt;if(this.t<0)return;const u=this.t/dur;if(u>=1)return false;const e=1-Math.pow(1-u,3);c.globalAlpha=(1-u)*.75;c.strokeStyle=col;c.lineWidth=lw*(1-u)+.6;c.beginPath();c.arc(x,y,Math.max(.1,r*e),0,TAU);c.stroke();}});fxStart();}
// a soft light that swells and fades: the flash of a firework, and the whole celebration when motion is reduced
function glow(x,y,r,col,dur,peak=.3,delay=0,attack=.5){FX.fx.push({t:-delay,step(dt,c){this.t+=dt;if(this.t<0)return;const u=this.t/dur;if(u>=1)return false;const a=peak*(u<attack?Math.sin(u/attack*Math.PI/2):Math.cos((u-attack)/(1-attack)*Math.PI/2));const g=c.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,rgba(col,a));g.addColorStop(.55,rgba(col,a*.35));g.addColorStop(1,rgba(col,0));c.fillStyle=g;c.fillRect(x-r,y-r,2*r,2*r);}});fxStart();}

// where the moment happened: the caret if it's in the block, else the block, else the middle of the screen
function origin(o,sel,fy){
  if(o&&isFinite(o.x)&&isFinite(o.y))return [o.x,o.y];
  const el=sel&&document.querySelector(sel);
  try{const s=getSelection();if(el&&s.rangeCount&&el.contains(s.anchorNode)){const b=s.getRangeAt(0).getBoundingClientRect();if(b.top>0&&b.top<innerHeight)return [clamp(b.left,40,innerWidth-40),b.top+b.height/2];}}catch(e){}
  if(el){const r=el.getBoundingClientRect();if(r.width&&r.bottom>40&&r.top<innerHeight-40)return [r.left+r.width/2,clamp(r.top+Math.min(r.height*fy,240),70,innerHeight-70)];}
  return [innerWidth/2,innerHeight*.6];
}

// the days written this Mon–Sun week (the essay day turns over at 4 am)
function weekDays(){
  const t=P(essayToday()),m=monday(t),set=new Set((ES.essays||[]).filter(e=>e&&e.date&&String(e.text||'').trim()).map(e=>e.date));
  let n=0;for(let i=0;i<7;i++)if(set.has(K(add(m,i))))n++;return n;
}

function celebrate(kind,o){
  o=o||{};const C=pal(),still=rm();
  if(kind==='test'){
    const [x,y]=origin(o,'#quiz',.45);
    if(still)glow(x,y,170,C.gold,1.2,.3);
    else{ring(x,y,60*vscale(),C.goldE,.45,2.5);burst(x,y,100,{kinds:[['rect',.36],['star',.24],['dot',.16],['ribbon',.12],['petal',.12]]});}
    sfx('tada');
  }else if(kind==='crossoff'){
    const [x,y]=origin(o,null,.5);
    if(still)glow(x,y,46,C.green,.7,.35);
    else{
      ring(x,y,22,C.green,.38,2);
      burst(x,y,18,{dir:-Math.PI/2,spread:TAU,v0:110,v1:260,life:.55,lifeR:.3,g:.55,drag:1.8,colors:[C.green,C.green,C.greenS,C.gold,C.plum],kinds:[['dot',.5],['petal',.3],['star',.2]]});
    }
  }else if(kind==='card'){
    // Card it: a burst from the button, over the card window (the sound is the stamp, cards.js)
    const [x,y]=origin(o,null,.5);
    if(still)glow(x,y,90,C.green,.9,.3);
    else{ring(x,y,34*vscale(),C.green,.42,2.2);burst(x,y,70,{dir:Math.PI/2,spread:Math.PI*1.6,v0:220,v1:560,life:1.1,lifeR:.5});}
  }
}


/* ---------- the sound of living things: leaves swishing under the hand. Quiet; never on its own. ---------- */
// leaves under a moving hand: a swish that follows the pointer. A looped breath of noise whose loudness and brightness
// ride the hand's speed (silent when it stops), with dry leaf ticks scattered in as fast as it moves.
// only once the board has made a sound after a click: a hover alone never starts audio
const audioLive=()=>{try{return SND.on&&SND.ctx&&SND.ctx.state==='running';}catch(e){return false;}};
const BR={src:null,g:null,g2:null,bp:null,idle:0,stop:0,tick:0};
function brush(v,vol=1){
  if(!audioLive()){return;}
  const c=SND.ctx,t=c.currentTime;
  if(!BR.src){
    const s=c.createBufferSource(),bp=c.createBiquadFilter(),g=c.createGain(),hp=c.createBiquadFilter(),g2=c.createGain();
    s.buffer=SND.noise;s.loop=true;bp.type='bandpass';bp.Q.value=.7;bp.frequency.value=900;g.gain.value=0;
    hp.type='highpass';hp.frequency.value=4200;g2.gain.value=0;
    s.connect(bp).connect(g).connect(SND.out);s.connect(hp).connect(g2).connect(SND.out);s.start(t,R()*.5);
    Object.assign(BR,{src:s,g,g2,bp});
  }
  const k=clamp(v/2.2,0,1),q=clamp(vol,.15,1);
  BR.g.gain.setTargetAtTime(.028*q*Math.pow(k,.8),t,k?.03:.14);
  BR.g2.gain.setTargetAtTime(.008*q*k,t,k?.03:.14);
  BR.bp.frequency.setTargetAtTime(700+1600*k,t,.06);
  // the dry ticks of leaves brushing each other
  const n=Math.round(k*5*(.6+R()*.8));
  for(let i=0;i<n;i++)hiss(c,t+R()*.09,.008+R()*.022,(.0025+R()*.006)*(.4+k)*q,'bandpass',2600+R()*4800,1+R()*1.5);
  clearTimeout(BR.idle);clearTimeout(BR.stop);
  if(k)BR.idle=setTimeout(()=>brush(0),110);
  else BR.stop=setTimeout(()=>{try{BR.src.stop();}catch(e){}BR.src=null;},1500);
}

/* ---------- the trees: one species a month, in season (Taiwan's year) ----------
   form: seed, spread (how wide the boughs open), lr (how long each step is), up (pulled upright), flat (crown spread
   flat, an umbrella), depth. bark: trunk, twig. crown: what a written day adds, [kind, share, colors]. acc: what things
   crossed off and new cards hang on it. per: how many pieces a day adds. */
const SPECIES=[
  {n:'Plum',zh:'梅',form:{seed:3,spread:1.12,lr:.8,up:.06,flat:.1,depth:7.6},bark:['#4B4143','#7C6D70'],per:4,L:.85,
    crown:[['bloom',.85,['#FBF1F4','#F7D7E1','#F2B6CA']],['bud',.15,['#C25B80']]],acc:['bud',['#C25B80','#B04A70']]},
  {n:'Peach',zh:'桃',form:{seed:17,spread:1.05,lr:.8,up:.1,flat:.05,depth:7.6},bark:['#5A4747','#8B7474'],per:4,L:.9,
    crown:[['bloom',.7,['#F09AB4','#F5B5C8','#EC86A3']],['leaf',.3,['#9CCB7C','#8AC072']]],acc:['bud',['#D9668A']]},
  {n:'Cherry',zh:'櫻',form:{seed:29,spread:1.3,lr:.82,up:.02,flat:.25,depth:8},bark:['#5B4A50','#8D7B82'],per:5,L:.9,
    crown:[['bloom',1,['#FAD9E3','#F7CAD8','#FFFFFF','#F3B9CB']]],acc:['bud',['#E58AA6']]},
  {n:'Tung',zh:'油桐',form:{seed:41,spread:1.05,lr:.8,up:.08,flat:.1,depth:8},bark:['#57524C','#888178'],per:4,L:1.05,
    crown:[['leaf',.7,['#7DBA7A','#5FA36F','#8CC47A']],['bloom',.3,['#FFFFFF','#FBF7F2']]],acc:['bloom',['#FFFFFF']]},
  {n:'Jacaranda',zh:'藍花楹',form:{seed:53,spread:1.25,lr:.84,up:.03,flat:.35,depth:8},bark:['#5B5960','#8E8B93'],per:5,L:.85,
    crown:[['bloom',.75,['#A99AD9','#BBAEE6','#9384CC']],['feather',.25,['#9CCB86']]],acc:['bloom',['#8E7CC8']]},
  {n:'Flame tree',zh:'鳳凰木',form:{seed:67,spread:1.4,lr:.84,up:0,flat:.55,depth:8},bark:['#5E5650','#8F857C'],per:5,L:1,
    crown:[['feather',.6,['#8CC47A','#74B26C','#9DD08A']],['bloom',.4,['#E8603C','#F07E45','#D9482F']]],acc:['bloom',['#E8603C']]},
  {n:'Banyan',zh:'榕',form:{seed:79,spread:1.3,lr:.78,up:.02,flat:.3,depth:8.2},bark:['#5D5A52','#8A8578'],per:6,L:.95,
    crown:[['leaf',1,['#3C8A5F','#2F7451','#4F9A6E','#46905F']]],acc:['fruit',['#B85C7A','#C46C86']]},
  {n:'Mango',zh:'芒果',form:{seed:97,spread:1.1,lr:.8,up:.08,flat:.12,depth:8},bark:['#5C5148','#8B7E70'],per:5,L:1.15,
    crown:[['leaf',.88,['#3E7D52','#4F8F5F','#2F6B47','#5A9A66']],['fruit',.12,['#F2A93B','#F4BC4C']]],acc:['fruit',['#F2A93B','#E8913A']]},
  {n:'Osmanthus',zh:'桂花',form:{seed:107,spread:.95,lr:.78,up:.14,flat:0,depth:8},bark:['#56504A','#867E74'],per:5,L:.85,
    crown:[['leaf',.72,['#3F7A57','#4C8A63','#356F4E']],['dots',.28,['#F2C230','#F6D365','#EDB52A']]],acc:['dots',['#F2C230']]},
  {n:'Ginkgo',zh:'銀杏',form:{seed:127,spread:.85,lr:.8,up:.26,flat:0,depth:8},bark:['#5A5048','#8A7E72'],per:6,L:1,
    crown:[['fan',1,['#F2C230','#F4CF55','#E9B526','#F7DC7A']]],acc:['fruit',['#E8A33A']]},
  {n:'Maple',zh:'楓',form:{seed:139,spread:1.15,lr:.8,up:.07,flat:.12,depth:8},bark:['#4E4442','#7E716D'],per:5,L:1,
    crown:[['maple',1,['#D9532F','#E8703A','#C8402E','#F09A3E']]],acc:['fruit',['#9E2F2F','#B83A3A']]},
  {n:'Camellia',zh:'山茶',form:{seed:151,spread:1,lr:.78,up:.12,flat:.05,depth:7.8},bark:['#4F4A46','#7F7872'],per:5,L:.9,
    crown:[['leaf',.78,['#2F6B47','#3C7D57','#28603F']],['bloom',.22,['#C93A4A','#D9505E','#BF3343']]],acc:['bloom',['#C93A4A']]}
];
const SKS={};
function skel(si){
  if(SKS[si])return SKS[si];
  const F=SPECIES[si].form,r=rng(0x5EED2610^(F.seed*7919)),out=[];
  const mk=(par,b,rel,len,wr,at)=>{
    const n={id:out.length,par,b,rel,len,wr,at,bend:(r()-.5)*1.5,ph:r()*TAU,kids:[]};
    out.push(n);
    const ks=[];
    if(!par){ks.push([(r()-.5)*.22,.74,.74,1,1]);ks.push([-(.72+r()*.22),.8,.66,1.05,.66+r()*.1]);ks.push([.66+r()*.22,.78,.64,1.15,.8+r()*.1]);}
    else{
      const s=r()<.5?-1:1;
      ks.push([(r()-.5)*.46,.74+r()*.12,.76,1,1]);
      ks.push([s*(.6+r()*.45),.56+r()*.18,.58,1.25,.5+r()*.42]);
      if(r()<.5)ks.push([-s*(.55+r()*.42),.48+r()*.16,.52,1.55,.3+r()*.45]);
    }
    for(const [a,lr,w,db,at] of ks)if(b+db<=F.depth)n.kids.push(mk(n,b+db,a*F.spread,len*lr*F.lr/.8*(.88+r()*.24),wr*w,at));
    return n;
  };
  mk(null,0,(r()-.5)*.08,1,1,1);
  for(const n of out){
    const pa=n.par?n.par.abs:-Math.PI/2;let a=pa+n.rel;
    a+=(-Math.PI/2-a)*(.1+F.up);
    if(F.flat&&n.b>=1.5){const tg=a<-Math.PI/2?-Math.PI*.86:-Math.PI*.14;a+=(tg-a)*F.flat*Math.min(1,(n.b-1)/3);}
    n.abs=a;n.rel=a-pa;
  }
  // the full-grown bounds, unit scale, root at 0,0: every tree of this kind is fitted by its grown size, so it grows in place
  const T={vis:new Float32Array(out.length).fill(1),S:1,size:1,rx:0,ry:0};
  SKS[si]=out;poseTree(T,out,0,0);
  let x0=0,x1=0,y0=0;for(const n of out){x0=Math.min(x0,n.ex,n.sx);x1=Math.max(x1,n.ex,n.sx);y0=Math.min(y0,n.ey);}
  out.box={x0,x1,y0};
  return out;
}
function poseTree(T,nodes,t,wind){
  for(const n of nodes){
    const f=T.vis[n.id];if(!f)continue;
    const p=n.par,[sx,sy,pa]=p?qpt(p,n.at):[T.rx,T.ry,-Math.PI/2];
    const flex=.0024*Math.pow(n.b+1,1.45);
    const a=pa+n.rel+wind*flex+(T.still?0:Math.sin(t*1.25+n.ph)*.0035*(n.b+1));
    const L=n.len*T.S*T.size*f;
    n.a=a;n.sx=sx;n.sy=sy;n.ex=sx+Math.cos(a)*L;n.ey=sy+Math.sin(a)*L;
    const bend=(n.bend+wind*flex*2)*L*.3;
    n.cx=(sx+n.ex)/2-Math.sin(a)*bend;n.cy=(sy+n.ey)/2+Math.cos(a)*bend;
  }
}
function qpt(n,u){const iu=1-u;return [iu*iu*n.sx+2*iu*u*n.cx+u*u*n.ex,iu*iu*n.sy+2*iu*u*n.cy+u*u*n.ey,Math.atan2(2*iu*(n.cy-n.sy)+2*u*(n.ey-n.cy),2*iu*(n.cx-n.sx)+2*u*(n.ex-n.cx))];}

/* --- a month: its days, what hangs on it, today --- */
function monthInfo(y,m){
  const tk=essayToday(),mk=y+'-'+String(m+1).padStart(2,'0'),cur=tk.slice(0,7)===mk,set=new Set();let txt=false;
  (ES.essays||[]).forEach(e=>{if(!e||!e.date||!String(e.text||'').trim()||e.date.slice(0,7)!==mk)return;if(e.date===tk)txt=true;else set.add(e.date);});
  const done=cur&&txt;
  if(done)set.add(tk);
  let crossed=0,cards=0;
  Object.values(ES.items||{}).forEach(i=>{if(i&&i.done&&i.doneAt&&!i.removed&&MK(new Date(i.doneAt))===mk)crossed++;});
  for(const [k,v] of Object.entries((STATE&&STATE.words)||{}))if(k.slice(0,7)===mk)cards+=+v||0;
  return {y,m,mk,cur,si:m,N:new Date(y,m+1,0).getDate(),dates:[...set].sort(),n:set.size,today:cur?(done?'done':txt?'started':'none'):null,
    acc:Math.min(28,crossed+Math.floor(cards/10)),crossed,cards};
}
// this year, January to December (the forest starts again each January); months still to come are .future
function yearMonths(){
  const T=P(essayToday()),y=T.getFullYear();
  return Array.from({length:12},(_,m)=>Object.assign(monthInfo(y,m),{future:m>T.getMonth()}));
}
// the months with a tree: this one, and the earlier ones this year that he wrote in
const months=()=>yearMonths().filter(m=>!m.future&&(m.cur||m.n));

/* --- a tree laid out in a box: {cx: middle, by: ground, h: height, w: width} --- */
function treeLayout(mi,box){
  const si=mi.si,sp=SPECIES[si],nodes=skel(si),B=nodes.box;
  const u=clamp(mi.n/(mi.N*.8),0,1),g=Math.pow(u,.72);
  const T={mi,sp,nodes,g,vis:new Float32Array(nodes.length),size:.32+.68*g,still:rm()};
  const dmax=.95+7.4*g;
  for(const n of nodes){const v=clamp(dmax-n.b,0,1);T.vis[n.id]=v<.04?0:v;}
  T.S=Math.min(box.h/(-B.y0),box.w/(B.x1-B.x0+.2));
  T.rx=box.cx-(B.x0+B.x1)/2*T.S*T.size;T.ry=box.by;
  poseTree(T,nodes,0,0);
  let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9;
  for(const n of nodes)if(T.vis[n.id]){x0=Math.min(x0,n.sx,n.ex);x1=Math.max(x1,n.sx,n.ex);y0=Math.min(y0,n.sy,n.ey);y1=Math.max(y1,n.sy,n.ey);}
  T.W0=Math.max(1.5,T.S*(.065+.06*g));
  T.leafL=clamp(T.S*.23,3,19)*sp.L*(.8+.2*g);
  // the box the tree fills (twigs plus the reach of their leaves), for the pointer
  {const pd=T.leafL*1.4;T.bb=[x0-pd,y0-pd,x1+pd,y1+4];}
  // where a day's cluster can sit: the outer twigs mostly; the trunk itself while it's a sprout
  const twigs=[],tw=[],inner=[],iw=[];
  for(const n of nodes){const f=T.vis[n.id];if(!f||!n.par)continue;
    if(f>.45){twigs.push(n);tw.push(Math.pow(n.b/dmax,3)*(n.kids.some(k=>T.vis[k.id]>.5)?.4:1.8)+.02);}
    if(f>.85&&n.b>=1.4){inner.push(n);iw.push(n.b*n.b);}}
  if(!twigs.length){twigs.push(nodes[0]);tw.push(1);}
  let top=null;for(const n of twigs)if(!n.kids.some(k=>T.vis[k.id]>.5)&&(!top||n.ey<top.ey))top=n;top=top||nodes[0];
  const wpick=(arr,ws,q)=>{const s=ws.reduce((a,b)=>a+b,0)*q;let acc=0;for(let i=0;i<arr.length;i++){acc+=ws[i];if(acc>=s)return arr[i];}return arr[arr.length-1];};
  const kind=q=>{let a=0;for(const c of sp.crown){a+=c[1];if(q<a)return c;}return sp.crown[0];};
  T.els=[];T.puffs=[];T.top=top;
  const tk=essayToday(),last=mi.dates[mi.dates.length-1];
  mi.dates.forEach(k=>{
    const d=+k.slice(8),q=rng(d*7919+si*104729+mi.y),isToday=mi.cur&&k===tk,fresh=k===last,pc=sp.crown[0][2];
    // a day spreads over three twigs (today's sits at the top), a few pieces on each: the crown fills evenly
    for(let g2=0;g2<3;g2++){
      const n=isToday&&!g2?top:wpick(twigs,tw,q()),u=isToday&&!g2?.86:n===nodes[0]?.9:.35+.62*q(),side=q()<.5?-1:1;
      T.puffs.push({n,u:clamp(u,.1,.95),r:1.2+.6*q(),col:shade(pc[(q()*pc.length)|0],.3),dx:(q()-.5)*.6,dy:(q()-.5)*.6});
      const per=Math.max(2,Math.round(sp.per*.75));
      for(let j=0;j<per;j++){
        const [kd,,cols]=kind(q()),a=(j/(per-1||1)-.5)*2.4+(q()-.5)*.6;
        T.els.push({n,u:clamp(u+(q()-.5)*.18,.05,.98),side,spr:.5+a*side*.7,sz:(.8+.32*q())*(j?.92:1),ph:q()*TAU,k:kd,
          col:fresh&&kd!=='bloom'?shade(cols[(q()*cols.length)|0],.12):cols[(q()*cols.length)|0],today:isToday,j:g2*10+j});
      }
    }
  });
  T.bud=mi.cur&&mi.today!=='done'?{n:top,u:.9,open:mi.today==='started'}:null;
  T.acc=[];
  const pool=inner.length?inner:twigs,pw=inner.length?iw:tw;
  for(let j=0;j<mi.acc;j++){const q=rng(j*104729+7+si*31);T.acc.push({n:wpick(pool,pw,q()),u:.15+.8*q(),off:(q()-.5)*1.1,rot:q()*TAU,sz:.8+.35*q()});}
  return T;
}

/* --- drawing --- */
// a tapered stroke along a quadratic or cubic curve, filled, with a round end
function taper(c,pts,w0,w1,flare,nocap){
  const N=8,Lp=[],Rp=[],cub=pts.length===8;
  for(let i=0;i<=N;i++){
    const u=i/N,iu=1-u;let x,y,tx,ty;
    if(cub){const [a,b,cx1,cy1,cx2,cy2,d,e]=pts;x=iu*iu*iu*a+3*iu*iu*u*cx1+3*iu*u*u*cx2+u*u*u*d;y=iu*iu*iu*b+3*iu*iu*u*cy1+3*iu*u*u*cy2+u*u*u*e;tx=3*iu*iu*(cx1-a)+6*iu*u*(cx2-cx1)+3*u*u*(d-cx2);ty=3*iu*iu*(cy1-b)+6*iu*u*(cy2-cy1)+3*u*u*(e-cy2);}
    else{const [a,b,cx,cy,d,e]=pts;x=iu*iu*a+2*iu*u*cx+u*u*d;y=iu*iu*b+2*iu*u*cy+u*u*e;tx=2*iu*(cx-a)+2*u*(d-cx);ty=2*iu*(cy-b)+2*u*(e-cy);}
    const tl=Math.hypot(tx,ty)||1;tx/=tl;ty/=tl;
    let w=(w0+(w1-w0)*u)/2;if(flare&&u<.22)w*=1+flare*Math.pow(1-u/.22,2);
    Lp.push(x-ty*w,y+tx*w);Rp.push(x+ty*w,y-tx*w);
  }
  c.beginPath();c.moveTo(Lp[0],Lp[1]);for(let i=2;i<Lp.length;i+=2)c.lineTo(Lp[i],Lp[i+1]);
  for(let i=Rp.length-2;i>=0;i-=2)c.lineTo(Rp[i],Rp[i+1]);c.closePath();c.fill();
  const ex=pts[pts.length-2],ey=pts[pts.length-1];c.beginPath();c.arc(ex,ey,Math.max(.3,w1/2),0,TAU);c.fill();
  if(!nocap){c.beginPath();c.arc(pts[0],pts[1],Math.max(.3,w0/2),0,TAU);c.fill();}
}
// the pieces, drawn at the twig (0,0) pointing along +x, l long
function bloom(c,r,col,rot){
  c.rotate(rot);
  const lt=shade(col,.35);
  for(let k=0;k<5;k++){const a=k*TAU/5;c.fillStyle=k%2?col:lt;c.beginPath();c.arc(Math.cos(a)*r*.9,Math.sin(a)*r*.9,r*.78,0,TAU);c.fill();}
  c.fillStyle=shade(col,.6);c.beginPath();c.arc(0,0,r*.55,0,TAU);c.fill();
  c.fillStyle=pal().goldE;for(let k=0;k<5;k++){const a=k*TAU/5+.6;c.beginPath();c.arc(Math.cos(a)*r*.45,Math.sin(a)*r*.45,Math.max(.4,r*.13),0,TAU);c.fill();}
}
function piece(c,E,l){
  const k=E.k;
  if(k==='leaf'){c.fillStyle=E.col;c.globalAlpha*=.95;c.beginPath();c.moveTo(0,0);c.bezierCurveTo(l*.22,-l*.36,l*.66,-l*.4,l,-l*.04);c.bezierCurveTo(l*.7,l*.3,l*.26,l*.34,0,0);c.fill();
    if(l>6){c.strokeStyle='rgba(255,255,255,.26)';c.lineWidth=.7;c.beginPath();c.moveTo(l*.1,0);c.quadraticCurveTo(l*.5,-l*.06,l*.84,-l*.04);c.stroke();}}
  else if(k==='fan'){const R0=l*.78,x=l*.24;c.strokeStyle=E.col;c.lineWidth=Math.max(.6,l*.06);c.beginPath();c.moveTo(0,0);c.lineTo(x,0);c.stroke();
    c.fillStyle=E.col;c.beginPath();c.moveTo(x,0);c.arc(x,0,R0,-.72,-.06);c.lineTo(x+R0*.72,0);c.arc(x,0,R0,.06,.72);c.closePath();c.fill();
    if(l>6){c.strokeStyle='rgba(255,255,255,.22)';c.lineWidth=.6;for(const a of [-.4,0,.4]){c.beginPath();c.moveTo(x+2,0);c.lineTo(x+Math.cos(a)*R0*.85,Math.sin(a)*R0*.85);c.stroke();}}}
  else if(k==='maple'){const cx=l*.46,r=l*.5;c.fillStyle=E.col;c.beginPath();
    const lob=[[-1.25,.62],[-.62,.86],[0,1],[.62,.86],[1.25,.62]];
    c.moveTo(cx-r*.18,r*.28);
    lob.forEach(([a,m],i)=>{const ia=a-.31,ib=a+.31;c.lineTo(cx+Math.cos(ia)*r*.42,Math.sin(ia)*r*.42);c.lineTo(cx+Math.cos(a)*r*m,Math.sin(a)*r*m);c.lineTo(cx+Math.cos(ib)*r*.42,Math.sin(ib)*r*.42);});
    c.lineTo(cx-r*.18,-r*.28);c.closePath();c.fill();
    c.strokeStyle=E.col;c.lineWidth=Math.max(.5,l*.05);c.beginPath();c.moveTo(0,0);c.lineTo(cx,0);c.stroke();}
  else if(k==='feather'){c.strokeStyle=E.col;c.lineWidth=Math.max(.5,l*.04);c.beginPath();c.moveTo(0,0);c.lineTo(l*1.1,0);c.stroke();
    c.fillStyle=E.col;c.beginPath();for(let i=1;i<=6;i++){const x=l*1.1*i/7,w=l*.13*(1-i/9);c.ellipse(x,-w,w*1.25,w*.6,-.5,0,TAU);c.ellipse(x,w,w*1.25,w*.6,.5,0,TAU);}c.fill();}
  else if(k==='bloom'){c.translate(l*.3,0);bloom(c,l*.3,E.col,E.ph);}
  else if(k==='bud'){c.fillStyle=E.col;c.beginPath();c.arc(l*.22,0,l*.17,0,TAU);c.fill();c.fillStyle='rgba(255,255,255,.35)';c.beginPath();c.arc(l*.17,-l*.05,l*.06,0,TAU);c.fill();}
  else if(k==='fruit'){const r=l*.2;c.fillStyle=E.col;c.beginPath();c.arc(l*.25,r*.6,r,0,TAU);c.fill();c.fillStyle='rgba(255,255,255,.4)';c.beginPath();c.arc(l*.25-r*.35,r*.25,r*.3,0,TAU);c.fill();}
  else if(k==='dots'){c.fillStyle=E.col;for(let i=0;i<5;i++){const a=i*1.3+E.ph;c.beginPath();c.arc(l*.3+Math.cos(a)*l*.15,Math.sin(a)*l*.15,Math.max(.5,l*.075),0,TAU);c.fill();}}
}
// a soft round glow of crown colour, made once per colour
const PUFF=new Map();
function puffSprite(col){
  let cv=PUFF.get(col);if(cv)return cv;
  cv=document.createElement('canvas');cv.width=cv.height=64;const c=cv.getContext('2d'),g=c.createRadialGradient(32,32,0,32,32,32),[r,gg,b]=col.match(/\d+/g).map(Number);
  g.addColorStop(0,`rgba(${r},${gg},${b},.55)`);g.addColorStop(.55,`rgba(${r},${gg},${b},.28)`);g.addColorStop(1,`rgba(${r},${gg},${b},0)`);
  c.fillStyle=g;c.fillRect(0,0,64,64);PUFF.set(col,cv);return cv;
}
// one tree: shadow, wood, its pieces, what hangs on it, today's bud
function drawTree(c,T,t,wind,pop){
  const C=pal(),still=T.still;
  poseTree(T,T.nodes,t,wind);
  const sw=Math.max(14,T.S*T.size*1.25);
  const gr=c.createRadialGradient(T.rx,T.ry+1,0,T.rx,T.ry+1,sw);gr.addColorStop(0,'rgba(21,23,28,.09)');gr.addColorStop(1,'rgba(21,23,28,0)');
  c.save();c.translate(0,T.ry+1);c.scale(1,.1);c.translate(0,-(T.ry+1));c.fillStyle=gr;c.fillRect(T.rx-sw,T.ry+1-sw,2*sw,2*sw);c.restore();
  const [b0,b1]=T.sp.bark.map(rgb);
  for(const n of T.nodes){
    const f=T.vis[n.id];if(!f)continue;
    const kid=n.kids.some(k=>T.vis[k.id]>.25);
    const w0=Math.max(.7,n.wr*T.W0),w1=Math.max(.5,kid?w0*.74:w0*.3);
    const m=clamp(n.b/6,0,1);c.fillStyle=`rgb(${Math.round(lerp(b0[0],b1[0],m))},${Math.round(lerp(b0[1],b1[1],m))},${Math.round(lerp(b0[2],b1[2],m))})`;
    taper(c,[n.sx,n.sy,n.cx,n.cy,n.ex,n.ey],w0,w1*(f<1?.6:1),n.par?0:.55,!n.par);
    if(w0>3){c.save();c.translate(-w0*.17,0);c.fillStyle='rgba(255,255,255,.13)';taper(c,[n.sx,n.sy,n.cx,n.cy,n.ex,n.ey],w0*.3,w1*.25,0,!n.par);c.restore();}
  }
  const pu=pop?(t-pop.t0)/1.2:2;
  // soft masses of crown first, so the twigs disappear into foliage the way they do on a real tree
  c.globalAlpha=.2;
  for(const F of T.puffs){const [x,y]=qpt(F.n,F.u),r=T.leafL*F.r*1.4;c.drawImage(puffSprite(F.col),x+F.dx*r*.7+wind*.6-r,y+F.dy*r*.7-r,2*r,2*r);}
  c.globalAlpha=1;
  for(const E of T.els){
    const [x,y,a]=qpt(E.n,E.u);
    const fl=still?0:Math.sin(t*2.1+E.ph)*.13+wind*.08;
    c.save();c.translate(x,y);c.rotate(a+E.side*E.spr+fl);
    if(E.today&&pop&&pu<1.6&&!still){const s=pu<=0?0:1-Math.exp(-5*pu)*Math.cos(9*pu);c.scale(Math.max(0,s),Math.max(0,s));}
    if(E.k==='fruit'){c.rotate(-(a+E.side*E.spr+fl)+fl*.3);}
    piece(c,E,T.leafL*E.sz);c.restore();
    if(E.today&&!E.j&&pop&&pu>0&&pu<1){
      for(let k=0;k<7;k++){const a2=k/7*TAU+.4,dd=6+pu*18;c.globalAlpha=(1-pu)*.9;c.fillStyle=k%2?C.gold:C.green;c.beginPath();c.arc(x+Math.cos(a2)*dd,y+Math.sin(a2)*dd,1.6*(1-pu)+.6,0,TAU);c.fill();}
      c.globalAlpha=1;
    }
  }
  const acc=T.sp.acc;
  for(const F of T.acc){
    const [x,y,a]=qpt(F.n,F.u),o=F.off*Math.max(1,F.n.wr*T.W0*.5);
    c.save();c.translate(x-Math.sin(a)*o,y+Math.cos(a)*o);
    const l=T.leafL*.95*F.sz,col=acc[1][(F.rot*7|0)%acc[1].length];
    if(acc[0]==='bloom'){bloom(c,l*.3,col,F.rot+(still?0:Math.sin(t*1.7+F.rot)*.08));}
    else{c.rotate(acc[0]==='fruit'?0:F.rot);piece(c,{k:acc[0],col,ph:F.rot},l);}
    c.restore();
  }
  if(T.bud){
    const [x,y,a]=qpt(T.bud.n,T.bud.u),l=T.leafL*1.1;
    c.save();c.translate(x,y);c.rotate(a+(still?0:Math.sin(t*1.6)*.08));
    const pulse=still?1:.85+.15*Math.sin(t*2.2);
    const halo=c.createRadialGradient(l*.25,0,0,l*.25,0,l*.95);halo.addColorStop(0,rgba(C.gold,.14*pulse));halo.addColorStop(1,rgba(C.gold,0));
    c.fillStyle=halo;c.beginPath();c.arc(l*.25,0,l*.95,0,TAU);c.fill();
    const bl=l*(T.bud.open?.66:.48);c.fillStyle='#A9D27C';c.beginPath();c.moveTo(0,0);c.bezierCurveTo(bl*.3,-bl*.34,bl*.8,-bl*.2,bl,0);c.bezierCurveTo(bl*.8,bl*.2,bl*.3,bl*.34,0,0);c.fill();
    c.restore();
  }
}
// distance: the tree fades toward the ground colour
function hazeOver(c,w,h,a){if(!(a>0))return;c.globalCompositeOperation='source-atop';c.fillStyle=rgba(css('--bg')||'#FAFAFC',a);c.fillRect(0,0,w,h);c.globalCompositeOperation='source-over';}
// is the point (in the tree's own coordinates) on the tree itself: near a twig, or among the leaves around it?
const segD=(x,y,ax,ay,bx,by)=>{const dx=bx-ax,dy=by-ay,l=dx*dx+dy*dy,u=l?clamp(((x-ax)*dx+(y-ay)*dy)/l,0,1):0;return Math.hypot(x-ax-dx*u,y-ay-dy*u);};
function treeHit(T,x,y){
  const b=T&&T.bb;if(!b||x<b[0]||x>b[2]||y<b[1]||y>b[3])return false;
  poseTree(T,T.nodes,0,0);
  const r=Math.max(T.leafL*1.3,6);
  for(const n of T.nodes)if(T.vis[n.id]&&segD(x,y,n.sx,n.sy,n.ex,n.ey)<Math.max(r,n.wr*T.W0/2+3))return true;
  return false;
}
// a month with nothing written: a sapling, two leaves on a stem, in the month's own green
function sapling(c,x,by,h,sp,sway){
  const col=(sp.crown.find(k=>k[0]==='leaf'||k[0]==='feather'||k[0]==='fan'||k[0]==='maple')||sp.crown[0])[2][0];
  c.save();c.translate(x,by);c.rotate(sway||0);
  c.fillStyle='rgba(21,23,28,.07)';c.beginPath();c.ellipse(0,1,h*.45,h*.08,0,0,TAU);c.fill();
  c.strokeStyle=sp.bark[1];c.lineWidth=Math.max(1.2,h*.08);c.lineCap='round';c.beginPath();c.moveTo(0,0);c.quadraticCurveTo(h*.06,-h*.5,0,-h);c.stroke();
  [[-1,.72],[1,.86]].forEach(([d,u])=>{c.save();c.translate(h*.02,-h*u);c.rotate(d<0?Math.PI+.5:-.5);piece(c,{k:'leaf',col},h*.5);c.restore();});
  c.restore();
}
// a past tree, drawn once and kept: still, and hazed toward the ground colour with distance
const IMG=new Map();
function treeImage(mi,h,haze,dpr,maxW){
  const key=[mi.mk,mi.n,mi.acc,mi.today,Math.round(h),Math.round(maxW||0),haze,dpr].join(':');
  if(IMG.has(key))return IMG.get(key);
  const sp=skel(mi.si),B=sp.box,S=Math.min(h/(-B.y0),maxW?maxW/(B.x1-B.x0+.2):1e9),w=Math.ceil((B.x1-B.x0+.6)*S)+8,H=Math.ceil(h+10);
  const cv=document.createElement('canvas');cv.width=Math.ceil(w*dpr);cv.height=Math.ceil(H*dpr);
  const c=cv.getContext('2d');c.setTransform(dpr,0,0,dpr,0,0);
  const T=treeLayout(mi,{cx:w/2,by:H-5,h,w:maxW||1e9});T.still=true;
  drawTree(c,T,0,0,null);
  hazeOver(c,w,H,haze);
  const out={cv,w,H,base:H-5,T};
  if(IMG.size>80)IMG.clear();
  IMG.set(key,out);return out;
}

/* ---------- the forest on Today (#companion): this month's tree in front, this year's earlier months receding behind ---------- */
const kk=()=>{const v=parseFloat(css('--k'));return isFinite(v)&&v>0?v:.92;};
const CP={gw:0,el:null,cv:null,c:null,w:0,h:0,ox:0,oy:0,dpr:1,inview:true,T:null,past:[],order:[],gust:0,pop:null,t:0,home:null,fall:[],nextFall:5,sig:'',lx:null,ly:0,lt:0};
// up to eleven earlier months stand along a path going back (the most recent nearest): x, ground, height (fractions
// of the box), haze. By December it is a small wood.
const SLOTS=[[.17,.86,.5,.26],[.9,.76,.4,.42],[.42,.68,.32,.56],[.7,.62,.26,.66],[.03,.7,.3,.6],[.99,.63,.27,.68],
  [.27,.6,.22,.72],[.56,.57,.2,.76],[.83,.56,.19,.78],[.12,.55,.17,.8],[.66,.53,.16,.82]];
function cpLayout(){
  if(!CP.w||!CP.h)return;
  const ms=months(),cur=ms[ms.length-1],W=CP.w,H=CP.h;
  const cx=W*.58,by=H-Math.max(8,H*.03);
  CP.T=treeLayout(cur,{cx,by,h:H*.88,w:W*.84});
  CP.past=ms.slice(0,-1).reverse().slice(0,SLOTS.length).map((mi,i)=>({mi,s:SLOTS[i],g:0,w:0,live:null}));
  CP.order=CP.past.slice().sort((a,b)=>a.s[1]-b.s[1]);
}
const pastImg=p=>treeImage(p.mi,CP.h*p.s[2],p.s[3],CP.dpr,CP.w*.55);
function cpDraw(dt){
  const c=CP.c;if(!c||!CP.w)return;
  c.setTransform(CP.dpr,0,0,CP.dpr,0,0);c.clearRect(0,0,CP.w+2*CP.ox,CP.h+CP.oy);c.translate(CP.ox,CP.oy);
  const still=rm(),t=CP.t;
  for(const p of CP.order){
    const img=pastImg(p),x=CP.w*p.s[0]-img.w/2,y=CP.h*p.s[1]-img.base;
    stirTo(p,dt,1.4);
    if(p.g>.015&&!still){
      // a tree further back stirs too, gentler than the one in front: drawn live, hazed like its still picture
      const L=p.live||(p.live=document.createElement('canvas'));
      if(L.width!==img.cv.width||L.height!==img.cv.height){L.width=img.cv.width;L.height=img.cv.height;}
      const lc=L.getContext('2d');lc.setTransform(CP.dpr,0,0,CP.dpr,0,0);lc.clearRect(0,0,img.w,img.H);
      img.T.still=false;drawTree(lc,img.T,t,p.g*Math.sin(t*4.4+p.s[0]*9)*1.2,null);img.T.still=true;
      hazeOver(lc,img.w,img.H,p.s[3]);
      c.drawImage(L,x,y,img.w,img.H);
    }else c.drawImage(img.cv,x,y,img.w,img.H);
  }
  const T=CP.T;if(!T)return;
  {const o={g:CP.gust,w:CP.gw};stirTo(o,dt,1.3);CP.gust=o.g;CP.gw=o.w;}
  const wind=still?0:(.6*Math.sin(t*.41)+.3*Math.sin(t*1.03+1.1)+.1*Math.sin(t*2.2+2))+CP.gust*Math.sin(t*5.2)*1.6;
  T.still=still;
  drawTree(c,T,t,wind,CP.pop);
  if(CP.pop&&t-CP.pop.t0>3)CP.pop=null;
  // now and then a piece of this month's crown lets go and drifts down
  if(!still&&T.els.length){
    if(t>CP.nextFall&&CP.fall.length<2){
      const E=pick(T.els),[x,y]=qpt(E.n,E.u);
      CP.fall.push({x,y,t0:t,ph:R()*TAU,land:T.ry-1+R()*4,vx:(R()-.5)*8,lt:null,r:R()*TAU,E});
      CP.nextFall=t+10+R()*16;
    }
    CP.fall=CP.fall.filter(p=>{
      if(p.lt==null){p.y+=dt*(15+wind*3);p.x+=dt*(p.vx+Math.sin((t-p.t0)*1.6+p.ph)*13+wind*6);p.r+=dt*1.3;if(p.y>=p.land){p.y=p.land;p.lt=t;}}
      const a=p.lt==null?1:clamp(1-(t-p.lt-3)/1.5,0,1);if(a<=0)return false;
      c.save();c.globalAlpha=a;c.translate(p.x,p.y);c.rotate(p.r);c.scale(p.lt==null?.6+.4*Math.abs(Math.sin((t-p.t0)*2.4)):1,p.lt==null?1:.5);
      piece(c,p.E,T.leafL*.9);c.restore();return true;
    });
  }
}
function cpSize(){
  if(!CP.cv)return;
  const k=kk(),side=getComputedStyle(CP.el).gridColumnStart==='3',nx=document.getElementById('next');
  // beside Next up the forest is as tall as the list, so the year below starts under both
  const want=side&&nx&&nx.offsetHeight?clamp(nx.offsetHeight,300*k,520*k):0;
  CP.el.style.height=want?Math.round(want)+'px':'';
  const w=CP.el.clientWidth,h=CP.el.clientHeight;
  if(!w||!h)return;
  const [ox,oy]=spill(CP.el,w*.2+30*k,h*.3);
  CP.dpr=Math.min(2,devicePixelRatio||1);
  if(w!==CP.w||h!==CP.h||ox!==CP.ox||oy!==CP.oy){
    CP.w=w;CP.h=h;CP.ox=ox;CP.oy=oy;
    Object.assign(CP.cv.style,{left:-ox+'px',top:-oy+'px',width:w+2*ox+'px',height:h+oy+'px'});
    CP.cv.width=Math.round((w+2*ox)*CP.dpr);CP.cv.height=Math.round((h+oy)*CP.dpr);cpLayout();}
  cpDraw(0);
}
// how far a canvas may reach past its box: what was asked, but never past the window's sides or the app bar
function spill(el,ox,oy){
  const r=el.getBoundingClientRect();
  return [Math.max(0,Math.round(Math.min(ox,r.left+scrollX-2,document.documentElement.clientWidth-r.right-2))),Math.round(oy)];
}
const cpActive=()=>!document.hidden&&CP.inview&&VIEW==='today'&&CP.w>0;
// the hand's speed since the last move (px per ms), kept on the forest it moved over
function handSpeed(M,e){const now=performance.now(),v=M.lx!=null&&now-M.lt<120?Math.hypot(e.clientX-M.lx,e.clientY-M.ly):0,dt=Math.max(8,now-M.lt);M.lx=e.clientX;M.ly=e.clientY;M.lt=now;return [v,v/dt];}
// the pointer on a tree (the one in front first, then the earlier months from the nearest): it stirs, the leaves swish
function cpMove(e){
  // nothing behind an open card answers the pointer (html.cd-on, cards.js)
  if(VIEW!=='today'||!CP.cv||!CP.w||e.pointerType==='touch'||document.documentElement.classList.contains('cd-on'))return;
  const r=CP.cv.getBoundingClientRect(),x=e.clientX-r.left-CP.ox,y=e.clientY-r.top-CP.oy;
  const [v,sp]=handSpeed(CP,e);
  let hit=null;
  if(x>-CP.ox&&x<CP.w+CP.ox&&y>-CP.oy&&y<CP.h){
    if(CP.T&&treeHit(CP.T,x,y))hit={vol:CP.T.size};
    else for(let i=CP.order.length-1;i>=0;i--){const p=CP.order[i],img=pastImg(p);if(treeHit(img.T,x-(CP.w*p.s[0]-img.w/2),y-(CP.h*p.s[1]-img.base))){hit={p,vol:img.T.size*p.s[2]*1.3};break;}}
  }
  if(!hit){brush(0);return;}
  if(hit.p)hit.p.w=Math.min(.75,Math.max(hit.p.w||0,.22)+v*.003);else CP.gw=Math.min(1.25,Math.max(CP.gw||0,.25)+v*.004);
  brush(sp,hit.vol);kick();
}
function cpMount(){
  CP.el=document.getElementById('companion');if(!CP.el)return;
  CP.cv=document.createElement('canvas');CP.cv.className='fun-cv';CP.el.appendChild(CP.cv);CP.c=CP.cv.getContext('2d');
  try{const ro=new ResizeObserver(cpSize);ro.observe(CP.el);const nx=document.getElementById('next');if(nx)ro.observe(nx);}catch(e){addEventListener('resize',cpSize);}
  try{new IntersectionObserver(es=>{CP.inview=es[es.length-1].isIntersecting;kick();}).observe(CP.el);}catch(e){}
  addEventListener('pointermove',cpMove,{passive:true});
  cpData();cpSize();
}
function cpData(){const sig=months().map(m=>m.mk+m.n+m.acc+m.today).join('|');if(sig!==CP.sig){CP.sig=sig;cpLayout();}}
/* ---------- the forest on Progress: the year, Jan to Dec, each tree over its month in the heatmap above (#pr-habit);
   a sapling for a month that has passed with nothing written, a faint spot for months to come.
   FUN.forest(el) fills any container (or #pr-forest) ---------- */
const PF=new Set();
function forest(el){
  if(!el)return;
  let M=el._fo;
  if(!M||!el.contains(M.cv)){
    el.innerHTML='<div class="fo"><canvas class="fo-cv" aria-hidden="true"></canvas><div class="fo-row"></div></div>';
    M=el._fo={el,fo:el.querySelector('.fo'),cv:el.querySelector('.fo-cv'),row:el.querySelector('.fo-row'),t:0,slots:[],w:0,h:0,ox:0,oy:0,dpr:1,sig:'',lx:null,ly:0,lt:0};
    M.c=M.cv.getContext('2d');
    try{new ResizeObserver(()=>pfRender(M)).observe(el);}catch(e){}
    // a finger: a tap on a month (its name or the column above it) shows its note, a tap elsewhere hides it
    document.addEventListener('pointerup',e=>{if(e.pointerType!=='touch')return;const m=e.target.closest&&e.target.closest('.fo-m');
      M.row.querySelectorAll('.fo-m.on').forEach(x=>{if(x!==m)x.classList.remove('on');});if(m&&M.row.contains(m))m.classList.toggle('on');});
  }
  PF.add(M);pfRender(M);
}
// where each month sits: the middle of its weeks in the heatmap, when one is on the page; else twelve even columns
function pfXs(M,w){
  const g=document.querySelector('#pr-habit .hm-g'),inn=g&&g.closest('.hm-in');
  const even=()=>Array.from({length:12},(_,m)=>[(m+.5)*w/12,w/12]);
  if(!g||!inn)return even();
  const cols=+inn.dataset.cols,y=+inn.dataset.y;if(!cols||!y)return even();
  const rg=g.getBoundingClientRect(),rr=M.row.getBoundingClientRect(),gap=parseFloat(getComputedStyle(g).columnGap)||0;
  if(!rg.width)return even();
  const c=(rg.width-(cols-1)*gap)/cols,pitch=c+gap,first=monday(new Date(y,0,1));
  return Array.from({length:12},(_,m)=>{
    const a=Math.floor(days(first,new Date(y,m,1))/7),b=Math.floor(days(first,new Date(y,m+1,0))/7);
    return [rg.left-rr.left+(a+b+1)/2*pitch-gap/2,(b-a+1)*pitch];
  });
}
function pfRender(M){
  if(!M.el.isConnected){PF.delete(M);return;}
  const w=M.row.clientWidth,h=parseFloat(getComputedStyle(M.fo).paddingTop)||0;if(!w||!h)return;
  const ms=yearMonths(),k=kk(),xs=pfXs(M,w);
  const sig=ms.map(m=>m.mk+m.n+m.acc+(m.future?'f':'')).join('|')+w+'x'+h+xs.map(x=>Math.round(x[0])).join(',');
  const [ox,oy]=spill(M.fo,w/12*.6+20*k,h*.35);
  M.dpr=Math.min(2,devicePixelRatio||1);
  if(M.w!==w||M.h!==h||M.ox!==ox||M.oy!==oy){M.w=w;M.h=h;M.ox=ox;M.oy=oy;
    Object.assign(M.cv.style,{left:-ox+'px',top:-oy+'px',width:w+2*ox+'px',height:h+oy+'px'});
    M.cv.width=Math.round((w+2*ox)*M.dpr);M.cv.height=Math.round((h+oy)*M.dpr);}
  if(sig!==M.sig){
    M.sig=sig;
    M.slots=ms.map((mi,i)=>({mi,cx:xs[i][0],sw:xs[i][1],T:null,g:0,w:0}));
    M.row.innerHTML=ms.map((mi,i)=>{const sp=SPECIES[mi.si],s=M.slots[i];
      // the month's note is plain text under its name, shown while the pointer is on the tree or the name (a tap on a phone)
      const note=mi.future?'':`<span class="fo-note"><span>${sp.zh} ${sp.n.toLowerCase()}</span><span>${mi.n?`${mi.n} day${mi.n>1?'s':''} written`:'Not planted yet'}</span>${mi.crossed?`<span>${mi.crossed} crossed off</span>`:''}</span>`;
      return `<span class="fo-m${mi.cur?' now':''}${mi.future?' later':''}" style="left:${(s.cx-s.sw/2).toFixed(1)}px;width:${s.sw.toFixed(1)}px">${MO[mi.m]}${note}</span>`;}).join('');
  }
  pfDraw(M,0);
}
const pfGeo=M=>({th:M.h*.9,by:M.h-6});
const pfTree=(M,s)=>{const {th,by}=pfGeo(M);return s.T||(s.T=treeLayout(s.mi,{cx:s.cx,by,h:th,w:s.sw*.72}));};
function pfDraw(M,dt){
  const c=M.c;if(!c||!M.w)return;
  c.setTransform(M.dpr,0,0,M.dpr,0,0);c.clearRect(0,0,M.w+2*M.ox,M.h+M.oy);c.translate(M.ox,M.oy);
  const {th,by}=pfGeo(M),k=kk(),still=rm();
  M.slots.forEach(s=>{
    stirTo(s,dt,1.5);
    const live=s.g>.015&&!still,wind=live?s.g*Math.sin(M.t*5.2)*1.8:0;
    if(s.mi.future){c.fillStyle='rgba(21,23,28,.06)';c.beginPath();c.ellipse(s.cx,by,5,1.4,0,0,TAU);c.fill();return;}
    if(!s.mi.n&&!s.mi.cur){sapling(c,s.cx,by,22*k,SPECIES[s.mi.si],wind*.12);return;}
    if(live){drawTree(c,pfTree(M,s),M.t,wind,null);return;}
    const img=treeImage(s.mi,th,0,M.dpr,s.sw*.72);c.drawImage(img.cv,s.cx-img.w/2,by-img.base,img.w,img.H);
  });
}
// the pointer on a tree or a sapling (not the air around it): that one sways, the leaves swish
function pfMove(e){
  if(VIEW!=='progress'||e.pointerType==='touch'||document.documentElement.classList.contains('cd-on'))return;
  PF.forEach(M=>{
    if(!M.w)return;
    const r=M.cv.getBoundingClientRect(),x=e.clientX-r.left-M.ox,y=e.clientY-r.top-M.oy,[v,sp]=handSpeed(M,e),{by}=pfGeo(M),k=kk();
    let hit=null;
    if(x>-M.ox&&x<M.w+M.ox&&y>-M.oy&&y<M.h)for(const s of M.slots){
      if(s.mi.future)continue;
      if(!s.mi.n&&!s.mi.cur){if(Math.abs(x-s.cx)<12*k&&y>by-26*k&&y<by+3){hit={s,vol:.18};break;}continue;}
      const T=pfTree(M,s);if(treeHit(T,x,y)){hit={s,vol:T.size};break;}
    }
    if(!hit){brush(0);return;}
    hit.s.w=Math.min(1.4,Math.max(hit.s.w||0,.5)+v*.003);brush(sp,hit.vol);kick();
  });
}
addEventListener('pointermove',pfMove,{passive:true});
const pfActive=()=>VIEW==='progress'&&!document.hidden&&[...PF].some(M=>M.slots.some(s=>s.g>.015||s.w>.015));
function pfTick(dt){PF.forEach(M=>{if(M.slots.some(s=>s.g>.015||s.w>.015)){M.t+=dt;pfDraw(M,dt);}});}
function pfAll(){
  const el=document.getElementById('pr-forest');if(el&&!el._fo)forest(el);
  PF.forEach(M=>{M.sig='';pfRender(M);});
}

/* ---------- one loop for every living thing; it sleeps when nothing on screen moves ---------- */
const LOOP={raf:0,last:0};
function kick(){
  const want=!rm()&&(cpActive()||pfActive());
  if(want){if(!LOOP.raf){LOOP.last=performance.now();LOOP.raf=requestAnimationFrame(tick);}}
  else{if(LOOP.raf){cancelAnimationFrame(LOOP.raf);LOOP.raf=0;}cpDraw(0);}
}
function tick(now){
  LOOP.raf=requestAnimationFrame(tick);
  const busy=CP.pop||CP.gust>.05||CP.gw>.05||CP.past.some(p=>p.g>.015||p.w>.015)||pfActive();
  const dt=(now-LOOP.last)/1000;if(dt<(busy?1/70:1/31))return;
  LOOP.last=now;const d=Math.min(dt,.1);
  if(cpActive()){CP.t+=d;cpDraw(d);}
  if(pfActive())pfTick(d);
  if(!cpActive()&&!pfActive()){cancelAnimationFrame(LOOP.raf);LOOP.raf=0;}
}

/* ---------- wiring ---------- */
const refresh=()=>{cpData();cpDraw(0);pfAll();kick();};
BUS.on('essays',refresh);BUS.on('items',refresh);BUS.on('data',refresh);
BUS.on('view',v=>{if(v==='progress')pfAll();if(v==='today')setTimeout(()=>{cpSize();kick();},30);else kick();});
BUS.on('lab',id=>{if(id==='board-k')cpSize();});
document.addEventListener('visibilitychange',kick);
try{matchMedia('(prefers-reduced-motion:reduce)').addEventListener('change',kick);}catch(e){}
function mount(){cpMount();kick();}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount);else mount();

// tests read how much each tree is stirring
const stir=()=>({front:CP.gust,past:CP.past.map(p=>p.g),year:[...PF].map(M=>M.slots.map(s=>s.g))});
window.FUN={celebrate,weekDays,forest,species:SPECIES,stir};
})();
