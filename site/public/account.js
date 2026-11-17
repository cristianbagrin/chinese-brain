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

function signedOut() {
  localStorage.removeItem('cb-token');
  show();
}

// ---------- /reset ----------
if ($('reset')) {
  onSubmit($('reset'), 'msg', async () => {
    const res = await api('reset', { token: location.hash.slice(1), password: $('next').value });
    localStorage.setItem('cb-token', res.token);
    say('msg', 'Password saved. Taking you to your account…', true);
    setTimeout(() => (location.href = '/account'), 900);
  });
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
    $('stats').textContent = `Since ${new Date(me.created).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`;
    const apps = me.apps ?? { brain: me.words };
    $('n-brain').textContent = apps.brain ? `${apps.brain.toLocaleString('en-US')} ${apps.brain === 1 ? 'word' : 'words'}` : 'Not used yet';
    for (const app of ['ap', 'mio', 'tdw']) $(`n-${app}`).textContent = apps[app] ? 'Synced' : 'Not used yet';
    $('emailLead').textContent = me.pendingEmail
      ? `A link is waiting at ${me.pendingEmail}. Open it to finish, or send a new one.`
      : 'We’ll send a link to the new address. Your email changes once you open it.';
    $('enter').hidden = true;
    $('manage').hidden = false;
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
    $('password').value = '';
    // Sent here by a page that needs you signed in: back to it (same site only).
    const next = new URLSearchParams(location.search).get('next');
    if (next && /^\/[a-z]/.test(next)) return void (location.href = next);
    await show();
  });
  onSubmit($('pwForm'), 'pwMsg', async () => {
    await api('password', { old: $('old').value, next: $('next').value });
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
