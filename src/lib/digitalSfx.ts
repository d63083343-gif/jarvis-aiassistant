// Digital "searching" sound effects — synthesized in-browser via WebAudio.
// Produces layered sci-fi ambience: a radar sweep, random data-blips, and
// a low modem-style carrier. Play while Jarvis is thinking / searching.

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let stopFns: Array<() => void> = [];
let running = false;

function getCtx(): AudioContext {
  if (!ctx || ctx.state === "closed") {
    const AC: typeof AudioContext =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    ctx = new AC();
  }
  return ctx;
}

function blip(freq: number, duration = 0.09, type: OscillatorType = "square", gain = 0.05) {
  if (!ctx || !master) return;
  const t = ctx.currentTime;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(gain, t + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
  osc.connect(g);
  g.connect(master);
  osc.start(t);
  osc.stop(t + duration + 0.02);
}

function startRadarSweep() {
  const c = getCtx();
  if (!master) return () => {};
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = "sawtooth";
  osc.frequency.value = 220;
  g.gain.value = 0;
  osc.connect(g);
  g.connect(master);
  osc.start();
  const t0 = c.currentTime;
  // Repeating sweep from 220 -> 1400Hz every 1.6s
  const period = 1.6;
  const total = 300; // ~schedule 5min ahead, cheap
  for (let i = 0; i < total; i++) {
    const s = t0 + i * period;
    osc.frequency.setValueAtTime(220, s);
    osc.frequency.exponentialRampToValueAtTime(1400, s + period * 0.9);
    g.gain.setValueAtTime(0, s);
    g.gain.linearRampToValueAtTime(0.02, s + 0.05);
    g.gain.linearRampToValueAtTime(0.02, s + period * 0.85);
    g.gain.exponentialRampToValueAtTime(0.0001, s + period * 0.95);
  }
  return () => {
    try {
      g.gain.cancelScheduledValues(c.currentTime);
      g.gain.setValueAtTime(g.gain.value, c.currentTime);
      g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 0.1);
      osc.stop(c.currentTime + 0.15);
    } catch {
      /* noop */
    }
  };
}

function startBlipRain() {
  const notes = [440, 523, 587, 659, 784, 880, 987, 1174, 1318];
  const id = window.setInterval(() => {
    const f = notes[Math.floor(Math.random() * notes.length)];
    blip(f, 0.06 + Math.random() * 0.09, Math.random() < 0.5 ? "square" : "triangle", 0.035);
    if (Math.random() < 0.35) {
      window.setTimeout(() => blip(f * 1.5, 0.05, "sine", 0.025), 40);
    }
  }, 180);
  return () => window.clearInterval(id);
}

function startLowHum() {
  const c = getCtx();
  if (!master) return () => {};
  const osc = c.createOscillator();
  const g = c.createGain();
  const lfo = c.createOscillator();
  const lfoGain = c.createGain();
  osc.type = "sine";
  osc.frequency.value = 55;
  g.gain.value = 0.04;
  lfo.frequency.value = 0.7;
  lfoGain.gain.value = 0.02;
  lfo.connect(lfoGain);
  lfoGain.connect(g.gain);
  osc.connect(g);
  g.connect(master);
  osc.start();
  lfo.start();
  return () => {
    try {
      g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 0.15);
      osc.stop(c.currentTime + 0.2);
      lfo.stop(c.currentTime + 0.2);
    } catch {
      /* noop */
    }
  };
}

export function startSearchingSfx() {
  if (running) return;
  running = true;
  const c = getCtx();
  if (c.state === "suspended") void c.resume();
  master = c.createGain();
  master.gain.value = 0;
  master.connect(c.destination);
  master.gain.linearRampToValueAtTime(0.9, c.currentTime + 0.12);
  // Boot-up chirp
  blip(880, 0.08, "square", 0.06);
  window.setTimeout(() => blip(1320, 0.09, "square", 0.05), 90);
  stopFns = [startLowHum(), startRadarSweep(), startBlipRain()];
}

export function stopSearchingSfx() {
  if (!running) return;
  running = false;
  stopFns.forEach((fn) => {
    try {
      fn();
    } catch {
      /* noop */
    }
  });
  stopFns = [];
  const c = ctx;
  const m = master;
  if (c && m) {
    try {
      m.gain.cancelScheduledValues(c.currentTime);
      m.gain.setValueAtTime(m.gain.value, c.currentTime);
      m.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 0.2);
    } catch {
      /* noop */
    }
    // Confirm chirp
    window.setTimeout(() => {
      try {
        const osc = c.createOscillator();
        const g = c.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(1600, c.currentTime);
        osc.frequency.exponentialRampToValueAtTime(700, c.currentTime + 0.18);
        g.gain.setValueAtTime(0.08, c.currentTime);
        g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 0.2);
        osc.connect(g);
        g.connect(c.destination);
        osc.start();
        osc.stop(c.currentTime + 0.22);
      } catch {
        /* noop */
      }
    }, 220);
  }
  master = null;
}