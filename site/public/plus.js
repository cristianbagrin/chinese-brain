// Chinese Brain Plus. Shows nothing until the server says this account has the `plus` switch; anyone else gets the
// not-found page, so the address gives nothing away. Then the board's scripts load, in order (scripts/cbp-board.py).
(async () => {
  const board = document.currentScript.dataset.board.split(' ');
  let token = '';
  try {
    token = localStorage.getItem('cb-token') ?? '';
  } catch {}
  const res = token ? await fetch('/api/plus/me', { headers: { Authorization: `Bearer ${token}` } }).catch(() => null) : null;
  if (!res?.ok) return location.replace('/404');
  for (const f of board) {
    const s = document.createElement('script');
    s.src = `/plus/board/${f}`;
    s.async = false;
    document.body.append(s);
  }
  document.documentElement.classList.remove('locked');
})();
