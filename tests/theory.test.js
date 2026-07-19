import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseChord, transposeChord, freqToNote, noteToFreq, GUITAR_STRINGS }
  from '../js/music/theory.js';

test('parseChord: 기본/플랫/분수 코드', () => {
  assert.deepEqual(parseChord('C'), { root: 'C', quality: '', bass: null });
  assert.deepEqual(parseChord('Bb'), { root: 'A#', quality: '', bass: null });
  assert.deepEqual(parseChord('F#m7'), { root: 'F#', quality: 'm7', bass: null });
  assert.deepEqual(parseChord('G/B'), { root: 'G', quality: '', bass: 'B' });
});

test('parseChord: 코드가 아니면 null', () => {
  assert.equal(parseChord('Hello'), null);
  assert.equal(parseChord('나비'), null);
  assert.equal(parseChord('Cxyz'), null);
});

test('transposeChord: 이조와 표기', () => {
  assert.equal(transposeChord('C', 2), 'D');
  assert.equal(transposeChord('Bb', -1), 'A');
  assert.equal(transposeChord('A', 1), 'Bb');   // A# 대신 Bb 표기
  assert.equal(transposeChord('Em', 12), 'Em');
});

test('freqToNote: A4=440 기준', () => {
  const a4 = freqToNote(440);
  assert.equal(a4.name, 'A'); assert.equal(a4.octave, 4); assert.equal(a4.cents, 0);
  assert.equal(freqToNote(445).cents, 20);       // 약 +20센트
  assert.equal(freqToNote(82.41).name, 'E');     // 6번줄
});

test('noteToFreq: 왕복 변환', () => {
  assert.ok(Math.abs(noteToFreq(69) - 440) < 0.001);
  assert.ok(Math.abs(noteToFreq(40) - 82.41) < 0.01); // E2
});

test('GUITAR_STRINGS: 6줄 표준 튜닝', () => {
  assert.equal(GUITAR_STRINGS.length, 6);
  assert.equal(GUITAR_STRINGS[0].midi, 40); // 6번줄 E2
  assert.equal(GUITAR_STRINGS[5].midi, 64); // 1번줄 E4
});
