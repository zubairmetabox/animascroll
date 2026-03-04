import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Animascroll",
  description: "Create scroll-driven 3D animations. Upload any 3D model, animate with keyframes, export as interactive HTML.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
