import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { X, AudioLines, Share2, FileDown, Copy, ShieldCheck, Delete, Check, Eye, MessageSquare, SwitchCamera } from "lucide-react";
import { toast } from "sonner";
import jsPDF from "jspdf";

export const PIN_KEY = "jarvis.pin";
export const PIN_ENABLED_KEY = "jarvis.pinEnabled";

/* ============================================================
 * PIN LOCK
 * ============================================================ */

function Keypad({
  value,
  onChange,
  onSubmit,
  max = 6,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit?: (v: string) => void;
  max?: number;
}) {
  const press = (d: string) => {
    if (value.length >= max) return;
    const next = value + d;
    onChange(next);
    // Pass the completed value explicitly — reading parent state here would
    // observe the pre-update value and break PIN confirmation.
    if (next.length === max && onSubmit) setTimeout(() => onSubmit(next), 60);
  };
  const back = () => onChange(value.slice(0, -1));
  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];
  return (
    <div className="mx-auto grid w-full max-w-[280px] grid-cols-3 gap-3">
      {keys.map((k) => (
        <button
          key={k}
          type="button"
          onClick={() => press(k)}
          className="font-hud h-14 rounded-full border border-[color:var(--jarvis-cyan)]/40 bg-[color:var(--jarvis-cyan)]/5 text-xl text-[color:var(--jarvis-cyan)] text-glow transition active:scale-95 active:bg-[color:var(--jarvis-cyan)]/25"
        >
          {k}
        </button>
      ))}
      <button
        type="button"
        onClick={back}
        aria-label="Backspace"
        className="flex h-14 items-center justify-center rounded-full border border-[color:var(--jarvis-cyan)]/30 text-[color:var(--jarvis-cyan)] transition active:scale-95 active:bg-[color:var(--jarvis-cyan)]/10"
      >
        <Delete className="h-5 w-5" />
      </button>
      <button
        type="button"
        onClick={() => press("0")}
        className="font-hud h-14 rounded-full border border-[color:var(--jarvis-cyan)]/40 bg-[color:var(--jarvis-cyan)]/5 text-xl text-[color:var(--jarvis-cyan)] text-glow transition active:scale-95 active:bg-[color:var(--jarvis-cyan)]/25"
      >
        0
      </button>
      <button
        type="button"
        onClick={() => onSubmit?.(value)}
        disabled={value.length < max}
        aria-label="Enter"
        className="flex h-14 items-center justify-center rounded-full border border-[color:var(--jarvis-cyan)]/60 bg-[color:var(--jarvis-cyan)]/15 text-[color:var(--jarvis-cyan)] text-glow transition active:scale-95 disabled:opacity-30"
      >
        <Check className="h-5 w-5" />
      </button>
    </div>
  );
}


function PinDots({ length, filled, error }: { length: number; filled: number; error?: boolean }) {
  return (
    <div className="flex items-center justify-center gap-3">
      {Array.from({ length }).map((_, i) => (
        <div
          key={i}
          className={`h-3 w-3 rounded-full border transition ${
            error
              ? "border-[color:var(--jarvis-red)] bg-[color:var(--jarvis-red)]"
              : i < filled
                ? "border-[color:var(--jarvis-cyan)] bg-[color:var(--jarvis-cyan)] shadow-[0_0_10px_var(--jarvis-cyan)]"
                : "border-[color:var(--jarvis-cyan)]/40"
          }`}
        />
      ))}
    </div>
  );
}

export function PinLockGate({ onUnlock }: { onUnlock: () => void }) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState(false);
  const saved =
    typeof window !== "undefined" ? localStorage.getItem(PIN_KEY) ?? "" : "";

  const submit = useCallback((entered?: string) => {
    const candidate = entered ?? pin;
    if (candidate === saved) {
      onUnlock();
    } else {
      setError(true);
      setTimeout(() => {
        setPin("");
        setError(false);
      }, 500);
    }
  }, [pin, saved, onUnlock]);

  return (
    <div className="fixed inset-0 z-[80] flex flex-col items-center justify-center bg-[oklch(0.06_0.02_260)] px-6">
      <div className="pointer-events-none absolute inset-0 opacity-20"
        style={{
          backgroundImage:
            "linear-gradient(oklch(0.5 0.12 210 / 0.3) 1px, transparent 1px), linear-gradient(90deg, oklch(0.5 0.12 210 / 0.3) 1px, transparent 1px)",
          backgroundSize: "36px 36px",
        }} />
      <div className="mb-6 flex items-center gap-2">
        <ShieldCheck className="h-5 w-5 text-[color:var(--jarvis-cyan)]" />
        <span className="font-hud text-[11px] tracking-[0.3em] text-[color:var(--jarvis-cyan)] text-glow">
          SECURE ACCESS
        </span>
      </div>
      <h2 className="font-hud text-center text-2xl text-[color:var(--jarvis-cyan)] text-glow">
        Enter Privacy PIN
      </h2>
      <p className="mt-2 font-hud text-[10px] tracking-widest text-muted-foreground">
        6-DIGIT UNLOCK CODE
      </p>
      <div className="mt-8 mb-8">
        <PinDots length={6} filled={pin.length} error={error} />
      </div>
      <Keypad value={pin} onChange={setPin} onSubmit={submit} />
      {error && (
        <div className="mt-4 font-hud text-[10px] tracking-widest text-[color:var(--jarvis-red)]">
          ▮ ACCESS DENIED
        </div>
      )}
    </div>
  );
}

export function PinSetupDialog({
  open,
  onClose,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [step, setStep] = useState<1 | 2>(1);
  const [first, setFirst] = useState("");
  const [second, setSecond] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setStep(1);
      setFirst("");
      setSecond("");
      setError(null);
    }
  }, [open]);

  if (!open) return null;

  const submit = (entered?: string) => {
    const candidate = entered ?? (step === 1 ? first : second);
    if (step === 1) {
      if (candidate.length === 6) {
        setFirst(candidate);
        setStep(2);
      }
      return;
    }
    if (candidate !== first) {
      setError("PINs do not match");
      setTimeout(() => {
        setSecond("");
        setError(null);
      }, 700);
      return;
    }
    try {
      localStorage.setItem(PIN_KEY, first);
      localStorage.setItem(PIN_ENABLED_KEY, "1");
    } catch {
      /* noop */
    }
    onSaved();
    onClose();
  };

  const value = step === 1 ? first : second;
  const setValue = step === 1 ? setFirst : setSecond;

  return (
    <div className="fixed inset-0 z-[90] flex flex-col items-center justify-center bg-black/90 backdrop-blur-md px-6">
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full border border-[color:var(--jarvis-cyan)]/40 text-[color:var(--jarvis-cyan)] transition hover:bg-[color:var(--jarvis-cyan)]/10"
      >
        <X className="h-4 w-4" />
      </button>
      <div className="mb-6 flex items-center gap-2">
        <ShieldCheck className="h-5 w-5 text-[color:var(--jarvis-cyan)]" />
        <span className="font-hud text-[11px] tracking-[0.3em] text-[color:var(--jarvis-cyan)] text-glow">
          {step === 1 ? "SET PRIVACY PIN" : "CONFIRM PIN"}
        </span>
      </div>
      <h2 className="font-hud text-center text-xl text-[color:var(--jarvis-cyan)] text-glow">
        {step === 1 ? "Enter a 6-digit privacy password" : "Retype the password to confirm"}
      </h2>
      <div className="mt-8 mb-8">
        <PinDots length={6} filled={value.length} error={!!error} />
      </div>
      <Keypad value={value} onChange={setValue} onSubmit={submit} />
      {error && (
        <div className="mt-4 font-hud text-[10px] tracking-widest text-[color:var(--jarvis-red)]">
          ▮ {error.toUpperCase()}
        </div>
      )}
    </div>
  );
}

/* ============================================================
 * WAVEFORM RING (around orb)
 * ============================================================ */

export function WaveformRing({ level, active }: { level: number; active: boolean }) {
  const bars = 48;
  const arr = useMemo(() => Array.from({ length: bars }), []);
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
      <div className="relative h-full w-full">
        {arr.map((_, i) => {
          const angle = (i / bars) * 360;
          // Pseudo per-bar variance for organic pulse.
          const variance = 0.5 + 0.5 * Math.abs(Math.sin(i * 1.7 + Date.now() * 0.002));
          const amp = active ? 8 + level * 60 * variance : 4 + variance * 2;
          return (
            <span
              key={i}
              className="absolute left-1/2 top-1/2 origin-bottom rounded-full bg-[color:var(--jarvis-cyan)]"
              style={{
                width: 2,
                height: `${amp}px`,
                transform: `translate(-50%, -100%) rotate(${angle}deg) translateY(-46%)`,
                opacity: active ? 0.55 + level * 0.4 : 0.25,
                boxShadow: active
                  ? `0 0 6px var(--jarvis-cyan)`
                  : "none",
                transition: "height 90ms linear, opacity 120ms linear",
              }}
            />
          );
        })}
      </div>
    </div>
  );
}

/* ============================================================
 * LIVE VOICE MODE OVERLAY
 * ============================================================ */

export type LiveMsg = { role: "user" | "assistant"; content: string; ts: number };

export function LiveVoiceOverlay({
  open,
  onClose,
  state,
  level,
  onSendText,
  onStart,
  status,
  messages,
}: {
  open: boolean;
  onClose: () => void;
  state: "idle" | "listening" | "thinking" | "speaking";
  level: number;
  onSendText: (text: string) => void;
  onStart: () => void;
  status: string;
  messages: LiveMsg[];
}) {
  const [text, setText] = useState("");
  const [showTranscript, setShowTranscript] = useState(false);
  const started = useRef(false);

  useEffect(() => {
    if (!open) {
      started.current = false;
      setShowTranscript(false);
      return;
    }
    if (started.current) return;
    started.current = true;
    // Auto-engage the microphone as soon as live mode opens — no tap needed.
    const t = window.setTimeout(() => onStart(), 250);
    return () => window.clearTimeout(t);
  }, [open, onStart]);

  if (!open) return null;

  const scale = 1 + level * 0.4 + (state === "speaking" ? 0.08 : 0);
  const color =
    state === "thinking"
      ? "oklch(0.78 0.15 75)"
      : state === "speaking"
        ? "oklch(0.78 0.16 200)"
        : state === "listening"
          ? "oklch(0.75 0.14 210)"
          : "oklch(0.6 0.1 220)";

  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-black text-white">
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-6">
        <span className="font-hud text-[11px] tracking-[0.3em] text-white/70">
          ◢ LIVE VOICE MODE
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close live voice"
          className="flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-white/5 backdrop-blur transition hover:bg-white/10"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {showTranscript ? (
        <div className="flex flex-1 flex-col overflow-hidden px-4 pt-4">
          <button
            type="button"
            onClick={() => setShowTranscript(false)}
            className="mb-3 self-center rounded-full border border-white/15 bg-white/5 px-4 py-1.5 text-xs text-white/70 transition hover:bg-white/10"
          >
            ▴ Back to the sphere
          </button>
          <div className="flex-1 space-y-3 overflow-y-auto pb-4">
            {messages.length === 0 ? (
              <p className="pt-10 text-center text-sm text-white/40">
                No conversation yet — just start speaking.
              </p>
            ) : (
              messages.map((m) => (
                <div
                  key={`${m.ts}-${m.role}`}
                  className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${
                    m.role === "user"
                      ? "ml-auto bg-white/15 text-white"
                      : "mr-auto bg-white/5 text-white/85"
                  }`}
                >
                  {m.content}
                </div>
              ))
            )}
          </div>
        </div>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center px-6">
          <button
            type="button"
            onClick={() => setShowTranscript(true)}
            aria-label="Show conversation"
            className="relative flex h-72 w-72 items-center justify-center outline-none"
          >
            <div
              className="absolute inset-0 rounded-full blur-3xl transition-transform duration-150"
              style={{
                transform: `scale(${scale * 1.1})`,
                background: `radial-gradient(circle, ${color} 0%, transparent 70%)`,
                opacity: 0.55,
              }}
            />
            <div
              className="absolute inset-0 rounded-full blur-2xl transition-transform duration-150"
              style={{
                transform: `scale(${scale})`,
                background: `radial-gradient(circle, ${color} 0%, transparent 60%)`,
                opacity: 0.8,
              }}
            />
            <div
              className="relative rounded-full transition-transform duration-150"
              style={{
                width: "60%",
                height: "60%",
                background: `radial-gradient(circle at 35% 30%, white 0%, ${color} 45%, transparent 90%)`,
                transform: `scale(${scale})`,
                boxShadow: `0 0 80px ${color}`,
              }}
            />
          </button>
          <div className="mt-8 font-hud text-sm tracking-widest text-white/70">{status}</div>
          <div className="mt-3 flex items-center gap-1.5 text-[11px] text-white/40">
            <MessageSquare className="h-3.5 w-3.5" />
            Tap the sphere to see the conversation
          </div>
        </div>
      )}

      {/* Bottom text fallback */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const t = text.trim();
          if (!t) return;
          onSendText(t);
          setText("");
        }}
        className="px-4 pb-8 pt-4"
      >
        <div className="mx-auto flex w-full max-w-md items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-2 backdrop-blur">
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Type a message…"
            className="flex-1 bg-transparent text-sm text-white outline-none placeholder:text-white/40"
          />
          <button
            type="submit"
            disabled={!text.trim()}
            className="rounded-full bg-white/15 px-4 py-1.5 text-xs font-medium text-white transition hover:bg-white/25 disabled:opacity-40"
          >
            Send
          </button>
        </div>
      </form>
    </div>
  );
}

/* ============================================================
 * LIVE VISION (camera + AI narration)
 * ============================================================ */

export function LiveVisionOverlay({
  open,
  onClose,
  onFrame,
}: {
  open: boolean;
  onClose: () => void;
  /** Sends a captured JPEG data URL to the AI; resolves with the spoken reply. */
  onFrame: (dataUrl: string) => Promise<string>;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const runningRef = useRef(false);
  const [facing, setFacing] = useState<"environment" | "user">("environment");
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const stop = useCallback(() => {
    runningRef.current = false;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => {
    if (!open) {
      stop();
      setReply("");
      setError(null);
      return;
    }
    let cancelled = false;
    runningRef.current = true;

    const capture = () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || !video.videoWidth) return null;
      const w = 640;
      const h = Math.round((video.videoHeight / video.videoWidth) * 640);
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) return null;
      ctx.drawImage(video, 0, 0, w, h);
      return canvas.toDataURL("image/jpeg", 0.7);
    };

    const loop = async () => {
      while (runningRef.current && !cancelled) {
        const frame = capture();
        if (frame) {
          setBusy(true);
          try {
            const answer = await onFrame(frame);
            if (!runningRef.current || cancelled) break;
            if (answer) setReply(answer);
          } catch (e) {
            setError(e instanceof Error ? e.message : "Vision failed.");
          }
          setBusy(false);
        }
        await new Promise((r) => setTimeout(r, 1500));
      }
    };

    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: facing },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          await video.play().catch(() => {});
        }
        void loop();
      } catch {
        setError("Camera access denied. Enable it in your browser settings.");
      }
    })();

    return () => {
      cancelled = true;
      stop();
    };
  }, [open, facing, onFrame, stop]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[72] flex flex-col bg-black text-white">
      <video
        ref={videoRef}
        playsInline
        muted
        className="absolute inset-0 h-full w-full object-cover opacity-90"
      />
      <canvas ref={canvasRef} className="hidden" />

      <div className="relative z-10 flex items-center justify-between px-5 pt-6">
        <span className="font-hud flex items-center gap-2 rounded-full bg-black/50 px-3 py-1.5 text-[11px] tracking-[0.25em] text-[color:var(--jarvis-cyan)] backdrop-blur">
          <Eye className="h-3.5 w-3.5" />
          LIVE VISION {busy ? "• ANALYSING" : "• WATCHING"}
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setFacing((f) => (f === "environment" ? "user" : "environment"))}
            aria-label="Switch camera"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-black/40 backdrop-blur transition hover:bg-white/10"
          >
            <SwitchCamera className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close live vision"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-black/40 backdrop-blur transition hover:bg-white/10"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div className="relative z-10 mt-auto px-4 pb-10">
        {error ? (
          <div className="mx-auto max-w-md rounded-2xl border border-[color:var(--jarvis-red)]/50 bg-black/70 px-4 py-3 text-center text-sm text-[color:var(--jarvis-red)] backdrop-blur">
            {error}
          </div>
        ) : (
          <div className="mx-auto max-w-md rounded-2xl border border-white/15 bg-black/60 px-4 py-3 text-sm text-white/90 backdrop-blur">
            {reply || "Point the camera at something and I'll describe what I see, sir."}
          </div>
        )}
      </div>
    </div>
  );
}


/* ============================================================
 * EXPORT / SHARE DIALOG
 * ============================================================ */

export type ExportMsg = { role: "user" | "assistant"; content: string; ts: number };

function exportPdf(messages: ExportMsg[]) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 48;
  const maxWidth = pageWidth - margin * 2;
  let y = margin;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(20, 100, 160);
  doc.text("J.A.R.V.I.S. — Chat Transcript", margin, y);
  y += 20;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(120, 120, 120);
  doc.text(new Date().toLocaleString(), margin, y);
  y += 20;

  doc.setDrawColor(20, 100, 160);
  doc.line(margin, y, pageWidth - margin, y);
  y += 20;

  for (const m of messages) {
    const label = m.role === "user" ? "You" : "JARVIS";
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(m.role === "user" ? 40 : 20, m.role === "user" ? 120 : 100, m.role === "user" ? 80 : 160);
    doc.text(`${label} · ${new Date(m.ts).toLocaleTimeString()}`, margin, y);
    y += 14;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.setTextColor(30, 30, 30);
    const lines = doc.splitTextToSize(m.content || "", maxWidth);
    for (const line of lines) {
      if (y > pageHeight - margin) {
        doc.addPage();
        y = margin;
      }
      doc.text(line, margin, y);
      y += 14;
    }
    y += 8;
    if (y > pageHeight - margin) {
      doc.addPage();
      y = margin;
    }
  }

  const fname = `jarvis-transcript-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.pdf`;
  doc.save(fname);
}

function copyTranscript(messages: ExportMsg[]) {
  const text = messages
    .map(
      (m) =>
        `${m.role === "user" ? "You" : "JARVIS"} [${new Date(m.ts).toLocaleTimeString()}]: ${m.content}`,
    )
    .join("\n\n");
  return navigator.clipboard.writeText(text);
}

export function ExportDialog({
  open,
  onClose,
  messages,
}: {
  open: boolean;
  onClose: () => void;
  messages: ExportMsg[];
}) {
  if (!open) return null;
  const empty = messages.length === 0;
  return (
    <div
      className="fixed inset-0 z-[75] flex items-center justify-center bg-black/70 backdrop-blur-sm px-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl border border-[color:var(--jarvis-cyan)]/40 bg-card/95 p-6 backdrop-blur-xl shadow-[0_0_40px_oklch(0.5_0.12_210/0.35)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Share2 className="h-4 w-4 text-[color:var(--jarvis-cyan)]" />
            <span className="font-hud text-[11px] tracking-[0.25em] text-[color:var(--jarvis-cyan)] text-glow">
              ◢ SHARE TRANSCRIPT
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-7 w-7 items-center justify-center rounded-full border border-[color:var(--jarvis-cyan)]/40 text-[color:var(--jarvis-cyan)] transition hover:bg-[color:var(--jarvis-cyan)]/10"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        {empty ? (
          <div className="rounded-md border border-border/50 bg-background/40 p-4 text-center text-sm text-muted-foreground">
            No messages in this session yet.
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={() => {
                exportPdf(messages);
                toast.success("PDF downloaded");
                onClose();
              }}
              className="group flex items-center gap-3 rounded-lg border border-[color:var(--jarvis-cyan)]/40 bg-[color:var(--jarvis-cyan)]/5 p-3 text-left transition hover:bg-[color:var(--jarvis-cyan)]/15"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-md border border-[color:var(--jarvis-cyan)]/50 bg-[color:var(--jarvis-cyan)]/10 text-[color:var(--jarvis-cyan)]">
                <FileDown className="h-4 w-4" />
              </span>
              <span className="flex flex-col leading-tight">
                <span className="text-sm font-semibold text-foreground">Export as PDF</span>
                <span className="text-[11px] text-muted-foreground">Formatted transcript download</span>
              </span>
            </button>

            <button
              type="button"
              onClick={async () => {
                try {
                  await copyTranscript(messages);
                  toast.success("Transcript copied to clipboard");
                } catch {
                  toast.error("Clipboard blocked");
                }
                onClose();
              }}
              className="group flex items-center gap-3 rounded-lg border border-[color:var(--jarvis-gold)]/40 bg-[color:var(--jarvis-gold)]/5 p-3 text-left transition hover:bg-[color:var(--jarvis-gold)]/15"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-md border border-[color:var(--jarvis-gold)]/50 bg-[color:var(--jarvis-gold)]/10 text-[color:var(--jarvis-gold)]">
                <Copy className="h-4 w-4" />
              </span>
              <span className="flex flex-col leading-tight">
                <span className="text-sm font-semibold text-foreground">Copy Transcript</span>
                <span className="text-[11px] text-muted-foreground">Copy full chat to clipboard</span>
              </span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* Small ambient waveform overlay used elsewhere if needed */
export function useLiveLevelTicker(active: boolean, level: number) {
  // Utility hook for smoothing/animating in case caller wants extra motion.
  const [smooth, setSmooth] = useState(level);
  const rafRef = useRef<number | null>(null);
  useEffect(() => {
    let mounted = true;
    const step = () => {
      if (!mounted) return;
      setSmooth((s) => s + (level - s) * 0.25);
      rafRef.current = requestAnimationFrame(step);
    };
    if (active) rafRef.current = requestAnimationFrame(step);
    return () => {
      mounted = false;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [active, level]);
  return smooth;
}
