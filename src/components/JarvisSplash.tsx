import { useEffect, useRef, useState } from "react";
import { playJarvisBootSound } from "@/lib/jarvisBootSfx";
import splashVideo from "@/assets/aura-splash.mp4.asset.json";
import { AuraLogo, AuraWordmark } from "@/components/AuraMark";

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
  const [lineIdx, setLineIdx] = useState(0);
  const [showContent, setShowContent] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Cinematic boot sound (best-effort — may be blocked by autoplay policy).
  useEffect(() => {
    playJarvisBootSound();
    const t = window.setTimeout(() => setShowContent(true), 280);
    return () => window.clearTimeout(t);
  }, []);

  // Progress bar + boot lines
  useEffect(() => {
    let p = 0;
    const interval = setInterval(() => {
      p += Math.random() * 0.6 + 0.4;
      if (p >= 100) {
        p = 100;
        clearInterval(interval);
        setTimeout(() => {
          setVisible(false);
          setTimeout(onDone, 400);
        }, 500);
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
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center overflow-hidden bg-black">
      {/* Aura splash film */}
      <video
        ref={videoRef}
        src={splashVideo.url}
        autoPlay
        muted
        playsInline
        loop
        className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-90"
      />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_35%,black_88%)]" />

      <div className="relative z-10 flex flex-col items-center px-6">
        <AuraLogo size={104} className="animate-jarvis-pulse" />
        <AuraWordmark size="text-3xl sm:text-4xl" className="mt-3" />
        <div
          className="mt-2 text-center font-hud text-[10px] tracking-[0.28em] text-[color:var(--jarvis-cyan)]"
          style={{ opacity: showContent ? 1 : 0, transition: "opacity 0.6s ease" }}
        >
          Just A Rather Very Intelligent System
        </div>

        {/* Boot log lines */}
        <div
          className="mt-8 h-24 w-full max-w-[260px] font-mono text-[10px] leading-relaxed text-[oklch(0.62_0.03_290)]"
          style={{ opacity: showContent ? 1 : 0, transition: "opacity 0.5s ease" }}
        >
          {BOOT_LINES.slice(0, lineIdx + 1).map((line, i) => (
            <div key={i} className="flex gap-2">
              <span className="text-[color:var(--jarvis-cyan)]">›</span>
              <span className={i === lineIdx ? "text-[color:var(--jarvis-cyan)]" : ""}>{line}</span>
            </div>
          ))}
          {lineIdx < BOOT_LINES.length - 1 && (
            <div className="flex items-center gap-2">
              <span className="text-[color:var(--jarvis-cyan)] animate-jarvis-blink">›</span>
              <span className="h-1.5 w-1.5 rounded-full bg-[color:var(--jarvis-cyan)] animate-jarvis-blink" />
            </div>
          )}
        </div>

        {/* Progress bar */}
        <div
          className="mt-3 w-full max-w-[260px]"
          style={{ opacity: showContent ? 1 : 0, transition: "opacity 0.5s ease" }}
        >
          <div className="mb-1 flex items-center justify-between font-hud text-[9px] tracking-wider text-[oklch(0.55_0.02_290)]">
            <span>System Boot</span>
            <span className="text-[color:var(--jarvis-cyan)]">{Math.round(progress)}%</span>
          </div>
          <div className="h-[2px] w-full overflow-hidden rounded-full bg-[oklch(0.16_0.02_290)]">
            <div
              className="h-full rounded-full bg-[color:var(--jarvis-cyan)] shadow-[0_0_10px_oklch(0.62_0.22_292/0.9)]"
              style={{ width: `${progress}%`, transition: "width 0.12s linear" }}
            />
          </div>
        </div>
      </div>

      <div className="pointer-events-none absolute bottom-8 left-0 right-0 flex justify-center">
        <div className="h-px w-32 bg-gradient-to-r from-transparent via-[oklch(0.62_0.22_292/0.5)] to-transparent" />
      </div>
    </div>
  );
}
