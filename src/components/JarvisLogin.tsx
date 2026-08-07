import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

type Mode = "signin" | "signup" | "forgot-email" | "otp" | "new-key";

export function JarvisLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [mode, setMode] = useState<Mode>("signin");
  const [info, setInfo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [booted, setBooted] = useState(false);
  const emailRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const t = window.setTimeout(() => setBooted(true), 60);
    return () => window.clearTimeout(t);
  }, []);

  const resetTransientState = () => {
    setError(null);
    setInfo(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    resetTransientState();
    setLoading(true);
    try {
      if (mode === "forgot-email") {
        if (!email.trim()) throw new Error("Enter your operator ID.");
        const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim());
        if (err) throw err;
        setOtp("");
        setMode("otp");
        setInfo("A 6-DIGIT ACCESS CODE WAS TRANSMITTED TO YOUR REGISTERED E-MAIL.");
      } else if (mode === "otp") {
        const code = otp.replace(/\D/g, "");
        if (code.length !== 6) throw new Error("Enter the 6-digit access code.");
        const { error: err } = await supabase.auth.verifyOtp({
          email: email.trim(),
          token: code,
          type: "recovery",
        });
        if (err) throw err;
        setPassword("");
        setMode("new-key");
        setInfo("CODE VERIFIED. SET A NEW ACCESS KEY.");
      } else if (mode === "new-key") {
        if (password.trim().length < 6) throw new Error("Access key must be at least 6 characters.");
        const { error: err } = await supabase.auth.updateUser({ password });
        if (err) throw err;
        setInfo("ACCESS KEY UPDATED. WELCOME BACK, SIR.");
      } else if (mode === "signup") {
        if (!email.trim() || !password.trim()) throw new Error("Credentials required.");
        const { error: err } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (err) throw err;
        // Auto-confirm is enabled → try immediate sign-in for a smooth handshake.
        const { error: sErr } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (sErr) {
          setInfo("Operator registered. Sign in with your new credentials.");
        }
      } else {
        if (!email.trim() || !password.trim()) throw new Error("Credentials required.");
        const { error: err } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (err) throw err;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Authentication failed.";
      setError(msg);
    }
    setLoading(false);
  };

  const submitLabel = loading
    ? "◈ TRANSMITTING…"
    : mode === "signup"
      ? "▶ CREATE OPERATOR"
      : mode === "forgot-email"
        ? "▶ SEND MAGICAL LINK"
        : "▶ INITIATE HANDSHAKE";

  const title =
    mode === "forgot-email"
      ? "◢ KEY RECOVERY PROTOCOL ◣"
      : "◢ IDENTITY VERIFICATION REQUIRED ◣";


  return (
    <div className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-background px-4 py-10 text-foreground">
      {/* HUD grid */}
      <div
        className="pointer-events-none absolute inset-0 opacity-30"
        style={{
          backgroundImage:
            "linear-gradient(oklch(0.5 0.12 210 / 0.15) 1px, transparent 1px), linear-gradient(90deg, oklch(0.5 0.12 210 / 0.15) 1px, transparent 1px)",
          backgroundSize: "42px 42px",
          maskImage: "radial-gradient(ellipse at center, black 40%, transparent 80%)",
        }}
      />
      {/* Scanline */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className="absolute left-0 right-0 h-24 animate-jarvis-scan"
          style={{
            background:
              "linear-gradient(to bottom, transparent, oklch(0.82 0.16 210 / 0.12), transparent)",
          }}
        />
      </div>

      <div
        className={`relative z-10 w-full max-w-md transition-all duration-700 ${
          booted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
        }`}
      >
        {/* Corner brackets */}
        <div className="relative rounded-lg border border-[color:var(--jarvis-cyan)]/40 bg-card/60 p-8 backdrop-blur-xl shadow-[0_0_60px_oklch(0.5_0.12_210/0.25)]">
          {["top-0 left-0", "top-0 right-0 rotate-90", "bottom-0 right-0 rotate-180", "bottom-0 left-0 -rotate-90"].map((cls) => (
            <div
              key={cls}
              className={`absolute h-6 w-6 border-l-2 border-t-2 border-[color:var(--jarvis-cyan)] ${cls}`}
            />
          ))}

          <div className="flex flex-col items-center gap-2">
            <img
              src="/jarvis-icon.png"
              alt="JARVIS"
              className="mb-1 h-16 w-16 drop-shadow-[0_0_18px_var(--jarvis-cyan)]"
            />
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 animate-jarvis-pulse rounded-full bg-[color:var(--jarvis-cyan)] shadow-[0_0_10px_var(--jarvis-cyan)]" />
              <span className="font-hud text-[10px] tracking-[0.3em] text-[color:var(--jarvis-cyan)] text-glow">
                STARK INDUSTRIES • SECURE LOGIN
              </span>
            </div>
            <h1 className="font-hud mt-2 text-3xl font-bold tracking-widest text-glow">
              J.A.R.V.I.S
            </h1>
            <p className="font-hud text-[10px] text-muted-foreground">
              {title}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            {true && (
              <div>
                <label className="font-hud mb-1 block text-[10px] tracking-widest text-[color:var(--jarvis-cyan)]">
                  OPERATOR ID
                </label>
                <input
                  ref={emailRef}
                  type="email"
                  autoComplete="username"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="tony@stark.industries"
                  className="font-hud w-full rounded-md border border-[color:var(--jarvis-cyan)]/40 bg-background/60 px-3 py-2 text-sm text-foreground outline-none transition placeholder:text-muted-foreground/50 focus:border-[color:var(--jarvis-cyan)] focus:shadow-[0_0_12px_oklch(0.5_0.12_210/0.4)]"
                  disabled={loading}
                />
              </div>
            )}

            {(mode === "signin" || mode === "signup") && (
              <div>
                <div className="mb-1 flex items-center justify-between">
                  <label className="font-hud block text-[10px] tracking-widest text-[color:var(--jarvis-cyan)]">
                    ACCESS KEY
                  </label>
                  {mode === "signin" && (
                    <button
                      type="button"
                      onClick={() => { resetTransientState(); setMode("forgot-email"); }}
                      className="font-hud text-[9px] tracking-widest text-muted-foreground transition hover:text-[color:var(--jarvis-gold)]"
                    >
                      FORGOT KEY? ▸
                    </button>
                  )}
                </div>
                <input
                  type="password"
                  autoComplete={mode === "signup" ? "new-password" : "current-password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="font-hud w-full rounded-md border border-[color:var(--jarvis-cyan)]/40 bg-background/60 px-3 py-2 text-sm text-foreground outline-none transition placeholder:text-muted-foreground/50 focus:border-[color:var(--jarvis-cyan)] focus:shadow-[0_0_12px_oklch(0.5_0.12_210/0.4)]"
                  disabled={loading}
                />
              </div>
            )}

            {mode === "forgot-email" && (
              <p className="text-center text-[11px] text-muted-foreground">
                Enter your registered e-mail and we'll transmit a secure magical
                sign-in link.
              </p>
            )}


            {error && (
              <div className="rounded border border-[color:var(--jarvis-red)]/50 bg-[color:var(--jarvis-red)]/10 px-3 py-2 text-center text-xs text-[color:var(--jarvis-red)]">
                {error}
              </div>
            )}
            {info && !error && (
              <div className="rounded border border-[color:var(--jarvis-cyan)]/40 bg-[color:var(--jarvis-cyan)]/10 px-3 py-2 text-center text-xs text-[color:var(--jarvis-cyan)]">
                {info}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="font-hud group relative w-full overflow-hidden rounded-md border border-[color:var(--jarvis-cyan)]/60 bg-[color:var(--jarvis-cyan)]/10 py-2.5 text-xs tracking-[0.3em] text-[color:var(--jarvis-cyan)] text-glow transition hover:bg-[color:var(--jarvis-cyan)]/20 disabled:cursor-wait disabled:opacity-70"
            >
              <span className="relative z-10">{submitLabel}</span>
              {loading && (
                <span
                  className="absolute inset-y-0 left-0 w-1/2 animate-jarvis-search-bar"
                  style={{
                    background:
                      "linear-gradient(90deg, transparent, oklch(0.82 0.16 210 / 0.35), transparent)",
                  }}
                />
              )}
            </button>
            {mode === "forgot-email" ? (
              <button
                type="button"
                onClick={() => { resetTransientState(); setMode("signin"); }}
                className="font-hud w-full text-center text-[10px] tracking-widest text-muted-foreground transition hover:text-[color:var(--jarvis-cyan)]"
              >
                ◂ RETURN TO HANDSHAKE
              </button>
            ) : (
              <button
                type="button"
                onClick={() => { resetTransientState(); setMode((m) => (m === "signin" ? "signup" : "signin")); }}
                className="font-hud w-full text-center text-[10px] tracking-widest text-muted-foreground transition hover:text-[color:var(--jarvis-cyan)]"
              >
                {mode === "signin" ? "◂ NEW OPERATOR? REGISTER ▸" : "◂ HAVE AN ID? SIGN IN ▸"}
              </button>
            )}
          </form>


          <p className="font-hud mt-6 text-center text-[9px] tracking-widest text-muted-foreground">
            ◂ ENCRYPTED CHANNEL • AES-256 ▸
          </p>
        </div>

        <p className="mt-4 text-center text-[10px] text-muted-foreground">
          Created by <span className="font-hud text-[color:var(--jarvis-gold)] text-glow-gold">CHINNU</span>
        </p>
      </div>
    </div>
  );
}
