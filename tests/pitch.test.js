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

test('실사용 버퍼 크기 n=2048에서도 검출', () => {
  assert.ok(Math.abs(detectPitch(sine(110, 2048), SR) - 110) < 0.5);
});

test('줄에서 벗어난 주파수(84Hz)도 정확히 검출', () => {
  assert.ok(Math.abs(detectPitch(sine(84, 2048), SR) - 84) < 0.5);
});

test('무음이면 null', () => {
  assert.equal(detectPitch(new Float32Array(4096), SR), null);
});
