/* ---------- the test (board/test). Owner: today agent
   The one boxed thing on Today: a gold-edged card with no name, the gold band on top. Pips, the prompt, his dictated
   answer; the model answer right after he answers, then Next; at the end the results as dots.
   Cancel = leaving the answer box (no button): the unsent attempt goes (its text, the clock), nothing saved is touched,
   and coming back starts that question's clock afresh. The answer box is contenteditable, not a textarea: Chinese
   Brain's hover reads text nodes, which a textarea doesn't have (the same reason as the writing sheet).
   Done after the last answer: the results flash as dots, then the card folds away and Today closes up under it. ---------- */
let TEST=null, DBH=null, SAMPLE, writes=0, chain=Promise.resolve();
const Q={view:null,t0:null,grading:{},heardShown:{}};
const RES={pass:'Clean',partial:'Partial',fail:'Missed',none:'No evidence'};
const testOpen=()=>TEST&&Array.isArray(TEST.items)&&TEST.items.length&&!TEST.filed;
function steps(){
  const out=[];
  if(!TEST) return out;
  const items=TEST.items||[];
  items.forEach((it,n)=>out.push({id:n+'',it,a:it,retry:false}));
  // a second try waits after the question its `after` names (a random later one, picked when it's made), so it never
  // follows its own question and gives it away; older ones without it sit right after their question
  items.forEach((it,n)=>{
    if(!it.retry) return;
    const at=Math.min(items.length-1,Math.max(n,Number.isInteger(it.retry.after)?it.retry.after:n));
    const k=out.findIndex(x=>!x.retry&&+x.id>at);
    out.splice(k<0?out.length:k,0,{id:n+'r',it,a:it.retry,retry:true});
  });
  return out;
}
// one pip per step: now (gold), still to do (ring), being checked (pulsing), or its result by color and shape
function glyph(s,cur){
  if(s===cur) return 'qp c';
  if(!s.a.answer) return 'qp o';
  if(Q.grading[s.id]) return 'qp g';
  return {pass:'qp s',fail:'qp f',partial:'qp p'}[s.a.result]||'qp n';
}
function save(){
  if(!DBH||!TEST) return;
  const data={items:TEST.items,done:TEST.done||null};
  writes++;
  chain=chain.then(()=>DBH.doc('board/test').update(data)).catch(e=>console.error(e)).finally(()=>{writes--;});
}
async function sampler(){
  if(SAMPLE!==undefined) return SAMPLE;
  try{SAMPLE=await window.claude?.use?.('sample')||null;}catch(e){SAMPLE=null;}
  return SAMPLE;
}
function gradePrompt(s){
  const it=s.it, a=s.a;
  return `You grade one answer in Chris's Taiwan Mandarin speaking test. He is high A2 and answers by voice through speech-to-text.
Reply with only this JSON: {"result": "pass" | "partial" | "fail" | "none", "natural": string, "why": string, "followup": string}

Grade the target only: ${it.target}
What the answer must show: ${it.check}
A model answer: ${it.model}

- Ignore the characters the transcriber picked (在/再, 的/得, 他/她) and punctuation; grade words, word order and completeness.
- A slip that turns what he clearly meant into other characters: grade what he meant, and start why with "Likely meant …". Read the answer aloud in your head: sound-alikes can hide the target itself (回答 huídá for 會打 huì dǎ hides 打赤腳 in 您也回答赤腳走嗎).
- pass: the target is used correctly and every part of the ask is answered.
- partial: the target is right but part of the ask is missing, or the target is only half right.
- fail: the target is wrong, or missing where the situation required it (a dropped half, a question instead of the statement asked for, English in its place).
- none: no evidence either way: a synonym or paraphrase in place of the target, or a use where he couldn't have gone wrong.${it.hear?`
- This is a listening item: pass means his reply shows he understood "${it.target}" in the line he heard. Repeating the word back from that line without showing what it means is none, not partial.`:''}${it.read?`
- This is a reading item: pass means his reply shows he understood "${it.target}" in the line he read; an answer that skips it or gets it wrong is a fail, not none.`:''}

The three text fields:
- natural: ${/english/i.test((s.retry?s.a.ask:it.ask)||'')?'the situation asks for English, so natural is a good plain-English version of what the line says. English only, not Chinese.':'how a Taiwanese friend would say what he meant, in one short line: Traditional characters, Taiwan usage, Chinese punctuation (，。？！ never , . ? !). Keep his tone: casual stays casual, polite stays polite. Use words people really say every day and keep to his level; a new word only where it is clearly the natural choice.'}
- why: one or two short, friendly, plain-English lines about the target: what to change and the frame to use (兩碗 + noun), never a grammar rule, never blaming. Say the point straight; no label or title before it. Empty for a clean pass.
- followup: ${s.retry?'always ""':'only when result is none: a new everyday situation in English where the target is the only natural answer, never naming the target or a synonym of it. Otherwise ""'}.

The situation: ${s.retry?s.a.ask:it.ask||''}${it.overlay&&!s.retry?`
The text in front of him (real text, the part to read): ${overlayText(it)}`:''}${it.img&&!s.retry?`
${s.photo?'The attached photo is exactly what he is looking at: grade anything he describes against it.':'He is looking at a photo: '+(it.alt||'')}`:''}${it.hear?`
The line he heard: ${it.hear}`:''}${it.read&&!s.retry?`
The line he read: ${it.read}`:''}
His answer: ${a.answer}

Before you reply, check: natural is in the language the situation asks for; Chinese text has only Chinese punctuation; why is short, kind and starts with the point. Reply with the JSON only.`;
}
async function grade(s){
  const sm=await sampler();
  if(!sm){renderQuiz();return;}
  Q.grading[s.id]=true; renderQuiz();
  try{
    const opts={modelTier:'default'};
    // a photo item: Claude sees the same photo, where this view can send images
    if(s.it.img&&!s.retry){try{const lim=await sm.limits();if(lim&&lim.images){const r=await fetch(s.it.img);if(r.ok){opts.images=[await r.blob()];s.photo=true;}}}catch(e){}}
    const out=await sm.json(gradePrompt(s),opts);
    const r=String(out&&out.result||'').toLowerCase();
    if(RES[r]){
      s.a.result=r; s.a.natural=String(out.natural||''); s.a.why=String(out.why||'');
      sfx(r==='none'?'tap':r);
      if(r==='none'&&!s.retry&&out.followup&&!s.it.retry){
        const L=TEST.items.length, n=+s.id, nx=TEST.items.findIndex((x,i)=>i>n&&!x.answer);
        const after=nx<0?L-1:nx+Math.floor(Math.random()*(L-nx));
        s.it.retry={ask:String(out.followup),after,answer:null,secs:null,result:null,natural:null,why:null};
      }
      if(steps().every(x=>x.a.answer)) TEST.done=TEST.done||K(today()); else TEST.done=null;
      save();
    }
  }catch(e){
    if(e&&e.code==='not_granted') SAMPLE=null;
    s.a.later=true;
  }finally{delete Q.grading[s.id];renderQuiz();}
}
let PLAYER=null;
// the Azure recording when the item has one; the browser's voice if it is missing or will not play
// onEnd runs once it has finished playing
async function play(it,rate,onEnd){
  try{PLAYER&&PLAYER.pause();speechSynthesis.cancel();}catch(e){}
  if(it.audio){
    try{PLAYER=new Audio(it.audio);PLAYER.playbackRate=rate;PLAYER.onended=onEnd;await PLAYER.play();return true;}catch(e){console.error(e);}
  }
  return speak(it.hear,rate,onEnd);
}
function speak(text,rate=1,onEnd){
  try{
    if(!('speechSynthesis' in window)) return false;
    const u=new SpeechSynthesisUtterance(text), vs=speechSynthesis.getVoices();
    const v=vs.find(v=>/zh[-_]TW/i.test(v.lang))||vs.find(v=>/^zh/i.test(v.lang)&&!/HK|yue/i.test(v.lang));
    if(v){u.voice=v;u.lang=v.lang;}else u.lang='zh-TW';
    u.rate=rate; if(onEnd) u.onend=onEnd; speechSynthesis.cancel(); speechSynthesis.speak(u); return true;
  }catch(e){return false;}
}
const SPEAKER='<svg width="16" height="16" viewBox="0 0 14 14" aria-hidden="true"><path d="M2 5h2.5L8 2.2v9.6L4.5 9H2z" fill="currentColor"/><path d="M10 4.5a3.2 3.2 0 0 1 0 5M11.6 3a5.4 5.4 0 0 1 0 8" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>';
// a monthly-test scene: the photo, and any real text laid over it (or a newspaper on its own)
function sceneHTML(it){
  const o=it.overlay||null;
  const txt=o?`${o.title?`<b>${esc(o.title)}</b>`:''}${esc(o.text||'')}${o.sig?`\n${esc(o.sig)}`:''}`:'';
  if(o&&o.kind==='paper') return `<div class="qpaper" lang="zh-Hant">${o.mast?`<small>${esc(o.mast)}</small>`:''}<b>${esc(o.title||'')}</b>${o.text?`<span>${esc(o.text)}</span>`:''}</div>`;
  if(!it.img) return '';
  return `<div class="qscene"><img src="${esc(it.img)}" alt="${esc(it.alt||'')}">${o?`<div class="${o.kind==='menu'?'qmenu':'qnotice'}" lang="zh-Hant">${txt}</div>`:''}</div>`;
}
const overlayText=it=>it.overlay?[it.overlay.title,it.overlay.text,it.overlay.sig].filter(Boolean).join(' '):'';
const CHEV='<svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M2.5 4.5 6 8l3.5-3.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
// mostly Chinese: at least 60% of the non-space characters
const QZ_zh=s=>{const t=String(s||'').replace(/\s/g,'');return t.length&&(t.match(/[㐀-鿿]/g)||[]).length/t.length>=.6;};
// the natural version with what differs from his answer underlined; only when both are Chinese and still close
// (an English gloss, or a different sentence altogether, is just shown)
function QZ_nat(you,nat){
  if(!QZ_zh(you)||!QZ_zh(nat)) return zh(nat);
  const segs=diffSegs(you,nat), n=[...nat].length, kept=segs.filter(x=>!x[1]).reduce((m,x)=>m+[...x[0]].length,0);
  if(kept/n<.5) return zh(nat);
  return segs.map(([s,ch])=>ch?`<u>${zh(s)}</u>`:zh(s)).join('');
}
function verdictHTML(s){
  const a=s.a, it=s.it;
  // the dot says pass / partial / missed / checking; words only where a dot can't (no evidence, graded later)
  const st=Q.grading[s.id]?['wait','qp g','Checking','']
    :a.result?[a.result,glyph(s,null),RES[a.result],a.result==='none'?'No evidence':'']
    :['later','qp n','Graded later','Graded in your next session'];
  const nat=a.natural||it.model;
  return `<div class="q-verdict" aria-live="polite">
    <p class="q-res ${st[0]}"><i class="${st[1]}" role="img" aria-label="${st[2]}"></i>${st[3]?`<span>${st[3]}</span>`:''}</p>
    <p class="q-nat">${QZ_nat(a.answer,nat)}</p>
    <p class="q-you q-mine"><span class="q-k">You</span><span>${zh(a.answer)}</span></p>
    ${it.hear&&!s.retry?`<p class="q-you"><span class="q-k">Heard</span><span>${zh(it.hear)}</span></p>`:''}
    ${it.read&&!s.retry?`<p class="q-you"><span class="q-k">Read</span><span>${zh(it.read)}</span></p>`:''}
    ${a.why?`<p class="q-why">${zh(a.why)}</p>`:''}</div>`;
}
// the unsent attempt goes: the text, the clock (the next focus, Listen or keystroke starts a fresh one)
function QZ_cancel(ta,btn,clock){
  clearTimeout(Q.timer); clearTimeout(Q.heard); Q.t0=null;
  setText(ta,''); btn.disabled=true;
  clock.classList.remove('run','late'); clock.querySelector('i').style.animationDelay='';
}
// one pip per step, the same markup everywhere
const QZ_pips=(S,on)=>S.map(s=>`<i class="${glyph(s,on)}"></i>`).join('');
function renderQuiz(){
  const el=document.getElementById('quiz');
  dots();
  if(!testOpen()){clearTimeout(Q.timer);clearTimeout(Q.heard);el.classList.remove('q-fin');el.hidden=true;el.innerHTML='';return;}
  el.hidden=false;
  const S=steps(), cur=S.find(s=>!s.a.answer);
  const view=Q.view!=null?S.find(s=>s.id===Q.view):null;
  // he is already typing in this very question (a grade or a save echo landed while he writes): only the pips change,
  // so the box keeps its text, focus and caret, and the clock keeps running
  if(!view&&cur){
    const key=cur.id+'|'+(cur.retry?cur.a.ask:cur.it.ask)+'|'+(cur.it.read||'')+'|'+(cur.it.hear||'');
    const box=document.getElementById('q-ans-'+cur.id), pips=el.querySelector('.q-pips');
    if(box&&pips&&el.contains(box)&&el.dataset.qkey===key){
      pips.innerHTML=QZ_pips(S,cur);
      pips.setAttribute('aria-label',`${S.filter(s=>s.a.answer).length} of ${S.length} answered`);
      return;
    }
    el.dataset.qkey=key;
  } else delete el.dataset.qkey;
  clearTimeout(Q.timer); clearTimeout(Q.heard);
  if(view||cur) el.classList.remove('q-fin');
  const top=lab=>`<div class="q-top"><span class="q-pips" role="img" aria-label="${S.filter(s=>s.a.answer).length} of ${S.length} answered">${QZ_pips(S,view?null:cur)}</span>${lab?`<span class="q-lab">${esc(lab)}</span>`:''}</div>`;
  if(view){
    // just answered: the model answer now, the grade when it lands
    const last=!S.find(s=>!s.a.answer);
    el.innerHTML=top(view.retry?'One more try':'')+`<div class="q-body">${verdictHTML(view)}
      <div class="q-row"><button class="btn" id="q-next" type="button">${last?'Done':'Next'}</button></div></div>`;
    document.getElementById('q-next').onclick=()=>{sfx('tap');Q.view=null;Q.t0=null;Q.auto=!last;Q.sum=false;Q.fin=last;renderQuiz();};
    return;
  }
  if(cur){
    const curId=cur.id, it=cur.it, hear=it.hear&&!cur.retry, ask=cur.retry?cur.a.ask:it.ask;
    el.innerHTML=top(cur.retry?'One more try':'')+`<div class="q-body">
      ${!cur.retry?sceneHTML(it):''}
      ${ask?`<p class="q-ask">${zh(ask)}</p>`:''}
      ${it.read&&!cur.retry?`<p class="q-read" lang="zh-Hant">${esc(it.read)}</p>`:''}
      ${hear?`<div class="q-row"><button class="btn-q q-listen" id="q-listen" type="button">${SPEAKER}Listen</button>${it.audio?'<button class="btn-q q-listen" id="q-slow" type="button">0.8×</button>':''}<span class="q-heard" id="q-heard" hidden></span></div>`:''}
      <div class="q-ans"><div class="q-in" id="q-ans-${cur.id}" role="textbox" aria-multiline="true" data-ph="Dictate your answer" aria-label="Your answer" lang="zh-Hant" spellcheck="false"></div>
      <div class="q-clock" id="q-clock"><i></i></div></div>
      <div class="q-row"><button class="btn" id="q-check" type="button" disabled>Check</button></div></div>`;
    const ta=editable(document.getElementById('q-ans-'+cur.id)), btn=document.getElementById('q-check'), clock=document.getElementById('q-clock');
    if(it.secs&&!cur.retry) clock.querySelector('i').style.animationDuration=(+it.secs)+'s';
    // t0 may sit in the future: the reading allowance comes first, then the 20 s clock runs
    const arm=()=>{const e=(Date.now()-Q.t0)/1000;clearTimeout(Q.timer);
      if(e>=0){clock.querySelector('i').style.animationDelay=-e+'s';clock.classList.add('run');}
      else Q.timer=setTimeout(()=>clock.classList.add('run'),-e*1000);};
    const start=()=>{if(!Q.t0){Q.t0=Date.now();arm();}};
    clock.querySelector('i').addEventListener('animationend',()=>clock.classList.add('late'));
    if(hear){
      // the clock starts once he has heard it all (or begins answering), not when he presses Listen;
      // in case the browser never says it finished, it starts on its own after a generous wait
      const say=async r=>{
        clearTimeout(Q.heard);
        if(await play(it,r,()=>{clearTimeout(Q.heard);start();})){if(!Q.t0)Q.heard=setTimeout(start,20000);return;}
        const h=document.getElementById('q-heard');h.hidden=false;h.innerHTML=zh(it.hear);
        if(!Q.t0){Q.t0=Date.now()+Math.min(25000,Math.max(3000,2500+(it.hear.match(/[㐀-鿿]/g)||[]).length*400));arm();}
      };
      document.getElementById('q-listen').onclick=()=>say(1);
      const slow=document.getElementById('q-slow'); if(slow) slow.onclick=()=>say(0.8);
    } else {
      // the clock starts when he presses the box (or Next puts him in it): reading allowance first, then 20 s
      ta.addEventListener('focus',()=>{
        if(Q.t0) return;
        const tx=(ask||'')+(it.read&&!cur.retry?it.read:'')+(!cur.retry?overlayText(it):''), zn=(tx.match(/[㐀-鿿]/g)||[]).length,
          wn=tx.replace(/[^\x00-\x7f]/g,' ').split(/\s+/).filter(Boolean).length;
        Q.t0=Date.now()+Math.min(25000,Math.max(3000,2500+wn*280+zn*400+(it.img&&!cur.retry?4000:0)));
        arm();
      });
    }
    if(Q.t0) arm();
    ta.addEventListener('input',()=>{const v=getText(ta);if(!v&&ta.innerHTML)ta.innerHTML='';btn.disabled=!v.trim();start();});
    btn.onclick=()=>{
      const v=getText(ta).trim(); if(!v) return;
      // the box can outlive a re-render (a grade or a save echo only touches the pips): read the step fresh
      const cur=steps().find(x=>x.id===curId); if(!cur) return;
      cur.a.answer=v; cur.a.secs=Q.t0?Math.max(1,Math.round((Date.now()-Q.t0)/1000)):null; cur.a.at=K(today());
      const all=steps().every(x=>x.a.answer);
      if(all) TEST.done=K(today());
      sfx('tap'); save(); Q.view=cur.id; renderQuiz(); grade(cur);
      // the last answer is in: a moment, once per test
      if(all&&once('test:'+TEST.id)) celebrate('test');
    };
    // cancel: leaving the box drops the unsent attempt. Pressing Check or Listen keeps the focus in the box (so it isn't
    // leaving), focus moving within the card isn't either, nor is switching to another window (he comes back to the box).
    const keep=b=>b&&b.addEventListener('pointerdown',e=>{if(document.activeElement===ta)e.preventDefault();});
    keep(btn); keep(document.getElementById('q-listen')); keep(document.getElementById('q-slow'));
    ta.addEventListener('blur',()=>setTimeout(()=>{
      if(!ta.isConnected||!document.hasFocus()||el.contains(document.activeElement)) return;
      const s=steps().find(x=>x.id===curId); if(!s||s.a.answer) return;
      QZ_cancel(ta,btn,clock);
    },0));
    if(Q.auto&&!hear){Q.auto=false;ta.focus({preventScroll:true});}
    return;
  }
  // all answered: Done flashes the results as dots, then the card folds away; a refresh or a later visit never shows it
  if(!Q.fin){el.hidden=true;el.innerHTML='';el.classList.remove('q-fin');return;}
  if(el.classList.contains('q-fin')) return;
  el.classList.add('q-fin');
  const graded=S.filter(s=>s.a.result&&s.a.result!=='none');
  const clean=graded.filter(s=>s.a.result==='pass').length;
  el.innerHTML=`<div class="q-top q-end">
      <span class="q-big" role="img" aria-label="${graded.length?`${clean} of ${graded.length} clean`:'All answered'}">${S.map((s,i)=>`<i class="${glyph(s,null)}" style="--i:${i}"></i>`).join('')}</span>
      ${graded.length?`<span class="q-score" style="--i:${S.length}"><b>${clean}</b>/${graded.length}</span>`:''}</div>`;
  QZ_fold(el,S.length);
}
// the results light up one by one, a breath, then the card folds up and fades, and what is under it rises into its place
function QZ_fold(el,n){
  const end=()=>{Q.fin=false;el.style.cssText='';el.getAnimations().forEach(a=>a.cancel());renderQuiz();BUS.emit('test');};
  if(REDUCED()||!el.animate){setTimeout(end,1600);return;}
  setTimeout(()=>{
    if(!el.classList.contains('q-fin')) return;
    const h=el.offsetHeight, mb=parseFloat(getComputedStyle(el).marginBottom)||0;
    sfx('swish');
    el.style.overflow='hidden';el.style.transformOrigin='50% 0';
    el.animate([{height:h+'px',marginBottom:mb+'px',opacity:1,transform:'none',filter:'blur(0)'},
      {height:h*.7+'px',marginBottom:mb+'px',opacity:.9,transform:'translateY(-4px) scale(.985)',filter:'blur(0)',offset:.3},
      {height:'0px',marginBottom:'0px',opacity:0,transform:'translateY(-14px) scale(.94)',filter:'blur(3px)'}],
      {duration:620,easing:'cubic-bezier(.5,0,.2,1)',fill:'forwards'}).finished.then(end,end);
  },700+n*90+900);
}

BUS.on('test',()=>renderQuiz());
