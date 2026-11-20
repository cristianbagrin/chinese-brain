// The owner's list of accounts (/admin). Needs the ADMIN_KEY secret.
const $ = (id) => document.getElementById(id);
const day = (t) => new Date(t).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
$('gate').addEventListener('submit', async (e) => {
  e.preventDefault();
  const res = await fetch('/api/admin/users', { headers: { Authorization: 'Bearer ' + $('key').value } });
  if (!res.ok) return ($('msg').textContent = 'That key isn\u2019t right (or ADMIN_KEY isn\u2019t set yet).');
  const d = await res.json();
  $('gate').hidden = true; $('out').hidden = false;
  for (const [n, label] of [[d.total, 'accounts'], [d.newThisWeek, 'new this week'], [d.activeThisWeek, 'active this week']]) {
    const t = document.createElement('div'); t.className = 'tile'; const b = document.createElement('b'); b.textContent = n.toLocaleString('en-US'); t.append(b, label); $('tiles').append(t);
  }
  for (const u of d.users) {
    const r = document.createElement('div'); r.className = 'urow';
    for (const x of [u.email, 'joined ' + day(u.created), 'last used ' + day(u.seen), (u.words || 0) + ' items']) { const c = document.createElement('span'); c.textContent = x; r.append(c); }
    $('users').append(r);
  }
  emails = d.users.map((u) => u.email);
  switches(await (await fetch('/api/admin/flags', { headers: { Authorization: 'Bearer ' + $('key').value } })).json());
});

// Release switches: one row for everyone, one per account. Pressing a switch flips it at once.
let emails = [];
function switches(f) {
  $('switches').replaceChildren();
  for (const who of ['*', ...emails]) {
    const on = who === '*' ? f.everyone : f.people[who] ?? [];
    const r = document.createElement('div'); r.className = 'urow';
    const name = document.createElement('span'); name.textContent = who === '*' ? 'Everyone' : who; r.append(name);
    for (const [flag, label] of Object.entries(f.switches)) {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'btn';
      b.setAttribute('aria-pressed', String(on.includes(flag)));
      b.textContent = (on.includes(flag) ? '● ' : '○ ') + label;
      b.addEventListener('click', async () => {
        b.disabled = true;
        const res = await fetch('/api/admin/flags', { method: 'POST', headers: { Authorization: 'Bearer ' + $('key').value, 'Content-Type': 'application/json' }, body: JSON.stringify({ email: who, flag, on: !on.includes(flag) }) });
        if (res.ok) switches(await res.json()); else b.disabled = false;
      });
      r.append(b);
    }
    $('switches').append(r);
  }
}
