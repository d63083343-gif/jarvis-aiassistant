// Synthesized cinematic JARVIS boot sound. Rising power-up sweep layered
// with a shimmering high-tech chord and a final "online" chime. Called
// once when the splash mounts; safe to invoke even if autoplay is blocked
// (falls through silently).

export function playJarvisBootSound() {
  try {
    const AC: typeof AudioContext =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    if (ctx.state === "suspended") void ctx.resume().catch(() => {});

    const master = ctx.createGain();
    master.gain.value = 0.0001;
    master.connect(ctx.destination);
    master.gain.exponentialRampToValueAtTime(0.6, ctx.currentTime + 0.05);

    const t0 = ctx.currentTime;

    // 1. Deep power-up sweep (sub → mid)
    const sweep = ctx.createOscillator();
    const sweepGain = ctx.createGain();
    sweep.type = "sawtooth";
    sweep.frequency.setValueAtTime(60, t0);
    sweep.frequency.exponentialRampToValueAtTime(880, t0 + 1.6);
    sweepGain.gain.setValueAtTime(0.0001, t0);
    sweepGain.gain.exponentialRampToValueAtTime(0.22, t0 + 0.3);
    sweepGain.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.9);
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(600, t0);
    filter.frequency.exponentialRampToValueAtTime(4000, t0 + 1.6);
    sweep.connect(filter);
    filter.connect(sweepGain);
    sweepGain.connect(master);
    sweep.start(t0);
    sweep.stop(t0 + 2);

    // 2. High-tech shimmer chord (perfect 5th + octave)
    const chordFreqs = [523.25, 783.99, 1046.5];
    chordFreqs.forEach((f, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "sine";
      o.frequency.value = f;
      const start = t0 + 0.4 + i * 0.08;
      g.gain.setValueAtTime(0.0001, start);
      g.gain.exponentialRampToValueAtTime(0.09, start + 0.05);
      g.gain.exponentialRampToValueAtTime(0.0001, start + 1.4);
      o.connect(g);
      g.connect(master);
      o.start(start);
      o.stop(start + 1.5);
    });

    // 3. Digital data blips
    const blipTimes = [0.05, 0.18, 0.34, 0.55, 0.9, 1.25];
    blipTimes.forEach((dt) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "square";
      o.frequency.value = 1400 + Math.random() * 800;
      const s = t0 + dt;
      g.gain.setValueAtTime(0.0001, s);
      g.gain.exponentialRampToValueAtTime(0.05, s + 0.005);
      g.gain.exponentialRampToValueAtTime(0.0001, s + 0.07);
      o.connect(g);
      g.connect(master);
      o.start(s);
      o.stop(s + 0.09);
    });

    // 4. Final "online" confirmation chime
    const chime = ctx.createOscillator();
    const chimeGain = ctx.createGain();
    chime.type = "sine";
    chime.frequency.setValueAtTime(880, t0 + 1.75);
    chime.frequency.exponentialRampToValueAtTime(1760, t0 + 2.0);
    chimeGain.gain.setValueAtTime(0.0001, t0 + 1.75);
    chimeGain.gain.exponentialRampToValueAtTime(0.18, t0 + 1.8);
    chimeGain.gain.exponentialRampToValueAtTime(0.0001, t0 + 2.4);
    chime.connect(chimeGain);
    chimeGain.connect(master);
    chime.start(t0 + 1.75);
    chime.stop(t0 + 2.5);

    // Cleanup
    window.setTimeout(() => {
      try {
        master.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.1);
        void ctx.close();
      } catch {
        /* noop */
      }
    }, 2800);
  } catch {
    /* autoplay blocked or WebAudio unavailable — fail silently */
  }
}