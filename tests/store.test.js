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
