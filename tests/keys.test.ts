import assert from 'node:assert/strict';
import { test } from 'node:test';
import { actionFor, keyLabel, keyName, keyOf } from '../src/shared/keys.ts';
import { DEFAULT_SETTINGS, normalizeSettings } from '../src/shared/types.ts';

test('default keys', () => {
  const s = DEFAULT_SETTINGS;
  assert.equal(actionFor(s, { key: '1' }, 'card'), 'fresh');
  assert.equal(actionFor(s, { key: 'V' }, 'card'), 'say');
  assert.equal(actionFor(s, { key: 'a' }, 'yt'), 'prev');
  assert.equal(actionFor(s, { key: 'a' }, 'card'), undefined);
  assert.equal(actionFor(s, { key: 'Escape' }, 'card'), undefined);
});

test('your own keys replace the defaults; settings saved before shortcuts existed still work', () => {
  const s = normalizeSettings({ keys: { known: 'k', loop: '' }, pinyin: false });
  assert.equal(actionFor(s, { key: 'k' }, 'card'), 'known');
  assert.equal(actionFor(s, { key: '3' }, 'card'), undefined);
  assert.equal(keyOf(s, 'loop'), '');
  assert.equal(actionFor(s, { key: 'r' }, 'yt'), undefined);
  assert.equal(actionFor(normalizeSettings({ pinyin: false }), { key: '3' }, 'card'), 'known');
});

test('key names and labels', () => {
  assert.equal(keyName({ key: 'K' }), 'k');
  assert.equal(keyName({ key: 'F2' }), 'F2');
  assert.equal(keyLabel('k'), 'K');
  assert.equal(keyLabel(' '), 'Space');
});
