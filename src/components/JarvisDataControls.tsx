import { useState } from "react";
import { toast } from "sonner";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import {
  Download,
  Trash2,
  Brain,
  HardDrive,
  ShieldAlert,
  Loader2,
  X,
} from "lucide-react";
import {
  clearMemories,
  deleteAllChats,
  deleteAllFiles,
  exportAllData,
} from "@/lib/jarvisCloud";
import { deleteMyAccount } from "@/lib/account.functions";
import { supabase } from "@/integrations/supabase/client";

const IMPROVE_KEY = "jarvis.improveModel";

/**
 * Data Controls — ChatGPT-style privacy surface: model-improvement toggle,
 * export, clear memory/files, delete all chats and delete account.
 */
export function JarvisDataControls({
  open,
  onOpenChange,
  incognito,
  setIncognito,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  incognito: boolean;
  setIncognito: (v: boolean) => void;
}) {
  const [improve, setImprove] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    return localStorage.getItem(IMPROVE_KEY) !== "0";
  });
  const [busy, setBusy] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);

  const toggleImprove = (v: boolean) => {
    setImprove(v);
    try {
      localStorage.setItem(IMPROVE_KEY, v ? "1" : "0");
    } catch {
      /* noop */
    }
  };

  const run = async (key: string, fn: () => Promise<void>, done: string) => {
    setBusy(key);
    try {
      await fn();
      toast.success(done);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(null);
      setConfirming(null);
    }
  };

  const doExport = () =>
    run(
      "export",
      async () => {
        const data = await exportAllData();
        const blob = new Blob([JSON.stringify(data, null, 2)], {
          type: "application/json",
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `jarvis-data-${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
      },
      "Export downloaded.",
    );

  const rows: {
    key: string;
    label: string;
    hint: string;
    Icon: typeof Download;
    action: string;
    danger?: boolean;
    confirm?: boolean;
    run: () => void | Promise<void>;
  }[] = [
    {
      key: "export",
      label: "Export data",
      hint: "Download your chats, memories and file index",
      Icon: Download,
      action: "Export",
      run: doExport,
    },
    {
      key: "memory",
      label: "Manage memory",
      hint: "Clear everything JARVIS remembers about you",
      Icon: Brain,
      action: "Clear",
      confirm: true,
      run: () => run("memory", clearMemories, "Memory cleared."),
    },
    {
      key: "files",
      label: "Stored files",
      hint: "Delete all uploaded and generated files",
      Icon: HardDrive,
      action: "Delete",
      confirm: true,
      run: () => run("files", deleteAllFiles, "All files deleted."),
    },
    {
      key: "chats",
      label: "Delete all chats",
      hint: "Permanently removes every conversation",
      Icon: Trash2,
      action: "Delete all",
      danger: true,
      confirm: true,
      run: () =>
        run(
          "chats",
          async () => {
            await deleteAllChats();
            try {
              localStorage.removeItem("jarvis.history");
            } catch {
              /* noop */
            }
          },
          "All chats deleted.",
        ),
    },
    {
      key: "account",
      label: "Delete account",
      hint: "Erases your operator profile and all data",
      Icon: ShieldAlert,
      action: "Delete",
      danger: true,
      confirm: true,
      run: () =>
        run(
          "account",
          async () => {
            await deleteMyAccount();
            await supabase.auth.signOut();
          },
          "Account deleted.",
        ),
    },
  ];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="flex max-h-[88vh] flex-col rounded-t-3xl border-t border-[color:var(--jarvis-cyan)]/30 bg-card/95 p-0 backdrop-blur-xl [&>button:first-of-type]:hidden"
      >
        <div
          className="pointer-events-none absolute inset-0 rounded-t-3xl opacity-[0.12]"
          style={{
            backgroundImage:
              "linear-gradient(oklch(0.5 0.12 210 / 0.35) 1px, transparent 1px), linear-gradient(90deg, oklch(0.5 0.12 210 / 0.35) 1px, transparent 1px)",
            backgroundSize: "26px 26px",
          }}
        />
        <div className="relative mx-auto mt-3 h-1.5 w-12 shrink-0 rounded-full bg-[color:var(--jarvis-cyan)]/40" />

        <SheetHeader className="relative shrink-0 items-center gap-1 px-5 pb-2 pt-4 text-center">
          <SheetTitle className="font-hud text-base text-[color:var(--jarvis-cyan)] text-glow">
            Data Controls
          </SheetTitle>
          <SheetDescription className="text-xs text-muted-foreground">
            Manage what JARVIS keeps, exports and forgets.
          </SheetDescription>
        </SheetHeader>

        <div className="relative min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain px-3 pb-3">
          <div className="flex items-center gap-3 rounded-2xl border border-[color:var(--jarvis-cyan)]/20 bg-background/50 px-4 py-3.5">
            <div className="flex-1">
              <div className="text-sm text-foreground">Improve the model for everyone</div>
              <div className="text-[11px] text-muted-foreground">
                Allow your conversations to help improve responses
              </div>
            </div>
            <Switch
              checked={improve}
              onCheckedChange={toggleImprove}
              aria-label="Improve the model"
            />
          </div>

          <div className="flex items-center gap-3 rounded-2xl border border-[color:var(--jarvis-cyan)]/20 bg-background/50 px-4 py-3.5">
            <div className="flex-1">
              <div className="text-sm text-foreground">Temporary chat</div>
              <div className="text-[11px] text-muted-foreground">
                Nothing from this session is saved
              </div>
            </div>
            <Switch
              checked={incognito}
              onCheckedChange={setIncognito}
              aria-label="Temporary chat"
            />
          </div>

          {rows.map(({ key, label, hint, Icon, action, danger, confirm, run: go }) => (
            <div
              key={key}
              className={`flex items-center gap-3 rounded-2xl border px-4 py-3.5 ${
                danger
                  ? "border-[color:var(--jarvis-red)]/30 bg-[color:var(--jarvis-red)]/[0.06]"
                  : "border-[color:var(--jarvis-cyan)]/20 bg-background/50"
              }`}
            >
              <Icon
                className={`h-[18px] w-[18px] shrink-0 ${
                  danger ? "text-[color:var(--jarvis-red)]" : "text-[color:var(--jarvis-cyan)]"
                }`}
              />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm text-foreground">{label}</div>
                <div className="text-[11px] text-muted-foreground">
                  {confirming === key ? "Tap again to confirm — this can't be undone." : hint}
                </div>
              </div>
              <button
                type="button"
                disabled={busy !== null}
                onClick={() => {
                  if (confirm && confirming !== key) {
                    setConfirming(key);
                    return;
                  }
                  void go();
                }}
                className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 font-hud text-[10px] tracking-widest transition disabled:opacity-50 ${
                  danger || confirming === key
                    ? "border-[color:var(--jarvis-red)]/50 bg-[color:var(--jarvis-red)]/10 text-[color:var(--jarvis-red)] hover:bg-[color:var(--jarvis-red)]/20"
                    : "border-[color:var(--jarvis-cyan)]/50 bg-[color:var(--jarvis-cyan)]/10 text-[color:var(--jarvis-cyan)] hover:bg-[color:var(--jarvis-cyan)]/20"
                }`}
              >
                {busy === key && <Loader2 className="h-3 w-3 animate-spin" />}
                {confirming === key ? "CONFIRM" : action.toUpperCase()}
              </button>
            </div>
          ))}
        </div>

        <div className="relative shrink-0 border-t border-[color:var(--jarvis-cyan)]/20 px-5 py-3">
          <button
            type="button"
            onClick={() => {
              setConfirming(null);
              onOpenChange(false);
            }}
            aria-label="Close data controls"
            className="mx-auto flex h-11 w-11 items-center justify-center rounded-full border border-[color:var(--jarvis-cyan)]/40 bg-background/60 text-[color:var(--jarvis-cyan)] transition hover:bg-[color:var(--jarvis-cyan)]/15 active:scale-95"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
