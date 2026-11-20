/* ---------- To improve list: on Essays, and its open items on Today (#improve-today). Owner: essays agent ----------
   improve/<id>: one doc per item, so his edits and Claude's never overwrite each other. `order` sets the place; an
   item without one sits by when it was added (newest on top), so the review's new items land on top and Today shows
   the top six. The right version edits in place like Notion; what he wrote stays as he wrote it. A click on a row
   anywhere but the text goes to the sentence. Crossing off works like Notion's to-do: the box ticks, the text greys
   and is struck through, and the row stays where it is till Monday (his week runs Monday to Sunday); then it moves
   behind the quiet "Crossed off" fold. A crossed-off row goes to where he got it right, when there is one clear place
   (the review's proof sentence, else the corrected words found once in a later essay); otherwise it goes nowhere. ---------- */
const IM_W={}, IM_NEWID={}, IM_FOC={}, IM_FT={}, IM_TK={};
let IM_NEW=null, IM_NEWT=null, IM_FOLD=false;
const IM_EL=document.querySelector('.es-stick');
const IM_live=()=>Object.values(ES.items).filter(x=>x&&!x.removed&&(x.nat||x.mine||IM_NEWID[x.id]));
const IM_key=x=>typeof x.order==='number'?x.order:-(Date.parse(x.added)||0)/1000;
const IM_open=()=>IM_live().filter(x=>!x.done).sort((a,b)=>IM_key(a)-IM_key(b));
const IM_done=()=>IM_live().filter(x=>x.done).sort((a,b)=>String(b.doneAt||'').localeCompare(String(a.doneAt||'')));
const IM_listed=s=>IM_live().find(x=>x.day===s.day&&x.mine===s.mine&&!x.done);
const IM_thisWeek=x=>!!(x.done&&x.doneAt&&new Date(x.doneAt)>=monday(P(essayToday())));
// the list as he sees it: open items and this week's crossed-off ones, each in its own place
const IM_list=()=>IM_live().filter(x=>!x.done||IM_thisWeek(x)).sort((a,b)=>IM_key(a)-IM_key(b));
const IM_snap=id=>ES.items[id]?JSON.parse(JSON.stringify(ES.items[id])):null;
const IM_strip=x=>{if(!x)return null;const y={...x};delete y.id;return y;};
const IM_field=(id,f)=>IM_EL.querySelector(`[data-id="${id}"][data-f="${f}"]`);
const IM_focus=()=>{const a=document.activeElement;return a&&a.dataset&&a.dataset.f&&IM_EL.contains(a)?a:null;};
const IM_natHTML=x=>x.mine&&x.nat?diffHTML(x.mine,x.nat):mix(x.nat||'');
function IM_canJump(x){
  if(!x||!x.day||!x.mine) return false;
  const e=ES.essays.find(y=>y.day===x.day), rv=ES.reviews[x.day];
  return !!(e&&rv&&ES_anchor(norm(e.text),rv.marks).some(m=>m.mine===x.mine&&m.nat&&m.t!=='good'));
}
// every place `q` appears in `text`, spaces ignored on both sides ("跟 Nina 見了面" finds "跟Nina見了面"), as [i,j]
function IM_find(text,q){
  q=String(q||'').replace(/\s+/g,''); if(!q) return [];
  const at=[]; let st='';
  for(let k=0;k<text.length;k++) if(!/\s/.test(text[k])){at.push(k);st+=text[k];}
  const out=[]; for(let p=st.indexOf(q);p>=0&&out.length<9;p=st.indexOf(q,p+1)) out.push([at[p],at[p+q.length-1]+1]);
  return out;
}
// where he got a crossed-off item right, when there is exactly one clear place: the review's proof sentence in its
// day, else the corrected words in an essay after the mistake and no later than the day he crossed it off
function IM_place(x){
  if(!x||!x.done) return null;
  const pf=x.proof;
  if(pf&&pf.day&&pf.s){
    const e=ES.essays.find(y=>+y.day===+pf.day), h=e?IM_find(norm(e.text),pf.s):[];
    if(h.length===1) return {day:e.day,i:h[0][0],j:h[0][1]};
  }
  if(!x.nat||!x.day) return null;
  const until=x.doneAt?K(new Date(x.doneAt)):'9999';
  const hits=[];
  ES.essays.forEach(e=>{if(e&&+e.day>+x.day&&e.date<=until)IM_find(norm(e.text),x.nat).forEach(h=>hits.push({day:e.day,i:h[0],j:h[1]}));});
  return hits.length===1?hits[0]:null;
}
const IM_goes=x=>x&&(x.done?!!IM_place(x):IM_canJump(x));
function IM_go(id){const x=ES.items[id];if(!x)return false;if(x.done){const p=IM_place(x);if(!p)return false;sfx('tap');ES_goPlace(p);return true;}if(!IM_canJump(x))return false;sfx('tap');IM_jump(id);return true;}
function IM_write(id,patch,mode){
  const cur=ES.items[id]||{};
  if(mode==='delete') delete ES.items[id]; else ES.items[id]={...cur,...patch,id};
  if(!IMP) return;
  const ref=IMP.doc(id), body={...ES.items[id]}; delete body.id;
  IM_W[id]=(IM_W[id]||Promise.resolve()).then(()=>mode==='delete'?ref.delete():mode==='create'?ref.set(body):ref.update(patch))
    .catch(e=>{console.error(e);IM_msg('That change didn’t save. Reload the board and try again.');});
}
// a change that Cmd+Z can take back
function IM_edit(id,patch,mode){
  const before=IM_strip(IM_snap(id));
  IM_write(id,patch,mode);
  record({items:[{id,before,after:IM_strip(IM_snap(id))}]});
}
// put an item back to a saved state: gone, re-created, or patched (fields it didn't have are cleared)
function IM_put(id,state){
  const cur=ES.items[id];
  if(!state){if(cur)IM_write(id,null,'delete');return;}
  if(!cur){IM_write(id,{...state},'create');return;}
  const patch={...state};Object.keys(cur).forEach(k=>{if(k!=='id'&&!(k in patch))patch[k]=null;});
  IM_write(id,patch);
}
function IM_apply(e,dir){
  (e.items||[]).forEach(x=>IM_put(x.id,x[dir]));
  if(e.essay){const s=e.essay,txt=s[dir];
    const doc=ES.essays.find(x=>x.day===s.day);if(doc)doc.text=txt;
    scheduleSave(s.day,s.date,txt,true);
    BUS.emit('draft',s.date,txt);
    if(ES.editDay===s.day){ES.editBefore=null;ES_stopEdit();}else{ES.stale=true;ES_render();ES_refreshPins();}}
  IM_render({force:true});ES_refreshPins();renderHints();
}
// a card action (cards.js) sits on the same history as the list
// undo and redo sound like the state they land on: carding, crossing off and "I know it / New" get Chinese Brain's stamp
// or unstamp, the same as the button would; everything else gets the board's own undo sound
function histSound(e,dir){
  const c=e.card;
  if(c&&c.field==='carded') return c[dir]?'stamp-known':'unstamp';
  if(c&&c.field==='knows'){const to=c[dir]||{},from=c[dir==='after'?'before':'after']||{};
    const ch=Object.keys({...to,...from}).find(k=>to[k]!==from[k]);
    return ch===undefined?'undo':to[ch]===true?'stamp-known':to[ch]===false?'stamp-new':'unstamp';}
  const x=(e.items||[]).find(x=>x&&x.before&&x.after&&!!x.before.done!==!!x.after.done);
  if(x) return x[dir].done?'stamp-known':'unstamp';
  return 'undo';
}
function undo(){const e=HIST.undo.pop();if(!e)return;e.card?CD_apply(e,'before'):IM_apply(e,'before');HIST.redo.push(e);sfx(histSound(e,'before'));}
function redo(){const e=HIST.redo.pop();if(!e)return;e.card?CD_apply(e,'after'):IM_apply(e,'after');HIST.undo.push(e);sfx(histSound(e,'after'));}
document.addEventListener('keydown',e=>{
  if(!(e.metaKey||e.ctrlKey)||e.altKey) return;
  const k=String(e.key).toLowerCase(); if(k!=='z'&&k!=='y') return;
  const a=document.activeElement;
  if(a&&(/^(INPUT|TEXTAREA)$/.test(a.tagName)||a.isContentEditable)){
    // typing keeps the browser's undo; a list field he hasn't typed in yet hands Cmd+Z to the list
    if(!(a.dataset.f&&getText(a)===(a.dataset.start||''))) return;
    a.blur();
  }
  e.preventDefault(); (k==='y'||e.shiftKey)?redo():undo();
});
function IM_msg(t){const el=document.getElementById('ess-done');el.querySelector('.im-err')?.remove();el.insertAdjacentHTML('beforeend',`<p class="im-empty im-err">${esc(t)}</p>`);}
function IM_toggle(s){
  const hit=IM_listed(s);
  if(hit) IM_drop(hit.id);
  else{const id='p'+Date.now().toString(36);IM_edit(id,{mine:s.mine,nat:s.nat,day:s.day,added:new Date().toISOString(),by:'chris',done:false},'create');IM_render({force:true});}
  ES_refreshPins();renderHints();
}
// his own open items go for good; Claude's stay as removed, so the review doesn't put them back
function IM_drop(id){
  const x=ES.items[id]; if(!x) return;
  if(x.by==='chris'&&!x.done) IM_edit(id,null,'delete'); else IM_edit(id,{removed:K(today())});
  IM_render({force:true});ES_refreshPins();renderHints();
}
// a row folds away (height to nothing), then the change lands
function IM_collapse(el,then){
  if(!el||REDUCED()||!el.animate){then();return;}
  el.style.overflow='hidden';
  const a=el.animate([{height:el.offsetHeight+'px',opacity:1},{height:'0px',opacity:0}],{duration:280,easing:'cubic-bezier(.22,.9,.24,1)',fill:'forwards'});
  a.onfinish=then;
}
function IM_remove(id){
  sfx('swish');
  IM_collapse(IM_EL.querySelector(`.es-row[data-r="${id}"]`),()=>{IM_drop(id);toast('Removed');});
}
// crossing off, Notion's way: the box ticks, the line draws through, and the row stays where it is (till Monday)
function IM_cross(id,btn){
  if(IM_TK[id]||!ES.items[id]) return;
  const r=btn.getBoundingClientRect(), row=btn.closest('.es-row,.imt-li');
  sfx('stamp-known');
  btn.classList.add('on'); btn.setAttribute('aria-checked','true');
  // the line draws through the right version, the way it will stay
  const t=row&&row.querySelector('.es-w,.imt-t'), x=ES.items[id];
  // (after the field's own focusout has put its marks back)
  if(t){if(document.activeElement===t)t.blur();setTimeout(()=>{t.innerHTML=`<span class="x-out x-draw">${mix(x.nat||x.mine)}</span>`;},0);}
  if(row) row.classList.add('ticking');
  celebrate('crossoff',{x:r.left+r.width/2,y:r.top+r.height/2});
  IM_TK[id]=setTimeout(()=>{
    delete IM_TK[id];
    IM_NEW=id;clearTimeout(IM_NEWT);IM_NEWT=setTimeout(()=>{IM_NEW=null;},1200);
    IM_edit(id,{done:true,doneAt:new Date().toISOString()});
    IM_render({force:true});ES_refreshPins();renderHints();
    toast('Crossed off');
  },REDUCED()?0:420);
}
function IM_untick(id){
  sfx('unstamp');
  IM_edit(id,{done:false,doneAt:null});IM_render({force:true});ES_refreshPins();renderHints();
}
// the place between two rows; index `to` counts the open rows without the moving one
function IM_orderAt(id,to){
  const L=IM_open().filter(x=>x.id!==id), a=L[to-1], b=L[to];
  return a&&b?(IM_key(a)+IM_key(b))/2:a?IM_key(a)+1:b?IM_key(b)-1:-Date.now()/1000;
}
function IM_newItem(afterId){
  const open=IM_open(), i=afterId?open.findIndex(x=>x.id===afterId):-1;
  const order=IM_orderAt(null,i>=0?i+1:open.length);
  const id='p'+Date.now().toString(36);
  IM_NEWID[id]=true;
  IM_write(id,{mine:'',nat:'',day:null,added:new Date().toISOString(),by:'chris',done:false,order},'create');
  sfx('pop');
  IM_render({force:true});
  const f=IM_field(id,'nat'); if(f){f.focus();placeCaret(f,0);}
}
function IM_moveBy(id,dir){
  const open=IM_open(), i=open.findIndex(x=>x.id===id), to=i+dir;
  if(i<0||to<0||to>=open.length) return;
  IM_edit(id,{order:IM_orderAt(id,to)});sfx('drop');IM_render({force:true});renderHints();
}

const IM_GRIP='<svg width="10" height="14" viewBox="0 0 10 14" aria-hidden="true"><g fill="currentColor"><circle cx="3" cy="3" r="1.2"/><circle cx="7" cy="3" r="1.2"/><circle cx="3" cy="7" r="1.2"/><circle cx="7" cy="7" r="1.2"/><circle cx="3" cy="11" r="1.2"/><circle cx="7" cy="11" r="1.2"/></g></svg>';
const IM_PLUS='<svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M6 2v8M2 6h8" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>';
const IM_X='<svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M3 3l6 6M9 3 3 9" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>';
const IM_CHEV='<svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true"><path d="M3.5 2 7 5 3.5 8" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
// the box: Notion's to-do checkbox. Empty, or filled with a tick (the tick draws itself when he checks it)
const IM_TICK='<svg viewBox="0 0 14 14" aria-hidden="true"><path d="M3.2 7.4 5.9 10 10.9 4.3" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const IM_box=x=>x.done?`<button class="es-box on" type="button" role="checkbox" aria-checked="true" data-undo="${x.id}" aria-label="Put back on the list">${IM_TICK}</button>`
  :`<button class="es-box" type="button" role="checkbox" aria-checked="false" data-tick="${x.id}" aria-label="Cross off">${IM_TICK}</button>`;
function IM_rowHTML(x){
  const done=!!x.done, go=IM_goes(x);
  // crossed off: the right version alone, greyed and struck (the board's one crossed-off style, .x-out)
  const nat=done?`<div class="es-w" lang="zh-Hant"><span class="x-out">${mix(x.nat||x.mine)}</span></div>`
    :`<div class="es-w" contenteditable="${CE}" data-f="nat" data-id="${x.id}" data-ph="The right way" aria-label="The right way" lang="zh-Hant" spellcheck="false">${IM_natHTML(x)}</div>`;
  const was=x.mine&&!done?`<div class="es-o" lang="zh-Hant"><s class="x-out">${mix(x.mine)}</s></div>`:'';
  return `<div class="es-row${done?' done':''}${go?' jump':''}${x.id===IM_NEW?' fresh':''}" data-r="${x.id}"><div class="es-ri">`
    +(done?'':`<span class="es-gut"><button class="es-plus" type="button" data-plus="${x.id}" aria-label="Add a row below" tabindex="-1">${IM_PLUS}</button><span class="es-grip" data-grip="${x.id}">${IM_GRIP}</span></span>`)
    +IM_box(x)
    +`<div class="es-t">${nat}${was}</div>`
    +(done?'':`<span class="es-acts"><button class="es-ab" type="button" data-rm="${x.id}" aria-label="Remove">${IM_X}</button></span>`)
    +`</div></div>`;
}
const IM_set=(id,html,force)=>{const el=document.getElementById(id);if(!el||(!force&&el._h===html))return false;el._h=html;el.innerHTML=html;return true;};
// FLIP: rows slide from where they were to where they are
function IM_flipFirst(){const m={};IM_EL.querySelectorAll('.es-row[data-r]').forEach(r=>{const b=r.getBoundingClientRect();if(b.height)m[r.dataset.r]=b.top;});return m;}
function IM_flipPlay(m){
  if(REDUCED()||!Object.keys(m).length) return;
  IM_EL.querySelectorAll('.es-row[data-r]').forEach(r=>{
    const top=r.getBoundingClientRect().top, id=r.dataset.r;
    if(id in m){const dy=m[id]-top;if(Math.abs(dy)>1)r.animate([{transform:`translateY(${dy}px)`},{transform:'none'}],{duration:380,easing:'cubic-bezier(.22,.9,.24,1)'});}
    else if(r.offsetHeight) r.animate([{opacity:0,transform:'translateY(-4px)'},{opacity:1,transform:'none'}],{duration:260,easing:'ease-out'});
  });
}
function IM_render(opt={}){
  // while he types in a row, a snapshot waits; it renders when he leaves the list
  if(IM_focus()&&!opt.force){ES.listDirty=true;return;}
  ES.listDirty=false;
  const a=IM_focus(), kf=a&&{id:a.dataset.id,f:a.dataset.f,o:caretAt(a),text:getText(a),start:a.dataset.start};
  const first=opt.first||IM_flipFirst();
  const open=IM_open(), list=IM_list(), older=IM_done().filter(x=>!IM_thisWeek(x));
  const openHTML=list.length?list.map(IM_rowHTML).join(''):'<p class="im-empty">All clear</p>';
  const doneHTML=older.length?`<button class="im-fold" type="button" data-fold aria-expanded="${IM_FOLD}">${IM_CHEV}<span>Crossed off</span><span class="im-n">${older.length}</span></button><div class="im-done"${IM_FOLD?'':' hidden'}>${older.map(IM_rowHTML).join('')}</div>`:'';
  const dd=document.getElementById('es-dd');
  if(dd){const dots='<i></i>'.repeat(Math.min(open.length,16));if(dd._h!==dots){dd._h=dots;dd.innerHTML=dots;}dd.setAttribute('role','img');dd.setAttribute('aria-label',open.length+' to improve');}
  let ch=IM_set('ess-open',openHTML,opt.force);
  ch=IM_set('ess-done',doneHTML,opt.force)||ch;
  if(kf){const el=IM_field(kf.id,kf.f);if(el){if(el.children.length||getText(el)!==kf.text)el.textContent=kf.text;el.dataset.start=kf.start||'';el.focus({preventScroll:true});placeCaret(el,kf.o);}}
  if(ch) IM_flipPlay(first);
}
function IM_commit(el,final){
  const id=el.dataset.id, f=el.dataset.f, x=ES.items[id]; if(!x) return;
  clearTimeout(IM_FT[id+f]);
  let v=getText(el).trim().replace(/\s*\n+\s*/g,' ');
  const patch={};
  // "what I wrote → the right way" typed in one go splits itself when he leaves the field
  if(final&&f==='nat'&&!x.mine&&/(→|->|=>)/.test(v)){const p=v.split(/\s*(?:→|->|=>)\s*/);patch.mine=p[0];v=p.slice(1).join(' ');setText(el,v);}
  if(v!==(x[f]||'')) patch[f]=v;
  if(Object.keys(patch).length) IM_write(id,patch);
}
// leaving a row: an empty new row goes quietly; a finished edit is one step for Cmd+Z
function IM_leaveRow(id){
  const st=IM_FOC[id], isNew=!!IM_NEWID[id]; delete IM_FOC[id]; delete IM_NEWID[id];
  const x=ES.items[id];
  if(x&&!String(x.nat||'').trim()&&!String(x.mine||'').trim()){
    if(isNew) IM_write(id,null,'delete');
    else{const before=st?st.before:IM_strip(IM_snap(id));
      if(x.by==='chris'&&!x.done) IM_write(id,null,'delete'); else IM_write(id,{removed:K(today())});
      record({items:[{id,before,after:IM_strip(IM_snap(id))}]});}
    IM_render({force:!IM_focus()});renderHints();ES_refreshPins();return;
  }
  if(x&&st){const after=IM_strip(IM_snap(id));if(JSON.stringify(st.before)!==JSON.stringify(after))record({items:[{id,before:st.isNew?null:st.before,after}]});}
  if(!IM_focus()) IM_render();
  renderHints();ES_refreshPins();
}
const IM_nav=()=>[...IM_EL.querySelectorAll('[data-f]')].filter(el=>el.offsetParent);
// the right version shows its marks until he clicks into it; then it is plain text where he clicked
IM_EL.addEventListener('mousedown',e=>{
  const el=e.target.closest('[data-f]');
  if(el&&document.activeElement!==el&&el.children.length) el.textContent=el.textContent;
},true);
IM_EL.addEventListener('focusin',e=>{
  const el=e.target.closest('[data-f]'); if(!el) return;
  if(el.children.length){const o=caretAt(el);el.textContent=el.textContent;placeCaret(el,o);}
  const id=el.dataset.id;
  if(!IM_FOC[id]) IM_FOC[id]={before:IM_strip(IM_snap(id)),isNew:!!IM_NEWID[id]};
  el.dataset.start=getText(el);
});
IM_EL.addEventListener('input',e=>{
  const el=e.target.closest('[data-f]'); if(!el) return;
  if(!getText(el)&&el.innerHTML) el.innerHTML='';
  const k=el.dataset.id+el.dataset.f; clearTimeout(IM_FT[k]); IM_FT[k]=setTimeout(()=>IM_commit(el),700);
});
IM_EL.addEventListener('focusout',e=>{
  const el=e.target.closest('[data-f]'); if(!el) return;
  IM_commit(el,true);
  const row=el.closest('.es-ri'), id=el.dataset.id;
  setTimeout(()=>{
    if(el.isConnected&&document.activeElement!==el&&ES.items[id]) el.innerHTML=IM_natHTML(ES.items[id]);
    if(!document.activeElement||!row.isConnected||!row.contains(document.activeElement)) IM_leaveRow(id);
  },0);
});
IM_EL.addEventListener('keydown',e=>{
  const el=e.target.closest('[data-f]');
  const rowId=e.target.closest('.es-row')?.dataset.r;
  // Cmd+Shift+↑/↓ (or Alt+Shift) moves the row
  if(rowId&&(e.key==='ArrowUp'||e.key==='ArrowDown')&&e.shiftKey&&(e.metaKey||e.ctrlKey||e.altKey)){
    e.preventDefault(); if(el) IM_commit(el); IM_moveBy(rowId,e.key==='ArrowUp'?-1:1); return;
  }
  if(!el||e.isComposing||e.keyCode===229) return;
  const id=el.dataset.id, x=ES.items[id], txt=getText(el), at=caretAt(el);
  if(e.key==='Enter'){
    e.preventDefault(); IM_commit(el,true);
    if(x&&!x.done) IM_newItem(id); else el.blur();
  } else if(e.key==='Escape'){e.preventDefault();el.blur();}
  else if(e.key==='Backspace'&&!txt&&at===0){
    if(x&&!String(x.mine||'').trim()){
      e.preventDefault();
      const rows=[...IM_EL.querySelectorAll('#ess-open .es-row[data-r]:not(.done)')], ri=rows.findIndex(r=>r.dataset.r===id), prev=ri>0?rows[ri-1].querySelector('[data-f="nat"]'):null;
      const st=IM_FOC[id], isNew=!!IM_NEWID[id]; delete IM_FOC[id]; delete IM_NEWID[id];
      if(isNew) IM_write(id,null,'delete');
      else{const before=st?st.before:IM_strip(IM_snap(id));
        if(x.by==='chris'&&!x.done) IM_write(id,null,'delete'); else IM_write(id,{removed:K(today())});
        record({items:[{id,before,after:IM_strip(IM_snap(id))}]});}
      sfx('swish');
      const pid=prev&&prev.dataset.id;
      if(prev){prev.focus();placeCaret(prev,null);}
      IM_render({force:true});renderHints();ES_refreshPins();
      const p=pid&&IM_field(pid,'nat');if(p&&document.activeElement!==p){p.focus();placeCaret(p,null);}
    }
  } else if((e.key==='ArrowUp'&&at===0)||(e.key==='ArrowDown'&&at===txt.length)){
    const fs=IM_nav(), n=fs[fs.indexOf(el)+(e.key==='ArrowUp'?-1:1)];
    if(n){e.preventDefault();n.focus();placeCaret(n,e.key==='ArrowUp'?null:0);}
  }
});
IM_EL.addEventListener('click',e=>{
  const t=e.target.closest('[data-tick],[data-undo],[data-rm],[data-plus],[data-fold]');
  if(t){
    const d=t.dataset;
    if(d.tick) IM_cross(d.tick,t);
    else if(d.undo) IM_untick(d.undo);
    else if(d.rm) IM_remove(d.rm);
    else if(d.plus) IM_newItem(d.plus);
    else if('fold' in d){IM_FOLD=!IM_FOLD;sfx('tap');IM_render({force:true});}
    return;
  }
  // the text edits; anywhere else on a row goes to the sentence, or for a crossed-off one to where he got it right
  // (his own items with nowhere to go: into the text)
  if(e.target.closest('[data-f],[data-grip]')||String(getSelection()||'').trim()) return;
  const row=e.target.closest('.es-row'); if(!row) return;
  const id=row.dataset.r;
  if(IM_go(id)) return;
  const n=IM_field(id,'nat'); if(n){n.focus();placeCaret(n,null);}
});
document.getElementById('ess-new').onclick=()=>IM_newItem(null);
// drag the grip: the row follows the pointer, the others make room, then everything settles into place
let IM_DR=null;
IM_EL.addEventListener('pointerdown',e=>{
  const g=e.target.closest('[data-grip]'); if(!g||e.button>0) return;
  const row=g.closest('.es-row'), rows=[...IM_EL.querySelectorAll('#ess-open .es-row[data-r]:not(.done)')], i0=rows.indexOf(row);
  if(i0<0) return;
  e.preventDefault();
  if(IM_focus()) IM_focus().blur();
  try{g.setPointerCapture(e.pointerId);}catch(_){}
  const rects=rows.map(r=>r.getBoundingClientRect());
  IM_DR={row,rows,rects,i0,to:i0,y0:e.clientY,h:rects[i0].height,id:row.dataset.r};
  row.classList.add('drag'); rows.forEach(r=>{if(r!==row)r.classList.add('shift');});
  sfx('tap');
});
IM_EL.addEventListener('pointermove',e=>{
  if(!IM_DR) return;
  const D=IM_DR, dy=e.clientY-D.y0, c=D.rects[D.i0].top+D.h/2+dy;
  D.row.style.transform=`translateY(${dy}px)`;
  let to=D.i0;
  D.rects.forEach((r,j)=>{const mid=r.top+r.height/2;if(j<D.i0&&c<mid)to=Math.min(to,j);if(j>D.i0&&c>mid)to=Math.max(to,j);});
  D.rows.forEach((r,j)=>{if(j===D.i0)return;let s=0;if(D.i0<to&&j>D.i0&&j<=to)s=-D.h;if(to<D.i0&&j>=to&&j<D.i0)s=D.h;r.style.transform=s?`translateY(${s}px)`:'';});
  if(to!==D.to){D.to=to;sfx('tap');}
});
function IM_endDrag(){
  if(!IM_DR) return;
  const d=IM_DR; IM_DR=null;
  const first=IM_flipFirst();
  d.rows.forEach(r=>{r.style.transform='';r.classList.remove('shift','drag');});
  if(d.to!==d.i0){IM_edit(d.id,{order:IM_orderAt(d.id,d.to)});sfx('drop');IM_render({force:true,first});renderHints();}
  else IM_flipPlay(first);
}
IM_EL.addEventListener('pointerup',IM_endDrag);
IM_EL.addEventListener('pointercancel',IM_endDrag);
function IM_jump(id){
  const x=ES.items[id]; if(!IM_canJump(x)) return;
  if(VIEW!=='essays') setView('essays');
  if(ES.editDay!=null) ES_stopEdit();
  if(!document.getElementById('day-'+x.day)){const idx=sorted().findIndex(e=>e.day===x.day);if(idx>=0){ES.show=Math.max(ES.show,idx+1);ES_render();ES_refreshPins();}}
  const s=Object.values(ES.seg).find(s=>s.day===x.day&&s.mine===x.mine); if(!s) return;
  const c=document.querySelector(`.es-c[data-k="${s.id}"]`); if(!c) return;
  c.scrollIntoView({block:'center',behavior:REDUCED()?'auto':'smooth'});
  c.classList.remove('flash');void c.offsetWidth;c.classList.add('flash');setTimeout(()=>c.classList.remove('flash'),1900);
}

/* Today: the list as on Essays (top six open items, with this week's crossed-off ones in their places, struck); a
   line goes to its sentence (a crossed-off one to where he got it right, if there's one clear place), the box ticks */
function renderHints(){
  const el=document.getElementById('improve-today'); if(!el) return;
  const rows=[]; let n=0;
  for(const x of IM_list()){if(!(x.nat||x.mine))continue;if(!x.done&&++n>6)break;if(x.done&&rows.length>=9)continue;rows.push(x);}
  while(rows.length&&rows[rows.length-1].done&&n>6) rows.pop();
  const li=x=>`<li class="imt-li${x.done?' done':''}${IM_goes(x)?' jump':''}" data-go="${x.id}"><div class="imt-in">${IM_box(x)}<span class="imt-t">${x.done?`<span class="x-out">${mix(x.nat||x.mine)}</span>`:IM_natHTML(x)}</span></div></li>`;
  const html=rows.length?`<div class="im-head"><h2 class="side-h">To improve</h2></div><ul class="imt" lang="zh-Hant">${rows.map(li).join('')}</ul>`:'';
  if(el._h!==html){el._h=html;el.innerHTML=html;}
}
document.getElementById('improve-today').addEventListener('click',e=>{
  const b=e.target.closest('[data-tick]'); if(b){IM_cross(b.dataset.tick,b);return;}
  const u=e.target.closest('[data-undo]'); if(u){IM_untick(u.dataset.undo);return;}
  const li=e.target.closest('[data-go]'); if(!li) return;
  const id=li.dataset.go, x=ES.items[id];
  if(IM_go(id)||!x||x.done) return;
  sfx('tap');
  setView('essays');
  const sd=document.querySelector('.es-side'); if(sd&&!sd.classList.contains('open')){sd.classList.add('open');document.getElementById('es-disc')?.setAttribute('aria-expanded','true');}
  const f=IM_field(id,'nat'); if(f){f.scrollIntoView({block:'center',behavior:REDUCED()?'auto':'smooth'});f.focus({preventScroll:true});placeCaret(f,null);}
});
BUS.on('items',()=>{IM_render();renderHints();});
BUS.on('essays',()=>{IM_render();renderHints();});
BUS.on('reviews',()=>IM_render());
IM_render();renderHints();
