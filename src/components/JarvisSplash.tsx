import { useEffect, useRef } from "react";
import splashVideo from "@/assets/aura-splash-3.mp4.asset.json";

interface JarvisSplashProps {
  onDone: () => void;
}

// Singleton splash state — survives React StrictMode remounts and prevents
// the 5-second intro from playing more than once per page load.
let splashFinished = false;
const finishListeners = new Set<() => void>();

let splashContainer: HTMLDivElement | null = null;
let splashVideoEl: HTMLVideoElement | null = null;
let splashStarted = false;

function notifyFinished() {
  if (splashFinished) return;
  splashFinished = true;
  finishListeners.forEach((fn) => fn());
  finishListeners.clear();

  if (splashContainer) {
    splashContainer.style.opacity = "0";
    window.setTimeout(() => {
      splashContainer?.remove();
      splashContainer = null;
    }, 500);
  }
}

function ensureSplashContainer() {
  if (typeof document === "undefined") return;
  if (!splashContainer) {
    splashContainer = document.createElement("div");
    splashContainer.className =
      "fixed inset-0 z-[60] overflow-hidden bg-black transition-opacity duration-500";
    splashContainer.style.opacity = "1";
  }
  if (!splashVideoEl) {
    splashVideoEl = document.createElement("video");
    splashVideoEl.src = splashVideo.url;
    splashVideoEl.muted = true;
    splashVideoEl.playsInline = true;
    splashVideoEl.preload = "auto";
    splashVideoEl.className = "pointer-events-none absolute inset-0 h-full w-full object-contain";
    splashVideoEl.addEventListener("ended", notifyFinished, { once: true });
    splashVideoEl.addEventListener("error", notifyFinished, { once: true });
  }
  if (!splashContainer.contains(splashVideoEl)) {
    splashContainer.appendChild(splashVideoEl);
  }
  if (!document.body.contains(splashContainer)) {
    document.body.appendChild(splashContainer);
  }

  if (!splashStarted) {
    splashStarted = true;
    const play = () => {
      splashVideoEl
        ?.play()
        .catch(() => {
          /* muted autoplay should succeed; if not, the fallback timer still advances */
        });
    };
    // Wait a tick so StrictMode's first-mount/unmount cycle doesn't cause a stutter.
    window.setTimeout(play, 50);
    // Hard cutoff: the asset is ~5s; if ended/error never fire, force onward.
    window.setTimeout(notifyFinished, 6000);
  }
}

export function JarvisSplash({ onDone }: JarvisSplashProps) {
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    if (splashFinished) {
      onDoneRef.current();
      return;
    }

    const listener = () => onDoneRef.current();
    finishListeners.add(listener);
    ensureSplashContainer();

    return () => {
      finishListeners.delete(listener);
    };
  }, []);

  // The video is rendered via a single shared DOM element; this component
  // only coordinates the "finished" signal with the parent route.
  return null;
}
