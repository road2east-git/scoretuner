import { parseChord } from '../music/theory.js';

const SECTION_RE = /^\s*[\[(]?\s*((?:pre-?)?(?:intro|verse|chorus|bridge|outro|interlude|solo|hook)|인트로|전주|(?:\d+\s*)?절|후렴|코러스|간주|브릿지|아웃트로)\s*(\d+)?\s*[\])]?\s*[:：]?\s*$/i;

const cleanToken = t => t.replace(/[|,.]/g, '');

export function isChordLine(line) {
  const tokens = line.trim().split(/\s+/).filter(Boolean);
  if (!tokens.length) return false;
  const ok = tokens.filter(t => parseChord(cleanToken(t))).length;
  return ok / tokens.length >= 0.6;
}

function chordPositions(line) {
  const out = [];
  const re = /\S+/g;
  let m;
  while ((m = re.exec(line))) {
    if (parseChord(cleanToken(m[0])))
      out.push({ chord: cleanToken(m[0]), position: m.index });
  }
  return out;
}

export function parseSheet(text) {
  const lines = String(text).replace(/\r/g, '').split('\n');
  const sections = [];
  let cur = null;
  const open = name => { cur = { name, lines: [] }; sections.push(cur); };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    const sec = line.trim().match(SECTION_RE);
    if (sec) { open(line.replace(/[\[\]():：]/g, '').trim()); continue; }
    if (!cur) open('Verse');
    if (isChordLine(line)) {
      const next = lines[i + 1] || '';
      if (next.trim() && !isChordLine(next) && !next.trim().match(SECTION_RE)) {
        cur.lines.push({ chords: chordPositions(line), lyrics: next.trimEnd() });
        i++;
      } else {
        cur.lines.push({ chords: chordPositions(line), lyrics: '' });
      }
    } else {
      cur.lines.push({ chords: [], lyrics: line.trimEnd() });
    }
  }
  if (!sections.length || !sections.some(s => s.lines.length))
    throw new Error('악보 형식을 인식하지 못했습니다');
  return sections;
}
