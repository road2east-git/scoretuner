import { navigate, registerScreen } from '../bus.js';
import { listSongs, deleteSong, exportBackup, importBackup } from '../songs/store.js';

const esc = s => String(s ?? '').replace(/[&<>"']/g,
  c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const root = document.getElementById('screen-library');
root.innerHTML = `
  <h1>라이브러리</h1>
  <input id="lib-search" type="search" placeholder="제목·가수 검색">
  <ul id="lib-list" class="lib-list"></ul>
  <div id="lib-empty" class="card center" hidden>
    <p>저장된 악보가 없습니다.</p>
    <button class="btn" id="lib-go-add" style="margin-top:10px">첫 곡 추가하기</button>
  </div>
  <div class="lib-tools">
    <button class="btn ghost" id="lib-export">내보내기</button>
    <label class="btn ghost">가져오기<input id="lib-import" type="file" accept=".json" hidden></label>
  </div>`;

const $ = s => root.querySelector(s);
let songs = [];

function render(filter = '') {
  const q = filter.trim().toLowerCase();
  const shown = songs.filter(s =>
    !q || String(s.title).toLowerCase().includes(q) || String(s.artist ?? '').toLowerCase().includes(q));
  $('#lib-empty').hidden = songs.length > 0;
  $('#lib-list').innerHTML = shown.map(s => `
    <li class="lib-item" data-id="${esc(s.id)}">
      <div class="lib-info"><b>${esc(s.title)}</b><span class="muted">${esc(s.artist || '')}</span></div>
      <button class="lib-del" data-del="${esc(s.id)}" aria-label="삭제">🗑</button>
    </li>`).join('');
}

async function refresh() {
  songs = await listSongs();
  render($('#lib-search').value);
}

$('#lib-search').addEventListener('input', e => render(e.target.value));
$('#lib-go-add').addEventListener('click', () => navigate('add'));
$('#lib-export').addEventListener('click', exportBackup);
$('#lib-import').addEventListener('change', async e => {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  try {
    const n = await importBackup(file);
    await refresh();
    alert(`${n}곡을 가져왔습니다.`);
  } catch {
    alert('백업 파일을 읽지 못했습니다.');
  }
});
$('#lib-list').addEventListener('click', async e => {
  const del = e.target.closest('[data-del]');
  if (del) {
    if (confirm('이 악보를 삭제할까요?')) { await deleteSong(del.dataset.del); await refresh(); }
    return;
  }
  const item = e.target.closest('.lib-item');
  if (item) navigate('viewer', item.dataset.id);
});

registerScreen('library', refresh);
