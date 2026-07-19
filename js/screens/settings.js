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
    <label class="set-label" for="set-provider">AI 제공자 (곡 생성·이미지 인식)</label>
    <select id="set-provider">
      <option value="claude">Claude</option>
      <option value="gemini">Gemini (무료 할당량 있음)</option>
    </select>
  </div>
  <div class="card set-group">
    <label class="set-label" for="set-key">Claude API 키 (AI 곡 생성용 · 선택)</label>
    <input id="set-key" type="password" placeholder="sk-ant-..." autocomplete="off">
    <p class="muted">선택한 제공자의 키만 사용됩니다. 키는 이 기기에만 저장됩니다.</p>
  </div>
  <div class="card set-group">
    <label class="set-label" for="set-gemini">Gemini API 키</label>
    <input id="set-gemini" type="password" placeholder="AIza..." autocomplete="off">
    <p class="muted">aistudio.google.com에서 Google 계정으로 무료 발급. 키는 이 기기에만 저장됩니다.</p>
  </div>`;

const $ = s => root.querySelector(s);

registerScreen('settings', () => {
  $('#set-theme').value = localStorage.getItem('st_theme') || '';
  $('#set-a4').value = localStorage.getItem('st_a4') || 440;
  $('#set-key').value = localStorage.getItem('st_api_key') || '';
  $('#set-provider').value = localStorage.getItem('st_ai_provider') || 'claude';
  $('#set-gemini').value = localStorage.getItem('st_gemini_key') || '';
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
$('#set-provider').addEventListener('change', e => localStorage.setItem('st_ai_provider', e.target.value));
$('#set-gemini').addEventListener('change', e => localStorage.setItem('st_gemini_key', e.target.value.trim()));
