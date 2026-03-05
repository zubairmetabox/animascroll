"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import { Clock, FolderOpen, Plus, Trash2, X } from "lucide-react";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type Project = {
  id: string;
  name: string;
  model_filename: string | null;
  model_blob_url: string | null;
  thumbnail_url: string | null;
  updated_at: string;
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function ProjectsPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [newProjectOpen, setNewProjectOpen] = useState(false);
  const [projectName, setProjectName] = useState("");
  const [creating, setCreating] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetch("/api/projects")
      .then((r) => r.json())
      .then((d) => setProjects(d.projects ?? []))
      .finally(() => setLoading(false));
  }, []);

  const handleCreate = async () => {
    const name = projectName.trim() || "Untitled Project";
    setCreating(true);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const { project } = await res.json() as { project: { id: string } };
      router.push(`/app/editor?id=${project.id}`);
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeleting(true);
    try {
      await fetch(`/api/projects/${id}`, { method: "DELETE" });
      setProjects((prev) => prev.filter((p) => p.id !== id));
      setConfirmDeleteId(null);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-foreground">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-border/30 px-8 py-4">
        <Logo variant="light" markHeight="h-6" href="/app" />
        <UserButton />
      </header>

      {/* Main */}
      <main className="mx-auto max-w-5xl px-8 py-10">
        <div className="mb-8 flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-white">Your Projects</h1>
          <Button onClick={() => { setProjectName(""); setNewProjectOpen(true); }} className="gap-2">
            <Plus className="h-4 w-4" />
            New Project
          </Button>
        </div>

        {/* Project grid */}
        {loading && (
          <p className="py-20 text-center text-sm text-zinc-400">Loading projects…</p>
        )}
        {!loading && projects.length === 0 && (
          <div className="py-20 text-center">
            <FolderOpen className="mx-auto mb-3 h-10 w-10 text-zinc-500" />
            <p className="text-sm text-zinc-300">No projects yet.</p>
            <p className="mt-1 text-xs text-zinc-500">Click &ldquo;New Project&rdquo; to get started.</p>
          </div>
        )}
        {!loading && projects.length > 0 && (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {projects.map((p) => (
              <div key={p.id} className="relative">
                {confirmDeleteId === p.id ? (
                  /* ── Confirm delete overlay ── */
                  <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-red-500/40 bg-red-950/30 p-4 text-center" style={{ aspectRatio: "16/9" }}>
                    <Trash2 className="h-6 w-6 text-red-400" />
                    <p className="text-xs text-zinc-300">Delete <span className="font-medium">{p.name}</span>?</p>
                    <p className="text-[10px] text-zinc-500">This removes the model and all data permanently.</p>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 px-3 text-xs"
                        onClick={() => setConfirmDeleteId(null)}
                      >
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        className="h-7 bg-red-600 px-3 text-xs hover:bg-red-700"
                        disabled={deleting}
                        onClick={() => void handleDelete(p.id)}
                      >
                        {deleting ? "Deleting…" : "Delete"}
                      </Button>
                    </div>
                  </div>
                ) : (
                  /* ── Normal card ── */
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => router.push(`/app/editor?id=${p.id}`)}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") router.push(`/app/editor?id=${p.id}`); }}
                    className={cn(
                      "group flex w-full cursor-pointer flex-col rounded-xl border border-border/40 bg-card/40 text-left transition-all overflow-hidden",
                      "hover:border-primary/50 hover:bg-card/70"
                    )}
                  >
                    {/* Preview area — fixed 16:9 aspect */}
                    <div className="relative w-full" style={{ aspectRatio: "16/9" }}>
                      {p.thumbnail_url ? (
                        <img
                          src={p.thumbnail_url}
                          alt={p.name}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center bg-muted/30">
                          <FolderOpen className="h-8 w-8 text-muted-foreground/30 transition-colors group-hover:text-muted-foreground/60" />
                        </div>
                      )}
                      {/* Delete button */}
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(p.id); }}
                        className="absolute right-2 top-2 rounded-md p-1 text-zinc-400 opacity-0 transition-opacity hover:bg-red-500/10 hover:text-red-400 group-hover:opacity-100 bg-black/40"
                        title="Delete project"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    {/* Info */}
                    <div className="min-w-0 p-3">
                      <p className="truncate font-medium text-zinc-100">{p.name}</p>
                      <p className="truncate text-xs text-zinc-400 min-h-[1rem]">{p.model_filename ?? ""}</p>
                      <div className="mt-1 flex items-center gap-1 text-[11px] text-zinc-400">
                        <Clock className="h-3 w-3" />
                        {timeAgo(p.updated_at)}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>

      {/* New Project modal */}
      {newProjectOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) setNewProjectOpen(false); }}
        >
          <div className="w-full max-w-sm rounded-xl border border-border/60 bg-card p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-semibold">New Project</h2>
              <button type="button" onClick={() => setNewProjectOpen(false)}>
                <X className="h-4 w-4 text-muted-foreground hover:text-foreground" />
              </button>
            </div>
            <label className="mb-1 block text-sm text-muted-foreground">Project name</label>
            <Input
              autoFocus
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              placeholder="My Animation"
              onKeyDown={(e) => { if (e.key === "Enter") void handleCreate(); }}
              className="mb-4"
            />
            <Button
              className="w-full"
              disabled={creating}
              onClick={() => void handleCreate()}
            >
              {creating ? "Creating…" : "Create Project"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
