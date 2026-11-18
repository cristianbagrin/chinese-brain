import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { annotate, clean, PAGES } from '../site/src/copy.ts';

const page = (body: string) => `<!doctype html><html><head><title>T</title></head><body>${body}</body></html>`;

test('every piece of text gets a name from its words, the same every time', () => {
  const a = annotate(page('<main><h1>Hello <span>there</span></h1><p>One.</p><p>One.</p></main>'));
  const keys = Object.keys(a.texts);
  assert.equal(keys.length, 3);
  assert.equal(a.texts[keys[0]], 'Hello <span>there</span>');
  assert.equal(keys[2], `${keys[1]}-1`); // the same words twice on a page
  assert.match(a.html, new RegExp(`<h1 data-copy="${keys[0]}">Hello <span>there</span></h1>`));
  assert.deepEqual(annotate(page('<main><h1>Hello <span>there</span></h1></main>')).texts, { [keys[0]]: 'Hello <span>there</span>' });
});

test('new words in the source mean a new name, so an old edit no longer applies', () => {
  const [a] = Object.keys(annotate(page('<p>Old words</p>')).texts);
  const [b] = Object.keys(annotate(page('<p>New words</p>')).texts);
  assert.notEqual(a, b);
});

test('scripts, buttons, the demo and counters are left alone; blocks can be removed', () => {
  const a = annotate(page('<section><div data-demo><p>今天</p></div><button>Go</button><i data-n="x">0</i><p>Words</p></section><script>let x = "<p>no</p>";</script>'));
  assert.deepEqual(Object.values(a.texts), ['Words']);
  assert.equal(a.blocks.length, 1);
  assert.match(a.html, /<section data-block="r[0-9a-z]+">/);
});

test("a label's words get their own span, so its field stays as it is", () => {
  const src = page('<label>Email<input type="email" id="e"></label>');
  const a = annotate(src);
  const [k] = Object.keys(a.texts);
  assert.equal(a.texts[k], 'Email');
  assert.match(a.html, new RegExp(`<label><span data-copy="${k}">Email</span><input type="email" id="e"></label>`));
  assert.equal(src.slice(...a.spans[k]), 'Email');
});

test('edits never carry scripts', () => {
  assert.equal(clean('Hi <script>alert(1)</script><a href="javascript:x" onclick="y()">x</a>'), 'Hi alert(1)<a href="x">x</a>');
});

test("every page Chris edits exists and marks its words", () => {
  for (const [, , asset] of PAGES) {
    const a = annotate(readFileSync(`site/public${asset}.html`, 'utf8'));
    assert.ok(Object.keys(a.texts).length > 3, asset);
  }
});
