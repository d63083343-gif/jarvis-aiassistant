import { useEffect, useRef, useState } from "react";
import { playJarvisBootSound } from "@/lib/jarvisBootSfx";

interface JarvisSplashProps {
  onDone: () => void;
}

const BOOT_LINES = [
  "Initializing neural interface…",
  "Loading voice synthesis modules…",
  "Calibrating audio sensors…",
  "Establishing secure connection…",
  "System ready.",
];

export function JarvisSplash({ onDone }: JarvisSplashProps) {
  const [visible, setVisible] = useState(true);
  const [progress, setProgress] = useState(0);
  const [typed, setTyped] = useState("");
  const [lineIdx, setLineIdx] = useState(0);
  const [showContent, setShowContent] = useState(false);
  const ringRef = useRef<HTMLDivElement>(null);

  // Play cinematic JARVIS boot sound (best-effort — may be blocked by
  // browser autoplay policy on cold loads).
  useEffect(() => {
    playJarvisBootSound();
  }, []);

  // Typing "J.A.R.V.I.S."
  useEffect(() => {
    const full = "J.A.R.V.I.S.";
    let i = 0;
    const timer = setInterval(() => {
      i++;
      setTyped(full.slice(0, i));
      if (i >= full.length) {
        clearInterval(timer);
        setTimeout(() => setShowContent(true), 80);
      }
    }, 45);
    return () => clearInterval(timer);
  }, []);
// Progress bar + boot lines
useEffect(() => {
  let p = 0;
  const interval = setInterval(() => {
    p += Math.random() * 0.6 + 0.4; // was: Math.random() * 10 + 6
    if (p >= 100) {
      p = 100;
      clearInterval(interval);
      setTimeout(() => {
        setVisible(false);
        setTimeout(onDone, 400);
      }, 500); // was: 300
    }
    setProgress(p);
    setLineIdx(Math.min(BOOT_LINES.length - 1, Math.floor((p / 100) * BOOT_LINES.length)));
  }, 30);
  return () => clearInterval(interval);
}, [onDone]);

  if (!visible) {
    return (
      <div
        className="pointer-events-none fixed inset-0 z-50"
        style={{ animation: "splash-fade-out 0.9s ease-out forwards" }}
      />
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center overflow-hidden bg-[oklch(0.06_0.02_260)]">
      {/* Animated background rings */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="absolute h-[70vmin] w-[70vmin] rounded-full border border-[oklch(0.7_0.12_210/0.15)] animate-spin-slow" />
        <div className="absolute h-[55vmin] w-[55vmin] rounded-full border border-dashed border-[oklch(0.7_0.12_210/0.22)] animate-spin-reverse" />
        <div className="absolute h-[40vmin] w-[40vmin] rounded-full border border-[oklch(0.75_0.14_75/0.12)] animate-spin-slow" />
        <div className="absolute h-[85vmin] w-[85vmin] rounded-full border border-[oklch(0.6_0.1_210/0.08)] animate-spin-reverse" style={{ animationDuration: "35s" }} />
      </div>

      {/* Glowing core */}
      <div className="pointer-events-none absolute flex items-center justify-center">
        <div className="absolute h-48 w-48 rounded-full bg-[oklch(0.8_0.16_210/0.15)] blur-3xl animate-jarvis-pulse" />
        <div className="absolute h-28 w-28 rounded-full bg-[oklch(0.85_0.18_210/0.35)] blur-2xl animate-jarvis-pulse" />
        <div className="relative h-20 w-20 rounded-full bg-gradient-to-br from-[oklch(0.9_0.2_210)] to-[oklch(0.7_0.16_235)] shadow-[0_0_60px_oklch(0.82_0.16_210/0.6),0_0_120px_oklch(0.6_0.16_235/0.3)] animate-jarvis-pulse" />
        {/* Inner hex detail */}
        <div className="absolute h-10 w-10 rounded-full border-2 border-white/40 animate-spin-slow" style={{ animationDuration: "8s" }} />
      </div>

      <div className="relative z-10 flex flex-col items-center px-6 mt-24">
        {/* Stark badge */}
        <div
          className="mb-6 font-hud text-[10px] tracking-[0.3em] text-[color:var(--jarvis-cyan)]"
          style={{ opacity: showContent ? 1 : 0, transition: "opacity 0.5s ease" }}
        >
          STARK INDUSTRIES
        </div>

        {/* Main title with typewriter */}
        <h1 className="font-hud text-center text-3xl font-bold tracking-[0.18em] text-[color:var(--jarvis-cyan)] text-glow sm:text-5xl">
          {typed}
          <span
            className="inline-block w-[3px] bg-[color:var(--jarvis-cyan)] align-middle animate-jarvis-blink"
            style={{ height: "0.75em", marginLeft: 4 }}
          />
        </h1>

        {/* Subtitle */}
        <div
          className="mt-2 text-center font-hud text-xs tracking-[0.15em] text-[oklch(0.65_0.08_210)]"
          style={{ opacity: typed.length >= 12 ? 1 : 0, transition: "opacity 0.6s ease" }}
        >
          Just A Rather Very Intelligent System
        </div>

        {/* Boot log lines */}
        <div
          className="mt-8 h-24 w-full max-w-[260px] font-mono text-[10px] leading-relaxed text-[oklch(0.55_0.1_210)]"
          style={{ opacity: showContent ? 1 : 0, transition: "opacity 0.5s ease" }}
        >
          {BOOT_LINES.slice(0, lineIdx + 1).map((line, i) => (
            <div key={i} className="flex gap-2">
              <span className="text-[color:var(--jarvis-cyan)]">›</span>
              <span className={i === lineIdx ? "text-[color:var(--jarvis-cyan)]" : ""}>{line}</span>
            </div>
          ))}
          {lineIdx < BOOT_LINES.length - 1 && (
            <div className="flex gap-2 items-center">
              <span className="text-[color:var(--jarvis-cyan)] animate-jarvis-blink">›</span>
              <span className="w-1.5 h-1.5 rounded-full bg-[color:var(--jarvis-cyan)] animate-jarvis-blink" />
            </div>
          )}
        </div>

        {/* Progress bar */}
        <div
          className="mt-3 w-full max-w-[260px]"
          style={{ opacity: showContent ? 1 : 0, transition: "opacity 0.5s ease" }}
        >
          <div className="flex items-center justify-between font-hud text-[9px] tracking-wider text-[oklch(0.5_0.06_210)] mb-1">
            <span>SYSTEM BOOT</span>
            <span className="text-[color:var(--jarvis-cyan)]">{Math.round(progress)}%</span>
          </div>
          <div className="h-[2px] w-full overflow-hidden rounded-full bg-[oklch(0.18_0.03_250)]">
            <div
              className="h-full rounded-full bg-[color:var(--jarvis-cyan)] shadow-[0_0_8px_oklch(0.82_0.16_210/0.8)]"
              style={{ width: `${progress}%`, transition: "width 0.12s linear" }}
            />
          </div>
        </div>
      </div>

      {/* Bottom decorative line */}
      <div className="pointer-events-none absolute bottom-8 left-0 right-0 flex justify-center">
        <div className="h-px w-32 bg-gradient-to-r from-transparent via-[oklch(0.7_0.12_210/0.4)] to-transparent" />
      </div>
    </div>
  );
}
