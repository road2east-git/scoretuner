import { noteToFreq, parseChord, NOTES } from '../music/theory.js';

export function goertzelMag(buf, sampleRate, freq) {
  const w = 2 * Math.PI * freq / sampleRate;
  const coeff = 2 * Math.cos(w);
  let s1 = 0, s2 = 0;
  for (let i = 0; i < buf.length; i++) {
    const s0 = buf[i] + coeff * s1 - s2;
    s2 = s1; s1 = s0;
  }
  return Math.sqrt(s1 * s1 + s2 * s2 - coeff * s1 * s2);
}

export function chromaVector(buf, sampleRate, a4 = 440) {
  const v = new Array(12).fill(0);
  for (let midi = 40; midi <= 76; midi++)   // E2 ~ E5
    v[midi % 12] += goertzelMag(buf, sampleRate, noteToFreq(midi, a4));
  const max = Math.max(...v);
  return max ? v.map(x => x / max) : v;
}

const INTERVALS = { '': [0, 4, 7], m: [0, 3, 7], 7: [0, 4, 7, 10], m7: [0, 3, 7, 10] };

export function chordTemplate(sym) {
  const c = parseChord(sym);
  const t = new Array(12).fill(0);
  if (!c) return t;
  for (const iv of INTERVALS[c.quality] || INTERVALS[''])
    t[(NOTES.indexOf(c.root) + iv) % 12] = 1;
  return t;
}

export function cosine(a, b) {
  let d = 0, na = 0, nb = 0;
  for (let i = 0; i < 12; i++) { d += a[i] * b[i]; na += a[i] ** 2; nb += b[i] ** 2; }
  return na && nb ? d / Math.sqrt(na * nb) : 0;
}

export function matchChord(chroma, candidates) {
  let best = null;
  for (const sym of candidates) {
    const score = cosine(chroma, chordTemplate(sym));
    if (!best || score > best.score) best = { chord: sym, score };
  }
  return best;
}
