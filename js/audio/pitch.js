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
