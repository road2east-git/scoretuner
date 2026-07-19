import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isChordLine, parseSheet } from '../js/songs/parser.js';

test('isChordLine: 코드 줄 판별', () => {
  assert.equal(isChordLine('C        G7       Am'), true);
  assert.equal(isChordLine('나의 살던 고향은'), false);
  assert.equal(isChordLine('A boy walked home'), false); // 60% 미달 (A만 코드)
});

test('parseSheet: 코드줄+가사줄 페어링과 위치', () => {
  const text = [
    '[Verse 1]',
    'C        G7',
    '나의 살던 고향은',
    'F        C',
    '꽃피는 산골',
  ].join('\n');
  const sections = parseSheet(text);
  assert.equal(sections.length, 1);
  assert.equal(sections[0].name.toLowerCase().includes('verse'), true);
  const line0 = sections[0].lines[0];
  assert.equal(line0.lyrics, '나의 살던 고향은');
  assert.deepEqual(line0.chords.map(c => c.chord), ['C', 'G7']);
  assert.equal(line0.chords[0].position, 0);
  assert.equal(line0.chords[1].position, 9);
});

test('parseSheet: 한국어 섹션 헤더 인식', () => {
  const sections = parseSheet('후렴\nC G\n라라라');
  assert.equal(sections[0].name, '후렴');
});

test('parseSheet: 가사 없는 코드 줄(간주)', () => {
  const sections = parseSheet('간주\nC  G  Am  F');
  assert.equal(sections[0].lines[0].lyrics, '');
  assert.equal(sections[0].lines[0].chords.length, 4);
});

test('isChordLine: 막대 표기 코드 줄 인식', () => {
  assert.equal(isChordLine('| C | G | Am | F |'), true);
  assert.equal(isChordLine(null), false);
});

test('parseSheet: 막대 표기 줄의 코드 추출', () => {
  const sections = parseSheet('간주\n| C | G | Am | F |');
  assert.deepEqual(sections[0].lines[0].chords.map(c => c.chord), ['C', 'G', 'Am', 'F']);
});

test('parseSheet: 인식 불가 텍스트는 예외', () => {
  assert.throws(() => parseSheet('   \n  \n'));
});
