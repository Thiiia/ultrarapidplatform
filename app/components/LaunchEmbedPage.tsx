"use client";

import { useMemo } from "react";
import { useSearchParams } from "next/navigation";
// import SongFlowDebugger from "@/app/components/SongFlowDebugger";
import { resolveLaunchParams } from "@/lib/launch-handoff";
import { buildEmbeddedGameUrl } from "@/lib/platform-launch";

const GAME_URL =
  process.env.NEXT_PUBLIC_GAME_URL ?? "https://ultrarapidtest.netlify.app/";

export default function LaunchEmbedPage({ videoUrl }: { videoUrl: string | null }) {
  const searchParams = useSearchParams();

  const embeddedGameUrl = useMemo(() => {
    return buildEmbeddedGameUrl(GAME_URL, resolveLaunchParams(searchParams));
  }, [searchParams]);

  return (
    <main
      style={{
        position: "relative",
        width: "100%",
        minHeight: "100vh",
        overflowX: "hidden",
        background: "#05070A",
        boxSizing: "border-box",
      }}
    >
      {videoUrl ? (
        <video
          src={videoUrl}
          autoPlay
          muted
          loop
          playsInline
          aria-hidden="true"
          tabIndex={-1}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            opacity: 0.22,
            pointerEvents: "none",
          }}
        />
      ) : null}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          background: "rgba(5, 7, 10, 0.62)",
          pointerEvents: "none",
        }}
      />
      <div
        style={{
          position: "relative",
          zIndex: 1,
          width: "100%",
          minHeight: "100vh",
          padding: 16,
          boxSizing: "border-box",
          display: "flex",
          alignItems: "stretch",
          justifyContent: "center",
        }}
      >
        <iframe
          src={embeddedGameUrl}
          title="UltraRapid Game"
          allow="fullscreen; gamepad; autoplay"
          allowFullScreen
          style={{
            width: "min(100%, 1440px)",
            height: "calc(100vh - 32px)",
            minHeight: 640,
            border: "1px solid #FFFFFF14",
            borderRadius: 12,
            background: "#000000",
          }}
        />
      </div>
    </main>
  );
}
