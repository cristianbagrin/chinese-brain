// Chinese Brain Plus. Shows nothing until the server says this account has the `plus` switch; anyone else gets the
// not-found page, so the address gives nothing away. Then the board's scripts load, in order (scripts/cbp-board.py).
(async () => {
  const board = document.currentScript.dataset.board.split(' ');
  let token = '';
  try {
    token = localStorage.getItem('cb-token') ?? '';
  } catch {}
  // signed out: sign in, then come back; signed in without the switch: nothing here
  const signIn = () => location.replace('/account?next=' + encodeURIComponent(location.pathname));
  if (!token) return signIn();
  const res = await fetch('/api/plus/me', { headers: { Authorization: `Bearer ${token}` } }).catch(() => null);
  if (res?.status === 401) return signIn();
  if (!res?.ok) return location.replace('/404');
  for (const f of board) {
    const s = document.createElement('script');
    s.src = `/plus/board/${f}`;
    s.async = false;
    document.body.append(s);
  }
  document.documentElement.classList.remove('locked');
})();
