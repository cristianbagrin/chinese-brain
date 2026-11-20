// Chinese Brain Plus. Shows nothing until the server says this account has the `plus` switch;
// anyone else gets the not-found page, so the address gives nothing away.
(async () => {
  let token = '';
  try {
    token = localStorage.getItem('cb-token') ?? '';
  } catch {}
  const res = token ? await fetch('/api/plus/me', { headers: { Authorization: `Bearer ${token}` } }).catch(() => null) : null;
  if (!res?.ok) return location.replace('/404');
  const me = await res.json();
  document.getElementById('hello').textContent = '你好';
  document.getElementById('demo').hidden = !me.flags.includes('plus.demo');
  document.getElementById('app').hidden = false;
})();
