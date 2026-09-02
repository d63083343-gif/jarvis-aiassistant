import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { toast } from "sonner";
import {
  Copy,
  Download,
  FolderPlus,
  Plus,
  Trash2,
  ChevronLeft,
  BookmarkPlus,
} from "lucide-react";

export type WorkspaceView = "images" | "projects" | "library" | "plugins";

export type SavedImage = { id: string; url: string; prompt: string; ts: number };
export type Project = { id: string; name: string; ts: number; chats: SavedChat[] };
export type SavedChat = { id: string; title: string; text: string; ts: number };
export type Plugins = {
  voiceReplies: boolean;
  autoListen: boolean;
  stealth: boolean;
  imageGen: boolean;
};

export const IMAGES_KEY = "jarvis.images";
export const PROJECTS_KEY = "jarvis.projects";
export const LIBRARY_KEY = "jarvis.library";

function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function write<T>(key: string, value: T) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* noop */
  }
}

export function saveGeneratedImage(url: string, prompt: string) {
  const list = read<SavedImage[]>(IMAGES_KEY, []);
  write(
    IMAGES_KEY,
    [{ id: `${Date.now()}`, url, prompt, ts: Date.now() }, ...list].slice(0, 60),
  );
}

const TITLES: Record<WorkspaceView, { title: string; desc: string }> = {
  images: { title: "Images", desc: "Every image AURA has generated for you." },
  projects: { title: "Projects", desc: "Group related conversations into projects." },
  library: { title: "Library", desc: "Saved transcripts you can reopen any time." },
  plugins: { title: "Plugins", desc: "Toggle AURA capabilities on or off." },
};

export function JarvisWorkspace({
  view,
  onClose,
  currentTranscript,
  plugins,
  setPlugins,
}: {
  view: WorkspaceView | null;
  onClose: () => void;
  currentTranscript: { title: string; text: string };
  plugins: Plugins;
  setPlugins: (next: Plugins) => void;
}) {
  const [images, setImages] = useState<SavedImage[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [library, setLibrary] = useState<SavedChat[]>([]);
  const [openProject, setOpenProject] = useState<string | null>(null);
  const [newProject, setNewProject] = useState("");

  useEffect(() => {
    if (!view) return;
    setImages(read<SavedImage[]>(IMAGES_KEY, []));
    setProjects(read<Project[]>(PROJECTS_KEY, []));
    setLibrary(read<SavedChat[]>(LIBRARY_KEY, []));
    setOpenProject(null);
    setNewProject("");
  }, [view]);

  const saveProjects = useCallback((next: Project[]) => {
    setProjects(next);
    write(PROJECTS_KEY, next);
  }, []);
  const saveLibrary = useCallback((next: SavedChat[]) => {
    setLibrary(next);
    write(LIBRARY_KEY, next);
  }, []);

  const active = useMemo(
    () => projects.find((p) => p.id === openProject) ?? null,
    [projects, openProject],
  );

  const hasChat = currentTranscript.text.trim().length > 0;

  const download = (url: string, name: string) => {
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
  };

  const meta = view ? TITLES[view] : null;

  return (
    <Sheet open={!!view} onOpenChange={(v) => !v && onClose()}>
      <SheetContent
        side="bottom"
        className="flex h-[85vh] flex-col rounded-t-3xl border-t border-[color:var(--jarvis-cyan)]/30 bg-card/95 p-0 backdrop-blur-xl"
      >
        <SheetHeader className="shrink-0 px-5 pb-2 pt-5 text-left">
          {active ? (
            <button
              type="button"
              onClick={() => setOpenProject(null)}
              className="mb-1 flex items-center gap-1 font-hud text-[10px] tracking-widest text-muted-foreground transition hover:text-[color:var(--jarvis-cyan)]"
            >
              <ChevronLeft className="h-3.5 w-3.5" /> PROJECTS
            </button>
          ) : null}
          <SheetTitle className="font-hud text-base text-[color:var(--jarvis-cyan)] text-glow">
            {active ? active.name : meta?.title}
          </SheetTitle>
          <SheetDescription className="text-xs text-muted-foreground">
            {active ? `${active.chats.length} saved chat(s)` : meta?.desc}
          </SheetDescription>
        </SheetHeader>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-8">
          {/* IMAGES */}
          {view === "images" &&
            (images.length === 0 ? (
              <Empty text="No images yet. Ask AURA to generate one." />
            ) : (
              <div className="grid grid-cols-2 gap-3 pt-1">
                {images.map((img) => (
                  <div
                    key={img.id}
                    className="overflow-hidden rounded-2xl border border-[color:var(--jarvis-cyan)]/25 bg-background/50"
                  >
                    <img src={img.url} alt={img.prompt} className="aspect-square w-full object-cover" />
                    <div className="flex items-center gap-1 p-2">
                      <span className="flex-1 truncate text-[11px] text-muted-foreground">
                        {img.prompt}
                      </span>
                      <IconBtn
                        label="Download image"
                        onClick={() => download(img.url, `jarvis-${img.id}.png`)}
                      >
                        <Download className="h-3.5 w-3.5" />
                      </IconBtn>
                      <IconBtn
                        label="Delete image"
                        danger
                        onClick={() => {
                          const next = images.filter((i) => i.id !== img.id);
                          setImages(next);
                          write(IMAGES_KEY, next);
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </IconBtn>
                    </div>
                  </div>
                ))}
              </div>
            ))}

          {/* PROJECTS */}
          {view === "projects" && !active && (
            <div className="pt-1">
              <div className="mb-3 flex gap-2">
                <input
                  value={newProject}
                  onChange={(e) => setNewProject(e.target.value)}
                  placeholder="New project name"
                  className="flex-1 rounded-xl border border-[color:var(--jarvis-cyan)]/30 bg-background/60 px-3 py-2.5 text-sm outline-none focus:border-[color:var(--jarvis-cyan)]"
                />
                <button
                  type="button"
                  onClick={() => {
                    const name = newProject.trim();
                    if (!name) return;
                    saveProjects([
                      { id: `${Date.now()}`, name, ts: Date.now(), chats: [] },
                      ...projects,
                    ]);
                    setNewProject("");
                  }}
                  className="flex items-center gap-1.5 rounded-xl border border-[color:var(--jarvis-cyan)]/50 bg-[color:var(--jarvis-cyan)]/15 px-3 text-sm text-[color:var(--jarvis-cyan)]"
                >
                  <FolderPlus className="h-4 w-4" /> Add
                </button>
              </div>
              {projects.length === 0 ? (
                <Empty text="No projects yet. Create one above." />
              ) : (
                <ul className="space-y-2">
                  {projects.map((p) => (
                    <li key={p.id} className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setOpenProject(p.id)}
                        className="flex-1 rounded-2xl border border-[color:var(--jarvis-cyan)]/20 bg-background/50 px-4 py-3 text-left text-sm transition hover:border-[color:var(--jarvis-cyan)]/50"
                      >
                        <span className="text-foreground">{p.name}</span>
                        <span className="ml-2 text-[11px] text-muted-foreground">
                          {p.chats.length} chat(s)
                        </span>
                      </button>
                      {hasChat && (
                        <IconBtn
                          label={`Add current chat to ${p.name}`}
                          onClick={() => {
                            saveProjects(
                              projects.map((x) =>
                                x.id === p.id
                                  ? {
                                      ...x,
                                      chats: [
                                        {
                                          id: `${Date.now()}`,
                                          title: currentTranscript.title,
                                          text: currentTranscript.text,
                                          ts: Date.now(),
                                        },
                                        ...x.chats,
                                      ],
                                    }
                                  : x,
                              ),
                            );
                            toast.success(`Added to ${p.name}`);
                          }}
                        >
                          <Plus className="h-4 w-4" />
                        </IconBtn>
                      )}
                      <IconBtn
                        label="Delete project"
                        danger
                        onClick={() => saveProjects(projects.filter((x) => x.id !== p.id))}
                      >
                        <Trash2 className="h-4 w-4" />
                      </IconBtn>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {view === "projects" && active && (
            <ChatList
              chats={active.chats}
              onDelete={(id) =>
                saveProjects(
                  projects.map((x) =>
                    x.id === active.id
                      ? { ...x, chats: x.chats.filter((c) => c.id !== id) }
                      : x,
                  ),
                )
              }
            />
          )}

          {/* LIBRARY */}
          {view === "library" && (
            <div className="pt-1">
              <button
                type="button"
                disabled={!hasChat}
                onClick={() => {
                  saveLibrary([
                    {
                      id: `${Date.now()}`,
                      title: currentTranscript.title,
                      text: currentTranscript.text,
                      ts: Date.now(),
                    },
                    ...library,
                  ]);
                  toast.success("Saved to Library");
                }}
                className="mb-3 flex w-full items-center justify-center gap-2 rounded-xl border border-[color:var(--jarvis-cyan)]/50 bg-[color:var(--jarvis-cyan)]/15 px-4 py-2.5 text-sm text-[color:var(--jarvis-cyan)] disabled:opacity-40"
              >
                <BookmarkPlus className="h-4 w-4" /> Save current chat
              </button>
              <ChatList
                chats={library}
                onDelete={(id) => saveLibrary(library.filter((c) => c.id !== id))}
              />
            </div>
          )}

          {/* PLUGINS */}
          {view === "plugins" && (
            <ul className="space-y-2 pt-1">
              {(
                [
                  ["voiceReplies", "Voice Replies", "Speak answers out loud"],
                  ["autoListen", "Auto Listen", "Keep the mic open between turns"],
                  ["stealth", "Stealth Mode", "Do not save chat history"],
                  ["imageGen", "Image Generation", "Allow image creation prompts"],
                ] as Array<[keyof Plugins, string, string]>
              ).map(([key, label, desc]) => (
                <li key={key}>
                  <button
                    type="button"
                    onClick={() => setPlugins({ ...plugins, [key]: !plugins[key] })}
                    className="flex w-full items-center gap-3 rounded-2xl border border-[color:var(--jarvis-cyan)]/20 bg-background/50 px-4 py-3.5 text-left transition hover:border-[color:var(--jarvis-cyan)]/50"
                  >
                    <span className="flex-1">
                      <span className="block text-sm text-foreground">{label}</span>
                      <span className="block text-[11px] text-muted-foreground">{desc}</span>
                    </span>
                    <span
                      className={`flex h-6 w-11 shrink-0 items-center rounded-full border px-0.5 transition ${
                        plugins[key]
                          ? "border-[color:var(--jarvis-cyan)] bg-[color:var(--jarvis-cyan)]/30"
                          : "border-muted-foreground/40 bg-background"
                      }`}
                    >
                      <span
                        className={`h-[18px] w-[18px] rounded-full transition-transform ${
                          plugins[key]
                            ? "translate-x-5 bg-[color:var(--jarvis-cyan)]"
                            : "translate-x-0 bg-muted-foreground/60"
                        }`}
                      />
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function ChatList({
  chats,
  onDelete,
}: {
  chats: SavedChat[];
  onDelete: (id: string) => void;
}) {
  if (chats.length === 0) return <Empty text="Nothing saved yet." />;
  return (
    <ul className="space-y-2">
      {chats.map((c) => (
        <li
          key={c.id}
          className="rounded-2xl border border-[color:var(--jarvis-cyan)]/20 bg-background/50 p-3"
        >
          <div className="flex items-center gap-2">
            <span className="flex-1 truncate text-sm text-foreground">{c.title}</span>
            <IconBtn
              label="Copy transcript"
              onClick={() => {
                void navigator.clipboard.writeText(c.text);
                toast.success("Transcript copied");
              }}
            >
              <Copy className="h-4 w-4" />
            </IconBtn>
            <IconBtn label="Delete" danger onClick={() => onDelete(c.id)}>
              <Trash2 className="h-4 w-4" />
            </IconBtn>
          </div>
          <p className="mt-1 line-clamp-2 whitespace-pre-wrap text-[11px] text-muted-foreground">
            {c.text}
          </p>
        </li>
      ))}
    </ul>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="px-3 py-14 text-center text-xs text-muted-foreground">{text}</div>;
}

function IconBtn({
  children,
  onClick,
  label,
  danger,
}: {
  children: React.ReactNode;
  onClick: () => void;
  label: string;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border transition active:scale-95 ${
        danger
          ? "border-[color:var(--jarvis-red)]/40 text-[color:var(--jarvis-red)] hover:bg-[color:var(--jarvis-red)]/10"
          : "border-[color:var(--jarvis-cyan)]/40 text-[color:var(--jarvis-cyan)] hover:bg-[color:var(--jarvis-cyan)]/10"
      }`}
    >
      {children}
    </button>
  );
}
