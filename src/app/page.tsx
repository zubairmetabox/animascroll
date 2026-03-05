import Link from "next/link";
import { Logo } from "@/components/logo";

const features = [
  {
    title: "Just describe it",
    description: "Tell the AI what you want — \"explode the parts apart as I scroll\" or \"spin it 360 with a cinematic reveal\" — and it builds the animation for you.",
    icon: "✦",
  },
  {
    title: "Any 3D Format",
    description: "Upload GLB, GLTF, FBX, OBJ, or STL files. Works with models straight from Blender, Spline, or anywhere else.",
    icon: "⬡",
  },
  {
    title: "Visual Keyframe Timeline",
    description: "Every AI-generated animation lands on a real timeline. Tweak keyframes, adjust easing, and scrub in real time.",
    icon: "◆",
  },
  {
    title: "Scroll-Driven",
    description: "Your animation plays as the user scrolls — built for landing pages, product showcases, and interactive storytelling.",
    icon: "↕",
  },
  {
    title: "Custom Animation Skills",
    description: "Teach the AI your own techniques. Define reusable skills with examples and the AI applies them whenever relevant.",
    icon: "⚡",
  },
  {
    title: "Export to HTML",
    description: "One click exports a self-contained HTML file with Three.js baked in. Host it anywhere, no build step needed.",
    icon: "↗",
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">

      {/* ── Navbar ─────────────────────────────────────────────────── */}
      <nav className="flex items-center justify-between px-6 py-4 md:px-12">
        <Logo variant="light" markHeight="h-6" />
        <div className="flex items-center gap-3">
          <Link
            href="/sign-in"
            className="text-sm text-zinc-400 hover:text-white transition-colors"
          >
            Sign in
          </Link>
          <Link
            href="/sign-up"
            className="rounded-md bg-white px-4 py-1.5 text-sm font-medium text-zinc-950 hover:bg-zinc-100 transition-colors"
          >
            Get started
          </Link>
        </div>
      </nav>

      {/* ── Hero ───────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-4xl px-6 pb-24 pt-24 text-center md:px-12 md:pt-32">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-900/60 px-3 py-1 text-xs text-zinc-400">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
          AI-powered · Now in beta
        </div>
        <h1 className="mb-6 text-4xl font-bold tracking-tight text-white md:text-6xl">
          Animate 3D models<br />
          <span className="text-zinc-400">by talking to AI.</span>
        </h1>
        <p className="mx-auto mb-10 max-w-xl text-base text-zinc-400 md:text-lg">
          Upload any 3D model, describe the animation you want, and let AI do the heavy lifting. Fine-tune on a visual timeline, preview with real scroll, and export to HTML — no code, no guesswork.
        </p>
        <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/sign-up"
            className="rounded-md bg-white px-6 py-2.5 text-sm font-semibold text-zinc-950 hover:bg-zinc-100 transition-colors"
          >
            Get started free
          </Link>
          <Link
            href="/sign-in"
            className="rounded-md border border-zinc-700 px-6 py-2.5 text-sm font-medium text-zinc-300 hover:border-zinc-500 hover:text-white transition-colors"
          >
            Sign in
          </Link>
        </div>
      </section>

      {/* ── Editor preview strip ────────────────────────────────────── */}
      <div className="mx-auto mb-24 max-w-5xl px-6 md:px-12">
        <div className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/50">
          <div className="flex items-center gap-1.5 border-b border-zinc-800 px-4 py-3">
            <div className="h-3 w-3 rounded-full bg-zinc-700" />
            <div className="h-3 w-3 rounded-full bg-zinc-700" />
            <div className="h-3 w-3 rounded-full bg-zinc-700" />
            <span className="ml-3 text-xs text-zinc-600">animascroll.io/app</span>
          </div>
          <div className="flex h-56 items-center justify-center text-zinc-700 md:h-80">
            <div className="text-center">
              <div className="mb-3 text-4xl">◆</div>
              <p className="text-sm">Editor preview</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── How it works ────────────────────────────────────────────── */}
      <section className="mx-auto max-w-4xl px-6 pb-24 md:px-12">
        <div className="mb-12 text-center">
          <h2 className="text-2xl font-bold text-white md:text-3xl">
            Your workflow, your pace
          </h2>
          <p className="mt-3 text-zinc-400">Let AI draft the animation, then fine-tune it — or build from scratch on the timeline. Either way.</p>
        </div>
        <div className="grid gap-6 sm:grid-cols-3">
          {[
            { step: "1", label: "Upload your model", detail: "Drop in a GLB, FBX, OBJ, or any common 3D format." },
            { step: "2", label: "Animate — your way", detail: "Describe what you want and let AI generate a starting point, or place keyframes manually on the timeline." },
            { step: "3", label: "Export & ship", detail: "Preview with real scroll, tweak if needed, export a standalone HTML file." },
          ].map((s) => (
            <div key={s.step} className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
              <div className="mb-3 flex h-7 w-7 items-center justify-center rounded-full bg-zinc-800 text-xs font-bold text-zinc-300">
                {s.step}
              </div>
              <h3 className="mb-1 font-semibold text-white">{s.label}</h3>
              <p className="text-sm leading-relaxed text-zinc-400">{s.detail}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Features ───────────────────────────────────────────────── */}
      <section className="mx-auto max-w-5xl px-6 pb-24 md:px-12">
        <div className="mb-12 text-center">
          <h2 className="text-2xl font-bold text-white md:text-3xl">
            Everything you need
          </h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <div
              key={f.title}
              className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6"
            >
              <div className="mb-3 text-xl text-zinc-400">{f.icon}</div>
              <h3 className="mb-2 font-semibold text-white">{f.title}</h3>
              <p className="text-sm leading-relaxed text-zinc-400">{f.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA ────────────────────────────────────────────────────── */}
      <section className="border-t border-zinc-800 py-24 text-center">
        <h2 className="mb-4 text-2xl font-bold text-white">
          Your 3D model deserves a great animation
        </h2>
        <p className="mb-8 text-zinc-400">Start for free. No credit card required.</p>
        <Link
          href="/sign-up"
          className="rounded-md bg-white px-6 py-2.5 text-sm font-semibold text-zinc-950 hover:bg-zinc-100 transition-colors"
        >
          Create an account
        </Link>
      </section>

      {/* ── Footer ─────────────────────────────────────────────────── */}
      <footer className="border-t border-zinc-800 px-6 py-8 text-center md:px-12">
        <p className="text-xs text-zinc-600">
          Animascroll · Powered by{" "}
          <span className="text-zinc-500">Three.js</span>
        </p>
      </footer>
    </div>
  );
}
