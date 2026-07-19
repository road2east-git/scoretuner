import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toEasy, scoreKey, bestArrangement, arrangeSections } from '../js/music/arrange.js';

test('toEasy: 확장 코드 단순화', () => {
  assert.equal(toEasy('Cmaj7'), 'C');
  assert.equal(toEasy('Am9'), 'Am');   // m9 -> m7 단순화 후 Am7 비허용 → m 폴백
});

test('toEasy: 허용 집합 내 코드는 유지', () => {
  assert.equal(toEasy('G7'), 'G7');
  assert.equal(toEasy('Bm7'), 'Bm7');
});

test('toEasy: 비허용 코드는 성질 폴백/근음 이동', () => {
  assert.equal(toEasy('Em7'), 'Em');    // m7 -> m 폴백 (Em7 비허용, Em 허용)
  assert.equal(toEasy('C#m7'), 'Dm7');  // 근음 반음 이동 폴백
});

test('scoreKey: 전부 쉬운 키는 1', () => {
  assert.equal(scoreKey(['C', 'Am', 'F', 'G7'], 0), 1);
});

test('bestArrangement: B-E-F# 진행은 +1 이조로 해결', () => {
  const r = bestArrangement(['B', 'E', 'F#']);
  assert.equal(r.semitones, 1);         // C, F, G — 전부 허용
  assert.equal(r.score, 1);
});

test('bestArrangement: 카포 제안', () => {
  // -1 이조 → D, G, A (전부 허용). -3(C,F,G)도 만점이지만 |−1|이 원곡 키에 더 가까워 선택됨
  const r = bestArrangement(['Eb', 'Ab', 'Bb']);
  assert.equal(r.semitones, -1);
  assert.equal(r.capo, 1);
});

test('arrangeSections: 섹션 구조 유지하며 편곡', () => {
  const sections = [{ name: 'Verse', lines: [
    { chords: [{ chord: 'B', position: 0 }, { chord: 'E', position: 8 }], lyrics: '가사입니다' },
  ]}];
  const r = arrangeSections(sections);
  assert.equal(r.semitones, 1);
  assert.equal(r.sections[0].lines[0].chords[0].chord, 'C');
  assert.equal(r.sections[0].lines[0].chords[0].position, 0);
  assert.equal(r.sections[0].lines[0].lyrics, '가사입니다');
});
