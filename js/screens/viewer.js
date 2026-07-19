import { navigate, registerScreen } from '../bus.js';
import { getSong, saveSong } from '../songs/store.js';
import { transposeChord } from '../music/theory.js';
import { toEasy } from '../music/arrange.js';
import { chordSVG } from '../music/chords-db.js';
import { getPattern, renderPatternTab } from '../music/patterns.js';

const esc = s => String(s ?? '').replace(/[&<>"']/g,
  c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const root = document.getElementById('screen-viewer');
let song = null, tabMode = false;

const shiftChord = c => {
  const ks = Number(song.keyShift) || 0;
  return ks ? toEasy(transposeChord(c, ks)) : c;
};

function uniqueChords() {
  const set = new Set();
  song.sections.forEach(s => s.lines.forEach(l => l.chords.forEach(c => set.add(shiftChord(c.chord)))));
  return [...set];
}

// 한 줄을 코드 위치 기준 세그먼트로 나눠 렌더 (코드가 가사 위에 정렬됨)
function lineHTML(line) {
  const lyrics = String(line.lyrics ?? '');
  if (!line.chords.length)
    return `<div class="v-line"><span class="v-seg"><i></i><em>${esc(lyrics)}</em></span></div>`;
  const segs = [];
  const cuts = [...line.chords.map(c => c.position), Infinity];
  if (line.chords[0].position > 0)
    segs.push({ chord: '', text: lyrics.slice(0, line.chords[0].position) });
  line.chords.forEach((c, i) =>
    segs.push({ chord: shiftChord(c.chord), text: lyrics.slice(c.position, cuts[i + 1]) || ' ' }));
  return `<div class="v-line">${segs.map(s =>
    `<span class="v-seg"><i>${esc(s.chord)}</i><em>${esc(s.text)}</em></span>`).join('')}</div>`;
}

function render() {
  const pat = getPattern(song.patternId);
  const capo = Number(song.capo) || 0;
  const keyShift = Number(song.keyShift) || 0;
  const capoInfo = capo ? `카포 ${capo}프렛이면 원곡 키` : '';
  root.innerHTML = `
    <div class="v-head">
      <button id="v-back" aria-label="뒤로">←</button>
      <div class="v-title"><b>${esc(song.title)}</b><span class="muted">${esc(song.artist || '')}</span></div>
      <button id="v-edit" aria-label="편집">✎</button>
      <button class="btn" id="v-play">연주</button>
    </div>
    <div class="v-controls card">
      <div class="v-key">
        <span class="set-label">키</span>
        <button class="key-btn" id="v-key-down">▼</button>
        <b id="v-key-val">${keyShift > 0 ? '+' : ''}${keyShift}</b>
        <button class="key-btn" id="v-key-up">▲</button>
      </div>
      <label class="v-tab-toggle"><input type="checkbox" id="v-tab" ${tabMode ? 'checked' : ''}> TAB</label>
      <div class="v-font">
        <button class="key-btn" id="v-font-down">A−</button>
        <button class="key-btn" id="v-font-up">A＋</button>
      </div>
      <span class="muted">${capoInfo}</span>
    </div>
    ${tabMode ? `
      <div class="card v-diagrams">${uniqueChords().map(chordSVG).join('')}</div>
      <div class="card v-pattern"><div class="set-label">${esc(pat.name)} (${esc(pat.ts)})</div>
        <pre>${renderPatternTab(pat, uniqueChords()[0] || 'C').join('\n')}</pre></div>` : ''}
    <div class="v-sheet">
      ${song.sections.map(s => `
        <div class="v-section"><div class="v-secname">${esc(s.name)}</div>
          ${s.lines.map(lineHTML).join('')}</div>`).join('')}
    </div>`;

  root.querySelector('#v-back').addEventListener('click', () => navigate('library'));
  root.querySelector('#v-edit').addEventListener('click', () => navigate('add', { edit: song }));
  root.querySelector('#v-play').addEventListener('click', () => navigate('performance', song.id));
  root.querySelector('#v-tab').addEventListener('change', e => { tabMode = e.target.checked; render(); });
  root.querySelector('#v-key-up').addEventListener('click', () => shiftKey(1));
  root.querySelector('#v-key-down').addEventListener('click', () => shiftKey(-1));
  root.querySelector('#v-font-up').addEventListener('click', () => setFont(1));
  root.querySelector('#v-font-down').addEventListener('click', () => setFont(-1));
  applyFont();
}

async function shiftKey(d) {
  song.keyShift = Math.max(-6, Math.min(6, (Number(song.keyShift) || 0) + d));
  await saveSong(song);
  render();
}

// 폰트 크기: -3 ~ +5 단계, 10%씩
function applyFont() {
  const sc = Number(localStorage.getItem('st_font') || 0);
  const sheet = root.querySelector('.v-sheet');
  if (sheet) sheet.style.fontSize = `${100 + sc * 10}%`;
}
function setFont(d) {
  const sc = Math.max(-3, Math.min(5, Number(localStorage.getItem('st_font') || 0) + d));
  localStorage.setItem('st_font', String(sc));
  applyFont();
}

registerScreen('viewer', async id => {
  song = await getSong(typeof id === 'string' ? id : song?.id);
  if (!song) return navigate('library');
  render();
});
