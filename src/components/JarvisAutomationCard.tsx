import { useCallback, useEffect, useState } from "react";
import { Accessibility, RefreshCw } from "lucide-react";
import {
  hasNativeJarvis,
  isAccessibilityEnabled,
  openAccessibilitySettings,
} from "@/lib/jarvisNative";

export function AutomationCard() {
  const [native] = useState(() => hasNativeJarvis());
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [checking, setChecking] = useState(false);

  const refresh = useCallback(async () => {
    if (!hasNativeJarvis()) {
      setEnabled(false);
      return;
    }
    setChecking(true);
    setEnabled(await isAccessibilityEnabled());
    setChecking(false);
  }, []);

  useEffect(() => {
    void refresh();
    if (typeof document === "undefined") return;
    const onVis = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [refresh]);

  const on = enabled === true;

  return (
    <div className="rounded-md border border-[color:var(--jarvis-cyan)]/30 bg-[color:var(--jarvis-cyan)]/[0.03] p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="font-hud text-[10px] tracking-widest text-[color:var(--jarvis-cyan)] text-glow">
          ◢ DEVICE AUTOMATION
        </div>
        <button
          type="button"
          onClick={() => void refresh()}
          className="font-hud flex items-center gap-1 text-[10px] text-muted-foreground transition hover:text-foreground"
        >
          <RefreshCw className={`h-3 w-3 ${checking ? "animate-spin" : ""}`} /> CHECK
        </button>
      </div>

      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Accessibility
            className={`h-4 w-4 ${on ? "text-[color:var(--jarvis-cyan)]" : "text-muted-foreground"}`}
          />
          <div className="flex flex-col leading-tight">
            <span className="text-sm text-foreground">Accessibility service</span>
            <span className="font-hud text-[9px] tracking-widest text-muted-foreground">
              {!native
                ? "NATIVE ANDROID APP ONLY"
                : enabled === null
                  ? "CHECKING…"
                  : on
                    ? "ONLINE — SCREEN CONTROL READY"
                    : "OFFLINE — TAPS & SCROLLS DISABLED"}
            </span>
          </div>
        </div>
        <span
          className={`font-hud rounded border px-2 py-1 text-[9px] tracking-widest ${
            on
              ? "border-[color:var(--jarvis-cyan)] bg-[color:var(--jarvis-cyan)]/20 text-[color:var(--jarvis-cyan)] text-glow"
              : "border-border/60 text-muted-foreground"
          }`}
        >
          {on ? "ON" : "OFF"}
        </span>
      </div>

      {native && !on && (
        <button
          type="button"
          onClick={() => void openAccessibilitySettings()}
          className="font-hud mt-3 w-full rounded border border-[color:var(--jarvis-gold)]/50 bg-[color:var(--jarvis-gold)]/10 px-3 py-2 text-[10px] tracking-widest text-[color:var(--jarvis-gold)] text-glow-gold transition hover:bg-[color:var(--jarvis-gold)]/20"
        >
          OPEN ACCESSIBILITY SETTINGS ▸
        </button>
      )}

      {!native && (
        <p className="mt-3 text-xs text-muted-foreground">
          Calls, app launching, WhatsApp and screen automation run through the native JARVIS
          plugin. Install the Android build to enable them.
        </p>
      )}
    </div>
  );
}
