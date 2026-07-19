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
