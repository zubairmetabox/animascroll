import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  // Verify ownership
  const project = await sql`SELECT id FROM projects WHERE id = ${id} AND user_id = ${userId}`;
  if (!project[0]) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const rows = await sql`
    SELECT id, role, content, operations, created_at
    FROM chat_messages
    WHERE project_id = ${id}
    ORDER BY created_at ASC
  `;

  return NextResponse.json({ messages: rows });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const project = await sql`SELECT id FROM projects WHERE id = ${id} AND user_id = ${userId}`;
  if (!project[0]) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json() as {
    role: "user" | "assistant";
    content: string;
    operations?: unknown;
  };

  if (!["user", "assistant"].includes(body.role)) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }

  const rows = await sql`
    INSERT INTO chat_messages (project_id, role, content, operations)
    VALUES (
      ${id},
      ${body.role},
      ${body.content},
      ${body.operations ? JSON.stringify(body.operations) : null}::jsonb
    )
    RETURNING id, role, content, operations, created_at
  `;

  return NextResponse.json({ message: rows[0] });
}
