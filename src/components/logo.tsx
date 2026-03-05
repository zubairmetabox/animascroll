/**
 * Logo — single source of truth for the Animascroll brand mark.
 *
 * variant="light"  → white mark + white wordmark  (use on dark backgrounds)
 * variant="dark"   → dark mark  + dark wordmark   (use on light backgrounds)
 *
 * To update the logo: replace /public/logo-mark.svg (light) or
 * /public/logo-mark-dark.svg (dark) and the wordmark text below.
 */
import Link from "next/link";

interface LogoProps {
  /** "light" = white logo for dark backgrounds (default).
   *  "dark"  = dark logo for light backgrounds. */
  variant?: "light" | "dark";
  /** Show the "ANIMASCROLL" wordmark next to the mark. Default true. */
  withWordmark?: boolean;
  /** If provided, the logo is wrapped in a Next.js Link. */
  href?: string;
  /** Tailwind height class for the mark image, e.g. "h-4" or "h-6". Default "h-5". */
  markHeight?: string;
  className?: string;
}

export function Logo({
  variant = "light",
  withWordmark = true,
  href,
  markHeight = "h-5",
  className = "",
}: LogoProps) {
  const markSrc = variant === "light" ? "/logo-mark.svg" : "/logo-mark-dark.svg";
  const wordmarkColor = variant === "light" ? "text-white" : "text-zinc-900";

  const inner = (
    <span className={`inline-flex items-center gap-2 select-none ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={markSrc} alt="Animascroll" className={`${markHeight} w-auto`} />
      {withWordmark && (
        <span
          className={`text-sm font-semibold uppercase tracking-widest ${wordmarkColor}`}
          style={{ fontFamily: "var(--font-figtree, sans-serif)" }}
        >
          Animascroll
        </span>
      )}
    </span>
  );

  if (href) {
    return (
      <Link href={href} className="inline-flex items-center">
        {inner}
      </Link>
    );
  }
  return inner;
}
