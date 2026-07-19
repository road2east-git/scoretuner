import { CHORD_SHAPES } from './chords-db.js';

// steps: 8분음표 단위 / 'D' 다운, 'U' 업, 'X' 뮤트, '' 쉼, 숫자 = 뜯는 줄 번호(6=최저음)
export const PATTERNS = [
  { id: 'strum-basic',  name: '기본 스트로크',    ts: '4/4', type: 'strum', steps: ['D','','D','U','','U','D','U'] },
  { id: 'strum-ballad', name: '잔잔한 스트로크',  ts: '4/4', type: 'strum', steps: ['D','','','U','','U','',''] },
  { id: 'strum-pop',    name: '경쾌한 스트로크',  ts: '4/4', type: 'strum', steps: ['D','U','X','U','D','U','X','U'] },
  { id: 'strum-waltz',  name: '왈츠 스트로크',    ts: '3/4', type: 'strum', steps: ['D','','D','U','D','U'] },
  { id: 'arp-8',        name: '8비트 아르페지오', ts: '4/4', type: 'arp',   steps: [6,3,2,3,1,3,2,3] },
  { id: 'arp-ballad',   name: '발라드 아르페지오',ts: '4/4', type: 'arp',   steps: [6,3,2,1,2,3,2,3] },
  { id: 'arp-waltz',    name: '왈츠 아르페지오',  ts: '3/4', type: 'arp',   steps: [6,3,2,3,2,3] },
  { id: 'arp-68',       name: '6/8 아르페지오',   ts: '6/8', type: 'arp',   steps: [6,3,2,1,2,3] },
];

export const getPattern = id => PATTERNS.find(p => p.id === id) || PATTERNS[0];

export function defaultPatternId(ts) {
  if (ts === '3/4') return 'strum-waltz';
  if (ts === '6/8') return 'arp-68';
  return 'strum-basic';
}

const CELL = 4; // 스텝당 문자 폭
const ROW_NAMES = ['e', 'B', 'G', 'D', 'A', 'E']; // 표시 순서: 1번줄(위) → 6번줄(아래)

export function renderPatternTab(pattern, chordName) {
  const frets = CHORD_SHAPES[chordName] || CHORD_SHAPES.C;
  // frets 인덱스: 0=6번줄 → 5=1번줄. 표시 행 r(0=1번줄)의 프렛 = frets[5-r]
  const rows = ROW_NAMES.map(n => n + '|');
  const bass = frets.findIndex(f => f >= 0); // 최저음 유효 줄 인덱스(6번줄부터)
  for (const step of pattern.steps) {
    for (let r = 0; r < 6; r++) {
      const fi = 5 - r;
      let cell = '-';
      if (pattern.type === 'strum') {
        if (step === 'D' || step === 'U') cell = frets[fi] >= 0 ? String(frets[fi]) : '-';
        else if (step === 'X') cell = frets[fi] >= 0 ? 'x' : '-';
      } else if (typeof step === 'number') {
        let target = 6 - step;              // 줄 번호 → frets 인덱스
        if (frets[target] < 0) target = bass; // 뮤트된 줄이면 베이스 줄로 대체
        if (target === fi) cell = String(frets[fi]);
      }
      rows[r] += cell.padEnd(CELL, '-');
    }
  }
  return rows.map(r => r + '|');
}
