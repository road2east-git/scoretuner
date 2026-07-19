# ScoreTuner Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 기타 튜너 + 쉬운 코드 편곡 악보 라이브러리 + 연주 인식 자동 진행을 갖춘 안드로이드용 PWA를 만들어 GitHub Pages에 배포한다.

**Architecture:** 빌드 도구 없는 순수 HTML/CSS/JS(ES 모듈) 정적 앱. 음악 이론·편곡·파싱·피치검출·크로마 매칭은 브라우저 API에 의존하지 않는 순수 모듈로 분리해 Node 내장 테스트 러너(`node --test`)로 단위 테스트한다. UI는 화면별 모듈(튜너/라이브러리/곡추가/뷰어/연주모드/설정)로 나누고, 데이터는 IndexedDB에 저장한다.

**Tech Stack:** Web Audio API(피치 검출·크로마·칼림바 합성), IndexedDB, Service Worker(PWA), Pretendard(CDN), Claude API(선택적 AI 모드), GitHub Pages.

**Spec:** `docs/superpowers/specs/2026-07-19-scoretuner-design.md`

---

## 파일 구조

```
index.html                  앱 셸 (화면 5개 + 하단 탭바)
manifest.json               PWA 매니페스트
sw.js                       Service Worker (오프라인 캐시)
icons/icon.svg              앱 아이콘
package.json                테스트 스크립트 ("type": "module")
css/base.css                디자인 토큰(다크/라이트), 리셋, 레이아웃
css/screens.css             화면별 스타일
js/bus.js                   화면 전환 이벤트 (import 순환 방지)
js/app.js                   진입점: 탭바, 화면 라우팅, 테마, SW 등록
js/music/theory.js          음이름/주파수 변환, 코드 파싱·이조 (순수)
js/music/arrange.js         쉬운 코드 편곡 엔진 (순수)
js/music/chords-db.js       코드 운지 DB + SVG 다이어그램 (순수)
js/music/patterns.js        반주 패턴 라이브러리 + TAB 렌더 (순수)
js/audio/pitch.js           자기상관 피치 검출 (순수)
js/audio/chroma.js          크로마그램 + 코드 매칭 (순수)
js/audio/kalimba.js         칼림바 음색 합성 (Web Audio)
js/audio/mic.js             마이크 캡처 래퍼 (Web Audio)
js/songs/parser.js          붙여넣기 텍스트 파서 (순수)
js/songs/store.js           IndexedDB CRUD, 정렬, 백업 (정렬 비교자는 순수)
js/songs/ai.js              Claude API 호출 (AI 모드)
js/screens/tuner.js         튜너 화면
js/screens/library.js       라이브러리 화면
js/screens/addsong.js       곡 추가 화면
js/screens/viewer.js        악보 뷰어 (TAB 토글, 키 조절)
js/screens/performance.js   연주 모드 (가로, 연주 인식)
js/screens/settings.js      설정 화면
tests/*.test.js             순수 모듈 단위 테스트
```

## 데이터 모델 (모든 태스크 공통)

```js
// Song 객체 — IndexedDB 'songs' 스토어에 저장
{
  id: 'uuid',            // crypto.randomUUID()
  title: '노래 제목',
  artist: '가수',
  semitones: 0,          // 저장 시 편곡 엔진이 적용한 이조량 (정보 표시용)
  capo: 0,               // 카포 제안 (0이면 없음)
  keyShift: 0,           // 사용자가 뷰어에서 ▲▼로 조절한 추가 이조 (반음)
  timeSignature: '4/4',
  patternId: 'strum-basic',
  source: 'paste',       // 'paste' | 'ai'
  sections: [{
    name: 'Verse 1',
    lines: [{
      chords: [{ chord: 'C', position: 0 }],  // position = 가사 문자열의 문자 인덱스
      lyrics: '나의 살던 고향은'
    }]
  }],
  createdAt: 0, updatedAt: 0
}
```

---

### Task 1: 프로젝트 뼈대 + 테스트 러너

**Files:**
- Create: `package.json`, `index.html`, `css/base.css`, `css/screens.css`, `js/bus.js`, `js/app.js`, `tests/smoke.test.js`

- [ ] **Step 1: package.json 작성**

```json
{
  "name": "scoretuner",
  "private": true,
  "type": "module",
  "scripts": { "test": "node --test tests/" }
}
```

- [ ] **Step 2: 스모크 테스트 작성 후 실행**

`tests/smoke.test.js`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';

test('test runner works', () => { assert.equal(1 + 1, 2); });
```

Run: `npm test` — Expected: `pass 1`

- [ ] **Step 3: index.html 작성**

```html
<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#0f1115" media="(prefers-color-scheme: dark)">
<meta name="theme-color" content="#fafafa" media="(prefers-color-scheme: light)">
<title>ScoreTuner</title>
<link rel="manifest" href="manifest.json">
<link rel="icon" href="icons/icon.svg">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css">
<link rel="stylesheet" href="css/base.css">
<link rel="stylesheet" href="css/screens.css">
</head>
<body>
<main id="screens">
  <section id="screen-tuner" class="screen active"></section>
  <section id="screen-library" class="screen"></section>
  <section id="screen-add" class="screen"></section>
  <section id="screen-viewer" class="screen"></section>
  <section id="screen-performance" class="screen"></section>
  <section id="screen-settings" class="screen"></section>
</main>
<nav id="tabbar">
  <button data-screen="tuner" class="active">튜너</button>
  <button data-screen="library">라이브러리</button>
  <button data-screen="add">곡 추가</button>
  <button data-screen="settings">설정</button>
</nav>
<script type="module" src="js/app.js"></script>
</body>
</html>
```

(manifest.json·icons는 Task 16에서 생성 — 그 전까지 404는 무해)

- [ ] **Step 4: css/base.css 작성** (디자인 토큰 + 공통 레이아웃)

```css
:root {
  --bg:#fafafa; --surface:#fff; --surface2:#f0f0f2; --text:#18181b; --text2:#71717a;
  --accent:#2563eb; --on-accent:#fff; --ok:#16a34a; --warn:#dc2626; --line:#e4e4e7;
  --radius:14px; --font:'Pretendard Variable',Pretendard,system-ui,sans-serif;
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme=light]) {
    --bg:#0f1115; --surface:#161a21; --surface2:#1e222b; --text:#f4f4f5; --text2:#8b93a5;
    --accent:#4ade80; --on-accent:#0f1115; --ok:#4ade80; --warn:#f87171; --line:#262b35;
  }
}
:root[data-theme=dark] {
  --bg:#0f1115; --surface:#161a21; --surface2:#1e222b; --text:#f4f4f5; --text2:#8b93a5;
  --accent:#4ade80; --on-accent:#0f1115; --ok:#4ade80; --warn:#f87171; --line:#262b35;
}
* { box-sizing:border-box; margin:0; -webkit-tap-highlight-color:transparent; }
html, body { height:100%; }
body { background:var(--bg); color:var(--text); font-family:var(--font); overscroll-behavior:none; }
button { font:inherit; color:inherit; background:none; border:none; cursor:pointer; }
input, textarea, select { font:inherit; color:var(--text); background:var(--surface2);
  border:1px solid var(--line); border-radius:10px; padding:12px 14px; width:100%; }
.screen { display:none; padding:20px 16px 84px; max-width:760px; margin:0 auto; }
.screen.active { display:block; }
h1 { font-size:20px; font-weight:700; margin-bottom:16px; }
.btn { display:inline-flex; align-items:center; justify-content:center; gap:6px;
  background:var(--accent); color:var(--on-accent); font-weight:700;
  border-radius:var(--radius); padding:13px 20px; }
.btn.ghost { background:var(--surface2); color:var(--text); }
.card { background:var(--surface); border:1px solid var(--line); border-radius:var(--radius); padding:16px; }
.muted { color:var(--text2); font-size:13px; }
#tabbar { position:fixed; bottom:0; left:0; right:0; display:flex; z-index:10;
  background:var(--surface); border-top:1px solid var(--line);
  padding-bottom:env(safe-area-inset-bottom); }
#tabbar button { flex:1; padding:14px 0 12px; color:var(--text2); font-size:13px; }
#tabbar button.active { color:var(--accent); font-weight:700; }
body.fullscreen #tabbar { display:none; }
```

`css/screens.css`는 빈 파일로 생성 (이후 태스크에서 화면별 스타일 추가).

- [ ] **Step 5: js/bus.js + js/app.js 작성**

`js/bus.js`:
```js
export function navigate(screen, param = null) {
  document.dispatchEvent(new CustomEvent('app:navigate', { detail: { screen, param } }));
}
```

`js/app.js`:
```js
import './bus.js';

const TAB_SCREENS = ['tuner', 'library', 'add', 'settings'];
const handlers = {}; // 화면 모듈이 등록하는 onShow 콜백

export function registerScreen(name, onShow) { handlers[name] = onShow; }

function show(name, param) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(`screen-${name}`)?.classList.add('active');
  document.querySelectorAll('#tabbar button').forEach(b =>
    b.classList.toggle('active', b.dataset.screen === name));
  handlers[name]?.(param);
  window.scrollTo(0, 0);
}

document.addEventListener('app:navigate', e => show(e.detail.screen, e.detail.param));
document.getElementById('tabbar').addEventListener('click', e => {
  const btn = e.target.closest('button[data-screen]');
  if (btn) show(btn.dataset.screen);
});

// 테마
const savedTheme = localStorage.getItem('st_theme');
if (savedTheme) document.documentElement.dataset.theme = savedTheme;

// Service Worker (sw.js는 Task 16에서 생성)
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});

show('tuner');
```

- [ ] **Step 6: 브라우저 확인**

로컬 서버로 index.html 열기 (예: `npx serve .` 또는 에디터 라이브서버). 탭바 4개 버튼이 보이고 클릭 시 활성 표시가 이동하면 OK.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: 프로젝트 뼈대 - 앱 셸, 탭 네비게이션, 테마 토큰, 테스트 러너"
```

---

### Task 2: 음악 이론 모듈 (theory.js)

**Files:**
- Create: `js/music/theory.js`
- Test: `tests/theory.test.js`

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/theory.test.js`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseChord, transposeChord, freqToNote, noteToFreq, GUITAR_STRINGS }
  from '../js/music/theory.js';

test('parseChord: 기본/플랫/분수 코드', () => {
  assert.deepEqual(parseChord('C'), { root: 'C', quality: '', bass: null });
  assert.deepEqual(parseChord('Bb'), { root: 'A#', quality: '', bass: null });
  assert.deepEqual(parseChord('F#m7'), { root: 'F#', quality: 'm7', bass: null });
  assert.deepEqual(parseChord('G/B'), { root: 'G', quality: '', bass: 'B' });
});

test('parseChord: 코드가 아니면 null', () => {
  assert.equal(parseChord('Hello'), null);
  assert.equal(parseChord('나비'), null);
  assert.equal(parseChord('Cxyz'), null);
});

test('transposeChord: 이조와 표기', () => {
  assert.equal(transposeChord('C', 2), 'D');
  assert.equal(transposeChord('Bb', -1), 'A');
  assert.equal(transposeChord('A', 1), 'Bb');   // A# 대신 Bb 표기
  assert.equal(transposeChord('Em', 12), 'Em');
});

test('freqToNote: A4=440 기준', () => {
  const a4 = freqToNote(440);
  assert.equal(a4.name, 'A'); assert.equal(a4.octave, 4); assert.equal(a4.cents, 0);
  assert.equal(freqToNote(445).cents, 20);       // 약 +20센트
  assert.equal(freqToNote(82.41).name, 'E');     // 6번줄
});

test('noteToFreq: 왕복 변환', () => {
  assert.ok(Math.abs(noteToFreq(69) - 440) < 0.001);
  assert.ok(Math.abs(noteToFreq(40) - 82.41) < 0.01); // E2
});

test('GUITAR_STRINGS: 6줄 표준 튜닝', () => {
  assert.equal(GUITAR_STRINGS.length, 6);
  assert.equal(GUITAR_STRINGS[0].midi, 40); // 6번줄 E2
  assert.equal(GUITAR_STRINGS[5].midi, 64); // 1번줄 E4
});
```

- [ ] **Step 2: 실행해서 실패 확인**

Run: `npm test` — Expected: FAIL (`Cannot find module .../theory.js`)

- [ ] **Step 3: theory.js 구현**

```js
export const NOTES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
const FLATS = { Db:'C#', Eb:'D#', Gb:'F#', Ab:'G#', Bb:'A#', Cb:'B', Fb:'E' };
const DISPLAY = { 'A#':'Bb', 'D#':'Eb', 'G#':'Ab' };
const QUALITIES = new Set(['','m','7','m7','maj7','M7','maj9','6','m6','9','m9','11','m11','13',
  'sus2','sus4','7sus4','add9','madd9','dim','dim7','m7b5','aug','aug7','5']);

export function normalizeRoot(r) { return FLATS[r] || r; }
export function displayChord(root, quality) { return (DISPLAY[root] || root) + quality; }

export function parseChord(sym) {
  if (typeof sym !== 'string') return null;
  const m = sym.trim().match(/^([A-G][b#]?)([^/\s]*)(?:\/([A-G][b#]?))?$/);
  if (!m || !QUALITIES.has(m[2] || '')) return null;
  return { root: normalizeRoot(m[1]), quality: m[2] || '', bass: m[3] ? normalizeRoot(m[3]) : null };
}

export function transposeChord(sym, semis) {
  const c = parseChord(sym);
  if (!c) return sym;
  const t = n => NOTES[(NOTES.indexOf(n) + (semis % 12) + 12) % 12];
  const bass = c.bass ? '/' + (DISPLAY[t(c.bass)] || t(c.bass)) : '';
  return displayChord(t(c.root), c.quality) + bass;
}

export function noteToFreq(midi, a4 = 440) { return a4 * 2 ** ((midi - 69) / 12); }

export function freqToNote(freq, a4 = 440) {
  const midiFloat = 69 + 12 * Math.log2(freq / a4);
  const midi = Math.round(midiFloat);
  return {
    midi,
    name: NOTES[((midi % 12) + 12) % 12],
    octave: Math.floor(midi / 12) - 1,
    cents: Math.round((midiFloat - midi) * 100),
  };
}

export const GUITAR_STRINGS = [
  { no: 6, label: 'E2', midi: 40 }, { no: 5, label: 'A2', midi: 45 },
  { no: 4, label: 'D3', midi: 50 }, { no: 3, label: 'G3', midi: 55 },
  { no: 2, label: 'B3', midi: 59 }, { no: 1, label: 'E4', midi: 64 },
];
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npm test` — Expected: 전체 PASS

- [ ] **Step 5: Commit**

```bash
git add js/music/theory.js tests/theory.test.js
git commit -m "feat: 음악 이론 모듈 - 코드 파싱/이조, 주파수-음이름 변환"
```

---

### Task 3: 편곡 엔진 (arrange.js)

**Files:**
- Create: `js/music/arrange.js`
- Test: `tests/arrange.test.js`

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/arrange.test.js`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toEasy, scoreKey, bestArrangement, arrangeSections } from '../js/music/arrange.js';

test('toEasy: 확장 코드 단순화', () => {
  assert.equal(toEasy('Cmaj7'), 'C');
  assert.equal(toEasy('Am9'), 'Am7');   // m9 -> m7, Am7은 비허용이라 Am으로? 아래 참조
});

test('toEasy: 허용 집합 내 코드는 유지', () => {
  assert.equal(toEasy('G7'), 'G7');
  assert.equal(toEasy('Bm7'), 'Bm7');
});

test('toEasy: 비허용 코드는 성질 폴백/근음 이동', () => {
  assert.equal(toEasy('Em7'), 'Em');    // m7 -> m 폴백 (Em7 비허용, Em 허용)
  assert.equal(toEasy('C#m7'), 'Dm7');  // 근음 반음 이동 폴백
});

test('scoreKey: 전부 쉬운 키는 1', () => {
  assert.equal(scoreKey(['C', 'Am', 'F', 'G7'], 0), 1);
});

test('bestArrangement: B-E-F# 진행은 +1 이조로 해결', () => {
  const r = bestArrangement(['B', 'E', 'F#']);
  assert.equal(r.semitones, 1);         // C, F, G — 전부 허용
  assert.equal(r.score, 1);
});

test('bestArrangement: 카포 제안', () => {
  // -1 이조 → D, G, A (전부 허용). -3(C,F,G)도 만점이지만 |−1|이 원곡 키에 더 가까워 선택됨
  const r = bestArrangement(['Eb', 'Ab', 'Bb']);
  assert.equal(r.semitones, -1);
  assert.equal(r.capo, 1);
});

test('arrangeSections: 섹션 구조 유지하며 편곡', () => {
  const sections = [{ name: 'Verse', lines: [
    { chords: [{ chord: 'B', position: 0 }, { chord: 'E', position: 8 }], lyrics: '가사입니다' },
  ]}];
  const r = arrangeSections(sections);
  assert.equal(r.semitones, 1);
  assert.equal(r.sections[0].lines[0].chords[0].chord, 'C');
  assert.equal(r.sections[0].lines[0].chords[0].position, 0);
  assert.equal(r.sections[0].lines[0].lyrics, '가사입니다');
});
```

주의: `Am9`의 기대값은 구현 규칙에 따른다 — m9→m7 단순화 후 Am7은 허용 집합에 없으므로 m 폴백 → **`Am`**. 테스트를 `assert.equal(toEasy('Am9'), 'Am')`으로 작성할 것.

- [ ] **Step 2: 실행해서 실패 확인**

Run: `npm test` — Expected: FAIL (`Cannot find module .../arrange.js`)

- [ ] **Step 3: arrange.js 구현**

```js
import { parseChord, displayChord, transposeChord, NOTES } from './theory.js';

export const EASY_CHORDS = ['A','Am','A7','Bb','Bm','Bm7','C','C7','D','Dm','D7','Dm7',
  'E','Em','E7','F','Fm','G','G7','Gm'];
const EASY = new Set(EASY_CHORDS.map(s => { const c = parseChord(s); return c.root + c.quality; }));

const QUALITY_MAP = { '':'', maj7:'', M7:'', maj9:'', 6:'', add9:'', sus2:'', sus4:'', 5:'', aug:'',
  m:'m', m6:'m', madd9:'m', dim:'m', dim7:'m', m7b5:'m7',
  7:'7', 9:'7', 11:'7', 13:'7', '7sus4':'7', aug7:'7',
  m7:'m7', m9:'m7', m11:'m7' };

function simplify(sym) {
  const c = parseChord(sym);
  return c ? { root: c.root, quality: QUALITY_MAP[c.quality] ?? '' } : null;
}

const FALLBACKS = { m7: ['m'], 7: [''], '': ['7'], m: ['m7'] };
function easyVariant(c) {
  if (EASY.has(c.root + c.quality)) return c;
  for (const q of FALLBACKS[c.quality] || [])
    if (EASY.has(c.root + q)) return { root: c.root, quality: q };
  return null;
}

export function toEasy(sym) {
  const s = simplify(sym);
  if (!s) return sym;
  const v = easyVariant(s);
  if (v) return displayChord(v.root, v.quality);
  for (const d of [1, -1]) {   // 마지막 수단: 근음 반음 이동
    const root = NOTES[(NOTES.indexOf(s.root) + d + 12) % 12];
    const v2 = easyVariant({ root, quality: s.quality });
    if (v2) return displayChord(v2.root, v2.quality);
  }
  return displayChord(s.root, s.quality);
}

export function scoreKey(chords, semis) {
  const uniq = [...new Set(chords)];
  if (!uniq.length) return 1;
  let easy = 0;
  for (const sym of uniq) {
    const s = simplify(transposeChord(sym, semis));
    if (s && easyVariant(s)) easy++;
  }
  return easy / uniq.length;
}

export function bestArrangement(chords) {
  let best = { semitones: 0, score: -1 };
  for (let semis = -6; semis <= 6; semis++) {
    const score = scoreKey(chords, semis);
    if (score > best.score + 1e-9 ||
        (Math.abs(score - best.score) < 1e-9 && Math.abs(semis) < Math.abs(best.semitones)))
      best = { semitones: semis, score };
  }
  const capo = ((12 - best.semitones) % 12);
  return { ...best, capo: best.semitones !== 0 && capo <= 7 ? capo : 0 };
}

export function arrangeSections(sections) {
  const all = sections.flatMap(s => s.lines.flatMap(l => l.chords.map(c => c.chord)));
  const best = bestArrangement(all);
  const out = sections.map(s => ({
    name: s.name,
    lines: s.lines.map(l => ({
      lyrics: l.lyrics,
      chords: l.chords.map(c => ({
        position: c.position,
        chord: toEasy(transposeChord(c.chord, best.semitones)),
      })),
    })),
  }));
  return { sections: out, ...best };
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npm test` — Expected: 전체 PASS
(카포 테스트 실패 시: semitones=-3이면 capo=(12+3)%12=3 ✓, semitones=1이면 capo=11>7→0 ✓ 로직 확인)

- [ ] **Step 5: Commit**

```bash
git add js/music/arrange.js tests/arrange.test.js
git commit -m "feat: 편곡 엔진 - 쉬운 코드 단순화, 최적 이조, 카포 제안"
```

---

### Task 4: 붙여넣기 파서 (parser.js)

**Files:**
- Create: `js/songs/parser.js`
- Test: `tests/parser.test.js`

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/parser.test.js`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isChordLine, parseSheet } from '../js/songs/parser.js';

test('isChordLine: 코드 줄 판별', () => {
  assert.equal(isChordLine('C        G7       Am'), true);
  assert.equal(isChordLine('나의 살던 고향은'), false);
  assert.equal(isChordLine('A boy walked home'), false); // 60% 미달 (A만 코드)
});

test('parseSheet: 코드줄+가사줄 페어링과 위치', () => {
  const text = [
    '[Verse 1]',
    'C        G7',
    '나의 살던 고향은',
    'F        C',
    '꽃피는 산골',
  ].join('\n');
  const sections = parseSheet(text);
  assert.equal(sections.length, 1);
  assert.equal(sections[0].name.toLowerCase().includes('verse'), true);
  const line0 = sections[0].lines[0];
  assert.equal(line0.lyrics, '나의 살던 고향은');
  assert.deepEqual(line0.chords.map(c => c.chord), ['C', 'G7']);
  assert.equal(line0.chords[0].position, 0);
  assert.equal(line0.chords[1].position, 9);
});

test('parseSheet: 한국어 섹션 헤더 인식', () => {
  const sections = parseSheet('후렴\nC G\n라라라');
  assert.equal(sections[0].name, '후렴');
});

test('parseSheet: 가사 없는 코드 줄(간주)', () => {
  const sections = parseSheet('간주\nC  G  Am  F');
  assert.equal(sections[0].lines[0].lyrics, '');
  assert.equal(sections[0].lines[0].chords.length, 4);
});

test('parseSheet: 인식 불가 텍스트는 예외', () => {
  assert.throws(() => parseSheet('   \n  \n'));
});
```

- [ ] **Step 2: 실행해서 실패 확인**

Run: `npm test` — Expected: FAIL

- [ ] **Step 3: parser.js 구현**

```js
import { parseChord } from '../music/theory.js';

const SECTION_RE = /^\s*[\[(]?\s*((?:pre-?)?(?:intro|verse|chorus|bridge|outro|interlude|solo|hook)|인트로|전주|(?:\d+\s*)?절|후렴|코러스|간주|브릿지|아웃트로)\s*(\d+)?\s*[\])]?\s*[:：]?\s*$/i;

const cleanToken = t => t.replace(/[|,.]/g, '');

export function isChordLine(line) {
  const tokens = line.trim().split(/\s+/).filter(Boolean);
  if (!tokens.length) return false;
  const ok = tokens.filter(t => parseChord(cleanToken(t))).length;
  return ok / tokens.length >= 0.6;
}

function chordPositions(line) {
  const out = [];
  const re = /\S+/g;
  let m;
  while ((m = re.exec(line))) {
    if (parseChord(cleanToken(m[0])))
      out.push({ chord: cleanToken(m[0]), position: m.index });
  }
  return out;
}

export function parseSheet(text) {
  const lines = String(text).replace(/\r/g, '').split('\n');
  const sections = [];
  let cur = null;
  const open = name => { cur = { name, lines: [] }; sections.push(cur); };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    const sec = line.trim().match(SECTION_RE);
    if (sec) { open(line.replace(/[\[\]():：]/g, '').trim()); continue; }
    if (!cur) open('Verse');
    if (isChordLine(line)) {
      const next = lines[i + 1] || '';
      if (next.trim() && !isChordLine(next) && !next.trim().match(SECTION_RE)) {
        cur.lines.push({ chords: chordPositions(line), lyrics: next.trimEnd() });
        i++;
      } else {
        cur.lines.push({ chords: chordPositions(line), lyrics: '' });
      }
    } else {
      cur.lines.push({ chords: [], lyrics: line.trimEnd() });
    }
  }
  if (!sections.length || !sections.some(s => s.lines.length))
    throw new Error('악보 형식을 인식하지 못했습니다');
  return sections;
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npm test` — Expected: 전체 PASS

- [ ] **Step 5: Commit**

```bash
git add js/songs/parser.js tests/parser.test.js
git commit -m "feat: 붙여넣기 악보 파서 - 코드줄/가사줄/섹션 인식"
```

---

### Task 5: 코드 운지 DB + SVG 다이어그램 (chords-db.js)

**Files:**
- Create: `js/music/chords-db.js`
- Test: `tests/chords-db.test.js`

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/chords-db.test.js`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CHORD_SHAPES, chordSVG } from '../js/music/chords-db.js';
import { EASY_CHORDS } from '../js/music/arrange.js';

test('허용 코드 20개 전부 운지 보유', () => {
  for (const name of EASY_CHORDS)
    assert.ok(CHORD_SHAPES[name], `${name} 운지 누락`);
});

test('운지는 6줄 배열', () => {
  for (const [name, frets] of Object.entries(CHORD_SHAPES))
    assert.equal(frets.length, 6, name);
});

test('chordSVG: svg 문자열 생성, 미보유 코드는 빈 문자열', () => {
  assert.ok(chordSVG('C').startsWith('<svg'));
  assert.equal(chordSVG('Zzz'), '');
});
```

- [ ] **Step 2: 실행해서 실패 확인**

Run: `npm test` — Expected: FAIL

- [ ] **Step 3: chords-db.js 구현**

```js
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
  const baseFret = fretted.length && Math.min(...fretted) > 4 ? Math.min(...fretted) : 1;
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
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npm test` — Expected: 전체 PASS

- [ ] **Step 5: Commit**

```bash
git add js/music/chords-db.js tests/chords-db.test.js
git commit -m "feat: 코드 운지 DB + SVG 다이어그램 렌더러"
```

---

### Task 6: 반주 패턴 라이브러리 + TAB 렌더 (patterns.js)

**Files:**
- Create: `js/music/patterns.js`
- Test: `tests/patterns.test.js`

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/patterns.test.js`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PATTERNS, getPattern, defaultPatternId, renderPatternTab } from '../js/music/patterns.js';

test('패턴 8종, 필수 필드', () => {
  assert.equal(PATTERNS.length, 8);
  for (const p of PATTERNS) {
    assert.ok(p.id && p.name && p.ts && p.type && Array.isArray(p.steps));
  }
});

test('defaultPatternId: 박자별 기본값', () => {
  assert.equal(defaultPatternId('4/4'), 'strum-basic');
  assert.equal(defaultPatternId('3/4'), 'strum-waltz');
  assert.equal(defaultPatternId('6/8'), 'arp-68');
});

test('renderPatternTab: 6줄, 균일한 길이', () => {
  const lines = renderPatternTab(getPattern('strum-basic'), 'C');
  assert.equal(lines.length, 6);
  assert.ok(lines.every(l => l.length === lines[0].length));
  assert.ok(lines[0].startsWith('e|'));
  assert.ok(lines[5].startsWith('E|'));
});

test('renderPatternTab: 스트로크는 운지 프렛 표시', () => {
  const lines = renderPatternTab(getPattern('strum-basic'), 'C');
  // C: 5번줄(A) 3프렛 → 'A' 줄에 3, 6번줄 뮤트 → 'E' 줄 첫 스텝은 '-'
  assert.ok(lines[4].includes('3'));
  assert.equal(lines[5][2], '-');
});

test('renderPatternTab: 아르페지오는 지정 줄만 표시', () => {
  const lines = renderPatternTab(getPattern('arp-8'), 'C');
  // 첫 스텝 = 6번줄이지만 C는 6번줄 뮤트 → 베이스는 5번줄(3프렛)로 대체
  assert.equal(lines[4][2], '3');
});
```

- [ ] **Step 2: 실행해서 실패 확인**

Run: `npm test` — Expected: FAIL

- [ ] **Step 3: patterns.js 구현**

```js
import { CHORD_SHAPES } from './chords-db.js';

// steps: 8분음표 단위 / 'D' 다운, 'U' 업, 'X' 뮤트, '' 쉼, 숫자 = 뜯는 줄 번호(6=최저음)
export const PATTERNS = [
  { id: 'strum-basic',  name: '기본 스트로크',    ts: '4/4', type: 'strum', steps: ['D','','D','U','','U','D','U'] },
  { id: 'strum-ballad', name: '잔잔한 스트로크',  ts: '4/4', type: 'strum', steps: ['D','','','U','','U','',''] },
  { id: 'strum-pop',    name: '경쾌한 스트로크',  ts: '4/4', type: 'strum', steps: ['D','U','X','U','D','U','X','U'] },
  { id: 'strum-waltz',  name: '왈츠 스트로크',    ts: '3/4', type: 'strum', steps: ['D','','D','U','D','U'] },
  { id: 'arp-8',        name: '8비트 아르페지오', ts: '4/4', type: 'arp',   steps: [6,3,2,3,1,3,2,3] },
  { id: 'arp-ballad',   name: '발라드 아르페지오',ts: '4/4', type: 'arp',   steps: [6,3,2,1,2,3,2,3] },
  { id: 'arp-waltz',    name: '왈츠 아르페지오',  ts: '3/4', type: 'arp',   steps: [6,3,2,3,2,3] },
  { id: 'arp-68',       name: '6/8 아르페지오',   ts: '6/8', type: 'arp',   steps: [6,3,2,1,2,3] },
];

export const getPattern = id => PATTERNS.find(p => p.id === id) || PATTERNS[0];

export function defaultPatternId(ts) {
  if (ts === '3/4') return 'strum-waltz';
  if (ts === '6/8') return 'arp-68';
  return 'strum-basic';
}

const CELL = 4; // 스텝당 문자 폭
const ROW_NAMES = ['e', 'B', 'G', 'D', 'A', 'E']; // 표시 순서: 1번줄(위) → 6번줄(아래)

export function renderPatternTab(pattern, chordName) {
  const frets = CHORD_SHAPES[chordName] || CHORD_SHAPES.C;
  // frets 인덱스: 0=6번줄 → 5=1번줄. 표시 행 r(0=1번줄)의 프렛 = frets[5-r]
  const rows = ROW_NAMES.map(n => n + '|');
  const bass = frets.findIndex(f => f >= 0); // 최저음 유효 줄 인덱스(6번줄부터)
  for (const step of pattern.steps) {
    for (let r = 0; r < 6; r++) {
      const fi = 5 - r;
      let cell = '-';
      if (pattern.type === 'strum') {
        if (step === 'D' || step === 'U') cell = frets[fi] >= 0 ? String(frets[fi]) : '-';
        else if (step === 'X') cell = frets[fi] >= 0 ? 'x' : '-';
      } else if (typeof step === 'number') {
        let target = 6 - step;              // 줄 번호 → frets 인덱스
        if (frets[target] < 0) target = bass; // 뮤트된 줄이면 베이스 줄로 대체
        if (target === fi) cell = String(frets[fi]);
      }
      rows[r] += cell.padEnd(CELL, '-');
    }
  }
  return rows.map(r => r + '|');
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npm test` — Expected: 전체 PASS

- [ ] **Step 5: Commit**

```bash
git add js/music/patterns.js tests/patterns.test.js
git commit -m "feat: 반주 패턴 8종 + 6줄 TAB 렌더러"
```

---

### Task 7: 피치 검출 (pitch.js)

**Files:**
- Create: `js/audio/pitch.js`
- Test: `tests/pitch.test.js`

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/pitch.test.js`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { detectPitch } from '../js/audio/pitch.js';

const SR = 44100;
function sine(freq, n = 4096, amp = 0.5) {
  const buf = new Float32Array(n);
  for (let i = 0; i < n; i++) buf[i] = amp * Math.sin(2 * Math.PI * freq * i / SR);
  return buf;
}

test('440Hz 사인파 검출 (±1Hz)', () => {
  assert.ok(Math.abs(detectPitch(sine(440), SR) - 440) < 1);
});

test('기타 6번줄 E2 82.41Hz 검출 (±1Hz)', () => {
  assert.ok(Math.abs(detectPitch(sine(82.41), SR) - 82.41) < 1);
});

test('배음 섞인 신호도 기음 검출', () => {
  const buf = sine(110);
  const h2 = sine(220, 4096, 0.3), h3 = sine(330, 4096, 0.2);
  for (let i = 0; i < buf.length; i++) buf[i] += h2[i] + h3[i];
  assert.ok(Math.abs(detectPitch(buf, SR) - 110) < 1.5);
});

test('무음이면 null', () => {
  assert.equal(detectPitch(new Float32Array(4096), SR), null);
});
```

- [ ] **Step 2: 실행해서 실패 확인**

Run: `npm test` — Expected: FAIL

- [ ] **Step 3: pitch.js 구현** (정규화 자기상관 + 첫 유의미 피크 + 포물선 보간)

```js
export function detectPitch(buf, sampleRate, opts = {}) {
  const { minFreq = 60, maxFreq = 500, rmsGate = 0.01 } = opts;
  const n = buf.length;
  let rms = 0;
  for (let i = 0; i < n; i++) rms += buf[i] * buf[i];
  rms = Math.sqrt(rms / n);
  if (rms < rmsGate) return null;

  const minLag = Math.floor(sampleRate / maxFreq);
  const maxLag = Math.min(Math.floor(sampleRate / minFreq), (n >> 1) - 2);
  const nsdf = new Float32Array(maxLag + 2);
  for (let lag = minLag; lag <= maxLag + 1; lag++) {
    let ac = 0, norm = 0;
    for (let i = 0; i < n - lag; i++) {
      ac += buf[i] * buf[i + lag];
      norm += buf[i] * buf[i] + buf[i + lag] * buf[i + lag];
    }
    nsdf[lag] = norm ? (2 * ac) / norm : 0;
  }

  let maxVal = 0;
  for (let lag = minLag; lag <= maxLag; lag++) if (nsdf[lag] > maxVal) maxVal = nsdf[lag];
  if (maxVal < 0.5) return null;

  // 옥타브 오류 방지: 최대값의 90% 이상인 첫 로컬 피크 선택
  let lag = -1;
  for (let l = minLag + 1; l <= maxLag; l++) {
    if (nsdf[l] >= 0.9 * maxVal && nsdf[l] >= nsdf[l - 1] && nsdf[l] >= nsdf[l + 1]) { lag = l; break; }
  }
  if (lag < 0) return null;

  const a = nsdf[lag - 1], b = nsdf[lag], c = nsdf[lag + 1];
  const denom = a - 2 * b + c;
  const shift = denom ? (a - c) / (2 * denom) : 0;
  return sampleRate / (lag + shift);
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npm test` — Expected: 전체 PASS

- [ ] **Step 5: Commit**

```bash
git add js/audio/pitch.js tests/pitch.test.js
git commit -m "feat: 자기상관 기반 피치 검출 (옥타브 오류 방지, 보간)"
```

---

### Task 8: 크로마그램 + 코드 매칭 (chroma.js)

**Files:**
- Create: `js/audio/chroma.js`
- Test: `tests/chroma.test.js`

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/chroma.test.js`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chromaVector, chordTemplate, matchChord } from '../js/audio/chroma.js';

const SR = 44100;
function chordSignal(freqs, n = 8192) {
  const buf = new Float32Array(n);
  for (const f of freqs)
    for (let i = 0; i < n; i++) buf[i] += 0.3 * Math.sin(2 * Math.PI * f * i / SR);
  return buf;
}

test('chordTemplate: C 메이저는 C,E,G 활성', () => {
  const t = chordTemplate('C');
  assert.equal(t[0], 1); assert.equal(t[4], 1); assert.equal(t[7], 1);
  assert.equal(t.reduce((a, b) => a + b), 3);
});

test('C 코드 소리 → C로 매칭', () => {
  // C3(130.81) E3(164.81) G3(196.00)
  const v = chromaVector(chordSignal([130.81, 164.81, 196.0]), SR);
  const r = matchChord(v, ['C', 'F', 'G', 'Am']);
  assert.equal(r.chord, 'C');
  assert.ok(r.score > 0.6);
});

test('G7 코드 소리 → G7로 매칭', () => {
  // G2(98) B2(123.47) D3(146.83) F3(174.61)
  const v = chromaVector(chordSignal([98, 123.47, 146.83, 174.61]), SR);
  const r = matchChord(v, ['C', 'G7', 'Am', 'Em']);
  assert.equal(r.chord, 'G7');
});
```

- [ ] **Step 2: 실행해서 실패 확인**

Run: `npm test` — Expected: FAIL

- [ ] **Step 3: chroma.js 구현**

```js
import { noteToFreq, parseChord, NOTES } from '../music/theory.js';

export function goertzelMag(buf, sampleRate, freq) {
  const w = 2 * Math.PI * freq / sampleRate;
  const coeff = 2 * Math.cos(w);
  let s1 = 0, s2 = 0;
  for (let i = 0; i < buf.length; i++) {
    const s0 = buf[i] + coeff * s1 - s2;
    s2 = s1; s1 = s0;
  }
  return Math.sqrt(s1 * s1 + s2 * s2 - coeff * s1 * s2);
}

export function chromaVector(buf, sampleRate, a4 = 440) {
  const v = new Array(12).fill(0);
  for (let midi = 40; midi <= 76; midi++)   // E2 ~ E5
    v[midi % 12] += goertzelMag(buf, sampleRate, noteToFreq(midi, a4));
  const max = Math.max(...v);
  return max ? v.map(x => x / max) : v;
}

const INTERVALS = { '': [0, 4, 7], m: [0, 3, 7], 7: [0, 4, 7, 10], m7: [0, 3, 7, 10] };

export function chordTemplate(sym) {
  const c = parseChord(sym);
  const t = new Array(12).fill(0);
  if (!c) return t;
  for (const iv of INTERVALS[c.quality] || INTERVALS[''])
    t[(NOTES.indexOf(c.root) + iv) % 12] = 1;
  return t;
}

export function cosine(a, b) {
  let d = 0, na = 0, nb = 0;
  for (let i = 0; i < 12; i++) { d += a[i] * b[i]; na += a[i] ** 2; nb += b[i] ** 2; }
  return na && nb ? d / Math.sqrt(na * nb) : 0;
}

export function matchChord(chroma, candidates) {
  let best = null;
  for (const sym of candidates) {
    const score = cosine(chroma, chordTemplate(sym));
    if (!best || score > best.score) best = { chord: sym, score };
  }
  return best;
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npm test` — Expected: 전체 PASS

- [ ] **Step 5: Commit**

```bash
git add js/audio/chroma.js tests/chroma.test.js
git commit -m "feat: 크로마그램 추출 + 코드 템플릿 매칭"
```

---

### Task 9: 저장소 (store.js)

**Files:**
- Create: `js/songs/store.js`
- Test: `tests/store.test.js` (순수 함수인 정렬 비교자만)

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/store.test.js`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compareSongs } from '../js/songs/store.js';

test('한글 제목이 영문보다 앞, 각각 가나다/알파벳순', () => {
  const songs = [
    { title: 'Yesterday' }, { title: '바람이 분다' }, { title: 'Autumn Leaves' }, { title: '가로수 그늘 아래' },
  ].sort(compareSongs);
  assert.deepEqual(songs.map(s => s.title),
    ['가로수 그늘 아래', '바람이 분다', 'Autumn Leaves', 'Yesterday']);
});
```

- [ ] **Step 2: 실행해서 실패 확인**

Run: `npm test` — Expected: FAIL

- [ ] **Step 3: store.js 구현**

```js
const DB_NAME = 'scoretuner', STORE = 'songs';

const isKo = s => /^[ㄱ-ㅎ가-힣]/.test(String(s).trim());
export function compareSongs(a, b) {
  const ka = isKo(a.title), kb = isKo(b.title);
  if (ka !== kb) return ka ? -1 : 1;
  return String(a.title).localeCompare(String(b.title), ka ? 'ko-KR' : 'en', { sensitivity: 'base' });
}

let dbPromise = null;
function openDB() {
  dbPromise ||= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'id' });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

async function withStore(mode, fn) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const result = fn(tx.objectStore(STORE));
    tx.oncomplete = () => resolve(result.result ?? result);
    tx.onerror = () => reject(tx.error);
  });
}

export async function saveSong(song) {
  song.updatedAt = Date.now();
  if (!song.id) { song.id = crypto.randomUUID(); song.createdAt = song.updatedAt; }
  await withStore('readwrite', s => s.put(song));
  return song;
}
export function getSong(id) { return withStore('readonly', s => s.get(id)); }
export function deleteSong(id) { return withStore('readwrite', s => s.delete(id)); }
export async function listSongs() {
  const songs = await withStore('readonly', s => s.getAll());
  return songs.sort(compareSongs);
}

export async function exportBackup() {
  const songs = await listSongs();
  const blob = new Blob([JSON.stringify(songs, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `scoretuner-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
}
export async function importBackup(file) {
  const songs = JSON.parse(await file.text());
  if (!Array.isArray(songs)) throw new Error('백업 파일 형식이 아닙니다');
  for (const s of songs) if (s.id && s.title && s.sections) await saveSong(s);
  return songs.length;
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npm test` — Expected: 전체 PASS

- [ ] **Step 5: Commit**

```bash
git add js/songs/store.js tests/store.test.js
git commit -m "feat: IndexedDB 곡 저장소 - CRUD, 가나다/알파벳 정렬, JSON 백업"
```

---

### Task 10: 오디오 입출력 (kalimba.js, mic.js)

**Files:**
- Create: `js/audio/kalimba.js`, `js/audio/mic.js`

브라우저 API 의존 모듈 — 단위 테스트 없음, Task 11에서 실브라우저 검증.

- [ ] **Step 1: kalimba.js 구현**

```js
let ctx = null;
export function audioCtx() {
  ctx ||= new (window.AudioContext || window.webkitAudioContext)();
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

// 칼림바 음색: 기음 + 비배음 부분음(금속 타격감), 빠른 어택 + 지수 감쇠
export function playKalimba(freq, dur = 2.2) {
  const c = audioCtx(), t = c.currentTime;
  const out = c.createGain();
  out.gain.value = 0.5;
  out.connect(c.destination);
  for (const [mult, amp, d] of [[1, 1, dur], [2.03, 0.35, dur * 0.55], [5.4, 0.12, dur * 0.25]]) {
    const o = c.createOscillator();
    o.type = 'sine';
    o.frequency.value = freq * mult;
    const g = c.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(amp, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(g).connect(out);
    o.start(t); o.stop(t + d);
  }
}
```

- [ ] **Step 2: mic.js 구현**

```js
import { audioCtx } from './kalimba.js';

let stream = null, analyser = null, buf = null;

export async function startMic(fftSize = 2048) {
  if (stream && analyser?.fftSize === fftSize) return;
  stopMic();
  stream = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
  });
  const c = audioCtx();
  analyser = c.createAnalyser();
  analyser.fftSize = fftSize;
  c.createMediaStreamSource(stream).connect(analyser);
  buf = new Float32Array(fftSize);
}

export function micFrame() {
  if (!analyser) return null;
  analyser.getFloatTimeDomainData(buf);
  return { buf, sampleRate: audioCtx().sampleRate };
}

export function micActive() { return !!stream; }

export function stopMic() {
  stream?.getTracks().forEach(t => t.stop());
  stream = analyser = buf = null;
}
```

- [ ] **Step 3: Commit**

```bash
git add js/audio/kalimba.js js/audio/mic.js
git commit -m "feat: 칼림바 음 합성 + 마이크 캡처 래퍼"
```

---

### Task 11: 튜너 화면 (tuner.js)

**Files:**
- Create: `js/screens/tuner.js`
- Modify: `js/app.js` (import 추가), `css/screens.css` (스타일 추가)

- [ ] **Step 1: tuner.js 구현**

```js
import { registerScreen } from '../app.js';
import { GUITAR_STRINGS, noteToFreq, freqToNote } from '../music/theory.js';
import { playKalimba } from '../audio/kalimba.js';
import { startMic, micFrame, stopMic } from '../audio/mic.js';
import { detectPitch } from '../audio/pitch.js';

const root = document.getElementById('screen-tuner');
let selected = null;   // null = 자동 감지, 아니면 GUITAR_STRINGS 항목
let raf = 0, wasOk = false;

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
    마이크 권한이 필요합니다. <button class="btn ghost" id="mic-retry">다시 요청</button>
  </div>`;

root.querySelector('#string-row').addEventListener('click', e => {
  const btn = e.target.closest('.string-btn');
  if (!btn) return;
  const s = GUITAR_STRINGS.find(x => x.no === Number(btn.dataset.no));
  playKalimba(noteToFreq(s.midi, a4()));
  selected = selected?.no === s.no ? null : s;
  root.querySelectorAll('.string-btn').forEach(b =>
    b.classList.toggle('selected', Number(b.dataset.no) === selected?.no));
});
root.querySelector('#mic-retry').addEventListener('click', start);

function nearestString(midi) {
  return GUITAR_STRINGS.reduce((a, b) =>
    Math.abs(b.midi - midi) < Math.abs(a.midi - midi) ? b : a);
}

function update() {
  const frame = micFrame();
  if (frame) {
    const freq = detectPitch(frame.buf, frame.sampleRate, { minFreq: 60, maxFreq: 500 });
    if (freq) {
      const note = freqToNote(freq, a4());
      const target = selected || nearestString(note.midi);
      const cents = Math.max(-50, Math.min(50,
        Math.round(1200 * Math.log2(freq / noteToFreq(target.midi, a4())))));
      root.querySelector('#tn-name').textContent = target.label[0];
      root.querySelector('#tn-oct').textContent = `${target.label.slice(1)}번줄 ${target.no} · ${cents > 0 ? '+' : ''}${cents}¢`;
      root.querySelector('#gauge-needle').style.left = `${50 + cents}%`;
      const guide = root.querySelector('#tn-guide');
      const ok = Math.abs(cents) <= 5;
      root.querySelector('.tuner-display').classList.toggle('ok', ok);
      guide.textContent = ok ? '정확합니다 ✓'
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
```

화면 전환 시 마이크를 정리하기 위해 app.js에 이탈 훅을 추가한다(Step 2).

- [ ] **Step 2: app.js에 화면 이탈 훅 추가**

`js/app.js`의 `show()` 를 다음으로 교체:

```js
const leaveHandlers = {};
export function registerLeave(name, fn) { leaveHandlers[name] = fn; }

let current = 'tuner';
function show(name, param) {
  leaveHandlers[current]?.();
  current = name;
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(`screen-${name}`)?.classList.add('active');
  document.querySelectorAll('#tabbar button').forEach(b =>
    b.classList.toggle('active', b.dataset.screen === name));
  handlers[name]?.(param);
  window.scrollTo(0, 0);
}
```

tuner.js 끝에:
```js
import { registerLeave } from '../app.js';   // 파일 상단 import에 합치기
registerLeave('tuner', () => { cancelAnimationFrame(raf); stopMic(); });
```

app.js 하단에 화면 모듈 import 추가 (이후 태스크마다 하나씩 늘어남):
```js
import './screens/tuner.js';
```
주의: `show('tuner')` 호출은 import 아래로 이동 (모듈 등록 후 실행되어야 함).

- [ ] **Step 3: css/screens.css에 튜너 스타일 추가**

```css
/* ---- 튜너 ---- */
.tuner-display { text-align:center; padding:28px 16px; margin-bottom:20px; }
.tuner-note { font-size:64px; font-weight:800; line-height:1; }
.tuner-note #tn-oct { font-size:14px; font-weight:500; color:var(--text2); display:block; margin-top:8px; }
.tuner-gauge { margin:22px auto 6px; max-width:340px; }
.gauge-track { position:relative; height:8px; border-radius:4px; background:var(--surface2); }
.gauge-track::after { content:''; position:absolute; left:50%; top:-4px; width:2px; height:16px; background:var(--line); }
#gauge-needle { position:absolute; top:-5px; width:4px; height:18px; border-radius:2px;
  background:var(--warn); left:50%; transform:translateX(-50%); transition:left .08s linear; }
.tuner-display.ok #gauge-needle { background:var(--ok); }
.gauge-labels { display:flex; justify-content:space-between; font-size:11px; color:var(--text2); margin-top:6px; }
.tuner-guide { margin-top:16px; font-size:16px; font-weight:600; }
.tuner-display.ok .tuner-guide { color:var(--ok); }
.string-row { display:flex; gap:8px; justify-content:center; margin-bottom:14px; }
.string-btn { flex:1; max-width:76px; padding:12px 0; border-radius:var(--radius);
  background:var(--surface); border:1px solid var(--line); display:flex; flex-direction:column; gap:2px; align-items:center; }
.string-btn.selected { background:var(--accent); color:var(--on-accent); border-color:var(--accent); }
.string-no { font-size:18px; font-weight:800; }
.string-note { font-size:11px; opacity:.75; }
.center { text-align:center; }
.card.warn { border-color:var(--warn); color:var(--warn); margin-top:14px;
  display:flex; align-items:center; justify-content:space-between; gap:10px; }
```

- [ ] **Step 4: 브라우저 검증**

로컬 서버에서: ① 줄 버튼 터치 → 칼림바 음 재생 + 버튼 강조 ② 마이크 허용 → 휘파람/기타 소리에 음이름·게이지 반응 ③ 권한 거부 시 안내 카드 표시. (PC 마이크로 충분히 검증 가능)

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: 튜너 화면 - 기준음 재생, 실시간 조율 게이지, 자동 줄 감지"
```

---

### Task 12: 설정 화면 + AI 모듈 (settings.js, ai.js)

**Files:**
- Create: `js/screens/settings.js`, `js/songs/ai.js`
- Modify: `js/app.js` (import), `css/screens.css`

- [ ] **Step 1: settings.js 구현**

```js
import { registerScreen } from '../app.js';

const root = document.getElementById('screen-settings');
root.innerHTML = `
  <h1>설정</h1>
  <div class="card set-group">
    <label class="set-label">테마</label>
    <select id="set-theme">
      <option value="">시스템 자동</option><option value="dark">다크</option><option value="light">라이트</option>
    </select>
  </div>
  <div class="card set-group">
    <label class="set-label">기준 주파수 A4 (Hz)</label>
    <input id="set-a4" type="number" min="415" max="466" step="1">
  </div>
  <div class="card set-group">
    <label class="set-label">Claude API 키 (AI 곡 생성용 · 선택)</label>
    <input id="set-key" type="password" placeholder="sk-ant-...">
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
$('#set-a4').addEventListener('change', e => localStorage.setItem('st_a4', e.target.value));
$('#set-key').addEventListener('change', e => localStorage.setItem('st_api_key', e.target.value.trim()));
```

- [ ] **Step 2: ai.js 구현** (AI는 표준 "코드줄 위 가사줄" 시트 텍스트를 반환 → 붙여넣기 파서 재사용, DRY)

```js
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
- 실제 가사와 실제 코드 진행을 사용. 모르는 곡이면 "unknown": true 필드만 반환`;

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
  if (!res.ok) throw new Error('API_' + res.status);
  const data = await res.json();
  const text = data.content.map(b => b.text || '').join('');
  const json = JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1));
  if (json.unknown) throw new Error('UNKNOWN_SONG');
  return json;   // { title, artist, timeSignature, mood, sheet }
}

export const AI_ERRORS = {
  NO_KEY: '설정에서 Claude API 키를 먼저 등록해주세요.',
  BAD_KEY: 'API 키가 올바르지 않습니다. 설정에서 확인해주세요.',
  UNKNOWN_SONG: 'AI가 이 곡을 알지 못합니다. 붙여넣기 모드를 이용해주세요.',
  API_429: 'API 사용 한도를 초과했습니다. 잠시 후 다시 시도해주세요.',
};
export function aiErrorMessage(err) {
  return AI_ERRORS[err.message] || '곡 생성에 실패했습니다. 네트워크를 확인하거나 붙여넣기 모드를 이용해주세요.';
}
```

- [ ] **Step 3: app.js에 import 추가, css에 스타일 추가**

`js/app.js`: `import './screens/settings.js';`

`css/screens.css` 추가:
```css
/* ---- 설정 ---- */
.set-group { margin-bottom:14px; display:flex; flex-direction:column; gap:8px; }
.set-label { font-size:13px; font-weight:700; color:var(--text2); }
```

- [ ] **Step 4: 브라우저 검증**

설정 탭: 테마 변경 즉시 반영, A4·API 키 저장 후 새로고침해도 유지되면 OK.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: 설정 화면(테마/A4/API키) + Claude API 곡 생성 모듈"
```

---

### Task 13: 곡 추가 화면 (addsong.js)

**Files:**
- Create: `js/screens/addsong.js`
- Modify: `js/app.js` (import), `css/screens.css`

- [ ] **Step 1: addsong.js 구현**

```js
import { registerScreen } from '../app.js';
import { navigate } from '../bus.js';
import { parseSheet } from '../songs/parser.js';
import { arrangeSections } from '../music/arrange.js';
import { PATTERNS, defaultPatternId } from '../music/patterns.js';
import { saveSong } from '../songs/store.js';
import { generateSong, hasApiKey, aiErrorMessage } from '../songs/ai.js';

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
    <label class="set-label">코드+가사 붙여넣기</label>
    <textarea id="add-paste" rows="10" placeholder="검색한 악보의 코드와 가사를 복사해서 붙여넣으세요.&#10;&#10;예)&#10;C        G7&#10;나의 살던 고향은"></textarea>
    <label class="set-label">반주 패턴</label>
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

$('#add-search').addEventListener('click', () => {
  const q = `${$('#add-title').value} ${$('#add-artist').value} 기타 코드`.trim();
  if (!$('#add-title').value.trim()) return status('노래 제목을 입력해주세요.', true);
  window.open(`https://www.google.com/search?q=${encodeURIComponent(q)}`, '_blank');
});

async function saveArranged({ title, artist, sections, timeSignature, patternId, source }) {
  const arranged = arrangeSections(sections);
  const song = await saveSong({
    id: editingId || undefined,
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
  try {
    const sections = parseSheet($('#add-paste').value);
    await saveArranged({
      title, artist: $('#add-artist').value.trim(), sections,
      timeSignature: '4/4', patternId: $('#add-pattern').value, source: 'paste',
    });
  } catch (e) {
    status(e.message === '악보 형식을 인식하지 못했습니다'
      ? '악보 형식을 인식하지 못했습니다. 코드 줄과 가사 줄이 번갈아 나오는 형태인지 확인해주세요.'
      : `저장 실패: ${e.message}`, true);
  }
});

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

$('#add-ai').addEventListener('click', async () => {
  const title = $('#add-title').value.trim();
  if (!title) return status('노래 제목을 입력해주세요.', true);
  if (!hasApiKey()) return status('설정에서 Claude API 키를 먼저 등록해주세요.', true);
  status('AI가 악보를 만드는 중… (10~30초)');
  $('#add-ai').disabled = true;
  try {
    const r = await generateSong(title, $('#add-artist').value.trim());
    const sections = parseSheet(r.sheet);
    const moodMap = { calm: 'strum-ballad', ballad: 'arp-ballad', pop: 'strum-pop', waltz: 'strum-waltz' };
    await saveArranged({
      title: r.title || title, artist: r.artist || $('#add-artist').value.trim(),
      sections, timeSignature: r.timeSignature || '4/4',
      patternId: moodMap[r.mood] || defaultPatternId(r.timeSignature || '4/4'), source: 'ai',
    });
  } catch (e) {
    status(aiErrorMessage(e), true);
  } finally {
    $('#add-ai').disabled = false;
  }
});
```

- [ ] **Step 2: css/screens.css 추가 + app.js import**

```css
/* ---- 곡 추가 ---- */
.add-actions { display:flex; gap:8px; }
.add-actions .btn { flex:1; font-size:14px; }
#add-paste { font-family:ui-monospace,Consolas,monospace; font-size:13px; white-space:pre; }
```

`js/app.js`: `import './screens/addsong.js';`

- [ ] **Step 3: 브라우저 검증**

곡 추가 탭에서 예시 텍스트(Task 4 테스트의 Verse 샘플) 붙여넣기 → "분석하고 저장" → 상태 메시지 확인. (viewer 미구현이라 전환은 아직 빈 화면 — 정상)

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: 곡 추가 화면 - 검색 링크, 붙여넣기 분석, AI 생성, 편곡 후 저장"
```

---

### Task 14: 라이브러리 화면 (library.js)

**Files:**
- Create: `js/screens/library.js`
- Modify: `js/app.js` (import), `css/screens.css`

- [ ] **Step 1: library.js 구현**

```js
import { registerScreen } from '../app.js';
import { navigate } from '../bus.js';
import { listSongs, deleteSong, exportBackup, importBackup } from '../songs/store.js';

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
    !q || s.title.toLowerCase().includes(q) || (s.artist || '').toLowerCase().includes(q));
  $('#lib-empty').hidden = songs.length > 0;
  $('#lib-list').innerHTML = shown.map(s => `
    <li class="lib-item" data-id="${s.id}">
      <div class="lib-info"><b>${s.title}</b><span class="muted">${s.artist || ''}</span></div>
      <button class="lib-del" data-del="${s.id}" aria-label="삭제">🗑</button>
    </li>`).join('');
}

async function refresh() { songs = await listSongs(); render($('#lib-search').value); }

$('#lib-search').addEventListener('input', e => render(e.target.value));
$('#lib-go-add').addEventListener('click', () => navigate('add'));
$('#lib-export').addEventListener('click', exportBackup);
$('#lib-import').addEventListener('change', async e => {
  if (!e.target.files[0]) return;
  try { await importBackup(e.target.files[0]); await refresh(); }
  catch { alert('백업 파일을 읽지 못했습니다.'); }
  e.target.value = '';
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
```

- [ ] **Step 2: css/screens.css 추가 + app.js import**

```css
/* ---- 라이브러리 ---- */
#lib-search { margin-bottom:14px; }
.lib-list { list-style:none; display:flex; flex-direction:column; gap:8px; }
.lib-item { display:flex; align-items:center; background:var(--surface); border:1px solid var(--line);
  border-radius:var(--radius); padding:14px 16px; cursor:pointer; }
.lib-info { flex:1; display:flex; flex-direction:column; gap:2px; }
.lib-del { font-size:16px; opacity:.55; padding:6px; }
.lib-tools { display:flex; gap:8px; margin-top:18px; justify-content:center; }
```

`js/app.js`: `import './screens/library.js';`

- [ ] **Step 3: 브라우저 검증**

Task 13에서 저장한 곡이 목록에 보이고, 검색·삭제·내보내기(JSON 다운로드)·가져오기가 동작하면 OK.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: 라이브러리 화면 - 정렬 목록, 검색, 삭제, 백업"
```

---

### Task 15: 악보 뷰어 (viewer.js)

**Files:**
- Create: `js/screens/viewer.js`
- Modify: `js/app.js` (import), `css/screens.css`

- [ ] **Step 1: viewer.js 구현**

```js
import { registerScreen } from '../app.js';
import { navigate } from '../bus.js';
import { getSong, saveSong } from '../songs/store.js';
import { transposeChord } from '../music/theory.js';
import { toEasy } from '../music/arrange.js';
import { chordSVG } from '../music/chords-db.js';
import { getPattern, renderPatternTab } from '../music/patterns.js';

const root = document.getElementById('screen-viewer');
let song = null, tabMode = false;

const shiftChord = c => song.keyShift ? toEasy(transposeChord(c, song.keyShift)) : c;

function uniqueChords() {
  const set = new Set();
  song.sections.forEach(s => s.lines.forEach(l => l.chords.forEach(c => set.add(shiftChord(c.chord)))));
  return [...set];
}

// 한 줄을 코드 위치 기준 세그먼트로 나눠 렌더 (코드가 가사 위에 정렬됨)
function lineHTML(line) {
  if (!line.chords.length) return `<div class="v-line"><span class="v-seg"><i></i><em>${line.lyrics}</em></span></div>`;
  const segs = [];
  const cuts = [...line.chords.map(c => c.position), Infinity];
  if (line.chords[0].position > 0)
    segs.push({ chord: '', text: line.lyrics.slice(0, line.chords[0].position) });
  line.chords.forEach((c, i) =>
    segs.push({ chord: shiftChord(c.chord), text: line.lyrics.slice(c.position, cuts[i + 1]) || ' ' }));
  return `<div class="v-line">${segs.map(s =>
    `<span class="v-seg"><i>${s.chord}</i><em>${s.text}</em></span>`).join('')}</div>`;
}

function render() {
  const pat = getPattern(song.patternId);
  const capoInfo = song.capo ? `카포 ${song.capo}프렛이면 원곡 키` : '';
  root.innerHTML = `
    <div class="v-head">
      <button id="v-back" aria-label="뒤로">←</button>
      <div class="v-title"><b>${song.title}</b><span class="muted">${song.artist || ''}</span></div>
      <button id="v-edit" aria-label="편집">✎</button>
      <button class="btn" id="v-play">연주</button>
    </div>
    <div class="v-controls card">
      <div class="v-key">
        <span class="set-label">키</span>
        <button class="key-btn" id="v-key-down">▼</button>
        <b id="v-key-val">${song.keyShift > 0 ? '+' : ''}${song.keyShift}</b>
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
      <div class="card v-pattern"><div class="set-label">${pat.name} (${pat.ts})</div>
        <pre>${renderPatternTab(pat, uniqueChords()[0] || 'C').join('\n')}</pre></div>` : ''}
    <div class="v-sheet">
      ${song.sections.map(s => `
        <div class="v-section"><div class="v-secname">${s.name}</div>
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
  song.keyShift = Math.max(-6, Math.min(6, (song.keyShift || 0) + d));
  await saveSong(song);
  render();
}

// 폰트 크기: -3 ~ +5 단계, 10%씩 (뷰어·연주 모드 공통 저장값)
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
```

- [ ] **Step 2: css/screens.css 추가 + app.js import**

```css
/* ---- 악보 뷰어 ---- */
.v-head { display:flex; align-items:center; gap:12px; margin-bottom:14px; }
#v-back { font-size:22px; padding:4px 8px; }
.v-title { flex:1; display:flex; flex-direction:column; }
.v-controls { display:flex; align-items:center; gap:16px; margin-bottom:14px; padding:12px 16px; }
.v-key { display:flex; align-items:center; gap:8px; }
.key-btn { background:var(--surface2); border-radius:8px; padding:6px 12px; font-size:13px; }
#v-key-val { min-width:28px; text-align:center; }
.v-tab-toggle { display:flex; gap:6px; align-items:center; font-weight:700; font-size:14px; }
.v-diagrams { display:flex; flex-wrap:wrap; gap:4px; margin-bottom:14px; }
.chord-svg { width:64px; height:78px; }
.v-pattern { margin-bottom:14px; }
.v-pattern pre { font-family:ui-monospace,Consolas,monospace; font-size:13px; overflow-x:auto; margin-top:8px; }
.v-section { margin-bottom:22px; }
.v-secname { font-size:12px; font-weight:800; color:var(--accent); text-transform:uppercase;
  letter-spacing:1px; margin-bottom:8px; }
.v-line { display:flex; flex-wrap:wrap; margin-bottom:10px; }
.v-seg { display:inline-flex; flex-direction:column; }
.v-sheet { font-size:17px; }
@media (min-width: 600px) { .v-sheet { font-size:19px; } }
.v-font { display:flex; gap:6px; }
.v-seg i { font-style:normal; font-weight:800; color:var(--accent); font-size:.82em; min-height:1.4em; }
.v-seg em { font-style:normal; font-size:1em; line-height:1.5; white-space:pre-wrap; }
```

`js/app.js`: `import './screens/viewer.js';`

- [ ] **Step 3: 브라우저 검증**

라이브러리에서 곡 선택 → ① 코드가 가사 위 올바른 위치에 표시 ② 키 ▲▼ 시 코드가 이조되고 새로고침 후에도 유지 ③ TAB 토글 시 다이어그램+패턴 표시.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: 악보 뷰어 - 코드/가사 정렬 표시, TAB 모드, 키 조절"
```

---

### Task 16: 연주 모드 (performance.js)

**Files:**
- Create: `js/screens/performance.js`
- Modify: `js/app.js` (import), `css/screens.css`

- [ ] **Step 1: performance.js 구현**

```js
import { registerScreen, registerLeave } from '../app.js';
import { navigate } from '../bus.js';
import { getSong } from '../songs/store.js';
import { transposeChord } from '../music/theory.js';
import { toEasy } from '../music/arrange.js';
import { startMic, micFrame, stopMic } from '../audio/mic.js';
import { chromaVector, matchChord } from '../audio/chroma.js';

const root = document.getElementById('screen-performance');
let song = null, flat = [], idx = 0, raf = 0, hits = 0, wakeLock = null;

// 곡 전체 코드를 일렬로 펼친 목록: [{chord, el}]
function flatten() {
  flat = [];
  root.querySelectorAll('.p-chord').forEach(el =>
    flat.push({ chord: el.dataset.chord, el }));
}

function setIdx(i) {
  if (i < 0 || i >= flat.length) return;
  flat[idx]?.el.classList.remove('now');
  idx = i; hits = 0;
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
    // 다음 코드가 현재 코드보다 뚜렷하게 우세한 프레임이 연속되면 전진
    if (next.score > 0.6 && next.score > cur.score + 0.05) hits++;
    else hits = Math.max(0, hits - 1);
    if (hits >= 6) setIdx(idx + 1);
  }
  raf = requestAnimationFrame(loop);
}

const shifted = c => song.keyShift ? toEasy(transposeChord(c, song.keyShift)) : c;

function render() {
  root.innerHTML = `
    <div class="p-bar">
      <button id="p-exit">✕ 종료</button>
      <b>${song.title}</b>
      <span id="p-next" class="muted"></span>
    </div>
    <div class="p-sheet" id="p-sheet">
      ${song.sections.map(s => `
        <div class="v-section"><div class="v-secname">${s.name}</div>
          ${s.lines.map(l => {
            if (!l.chords.length) return `<div class="v-line"><span class="v-seg"><i></i><em>${l.lyrics}</em></span></div>`;
            const cuts = [...l.chords.map(c => c.position), Infinity];
            let html = l.chords[0].position > 0
              ? `<span class="v-seg"><i></i><em>${l.lyrics.slice(0, l.chords[0].position)}</em></span>` : '';
            l.chords.forEach((c, i) => {
              const ch = shifted(c.chord);
              html += `<span class="v-seg"><i class="p-chord" data-chord="${ch}">${ch}</i><em>${l.lyrics.slice(c.position, cuts[i + 1]) || ' '}</em></span>`;
            });
            return `<div class="v-line">${html}</div>`;
          }).join('')}
        </div>`).join('')}
    </div>
    <div class="p-tap left" id="p-prev-zone"></div>
    <div class="p-tap right" id="p-next-zone"></div>`;

  root.querySelector('#p-exit').addEventListener('click', () => navigate('viewer', song.id));
  root.querySelector('#p-prev-zone').addEventListener('click', () => setIdx(idx - 1));
  root.querySelector('#p-next-zone').addEventListener('click', () => setIdx(idx + 1));
  flatten();
  idx = 0; hits = 0;
  if (flat.length) setIdx(0);
}

async function enterFullscreen() {
  document.body.classList.add('fullscreen', 'landscape');
  try {
    await document.documentElement.requestFullscreen();
    await screen.orientation.lock('landscape');
    document.body.classList.remove('landscape');  // 네이티브 회전 성공 → CSS 회전 불필요
  } catch { /* CSS 회전 폴백 유지 */ }
  try { wakeLock = await navigator.wakeLock?.request('screen'); } catch {}
}

registerScreen('performance', async id => {
  song = await getSong(id);
  if (!song) return navigate('library');
  render();
  await enterFullscreen();
  try { await startMic(8192); cancelAnimationFrame(raf); loop(); }
  catch { root.querySelector('#p-next').textContent = '마이크 사용 불가 — 좌/우 터치로 넘기세요'; }
});

registerLeave('performance', async () => {
  cancelAnimationFrame(raf); stopMic();
  wakeLock?.release(); wakeLock = null;
  document.body.classList.remove('fullscreen', 'landscape');
  if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  try { screen.orientation.unlock(); } catch {}
});
```

- [ ] **Step 2: css/screens.css 추가 + app.js import**

```css
/* ---- 연주 모드 ---- */
#screen-performance { padding:0; max-width:none; }
.p-bar { position:sticky; top:0; z-index:5; display:flex; align-items:center; gap:14px;
  background:var(--surface); border-bottom:1px solid var(--line); padding:10px 16px; }
#p-exit { color:var(--warn); font-weight:700; }
#p-next { margin-left:auto; }
.p-sheet { padding:20px 18px 45vh; }
.p-sheet .v-seg em { font-size:20px; }
.p-sheet .v-seg i { font-size:16px; min-height:24px; }
.p-chord { padding:1px 6px; border-radius:6px; }
.p-chord.now { background:var(--accent); color:var(--on-accent); }
.p-tap { position:fixed; top:56px; bottom:0; width:18%; z-index:4; }
.p-tap.left { left:0; } .p-tap.right { right:0; }
/* 네이티브 가로 고정 실패 시 CSS 회전 폴백 (세로 화면에서만) */
@media (orientation: portrait) {
  body.landscape #screen-performance.active { position:fixed; inset:0;
    transform:rotate(90deg); transform-origin:center;
    width:100vh; height:100vw; top:calc((100vh - 100vw)/2); left:calc((100vw - 100vh)/2);
    overflow-y:auto; }
}
```

`js/app.js`: `import './screens/performance.js';`

- [ ] **Step 3: 브라우저 검증**

뷰어 → "연주" → ① 전체화면 + 첫 코드 하이라이트 ② 우측 터치로 다음 코드 이동+스크롤 ③ (기타 또는 코드 음원 재생으로) 다음 코드 연주 시 자동 전진 ④ 종료 시 뷰어 복귀. PC에서는 가로 전환 대신 전체화면만 확인.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: 연주 모드 - 가로 전체화면, 연주 인식 자동 진행, 터치 보정"
```

---

### Task 17: PWA (manifest, Service Worker, 아이콘)

**Files:**
- Create: `manifest.json`, `sw.js`, `icons/icon.svg`

- [ ] **Step 1: icons/icon.svg 작성**

```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="112" fill="#0f1115"/>
  <circle cx="256" cy="256" r="150" fill="none" stroke="#4ade80" stroke-width="26"/>
  <rect x="243" y="120" width="26" height="150" rx="13" fill="#4ade80"/>
  <circle cx="256" cy="300" r="34" fill="#4ade80"/>
</svg>
```

- [ ] **Step 2: manifest.json 작성** (모든 경로는 상대경로 — GitHub Pages 하위경로 대응)

```json
{
  "name": "ScoreTuner",
  "short_name": "ScoreTuner",
  "description": "기타 튜너와 쉬운 코드 악보 라이브러리",
  "start_url": "./",
  "scope": "./",
  "display": "standalone",
  "orientation": "any",
  "background_color": "#0f1115",
  "theme_color": "#0f1115",
  "icons": [
    { "src": "icons/icon.svg", "sizes": "any", "type": "image/svg+xml", "purpose": "any" },
    { "src": "icons/icon.svg", "sizes": "any", "type": "image/svg+xml", "purpose": "maskable" }
  ]
}
```

- [ ] **Step 3: sw.js 작성**

```js
const CACHE = 'scoretuner-v1';
const ASSETS = [
  './', 'index.html', 'manifest.json', 'icons/icon.svg',
  'css/base.css', 'css/screens.css',
  'js/bus.js', 'js/app.js',
  'js/music/theory.js', 'js/music/arrange.js', 'js/music/chords-db.js', 'js/music/patterns.js',
  'js/audio/pitch.js', 'js/audio/chroma.js', 'js/audio/kalimba.js', 'js/audio/mic.js',
  'js/songs/parser.js', 'js/songs/store.js', 'js/songs/ai.js',
  'js/screens/tuner.js', 'js/screens/library.js', 'js/screens/addsong.js',
  'js/screens/viewer.js', 'js/screens/performance.js', 'js/screens/settings.js',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  if (e.request.url.includes('api.anthropic.com')) return;   // API는 캐시하지 않음
  e.respondWith(
    caches.match(e.request).then(hit => hit ||
      fetch(e.request).then(res => {
        const copy = res.clone();   // 폰트 CDN 등 런타임 캐시
        caches.open(CACHE).then(c => c.put(e.request, copy)).catch(() => {});
        return res;
      }))
  );
});
```

- [ ] **Step 4: 브라우저 검증**

로컬 서버 → DevTools Application 탭: manifest 인식, SW 활성화 확인. Network를 Offline으로 바꾸고 새로고침해도 앱이 뜨면 OK.

- [ ] **Step 5: Commit**

```bash
git add manifest.json sw.js icons
git commit -m "feat: PWA - 매니페스트, 오프라인 캐시, 앱 아이콘"
```

---

### Task 18: GitHub Pages 배포 + 실기기 검증

**Files:** 없음 (배포 작업)

- [ ] **Step 1: 사용자 확인 [CHECKPOINT]**

GitHub 계정 로그인 상태 확인: `gh auth status`
로그인이 안 되어 있으면 **사용자에게 `gh auth login` 실행을 요청**하고 대기.

- [ ] **Step 2: 저장소 생성 + 푸시**

```bash
gh repo create scoretuner --public --source . --push
```

- [ ] **Step 3: GitHub Pages 활성화**

```bash
gh api -X POST repos/{owner}/scoretuner/pages -f "source[branch]=master" -f "source[path]=/"
```
(이미 활성화 오류(409)면 무시. `{owner}`는 gh가 자동 치환.)
1~2분 후 확인: `gh api repos/{owner}/scoretuner/pages --jq .html_url`

- [ ] **Step 4: 배포 확인**

브라우저에서 `https://<owner>.github.io/scoretuner/` 접속 → 앱 로드 확인.

- [ ] **Step 5: 실기기(갤럭시 S23) 검증 체크리스트 — 사용자와 함께 [CHECKPOINT]**

사용자에게 폰에서 접속 URL 안내 후 다음을 확인 요청:
1. Chrome에서 접속 → 메뉴 → "홈 화면에 추가" → 앱 아이콘으로 실행
2. 튜너: 마이크 허용 → 기타 줄 튕겨 음이름·게이지 반응, 정확 시 초록+진동
3. 줄 버튼 터치 → 칼림바 기준음 재생
4. 곡 추가(붙여넣기) → 라이브러리 → 뷰어 → TAB 토글 → 키 조절
5. 연주 모드: 가로 전환, 화면 꺼짐 없음, 연주 시 자동 진행, 좌/우 터치 보정
6. 비행기 모드에서 앱 실행 (오프라인 동작)

- [ ] **Step 6: 발견된 문제 수정 후 최종 커밋·푸시**

```bash
git add -A
git commit -m "fix: 실기기 검증 피드백 반영"
git push
```

---

## 태스크 의존 관계

```
Task 1 (뼈대)
 ├─ Task 2 (theory) ─ Task 3 (arrange) ─ Task 5 (chords-db) ─ Task 6 (patterns)
 │                  ├─ Task 4 (parser)
 │                  ├─ Task 7 (pitch)
 │                  └─ Task 8 (chroma)
 ├─ Task 9 (store)
 └─ Task 10 (kalimba/mic)
Task 11 (튜너)     ← 2,7,10
Task 12 (설정/AI)  ← 1
Task 13 (곡 추가)  ← 3,4,6,9,12
Task 14 (라이브러리) ← 9,13
Task 15 (뷰어)     ← 5,6,13
Task 16 (연주 모드) ← 8,15
Task 17 (PWA)      ← 11~16
Task 18 (배포)     ← 17
```
