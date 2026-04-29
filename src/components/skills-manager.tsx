"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { Plus, Trash2, ToggleLeft, ToggleRight, ChevronRight, Loader2, Save } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type SkillEntry = {
  slug: string;
  name: string;
  keywords: string[];
  description: string;
  enabled: boolean;
  updatedAt: string;
  blobUrl: string;
};

type Props = {
  /** "page" = full-page Skills tab on /app; "modal" = editor modal overlay */
  mode?: "page" | "modal";
};

// ── tiny helpers ──────────────────────────────────────────────────────────

function keywordsToStr(kw: string[]) {
  return kw.join(", ");
}

function strToKeywords(s: string): string[] {
  return s.split(",").map((k) => k.trim()).filter(Boolean);
}

// ── Editor panel ──────────────────────────────────────────────────────────

type EditorState = {
  slug: string | null; // null = new skill
  name: string;
  keywords: string;
  description: string;
  body: string;
  enabled: boolean;
  dirty: boolean;
};

function emptyEditor(): EditorState {
  return { slug: null, name: "", keywords: "", description: "", body: "", enabled: true, dirty: false };
}

// ── Markdown preview renderer ─────────────────────────────────────────────

function SkillPreview({ md }: { md: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        h1: ({ children }) => <h1 className="text-base font-bold text-zinc-100 mb-3 mt-1">{children}</h1>,
        h2: ({ children }) => <h2 className="text-sm font-semibold text-zinc-100 mt-5 mb-2 border-b border-zinc-800 pb-1">{children}</h2>,
        h3: ({ children }) => <h3 className="text-xs font-semibold text-zinc-200 mt-4 mb-1">{children}</h3>,
        p: ({ children }) => <p className="text-zinc-300 text-xs leading-relaxed mb-2">{children}</p>,
        ul: ({ children }) => <ul className="list-disc list-inside space-y-1 mb-2 text-zinc-300 text-xs">{children}</ul>,
        ol: ({ children }) => <ol className="list-decimal list-inside space-y-1 mb-2 text-zinc-300 text-xs">{children}</ol>,
        li: ({ children }) => <li className="leading-relaxed">{children}</li>,
        strong: ({ children }) => <strong className="text-zinc-100 font-semibold">{children}</strong>,
        code: ({ children, className }) =>
          className ? (
            <code className="block bg-zinc-900 border border-zinc-700 rounded p-2 text-[11px] text-emerald-400 overflow-x-auto mb-2 whitespace-pre font-mono">{children}</code>
          ) : (
            <code className="bg-zinc-900 text-emerald-400 rounded px-1 py-0.5 text-[11px] font-mono">{children}</code>
          ),
        pre: ({ children }) => <pre className="mb-2">{children}</pre>,
        hr: () => <hr className="border-zinc-800 my-4" />,
        table: ({ children }) => (
          <div className="overflow-x-auto mb-3">
            <table className="w-full text-xs border-collapse">{children}</table>
          </div>
        ),
        thead: ({ children }) => <thead>{children}</thead>,
        th: ({ children }) => <th className="text-left text-zinc-300 font-medium px-2 py-1.5 border-b border-zinc-700">{children}</th>,
        td: ({ children }) => <td className="text-zinc-400 px-2 py-1.5 border-b border-zinc-800">{children}</td>,
        blockquote: ({ children }) => <blockquote className="border-l-2 border-zinc-600 pl-3 italic text-zinc-400 mb-2">{children}</blockquote>,
      }}
    >
      {md}
    </ReactMarkdown>
  );
}

// ── Main component ────────────────────────────────────────────────────────

export default function SkillsManager({ mode = "page" }: Props) {
  const [skills, setSkills] = useState<SkillEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editor, setEditor] = useState<EditorState>(emptyEditor());
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [bodyView, setBodyView] = useState<"raw" | "preview">("raw");
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  // ── Fetch skill list ────────────────────────────────────────────────────

  const fetchSkills = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/skills");
      const data = await res.json() as { skills: SkillEntry[] };
      setSkills(data.skills ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchSkills(); }, [fetchSkills]);

  // ── Select skill (load body) ────────────────────────────────────────────

  const selectSkill = useCallback(async (entry: SkillEntry) => {
    setSelectedSlug(entry.slug);
    setBodyView("raw");
    setEditor((prev) => ({
      ...prev,
      slug: entry.slug,
      name: entry.name,
      keywords: keywordsToStr(entry.keywords),
      description: entry.description,
      enabled: entry.enabled,
      body: "…loading…",
      dirty: false,
    }));

    try {
      const res = await fetch(`/api/skills/${entry.slug}`);
      const data = await res.json() as { entry: SkillEntry; raw: string };
      // Extract body from raw (strip frontmatter)
      const bodyMatch = data.raw.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n?([\s\S]*)$/);
      const body = bodyMatch ? bodyMatch[1].trim() : data.raw;
      setEditor((prev) => ({ ...prev, body, dirty: false }));
    } catch {
      setEditor((prev) => ({ ...prev, body: "Error loading skill body." }));
    }
  }, []);

  // ── New skill ───────────────────────────────────────────────────────────

  const startNew = () => {
    setSelectedSlug(null);
    setBodyView("raw");
    setEditor({ ...emptyEditor(), dirty: true });
    bodyRef.current?.focus();
  };

  // ── Save ────────────────────────────────────────────────────────────────

  const save = useCallback(async () => {
    if (!editor.name.trim()) return;
    setSaving(true);
    try {
      const payload = {
        name: editor.name,
        keywords: strToKeywords(editor.keywords),
        description: editor.description,
        body: editor.body,
        enabled: editor.enabled,
      };

      let savedEntry: SkillEntry;
      if (editor.slug) {
        const res = await fetch(`/api/skills/${editor.slug}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json() as { skill: SkillEntry };
        savedEntry = data.skill;
        setSkills((prev) => prev.map((s) => (s.slug === editor.slug ? savedEntry : s)));
      } else {
        const res = await fetch("/api/skills", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json() as { skill: SkillEntry };
        savedEntry = data.skill;
        setSkills((prev) => [...prev, savedEntry]);
      }

      setEditor((prev) => ({ ...prev, slug: savedEntry.slug, dirty: false }));
      setSelectedSlug(savedEntry.slug);
    } finally {
      setSaving(false);
    }
  }, [editor]);

  // ── Toggle enabled ──────────────────────────────────────────────────────

  const toggleEnabled = useCallback(async (entry: SkillEntry) => {
    const next = !entry.enabled;
    setSkills((prev) => prev.map((s) => s.slug === entry.slug ? { ...s, enabled: next } : s));
    if (editor.slug === entry.slug) {
      setEditor((prev) => ({ ...prev, enabled: next }));
    }
    fetch(`/api/skills/${entry.slug}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: next }),
    }).catch(() => {
      setSkills((prev) => prev.map((s) => s.slug === entry.slug ? { ...s, enabled: !next } : s));
      if (editor.slug === entry.slug) {
        setEditor((prev) => ({ ...prev, enabled: !next }));
      }
    });
  }, [editor.slug]);

  // ── Delete ──────────────────────────────────────────────────────────────

  const deleteSkill = useCallback(async (slug: string) => {
    if (!confirm("Delete this skill? This cannot be undone.")) return;
    await fetch(`/api/skills/${slug}`, { method: "DELETE" });
    setSkills((prev) => prev.filter((s) => s.slug !== slug));
    if (selectedSlug === slug) {
      setSelectedSlug(null);
      setEditor(emptyEditor());
    }
  }, [selectedSlug]);

  // ── Keyboard shortcut: Cmd/Ctrl+S to save ──────────────────────────────

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        if (editor.dirty) save();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [editor.dirty, save]);

  // ── Render ──────────────────────────────────────────────────────────────

  const containerCls = mode === "modal"
    ? "flex h-[calc(100vh-8rem)] max-h-[700px] overflow-hidden"
    : "flex flex-1 min-h-0 overflow-hidden";

  return (
    <div className={containerCls}>
      {/* ── Left panel: skill list ─────────────────────────────────────── */}
      <aside className="w-64 shrink-0 border-r border-zinc-800 flex flex-col bg-zinc-950">
        <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-800">
          <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">Skills</span>
          <button
            onClick={startNew}
            className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
            title="New skill"
          >
            <Plus size={14} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center h-20 text-zinc-500">
              <Loader2 size={16} className="animate-spin" />
            </div>
          ) : skills.length === 0 ? (
            <p className="px-3 py-4 text-xs text-zinc-500">No skills yet.</p>
          ) : (
            skills.map((s) => (
              <button
                key={s.slug}
                onClick={() => selectSkill(s)}
                className={`w-full text-left px-3 py-2.5 border-b border-zinc-900 flex items-start gap-2 transition-colors ${
                  selectedSlug === s.slug
                    ? "bg-zinc-800 text-white"
                    : "hover:bg-zinc-900 text-zinc-300"
                }`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-medium truncate">{s.name}</span>
                    {!s.enabled && (
                      <span className="text-[10px] text-zinc-500 shrink-0">(off)</span>
                    )}
                  </div>
                  <p className="text-[11px] text-zinc-500 truncate mt-0.5">{s.description}</p>
                </div>
                <ChevronRight size={12} className="shrink-0 mt-1 text-zinc-600" />
              </button>
            ))
          )}
        </div>
      </aside>

      {/* ── Right panel: editor ───────────────────────────────────────────── */}
      <main className="flex-1 flex flex-col min-h-0 overflow-hidden bg-zinc-950">
        {!editor.slug && !editor.dirty ? (
          /* Empty state */
          <div className="flex-1 flex flex-col items-center justify-center text-zinc-500 gap-3">
            <p className="text-sm">Select a skill to edit, or create a new one.</p>
            <button
              onClick={startNew}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors"
            >
              <Plus size={12} /> New skill
            </button>
          </div>
        ) : (
          <>
            {/* Top bar */}
            <div className="flex items-center justify-between px-4 py-2 border-b border-zinc-800 shrink-0">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => {
                    const found = skills.find(s => s.slug === editor.slug);
                    if (found) toggleEnabled(found);
                  }}
                  className="text-zinc-400 hover:text-white transition-colors"
                  title={editor.enabled ? "Disable — AI will ignore this skill" : "Enable — AI will use this skill"}
                >
                  {editor.enabled
                    ? <ToggleRight size={18} className="text-emerald-400" />
                    : <ToggleLeft size={18} />}
                </button>
                <span className="text-xs text-zinc-500">
                  {editor.enabled ? "Skill active — AI will use it" : "Skill disabled — AI will ignore it"}
                </span>
              </div>

              <div className="flex items-center gap-2">
                {editor.slug && (
                  <button
                    onClick={() => deleteSkill(editor.slug!)}
                    className="p-1.5 rounded hover:bg-red-900/40 text-zinc-500 hover:text-red-400 transition-colors"
                    title="Delete skill"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
                <button
                  onClick={save}
                  disabled={saving || !editor.name.trim()}
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded bg-white text-black hover:bg-zinc-200 disabled:opacity-40 transition-colors font-medium"
                >
                  {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                  Save
                </button>
              </div>
            </div>

            {/* Form fields */}
            <div className="px-4 py-3 border-b border-zinc-800 space-y-2 shrink-0">
              <input
                className="w-full bg-transparent text-white text-sm font-semibold placeholder:text-zinc-600 outline-none border-b border-zinc-800 pb-1 focus:border-zinc-500 transition-colors"
                placeholder="Skill name…"
                value={editor.name}
                onChange={(e) => setEditor((prev) => ({ ...prev, name: e.target.value, dirty: true }))}
              />
              <input
                className="w-full bg-transparent text-zinc-300 text-xs placeholder:text-zinc-600 outline-none border-b border-zinc-800 pb-1 focus:border-zinc-500 transition-colors"
                placeholder="Description…"
                value={editor.description}
                onChange={(e) => setEditor((prev) => ({ ...prev, description: e.target.value, dirty: true }))}
              />
              <input
                className="w-full bg-transparent text-zinc-400 text-xs placeholder:text-zinc-600 outline-none"
                placeholder="Keywords (comma-separated): stagger, cascade, offset…"
                value={editor.keywords}
                onChange={(e) => setEditor((prev) => ({ ...prev, keywords: e.target.value, dirty: true }))}
              />
            </div>

            {/* Body area — raw / preview toggle */}
            <div className="flex-1 min-h-0 flex flex-col">
              {/* Sub-toolbar */}
              <div className="flex items-center gap-0.5 px-4 py-2 border-b border-zinc-800 shrink-0">
                <button
                  onClick={() => setBodyView("raw")}
                  className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${
                    bodyView === "raw"
                      ? "bg-zinc-700 text-white"
                      : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800"
                  }`}
                >
                  Raw
                </button>
                <button
                  onClick={() => setBodyView("preview")}
                  className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${
                    bodyView === "preview"
                      ? "bg-zinc-700 text-white"
                      : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800"
                  }`}
                >
                  Preview
                </button>
              </div>

              {/* Body content */}
              {bodyView === "raw" ? (
                <textarea
                  ref={bodyRef}
                  className="flex-1 w-full min-h-0 bg-transparent text-zinc-300 text-xs font-mono resize-none outline-none placeholder:text-zinc-700 leading-relaxed px-4 py-3"
                  placeholder={`Describe how to produce this animation technique.\nInclude example JSON operations.\n\nExample:\n\`\`\`json\n[\n  { "type": "set_track", "layerId": "{{layer}}", "propertyId": "position.y", "keyframes": [...] }\n]\n\`\`\``}
                  value={editor.body}
                  onChange={(e) => setEditor((prev) => ({ ...prev, body: e.target.value, dirty: true }))}
                  spellCheck={false}
                />
              ) : (
                <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3">
                  {editor.body.trim() ? (
                    <SkillPreview md={editor.body} />
                  ) : (
                    <p className="text-zinc-600 text-xs italic">Nothing to preview yet.</p>
                  )}
                </div>
              )}
            </div>

            {editor.dirty && (
              <div className="px-4 py-1.5 border-t border-zinc-800 text-[10px] text-zinc-600 shrink-0">
                Unsaved changes — Ctrl+S to save
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
