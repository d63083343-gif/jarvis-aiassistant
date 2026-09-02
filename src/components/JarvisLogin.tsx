import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AuraLogo, AuraWordmark } from "@/components/AuraMark";
import { ArrowRight, Eye, EyeOff, Lock, ShieldCheck, User } from "lucide-react";

type Mode = "signin" | "signup" | "forgot-email" | "otp" | "new-key" | "confirm";

export function JarvisLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [mode, setMode] = useState<Mode>("signin");
  const [info, setInfo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [booted, setBooted] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const emailRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    // A reload always drops out of an in-flight recovery.
    try {
      if (sessionStorage.getItem("jarvis.recovery") === "1") {
        sessionStorage.removeItem("jarvis.recovery");
        void supabase.auth.signOut();
      }
    } catch { /* noop */ }
    const t = window.setTimeout(() => setBooted(true), 60);
    return () => window.clearTimeout(t);
  }, []);

  const resetTransientState = () => {
    setError(null);
    setInfo(null);
  };

  const abortRecovery = () => {
    try { sessionStorage.removeItem("jarvis.recovery"); } catch { /* noop */ }
    void supabase.auth.signOut();
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
        // Keep the app on the login screen even once the recovery session exists.
        try { sessionStorage.setItem("jarvis.recovery", "1"); } catch { /* noop */ }
        setOtp("");
        setMode("otp");
        setInfo("A 8-DIGIT ACCESS CODE WAS TRANSMITTED TO YOUR REGISTERED E-MAIL.");
      } else if (mode === "otp") {
        const code = otp.replace(/\D/g, "");
        if (code.length !== 8) throw new Error("Enter the 8-digit access code.");
        const { error: err } = await supabase.auth.verifyOtp({
          email: email.trim(),
          token: code,
          type: "recovery",
        });
        if (err) throw err;
        setPassword("");
        setConfirmPassword("");
        setMode("new-key");
        setInfo("CODE VERIFIED. SET A NEW ACCESS KEY.");
      } else if (mode === "new-key") {
        if (password.length < 6) throw new Error("Access key must be at least 6 characters.");
        if (password !== confirmPassword) throw new Error("Access keys do not match.");
        const { data: sessionData } = await supabase.auth.getSession();
        if (!sessionData.session) {
          throw new Error("Recovery session expired. Request a new access code.");
        }
        // Update the password using the verified recovery session (no sign-out, no re-login).
        const { error: err } = await supabase.auth.updateUser({ password });
        if (err) throw err;
        try { sessionStorage.removeItem("jarvis.recovery"); } catch { /* noop */ }
        setInfo("ACCESS KEY UPDATED. WELCOME BACK.");
        // Nudge the auth listener so the app picks up the now-active session.
        await supabase.auth.refreshSession();

      } else if (mode === "confirm") {
        const code = otp.replace(/\D/g, "");
        if (code.length < 6) throw new Error("Enter the access code from your e-mail.");
        const { data, error: err } = await supabase.auth.verifyOtp({
          email: email.trim(),
          token: code,
          type: "signup",
        });
        if (err) throw err;
        if (!data.session) throw new Error("Verification failed. Request a new code.");
        setInfo("OPERATOR VERIFIED. WELCOME.");
      } else if (mode === "signup") {
        if (!email.trim() || !password.trim()) throw new Error("Credentials required.");
        const { data, error: err } = await supabase.auth.signUp({
          email: email.trim(),
          password,
        });
        if (err) throw err;
        if (data.session) {
          // Confirmation disabled → already signed in.
          setInfo("OPERATOR REGISTERED. WELCOME.");
        } else {
          setOtp("");
          setMode("confirm");
          setInfo("AN ACCESS CODE WAS TRANSMITTED TO YOUR E-MAIL. ENTER IT TO ACTIVATE.");
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
    ? "TRANSMITTING…"
    : mode === "signup"
      ? "CREATE OPERATOR"
      : mode === "forgot-email"
        ? "SEND ACCESS CODE"
        : mode === "otp"
          ? "VERIFY CODE"
          : mode === "confirm"
            ? "ACTIVATE OPERATOR"
            : mode === "new-key"
              ? "SET NEW ACCESS KEY"
              : "INITIATE HANDSHAKE";

  const heading =
    mode === "signup"
      ? "Create Operator"
      : mode === "forgot-email"
        ? "Key Recovery"
        : mode === "otp"
          ? "Verify Code"
          : mode === "new-key"
            ? "New Access Key"
            : mode === "confirm"
              ? "Activate Operator"
              : "Welcome Back";

  const subheading =
    mode === "signup"
      ? "Register a new secure identity"
      : mode === "forgot-email"
        ? "We'll transmit an 8-digit access code"
        : mode === "otp"
          ? "Enter the 8-digit access code"
          : mode === "new-key"
            ? "Set and confirm your new access key"
            : mode === "confirm"
              ? "Enter the code sent to your e-mail"
              : "Secure login to continue";

  const fieldWrap =
    "flex items-center gap-3 rounded-xl border border-[color:var(--jarvis-cyan)]/25 bg-[oklch(0.09_0.012_288)]/80 px-4 py-3 transition focus-within:border-[color:var(--jarvis-cyan)]/70 focus-within:shadow-[0_0_22px_oklch(0.62_0.22_292/0.28)]";
  const fieldInput =
    "w-full bg-transparent text-sm tracking-wide text-foreground outline-none placeholder:text-muted-foreground/60 disabled:opacity-50";

  return (
    <div className="relative flex min-h-screen w-full flex-col items-center justify-center overflow-hidden bg-background px-5 py-10 text-foreground">
      {/* Ambient violet horizon */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-[6%] h-[70vmin] w-[130vmin] -translate-x-1/2 rounded-full bg-[radial-gradient(ellipse_at_center,oklch(0.5_0.2_292/0.28),transparent_65%)] blur-2xl" />
        <div className="absolute left-1/2 top-[30%] h-[46vmin] w-[46vmin] -translate-x-1/2 rounded-full border border-[oklch(0.85_0.05_292/0.25)]" />
      </div>

      <div
        className={`relative z-10 w-full max-w-md transition-all duration-700 ${
          booted ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
        }`}
      >
        {/* Brand */}
        <div className="flex flex-col items-center">
          <AuraLogo size={132} />
          <AuraWordmark size="text-3xl" className="-mt-1" />
          <p className="mt-3 text-center font-hud text-[11px] leading-relaxed tracking-[0.28em] text-muted-foreground">
            Just a rather very{" "}
            <span className="text-[color:var(--jarvis-cyan)] text-glow">intelligent</span> system
          </p>
        </div>

        {/* Card */}
        <div className="relative mt-8 rounded-3xl border border-[color:var(--jarvis-cyan)]/25 bg-[oklch(0.06_0.01_288)]/85 p-6 backdrop-blur-xl shadow-[0_0_70px_oklch(0.45_0.2_292/0.25)]">
          <h1 className="text-2xl font-semibold tracking-tight">{heading}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{subheading}</p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            {mode !== "new-key" && (
              <div>
                <label className="font-hud mb-2 block text-[10px] tracking-[0.22em] text-[color:var(--jarvis-cyan)]">
                  Operator ID
                </label>
                <div className={fieldWrap}>
                  <User className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <input
                    ref={emailRef}
                    type="email"
                    autoComplete="username"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="operator@aura.systems"
                    className={fieldInput}
                    disabled={loading || mode === "otp" || mode === "confirm"}
                  />
                </div>
              </div>
            )}

            {(mode === "signin" || mode === "signup" || mode === "new-key") && (
              <div>
                <label className="font-hud mb-2 block text-[10px] tracking-[0.22em] text-[color:var(--jarvis-cyan)]">
                  {mode === "new-key" ? "New Access Key" : "Access Key"}
                </label>
                <div className={fieldWrap}>
                  <Lock className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <input
                    type={showKey ? "text" : "password"}
                    autoComplete={mode === "signin" ? "current-password" : "new-password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className={fieldInput}
                    disabled={loading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowKey((v) => !v)}
                    aria-label={showKey ? "Hide access key" : "Show access key"}
                    className="shrink-0 text-muted-foreground transition hover:text-[color:var(--jarvis-cyan)]"
                  >
                    {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {mode === "signin" && (
                  <div className="mt-2 text-right">
                    <button
                      type="button"
                      onClick={() => { resetTransientState(); setMode("forgot-email"); }}
                      className="text-xs text-[color:var(--jarvis-cyan)] transition hover:text-glow"
                    >
                      Forgot Access Key?
                    </button>
                  </div>
                )}
              </div>
            )}

            {mode === "new-key" && (
              <div>
                <label className="font-hud mb-2 block text-[10px] tracking-[0.22em] text-[color:var(--jarvis-cyan)]">
                  Confirm New Access Key
                </label>
                <div className={fieldWrap}>
                  <Lock className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <input
                    type={showKey ? "text" : "password"}
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className={fieldInput}
                    disabled={loading}
                  />
                </div>
              </div>
            )}

            {(mode === "otp" || mode === "confirm") && (
              <div>
                <label className="font-hud mb-2 block text-[10px] tracking-[0.22em] text-[color:var(--jarvis-cyan)]">
                  Access Code
                </label>
                <div className={fieldWrap}>
                  <input
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={8}
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 8))}
                    placeholder="00000000"
                    className={`${fieldInput} text-center text-lg tracking-[0.5em]`}
                    disabled={loading}
                  />
                </div>
              </div>
            )}

            {error && (
              <div className="rounded-xl border border-[color:var(--jarvis-red)]/50 bg-[color:var(--jarvis-red)]/10 px-3 py-2 text-center text-xs text-[color:var(--jarvis-red)]">
                {error}
              </div>
            )}
            {info && !error && (
              <div className="rounded-xl border border-[color:var(--jarvis-cyan)]/40 bg-[color:var(--jarvis-cyan)]/10 px-3 py-2 text-center text-xs text-[color:var(--jarvis-cyan)]">
                {info}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="font-hud group relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-xl bg-gradient-to-r from-[oklch(0.55_0.2_262)] to-[oklch(0.52_0.24_305)] py-3.5 text-[12px] tracking-[0.22em] text-white shadow-[0_0_28px_oklch(0.5_0.22_292/0.5)] transition hover:brightness-110 active:scale-[0.99] disabled:opacity-50"
            >
              <ArrowRight className="relative z-10 h-4 w-4" />
              <span className="relative z-10">{submitLabel}</span>
              {loading && (
                <span
                  className="absolute inset-y-0 left-0 w-1/2 animate-jarvis-search-bar"
                  style={{ background: "linear-gradient(90deg, transparent, oklch(1 0 0 / 0.25), transparent)" }}
                />
              )}
            </button>

            {mode === "confirm" ? (
              <button
                type="button"
                onClick={() => { resetTransientState(); setOtp(""); setMode("signin"); }}
                className="font-hud w-full rounded-xl border border-[color:var(--jarvis-cyan)]/40 py-3 text-[12px] tracking-[0.18em] text-foreground transition hover:bg-[color:var(--jarvis-cyan)]/10"
              >
                Return to <span className="text-[color:var(--jarvis-cyan)]">Sign In</span>
              </button>
            ) : mode === "forgot-email" || mode === "otp" || mode === "new-key" ? (
              <button
                type="button"
                onClick={() => { resetTransientState(); abortRecovery(); setOtp(""); setPassword(""); setConfirmPassword(""); setMode("signin"); }}
                className="font-hud w-full rounded-xl border border-[color:var(--jarvis-cyan)]/40 py-3 text-[12px] tracking-[0.18em] text-foreground transition hover:bg-[color:var(--jarvis-cyan)]/10"
              >
                Return to <span className="text-[color:var(--jarvis-cyan)]">Sign In</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => { resetTransientState(); setMode((m) => (m === "signin" ? "signup" : "signin")); }}
                className="font-hud w-full rounded-xl border border-[color:var(--jarvis-cyan)]/40 py-3 text-[12px] tracking-[0.18em] text-foreground transition hover:bg-[color:var(--jarvis-cyan)]/10"
              >
                {mode === "signin" ? (
                  <>New Operator? <span className="text-[color:var(--jarvis-cyan)]">Register</span></>
                ) : (
                  <>Have an ID? <span className="text-[color:var(--jarvis-cyan)]">Sign In</span></>
                )}
              </button>
            )}
          </form>

          {/* Security divider */}
          <div className="mt-7 flex items-center gap-3">
            <div className="h-px flex-1 bg-gradient-to-r from-transparent to-[oklch(0.62_0.22_292/0.35)]" />
            <Lock className="h-4 w-4 text-muted-foreground" />
            <div className="h-px flex-1 bg-gradient-to-l from-transparent to-[oklch(0.62_0.22_292/0.35)]" />
          </div>
          <p className="font-hud mt-4 text-center text-[9px] tracking-[0.28em] text-muted-foreground">
            Encrypted channel • AES-256
          </p>
        </div>

        <div className="mt-6 flex items-center justify-center gap-2 text-[11px] text-muted-foreground">
          <ShieldCheck className="h-4 w-4 text-[color:var(--jarvis-cyan)]" />
          <span>
            Secured by <span className="text-[color:var(--jarvis-cyan)]">AURA</span>
          </span>
        </div>
      </div>
    </div>
  );
}
