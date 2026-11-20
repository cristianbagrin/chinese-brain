// The way into the staging site: trade this browser's session for the staging cookie (see worker.js, Staging).
(async () => {
  const msg = document.getElementById('msg');
  let token = '';
  try {
    token = localStorage.getItem('cb-token') ?? '';
  } catch {}
  if (!token) {
    msg.textContent = 'Sign in, then come back to this page.';
    document.getElementById('signin').hidden = false;
    return;
  }
  msg.textContent = 'Opening…';
  const res = await fetch('/api/staging/enter', { method: 'POST', headers: { Authorization: `Bearer ${token}` } }).catch(() => null);
  if (res?.ok) return location.replace('/plus');
  const data = res ? await res.json().catch(() => ({})) : {};
  msg.textContent = data.error ?? 'Can’t reach the server. Check your connection.';
  if (data.code === 'signed_out') document.getElementById('signin').hidden = false;
})();
