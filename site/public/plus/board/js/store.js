/* ---------- store: saving essays. Owner: lead (agents call scheduleSave / flushNow / saveState, never edit)
   scheduleSave(day,date,text,soon) queues a write; flushNow(date) sends it now; saveState(date,'saved'|'error'|'local')
   updates every .saved[data-saved="<date>"] element; restoreDrafts() runs once the essays load. ---------- */
/* ---------- saving essays: one write at a time per day, the newest text wins; a copy waits on this device ---------- */
const SV={};
const DRAFTS='essay-drafts-v1';
function drafts(){try{return JSON.parse(lsGet(DRAFTS)||'{}')||{};}catch(e){return {};}}
function draftPut(date,day,text){const d=drafts();d[date]={day,text,at:new Date().toISOString()};lsSet(DRAFTS,JSON.stringify(d));}
function draftDone(date,text){const d=drafts();if(d[date]&&d[date].text===text){delete d[date];lsSet(DRAFTS,JSON.stringify(d));}}
// the status beside the day being written: on Today, and in the diary while a past day is open
const SAVEDT={};
function saveState(date,state){
  clearTimeout(SAVEDT[date]);
  const els=()=>document.querySelectorAll(`.saved[data-saved="${date}"]`);
  els().forEach(el=>{
    el.classList.remove('on','err');
    if(state==='saved'){el.textContent='Saved';el.classList.add('on');}
    else if(state==='error'){el.textContent='Not saved yet. A copy stays on this device.';el.classList.add('err');}
    else if(state==='local'){el.textContent='Saved on this device only';el.classList.add('on');}
  });
  if(state==='saved') SAVEDT[date]=setTimeout(()=>els().forEach(el=>el.classList.remove('on')),1600);
}
function scheduleSave(day,date,text,soon){
  const s=SV[date]||(SV[date]={});
  s.next={day,date,text};
  const e=ES.essays.find(x=>x.date===date); if(e) e.text=text;
  draftPut(date,day,text);
  clearTimeout(s.timer);
  s.timer=setTimeout(()=>flush(date),soon?0:650);
}
function flushNow(date){const s=SV[date];if(s&&s.next){clearTimeout(s.timer);flush(date);}}
async function flush(date){
  const s=SV[date]; if(!s||s.busy||!s.next) return;
  if(ES.nodb){saveState(date,'local');return;}
  // until the board's essays load, the copy on this device waits; it goes up once they do
  if(!ES.db||!ES.loaded) return;
  const {day,text}=s.next; s.next=null; s.busy=true;
  // tz (minutes east of UTC) lets the weekly review, which runs elsewhere, tell which essay is still today's
  const ref=ES.db.doc('essays/'+dayId(day)), now=new Date().toISOString(), tz=-new Date().getTimezoneOffset();
  const cur=ES.essays.find(e=>e.day===day);
  let failed=false;
  try{
    if(!text.trim()&&!ES.reviews[day]){
      // an emptied, unreviewed day goes, so its DAY number is free again
      if(cur) await ref.delete();
      ES.essays=ES.essays.filter(e=>e.day!==day);
    } else if(cur){
      try{await ref.update({text,edited:now,tz});}
      catch(e){if(e&&e.code==='invalid_argument') await ref.set({day,date,text,created:cur.created||now,edited:now,tz}); else throw e;}
      cur.edited=now;
    } else {
      await ref.set({day,date,text,created:now,edited:now,tz});
      if(!ES.essays.some(e=>e.day===day)) ES.essays.push({day,date,text,created:now,edited:now,tz});
    }
    s.tries=0;
    draftDone(date,text);
    if(!s.next) saveState(date,'saved');
  }catch(e){
    console.error(e); failed=true;
    if(!s.next) s.next={day,date,text};
    saveState(date,'error');
  }finally{
    s.busy=false;
    if(failed) s.tries=(s.tries||0)+1;
    // a failed save tries twice more on its own, then waits for the next keystroke or visit
    if(s.next&&(!failed||s.tries<=2)) s.timer=setTimeout(()=>flush(date),failed?4000*s.tries:400);
  }
}
// drafts left on this device (no connection, or the page closed mid-save) go up when the board has older text
function restoreDrafts(){
  const d=drafts(); let changed=false;
  Object.entries(d).forEach(([date,x])=>{
    const doc=ES.essays.find(e=>e.date===date), text=String(x&&x.text||'');
    if(!text.trim()||(doc&&(doc.text===text||String(doc.edited||'')>=String(x.at||'')))){delete d[date];changed=true;return;}
    const day=doc?doc.day:nextDay();
    BUS.emit('draft',date,text);
    scheduleSave(day,date,text,true);
  });
  if(changed) lsSet(DRAFTS,JSON.stringify(d));
}

