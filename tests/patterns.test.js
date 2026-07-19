import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PATTERNS, getPattern, defaultPatternId, renderPatternTab } from '../js/music/patterns.js';

test('패턴 8종, 필수 필드', () => {
  assert.equal(PATTERNS.length, 8);
  for (const p of PATTERNS) {
    assert.ok(p.id && p.name && p.ts && p.type && Array.isArray(p.steps));
  }
});

test('defaultPatternId: 박자별 기본값', () => {
  assert.equal(defaultPatternId('4/4'), 'strum-basic');
  assert.equal(defaultPatternId('3/4'), 'strum-waltz');
  assert.equal(defaultPatternId('6/8'), 'arp-68');
});

test('renderPatternTab: 6줄, 균일한 길이', () => {
  const lines = renderPatternTab(getPattern('strum-basic'), 'C');
  assert.equal(lines.length, 6);
  assert.ok(lines.every(l => l.length === lines[0].length));
  assert.ok(lines[0].startsWith('e|'));
  assert.ok(lines[5].startsWith('E|'));
});

test('renderPatternTab: 스트로크는 운지 프렛 표시', () => {
  const lines = renderPatternTab(getPattern('strum-basic'), 'C');
  // C: 5번줄(A) 3프렛 → 'A' 줄에 3, 6번줄 뮤트 → 'E' 줄 첫 스텝은 '-'
  assert.ok(lines[4].includes('3'));
  assert.equal(lines[5][2], '-');
});

test('renderPatternTab: 아르페지오는 지정 줄만 표시', () => {
  const lines = renderPatternTab(getPattern('arp-8'), 'C');
  // 첫 스텝 = 6번줄이지만 C는 6번줄 뮤트 → 베이스는 5번줄(3프렛)로 대체
  assert.equal(lines[4][2], '3');
});
