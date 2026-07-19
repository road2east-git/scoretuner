import { navigate, registerScreen } from '../bus.js';
import { parseSheet } from '../songs/parser.js';
import { arrangeSections } from '../music/arrange.js';
import { PATTERNS, defaultPatternId } from '../music/patterns.js';
import { saveSong } from '../songs/store.js';
import { generateSong, hasApiKey, aiErrorMessage, transcribeSheetImages } from '../songs/ai.js';

const root = document.getElementById('screen-add');
root.innerHTML = `
  <h1>곡 추가</h1>
  <div class="card set-group">
    <input id="add-title" placeholder="노래 제목 (필수)">
    <input id="add-artist" placeholder="가수명">
    <div class="add-actions">
      <button class="btn ghost" id="add-search">🔍 코드 악보 검색</button>
      <button class="btn" id="add-ai">✨ AI로 자동 생성</button>
    </div>
  </div>
  <div class="card set-group">
    <div class="paste-head">
      <label class="set-label" for="add-paste">코드+가사 붙여넣기</label>
      <label class="btn ghost btn-sm">🖼 이미지에서 읽기<input id="add-image" type="file" accept="image/*" multiple hidden></label>
    </div>
    <textarea id="add-paste" rows="10" placeholder="검색한 악보의 코드와 가사를 복사해서 붙여넣으세요.&#10;&#10;예)&#10;C        G7&#10;나의 살던 고향은"></textarea>
    <label class="set-label" for="add-pattern">반주 패턴</label>
    <select id="add-pattern">${PATTERNS.map(p =>
      `<option value="${p.id}">${p.name} (${p.ts})</option>`).join('')}</select>
    <button class="btn" id="add-save">분석하고 저장</button>
  </div>
  <div id="add-status" class="muted center"></div>`;

const $ = s => root.querySelector(s);
const status = (msg, isErr) => {
  $('#add-status').textContent = msg;
  $('#add-status').style.color = isErr ? 'var(--warn)' : 'var(--text2)';
};

// 편집 모드: viewer에서 { edit: song } 파라미터로 진입 시 기존 곡 정보 프리필
let editingId = null;
registerScreen('add', param => {
  status('');
  editingId = null;
  if (param?.edit) {
    const s = param.edit;
    editingId = s.id;
    $('#add-title').value = s.title;
    $('#add-artist').value = s.artist || '';
    $('#add-pattern').value = s.patternId;
    status('편집 모드: 악보 텍스트를 다시 붙여넣으면 내용이 교체됩니다.');
  }
});

$('#add-search').addEventListener('click', () => {
  if (!$('#add-title').value.trim()) return status('노래 제목을 입력해주세요.', true);
  const q = [$('#add-title').value.trim(), $('#add-artist').value.trim(), '기타 코드'].filter(Boolean).join(' ');
  window.open(`https://www.google.com/search?q=${encodeURIComponent(q)}`, '_blank');
});

async function saveArranged({ id, title, artist, sections, timeSignature, patternId, source }) {
  const arranged = arrangeSections(sections);
  const song = await saveSong({
    id: id || undefined,
    title, artist, timeSignature, patternId, source,
    semitones: arranged.semitones, capo: arranged.capo, keyShift: 0,
    sections: arranged.sections,
  });
  const capoMsg = arranged.capo ? ` (원곡 키는 카포 ${arranged.capo}프렛)` : '';
  status(`저장 완료!${capoMsg}`);
  navigate('viewer', song.id);
}

$('#add-save').addEventListener('click', async () => {
  const title = $('#add-title').value.trim();
  if (!title) return status('노래 제목을 입력해주세요.', true);
  const targetId = editingId;
  try {
    const sections = parseSheet($('#add-paste').value);
    await saveArranged({
      id: targetId, title, artist: $('#add-artist').value.trim(), sections,
      timeSignature: '4/4', patternId: $('#add-pattern').value, source: 'paste',
    });
  } catch (e) {
    status(e.message === '악보 형식을 인식하지 못했습니다'
      ? '악보 형식을 인식하지 못했습니다. 코드 줄과 가사 줄이 번갈아 나오는 형태인지 확인해주세요.'
      : `저장 실패: ${e.message}`, true);
  }
});

$('#add-ai').addEventListener('click', async () => {
  const title = $('#add-title').value.trim();
  if (!title) return status('노래 제목을 입력해주세요.', true);
  if (!hasApiKey()) return status('설정에서 Claude API 키를 먼저 등록해주세요.', true);
  status('AI가 악보를 만드는 중… (10~30초)');
  $('#add-ai').disabled = true;
  const targetId = editingId;
  try {
    const r = await generateSong(title, $('#add-artist').value.trim());
    const sections = parseSheet(r.sheet);
    const moodMap = { calm: 'strum-ballad', ballad: 'arp-ballad', pop: 'strum-pop', waltz: 'strum-waltz' };
    await saveArranged({
      id: targetId, title: r.title || title, artist: r.artist || $('#add-artist').value.trim(),
      sections, timeSignature: r.timeSignature || '4/4',
      patternId: moodMap[r.mood] || defaultPatternId(r.timeSignature || '4/4'), source: 'ai',
    });
  } catch (e) {
    status(aiErrorMessage(e), true);
  } finally {
    $('#add-ai').disabled = false;
  }
});

$('#add-image').addEventListener('change', async e => {
  const files = e.target.files;
  if (!files.length) return;
  if (!hasApiKey()) { e.target.value = ''; return status('설정에서 Claude API 키를 먼저 등록해주세요.', true); }
  const total = files.length;
  const used = Math.min(total, 4);
  status(used < total
    ? `이미지가 많아 처음 ${used}장만 읽습니다… (10~30초)`
    : `이미지 ${used}장에서 악보를 읽는 중… (10~30초)`);
  const label = e.target.closest('label');
  label.style.pointerEvents = 'none';
  label.style.opacity = '.5';
  try {
    const r = await transcribeSheetImages(files);
    $('#add-paste').value = r.sheet;
    if (r.title && !$('#add-title').value.trim()) $('#add-title').value = r.title;
    if (r.artist && !$('#add-artist').value.trim()) $('#add-artist').value = r.artist;
    status('이미지에서 악보를 읽었습니다. 내용을 확인한 뒤 "분석하고 저장"을 눌러주세요.');
  } catch (err) {
    status(aiErrorMessage(err), true);
  } finally {
    label.style.pointerEvents = '';
    label.style.opacity = '';
    e.target.value = '';
  }
});
