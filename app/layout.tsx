import type { Metadata } from "next";
import { Geist, Geist_Mono, Grandstander } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const grandstander = Grandstander({
  variable: "--font-grandstander",
  subsets: ["latin"],
  weight: ["700"],
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
        className={`${geistSans.variable} ${geistMono.variable} ${grandstander.variable} antialiased`}
      >
        {children}
        <Analytics />
      </body>
    </html>
  );
}