import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CHORD_SHAPES, chordSVG } from '../js/music/chords-db.js';
import { EASY_CHORDS } from '../js/music/arrange.js';

test('허용 코드 20개 전부 운지 보유', () => {
  for (const name of EASY_CHORDS)
    assert.ok(CHORD_SHAPES[name], `${name} 운지 누락`);
});

test('운지는 6줄 배열', () => {
  for (const [name, frets] of Object.entries(CHORD_SHAPES))
    assert.equal(frets.length, 6, name);
});

test('chordSVG: svg 문자열 생성, 미보유 코드는 빈 문자열', () => {
  assert.ok(chordSVG('C').startsWith('<svg'));
  assert.equal(chordSVG('Zzz'), '');
});

test('chordSVG: 모든 프렛 점이 그리드 내부에 위치', () => {
  const top = 20, bottom = 20 + 4 * ((78 - 20 - 6) / 4);
  for (const name of Object.keys(CHORD_SHAPES)) {
    for (const m of chordSVG(name).matchAll(/cy="([\d.]+)" r="4"/g)) {
      const cy = Number(m[1]);
      assert.ok(cy >= top && cy <= bottom, `${name} 점이 그리드 밖: cy=${cy}`);
    }
  }
});
