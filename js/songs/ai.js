// ---- 제공자 선택 ----
export function aiProvider() { return localStorage.getItem('st_ai_provider') || 'claude'; }
function apiKey() {
  return localStorage.getItem(aiProvider() === 'gemini' ? 'st_gemini_key' : 'st_api_key');
}
export function hasApiKey() { return !!apiKey(); }

// 마지막 실패의 상세 원인 (진단 표시용 — 오류 메시지 옆에 짧게 노출)
let lastDetail = '';
export function aiErrorDetail() { return lastDetail; }
function setDetail(d) { lastDetail = String(d || '').replace(/\s+/g, ' ').slice(0, 160); }

async function readErrorDetail(res) {
  try {
    const body = await res.text();
    try { return JSON.parse(body)?.error?.message || body; } catch { return body; }
  } catch { return ''; }
}

const PROMPT = (title, artist) => `당신은 기타 반주 편곡가입니다. 노래 "${title}"${artist ? ` (가수: ${artist})` : ''}의 기타 코드 악보를 만들어주세요.

반드시 아래 JSON 형식으로만 답하세요(설명 금지):
{
  "title": "정확한 곡 제목",
  "artist": "가수명",
  "timeSignature": "4/4 또는 3/4 또는 6/8",
  "mood": "calm|pop|ballad|waltz 중 하나",
  "sheet": "악보 텍스트"
}

sheet 규칙:
- [Verse 1], [Chorus] 같은 섹션 헤더 줄
- 코드 줄(공백으로 위치 맞춤) 바로 다음 줄에 해당 가사 줄
- 실제 가사와 실제 코드 진행을 사용
- 확실히 모르는 곡이면 {"unknown": true} 만 반환`;

// parts: [{ type:'text', text } | { type:'image', mediaType, data(base64) }]
async function callClaude(key, parts, signal) {
  const content = parts.map(p => p.type === 'image'
    ? { type: 'image', source: { type: 'base64', media_type: p.mediaType, data: p.data } }
    : { type: 'text', text: p.text });
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST', signal,
    headers: {
      'content-type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-5', max_tokens: 8000, thinking: { type: 'disabled' },
      messages: [{ role: 'user', content }],
    }),
  });
  if (res.status === 401) throw new Error('BAD_KEY');
  if (res.status === 429) throw new Error('API_429');
  if (!res.ok) { setDetail(await readErrorDetail(res)); throw new Error('API_' + res.status); }
  const data = await res.json();
  const text = data.content.map(b => b.text || '').join('');
  if (!text) {
    setDetail(`stop_reason=${data.stop_reason}`);
    throw new Error(data.stop_reason === 'max_tokens' ? 'TRUNCATED' : 'BAD_RESPONSE');
  }
  return text;
}

async function callGemini(key, parts, signal) {
  const geminiParts = parts.map(p => p.type === 'image'
    ? { inline_data: { mime_type: p.mediaType, data: p.data } }
    : { text: p.text });
  const res = await fetch(
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent', {
    method: 'POST', signal,
    headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify({
      contents: [{ parts: geminiParts }],
      generationConfig: { maxOutputTokens: 8192, responseMimeType: 'application/json', thinkingConfig: { thinkingBudget: 0 } },
    }),
  });
  if (res.status === 400 || res.status === 403) {
    // Gemini는 400을 키 오류 외에도 사용 — 본문을 보고 구분
    const detail = await readErrorDetail(res);
    setDetail(detail);
    throw new Error(/api key|api_key|permission/i.test(detail) ? 'BAD_KEY' : 'API_' + res.status);
  }
  if (res.status === 429) throw new Error('API_429');
  if (!res.ok) { setDetail(await readErrorDetail(res)); throw new Error('API_' + res.status); }
  const data = await res.json();
  const cand = data.candidates?.[0];
  const text = (cand?.content?.parts || []).map(p => p.text || '').join('');
  if (!text) {
    const finish = cand?.finishReason || data.promptFeedback?.blockReason || '';
    setDetail(`finishReason=${finish}`);
    if (finish === 'RECITATION') throw new Error('RECITATION');
    if (finish === 'MAX_TOKENS') throw new Error('TRUNCATED');
    if (finish === 'SAFETY' || data.promptFeedback?.blockReason) throw new Error('BLOCKED');
    throw new Error('BAD_RESPONSE');
  }
  return text;
}

const KNOWN = /^(NO_KEY|BAD_KEY|API_\d+|RECITATION|BLOCKED|TRUNCATED|BAD_RESPONSE)$/;
async function callAI(parts, timeoutMs) {
  const key = apiKey();
  if (!key) throw new Error('NO_KEY');
  lastDetail = '';
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);
  try {
    return await (aiProvider() === 'gemini' ? callGemini : callClaude)(key, parts, ac.signal);
  } catch (e) {
    if (KNOWN.test(e?.message)) throw e;
    throw new Error(e?.name === 'AbortError' ? 'TIMEOUT' : 'NETWORK');
  } finally {
    clearTimeout(timer);
  }
}

function extractJSON(text) {
  const start = text.indexOf('{'), end = text.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('BAD_RESPONSE');
  try { return JSON.parse(text.slice(start, end + 1)); }
  catch { throw new Error('BAD_RESPONSE'); }
}

export async function generateSong(title, artist) {
  const json = extractJSON(await callAI([{ type: 'text', text: PROMPT(title, artist) }], 60_000));
  if (json.unknown) throw new Error('UNKNOWN_SONG');
  if (!json.sheet) throw new Error('BAD_RESPONSE');
  return json;   // { title, artist, timeSignature, mood, sheet }
}

const AI_ERRORS = {
  NO_KEY: '설정에서 AI 제공자의 API 키를 먼저 등록해주세요.',
  TIMEOUT: '응답 시간이 초과되었습니다. 다시 시도해주세요.',
  NETWORK: '네트워크 연결을 확인해주세요.',
  BAD_KEY: 'API 키가 올바르지 않습니다. 설정에서 확인해주세요.',
  UNKNOWN_SONG: 'AI가 이 곡을 알지 못합니다. 붙여넣기 모드를 이용해주세요.',
  API_429: 'API 사용 한도를 초과했습니다. 잠시 후 다시 시도해주세요.',
  BAD_RESPONSE: 'AI 응답을 해석하지 못했습니다. 다시 시도해주세요.',
  UNREADABLE: '이미지에서 악보를 읽지 못했습니다. 더 선명한 이미지로 다시 시도해주세요.',
  BAD_FILE: '이미지 파일을 열 수 없습니다. 다른 이미지로 시도해주세요.',
  RECITATION: 'Gemini가 가사 저작권 보호 정책으로 응답을 차단했습니다. 설정에서 제공자를 Claude로 바꿔 시도해주세요.',
  BLOCKED: 'AI가 안전 정책으로 응답을 차단했습니다. 다른 이미지나 다른 제공자로 시도해주세요.',
  TRUNCATED: '악보가 너무 길어 응답이 잘렸습니다. 이미지를 나눠서 시도해주세요.',
};
export function aiErrorMessage(err) {
  return AI_ERRORS[err?.message] || '곡 생성에 실패했습니다. 네트워크를 확인하거나 붙여넣기 모드를 이용해주세요.';
}

// 이미지 축소·압축 → base64 (긴 변 최대 2048px, JPEG 0.85 — 조밀한 악보의 작은 가사 보존)
async function fileToImagePart(file) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 2048 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
  return { type: 'image', mediaType: 'image/jpeg', data: dataUrl.slice(dataUrl.indexOf(',') + 1) };
}

const TRANSCRIBE_PROMPT = `이 이미지는 기타 코드 악보입니다. 내용을 읽어서 반드시 아래 JSON 형식으로만 답하세요(설명 금지):
{
  "title": "곡 제목 (이미지에 있으면, 없으면 빈 문자열)",
  "artist": "가수명 (이미지에 있으면, 없으면 빈 문자열)",
  "timeSignature": "4/4 또는 3/4 또는 6/8 (불명확하면 4/4)",
  "sheet": "악보 텍스트"
}

sheet 규칙:
- [Verse 1], [Chorus] 같은 섹션 헤더가 이미지에 있으면 유지
- 코드 줄을 먼저 쓰고, 바로 다음 줄에 해당 가사 줄 (코드는 공백으로 가사 위 위치에 맞춤)
- 이미지에 보이는 코드와 가사를 그대로 옮길 것 (창작 금지)
- 페이지 번호, 워터마크, 사이트 주소, 광고 문구 등 악보와 무관한 텍스트는 제외
- 이미지가 여러 장이면 순서대로 이어서 하나의 악보로
- JSON 문자열 안의 줄바꿈은 반드시 \\n 으로 이스케이프
- 악보가 아니거나 읽을 수 없으면 {"unreadable": true} 만 반환`;

export async function transcribeSheetImages(files) {
  if (!hasApiKey()) throw new Error('NO_KEY');   // 이미지 디코딩 전에 키부터 확인 (generateSong과 동일 계약)
  if (!files.length) throw new Error('BAD_RESPONSE');
  let images;
  try { images = await Promise.all([...files].slice(0, 4).map(fileToImagePart)); }
  catch { throw new Error('BAD_FILE'); }
  const json = extractJSON(await callAI([...images, { type: 'text', text: TRANSCRIBE_PROMPT }], 90_000));
  if (json.unreadable) throw new Error('UNREADABLE');
  if (!json.sheet) throw new Error('BAD_RESPONSE');
  return json;   // { title, artist, timeSignature, sheet }
}
