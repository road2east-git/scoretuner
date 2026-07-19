// frets: [6번줄(저음 E) → 1번줄] / -1 = 뮤트, 0 = 개방현
export const CHORD_SHAPES = {
  A:  [-1,0,2,2,2,0],  Am: [-1,0,2,2,1,0], A7: [-1,0,2,0,2,0],
  Bb: [-1,1,3,3,3,1],  Bm: [-1,2,4,4,3,2], Bm7:[-1,2,4,2,3,2],
  C:  [-1,3,2,0,1,0],  C7: [-1,3,2,3,1,0],
  D:  [-1,-1,0,2,3,2], Dm: [-1,-1,0,2,3,1], D7: [-1,-1,0,2,1,2], Dm7:[-1,-1,0,2,1,1],
  E:  [0,2,2,1,0,0],   Em: [0,2,2,0,0,0],  E7: [0,2,0,1,0,0],
  F:  [1,3,3,2,1,1],   Fm: [1,3,3,1,1,1],
  G:  [3,2,0,0,0,3],   G7: [3,2,0,0,0,1],  Gm: [3,5,5,3,3,3],
  // 편곡 폴백 대비 보조 운지
  Am7:[-1,0,2,0,1,0],  B7: [-1,2,1,2,0,2], Em7:[0,2,0,0,0,0],
};

export function chordSVG(name) {
  const frets = CHORD_SHAPES[name];
  if (!frets) return '';
  const fretted = frets.filter(f => f > 0);
  const baseFret = fretted.length && Math.max(...fretted) > 4 ? Math.min(...fretted) : 1;
  const W = 64, H = 78, left = 10, top = 20, cw = (W - 20) / 5, rh = (H - top - 6) / 4;
  let s = `<svg class="chord-svg" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">`;
  s += `<text x="${W / 2}" y="11" text-anchor="middle" font-size="11" font-weight="700" fill="currentColor">${name}</text>`;
  for (let i = 0; i <= 4; i++)  // 프렛 가로선
    s += `<line x1="${left}" y1="${top + i * rh}" x2="${W - 10}" y2="${top + i * rh}" stroke="currentColor" stroke-width="${i === 0 && baseFret === 1 ? 2.5 : 1}"/>`;
  for (let i = 0; i <= 5; i++)  // 줄 세로선 (왼쪽=6번줄)
    s += `<line x1="${left + i * cw}" y1="${top}" x2="${left + i * cw}" y2="${top + 4 * rh}" stroke="currentColor" stroke-width="1"/>`;
  if (baseFret > 1)
    s += `<text x="2" y="${top + rh * 0.65}" font-size="8" fill="currentColor">${baseFret}</text>`;
  frets.forEach((f, i) => {
    const x = left + i * cw;
    if (f === -1) s += `<text x="${x}" y="${top - 3}" text-anchor="middle" font-size="8" fill="currentColor">×</text>`;
    else if (f === 0) s += `<circle cx="${x}" cy="${top - 6}" r="2.6" fill="none" stroke="currentColor"/>`;
    else s += `<circle cx="${x}" cy="${top + (f - baseFret + 0.5) * rh}" r="4" fill="currentColor"/>`;
  });
  return s + '</svg>';
}
