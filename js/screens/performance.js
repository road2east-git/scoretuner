import { navigate, registerScreen, registerLeave } from '../bus.js';
import { getSong } from '../songs/store.js';
import { transposeChord } from '../music/theory.js';
import { toEasy } from '../music/arrange.js';
import { startMic, micFrame, stopMic } from '../audio/mic.js';
import { chromaVector, matchChord, chordTemplate } from '../audio/chroma.js';

const esc = s => String(s ?? '').replace(/[&<>"']/g,
  c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const root = document.getElementById('screen-performance');
let song = null, flat = [], idx = 0, raf = 0, hits = 0, wakeLock = null;

// 유사 코드 쌍(공유 음 3개 이상, 예: G↔G7)은 마진을 낮춰 전환 지연을 방지 (측정 기반)
function advanceMargin(cur, next) {
  const a = chordTemplate(cur), b = chordTemplate(next);
  let shared = 0;
  for (let i = 0; i < 12; i++) if (a[i] && b[i]) shared++;
  return shared >= 3 ? 0.02 : 0.05;
}

function flatten() {
  flat = [];
  root.querySelectorAll('.p-chord').forEach(el => flat.push({ chord: el.dataset.chord, el }));
}

function setIdx(i) {
  if (i < 0 || i >= flat.length) return;
  flat[idx]?.el.classList.remove('now');
  idx = i;
  hits = 0;
  const cur = flat[idx];
  cur.el.classList.add('now');
  cur.el.scrollIntoView({ block: 'center', behavior: 'smooth' });
  root.querySelector('#p-next').textContent =
    flat[idx + 1] ? `다음: ${flat[idx + 1].chord}` : '마지막 코드';
}

function loop() {
  const frame = micFrame();
  if (frame && flat[idx + 1]) {
    const v = chromaVector(frame.buf, frame.sampleRate);
    const next = matchChord(v, [flat[idx + 1].chord]);
    const cur = matchChord(v, [flat[idx].chord]);
    // 다음 코드가 현재 코드보다 뚜렷하게 우세한 프레임이 쌓이면 전진
    if (next.score > 0.6 && next.score > cur.score + advanceMargin(flat[idx].chord, flat[idx + 1].chord))
      hits++;
    else hits = Math.max(0, hits - 1);
    if (hits >= 6) setIdx(idx + 1);
  }
  raf = requestAnimationFrame(loop);
}

function render() {
  const ks = Number(song.keyShift) || 0;
  const shifted = c => ks ? toEasy(transposeChord(c, ks)) : c;
  root.innerHTML = `
    <div class="p-bar">
      <button id="p-exit">✕ 종료</button>
      <b>${esc(song.title)}</b>
      <span id="p-next" class="muted"></span>
    </div>
    <div class="p-sheet" id="p-sheet">
      ${song.sections.map(s => `
        <div class="v-section"><div class="v-secname">${esc(s.name)}</div>
          ${s.lines.map(l => {
            const lyrics = String(l.lyrics ?? '');
            if (!l.chords.length)
              return `<div class="v-line"><span class="v-seg"><i></i><em>${esc(lyrics)}</em></span></div>`;
            const cuts = [...l.chords.map(c => c.position), Infinity];
            let html = l.chords[0].position > 0
              ? `<span class="v-seg"><i></i><em>${esc(lyrics.slice(0, l.chords[0].position))}</em></span>` : '';
            l.chords.forEach((c, i) => {
              const ch = shifted(c.chord);
              html += `<span class="v-seg"><i class="p-chord" data-chord="${esc(ch)}">${esc(ch)}</i><em>${esc(lyrics.slice(c.position, cuts[i + 1]) || ' ')}</em></span>`;
            });
            return `<div class="v-line">${html}</div>`;
          }).join('')}
        </div>`).join('')}
    </div>
    <div class="p-tap left" id="p-prev-zone" aria-label="이전 코드"></div>
    <div class="p-tap right" id="p-next-zone" aria-label="다음 코드"></div>`;

  root.querySelector('#p-exit').addEventListener('click', () => navigate('viewer', song.id));
  root.querySelector('#p-prev-zone').addEventListener('click', () => setIdx(idx - 1));
  root.querySelector('#p-next-zone').addEventListener('click', () => setIdx(idx + 1));
  flatten();
  idx = 0;
  hits = 0;
  if (flat.length) setIdx(0);
  else root.querySelector('#p-next').textContent = '코드가 없는 악보입니다';
}

async function enterFullscreen() {
  document.body.classList.add('fullscreen', 'landscape');
  try {
    await document.documentElement.requestFullscreen();
    await screen.orientation.lock('landscape');
    document.body.classList.remove('landscape');  // 네이티브 회전 성공 → CSS 회전 폴백 불필요
  } catch { /* CSS 회전 폴백 유지 */ }
  try { wakeLock = await navigator.wakeLock?.request('screen'); } catch {}
}

registerScreen('performance', async id => {
  song = await getSong(typeof id === 'string' ? id : song?.id);
  if (!song) return navigate('library');
  render();
  await enterFullscreen();
  try {
    await startMic(8192);
    cancelAnimationFrame(raf);
    loop();
  } catch {
    root.querySelector('#p-next').textContent = '마이크 사용 불가 — 좌/우 터치로 넘기세요';
  }
});

registerLeave('performance', () => {
  cancelAnimationFrame(raf);
  stopMic();
  wakeLock?.release().catch(() => {});
  wakeLock = null;
  document.body.classList.remove('fullscreen', 'landscape');
  if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  try { screen.orientation.unlock(); } catch {}
});
