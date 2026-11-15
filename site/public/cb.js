// Shared by the signed-in pages: the session token (kept in this browser) and the API.
const $ = (id) => document.getElementById(id);
const token = () => {
  try {
    return localStorage.getItem('cb-token') ?? '';
  } catch {
    return '';
  }
};

async function api(path, body) {
  let res;
  try {
    res = await fetch(`/api/${path}`, {
      method: body === undefined ? 'GET' : 'POST',
      headers: { 'Content-Type': 'application/json', ...(token() ? { Authorization: `Bearer ${token()}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw Object.assign(new Error('Can’t reach the server. Check your connection.'), { code: 'offline' });
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error ?? 'Something went wrong. Try again in a moment.'), { code: data.code });
  return data;
}

function say(id, text, ok = false) {
  $(id).textContent = text;
  $(id).className = ok ? 'msg ok' : 'msg';
}
