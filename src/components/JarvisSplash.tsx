import { useEffect, useRef, useState } from "react";
import splashVideo from "@/assets/aura-splash-2.mp4.asset.json";

interface JarvisSplashProps {
  onDone: () => void;
}

export function JarvisSplash({ onDone }: JarvisSplashProps) {
  const [visible, setVisible] = useState(true);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const doneRef = useRef(false);

  const finish = () => {
    if (doneRef.current) return;
    doneRef.current = true;
    setVisible(false);
    setTimeout(onDone, 500);
  };

  // Force playback as soon as possible (muted autoplay is allowed everywhere).
  useEffect(() => {
    const v = videoRef.current;
    if (v) {
      v.play().catch(() => {
        /* autoplay blocked — finish will still trigger via fallback */
      });
    }
    // Fallback: never trap the user on the splash (video is ~5s).
    const t = window.setTimeout(finish, 7000);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!visible) {
    return (
      <div
        className="pointer-events-none fixed inset-0 z-50 bg-black"
        style={{ animation: "splash-fade-out 0.5s ease-out forwards" }}
      />
    );
  }

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black">
      <video
        ref={videoRef}
        src={splashVideo.url}
        autoPlay
        muted
        playsInline
        preload="auto"
        onEnded={finish}
        onError={finish}
        className="pointer-events-none absolute inset-0 h-full w-full object-cover"
      />
    </div>
  );
}
