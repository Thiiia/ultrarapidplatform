import "./globals.css";
import type { Metadata } from "next";
import { Suspense } from "react";
import {
  Dela_Gothic_One,
  Geist_Mono,
  Grandstander,
  Space_Grotesk,
} from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import SiteMusicLoader from "@/app/SiteMusicLoader";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const delaGothicOne = Dela_Gothic_One({
  variable: "--font-dela-gothic",
  subsets: ["latin"],
  weight: "400",
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
      <head>
        <link rel="preconnect" href="https://player.vimeo.com" />
        <link rel="preconnect" href="https://i.vimeocdn.com" />
        <link rel="preconnect" href="https://f.vimeocdn.com" />
        <link rel="dns-prefetch" href="https://player.vimeo.com" />
        <link rel="dns-prefetch" href="https://i.vimeocdn.com" />
        <link rel="dns-prefetch" href="https://f.vimeocdn.com" />
      </head>
      <body className={`${spaceGrotesk.variable} ${delaGothicOne.variable} ${geistMono.variable} ${grandstander.variable} antialiased`}>
        {children}
        <Suspense fallback={null}>
          <SiteMusicLoader />
        </Suspense>
        <Analytics />
      </body>
    </html>
  );
}
