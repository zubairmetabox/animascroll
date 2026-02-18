import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "GLB Tool",
  description: "Drag-and-drop GLB viewer with orbit controls",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
