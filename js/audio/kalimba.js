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
