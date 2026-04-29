import Link from "next/link";
import { Logo } from "@/components/logo";

const features = [
  {
    title: "Talk to the AI",
    description: "Type what you want. \"Spin the model 360 degrees as I scroll\" and the AI places the keyframes. Edit or redo until it looks right.",
    icon: "✦",
  },
  {
    title: "GLB, FBX, OBJ, STL",
    description: "Works with whatever you export from Blender, Spline, Cinema 4D, or any other tool. No conversion step.",
    icon: "⬡",
  },
  {
    title: "Real keyframe timeline",
    description: "AI output lands on an actual timeline. Move keyframes, change easing, scrub to any frame. Full control.",
    icon: "◆",
  },
  {
    title: "Scroll-driven playback",
    description: "The animation plays as the visitor scrolls. Designed for product pages, portfolios, and interactive presentations.",
    icon: "↕",
  },
  {
    title: "Animation Skills",
    description: "Save techniques as reusable skills. The AI reads them automatically when your prompt matches, so it learns how you work.",
    icon: "⚡",
  },
  {
    title: "Export to HTML",
    description: "Downloads a single HTML file with Three.js and your model embedded. Drop it on any server. No dependencies.",
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
      <section className="mx-auto max-w-4xl px-6 pb-20 pt-24 text-center md:px-12 md:pt-32">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-900/60 px-3 py-1 text-xs text-zinc-400">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
          Now in beta
        </div>
        <h1 className="mb-6 text-4xl font-bold tracking-tight text-white md:text-6xl">
          Scroll-driven 3D animations,<br />
          <span className="text-zinc-400">built with AI.</span>
        </h1>
        <p className="mx-auto mb-10 max-w-xl text-base text-zinc-400 md:text-lg">
          Upload a 3D model, describe the animation you want, and get a shareable scroll-driven animation in minutes. Tweak it on a real timeline or let the AI handle it.
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
          <img
            src="/images/animascroll.png"
            alt="Animascroll editor"
            className="w-full block"
          />
        </div>
      </div>

      {/* ── How it works ────────────────────────────────────────────── */}
      <section className="mx-auto max-w-4xl px-6 pb-24 md:px-12">
        <div className="mb-12 text-center">
          <h2 className="text-2xl font-bold text-white md:text-3xl">How it works</h2>
          <p className="mt-3 text-zinc-400">Three steps from model to live animation.</p>
        </div>
        <div className="grid gap-6 sm:grid-cols-3">
          {[
            { step: "1", label: "Upload your model", detail: "Drop in a GLB, FBX, OBJ, GLTF, or STL. It loads straight into the editor." },
            { step: "2", label: "Animate it", detail: "Describe what you want and the AI writes the keyframes. Or use the timeline yourself. Or both." },
            { step: "3", label: "Share or export", detail: "Get a public URL people can scroll through, or download a standalone HTML file." },
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
          <h2 className="text-2xl font-bold text-white md:text-3xl">What you get</h2>
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
          Ready to animate?
        </h2>
        <p className="mb-8 text-zinc-400">Free to start. No credit card.</p>
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
