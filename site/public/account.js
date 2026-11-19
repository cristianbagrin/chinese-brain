// The account and reset pages (cb.js has the session token and the API).
/** Run a form's request with its button disabled; errors land in the form's message line. */
function onSubmit(form, msg, run) {
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const b = form.querySelector('button');
    b.disabled = true;
    say(msg, '');
    try {
      await run();
    } catch (err) {
      say(msg, err.message);
      if (err.code === 'signed_out') signedOut();
    }
    b.disabled = false;
  });
}

/** Tell the header (site.js) who is signed in, so its corner can say so. */
function remember(email) {
  if (email) localStorage.setItem('cb-email', email);
  else localStorage.removeItem('cb-email');
  dispatchEvent(new Event('cb-account'));
}

function signedOut() {
  localStorage.removeItem('cb-token');
  remember('');
  show();
}

// ---------- /reset ----------
if ($('reset')) {
  onSubmit($('reset'), 'msg', async () => {
    const res = await api('reset', { token: location.hash.slice(1), password: $('next').value });
    localStorage.setItem('cb-token', res.token);
    localStorage.removeItem('cb-email');
    say('msg', 'Password saved. Taking you to your account…', true);
    setTimeout(() => (location.href = '/account'), 900);
  });
}

// ---------- The account's recovery key ----------
// One master key opens what every app encrypts; the password and the one recovery key each open it (see
// acct/keyring.js). This card says whether the account has one and makes a new recovery key; a password change
// here wraps the master key under the new password.
const KR = globalThis.AccountKeyring;
const RING = '@account/keyring';

/** The account keyring and the `s` to write it back with. */
async function readRing() {
  const r = await api('sync', { app: 'account', since: 0, changes: [] });
  const c = (r.changes ?? []).find((x) => x.k === RING);
  return { ring: KR.isRing(c?.v) ? c.v : null, s: c?.s ?? 0 };
}

/** Write the keyring over the one read at `s`, and read back what the account now holds. */
async function writeRing(ring, s) {
  const r = await api('sync', { app: 'account', since: 0, changes: [{ k: RING, v: ring, t: Date.now(), if: s }] });
  if (r.rejected?.includes(RING)) throw Object.assign(new Error('Your account changed in another app just now. Try again.'), { code: 'changed' });
  return readRing();
}

/** Whether this is the account's password (a reset may have left the keyring under an older one). */
async function rightPassword(password) {
  try {
    const r = await api('login', { email: $('who').textContent, password });
    fetch('/api/logout', { method: 'POST', headers: { Authorization: `Bearer ${r.token}` } }).catch(() => {});
    return true;
  } catch (err) {
    if (err.code === 'wrong') return false;
    throw err;
  }
}

async function showRecovery() {
  if (!KR) return;
  $('rkShow').hidden = true;
  $('rkOldLabel').hidden = true;
  let ring = null;
  try {
    ({ ring } = await readRing());
  } catch {
    $('rkForm').hidden = true;
    return;
  }
  $('rkForm').hidden = false;
  $('rkAsk').hidden = !ring;
  $('rkLead').textContent = ring
    ? 'Gets you back into your synced data in every app if you forget your password.'
    : 'None yet. Money in Order and Ten Dollar Words make one the first time you sign in there.';
}

function recoveryForms() {
  onSubmit($('rkForm'), 'rkMsg', async () => {
    const password = $('rkPw').value;
    if (!password) throw new Error('Enter your password.');
    const { ring, s } = await readRing();
    if (!ring) return showRecovery();
    let mk = await KR.openWithPassword(ring, password);
    let base = ring;
    if (!mk) {
      const old = $('rkOld').value.trim();
      if (!(await rightPassword(password))) throw new Error('That password isn’t right.');
      if ($('rkOldLabel').hidden || !old) {
        $('rkOldLabel').hidden = false;
        $('rkOld').focus();
        throw new Error('Your password changed. Enter your recovery key too.');
      }
      mk = await KR.openWithRecovery(ring, old);
      if (!mk) throw new Error('That recovery key doesn’t open your account.');
      base = await KR.rewrapPassword(ring, mk, password);
    }
    if (!confirm('Make a new recovery key? The one you have stops working, in every app.')) return;
    const next = await KR.newRecovery(base, mk);
    const back = await writeRing(next.ring, s);
    if (!(await KR.isCurrentRecovery(back.ring, next.recovery))) throw new Error('Couldn’t save it. Try again.');
    $('rkPw').value = $('rkOld').value = '';
    $('rkOldLabel').hidden = true;
    $('rkKey').textContent = next.recovery;
    $('rkSaved').checked = false;
    $('rkDone').disabled = true;
    $('rkAsk').hidden = true;
    $('rkShow').hidden = false;
  });
  $('rkCopy').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText($('rkKey').textContent);
      $('rkCopy').textContent = 'Copied';
    } catch {
      getSelection()?.selectAllChildren($('rkKey'));
    }
  });
  $('rkDownload').addEventListener('click', () => {
    const made = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    const text = ['cristianbagrin.com recovery key', '', $('rkKey').textContent, '', `Account: ${$('who').textContent}`, `Made: ${made}`, '',
      'If you forget your password, this key gets you back into your synced data in every app.', 'Keep it somewhere safe, like a password manager.', ''].join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
    a.download = 'cristianbagrin.com recovery key.txt';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
  });
  $('rkSaved').addEventListener('change', () => ($('rkDone').disabled = !$('rkSaved').checked));
  $('rkDone').addEventListener('click', async () => {
    $('rkKey').textContent = '';
    $('rkCopy').textContent = 'Copy';
    await showRecovery();
    say('rkMsg', 'Saved. The old one no longer works.', true);
  });
}

/** Before a password change: the master key, if the current password opens it, to wrap under the new one. */
async function masterKey(password) {
  if (!KR) return null;
  try {
    const { ring } = await readRing();
    return ring ? await KR.openWithPassword(ring, password) : null;
  } catch {
    return null;
  }
}

/** After it: the keyring follows the new password. If this fails, each app asks once (or a signed-in device fixes it). */
async function rewrapAfterChange(mk, password) {
  for (let i = 0; i < 3; i++) {
    try {
      const { ring, s } = await readRing();
      if (!ring || (await KR.keyId(mk)) !== ring.id) return;
      const back = await writeRing(await KR.rewrapPassword(ring, mk, password), s);
      if (back.ring && (await KR.openWithPassword(back.ring, password))) return;
    } catch (err) {
      if (err.code !== 'changed') return console.error(err);
    }
  }
}

// ---------- /account ----------
let mode = 'signin';

function setMode(m) {
  mode = m;
  $('enterTitle').textContent = { signin: 'Sign in', signup: 'Create your account', forgot: 'Reset your password' }[m];
  $('enterLead').textContent = { signin: 'One account for Chinese Brain, At Peace, Money in Order and Ten Dollar Words.', signup: 'Free. Keeps each app in step across your browsers and devices.', forgot: 'We’ll email you a link to set a new one.' }[m];
  $('enterGo').textContent = { signin: 'Sign in', signup: 'Create account', forgot: 'Email me a link' }[m];
  $('pwLabel').hidden = m === 'forgot';
  $('password').required = m !== 'forgot';
  $('password').autocomplete = m === 'signup' ? 'new-password' : 'current-password';
  $('toSignup').hidden = m !== 'signin';
  $('toForgot').hidden = m !== 'signin';
  $('toSignin').hidden = m === 'signin';
  say('enterMsg', '');
}

/** Opened from the link in a confirm-your-new-email message. */
async function confirmEmail() {
  const m = location.hash.match(/^#confirm=(.+)$/);
  if (!m) return;
  history.replaceState(null, '', location.pathname + location.search);
  try {
    const res = await api('email/confirm', { token: m[1] });
    say('confirmMsg', `Done: your email is now ${res.email}.`, true);
    say('enterMsg', `Done: your email is now ${res.email}. Sign in with it.`, true);
  } catch (err) {
    say('confirmMsg', err.message);
    say('enterMsg', err.message);
  }
}

async function show() {
  if (!$('enter')) return;
  if (!token()) {
    $('manage').hidden = true;
    $('enter').hidden = false;
    return setMode(location.hash === '#signup' ? 'signup' : location.hash === '#forgot' ? 'forgot' : 'signin');
  }
  try {
    const me = await api('me');
    $('who').textContent = me.email;
    remember(me.email);
    $('stats').textContent = `Since ${new Date(me.created).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`;
    const apps = me.apps ?? { brain: me.words };
    $('n-brain').textContent = apps.brain ? `${apps.brain.toLocaleString('en-US')} ${apps.brain === 1 ? 'word' : 'words'}` : 'Not used yet';
    for (const app of ['ap', 'mio', 'tdw']) $(`n-${app}`).textContent = apps[app] ? 'Synced' : 'Not used yet';
    $('emailLead').textContent = me.pendingEmail
      ? `A link is waiting at ${me.pendingEmail}. Open it to finish, or send a new one.`
      : 'We’ll send a link to the new address. Your email changes once you open it.';
    $('enter').hidden = true;
    $('manage').hidden = false;
    await showRecovery();
  } catch (err) {
    if (err.code === 'signed_out') return signedOut();
    $('enter').hidden = false;
    say('enterMsg', err.message);
  }
}

if ($('enter')) {
  for (const [id, m] of [['toSignup', 'signup'], ['toForgot', 'forgot'], ['toSignin', 'signin']]) {
    $(id).addEventListener('click', (e) => {
      e.preventDefault();
      setMode(m);
    });
  }
  onSubmit($('enter'), 'enterMsg', async () => {
    const email = $('email').value;
    if (mode === 'forgot') {
      await api('forgot', { email });
      return say('enterMsg', 'If that email has an account, a link is on its way. Check your inbox (and spam).', true);
    }
    const res = await api(mode === 'signup' ? 'signup' : 'login', { email, password: $('password').value });
    localStorage.setItem('cb-token', res.token);
    remember(res.email);
    $('password').value = '';
    // Sent here by a page that needs you signed in: back to it (same site only).
    const next = new URLSearchParams(location.search).get('next');
    if (next && /^\/[a-z]/.test(next)) return void (location.href = next);
    await show();
  });
  recoveryForms();
  onSubmit($('pwForm'), 'pwMsg', async () => {
    const old = $('old').value;
    const next = $('next').value;
    const mk = next.length >= 8 ? await masterKey(old) : null;
    await api('password', { old, next });
    if (mk) await rewrapAfterChange(mk, next);
    $('old').value = $('next').value = '';
    say('pwMsg', 'Password changed. Your other browsers are signed out; sign in there with the new one.', true);
  });
  onSubmit($('emailForm'), 'emailMsg', async () => {
    const res = await api('email', { email: $('newEmail').value, password: $('emailPw').value });
    $('emailPw').value = '';
    say('emailMsg', `Check ${res.email} and open the link there. Until then, you sign in with your current email.`, true);
  });
  onSubmit($('delForm'), 'delMsg', async () => {
    if (!confirm('Delete your account and everything synced to it, in every app, for good?')) return;
    await api('delete', { password: $('delPw').value });
    signedOut();
    say('enterMsg', 'Your account is deleted.', true);
  });
  $('signout').addEventListener('click', async () => {
    await api('logout', {}).catch(() => {});
    signedOut();
  });
  $('download').addEventListener('click', async () => {
    const data = await api('export');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' }));
    a.download = 'account.json';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
  });
  confirmEmail().then(show);
}
