import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { put, head } from "@vercel/blob";
import {
  SkillIndex,
  SkillIndexEntry,
  skillBlobPath,
  skillIndexPath,
  serializeSkillFile,
  toSlug,
  uniqueSlug,
  STARTER_SKILLS,
} from "@/lib/skills";

// ── helpers ────────────────────────────────────────────────────────────────

async function readIndex(userId: string): Promise<SkillIndex | null> {
  const path = skillIndexPath(userId);
  try {
    // head() lets us get the URL without listing; then fetch the content
    const meta = await head(path).catch(() => null);
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

async function seedStarterSkills(userId: string): Promise<SkillIndex> {
  const entries: SkillIndexEntry[] = [];
  const usedSlugs = new Set<string>();

  for (const starter of STARTER_SKILLS) {
    const slug = uniqueSlug(toSlug(starter.frontmatter.name), usedSlugs);
    usedSlugs.add(slug);

    const raw = serializeSkillFile(
      {
        name: starter.frontmatter.name,
        keywords: starter.frontmatter.keywords,
        description: starter.frontmatter.description,
        enabled: true,
      },
      starter.body
    );

    const { url } = await put(skillBlobPath(userId, slug), raw, {
      access: "public",
      contentType: "text/markdown",
      allowOverwrite: true,
    });

    entries.push({
      slug,
      name: starter.frontmatter.name,
      keywords: starter.frontmatter.keywords,
      description: starter.frontmatter.description,
      enabled: true,
      updatedAt: new Date().toISOString(),
      blobUrl: url,
    });
  }

  const index: SkillIndex = { version: 1, skills: entries };
  await writeIndex(userId, index);
  return index;
}

// ── GET /api/skills ────────────────────────────────────────────────────────

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let index = await readIndex(userId);
  let seeded = false;

  if (!index) {
    index = await seedStarterSkills(userId);
    seeded = true;
  }

  return NextResponse.json({ skills: index.skills, seeded });
}

// ── POST /api/skills ───────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json() as {
    name: string;
    keywords: string[];
    description: string;
    body: string;
    enabled?: boolean;
  };

  if (!body.name?.trim()) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  const index = (await readIndex(userId)) ?? { version: 1 as const, skills: [] };
  const existingSlugs = new Set(index.skills.map((s) => s.slug));
  const slug = uniqueSlug(toSlug(body.name), existingSlugs);

  const raw = serializeSkillFile(
    {
      name: body.name,
      keywords: body.keywords ?? [],
      description: body.description ?? "",
      enabled: body.enabled ?? true,
    },
    body.body ?? ""
  );

  const { url } = await put(skillBlobPath(userId, slug), raw, {
    access: "public",
    contentType: "text/markdown",
    allowOverwrite: true,
  });

  const entry: SkillIndexEntry = {
    slug,
    name: body.name,
    keywords: body.keywords ?? [],
    description: body.description ?? "",
    enabled: body.enabled ?? true,
    updatedAt: new Date().toISOString(),
    blobUrl: url,
  };

  index.skills.push(entry);
  await writeIndex(userId, index);

  return NextResponse.json({ skill: entry });
}
