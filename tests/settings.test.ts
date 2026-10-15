import { test } from 'node:test';
import assert from 'node:assert/strict';
import { colorsOn, normalizeSettings } from '../src/shared/types.ts';

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
