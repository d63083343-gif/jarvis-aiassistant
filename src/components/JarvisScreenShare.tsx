import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { MonitorUp, X, ScanEye, Loader2 } from "lucide-react";

/**
 * Screen sharing — captures the user's screen/tab and lets JARVIS look at what
 * is on it, the way Gemini's "share screen" works.
 */
export function JarvisScreenShare({
  open,
  onClose,
  onFrame,
}: {
  open: boolean;
  onClose: () => void;
  /** Sends a captured frame (data URL) to JARVIS; resolves with the spoken reply. */
  onFrame: (dataUrl: string) => Promise<string>;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [sharing, setSharing] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [reply, setReply] = useState<string>("");

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setSharing(false);
  }, []);

  const start = useCallback(async () => {
    try {
      const md = navigator.mediaDevices as MediaDevices & {
        getDisplayMedia?: (c: DisplayMediaStreamOptions) => Promise<MediaStream>;
      };
      if (!md?.getDisplayMedia) {
        toast.error("Screen sharing isn't supported on this device.");
        return;
      }
      const stream = await md.getDisplayMedia({ video: true, audio: false });
      streamRef.current = stream;
      setSharing(true);
      stream.getVideoTracks()[0]?.addEventListener("ended", () => stop());
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
    } catch {
      toast.error("Screen share was cancelled.");
    }
  }, [stop]);

  useEffect(() => {
    if (!open) stop();
    return () => stop();
  }, [open, stop]);

  const analyze = async () => {
    const video = videoRef.current;
    if (!video || !sharing) return;
    setAnalyzing(true);
    try {
      const canvas = document.createElement("canvas");
      canvas.width = Math.min(1280, video.videoWidth || 1280);
      canvas.height = Math.round(
        canvas.width * ((video.videoHeight || 720) / (video.videoWidth || 1280)),
      );
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.8);
      const answer = await onFrame(dataUrl);
      setReply(answer || "I couldn't read that screen, sir.");
    } catch {
      toast.error("Couldn't analyse the screen.");
    } finally {
      setAnalyzing(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background/95 backdrop-blur-xl">
      <div className="flex items-center gap-3 border-b border-[color:var(--jarvis-cyan)]/25 px-5 py-4">
        <MonitorUp className="h-5 w-5 text-[color:var(--jarvis-cyan)]" />
        <div className="font-hud text-sm tracking-[0.2em] text-[color:var(--jarvis-cyan)] text-glow">
          ◢ SCREEN SHARE
        </div>
        <button
          type="button"
          onClick={() => {
            stop();
            onClose();
          }}
          aria-label="Close screen share"
          className="ml-auto flex h-9 w-9 items-center justify-center rounded-full border border-[color:var(--jarvis-cyan)]/40 text-[color:var(--jarvis-cyan)] transition hover:bg-[color:var(--jarvis-cyan)]/15"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 px-5 py-6">
        <div className="relative w-full max-w-3xl overflow-hidden rounded-2xl border border-[color:var(--jarvis-cyan)]/30 bg-black/60">
          <video
            ref={videoRef}
            muted
            playsInline
            className={`aspect-video w-full object-contain ${sharing ? "" : "opacity-30"}`}
          />
          {!sharing && (
            <div className="absolute inset-0 flex items-center justify-center text-center text-sm text-muted-foreground">
              Start sharing to let JARVIS see your screen.
            </div>
          )}
        </div>

        {reply && (
          <div className="w-full max-w-3xl rounded-2xl border border-[color:var(--jarvis-cyan)]/30 bg-card/70 px-4 py-3 text-sm text-foreground">
            {reply}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-center gap-3">
          {!sharing ? (
            <button
              type="button"
              onClick={() => void start()}
              className="flex items-center gap-2 rounded-full border border-[color:var(--jarvis-cyan)]/50 bg-[color:var(--jarvis-cyan)]/10 px-5 py-2.5 text-sm text-[color:var(--jarvis-cyan)] transition hover:bg-[color:var(--jarvis-cyan)]/20"
            >
              <MonitorUp className="h-4 w-4" /> Start sharing
            </button>
          ) : (
            <>
              <button
                type="button"
                disabled={analyzing}
                onClick={() => void analyze()}
                className="flex items-center gap-2 rounded-full border border-[color:var(--jarvis-cyan)]/50 bg-[color:var(--jarvis-cyan)]/10 px-5 py-2.5 text-sm text-[color:var(--jarvis-cyan)] transition hover:bg-[color:var(--jarvis-cyan)]/20 disabled:opacity-50"
              >
                {analyzing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ScanEye className="h-4 w-4" />
                )}
                Ask JARVIS about this screen
              </button>
              <button
                type="button"
                onClick={stop}
                className="rounded-full border border-[color:var(--jarvis-red)]/40 bg-[color:var(--jarvis-red)]/10 px-5 py-2.5 text-sm text-[color:var(--jarvis-red)] transition hover:bg-[color:var(--jarvis-red)]/20"
              >
                Stop sharing
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
