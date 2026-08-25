"use client";

import { useMemo } from "react";
import { useSearchParams } from "next/navigation";
// import SongFlowDebugger from "@/app/components/SongFlowDebugger";
import { resolveLaunchParams } from "@/lib/launch-handoff";
import { buildEmbeddedGameUrl } from "@/lib/platform-launch";

const GAME_URL =
  process.env.NEXT_PUBLIC_GAME_URL ?? "https://ultrarapidtest.netlify.app/";

export default function LaunchEmbedPage() {
  const searchParams = useSearchParams();

  const embeddedGameUrl = useMemo(() => {
    return buildEmbeddedGameUrl(GAME_URL, resolveLaunchParams(searchParams));
  }, [searchParams]);

  return (
    <main
      style={{
        minHeight: "100vh",
        width: "100%",
        padding: 16,
        background: "#191919",
        boxSizing: "border-box",
      }}
    >
      <iframe
        src={embeddedGameUrl}
        title="UltraRapid Game"
        allow="fullscreen; gamepad; autoplay"
        allowFullScreen
        style={{
          width: "100%",
          height: "calc(100vh - 32px)",
          minHeight: 640,
          border: "1px solid #FFFFFF14",
          borderRadius: 12,
          background: "#000000",
        }}
      />

      {/* <SongFlowDebugger title="Game Launch Debugger" /> */}
    </main>
  );
}