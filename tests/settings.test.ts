import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cardMode, colorsOn, normalizeSettings, setSiteMode, siteHost } from '../src/shared/types.ts';

test('holding Shift became holding Option', () => {
  assert.equal(normalizeSettings({ hoverMode: 'shift' }).hoverMode, 'alt');
  assert.equal(normalizeSettings({ hoverMode: 'off' }).hoverMode, 'off');
});

test('page colors: a site exception wins over the switch', () => {
  const s = normalizeSettings({ pageColors: true, siteColors: { 'notion.so': false } });
  assert.equal(colorsOn(s, 'notion.so'), false);
  assert.equal(colorsOn(s, 'example.com'), true);
  assert.equal(colorsOn(normalizeSettings({}), 'example.com'), false);
  assert.equal(colorsOn(normalizeSettings({ siteColors: { 'example.com': true } }), 'example.com'), true);
});

test('a frame follows the switches of the website it is shown on', () => {
  // Claude's artifacts render in a frame on another domain (or about:blank); claude.ai's switch must win.
  const s = normalizeSettings({ pageColors: true, siteColors: { 'claude.ai': false } });
  const host = siteHost('https://claude.ai/chat/abc', 'xyz.claudeusercontent.com');
  assert.equal(host, 'claude.ai');
  assert.equal(colorsOn(s, host), false);
  assert.equal(colorsOn(s, siteHost('https://claude.ai/', '')), false, 'about:blank frames too');
  const off = normalizeSettings({ pageColors: false, siteColors: { 'claude.ai': true } });
  assert.equal(colorsOn(off, siteHost('https://claude.ai/', 'xyz.claudeusercontent.com')), true, 'global off, site on');
  assert.equal(siteHost('chrome://newtab/', 'own.com'), 'own.com');
  assert.equal(siteHost(undefined, 'own.com'), 'own.com');
});

test('a website can be an exception to how the card opens', () => {
  const hover = normalizeSettings({ hoverMode: 'hover', altSites: ['docs.google.com'], hoverSites: ['ignored.com'] });
  assert.equal(cardMode(hover, 'docs.google.com'), 'alt');
  assert.equal(cardMode(hover, 'ignored.com'), 'hover', 'the other list only counts with Option chosen');
  assert.equal(cardMode(hover, 'example.com'), 'hover');
  const alt = normalizeSettings({ hoverMode: 'alt', hoverSites: ['youtube.com'], altSites: ['docs.google.com'] });
  assert.equal(cardMode(alt, 'youtube.com'), 'hover');
  assert.equal(cardMode(alt, 'docs.google.com'), 'alt');
  assert.equal(cardMode(normalizeSettings({ hoverMode: 'off', hoverSites: ['a.com'] }), 'a.com'), 'off');
  assert.equal(cardMode(normalizeSettings({ disabledSites: ['a.com'] }), 'a.com'), 'off');
});

test('picking a website’s mode in the toolbar menu writes the right list', () => {
  const s = normalizeSettings({ hoverMode: 'hover' });
  assert.deepEqual(setSiteMode(s, 'a.com', 'alt'), { altSites: ['a.com'], hoverSites: [], disabledSites: [] });
  const s2 = { ...s, ...setSiteMode(s, 'a.com', 'alt') };
  assert.deepEqual(setSiteMode(s2, 'a.com', 'hover'), { altSites: [], hoverSites: [], disabledSites: [] }, 'back to the choice: no exception');
  assert.deepEqual(setSiteMode(s2, 'a.com', 'off'), { altSites: [], hoverSites: [], disabledSites: ['a.com'] });
  const a = normalizeSettings({ hoverMode: 'alt' });
  assert.deepEqual(setSiteMode(a, 'b.com', 'hover'), { altSites: [], hoverSites: ['b.com'], disabledSites: [] });
});

test('clicking a new word: the old on/off switch becomes a pile', () => {
  assert.equal(normalizeSettings({}).clickStamp, 'fresh');
  assert.equal(normalizeSettings({ autoFreshOnClick: false }).clickStamp, 'off');
  assert.equal(normalizeSettings({ autoFreshOnClick: true }).clickStamp, 'fresh');
  assert.equal(normalizeSettings({ clickStamp: 'known' }).clickStamp, 'known');
  assert.equal(normalizeSettings({ clickStamp: 'nonsense' }).clickStamp, 'fresh');
  assert.ok(!('autoFreshOnClick' in normalizeSettings({ autoFreshOnClick: false })));
});
