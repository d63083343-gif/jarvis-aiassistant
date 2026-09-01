/**
 * AURA brand mark — logo glyph + wordmark.
 * Shared by splash, login and the home header so branding stays 1:1.
 */
export function AuraLogo({ size = 64, className = "" }: { size?: number; className?: string }) {
  return (
    <img
      src="/aura-icon.png"
      alt="AURA"
      width={size}
      height={size}
      style={{ width: size, height: size }}
      className={`select-none object-contain drop-shadow-[0_0_28px_oklch(0.62_0.22_292/0.55)] ${className}`}
    />
  );
}

export function AuraWordmark({
  className = "",
  size = "text-2xl",
}: {
  className?: string;
  size?: string;
}) {
  return (
    <span
      className={`font-aura ${size} bg-gradient-to-b from-[oklch(1_0_0)] to-[oklch(0.72_0.02_285)] bg-clip-text text-transparent ${className}`}
      style={{ paddingRight: "0.42em" }}
    >
      Aura
    </span>
  );
}
