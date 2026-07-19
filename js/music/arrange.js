import { parseChord, displayChord, transposeChord, NOTES } from './theory.js';

export const EASY_CHORDS = ['A','Am','A7','Bb','Bm','Bm7','C','C7','D','Dm','D7','Dm7',
  'E','Em','E7','F','Fm','G','G7','Gm'];
const EASY = new Set(EASY_CHORDS.map(s => { const c = parseChord(s); return c.root + c.quality; }));

const QUALITY_MAP = { '':'', maj7:'', M7:'', maj9:'', 6:'', add9:'', sus2:'', sus4:'', 5:'', aug:'',
  m:'m', m6:'m', madd9:'m', dim:'m', dim7:'m', m7b5:'m7',
  7:'7', 9:'7', 11:'7', 13:'7', '7sus4':'7', aug7:'7',
  m7:'m7', m9:'m7', m11:'m7' };

function simplify(sym) {
  const c = parseChord(sym);
  return c ? { root: c.root, quality: QUALITY_MAP[c.quality] ?? '' } : null;
}

const FALLBACKS = { m7: ['m'], 7: [''], '': ['7'], m: ['m7'] };
function easyVariant(c) {
  if (EASY.has(c.root + c.quality)) return c;
  for (const q of FALLBACKS[c.quality] || [])
    if (EASY.has(c.root + q)) return { root: c.root, quality: q };
  return null;
}

export function toEasy(sym) {
  const s = simplify(sym);
  if (!s) return sym;
  const v = easyVariant(s);
  if (v) return displayChord(v.root, v.quality);
  for (const d of [1, -1]) {   // 마지막 수단: 근음 반음 이동
    const root = NOTES[(NOTES.indexOf(s.root) + d + 12) % 12];
    const v2 = easyVariant({ root, quality: s.quality });
    if (v2) return displayChord(v2.root, v2.quality);
  }
  return displayChord(s.root, s.quality);
}

export function scoreKey(chords, semis) {
  const uniq = [...new Set(chords)];
  if (!uniq.length) return 1;
  let easy = 0;
  for (const sym of uniq) {
    const s = simplify(transposeChord(sym, semis));
    if (s && easyVariant(s)) easy++;
  }
  return easy / uniq.length;
}

export function bestArrangement(chords) {
  let best = { semitones: 0, score: -1 };
  for (let semis = -6; semis <= 6; semis++) {
    const score = scoreKey(chords, semis);
    if (score > best.score + 1e-9 ||
        (Math.abs(score - best.score) < 1e-9 && Math.abs(semis) < Math.abs(best.semitones)))
      best = { semitones: semis, score };
  }
  const capo = ((12 - best.semitones) % 12);
  return { ...best, capo: best.semitones !== 0 && capo <= 7 ? capo : 0 };
}

export function arrangeSections(sections) {
  const all = sections.flatMap(s => s.lines.flatMap(l => l.chords.map(c => c.chord)));
  const best = bestArrangement(all);
  const out = sections.map(s => ({
    name: s.name,
    lines: s.lines.map(l => ({
      lyrics: l.lyrics,
      chords: l.chords.map(c => ({
        position: c.position,
        chord: toEasy(transposeChord(c.chord, best.semitones)),
      })),
    })),
  }));
  return { sections: out, ...best };
}
