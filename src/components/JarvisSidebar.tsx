import { useMemo, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Search,
  Plus,
  Trash2,
  MessageSquare,
  ImageIcon,
  FolderKanban,
  Library,
  Puzzle,
} from "lucide-react";
import type { WorkspaceView } from "@/components/JarvisWorkspace";

export type SidebarHistoryItem = {
  id: string;
  query: string;
  reply?: string;
  title?: string;
  ts: number;
};

export function JarvisSidebar({
  open,
  onOpenChange,
  history,
  query,
  setQuery,
  onDelete,
  onClear,
  onSelect,
  onNewChat,
  user,
  avatarUrl,
  onOpenProfileSheet,
  onOpenWorkspace,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  history: SidebarHistoryItem[];
  query: string;
  setQuery: (v: string) => void;
  onDelete: (id: string) => void;
  onClear: () => void;
  onSelect: (item: SidebarHistoryItem) => void;
  onNewChat: () => void;
  user: { name: string; email: string };
  avatarUrl?: string | null;
  onOpenProfileSheet: () => void;
  onOpenWorkspace: (view: WorkspaceView) => void;
}) {
  const [searchOpen, setSearchOpen] = useState(false);
  const initial = (user.name || user.email || "?").trim().charAt(0).toUpperCase();

  const items = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return history;
    return history.filter(
      (h) =>
        (h.title ?? "").toLowerCase().includes(q) ||
        h.query.toLowerCase().includes(q) ||
        (h.reply ?? "").toLowerCase().includes(q),
    );
  }, [history, query]);

  const shortcuts: Array<{ label: string; Icon: typeof ImageIcon; view: WorkspaceView }> = [
    { label: "Images", Icon: ImageIcon, view: "images" },
    { label: "Projects", Icon: FolderKanban, view: "projects" },
    { label: "Library", Icon: Library, view: "library" },
    { label: "Plugins", Icon: Puzzle, view: "plugins" },
  ];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="left"
        className="flex w-[86vw] flex-col border-r border-[color:var(--jarvis-cyan)]/30 bg-card/95 p-0 backdrop-blur-xl sm:max-w-sm"
      >
        <div
          className="pointer-events-none absolute inset-0 opacity-15"
          style={{
            backgroundImage:
              "linear-gradient(oklch(0.5 0.12 210 / 0.3) 1px, transparent 1px), linear-gradient(90deg, oklch(0.5 0.12 210 / 0.3) 1px, transparent 1px)",
            backgroundSize: "28px 28px",
          }}
        />

        <SheetHeader className="relative shrink-0 px-4 pb-2 pt-5 text-left">
          <SheetTitle className="font-hud text-xs tracking-[0.25em] text-[color:var(--jarvis-cyan)] text-glow">
            ◢ J.A.R.V.I.S.
          </SheetTitle>
          <SheetDescription className="sr-only">Chats, search and account menu</SheetDescription>
        </SheetHeader>

        {/* 1. Search chats */}
        <div className="relative shrink-0 px-2 pb-1">
          {searchOpen ? (
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[color:var(--jarvis-cyan)]/70" />
              <input
                autoFocus
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onBlur={() => { if (!query.trim()) setSearchOpen(false); }}
                placeholder="Search chats"
                className="w-full rounded-lg border border-[color:var(--jarvis-cyan)]/40 bg-background/60 py-2 pl-9 pr-8 text-sm text-foreground outline-none placeholder:text-muted-foreground/60 focus:border-[color:var(--jarvis-cyan)]"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  aria-label="Clear search"
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground"
                >
                  ✕
                </button>
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm text-foreground transition hover:bg-[color:var(--jarvis-cyan)]/10"
            >
              <Search className="h-4 w-4 text-[color:var(--jarvis-cyan)]" />
              <span>Search chats</span>
            </button>
          )}
        </div>

        {/* 2. Workspace shortcuts */}
        <div className="relative shrink-0 px-2 pb-2">
          {shortcuts.map(({ label, Icon, view }) => (
            <button
              key={label}
              type="button"
              onClick={() => { onOpenChange(false); onOpenWorkspace(view); }}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm text-foreground transition hover:bg-[color:var(--jarvis-cyan)]/10"
            >
              <Icon className="h-4 w-4 text-[color:var(--jarvis-cyan)]" />
              <span>{label}</span>
            </button>
          ))}
        </div>

        {/* 3. Chats in the middle */}
        <div className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain px-2">
          <div className="px-3 pb-1 pt-2 text-[11px] font-medium text-muted-foreground">Chats</div>
          <div className="pb-4">
            {history.length === 0 ? (
              <div className="px-3 py-10 text-center text-xs text-muted-foreground">
                No chats yet. Your conversations will appear here.
              </div>
            ) : items.length === 0 ? (
              <div className="px-3 py-10 text-center text-xs text-muted-foreground">
                No chats match “{query}”.
              </div>
            ) : (
              <ul>
                {items.map((h) => (
                  <li key={h.id} className="group relative">
                    <button
                      type="button"
                      onClick={() => onSelect(h)}
                      className="flex w-full items-center gap-2.5 rounded-lg py-2 pl-3 pr-9 text-left transition hover:bg-[color:var(--jarvis-cyan)]/10"
                    >
                      <MessageSquare className="h-3.5 w-3.5 shrink-0 text-[color:var(--jarvis-cyan)]/70" />
                      <span className="truncate text-sm text-foreground/95">
                        {h.title?.trim() || h.query}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete(h.id)}
                      aria-label="Delete chat"
                      className="absolute right-1.5 top-1/2 hidden -translate-y-1/2 rounded p-1.5 text-muted-foreground transition hover:text-[color:var(--jarvis-red)] group-hover:block"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {history.length > 0 && (
              <button
                type="button"
                onClick={onClear}
                className="mt-1 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs text-muted-foreground transition hover:bg-[color:var(--jarvis-red)]/10 hover:text-[color:var(--jarvis-red)]"
              >
                <Trash2 className="h-3.5 w-3.5" /> Clear all chats
              </button>
            )}
          </div>
        </div>

        {/* 4. Bottom bar: New chat (left) + Profile sheet (right) */}
        <div className="relative shrink-0 border-t border-[color:var(--jarvis-cyan)]/25 p-2">
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => { onOpenChange(false); onNewChat(); }}
              className="flex items-center gap-2 rounded-full border border-[color:var(--jarvis-cyan)]/40 bg-[color:var(--jarvis-cyan)]/10 px-3.5 py-2 text-sm text-[color:var(--jarvis-cyan)] text-glow transition hover:bg-[color:var(--jarvis-cyan)]/20"
            >
              <Plus className="h-4 w-4" />
              New chat
            </button>
            <button
              type="button"
              onClick={() => { onOpenChange(false); onOpenProfileSheet(); }}
              aria-label="Open profile menu"
              className="flex items-center gap-2 rounded-full px-2 py-1.5 transition hover:bg-[color:var(--jarvis-cyan)]/10"
            >
              <span className="max-w-[90px] truncate text-sm text-foreground">{user.name}</span>
              <span className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full border border-[color:var(--jarvis-cyan)]/50 bg-[color:var(--jarvis-cyan)]/10 text-[color:var(--jarvis-cyan)]">
                {avatarUrl ? (
                  <img src={avatarUrl} alt={user.name} className="h-full w-full object-cover" />
                ) : (
                  <span className="font-hud text-xs font-bold text-glow">{initial}</span>
                )}
              </span>
            </button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
