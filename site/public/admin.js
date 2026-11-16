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
});
