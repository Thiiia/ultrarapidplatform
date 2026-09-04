import type { Metadata } from "next";
import { Geist, Geist_Mono, Grandstander } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import GlobalSiteMusic from "@/app/GlobalSiteMusic";
import { getStorageSignedUrl } from "@/lib/storage-media";

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

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const siteMusicUrl = await getStorageSignedUrl(
    "Songs",
    "Lofries _New_Orleanz_title.mp3",
  );

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
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${grandstander.variable} antialiased`}
      >
        {children}
        <GlobalSiteMusic src={siteMusicUrl} />
        <Analytics />
      </body>
    </html>
  );
}