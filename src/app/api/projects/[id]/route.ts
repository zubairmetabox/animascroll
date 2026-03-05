import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { del, put } from "@vercel/blob";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const rows = await sql`
    SELECT * FROM projects WHERE id = ${id} AND user_id = ${userId}
  `;

  if (!rows[0]) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ project: rows[0] });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json() as {
    name?: string;
    config?: unknown;
    modelBlobUrl?: string;
    modelFilename?: string;
    thumbnailDataUrl?: string;
  };

  // Upload thumbnail to Vercel Blob if provided
  let thumbnailUrl: string | null = null;
  if (body.thumbnailDataUrl) {
    const base64 = body.thumbnailDataUrl.replace(/^data:image\/\w+;base64,/, "");
    const buffer = Buffer.from(base64, "base64");
    const { url } = await put(`thumbnails/${userId}/${id}.jpg`, buffer, {
      access: "public",
      contentType: "image/jpeg",
      allowOverwrite: true,
    });
    thumbnailUrl = url;
  }

  await sql`
    UPDATE projects
    SET
      name           = COALESCE(${body.name ?? null}, name),
      config         = COALESCE(${body.config ? JSON.stringify(body.config) : null}::jsonb, config),
      model_blob_url = COALESCE(${body.modelBlobUrl ?? null}, model_blob_url),
      model_filename = COALESCE(${body.modelFilename ?? null}, model_filename),
      thumbnail_url  = COALESCE(${thumbnailUrl}, thumbnail_url),
      updated_at     = NOW()
    WHERE id = ${id} AND user_id = ${userId}
  `;

  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  // Fetch the project to get blob URLs (ownership check included)
  const rows = await sql`
    SELECT model_blob_url, thumbnail_url, is_sample FROM projects WHERE id = ${id} AND user_id = ${userId}
  `;
  if (!rows[0]) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const blobUrl = rows[0].model_blob_url as string | null;
  const thumbUrl = rows[0].thumbnail_url as string | null;
  const isSample = rows[0].is_sample as boolean;

  // Delete blobs (non-fatal) — skip for sample projects since the asset is shared
  if (!isSample) {
    await Promise.all([
      blobUrl ? del(blobUrl).catch(() => {}) : Promise.resolve(),
      thumbUrl ? del(thumbUrl).catch(() => {}) : Promise.resolve(),
    ]);
  }

  // Delete project (chat_messages cascade via FK)
  await sql`DELETE FROM projects WHERE id = ${id} AND user_id = ${userId}`;

  return NextResponse.json({ ok: true });
}
