import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { put, del } from "@vercel/blob";
import {
  SkillIndex,
  SkillIndexEntry,
  skillBlobPath,
  skillIndexPath,
  serializeSkillFile,
} from "@/lib/skills";

// ── helpers ────────────────────────────────────────────────────────────────

async function readIndex(userId: string): Promise<SkillIndex | null> {
  try {
    const { head } = await import("@vercel/blob");
    const meta = await head(skillIndexPath(userId)).catch(() => null);
    if (!meta) return null;
    const res = await fetch(meta.url, { cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as SkillIndex;
  } catch {
    return null;
  }
}

async function writeIndex(userId: string, index: SkillIndex): Promise<void> {
  await put(skillIndexPath(userId), JSON.stringify(index, null, 2), {
    access: "public",
    contentType: "application/json",
    allowOverwrite: true,
  });
}

// ── GET /api/skills/[slug] ─────────────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { slug } = await params;
  const index = await readIndex(userId);
  const entry = index?.skills.find((s) => s.slug === slug);
  if (!entry) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Fetch the actual .md body from Vercel Blob
  const res = await fetch(entry.blobUrl, { cache: "no-store" });
  if (!res.ok) return NextResponse.json({ error: "Blob not found" }, { status: 404 });
  const raw = await res.text();

  return NextResponse.json({ entry, raw });
}

// ── PUT /api/skills/[slug] ─────────────────────────────────────────────────

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { slug } = await params;
  const index = await readIndex(userId);
  if (!index) return NextResponse.json({ error: "No skills found" }, { status: 404 });

  const idx = index.skills.findIndex((s) => s.slug === slug);
  if (idx === -1) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json() as {
    name?: string;
    keywords?: string[];
    description?: string;
    body?: string;
    enabled?: boolean;
  };

  const existing = index.skills[idx];

  // Re-upload .md if body or frontmatter changed
  const newName = body.name ?? existing.name;
  const newKeywords = body.keywords ?? existing.keywords;
  const newDescription = body.description ?? existing.description;
  const newEnabled = body.enabled ?? existing.enabled;
  const newBody = body.body;

  let blobUrl = existing.blobUrl;

  if (newBody !== undefined || body.name !== undefined || body.keywords !== undefined || body.description !== undefined || body.enabled !== undefined) {
    // Need to fetch current body if not provided
    let bodyContent = newBody;
    if (bodyContent === undefined) {
      const res = await fetch(existing.blobUrl, { cache: "no-store" });
      const raw = await res.text();
      // Extract body from frontmatter
      const match = raw.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n?([\s\S]*)$/);
      bodyContent = match ? match[1].trim() : raw;
    }

    const raw = serializeSkillFile(
      { name: newName, keywords: newKeywords, description: newDescription, enabled: newEnabled },
      bodyContent
    );

    const { url } = await put(skillBlobPath(userId, slug), raw, {
      access: "public",
      contentType: "text/markdown",
      allowOverwrite: true,
    });
    blobUrl = url;
  }

  const updated: SkillIndexEntry = {
    ...existing,
    name: newName,
    keywords: newKeywords,
    description: newDescription,
    enabled: newEnabled,
    updatedAt: new Date().toISOString(),
    blobUrl,
  };

  index.skills[idx] = updated;
  await writeIndex(userId, index);

  return NextResponse.json({ skill: updated });
}

// ── DELETE /api/skills/[slug] ──────────────────────────────────────────────

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { slug } = await params;
  const index = await readIndex(userId);
  if (!index) return NextResponse.json({ error: "No skills found" }, { status: 404 });

  const entry = index.skills.find((s) => s.slug === slug);
  if (!entry) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Delete the .md blob (non-fatal)
  await del(entry.blobUrl).catch(() => {});

  index.skills = index.skills.filter((s) => s.slug !== slug);
  await writeIndex(userId, index);

  return NextResponse.json({ ok: true });
}
