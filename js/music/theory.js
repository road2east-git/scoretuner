export const NOTES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
const FLATS = { Db:'C#', Eb:'D#', Gb:'F#', Ab:'G#', Bb:'A#', Cb:'B', Fb:'E' };
const DISPLAY = { 'A#':'Bb', 'D#':'Eb', 'G#':'Ab' };
const QUALITIES = new Set(['','m','7','m7','maj7','M7','maj9','6','m6','9','m9','11','m11','13',
  'sus2','sus4','7sus4','add9','madd9','dim','dim7','m7b5','aug','aug7','5']);

export function normalizeRoot(r) { return FLATS[r] || r; }
export function displayChord(root, quality) { return (DISPLAY[root] || root) + quality; }

export function parseChord(sym) {
  if (typeof sym !== 'string') return null;
  const m = sym.trim().match(/^([A-G][b#]?)([^/\s]*)(?:\/([A-G][b#]?))?$/);
  if (!m || !QUALITIES.has(m[2] || '')) return null;
  return { root: normalizeRoot(m[1]), quality: m[2] || '', bass: m[3] ? normalizeRoot(m[3]) : null };
}

export function transposeChord(sym, semis) {
  const c = parseChord(sym);
  if (!c) return sym;
  const t = n => NOTES[(NOTES.indexOf(n) + (semis % 12) + 12) % 12];
  const bass = c.bass ? '/' + (DISPLAY[t(c.bass)] || t(c.bass)) : '';
  return displayChord(t(c.root), c.quality) + bass;
}

export function noteToFreq(midi, a4 = 440) { return a4 * 2 ** ((midi - 69) / 12); }

export function freqToNote(freq, a4 = 440) {
  const midiFloat = 69 + 12 * Math.log2(freq / a4);
  const midi = Math.round(midiFloat);
  return {
    midi,
    name: NOTES[((midi % 12) + 12) % 12],
    octave: Math.floor(midi / 12) - 1,
    cents: Math.round((midiFloat - midi) * 100),
  };
}

export const GUITAR_STRINGS = [
  { no: 6, label: 'E2', midi: 40 }, { no: 5, label: 'A2', midi: 45 },
  { no: 4, label: 'D3', midi: 50 }, { no: 3, label: 'G3', midi: 55 },
  { no: 2, label: 'B3', midi: 59 }, { no: 1, label: 'E4', midi: 64 },
];
