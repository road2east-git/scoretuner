import { registerScreen, registerLeave } from '../bus.js';
import { GUITAR_STRINGS, noteToFreq, freqToNote } from '../music/theory.js';
import { playKalimba } from '../audio/kalimba.js';
import { startMic, micFrame, stopMic } from '../audio/mic.js';
import { detectPitch } from '../audio/pitch.js';

const root = document.getElementById('screen-tuner');
let selected = null;   // null = 자동 감지, 아니면 GUITAR_STRINGS 항목
let raf = 0, wasOk = false;
let lastTargetNo = 0;   // 자동 감지 시 대상 줄 변경 감지용
const recentCents = [];   // 노이즈 지터 완화용 최근 판독값 (중앙값 표시)

const a4 = () => Number(localStorage.getItem('st_a4')) || 440;

root.innerHTML = `
  <h1>튜너</h1>
  <div class="card tuner-display">
    <div class="tuner-note"><span id="tn-name">—</span><span id="tn-oct"></span></div>
    <div class="tuner-gauge"><div class="gauge-track"><div id="gauge-needle"></div></div>
      <div class="gauge-labels"><span>-50</span><span>0</span><span>+50</span></div></div>
    <div id="tn-guide" class="tuner-guide">줄을 튕겨보세요</div>
  </div>
  <div class="string-row" id="string-row">
    ${GUITAR_STRINGS.map(s => `
      <button class="string-btn" data-no="${s.no}">
        <span class="string-no">${s.no}</span><span class="string-note">${s.label}</span>
      </button>`).join('')}
  </div>
  <p class="muted center">줄 버튼을 누르면 기준음(칼림바)이 재생되고 해당 줄로 고정됩니다.<br>다시 누르면 자동 감지로 돌아갑니다.</p>
  <div id="mic-error" class="card warn" hidden>
    <span>마이크 권한이 필요합니다.</span> <button class="btn ghost" id="mic-retry">다시 요청</button>
  </div>`;

root.querySelector('#string-row').addEventListener('click', e => {
  const btn = e.target.closest('.string-btn');
  if (!btn) return;
  const s = GUITAR_STRINGS.find(x => x.no === Number(btn.dataset.no));
  playKalimba(noteToFreq(s.midi, a4()));
  selected = selected?.no === s.no ? null : s;
  recentCents.length = 0;
  wasOk = false;
  root.querySelectorAll('.string-btn').forEach(b =>
    b.classList.toggle('selected', Number(b.dataset.no) === selected?.no));
});
root.querySelector('#mic-retry').addEventListener('click', start);

function nearestString(midi) {
  return GUITAR_STRINGS.reduce((a, b) =>
    Math.abs(b.midi - midi) < Math.abs(a.midi - midi) ? b : a);
}

function median(arr) {
  const s = [...arr].sort((a, b) => a - b);
  return s[s.length >> 1];
}

function update() {
  const frame = micFrame();
  if (frame) {
    const freq = detectPitch(frame.buf, frame.sampleRate, { minFreq: 60, maxFreq: 500 });
    if (freq) {
      const note = freqToNote(freq, a4());
      const target = selected || nearestString(note.midi);
      if (target.no !== lastTargetNo) { recentCents.length = 0; wasOk = false; lastTargetNo = target.no; }
      const raw = Math.max(-50, Math.min(50,
        Math.round(1200 * Math.log2(freq / noteToFreq(target.midi, a4())))));
      recentCents.push(raw);
      if (recentCents.length > 5) recentCents.shift();
      const cents = median(recentCents);
      root.querySelector('#tn-name').textContent = target.label[0];
      root.querySelector('#tn-oct').textContent =
        `${target.no}번줄 ${target.label} · ${cents > 0 ? '+' : ''}${cents}¢`;
      root.querySelector('#gauge-needle').style.left = `${50 + cents}%`;
      const ok = Math.abs(cents) <= 5;
      root.querySelector('.tuner-display').classList.toggle('ok', ok);
      root.querySelector('#tn-guide').textContent = ok ? '정확합니다 ✓'
        : cents < 0 ? '조여서 높이세요 ▲' : '풀어서 낮추세요 ▼';
      if (ok && !wasOk) navigator.vibrate?.(40);
      wasOk = ok;
    }
  }
  raf = requestAnimationFrame(update);
}

async function start() {
  root.querySelector('#mic-error').hidden = true;
  try {
    await startMic(2048);
    cancelAnimationFrame(raf);
    update();
  } catch {
    root.querySelector('#mic-error').hidden = false;
  }
}

registerScreen('tuner', () => start());
registerLeave('tuner', () => { cancelAnimationFrame(raf); stopMic(); wasOk = false; });
