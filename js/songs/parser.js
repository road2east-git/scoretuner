import { parseChord } from '../music/theory.js';

const SECTION_RE = /^\s*[\[(]?\s*((?:pre-?)?(?:intro|verse|chorus|bridge|outro|interlude|solo|hook)|인트로|전주|(?:\d+\s*)?절|후렴|코러스|간주|브릿지|아웃트로)\s*(\d+)?\s*[\])]?\s*[:：]?\s*$/i;

const cleanToken = t => t.replace(/[|,.]/g, '');

export function isChordLine(line) {
  if (typeof line !== 'string') return false;
  const tokens = line.trim().split(/\s+/).map(cleanToken).filter(Boolean);
  if (!tokens.length) return false;
  const ok = tokens.filter(t => parseChord(t)).length;
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

// parseSheet의 역변환: 섹션 구조를 코드줄/가사줄 텍스트로 복원 (편집 모드 프리필용)
export function sheetToText(sections) {
  const out = [];
  for (const s of sections) {
    out.push(`[${s.name}]`);
    for (const l of s.lines) {
      if (l.chords.length) {
        let line = '';
        for (const c of l.chords) {
          if (line.length < c.position) line = line.padEnd(c.position, ' ');
          else if (line.length > 0) line += ' ';
          line += c.chord;
        }
        out.push(line);
      }
      if (l.lyrics) out.push(l.lyrics);
      else if (!l.chords.length) out.push(l.lyrics);
    }
    out.push('');
  }
  return out.join('\n').trimEnd();
}
