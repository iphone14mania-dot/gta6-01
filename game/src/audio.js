// All sound is synthesized with WebAudio: no audio files, no network requests.
// Engine hum, sirens, gunshots, footsteps and three procedural radio stations.

const STATIONS = [
  { name: 'SUNSET FM 88.5', scale: [0, 3, 5, 7, 10], bpm: 112, wave: 'sawtooth', bass: 'sine' },
  { name: 'PALM WAVE 101.2', scale: [0, 2, 4, 7, 9], bpm: 96, wave: 'triangle', bass: 'sine' },
  { name: 'HARBOR TALK 94.0', scale: [0, 5, 7], bpm: 80, wave: 'square', bass: 'triangle' },
];

export function createAudio() {
  let ctx = null;
  let master = null;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let radioTimer = null;
  let radioStep = 0;
  let muted = false;
  let station = 0;

  function ensure() {
    if (ctx) return true;
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.5;
      master.connect(ctx.destination);
      return true;
    } catch {
      return false;
    }
  }

  function noteFreq(semi) {
    return 220 * Math.pow(2, semi / 12);
  }

  function blip(freq, dur, type, vol, when = 0) {
    if (!ctx) return;
    const t = ctx.currentTime + when;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(gain).connect(master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  function noiseBurst(dur, vol, cutoff = 3000) {
    if (!ctx) return;
    const len = Math.floor(ctx.sampleRate * dur);
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = cutoff;
    const gain = ctx.createGain();
    gain.gain.value = vol;
    src.connect(filter).connect(gain).connect(master);
    src.start();
  }

  function radioTick() {
    if (!ctx) return;
    const st = STATIONS[station];
    const beat = 60 / st.bpm / 2; // eighth notes
    const scale = st.scale;
    const bar = Math.floor(radioStep / 8) % 4;
    const roots = [0, -4, -2, 3]; // chord roots, semitones from A
    const root = roots[bar];
    if (radioStep % 2 === 0) blip(noteFreq(root - 12), beat * 1.8, st.bass, 0.16);
    const melody = (radioStep * 7 + bar * 3) % scale.length;
    if (radioStep % 4 === 1 || radioStep % 4 === 3) {
      blip(noteFreq(root + scale[melody] + 12), beat * 0.9, st.wave, 0.07);
    }
    if (radioStep % 4 === 2) blip(noteFreq(root + 24), beat * 0.5, 'sine', 0.05);
    radioStep += 1;
    radioTimer = setTimeout(radioTick, beat * 1000);
  }

  return {
    get stationName() {
      return STATIONS[station].name;
    },
    get isMuted() {
      return muted;
    },
    unlock() {
      if (ensure() && ctx.state === 'suspended') ctx.resume();
    },
    startEngine() {
      if (!ensure() || engineOsc) return;
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 60;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 400;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      engineOsc.connect(filter).connect(engineGain).connect(master);
      engineOsc.start();
    },
    setEngine(speedNorm, driving) {
      if (!engineOsc) return;
      engineOsc.frequency.value = 55 + speedNorm * 140;
      engineGain.gain.value = driving ? 0.05 + speedNorm * 0.06 : 0.015;
    },
    stopEngine() {
      if (engineOsc) {
        try { engineOsc.stop(); } catch { /* already stopped */ }
        engineOsc = null;
        engineGain = null;
      }
    },
    setSiren(on) {
      if (on && !sirenOsc && ensure()) {
        sirenOsc = ctx.createOscillator();
        sirenOsc.type = 'triangle';
        sirenGain = ctx.createGain();
        sirenGain.gain.value = 0.045;
        sirenOsc.connect(sirenGain).connect(master);
        sirenOsc.start();
        let hi = false;
        sirenOsc._timer = setInterval(() => {
          if (!sirenOsc) return;
          hi = !hi;
          sirenOsc.frequency.value = hi ? 880 : 660;
        }, 420);
      } else if (!on && sirenOsc) {
        clearInterval(sirenOsc._timer);
        try { sirenOsc.stop(); } catch { /* already stopped */ }
        sirenOsc = null;
        sirenGain = null;
      }
    },
    startRadio() {
      if (!ensure() || radioTimer) return;
      radioStep = 0;
      radioTick();
    },
    stopRadio() {
      if (radioTimer) {
        clearTimeout(radioTimer);
        radioTimer = null;
      }
    },
    nextStation() {
      station = (station + 1) % STATIONS.length;
      radioStep = 0;
      return STATIONS[station].name;
    },
    shoot(kind) {
      if (!ctx) return;
      if (kind === 'shotgun') noiseBurst(0.22, 0.5, 1800);
      else if (kind === 'rifle') noiseBurst(0.14, 0.35, 2600);
      else noiseBurst(0.1, 0.28, 3200);
    },
    crash() {
      noiseBurst(0.3, 0.5, 900);
    },
    explosion() {
      noiseBurst(0.7, 0.8, 500);
      blip(55, 0.6, 'sine', 0.5);
    },
    pickup() {
      blip(660, 0.12, 'sine', 0.2);
      blip(990, 0.18, 'sine', 0.2, 0.09);
    },
    missionComplete() {
      [523, 659, 784, 1046].forEach((f, i) => blip(f, 0.25, 'triangle', 0.18, i * 0.13));
    },
    missionFail() {
      [392, 330, 262].forEach((f, i) => blip(f, 0.3, 'triangle', 0.16, i * 0.16));
    },
    click() {
      blip(1200, 0.05, 'sine', 0.12);
    },
    toggleMute() {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : 0.5;
      return muted;
    },
  };
}
