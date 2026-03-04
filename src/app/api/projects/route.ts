import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await sql`
    SELECT id, name, model_filename, model_blob_url, thumbnail_url, updated_at
    FROM projects
    WHERE user_id = ${userId}
    ORDER BY updated_at DESC
  `;

  return NextResponse.json({ projects: rows });
}

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json() as {
    name?: string;
    modelBlobUrl?: string;
    modelFilename?: string;
  };

  const rows = await sql`
    INSERT INTO projects (user_id, name, model_blob_url, model_filename)
    VALUES (
      ${userId},
      ${body.name ?? "Untitled Project"},
      ${body.modelBlobUrl ?? null},
      ${body.modelFilename ?? null}
    )
    RETURNING id, name, model_filename, model_blob_url, created_at, updated_at
  `;

  return NextResponse.json({ project: rows[0] });
}
