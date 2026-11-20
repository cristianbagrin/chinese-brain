/* ---------- fun: celebrations, the forest and the cat. Owner: C
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
   The cat: a layer of its own over Today. It sleeps under this month's tree, pops over to sit on the test card while
   a test is open, peeks over the writing sheet while he writes, and goes home to sit up once he has written. Idle
   life: blinks, ears, tail, yawns, grooming, batting at a leaf, naps. Never takes a click; a click on it gets a purr. ---------- */
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


/* ---------- the sounds of living things: a purr, and leaves swishing under the hand. Quiet; never on their own. ---------- */
// a purr: soft low pulses, about 25 a second, one breath in and a longer one out
// (2026-11-04: louder, and brighter, since a laptop speaker drops most of what sits under 300 Hz: the purr's rumble
// now reaches up to where small speakers play, so it carries at half volume)
SOUNDS.purr=(c,t)=>{
  for(const [s0,len,hz,g] of [[0,.6,28,.19],[.7,.95,24,.26]]){
    const n=Math.round(len*hz);
    for(let i=0;i<n;i++){const u=i/n,e=Math.sin(Math.PI*u),at=t+s0+i/hz+(R()-.5)*.004,a=g*(.3+.7*e)*(.85+.3*R());
      hiss(c,at,.034,a,'lowpass',420+260*e,.9);
      hiss(c,at,.028,a*.35,'bandpass',900+200*e,1.1);}
  }
};
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
  // the cat's place: on the ground beside this month's trunk, never off the edge
  const k=kk();CP.home={x:clamp(cx-Math.max(54*k,W*.3),44*k,W-44*k),y:by};
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

/* ---------- the cat: its own layer over Today. Soft, round, a little blue-grey tabby ----------
   Places (page coordinates, from the blocks' boxes): home = beside this month's tree; the test card's top edge while a
   test waits for answers; peeking over the writing sheet while he writes. Between them it pops: a crouch, a spring up
   into a puff, and it pops out of a puff at the new place (his idea, 2026-11-01; with reduced motion it's simply there).
   Settled, it lives: breathing, blinks, ears, tail, and a few seconds after it arrives, then every 10-25 s, one clear
   thing (a stretch, a hop round, a yawn, a wash, a swipe at a leaf; over the sheet a yawn or a paw tap), so a short
   visit sees one or two. At home it naps until he starts writing. The layer never takes a pointer event. */
LAB.define('cat','The cat',[['roams','Walks to where you are'],['stays','Stays by the tree']],'roams','Today');
const CAT={fur:'#A6AEBB',top:'#BCC3CE',low:'#959DAB',dark:'#868F9E',light:'#E3E6EB',pink:'#EE9FAE',inner:'#F3C3CC',ink:'#2D3139',mouth:'#7E4352'};
const KT={el:null,cv:null,c:null,dpr:1,W:0,H:0,s:.36,x:0,y:0,spot:null,pose:'loaf',face:-1,walk:null,shown:false,
  t:0,A:0,act:null,nextAct:4,nb:2,bk:-9,dbl:false,ne:6,et:-9,es:1,hu:-9,heart:-9,h0:-9,wake:-99,arrived:0,peek:1,
  typed:-1e9,res:0,purrAt:0,boot:0,ptr:{x:-1e4,y:-1e4},ov:{spot:null,mood:null},
  warp:null,sx:1,sy:1,lift:0,ox:0,rot:0,sq:1,sqv:0,
  fh:-1,fb:-1,ft:-1,turn:null,Ah:0,Ahv:0,At:0,Atv:0,Av:0,pk:1,pw1:1,pw2:1,eo:0,ev:0,tw:0,yawned:false,slow:1};
const wroteToday=()=>(ES.essays||[]).some(e=>e&&e.date===essayToday()&&String(e.text||'').trim());
const testWaiting=()=>{try{const q=document.getElementById('quiz');return !!(q&&!q.hidden&&typeof testOpen==='function'&&testOpen()&&steps().some(s=>!(s.a&&s.a.answer)));}catch(e){return false;}};
const writing=()=>{const a=document.activeElement;return !!(a&&a.isContentEditable&&a.closest('#write'))||performance.now()-KT.typed<15000;};
function wantSpot(){
  if(KT.ov.spot)return KT.ov.spot;
  if(LAB.get('cat')==='stays')return 'home';
  return writing()?'write':testWaiting()?'quiz':'home';
}
// where a place puts the cat, kept inside the window's sides: its whole layer (tail, stretch, puff) stays on the page,
// the same rule as the trees' canvas (spill) (2026-11-04: it got cut off at the edges)
function spotPt(name){
  const p=spotRaw(name);if(!p)return p;
  const half=KT.W/2+4, dw=document.documentElement.clientWidth;
  p.x=dw>2*half?clamp(p.x,scrollX+half,scrollX+dw-half):scrollX+dw/2;
  return p;
}
function spotRaw(name){
  const k=kk(),box=el=>{if(!el||el.hidden)return null;const r=el.getBoundingClientRect();return r.width&&r.height?r:null;};
  if(name==='quiz'){const r=box(document.getElementById('quiz'));return r&&{x:r.right+scrollX-70*k,y:r.top+scrollY+1,pose:'loaf'};}
  if(name==='write'){const r=box(document.getElementById('w-paper'))||box(document.getElementById('write'));return r&&{x:r.right+scrollX-84*k,y:r.top+scrollY+3,pose:'peek'};}
  const r=CP.home&&box(CP.el);return r&&{x:r.left+scrollX+CP.home.x,y:r.top+scrollY+CP.home.y,pose:'loaf'};
}
function moodTarget(){
  if(KT.ov.mood)return {asleep:0,drowsy:.45,awake:1}[KT.ov.mood];
  if(KT.spot!=='home'||wroteToday())return 1;
  if(KT.t-Math.max(KT.arrived,KT.wake)<25)return .8;
  return 0;
}
// where it should be, and the move there
function catResolve(force){
  const want=VIEW==='today'?wantSpot():null;
  let p=want&&spotPt(want),to=want;if(!p&&want&&want!=='home'){p=spotPt('home');to='home';}
  const show=!!p;
  if(show!==KT.shown){KT.shown=show;KT.el.hidden=!show;}
  if(!p)return;
  if(!KT.spot||rm()||force==='snap'||performance.now()<KT.boot){
    KT.x=p.x;KT.y=p.y;if(KT.spot!==to){KT.spot=to;KT.arrived=KT.t;}KT.pose=p.pose;KT.warp=null;KT.turn=null;
    KT.fh=KT.fb=KT.ft=KT.face;KT.pk=KT.pw1=KT.pw2=1;KT.sx=KT.sy=1;KT.lift=KT.ox=KT.rot=0;return;}
  if(KT.warp){const w=KT.warp;w.to=to;w.pose=p.pose;w.x1=p.x;w.y1=p.y;return;}
  const d=Math.hypot(p.x-KT.x,p.y-KT.y);
  if(to===KT.spot&&d<36){KT.x=p.x;KT.y=p.y;return;}
  KT.act=null;
  // which way it's going; a cat that faces the wrong way turns round first
  const dir=Math.abs(p.x-KT.x)<40?KT.face:Math.sign(p.x-KT.x);
  const turn=KT.pose!=='peek'&&dir!==KT.face&&!KT.turn;
  KT.warp={ph:'out',t0:KT.t,x1:p.x,y1:p.y,to,pose:p.pose,from:KT.pose,dir,pre:turn?.72:.14,puffed:false,landed:false};
  if(turn)catTurn(.72/PACE);
  KT.et=KT.t;KT.es=dir;
}
// a soft puff where it vanishes or appears (the celebration overlay; viewport coordinates)
function catPuff(x,y,big){
  const k=kk(),vx=x-scrollX,vy=y-scrollY;
  ring(vx,vy,(big?30:24)*k,'#C3C9D4',.42,2.2);
  burst(vx,vy,big?14:10,{dir:-Math.PI/2,spread:TAU,v0:60,v1:150,life:.45,lifeR:.25,g:.25,drag:3,colors:['#DDE1E8','#C9CFD9','#EEF0F4',CAT.fur],kinds:[['dot',1]]});
}
/* motion: every move eases in the way it eases out (a cubic in-out), anticipation before it goes, squash and stretch
   on the way, and the parts arrive one after another (head, then body, then tail; paws, then ears) */
const io=u=>u<.5?4*u*u*u:1-Math.pow(-2*u+2,3)/2;
const seg=(u,a,b)=>clamp((u-a)/(b-a),0,1);
const bell=u=>Math.sin(Math.PI*clamp(u,0,1));
// a critically damped follower: it starts as slowly as it stops (an exponential chase starts with a jump)
function follow(o,k,vk,to,w,dt){for(let n=Math.ceil(dt/.016),h=dt/n;n>0;n--){o[vk]+=(w*w*(to-o[k])-2*w*o[vk])*h;o[k]+=o[vk]*h;}}
// turning round: the head goes first, the body follows, the tail comes last; side-on it is narrow, never a sliver
function catTurn(d){const K=KT;if(K.pose==='peek')return;K.turn={t0:K.t,d:d||.85/PACE,from:K.fb,to:-K.face,landed:false};K.face=-K.face;K.tw=Math.max(K.tw,.6);}
function turnStep(){
  const K=KT,T=K.turn;if(!T){K.fh=K.fb=K.ft=K.face;return;}
  const u=clamp((K.t-T.t0)/T.d,0,1),f=(a,b)=>lerp(T.from,T.to,io(seg(u,a,b)));
  K.fh=f(.08,.5);K.fb=f(.22,.74);K.ft=f(.38,1);
  // a dip to gather, up onto its feet through the middle, and down again
  const dip=bell(seg(u,0,.26)),up=bell(seg(u,.2,.78));
  K.sx*=1+.06*dip-.04*up;K.sy*=1-.08*dip+.06*up;K.lift+=12*up;
  if(u>.74&&!T.landed){T.landed=true;K.sqv-=1.6;}
  if(u>=1)K.turn=null;
}
const OUT_PEEK=.62,IN_LOAF=.95,IN_PEEK=1.05;
// its moves run a little brisker than drawn (2026-11-04: "slightly more responsive"); the timings above are at PACE 1
const PACE=1.3;
function catWarp(){
  const K=KT,w=K.warp,e=(K.t-w.t0)*PACE,s=K.s*kk();
  if(w.ph==='out'){
    if(w.from==='peek'){
      // ducking behind the sheet: the paws let go first, the head rises a touch, then sinks out of sight
      K.pw1=1-io(seg(e,0,.22));K.pw2=1-io(seg(e,.07,.3));
      K.pk=1+.07*bell(seg(e,.1,.28))-io(seg(e,.24,OUT_PEEK));
      if(e>=OUT_PEEK)warpSwap(w,s);
      return;
    }
    // a look where it's going (and the turn, if it faced away), a crouch with a wiggle, then the spring up
    const e2=e-w.pre;if(e2<0)return;
    const c=io(seg(e2,0,.4))*(1-io(seg(e2,.4,.48))),l=seg(e2,.42,.74),str=bell(seg(e2,.4,.66));
    K.sx*=(1+.2*c)*(1-.22*str);K.sy*=(1-.32*c)*(1+.38*str);
    K.rot+=Math.sin(e2*TAU*4.2)*.04*bell(seg(e2,.12,.42))*-w.dir;
    K.lift+=110*l*(2-l);K.ox+=w.dir*40*io(l);
    const g=io(seg(e2,.58,.76));K.sx*=1-g;K.sy*=1-g*.9;
    if(e2>=.58&&!w.puffed){w.puffed=true;catPuff(K.x+K.ox*s,K.y-(K.lift+55)*s,false);}
    if(e2>=.76)warpSwap(w,s);
    return;
  }
  if(w.pose==='peek'){
    // up from behind the sheet: the head rises and settles, the ears pop up after it, then each paw lands on the edge
    K.pk=io(seg(e,.08,.5))+.06*bell(seg(e,.38,.66));
    K.pw1=io(seg(e,.46,.66));K.pw2=io(seg(e,.6,.82));
    if(e<.42){K.eo=.5;K.ev=0;}
    if(e>=IN_PEEK){K.warp=null;K.spot=w.to;K.arrived=K.t;K.nextAct=K.t+2.5+R()*3.5;}
    return;
  }
  // dropping in from the puff: small and tall as it falls, a squash on landing that springs back, the tail and ears catch up
  const f=seg(e,0,.32),gr=io(seg(e,0,.24));
  K.lift+=58*(1-f*f);K.ox-=w.dir*26*(1-f)*(1-f);K.sx*=(.3+.7*gr)*(1-.14*(1-f)*(f>0?1:0));K.sy*=(.3+.7*gr)*(1+.24*(1-f));
  if(f>=1&&!w.landed){w.landed=true;K.sqv-=4.2;K.tw=1;K.ev+=7;}
  if(e>=IN_LOAF){K.warp=null;K.spot=w.to;K.arrived=K.t;K.nextAct=K.t+2.5+R()*3.5;}
}
// the moment between: gone here, a puff there
function warpSwap(w,s){
  const K=KT;
  if(w.from==='peek')catPuff(K.x,K.y-10*s,false);
  K.x=w.x1;K.y=w.y1;K.pose=w.pose;w.ph='in';w.t0=K.t;
  if(w.from==='peek'&&w.pose!=='peek')K.face=w.dir;
  K.fh=K.fb=K.ft=K.face;K.turn=null;
  if(w.pose==='peek'){K.pk=0;K.pw1=K.pw2=0;catPuff(K.x,K.y-14*s,true);}
  else{K.pk=K.pw1=K.pw2=1;catPuff(K.x,K.y-(58+40)*s,true);}
  K.sx=K.sy=0;
}
const ACTS={yawn:1.9,groom:3.6,play:2.8,flick:1.1,stretch:2.6,hop:1.25/PACE,tap:1.4,turn:.9/PACE};
function catStep(dt0){
  const K=KT,still=rm(),dt=dt0*K.slow;K.t+=dt;
  if(K.t>K.res){K.res=K.t+.12*K.slow;catResolve();}
  K.sx=K.sy=1;K.lift=K.ox=K.rot=0;
  if(!still){turnStep();if(K.warp)catWarp();}
  if(!K.warp&&!K.turn){K.fh=K.fb=K.ft=K.face;}
  if(!K.warp){K.pk=1;K.pw1=K.pw2=1;}
  // a landing squash springs back; the ears flatten from a bump and spring up again; the tail swings and slows
  K.sqv+=(1-K.sq)*190*dt;K.sqv*=Math.exp(-dt*12);K.sq=clamp(K.sq+K.sqv*dt,.68,1.2);
  K.ev+=(-K.eo*240-K.ev*13)*dt;K.eo=clamp(K.eo+K.ev*dt,-.2,.6);
  K.tw*=Math.exp(-dt*2.2);
  // settling: the eyes go first, then the head comes down, then the tail curls in (and the same order waking up)
  const At0=moodTarget();let At=At0;
  if(At<.3&&K.A>.62&&!K.warp&&!still){if(!K.yawned&&!K.act){K.act={k:'yawn',t0:K.t,d:ACTS.yawn};K.lastAct='yawn';K.yawned=true;}if(K.act&&K.act.k==='yawn')At=K.A;}
  if(At0>.5)K.yawned=false;
  if(still){K.A=K.Ah=K.At=At;K.Av=K.Ahv=K.Atv=0;}
  else{follow(K,'A','Av',At,2.5,dt);follow(K,'Ah','Ahv',K.A,3.1,dt);follow(K,'At','Atv',K.Ah,2.2,dt);}
  if(still){K.blink=0;K.ear=0;K.eo=0;K.tw=0;return;}
  if(K.t>K.nb){K.bk=K.t;K.nb=K.t+2.6+R()*4.2;K.dbl=R()<.22;}
  const bu=(K.t-K.bk)/.16;K.blink=bu>=0&&bu<1?Math.sin(Math.PI*bu):(K.dbl&&bu>=1.5&&bu<2.5?Math.sin(Math.PI*(bu-1.5)):0);
  if(K.t>K.ne){K.et=K.t;K.ne=K.t+5+R()*9;K.es=R()<.5?-1:1;}
  const eu=(K.t-K.et)/.32;K.ear=eu>=0&&eu<1?Math.sin(Math.PI*eu)*(1-eu)*1.6:0;
  // one clear thing now and then, never the same twice running
  if(!K.warp&&!K.act&&!K.turn&&K.t>K.nextAct){
    const awake=K.A>.6,last=K.lastAct;
    let opts=K.pose==='peek'?(awake?['yawn','tap','tap']:[]):awake?['stretch','hop','yawn','groom','play','play','flick','turn']:['flick','stretch'];
    if(opts.length>1)opts=opts.filter(k=>k!==last);
    if(opts.length)catAct(pick(opts));
    K.nextAct=K.t+10+R()*15;
  }
  const a=K.act;
  if(a&&a.k==='hop'){
    // the hop round: down to gather, up (stretched as it leaves the ground), round in the air, a squash coming down
    const u=actU(),c=io(seg(u,0,.26))*(1-io(seg(u,.26,.34))),air=seg(u,.28,.72),str=bell(seg(u,.26,.44))+bell(seg(u,.6,.74))*.6;
    K.sx*=(1+.13*c)*(1-.12*str);K.sy*=(1-.2*c)*(1+.18*str);K.lift+=44*4*air*(1-air);
    if(u>.3&&!a.turned){a.turned=true;catTurn(.42*a.d);}
    if(u>.72&&!a.landed){a.landed=true;K.sqv-=3.4;K.tw=1;K.ev+=5;}
  }
  if(a&&a.k==='turn'&&!a.turned){a.turned=true;catTurn(a.d);}
  if(a&&K.t-a.t0>a.d)K.act=null;
}
function catAct(k){const K=KT;if(k==='turn'&&K.pose==='peek')return;K.act={k,t0:K.t,d:ACTS[k]||2};K.lastAct=k;}
const sm=u=>u*u*(3-2*u);
const actEnv=(k)=>{const a=KT.act;if(!a||a.k!==k)return 0;const u=(KT.t-a.t0)/a.d;return u<.2?sm(u/.2):u>.8?sm((1-u)/.2):1;};
const actU=()=>KT.act?(KT.t-KT.act.t0)/KT.act.d:0;
const catBusy=()=>KT.warp||KT.act||KT.turn||Math.abs(KT.Av)+Math.abs(KT.Ahv)+Math.abs(KT.Atv)>.004||Math.abs(KT.ev)>.05||Math.abs(KT.sqv)>.05||KT.tw>.03;

/* --- drawing (units; the surface it sits on is y=0) --- */
function catHead(c,S,t){
  const K=KT,A=S.A;
  const yawn=S.yawn,lick=S.lick;
  const earDroop=lerp(.42,0,A)+yawn*.22+K.eo;
  [[-25,-27,-.42-earDroop,K.es<0?K.ear:0],[23,-29,.36+earDroop,K.es>0?K.ear:0]].forEach(([x,y,rot,tw])=>{
    c.save();c.translate(x,y);c.rotate(rot+tw*.22*Math.sign(rot));
    c.fillStyle=CAT.fur;c.beginPath();c.moveTo(-15,7);c.quadraticCurveTo(-9,-12,-2.5,-24);c.quadraticCurveTo(0,-28.5,2.5,-24);c.quadraticCurveTo(9,-12,15,7);c.closePath();c.fill();
    c.fillStyle=CAT.inner;c.beginPath();c.moveTo(-8,4);c.quadraticCurveTo(-5,-8,-1.2,-16);c.quadraticCurveTo(0,-18,1.2,-16);c.quadraticCurveTo(5,-8,8,4);c.closePath();c.fill();
    c.restore();});
  const hg=c.createRadialGradient(-10,-16,4,-4,0,52);hg.addColorStop(0,CAT.top);hg.addColorStop(1,CAT.fur);
  c.fillStyle=hg;c.beginPath();c.moveTo(-46,3);c.bezierCurveTo(-47,-22,-25,-37,0,-37);c.bezierCurveTo(25,-37,47,-22,46,3);c.bezierCurveTo(45,25,23,34,0,34);c.bezierCurveTo(-23,34,-45,25,-46,3);c.closePath();c.fill();
  c.strokeStyle=CAT.dark;c.globalAlpha=.6;c.lineCap='round';
  [[-12,-34,-11,-26,2.6],[-3,-36,-3,-25,3],[6,-34,5,-26,2.6]].forEach(([a,b,d,e,w])=>{c.lineWidth=w;c.beginPath();c.moveTo(a,b);c.lineTo(d,e);c.stroke();});
  c.globalAlpha=1;
  c.fillStyle=CAT.light;[[-11,15],[3,15]].forEach(([x,y])=>{c.beginPath();c.ellipse(x,y+yawn*2,11.5,8.6+yawn*3,0,0,TAU);c.fill();});
  c.fillStyle=rgba(CAT.pink,.42);[[-33,12],[25,12]].forEach(([x,y])=>{c.beginPath();c.ellipse(x,y,7,4.2,0,0,TAU);c.fill();});
  // eyes: closed curves asleep, half-open drowsy, round and bright awake; squeezed shut in a yawn or a wash
  const open=clamp(A*1.25-.2,0,1)*(1-(K.blink||0));
  c.lineCap='round';c.strokeStyle=CAT.ink;c.lineWidth=2.4;
  [[-21,2],[13,2]].forEach(([x,y])=>{
    if(S.happy>.5||yawn>.35||lick>.4){c.beginPath();c.arc(x,y+3.5,6.2,Math.PI*1.15,Math.PI*1.85);c.stroke();return;}
    if(open<.14){c.beginPath();c.arc(x,y-3.2,6.4,Math.PI*.18,Math.PI*.82);c.stroke();return;}
    const ex=x+S.look[0],ey=y+S.look[1];
    c.fillStyle=CAT.ink;c.beginPath();c.ellipse(ex,ey,6.4,7.6*open,0,0,TAU);c.fill();
    if(open>.4){c.fillStyle='#fff';c.beginPath();c.arc(ex-2+S.look[0]*.3,ey-2.8*open,2.3,0,TAU);c.fill();c.globalAlpha=.8;c.beginPath();c.arc(ex+2.2,ey+2.6*open,1,0,TAU);c.fill();c.globalAlpha=1;}
  });
  c.fillStyle=CAT.pink;c.beginPath();c.moveTo(-7.4,9.2);c.quadraticCurveTo(-4,7.6,-.6,9.2);c.quadraticCurveTo(-1.4,12.4,-4,13);c.quadraticCurveTo(-6.6,12.4,-7.4,9.2);c.fill();
  if(yawn>.08){
    // the yawn: a small pink O under the nose, a curl of tongue
    c.fillStyle=CAT.mouth;c.beginPath();c.ellipse(-4,20+yawn*2,3.2+yawn*3.6,1+yawn*8.5,0,0,TAU);c.fill();
    c.fillStyle=CAT.pink;c.beginPath();c.ellipse(-4,24+yawn*5,2.6+yawn*2.4,1+yawn*2.6,0,0,TAU);c.fill();
  }else{
    c.strokeStyle=CAT.ink;c.globalAlpha=.75;c.lineWidth=1.6;c.beginPath();c.moveTo(-4,13);c.lineTo(-4,14.6);c.arc(-7.1,14.6,3.1,0,Math.PI*.95);c.moveTo(-4,14.6);c.arc(-.9,14.6,3.1,Math.PI,Math.PI*.05,true);c.stroke();c.globalAlpha=1;
    if(lick>.4&&Math.sin(S.lp*TAU*2.2)>0){c.fillStyle=CAT.pink;c.beginPath();c.ellipse(-4,19,2.6,3.4,0,0,TAU);c.fill();}
  }
  c.strokeStyle=CAT.ink;c.globalAlpha=.22;c.lineWidth=1;[[-31,10,-49,6],[-31,15,-48,17],[23,10,39,6],[23,15,38,17]].forEach(([a,b,d,e])=>{c.beginPath();c.moveTo(a,b);c.quadraticCurveTo((a+d)/2,(b+e)/2-1.5,d,e);c.stroke();});
  c.globalAlpha=1;
  // asleep: a little bubble breathes in and out of his nose
  if(S.bubble>0){
    const per=3.9,cyc=Math.floor(t/per),ph=(t/per)%1,big=cyc%4===3,inf=Math.pow((1-Math.cos(ph*TAU))/2,1.3),r=1.5+inf*(big?10:6.5);
    if(!(big&&ph>.5)){const bx=-9-r*.85,by=12+r*.35;
      c.globalAlpha=S.bubble;c.fillStyle='rgba(186,214,236,.32)';c.strokeStyle='rgba(118,156,196,.65)';c.lineWidth=1.1;
      c.beginPath();c.arc(bx,by,r,0,TAU);c.fill();c.stroke();
      c.strokeStyle='rgba(255,255,255,.9)';c.lineWidth=1.2;c.beginPath();c.arc(bx,by,r*.62,Math.PI*1.1,Math.PI*1.45);c.stroke();c.globalAlpha=1;}
  }
}
function paw(c,x,y,rot){c.save();c.translate(x,y);c.rotate(rot||0);c.fillStyle=CAT.light;c.beginPath();c.ellipse(0,0,11.5,7.2,0,0,TAU);c.fill();
  c.strokeStyle='rgba(45,49,57,.22)';c.lineWidth=1.1;[-3.5,3.5].forEach(d=>{c.beginPath();c.moveTo(d-1.5,5.5);c.lineTo(d-1.5,2.2);c.stroke();});c.restore();}
function heartAt(c,x,y,sz,a){c.globalAlpha=a;c.fillStyle=pal().plum;c.beginPath();c.moveTo(x,y+sz*.4);c.bezierCurveTo(x-sz*1.15,y-sz*.3,x-sz*.5,y-sz*1.1,x,y-sz*.42);c.bezierCurveTo(x+sz*.5,y-sz*1.1,x+sz*1.15,y-sz*.3,x,y+sz*.4);c.fill();c.globalAlpha=1;}
// the loaf: lying when asleep, head up and tail up when awake. Head, body and tail each face their own way, so a
// turn passes through side-on in stages (fb, fh, ft: -1 faces left, 1 faces right)
const wide=f=>-(Math.sign(f)||1)*(.34+.66*Math.abs(f));
function catLoaf(c,S,t){
  const K=KT,A=S.A,Ah=S.Ah,At=S.At,still=rm(),per=A>.6?2.9:3.9,br=still?0:Math.sin(t*TAU/per);
  const hu=(t-K.h0)/.5,hop=hu>0&&hu<1?Math.sin(Math.PI*hu)*9:0;
  // where each part sits follows the turn smoothly (-fb runs 1 → 0 → -1); its own drawing is mirrored at its widest
  const bX=-K.fb,bw=wide(K.fb),hw=-(Math.sign(K.fh)||1)*(.86+.14*Math.abs(K.fh)),tw=wide(K.ft),m=Math.sign(bw);
  // the stretch: front paws out, chest down, the back end up and long
  const st=actEnv('stretch')*(still?0:1);
  c.save();c.translate(0,-hop);c.scale(1+.2*st,1-.16*st);c.rotate(.1*st*m);
  const ta=clamp((At-.6)/.4,0,1),fl=actEnv('flick');
  const sway=still?0:Math.sin(t*1.15)*(4+10*ta)+fl*Math.sin((t-(K.act?K.act.t0:0))*14)*12;
  // the tail lags: after a landing or a turn it swings on and slows down
  const lag=still?0:K.tw*Math.sin(t*8.5);
  const wrap=[82,-13,116,-6,104,6,44,0],up=[82,-26,124,-36,128,-86,110+sway+lag*22,-108+Math.abs(lag)*10];
  const tp=wrap.map((v,i)=>lerp(v,up[i],ta));if(ta<.5&&!still){tp[6]+=Math.sin(t*.9)*2.2+fl*Math.sin(t*16)*5+lag*10;tp[7]+=Math.sin(t*.9+1)*1.2;}
  const drawTail=()=>{c.save();c.translate(82*bX,0);c.scale(tw,1);c.translate(-82,0);
    c.fillStyle=CAT.fur;taper(c,tp,15,10.5,0);
    const u=.78,L2=(a,b)=>[lerp(a[0],b[0],u),lerp(a[1],b[1],u)],p0=[tp[0],tp[1]],p1=[tp[2],tp[3]],p2=[tp[4],tp[5]],p3=[tp[6],tp[7]];
    const a=L2(p0,p1),b=L2(p1,p2),d=L2(p2,p3),e=L2(a,b),f=L2(b,d),mm=L2(e,f);
    c.fillStyle=CAT.dark;c.globalAlpha=.2+.5*ta;taper(c,[mm[0],mm[1],f[0],f[1],d[0],d[1],p3[0],p3[1]],lerp(15,10.5,u)+.4,10.9,0);c.globalAlpha=1;c.restore();};
  if(ta>=.5)drawTail();
  c.save();c.scale(bw,1);c.scale(1-br*.006,1+br*.022);
  const bg=c.createLinearGradient(0,-86,0,0);bg.addColorStop(0,CAT.top);bg.addColorStop(.55,CAT.fur);bg.addColorStop(1,CAT.low);
  c.fillStyle=bg;c.beginPath();c.moveTo(-62,0);c.bezierCurveTo(-88,0,-92,-46,-66,-63);c.bezierCurveTo(-40,-84,32,-88,66,-66);c.bezierCurveTo(92,-52,98,-10,78,0);c.closePath();c.fill();
  c.strokeStyle=CAT.dark;c.globalAlpha=.28;c.lineCap='round';c.lineWidth=4.5;
  [[10,-80,4,-62],[30,-78,25,-60],[50,-72,47,-56]].forEach(([a,b,d,e])=>{c.beginPath();c.moveTo(a,b);c.quadraticCurveTo(a+5,(b+e)/2,d,e);c.stroke();});
  c.globalAlpha=1;c.restore();
  if(ta<.5)drawTail();
  // the head, and what the front paws are up to (worked out facing left, then placed by the body's turn)
  const g=S.lick,pl=actEnv('play'),pounce=pl>0?Math.max(0,Math.sin(actU()*TAU*2.2))*pl:0;
  const hx=lerp(-52,-48,Ah)-g*4,hy=lerp(-60,-82,Ah)+(still?0:br*.8)-S.yawn*3+g*3,tilt=lerp(-.14,0,Ah)+(still?0:Math.sin(t*.5)*.025*Ah)+g*.16-S.yawn*.06+pl*-.1;
  const pu=actU(),swipe=pl*Math.max(0,Math.sin(pu*TAU*2.2));
  const p0=[lerp(-60,-104,swipe),lerp(-4,-58,swipe)];
  if(pounce>.01)c.translate(-8*pounce*m,-6*pounce);
  if(g>.01){p0[0]=lerp(-60,hx+8,g);p0[1]=lerp(-4,hy+30,g)+Math.sin(S.lp*TAU*2.2)*3.5*g;}
  paw(c,-35*bX,-2,0);
  if(g<=.01&&swipe<=.01)paw(c,-60*bX,-4,0);
  c.save();c.translate(hx*bX,hy);c.scale(hw,1);c.rotate(tilt);catHead(c,S,t);c.restore();
  if(g>.01||swipe>.01){c.save();c.scale(m,1);c.fillStyle=CAT.fur;taper(c,[-50,-34,(p0[0]-50)/2-6,(p0[1]-34)/2,p0[0],p0[1]],16,12,0);paw(c,p0[0],p0[1],-g*.9-swipe*.6);c.restore();}
  // the leaf it bats at
  if(pl>0){const ly=lerp(-120,-6,clamp(pu*1.05,0,1)),lx=(-104+Math.sin(pu*9)*8)*m;c.save();c.translate(lx,ly);c.rotate(pu*6);piece(c,{k:'leaf',col:'#E8703A'},16);c.restore();}
  const hu2=(t-K.heart)/1.5;
  if(hu2>0&&hu2<1&&!still)heartAt(c,(hx+28)*bX+Math.sin(hu2*5)*4,hy-50-hu2*34,6+hu2*2,Math.sin(Math.PI*hu2)*.9);
  c.restore();
}
// peeking over the top of the sheet: the head and two paws; the rest is behind the paper
function catPeek(c,S,t){
  const K=KT,dy=(1-K.pk)*95;
  c.save();c.beginPath();c.rect(-160,-200,320,202);c.clip();c.translate(0,dy);
  c.scale(1.18,1.18);
  c.save();c.translate(-2,-38);c.rotate(Math.sin(t*.5)*.03);catHead(c,S,t);c.restore();
  const tp=actEnv('tap'),tu=actU(),tap=tp>0?Math.max(0,Math.sin(tu*TAU*2))*tp:0;
  // each paw comes up from behind the edge, a little over it, and lands
  const py=v=>-3+(1-v)*34-(v<1?14*bell(v):0);
  c.translate(0,-dy/1.18);paw(c,-24,py(K.pw1),.1);paw(c,20,py(K.pw2)-tap*16,-.1-tap*.3);c.translate(0,dy/1.18);
  const hu2=(t-KT.heart)/1.5;
  if(hu2>0&&hu2<1&&!rm())heartAt(c,30+Math.sin(hu2*5)*4,-88-hu2*30,6+hu2*2,Math.sin(Math.PI*hu2)*.9);
  c.restore();
}
function catDraw(){
  const K=KT,c=K.c;if(!c||!K.shown)return;
  const k=kk(),s=K.s*k,W=K.W,H=K.H;
  c.setTransform(K.dpr,0,0,K.dpr,0,0);c.clearRect(0,0,W,H);
  const S={A:K.A,happy:0,yawn:Math.max(actEnv('yawn'),actEnv('stretch')*clamp((actU()-.25)*3,0,1)*clamp((.9-actU())*4,0,1)),lick:actEnv('groom'),lp:actU()*3.6,bubble:rm()?0:clamp(1-K.A*2.2,0,1),look:[0,0]};
  S.happy=K.t<K.hu?clamp((K.hu-K.t)/.25,0,1)*clamp((K.t-(K.hu-1.8))/.15,0,1):0;
  // the eyes follow the pointer when it's awake (the caret's spot, near enough, while he writes)
  if(K.A>.3&&!K.warp){const hx=K.x-scrollX+(K.pose==='peek'?0:-50*s),hy=K.y-scrollY-(K.pose==='peek'?40:80)*s,px=K.ptr.x-hx,py=K.ptr.y-hy,dd=Math.hypot(px,py);
    if(dd>1&&dd<1600){const m=Math.min(1,dd/240)*1.8;S.look=[px/dd*m,py/dd*m*.8];}}
  if(K.act&&K.act.k==='play')S.look=[-1.6,-.4+actU()*1.6];
  // before it goes, it looks where it's going
  if(K.warp&&K.warp.ph==='out'&&K.warp.from!=='peek')S.look=[K.warp.dir*1.9,-.3];
  if(K.pose!=='peek')S.look[0]*=-(Math.sign(K.fh)||1);
  S.Ah=K.Ah;S.At=K.At;
  K.el.style.transform=`translate(${Math.round(K.x-W/2)}px,${Math.round(K.y-H+6*k)}px)`;
  c.save();c.translate(W/2,H-6*k);c.scale(s,s);
  if(K.pose!=='peek'&&K.sx>.01){
    // its shadow stays on the ground: smaller while it's up in the air, gone with it into the puff
    const f=Math.max(.35,1-K.lift/110)*Math.min(1,K.sx*1.1),sg=c.createRadialGradient(0,0,0,0,0,108);
    sg.addColorStop(0,'rgba(21,23,28,.12)');sg.addColorStop(1,'rgba(21,23,28,0)');
    c.save();c.translate(12*-K.fb+K.ox*.6,2);c.scale(f,.075*f);c.fillStyle=sg;c.fillRect(-108,-108,216,216);c.restore();}
  c.translate(K.ox,-K.lift);c.rotate(K.rot);
  const sq=rm()?1:K.sq;c.scale((1+(1-sq)*.55)*K.sx,sq*K.sy);
  if(K.sx<.01||K.sy<.01)c.scale(0,0);
  if(K.pose==='peek')catPeek(c,S,K.t);
  else catLoaf(c,S,K.t);
  c.restore();
}
function catSize(){
  const k=kk(),W=Math.round(170*k),H=Math.round(150*k),d=Math.min(2,devicePixelRatio||1);
  if(W!==KT.W||H!==KT.H||d!==KT.dpr){KT.W=W;KT.H=H;KT.dpr=d;KT.cv.width=W*d;KT.cv.height=H*d;KT.cv.style.width=W+'px';KT.cv.style.height=H+'px';}
}
const catActive=()=>!document.hidden&&VIEW==='today'&&KT.shown;
function catCheer(){const t=KT.t;KT.hu=t+1.8;KT.h0=t+.15;KT.heart=t+.3;KT.wake=t;}
// a click on the cat (it never takes the click: anything under it still gets it) earns a purr
function catPet(e){
  if(VIEW!=='today'||!KT.shown||KT.warp||document.documentElement.classList.contains('cd-on'))return;
  if(e.target.closest&&e.target.closest('button,a,input,textarea,select,label,[contenteditable],[role="button"],[role="tab"],[data-tip]'))return;
  const s=KT.s*kk(),x=(e.pageX-KT.x)/s,y=(e.pageY-KT.y)/s;
  const hit=KT.pose==='peek'?(x>-52&&x<50&&y>-112&&y<4):(x>-100&&x<100&&y>-150&&y<8);
  if(!hit)return;
  if(KT.A<.3){KT.wake=KT.t;KT.et=KT.t;KT.es=-KT.es;}else{KT.hu=KT.t+1.2;KT.heart=KT.t;}
  const now=performance.now();if(now-KT.purrAt>2600){KT.purrAt=now;sfx('purr');}
  kick();
}
function catMount(){
  KT.el=document.createElement('div');KT.el.className='fun-cat';KT.el.setAttribute('aria-hidden','true');KT.el.hidden=true;
  KT.cv=document.createElement('canvas');KT.el.appendChild(KT.cv);KT.c=KT.cv.getContext('2d');document.body.appendChild(KT.el);
  // while the board is still arriving (the test, the essays), the cat is simply where it belongs: no pops around the page
  KT.boot=performance.now()+2500;
  catSize();
  addEventListener('pointermove',e=>{KT.ptr.x=e.clientX;KT.ptr.y=e.clientY;},{passive:true});
  document.addEventListener('pointerdown',catPet,{passive:true});
  document.addEventListener('input',e=>{if(e.target&&e.target.closest&&e.target.closest('#write')){KT.typed=performance.now();if(KT.spot!=='write')catResolve();kick();}},true);
  ['focusin','focusout'].forEach(ev=>document.addEventListener(ev,()=>setTimeout(()=>{catResolve();kick();},30)));
  addEventListener('resize',()=>{catSize();catResolve('snap');kick();});
  catResolve();
}

/* ---------- one loop for every living thing; it sleeps when nothing on screen moves ---------- */
const LOOP={raf:0,last:0};
function kick(){
  const want=!rm()&&(cpActive()||catActive()||pfActive());
  if(want){if(!LOOP.raf){LOOP.last=performance.now();LOOP.raf=requestAnimationFrame(tick);}}
  else{if(LOOP.raf){cancelAnimationFrame(LOOP.raf);LOOP.raf=0;}cpDraw(0);if(KT.c){catResolve();KT.A=KT.Ah=KT.At=moodTarget();catDraw();}}
}
function tick(now){
  LOOP.raf=requestAnimationFrame(tick);
  const busy=catBusy()||CP.pop||CP.gust>.05||CP.gw>.05||CP.past.some(p=>p.g>.015||p.w>.015)||KT.t<KT.hu+1.5||pfActive();
  const dt=(now-LOOP.last)/1000;if(dt<(busy?1/70:1/31))return;
  LOOP.last=now;const d=Math.min(dt,.1);
  if(cpActive()){CP.t+=d;cpDraw(d);}
  if(KT.c&&VIEW==='today'&&!document.hidden){catStep(d);catDraw();}
  if(pfActive())pfTick(d);
  if(!cpActive()&&!catActive()&&!pfActive()){cancelAnimationFrame(LOOP.raf);LOOP.raf=0;}
}

/* ---------- wiring ---------- */
const refresh=()=>{cpData();cpDraw(0);pfAll();catResolve();kick();};
BUS.on('essays',refresh);BUS.on('items',refresh);BUS.on('data',refresh);BUS.on('test',()=>setTimeout(()=>{catResolve();kick();},80));
BUS.on('view',v=>{if(v==='progress')pfAll();if(v==='today')setTimeout(()=>{cpSize();catResolve('snap');kick();},30);else{catResolve();kick();}});
BUS.on('lab',id=>{if(id==='cat'){catResolve();kick();}if(id==='board-k'){cpSize();catSize();catResolve('snap');}});
document.addEventListener('visibilitychange',kick);
try{matchMedia('(prefers-reduced-motion:reduce)').addEventListener('change',()=>{catResolve('snap');kick();});}catch(e){}
function mount(){cpMount();catMount();kick();}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount);else mount();

// the time machine (preview.js) drives the cat: FUN.cat({spot:'home'|'quiz'|'write'|null, mood:'asleep'|'drowsy'|'awake'|null, act:'yawn'|'groom'|'play'|'flick'|'stretch'|'hop'|'turn'|'tap', slow:true|false})
function catCmd(o){
  o=o||{};
  if('spot' in o)KT.ov.spot=o.spot||null;
  if('mood' in o)KT.ov.mood=o.mood||null;
  if(o.act&&!rm()&&!KT.warp&&!KT.turn)catAct(o.act);
  if('slow' in o)KT.slow=o.slow?.25:1;
  if(o.cheer)catCheer();
  catResolve();kick();
}
// tests read how much each tree is stirring
const stir=()=>({front:CP.gust,past:CP.past.map(p=>p.g),year:[...PF].map(M=>M.slots.map(s=>s.g))});
window.FUN={celebrate,weekDays,forest,cat:catCmd,species:SPECIES,stir};
})();
