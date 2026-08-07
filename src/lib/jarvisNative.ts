import { registerPlugin, Capacitor } from "@capacitor/core";

export type JarvisContact = { name?: string; number: string };

export type AutomateUIAction =
  | { action: "scroll"; direction: "up" | "down" | "left" | "right" }
  | { action: "click"; text?: string; id?: string }
  | { action: "back" }
  | { action: "home" };

export interface JarvisPlugin {
  findContact(options: { name: string }): Promise<JarvisContact>;
  makeCall(options: { number: string }): Promise<void>;
  openAppByName(options: { name: string }): Promise<void>;
  sendWhatsApp(options: { number: string; message: string }): Promise<void>;
  sendSMS(options: { number: string; message: string }): Promise<void>;
  checkAccessibilityService(): Promise<{ enabled: boolean }>;
  openAccessibilitySettings(): Promise<void>;
  automateUI(options: AutomateUIAction): Promise<void>;
}

export const Jarvis = registerPlugin<JarvisPlugin>("Jarvis");

/** True only on a native Android build where the custom plugin is available. */
export function hasNativeJarvis(): boolean {
  try {
    return Capacitor.isNativePlatform() && Capacitor.isPluginAvailable("Jarvis");
  } catch {
    return false;
  }
}

export async function isAccessibilityEnabled(): Promise<boolean> {
  if (!hasNativeJarvis()) return false;
  try {
    const res = await Jarvis.checkAccessibilityService();
    return !!res?.enabled;
  } catch {
    return false;
  }
}

export async function openAccessibilitySettings(): Promise<void> {
  if (!hasNativeJarvis()) return;
  try {
    await Jarvis.openAccessibilitySettings();
  } catch {
    /* noop */
  }
}

const errText = (e: unknown) => (e instanceof Error ? e.message : String(e ?? "unknown error"));

/**
 * Native (Android) command interception. Returns a spoken reply when the
 * utterance was handled natively, or null so the caller can fall back to the
 * browser-based command handler / the LLM.
 */
export async function handleNativeCommand(text: string): Promise<string | null> {
  if (!hasNativeJarvis()) return null;
  const t = text.trim();

  // ── WhatsApp: "whatsapp <target> saying <message>" ──
  const waM = t.match(
    /\b(?:whats\s?app|send\s+(?:a\s+)?whats\s?app(?:\s+message)?(?:\s+to)?)\s+(.+?)(?:\s+(?:saying|that|:)\s+(.+))?[.?!]*$/i,
  );
  if (waM && waM[1]) {
    const target = waM[1].replace(/[.?!]+$/, "").trim();
    const message = (waM[2] ?? "").trim();
    if (!message) return `What should I send to ${target}, sir?`;
    const resolved = await resolveNumber(target);
    if (!resolved.number) return resolved.error ?? `I couldn't find ${target} in your contacts, sir.`;
    try {
      await Jarvis.sendWhatsApp({ number: resolved.number, message });
      return `WhatsApp message sent to ${target}, sir.`;
    } catch (e) {
      return `I couldn't send that WhatsApp message, sir. ${errText(e)}`;
    }
  }

  // ── SMS: "text/message/sms <target> saying <message>" ──
  const smsM = t.match(/\b(?:text|sms|message)\s+(.+?)(?:\s+(?:saying|that|:)\s+(.+))?[.?!]*$/i);
  if (smsM && smsM[1]) {
    const target = smsM[1].replace(/[.?!]+$/, "").trim();
    const message = (smsM[2] ?? "").trim();
    if (!message) return `What should the message to ${target} say, sir?`;
    const resolved = await resolveNumber(target);
    if (!resolved.number) return resolved.error ?? `I couldn't find ${target} in your contacts, sir.`;
    try {
      await Jarvis.sendSMS({ number: resolved.number, message });
      return `Message sent to ${target}, sir.`;
    } catch (e) {
      return `I couldn't send that message, sir. ${errText(e)}`;
    }
  }

  // ── Call ──
  const callM = t.match(/\b(?:call|dial|phone|ring)\s+(.+?)[.?!]*$/i);
  if (callM && callM[1]) {
    const target = callM[1].trim();
    const resolved = await resolveNumber(target);
    if (!resolved.number) return resolved.error ?? `I couldn't find ${target} in your contacts, sir.`;
    try {
      await Jarvis.makeCall({ number: resolved.number });
      return `Calling ${target}, sir.`;
    } catch (e) {
      return `I couldn't place that call, sir. ${errText(e)}`;
    }
  }

  // ── Automation: scrolling / tapping ──
  const scrollM = t.match(/\bscroll\s+(up|down|left|right)\b/i);
  if (scrollM) {
    const direction = scrollM[1].toLowerCase() as "up" | "down" | "left" | "right";
    return runAutomation({ action: "scroll", direction }, `Scrolling ${direction}, sir.`);
  }
  if (/\b(?:go|navigate)?\s*back\b/i.test(t) && /\b(?:go back|press back)\b/i.test(t)) {
    return runAutomation({ action: "back" }, "Going back, sir.");
  }
  if (/\b(?:go|press)\s+home\b/i.test(t)) {
    return runAutomation({ action: "home" }, "Returning home, sir.");
  }
  const clickM = t.match(/\b(?:click|tap|press)\s+(?:on\s+)?(?:the\s+)?(.+?)(?:\s+button)?[.?!]*$/i);
  if (clickM && clickM[1]) {
    const label = clickM[1].trim();
    return runAutomation({ action: "click", text: label }, `Tapping ${label}, sir.`);
  }

  // ── Open app by name ──
  const openM = t.match(/\b(?:open|launch|start)\s+(?:the\s+)?(.+?)(?:\s+app)?[.?!]*$/i);
  if (openM && openM[1]) {
    const appName = openM[1].trim();
    try {
      await Jarvis.openAppByName({ name: appName });
      return `Opening ${appName}, sir.`;
    } catch (e) {
      // Not an installed app — let the browser/web handler try instead.
      console.warn("[jarvis] openAppByName failed", e);
      return null;
    }
  }

  return null;
}

async function resolveNumber(target: string): Promise<{ number?: string; error?: string }> {
  const digits = target.replace(/[^\d+]/g, "");
  if (digits.replace(/\D/g, "").length >= 4) return { number: digits };
  try {
    const contact = await Jarvis.findContact({ name: target });
    if (contact?.number) return { number: contact.number };
    return { error: `I couldn't find ${target} in your contacts, sir.` };
  } catch (e) {
    return { error: `I couldn't find ${target} in your contacts, sir. ${errText(e)}` };
  }
}

async function runAutomation(action: AutomateUIAction, ok: string): Promise<string> {
  if (!(await isAccessibilityEnabled())) {
    return "I need the accessibility service enabled to control the screen, sir. You can turn it on from Settings.";
  }
  try {
    await Jarvis.automateUI(action);
    return ok;
  } catch (e) {
    return `That automation failed, sir. ${errText(e)}`;
  }
}
