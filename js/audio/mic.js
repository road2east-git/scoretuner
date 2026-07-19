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
