'use strict';
/* ===== MUD RACING — процедурный звук (WebAudio) ===== */
const SFX = (function () {
  let ac = null, master = null, eng = null, engGain = null, engFilter = null, noiseBuf = null;
  let on = true, started = false;
  function ensure() {
    if (started) return ac;
    try {
      ac = new (window.AudioContext || window.webkitAudioContext)();
      master = ac.createGain(); master.gain.value = 0.55; master.connect(ac.destination);
      noiseBuf = ac.createBuffer(1, ac.sampleRate * 1.2, ac.sampleRate);
      const d = noiseBuf.getChannelData(0);
      let last = 0;
      for (let i = 0; i < d.length; i++) { const w = Math.random() * 2 - 1; last = (last + 0.02 * w) / 1.02; d[i] = last * 3.4; }
      eng = ac.createOscillator(); eng.type = 'sawtooth'; eng.frequency.value = 60;
      engFilter = ac.createBiquadFilter(); engFilter.type = 'lowpass'; engFilter.frequency.value = 420;
      engGain = ac.createGain(); engGain.gain.value = 0;
      eng.connect(engFilter); engFilter.connect(engGain); engGain.connect(master); eng.start();
      started = true;
    } catch (e) { started = false; ac = null; }
    return ac;
  }
  function resume() { if (!on) return; const a = ensure(); if (a && a.state === 'suspended') a.resume(); }
  function engine(rpm, load, water) {
    if (!on || !started || !eng) return;
    const f = 46 + rpm * 150;
    eng.frequency.setTargetAtTime(f, ac.currentTime, 0.06);
    engFilter.frequency.setTargetAtTime(320 + rpm * 1400 - (water ? 220 : 0), ac.currentTime, 0.08);
    engGain.gain.setTargetAtTime(load ? 0.11 : 0.02, ac.currentTime, 0.12);
  }
  function engineOff() { if (started && engGain) engGain.gain.setTargetAtTime(0, ac.currentTime, 0.2); }
  function noise(dur, f0, f1, gain, type) {
    if (!on || !started) return;
    const src = ac.createBufferSource(); src.buffer = noiseBuf;
    const bp = ac.createBiquadFilter(); bp.type = type || 'bandpass';
    bp.frequency.setValueAtTime(f0, ac.currentTime);
    bp.frequency.exponentialRampToValueAtTime(Math.max(80, f1), ac.currentTime + dur);
    bp.Q.value = 1.1;
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, ac.currentTime);
    g.gain.exponentialRampToValueAtTime(gain, ac.currentTime + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + dur);
    src.connect(bp); bp.connect(g); g.connect(master);
    src.start(); src.stop(ac.currentTime + dur + 0.05);
  }
  function beep(freq, dur, gain, type) {
    if (!on || !started) return;
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type || 'square'; o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, ac.currentTime);
    g.gain.exponentialRampToValueAtTime(gain || 0.09, ac.currentTime + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + dur);
    o.connect(g); g.connect(master); o.start(); o.stop(ac.currentTime + dur + 0.02);
  }
  return {
    resume, engine, engineOff,
    splash(p) { noise(0.35 + p * 0.02, 1400, 260, Math.min(0.32, 0.1 + p * 0.015)); },
    flood() { noise(0.5, 700, 160, 0.34, 'lowpass'); },
    clean() { beep(880, 0.09, 0.07, 'triangle'); beep(1320, 0.12, 0.05, 'triangle'); },
    overheat() { noise(0.6, 500, 90, 0.3, 'lowpass'); beep(120, 0.25, 0.07, 'sawtooth'); },
    light(n) { beep(n === 3 ? 900 : 520, n === 3 ? 0.22 : 0.1, 0.1, 'square'); },
    finish() { beep(660, 0.1, 0.09); setTimeout(() => beep(990, 0.18, 0.09), 110); },
    ui() { beep(440, 0.06, 0.05, 'triangle'); },
    toggle() { on = !on; if (!on) engineOff(); return on; },
    get on() { return on; }
  };
})();
