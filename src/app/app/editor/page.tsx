"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { ModelEditor } from "@/components/model-editor";

function EditorInner() {
  const params = useSearchParams();
  const id = params.get("id") ?? undefined;
  return (
    <main className="h-screen w-screen overflow-hidden">
      <ModelEditor initialProjectId={id} />
    </main>
  );
}

export default function EditorPage() {
  return (
    <Suspense>
      <EditorInner />
    </Suspense>
  );
}
