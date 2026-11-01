/**
 * Synthesised cabin sounds (Web Audio, no audio files to ship or license):
 * the two-tone cabin chime and an optional low cabin-noise ambience.
 */

export type Chime = 'takeoff' | 'landing' | 'interrupted' | 'preview';

let ctx: AudioContext | null = null;
let ambience: { source: AudioBufferSourceNode; gain: GainNode } | null = null;

function context(): AudioContext {
  ctx ??= new AudioContext();
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

function tone(ac: AudioContext, freq: number, start: number, duration: number, volume: number): void {
  const osc = ac.createOscillator();
  const overtone = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = 'sine';
  overtone.type = 'sine';
  osc.frequency.value = freq;
  overtone.frequency.value = freq * 2.76; // Bell-like inharmonic partial.
  const overtoneGain = ac.createGain();
  overtoneGain.gain.value = 0.12;

  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime(volume, start + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);

  osc.connect(gain);
  overtone.connect(overtoneGain).connect(gain);
  gain.connect(ac.destination);
  osc.start(start);
  overtone.start(start);
  osc.stop(start + duration + 0.05);
  overtone.stop(start + duration + 0.05);
}

const CHIMES: Record<Chime, number[]> = {
  takeoff: [880, 698.46], // high–low, like the seatbelt chime
  landing: [698.46, 880, 1046.5],
  interrupted: [523.25, 440],
  preview: [880, 698.46]
};

export function playChime(kind: Chime, volume: number): void {
  try {
    const ac = context();
    const v = Math.max(0, Math.min(1, volume)) * 0.32;
    CHIMES[kind].forEach((f, i) => tone(ac, f, ac.currentTime + 0.05 + i * 0.42, 1.4, v));
  } catch (err) {
    console.warn('[sound] Chime failed:', err);
  }
}

function brownNoise(ac: AudioContext, seconds: number): AudioBuffer {
  const buffer = ac.createBuffer(1, ac.sampleRate * seconds, ac.sampleRate);
  const data = buffer.getChannelData(0);
  let last = 0;
  for (let i = 0; i < data.length; i++) {
    const white = Math.random() * 2 - 1;
    last = (last + 0.02 * white) / 1.02;
    data[i] = last * 3.5;
  }
  return buffer;
}

export function startAmbience(volume: number): void {
  try {
    const ac = context();
    const target = Math.max(0, Math.min(1, volume)) * 0.22;
    if (ambience) {
      ambience.gain.gain.setTargetAtTime(target, ac.currentTime, 0.4);
      return;
    }
    const source = ac.createBufferSource();
    source.buffer = brownNoise(ac, 6);
    source.loop = true;
    const filter = ac.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 420;
    const gain = ac.createGain();
    gain.gain.value = 0;
    gain.gain.setTargetAtTime(target, ac.currentTime, 1.2);
    source.connect(filter).connect(gain).connect(ac.destination);
    source.start();
    ambience = { source, gain };
  } catch (err) {
    console.warn('[sound] Ambience failed:', err);
  }
}

export function stopAmbience(): void {
  if (!ambience || !ctx) return;
  const { source, gain } = ambience;
  ambience = null;
  gain.gain.setTargetAtTime(0, ctx.currentTime, 0.3);
  source.stop(ctx.currentTime + 1.5);
}
