#!/usr/bin/env node
// Uploads a zip to the Chrome Web Store and submits it for review, signed in as a Google Cloud
// service account (Chrome Web Store API v2). No OAuth consent screen, no refresh token to expire.
//
//   CWS_SERVICE_ACCOUNT='<the JSON key>' CWS_PUBLISHER_ID=… CWS_EXTENSION_ID=… node scripts/cws-publish.mjs <zip>
//
// Setup (once): store/PUBLISHING.md, "Automatic releases" → Chrome.
import { createSign } from 'node:crypto';
import { readFile } from 'node:fs/promises';

const API = 'https://chromewebstore.googleapis.com';
const SCOPE = 'https://www.googleapis.com/auth/chromewebstore';

const [zipPath] = process.argv.slice(2);
const { CWS_SERVICE_ACCOUNT, CWS_PUBLISHER_ID: publisher, CWS_EXTENSION_ID: item } = process.env;
if (!zipPath || !CWS_SERVICE_ACCOUNT || !publisher || !item) {
  console.error('Usage: CWS_SERVICE_ACCOUNT=<json> CWS_PUBLISHER_ID=… CWS_EXTENSION_ID=… node scripts/cws-publish.mjs <zip>');
  process.exit(2);
}

const b64url = (data) => Buffer.from(data).toString('base64url');

/** A short-lived access token from the service account's JSON key (OAuth 2.0 JWT bearer grant). */
async function accessToken() {
  const key = JSON.parse(CWS_SERVICE_ACCOUNT);
  const now = Math.floor(Date.now() / 1000);
  const head = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = b64url(JSON.stringify({ iss: key.client_email, scope: SCOPE, aud: key.token_uri ?? 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 }));
  const signature = createSign('RSA-SHA256').update(`${head}.${claims}`).sign(key.private_key, 'base64url');
  const res = await fetch(key.token_uri ?? 'https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${head}.${claims}.${signature}` }),
  });
  const data = await res.json();
  if (!res.ok || !data.access_token) throw new Error(`Google sign-in failed: ${res.status} ${JSON.stringify(data)}`);
  return data.access_token;
}

async function call(token, method, path, body, headers = {}) {
  const res = await fetch(API + path, { method, headers: { Authorization: `Bearer ${token}`, ...headers }, body });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = { text };
  }
  if (!res.ok) throw new Error(`${method} ${path}: ${res.status} ${text}`);
  return data;
}

const token = await accessToken();
const itemPath = `/v2/publishers/${publisher}/items/${item}`;

console.log(`Uploading ${zipPath}…`);
const upload = await call(token, 'POST', `/upload${itemPath}:upload`, await readFile(zipPath), { 'Content-Type': 'application/zip' });
console.log('upload:', JSON.stringify(upload));

// Large packages are processed after the upload returns; wait until it is done.
let state = upload.uploadState;
for (let i = 0; state === 'IN_PROGRESS' && i < 30; i++) {
  await new Promise((r) => setTimeout(r, 5000));
  const status = await call(token, 'GET', `${itemPath}:fetchStatus`);
  state = status.lastAsyncUploadState ?? status.uploadState ?? state;
  console.log('upload state:', state);
}
if (state && !['SUCCEEDED', 'SUCCESS'].includes(state)) throw new Error(`Upload did not succeed: ${state} ${JSON.stringify(upload)}`);

const published = await call(token, 'POST', `${itemPath}:publish`, JSON.stringify({}), { 'Content-Type': 'application/json' });
console.log('publish:', JSON.stringify(published));
const status = await call(token, 'GET', `${itemPath}:fetchStatus`);
console.log('status:', JSON.stringify(status));
