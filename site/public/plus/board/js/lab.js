/* ---------- Settings: the few choices he keeps on this device. Owner: lead
   Modules register with LAB.define(id,label,[[value,label],...],default,group) (the API keeps its old name) and
   re-render on BUS 'lab'. Choices are saved under lab:<id>. ?lab=card-ahead:on in the URL picks one for screenshots.
   The panel is a popover under the gear; a click outside, ×, the gear or Esc close it. ---------- */
(()=>{
  LAB.define('text-size','Text size',[['normal','Normal'],['larger','Larger']],'normal','Board');
  const btn=document.getElementById('settingsbtn'), box=document.getElementById('settings');
  btn.innerHTML='<svg width="19" height="19" viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="2.7" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M10 2.2v2.1M10 15.7v2.1M2.2 10h2.1M15.7 10h2.1M4.5 4.5l1.5 1.5M14 14l1.5 1.5M15.5 4.5L14 6M6 14l-1.5 1.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" fill="none"/></svg>';
  const ORDER=['text-size','card-model','card-ahead'];
  const ids=()=>[...ORDER.filter(id=>LAB.defs[id]),...LAB.order.filter(id=>!ORDER.includes(id))];
  const row=(label,opts,attrs)=>`<div class="st-row"><span class="st-l">${esc(label)}</span><span class="st-o" role="radiogroup" aria-label="${esc(label)}">${opts.map(([v,l,on])=>`<button type="button" role="radio" aria-checked="${on}" ${attrs(v)}>${esc(l)}</button>`).join('')}</span></div>`;
  function draw(){
    const keep=box.contains(document.activeElement)?document.activeElement.getAttribute('data-x')+'|'+document.activeElement.getAttribute('data-v'):'';
    box.innerHTML=`<div class="st-in" role="dialog" aria-label="Settings">
      <div class="st-top"><b>Settings</b><button class="btn-q" type="button" id="st-reset">Reset</button><button class="st-x" type="button" id="st-close" aria-label="Close">×</button></div>
      ${row('Sound',[['1','On',SND.on],['0','Off',!SND.on]],v=>`data-sound="${v}"`)}
      ${ids().map(id=>{const d=LAB.defs[id];return row(d.label,d.options.map(([v,l])=>[v,l,d.v===v]),v=>`data-x="${id}" data-v="${esc(v)}"`);}).join('')}
    </div>`;
    if(keep){const [x,v]=keep.split('|');const b=box.querySelector(x==='null'?'[data-sound]':`[data-x="${x}"][data-v="${v}"]`);b&&b.focus();}
  }
  function open(on,back){box.hidden=!on;btn.setAttribute('aria-expanded',String(on));if(on){draw();box.querySelector('[aria-checked="true"]').focus();}else if(back)btn.focus();}
  btn.onclick=e=>{e.stopPropagation();sfx('tap');open(box.hidden);};
  box.addEventListener('click',e=>{
    e.stopPropagation();
    const b=e.target.closest('[data-x]');
    if(b){LAB.set(b.dataset.x,b.dataset.v);sfx('tap');draw();return;}
    const s=e.target.closest('[data-sound]');
    if(s){if(SND.on!==(s.dataset.sound==='1'))SNDB.click();else sfx('tap');draw();return;}
    if(e.target.id==='st-close'){sfx('tap');open(false,true);return;}
    if(e.target.id==='st-reset'){LAB.order.forEach(id=>LAB.set(id,LAB.defs[id].def));sfx('swish');draw();}
  });
  SNDB.addEventListener('click',()=>{if(!box.hidden)setTimeout(draw,0);});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!box.hidden)open(false,true);});
  // a click anywhere outside the panel (and not on the gear) closes it
  document.addEventListener('pointerdown',e=>{if(!box.hidden&&!box.contains(e.target)&&!btn.contains(e.target))open(false);},true);
})();
