import { useCallback, useEffect, useRef, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { toast } from "sonner";
import { Upload, Trash2, Download, FileText, ImageIcon, Loader2, X } from "lucide-react";
import {
  listFiles,
  uploadFile,
  deleteFile,
  fileUrl,
  type CloudFile,
} from "@/lib/jarvisCloud";

type Tab = "all" | "image" | "file";

function prettySize(bytes: number | null): string {
  if (!bytes) return "";
  const units = ["B", "KB", "MB", "GB"];
  let n = bytes;
  let i = 0;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i++;
  }
  return `${n.toFixed(n >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
}

export function JarvisStorageSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [files, setFiles] = useState<CloudFile[]>([]);
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<Tab>("all");
  const inputRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await listFiles();
      setFiles(rows);
      const imgs = rows.filter((f) => f.kind === "image").slice(0, 40);
      const entries = await Promise.all(
        imgs.map(async (f) => [f.id, (await fileUrl(f.path)) ?? ""] as const),
      );
      setThumbs(Object.fromEntries(entries.filter(([, u]) => u)));
    } catch {
      toast.error("Couldn't load your storage.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) void refresh();
  }, [open, refresh]);

  const onPick = async (list: FileList | null) => {
    if (!list?.length) return;
    setBusy(true);
    try {
      let indexed = 0;
      for (const f of Array.from(list)) {
        if (f.size > 25 * 1024 * 1024) {
          toast.error(`${f.name} is larger than 25 MB.`);
          continue;
        }
        const row = await uploadFile(f);
        // Text-like documents are indexed into the knowledge base for RAG.
        if (row) {
          try {
            const res = await ingest({ data: { fileId: row.id } });
            if (res?.ok) indexed += 1;
          } catch {
            /* indexing is best-effort; storage still works */
          }
        }
      }
      toast.success(
        indexed
          ? `Uploaded. ${indexed} document${indexed > 1 ? "s" : ""} added to JARVIS knowledge.`
          : "Uploaded to your cloud storage.",
      );

      await refresh();
    } catch {
      toast.error("Upload failed.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const open_ = async (f: CloudFile) => {
    const url = await fileUrl(f.path);
    if (url) window.open(url, "_blank", "noopener");
    else toast.error("Couldn't open that file.");
  };

  const remove = async (f: CloudFile) => {
    setBusy(true);
    try {
      await deleteFile(f);
      setFiles((prev) => prev.filter((x) => x.id !== f.id));
    } catch {
      toast.error("Delete failed.");
    } finally {
      setBusy(false);
    }
  };

  const shown = files.filter((f) => (tab === "all" ? true : f.kind === tab));
  const used = files.reduce((s, f) => s + (f.size ?? 0), 0);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="flex h-[88vh] flex-col rounded-t-3xl border-t border-[color:var(--jarvis-cyan)]/30 bg-card/95 p-0 backdrop-blur-xl [&>button:first-of-type]:hidden"
      >
        <div className="relative mx-auto mt-3 h-1.5 w-12 shrink-0 rounded-full bg-[color:var(--jarvis-cyan)]/40" />

        <SheetHeader className="shrink-0 px-5 pb-3 pt-3 text-left">
          <div className="flex items-center justify-between gap-3">
            <div>
              <SheetTitle className="font-hud text-sm tracking-[0.2em] text-[color:var(--jarvis-cyan)] text-glow">
                ◢ STORAGE
              </SheetTitle>
              <SheetDescription className="text-xs text-muted-foreground">
                {files.length} item{files.length === 1 ? "" : "s"} · {prettySize(used) || "0 B"} used
              </SheetDescription>
            </div>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              aria-label="Close storage"
              className="flex h-8 w-8 items-center justify-center rounded-full border border-[color:var(--jarvis-cyan)]/40 text-[color:var(--jarvis-cyan)] transition hover:bg-[color:var(--jarvis-cyan)]/15"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </SheetHeader>

        <div className="flex shrink-0 items-center gap-2 px-5 pb-3">
          {(["all", "image", "file"] as Tab[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`font-hud rounded-full border px-3 py-1 text-[10px] tracking-widest transition ${
                tab === t
                  ? "border-[color:var(--jarvis-cyan)] bg-[color:var(--jarvis-cyan)]/15 text-[color:var(--jarvis-cyan)] text-glow"
                  : "border-border/60 text-muted-foreground hover:text-foreground"
              }`}
            >
              {t === "all" ? "ALL" : t === "image" ? "IMAGES" : "FILES"}
            </button>
          ))}
          <button
            type="button"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
            className="ml-auto flex items-center gap-2 rounded-full border border-[color:var(--jarvis-cyan)]/50 bg-[color:var(--jarvis-cyan)]/10 px-3.5 py-1.5 text-xs text-[color:var(--jarvis-cyan)] transition hover:bg-[color:var(--jarvis-cyan)]/20 disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
            Upload
          </button>
          <input
            ref={inputRef}
            type="file"
            multiple
            hidden
            onChange={(e) => void onPick(e.target.files)}
          />
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-8">
          {loading ? (
            <div className="flex h-32 items-center justify-center text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : shown.length === 0 ? (
            <div className="mt-10 text-center text-sm text-muted-foreground">
              Nothing stored yet. Upload files or generate an image — they'll appear here.
            </div>
          ) : (
            <div className="space-y-2">
              {shown.map((f) => (
                <div
                  key={f.id}
                  className="flex items-center gap-3 rounded-2xl border border-[color:var(--jarvis-cyan)]/20 bg-background/50 p-2.5"
                >
                  <button
                    type="button"
                    onClick={() => void open_(f)}
                    className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-[color:var(--jarvis-cyan)]/30 bg-[color:var(--jarvis-cyan)]/5 text-[color:var(--jarvis-cyan)]"
                  >
                    {f.kind === "image" && thumbs[f.id] ? (
                      <img src={thumbs[f.id]} alt={f.name} className="h-full w-full object-cover" />
                    ) : f.kind === "image" ? (
                      <ImageIcon className="h-5 w-5" />
                    ) : (
                      <FileText className="h-5 w-5" />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => void open_(f)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <div className="truncate text-sm text-foreground">{f.name}</div>
                    <div className="font-hud text-[9px] tracking-widest text-muted-foreground">
                      {new Date(f.created_at).toLocaleDateString()} · {prettySize(f.size)}
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => void open_(f)}
                    aria-label={`Open ${f.name}`}
                    className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition hover:text-[color:var(--jarvis-cyan)]"
                  >
                    <Download className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => void remove(f)}
                    aria-label={`Delete ${f.name}`}
                    className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition hover:text-[color:var(--jarvis-red)]"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
