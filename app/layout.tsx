import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "UltraRapidPlatform",
  description: "Platform shell",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <div style={{ display: "flex", minHeight: "100vh" }}>
          
          <aside style={{ width: 220, padding: 16, borderRight: "1px solid #333" }}>
            <h3 style={{ marginTop: 0 }}>Platform</h3>

            <nav style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <Link href="/student">Student</Link>
              <Link href="/teacher">Teacher</Link>
              <Link href="/editor">Editor</Link>
              <Link href="/launch">Launch</Link>
            </nav>
          </aside>

          <main style={{ flex: 1, padding: 24 }}>
            {children}
          </main>

        </div>
      </body>
    </html>
  );
}
