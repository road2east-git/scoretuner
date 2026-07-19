import { registerScreen } from '../bus.js';

const root = document.getElementById('screen-settings');
root.innerHTML = `
  <h1>설정</h1>
  <div class="card set-group">
    <label class="set-label" for="set-theme">테마</label>
    <select id="set-theme">
      <option value="">시스템 자동</option><option value="dark">다크</option><option value="light">라이트</option>
    </select>
  </div>
  <div class="card set-group">
    <label class="set-label" for="set-a4">기준 주파수 A4 (Hz)</label>
    <input id="set-a4" type="number" min="415" max="466" step="1">
  </div>
  <div class="card set-group">
    <label class="set-label" for="set-key">Claude API 키 (AI 곡 생성용 · 선택)</label>
    <input id="set-key" type="password" placeholder="sk-ant-..." autocomplete="off">
    <p class="muted">키는 이 기기에만 저장됩니다. 키가 없어도 붙여넣기 모드는 사용할 수 있습니다.</p>
  </div>`;

const $ = s => root.querySelector(s);

registerScreen('settings', () => {
  $('#set-theme').value = localStorage.getItem('st_theme') || '';
  $('#set-a4').value = localStorage.getItem('st_a4') || 440;
  $('#set-key').value = localStorage.getItem('st_api_key') || '';
});

$('#set-theme').addEventListener('change', e => {
  const v = e.target.value;
  if (v) { localStorage.setItem('st_theme', v); document.documentElement.dataset.theme = v; }
  else { localStorage.removeItem('st_theme'); delete document.documentElement.dataset.theme; }
});
$('#set-a4').addEventListener('change', e => {
  const v = Math.max(415, Math.min(466, Number(e.target.value) || 440));
  e.target.value = v;
  localStorage.setItem('st_a4', String(v));
});
$('#set-key').addEventListener('change', e => localStorage.setItem('st_api_key', e.target.value.trim()));
