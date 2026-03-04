"use client";

import { useEffect, useState } from "react";
import { FolderOpen, Plus, X, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Project = {
  id: string;
  name: string;
  model_filename: string | null;
  model_blob_url: string | null;
  updated_at: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  onOpen: (project: Project) => void;
  onNew: () => void;
  currentProjectId: string | null;
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export function ProjectsModal({ open, onClose, onOpen, onNew, currentProjectId }: Props) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    fetch("/api/projects")
      .then((r) => r.json())
      .then((d) => setProjects(d.projects ?? []))
      .finally(() => setLoading(false));
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="relative w-full max-w-2xl rounded-xl border border-border/60 bg-card shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border/40 px-6 py-4">
          <div className="flex items-center gap-2">
            <FolderOpen className="h-5 w-5 text-muted-foreground" />
            <span className="font-semibold">My Projects</span>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={onNew} className="gap-1.5">
              <Plus className="h-3.5 w-3.5" />
              New Project
            </Button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="max-h-[480px] overflow-y-auto p-6">
          {loading && (
            <p className="py-8 text-center text-sm text-muted-foreground">Loading projects…</p>
          )}
          {!loading && projects.length === 0 && (
            <div className="py-12 text-center">
              <p className="text-sm text-muted-foreground">No projects yet.</p>
              <p className="mt-1 text-xs text-muted-foreground">Upload a 3D model to get started.</p>
            </div>
          )}
          {!loading && projects.length > 0 && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {projects.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => onOpen(p)}
                  className={cn(
                    "group flex flex-col gap-2 rounded-lg border p-4 text-left transition-colors hover:border-primary/60 hover:bg-muted/60",
                    p.id === currentProjectId
                      ? "border-primary/60 bg-primary/5"
                      : "border-border/40 bg-muted/20"
                  )}
                >
                  {/* Icon placeholder */}
                  <div className="flex h-12 w-full items-center justify-center rounded-md bg-muted/60">
                    <FolderOpen className="h-6 w-6 text-muted-foreground/60" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{p.name}</p>
                    {p.model_filename && (
                      <p className="truncate text-[11px] text-muted-foreground">{p.model_filename}</p>
                    )}
                    <div className="mt-1 flex items-center gap-1 text-[10px] text-muted-foreground">
                      <Clock className="h-2.5 w-2.5" />
                      {timeAgo(p.updated_at)}
                    </div>
                  </div>
                  {p.id === currentProjectId && (
                    <span className="text-[10px] font-medium text-primary">Current</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
