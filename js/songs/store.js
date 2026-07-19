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
    tx.oncomplete = () => resolve(result.result);
    tx.onerror = () => reject(tx.error);
  });
}

export async function saveSong(song) {
  song.updatedAt = Date.now();
  if (!song.id) {
    song.id = crypto.randomUUID();
    song.createdAt = song.updatedAt;
  } else if (!song.createdAt) {
    // 편집 저장: 기존 레코드의 createdAt 보존
    const prev = await getSong(song.id);
    song.createdAt = prev?.createdAt ?? song.updatedAt;
  }
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
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
export async function importBackup(file) {
  const songs = JSON.parse(await file.text());
  if (!Array.isArray(songs)) throw new Error('백업 파일 형식이 아닙니다');
  let saved = 0;
  for (const s of songs) {
    if (typeof s?.id === 'string' && typeof s.title === 'string' && s.title.trim() &&
        Array.isArray(s.sections)) {
      if (s.artist != null && typeof s.artist !== 'string') s.artist = String(s.artist);
      s.capo = Number(s.capo) || 0;
      s.keyShift = Math.max(-6, Math.min(6, Number(s.keyShift) || 0));
      s.semitones = Number(s.semitones) || 0;
      await saveSong(s);
      saved++;
    }
  }
  return saved;
}
