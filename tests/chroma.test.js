import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chromaVector, chordTemplate, matchChord } from '../js/audio/chroma.js';

const SR = 44100;
function chordSignal(freqs, n = 8192) {
  const buf = new Float32Array(n);
  for (const f of freqs)
    for (let i = 0; i < n; i++) buf[i] += 0.3 * Math.sin(2 * Math.PI * f * i / SR);
  return buf;
}

test('chordTemplate: C 메이저는 C,E,G 활성', () => {
  const t = chordTemplate('C');
  assert.equal(t[0], 1); assert.equal(t[4], 1); assert.equal(t[7], 1);
  assert.equal(t.reduce((a, b) => a + b), 3);
});

test('C 코드 소리 → C로 매칭', () => {
  // C3(130.81) E3(164.81) G3(196.00)
  const v = chromaVector(chordSignal([130.81, 164.81, 196.0]), SR);
  const r = matchChord(v, ['C', 'F', 'G', 'Am']);
  assert.equal(r.chord, 'C');
  assert.ok(r.score > 0.6);
});

test('G7 코드 소리 → G7로 매칭', () => {
  // G2(98) B2(123.47) D3(146.83) F3(174.61)
  const v = chromaVector(chordSignal([98, 123.47, 146.83, 174.61]), SR);
  const r = matchChord(v, ['C', 'G7', 'Am', 'Em']);
  assert.equal(r.chord, 'G7');
});
