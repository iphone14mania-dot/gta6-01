// Sound, all synthesized with WebAudio: no audio files. An engine hum that
// follows speed, two-tone sirens, the helicopter's chop, gunfire noise, and
// three procedural radio stations (a bass-and-lead sequencer each, on a
// different scale and tempo). Starts only after the first user gesture.

const STATIONS = [
  { name: 'SOL 98.5 — Sunset Drive', tempo: 112, scale: [0, 3, 5, 7, 10], base: 220, wave: 'triangle' },
  { name: 'NEON FM — Night Cruise', tempo: 96, scale: [0, 2, 4, 7, 9], base: 196, wave: 'sawtooth' },
  { name: 'PALM RADIO — Bay Breeze', tempo: 128, scale: [0, 4, 5, 7, 11], base: 247, wave: 'sine' },
];

export function createAudio() {
  return {
    ctx: null,
    master: null,
    engineOsc: null,
    engineGain: null,
    sirenOsc: null,
    sirenGain: null,
    heliGain: null,
    station: 0,
    radioOn: true,
    nextNote: 0,
    step: 0,
    started: false,
  };
}

function ensureContext(audio) {
  if (audio.ctx) return audio.ctx;
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return null;
  audio.ctx = new Ctx();
  audio.master = audio.ctx.createGain();
  audio.master.gain.value = 0.5;
  audio.master.connect(audio.ctx.destination);
  // Engine: a low oscillator whose pitch follows the car's speed.
  audio.engineOsc = audio.ctx.createOscillator();
  audio.engineOsc.type = 'sawtooth';
  audio.engineOsc.frequency.value = 55;
  audio.engineGain = audio.ctx.createGain();
  audio.engineGain.gain.value = 0;
  audio.engineOsc.connect(audio.engineGain);
  audio.engineGain.connect(audio.master);
  audio.engineOsc.start();
  // Siren: two alternating tones, quiet until the police are near.
  audio.sirenOsc = audio.ctx.createOscillator();
  audio.sirenOsc.type = 'sine';
  audio.sirenOsc.frequency.value = 750;
  audio.sirenGain = audio.ctx.createGain();
  audio.sirenGain.gain.value = 0;
  audio.sirenOsc.connect(audio.sirenGain);
  audio.sirenGain.connect(audio.master);
  audio.sirenOsc.start();
  return audio.ctx;
}

/** Start the audio graph. Call from a user gesture (click / key). */
export function startAudio(audio) {
  const ctx = ensureContext(audio);
  if (!ctx) return;
  if (ctx.state === 'suspended') ctx.resume();
  audio.started = true;
}

export function stationName(audio) {
  return STATIONS[audio.station].name;
}

export function cycleStation(audio) {
  audio.station = (audio.station + 1) % STATIONS.length;
  audio.step = 0;
}

/** One gunshot: a short burst of filtered noise. */
export function playGunshot(audio, big) {
  if (!audio.ctx || !audio.started) return;
  const ctx = audio.ctx;
  const dur = big ? 0.22 : 0.09;
  const buffer = ctx.createBuffer(1, ctx.sampleRate * dur, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = big ? 900 : 2400;
  const gain = ctx.createGain();
  gain.gain.value = big ? 0.5 : 0.28;
  src.connect(filter);
  filter.connect(gain);
  gain.connect(audio.master);
  src.start();
}

/** A cash-register chirp for payouts. */
export function playCash(audio) {
  if (!audio.ctx || !audio.started) return;
  const ctx = audio.ctx;
  [880, 1320].forEach((freq, i) => {
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = freq;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.25, ctx.currentTime + i * 0.09);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.09 + 0.25);
    osc.connect(gain);
    gain.connect(audio.master);
    osc.start(ctx.currentTime + i * 0.09);
    osc.stop(ctx.currentTime + i * 0.09 + 0.3);
  });
}

/** Per-frame audio: engine pitch, siren wail, radio sequencer. */
export function updateAudio(audio, state, dt) {
  if (!audio.ctx || !audio.started) return;
  const ctx = audio.ctx;
  const car = state.cars.find((c) => c.id === state.player.inCar);
  const speed = car ? Math.abs(car.speed) : 0;
  audio.engineGain.gain.setTargetAtTime(car ? 0.05 + speed / 9000 : 0, ctx.currentTime, 0.1);
  audio.engineOsc.frequency.setTargetAtTime(50 + speed / 6, ctx.currentTime, 0.1);
  const wanted = state.police.wanted;
  const sirenLevel = wanted > 0 ? 0.05 + wanted * 0.012 : 0;
  audio.sirenGain.gain.setTargetAtTime(sirenLevel, ctx.currentTime, 0.2);
  audio.sirenOsc.frequency.setTargetAtTime(state.time % 0.8 < 0.4 ? 750 : 950, ctx.currentTime, 0.05);

  if (!audio.radioOn) return;
  const st = STATIONS[audio.station];
  const beat = 60 / st.tempo / 2;
  audio.nextNote -= dt;
  if (audio.nextNote > 0) return;
  audio.nextNote = beat;
  audio.step += 1;
  const scale = st.scale;
  const degree = scale[audio.step % scale.length] + (audio.step % 8 === 6 ? 12 : 0);
  const freq = st.base * Math.pow(2, degree / 12);
  const osc = ctx.createOscillator();
  osc.type = st.wave;
  osc.frequency.value = audio.step % 4 === 0 ? freq / 2 : freq;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.08, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + beat * 0.9);
  osc.connect(gain);
  gain.connect(audio.master);
  osc.start();
  osc.stop(ctx.currentTime + beat);
}
