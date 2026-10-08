// Synthesised music and sound effects (WebAudio, no audio files).
(function () {
  const S = {
    ctx: null, master: null, music: null, sfx: null, laughBus: null,
    muted: false, playing: false, layers: 0, step: 0, nextTime: 0, timer: null, noiseBuf: null,
  };

  try { S.muted = localStorage.getItem('htn-muted') === '1'; } catch (e) { /* storage unavailable */ }

  const BPM = 150, STEP = 60 / BPM / 4;
  const N = (n) => 440 * Math.pow(2, (n - 69) / 12);
  // Aggressive A-minor bass loop (MIDI notes, 0 = rest).
  const BASS = [33, 33, 0, 33, 0, 33, 36, 0, 33, 0, 33, 33, 0, 31, 0, 28];
  // Brighter phrases unlocked as people escape.
  const LEAD = [69, 0, 72, 0, 76, 0, 72, 0, 74, 0, 72, 0, 69, 0, 67, 0];
  const ARP = [81, 76, 72, 76, 81, 76, 72, 76, 79, 74, 71, 74, 79, 74, 71, 74];
  const STAB = [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0];

  S.init = function () {
    if (S.ctx) { if (S.ctx.state === 'suspended') S.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    S.ctx = new AC();
    S.master = S.ctx.createGain();
    S.master.gain.value = S.muted ? 0 : 0.8;
    const comp = S.ctx.createDynamicsCompressor();
    S.master.connect(comp); comp.connect(S.ctx.destination);
    S.music = S.ctx.createGain(); S.music.gain.value = 0.45; S.music.connect(S.master);
    S.sfx = S.ctx.createGain(); S.sfx.gain.value = 0.9; S.sfx.connect(S.master);
    const len = S.ctx.sampleRate;
    S.noiseBuf = S.ctx.createBuffer(1, len, S.ctx.sampleRate);
    const d = S.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  };

  S.setMuted = function (m) {
    S.muted = m;
    try { localStorage.setItem('htn-muted', m ? '1' : '0'); } catch (e) { /* ignore */ }
    if (S.master) S.master.gain.setTargetAtTime(m ? 0 : 0.8, S.ctx.currentTime, 0.02);
  };

  function tone(freq, t, dur, type, vol, to, dest) {
    const c = S.ctx, o = c.createOscillator(), g = c.createGain();
    o.type = type || 'square';
    o.frequency.setValueAtTime(freq, t);
    if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(dest || S.sfx);
    o.start(t); o.stop(t + dur + 0.02);
    return o;
  }

  function noise(t, dur, vol, ftype, f0, f1, dest) {
    const c = S.ctx, src = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    src.buffer = S.noiseBuf;
    f.type = ftype || 'highpass';
    f.frequency.setValueAtTime(f0 || 1000, t);
    if (f1) f.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(dest || S.sfx);
    src.start(t, Math.random() * 0.5); src.stop(t + dur + 0.02);
  }

  function schedule() {
    const c = S.ctx;
    while (S.nextTime < c.currentTime + 0.12) {
      const i = S.step % 16, t = S.nextTime, m = S.music;
      if (i % 4 === 0) tone(150, t, 0.16, 'sine', 0.9, 40, m);
      if (i === 4 || i === 12) noise(t, 0.12, 0.35, 'bandpass', 1800, 900, m);
      if (i % 2 === 1) noise(t, 0.04, 0.12, 'highpass', 7000, 0, m);
      if (BASS[i]) tone(N(BASS[i]), t, STEP * 0.9, 'square', 0.22, 0, m);
      if (S.layers >= 1 && LEAD[i]) tone(N(LEAD[i]), t, STEP * 1.6, 'triangle', 0.22, 0, m);
      if (S.layers >= 2 && STAB[i]) [57, 60, 64].forEach((n) => tone(N(n + 12), t, 0.12, 'sawtooth', 0.06, 0, m));
      if (S.layers >= 3) tone(N(ARP[i]), t, STEP * 0.7, 'square', 0.05, 0, m);
      S.nextTime += STEP; S.step++;
    }
  }

  S.startMusic = function () {
    if (!S.ctx || S.playing) return;
    S.playing = true; S.step = 0; S.nextTime = S.ctx.currentTime + 0.05;
    S.timer = setInterval(schedule, 25);
  };
  S.stopMusic = function () { S.playing = false; clearInterval(S.timer); };
  S.setLayers = function (n) { S.layers = n; };

  const ok = () => S.ctx && !S.muted;

  S.punch = () => { if (!ok()) return; const t = S.ctx.currentTime; tone(160, t, 0.18, 'sine', 1, 40); noise(t, 0.1, 0.7, 'lowpass', 2500, 300); };
  S.slap = () => { if (!ok()) return; const t = S.ctx.currentTime; noise(t, 0.07, 0.9, 'highpass', 2500, 6000); tone(900, t, 0.05, 'square', 0.15, 300); };
  S.whiff = () => { if (!ok()) return; noise(S.ctx.currentTime, 0.08, 0.15, 'bandpass', 800, 2000); };
  S.blow = () => { if (!ok()) return; const t = S.ctx.currentTime; noise(t, 0.9, 0.7, 'bandpass', 300, 4000); noise(t + 0.2, 0.8, 0.3, 'lowpass', 1500, 200); };
  S.puff = (k = 0) => { if (!ok()) return; const t = S.ctx.currentTime; tone(700 + k * 80, t, 0.12, 'sine', 0.35, 180); noise(t, 0.12, 0.25, 'lowpass', 3000, 400); };
  S.out = (k = 0) => { if (!ok()) return; const t = S.ctx.currentTime, f = 660 * Math.pow(2, (k % 8) / 12); tone(f, t, 0.07, 'square', 0.18); tone(f * 1.5, t + 0.07, 0.12, 'square', 0.18); };
  S.bust = () => { if (!ok()) return; const t = S.ctx.currentTime; tone(110, t, 0.4, 'sawtooth', 0.35, 70); tone(116, t, 0.4, 'sawtooth', 0.3, 72); };
  S.snort = () => { if (!ok()) return; const t = S.ctx.currentTime; noise(t, 0.45, 0.6, 'bandpass', 600, 5000); noise(t + 0.5, 0.15, 0.3, 'highpass', 3000, 6000); };
  S.chomp = () => { if (!ok()) return; const t = S.ctx.currentTime; tone(90, t, 0.1, 'square', 0.3, 50); tone(80, t + 0.12, 0.1, 'square', 0.3, 45); };
  S.tick = () => { if (!ok()) return; tone(1500, S.ctx.currentTime, 0.03, 'square', 0.06); };
  S.go = () => { if (!ok()) return; const t = S.ctx.currentTime; tone(440, t, 0.08, 'square', 0.15); tone(880, t + 0.08, 0.14, 'square', 0.15); };
  S.bullseye = () => { if (!ok()) return; const t = S.ctx.currentTime; [523, 659, 784, 1047].forEach((f, i) => tone(f, t + i * 0.06, 0.14, 'square', 0.16)); };
  S.win = () => { if (!ok()) return; const t = S.ctx.currentTime; [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => tone(f, t + i * 0.13, 0.25, 'square', 0.18)); };
  S.lose = () => { if (!ok()) return; const t = S.ctx.currentTime; [392, 330, 262, 196].forEach((f, i) => tone(f, t + i * 0.22, 0.35, 'sawtooth', 0.18)); };

  // Laughter: generals (ha-ha) and devil (low growl). Cut off abruptly on success.
  S.laugh = function (devil) {
    if (!ok()) return;
    S.stopLaugh();
    const c = S.ctx, bus = c.createGain(), t = c.currentTime;
    bus.gain.value = 1; bus.connect(S.sfx); S.laughBus = bus;
    S.music.gain.setTargetAtTime(0.2, t, 0.05);
    for (let i = 0; i < 7; i++) {
      const tt = t + 0.05 + i * 0.13, f = 420 - i * 22 + Math.random() * 30;
      const o = tone(f, tt, 0.1, 'square', 0.12, f * 0.8, bus);
      o.detune.value = Math.random() * 40;
      noise(tt, 0.05, 0.08, 'bandpass', 1500, 0, bus);
    }
    if (devil) for (let i = 0; i < 5; i++) {
      const tt = t + 0.3 + i * 0.22;
      tone(95 - i * 4, tt, 0.2, 'sawtooth', 0.35, 60, bus);
      tone(97 - i * 4, tt, 0.2, 'sawtooth', 0.25, 62, bus);
    }
    S.music.gain.setTargetAtTime(0.45, t + 1.5, 0.3);
  };

  S.stopLaugh = function () {
    if (!S.laughBus) return;
    const b = S.laughBus;
    b.gain.setValueAtTime(0, S.ctx.currentTime);
    setTimeout(() => b.disconnect(), 100);
    S.laughBus = null;
    S.music.gain.setTargetAtTime(0.45, S.ctx.currentTime, 0.05);
  };

  S.suspend = () => { if (S.ctx && S.ctx.state === 'running') S.ctx.suspend(); };
  S.resume = () => { if (S.ctx && S.ctx.state === 'suspended') S.ctx.resume(); };

  window.Sound = S;
})();
