import type { Metadata } from "next";
import { Suspense } from "react";
import { Figtree } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { PostHogProvider, PostHogPageview } from "@/components/posthog-provider";
import "./globals.css";

const figtree = Figtree({
  subsets: ["latin"],
  weight: ["600"],
  variable: "--font-figtree",
});

export const metadata: Metadata = {
  title: "Animascroll",
  description: "Create scroll-driven 3D animations. Upload any 3D model, animate with keyframes, export as interactive HTML.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <ClerkProvider>
      <html lang="en" className={`dark ${figtree.variable}`}>
        <body>
          <PostHogProvider>
            <Suspense>
              <PostHogPageview />
            </Suspense>
            {children}
          </PostHogProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
