import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { list } from "@vercel/blob";
import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";

const STORAGE_LIMIT_BYTES = 100 * 1024 * 1024; // 100 MB

async function getUserModelUsageBytes(userId: string): Promise<number> {
  let total = 0;
  let cursor: string | undefined;
  do {
    const result = await list({ prefix: `models/${userId}/`, cursor, limit: 1000 });
    for (const blob of result.blobs) total += blob.size;
    cursor = result.cursor;
  } while (cursor);
  return total;
}

// GET — returns current storage usage for quota pre-check in the client
export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const usedBytes = await getUserModelUsageBytes(userId);
    return NextResponse.json({ usedBytes, limitBytes: STORAGE_LIMIT_BYTES });
  } catch {
    return NextResponse.json({ usedBytes: 0, limitBytes: STORAGE_LIMIT_BYTES });
  }
}

// POST — authorises and completes a client-side direct upload (file never passes through this server)
export async function POST(req: NextRequest) {
  const body = await req.json() as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async (pathname) => {
        // Validate that the requesting user is authenticated and owns the path
        const { userId } = await auth();
        if (!userId) throw new Error("Unauthorized");

        // Pathname must start with models/<userId>/
        if (!pathname.startsWith(`models/${userId}/`)) {
          throw new Error("Invalid upload path");
        }

        return {
          allowedContentTypes: [
            "model/gltf-binary",
            "model/gltf+json",
            "application/octet-stream",
            "application/x-fbx",
            "text/plain",
          ],
          maximumSizeInBytes: STORAGE_LIMIT_BYTES,
          tokenPayload: userId,
        };
      },
      onUploadCompleted: async () => {
        // Nothing to do here — the client patches the project record itself after upload
      },
    });

    return NextResponse.json(jsonResponse);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
