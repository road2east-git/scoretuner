export function hasApiKey() { return !!localStorage.getItem('st_api_key'); }

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

export async function generateSong(title, artist) {
  const key = localStorage.getItem('st_api_key');
  if (!key) throw new Error('NO_KEY');
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-5',
      max_tokens: 4000,
      messages: [{ role: 'user', content: PROMPT(title, artist) }],
    }),
  });
  if (res.status === 401) throw new Error('BAD_KEY');
  if (res.status === 429) throw new Error('API_429');
  if (!res.ok) throw new Error('API_' + res.status);
  const data = await res.json();
  const text = data.content.map(b => b.text || '').join('');
  const start = text.indexOf('{'), end = text.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('BAD_RESPONSE');
  let json;
  try { json = JSON.parse(text.slice(start, end + 1)); }
  catch { throw new Error('BAD_RESPONSE'); }
  if (json.unknown) throw new Error('UNKNOWN_SONG');
  if (!json.sheet) throw new Error('BAD_RESPONSE');
  return json;   // { title, artist, timeSignature, mood, sheet }
}

const AI_ERRORS = {
  NO_KEY: '설정에서 Claude API 키를 먼저 등록해주세요.',
  BAD_KEY: 'API 키가 올바르지 않습니다. 설정에서 확인해주세요.',
  UNKNOWN_SONG: 'AI가 이 곡을 알지 못합니다. 붙여넣기 모드를 이용해주세요.',
  API_429: 'API 사용 한도를 초과했습니다. 잠시 후 다시 시도해주세요.',
  BAD_RESPONSE: 'AI 응답을 해석하지 못했습니다. 다시 시도해주세요.',
};
export function aiErrorMessage(err) {
  return AI_ERRORS[err?.message] || '곡 생성에 실패했습니다. 네트워크를 확인하거나 붙여넣기 모드를 이용해주세요.';
}
