"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import type { FC, SVGProps } from "react";
// import SongFlowDebugger from "@/app/components/SongFlowDebugger";
import { resolveLaunchParams } from "@/lib/launch-handoff";
import { buildEmbeddedGameUrl } from "@/lib/platform-launch";
import { createBridgeContext, getOrCreateInstallationId, needsCalibration, validateBridgeMessage, type BridgeContext } from "@/lib/platform-player-bridge";
import { requestFreshSongLaunchParams } from "@/lib/song-launch-client";
import { webglFlexFrameStyle, webglViewportHostStyle } from "@/lib/webgl-embed-layout";
import styles from "../student.module.css";

/* Header Icon imports */
import URIcon from "@/public/header_icons/URIcon.svg";
import PlayTab from "@/public/header_icons/play_tab.svg";
import PlayPressedTab from "@/public/header_icons/play_tab_pressed.svg";
import HomeIcon from "@/public/header_icons/Home.svg";
import MyLessonsTab from "@/public/header_icons/my_lessons_tab.svg";
import LessonBuilderTab from "@/public/header_icons/lesson_builder_tab.svg";
import ProgressTab from "@/public/header_icons/progress_tab.svg";

/* Utility Icon Imports */
import ProfileIcon from "@/public/utility_icons/profile_icon.svg";

const GAME_URL =
  process.env.NEXT_PUBLIC_GAME_URL ?? "https://ultrarapidtest.netlify.app/";

type TabIcon = FC<SVGProps<SVGSVGElement>>;

type HeaderTab = {
  label: string;
  href: string;
  Icon: TabIcon;
  width: number;
};

type UtilityTab = {
  label: string;
  href: string;
  Icon: TabIcon;
  width: number;
};

type GameEmbedPageProps = {
  navBasePath?: string;
};

function getEmbeddedGameUrl(searchParams: Pick<URLSearchParams, "get">) {
  return buildEmbeddedGameUrl(GAME_URL, resolveLaunchParams(searchParams));
}

function getTopTabs(navBasePath = "/student"): HeaderTab[] {
  return [
    { label: "Home", href: navBasePath, Icon: HomeIcon, width: 99 },
    {
      label: "My Lessons",
      href: `${navBasePath}/lessons`,
      Icon: MyLessonsTab,
      width: 139,
    },
    {
      label: "Lesson Builder",
      href: `${navBasePath}/song-choice`,
      Icon: LessonBuilderTab,
      width: 159,
    },
    {
      label: "Progress",
      href: `${navBasePath}/progress`,
      Icon: ProgressTab,
      width: 120,
    },
        {
      label: "Play",
      href: `${navBasePath}/game`,
      Icon: PlayTab,
      width: 99,
    },
  ];
}

const utilityTabs: UtilityTab[] = [
  { label: "Profile", href: "/student/profile", Icon: ProfileIcon, width: 134.45 },
];

const pagePanelWidth = "92vw";
const headerBackgroundColor = "#2B2B2B";
const pageBackgroundColor = "#191919";
const subtleBorderColor = "#FFFFFF14";
const textColor = "#FFFFFF";

function HeaderBar({
  pathname,
  topTabs,
}: {
  pathname: string;
  topTabs: HeaderTab[];
}) {
  return (
    <header
      style={{
        background: headerBackgroundColor,
        width: "100%",
        boxSizing: "border-box",
        height: 70,
        border: "none",
        borderBottom: `1px solid ${subtleBorderColor}`,
        borderRadius: 0,
        display: "flex",
        alignItems: "center",
        overflow: "visible",
      }}
    >
      <div
        style={{
          width: pagePanelWidth,
          height: "100%",
          margin: "0 auto",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 24,
          flexWrap: "nowrap",
          overflow: "visible",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 28,
            flexWrap: "nowrap",
            minWidth: 0,
            overflow: "visible",
          }}
        >
          <div
            style={{
              width: 164,
              height: 35,
              display: "inline-flex",
              alignItems: "center",
              flexShrink: 0,
              overflow: "visible",
            }}
          >
            <URIcon
              aria-label="UltraRapid"
              style={{
                width: 156,
                height: 35,
                display: "block",
                flexShrink: 0,
                overflow: "visible",
              }}
            />
          </div>

          <nav
            aria-label="Student navigation"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              flexWrap: "nowrap",
              minWidth: 0,
              overflow: "visible",
            }}
          >
            {topTabs.map((tab) => {
const cleanTabHref = tab.href.split("?")[0];
const isHomeTab = tab.label === "Home";
const isPlayTab = tab.label === "Play";
const isLessonBuilderTab = tab.label === "Lesson Builder";

const lessonBuilderPath = cleanTabHref.replace(
  "/song-choice",
  "/lesson-builder",
);

const isActive =
  pathname === cleanTabHref ||
  (isLessonBuilderTab &&
    (pathname === lessonBuilderPath ||
      pathname.startsWith(`${lessonBuilderPath}/`))) ||
  (!isHomeTab &&
    !isPlayTab &&
    !isLessonBuilderTab &&
    cleanTabHref !== "/" &&
    pathname.startsWith(`${cleanTabHref}/`));

              const Icon = isPlayTab && isActive ? PlayPressedTab : tab.Icon;

              return (
                <Link
                  key={tab.label}
                  href={tab.href}
                  aria-label={tab.label}
                  className={`${styles.headerTabButton} ${
                    isActive ? styles.headerTabButtonActive : ""
                  }`}
                  style={{
                    width: tab.width,
                    height: 45.5,
                    opacity: 1,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Icon
                    style={{
                      width: tab.width,
                      height: 45.5,
                      display: "block",
                    }}
                  />
                </Link>
              );
            })}
          </nav>
        </div>

        <div
          style={{
            display: "flex",
            gap: 6,
            flexWrap: "nowrap",
            marginLeft: "auto",
            alignItems: "center",
            flexShrink: 0,
            overflow: "visible",
          }}
        >
          {utilityTabs.map((tab) => (
            <Link
              key={tab.label}
              href={tab.href}
              aria-label={tab.label}
              className={styles.utilityButton}
              style={{
                width: tab.width,
                height: 38,
              }}
            >
              <tab.Icon
                style={{
                  width: tab.width,
                  height: 38,
                  display: "block",
                }}
              />
            </Link>
          ))}

          <a
            href="/auth/logout"
            aria-label="Log out"
            className={`${styles.utilityButton} ${styles.logoutButton}`}
          >
            Log out
          </a>
        </div>
      </div>
    </header>
  );
}

export default function GameEmbedPage({
  navBasePath = "/student",
}: GameEmbedPageProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [launchParams, setLaunchParams] = useState<URLSearchParams | null>(null);
  const [launchPreparationError, setLaunchPreparationError] = useState("");
  const [bridgeContext, setBridgeContext] = useState<BridgeContext | null>(null);
  const [calibrationStatus, setCalibrationStatus] = useState<"loading" | "required" | "ready">("loading");
  const [completedRun, setCompletedRun] = useState<{ completedEvents: number; hitAttempts: number } | null>(null);

  const topTabs = getTopTabs(navBasePath);
  const serializedSearchParams = searchParams.toString();

  useEffect(() => {
    let cancelled = false;
    const originalParams = new URLSearchParams(serializedSearchParams);
    const songAssetId = originalParams.get("songAssetId");
    const activityKey = originalParams.get("activityKey");

    queueMicrotask(() => {
      if (!cancelled) {
        setLaunchParams(null);
        setLaunchPreparationError("");
      }
    });
    if (!songAssetId || !activityKey) {
      queueMicrotask(() => {
        if (!cancelled) setLaunchParams(originalParams);
      });
      return () => { cancelled = true; };
    }

    requestFreshSongLaunchParams({
      songAssetId,
      activityKey,
      authorId: originalParams.get("authorId"),
      revision: originalParams.get("revision"),
      rhythmDifficultyKey: originalParams.get("rhythmDifficultyKey") as "EasySingle" | "MediumSingle" | "HardSingle" | "ExpertSingle" | null ?? undefined,
      learningDifficultyKey: originalParams.get("learningDifficultyKey"),
      refreshLaunchAttemptId: originalParams.get("launchAttemptId"),
    })
      .then((freshLaunchParams) => {
        if (!cancelled) setLaunchParams(freshLaunchParams);
      })
      .catch((error) => {
        if (!cancelled) {
          setLaunchPreparationError(error instanceof Error ? error.message : "Unable to prepare the game files.");
        }
      });

    return () => { cancelled = true; };
  }, [serializedSearchParams]);

  useEffect(() => {
    const receiptRaw = launchParams?.get("receipt");
    if (!receiptRaw) {
      queueMicrotask(() => setCalibrationStatus("ready"));
      queueMicrotask(() => setBridgeContext(null));
      return;
    }
    try {
      const receipt = JSON.parse(receiptRaw);
      const installationId = getOrCreateInstallationId(window.localStorage);
      const context = createBridgeContext(receipt, GAME_URL, installationId);
      queueMicrotask(() => setBridgeContext(context));
      fetch(`/api/player-calibration?installationId=${encodeURIComponent(installationId)}`)
        .then((response) => response.ok ? response.json() : null)
        .then((calibration) => setCalibrationStatus(needsCalibration(calibration) ? "required" : "ready"))
        .catch(() => setCalibrationStatus("required"));
    } catch {
      queueMicrotask(() => setCalibrationStatus("required"));
    }
  }, [launchParams]);

  useEffect(() => {
    if (!bridgeContext) return;

    const launchAttemptId = bridgeContext.receipt.launchAttemptId;
    if (launchAttemptId) {
      fetch(`/api/player-outcomes?launchAttemptId=${encodeURIComponent(launchAttemptId)}`)
        .then((response) => response.ok ? response.json() : null)
        .then((stored) => {
          if (stored?.outcome?.outcome === "completed") {
            setCompletedRun({
              completedEvents: stored.outcome.completedEvents,
              hitAttempts: stored.outcome.hitAttempts,
            });
          }
        })
        .catch(() => undefined);
    }

    const onMessage = (event: MessageEvent) => {
      if (event.source !== iframeRef.current?.contentWindow) return;
      if (event.origin !== bridgeContext.origin) return;
      const result = validateBridgeMessage(event.data, bridgeContext);
      if (!result.ok) return;
      if (result.message.type === "calibration-complete") {
        fetch("/api/player-calibration", {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ installationId: bridgeContext.installationId, offsetMs: result.message.offsetMs, protocolVersion: result.message.protocolVersion }),
        }).then((response) => { if (response.ok) setCalibrationStatus("ready"); });
      } else if (result.message.type === "run-complete") {
        const completion = result.message.completion;
        fetch("/api/player-outcomes", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            receipt: result.message.receipt,
            completion,
          }),
        }).then((response) => {
          if (!response.ok) return;
          if (completion.outcome === "completed") {
            setCompletedRun({
              completedEvents: completion.completedEvents,
              hitAttempts: completion.hitAttempts,
            });
          }
        }).catch(() => undefined);
      } else {
        window.location.assign(`${navBasePath}/song-choice`);
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [bridgeContext, navBasePath]);

  const embeddedGameUrl = useMemo(() => {
    const params = new URLSearchParams(launchParams?.toString() ?? "");
    if (bridgeContext) {
      params.set("bridgeNonce", bridgeContext.nonce);
      params.set("installationId", bridgeContext.installationId);
      params.set("requiresCalibration", String(calibrationStatus === "required"));
      params.set("calibrationProtocolVersion", String(bridgeContext.protocolVersion));
      params.set("platformOrigin", window.location.origin);
    }
    return getEmbeddedGameUrl(params);
  }, [launchParams, bridgeContext, calibrationStatus]);

  return (
    <div
      className={styles.studentTypography}
      style={{
        ...webglViewportHostStyle,
        background: pageBackgroundColor,
        color: textColor,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <HeaderBar pathname={pathname} topTabs={topTabs} />

      <main
          style={{
            width: "100%",
            flex: 1,
            minHeight: 0,
            background: pageBackgroundColor,
            display: "flex",
            flexDirection: "column",
        }}
      >
        <section
          style={{
            width: pagePanelWidth,
            margin: "0 auto",
            padding: "16px 0",
            boxSizing: "border-box",
            flex: 1,
            minHeight: 0,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          {launchParams ? (
            <iframe
              ref={iframeRef}
              src={embeddedGameUrl}
              title="UltraRapid Game"
              allow="fullscreen; gamepad; autoplay"
              allowFullScreen
              style={{
                ...webglFlexFrameStyle,
                border: `1px solid ${subtleBorderColor}`,
                borderRadius: 12,
                background: "#000000",
              }}
            />
          ) : (
            <div role={launchPreparationError ? "alert" : "status"} style={{ ...webglFlexFrameStyle, display: "grid", placeItems: "center", border: `1px solid ${subtleBorderColor}`, borderRadius: 12 }}>
              {launchPreparationError || "Preparing your game files…"}
            </div>
          )}
          {bridgeContext && calibrationStatus === "required" && (
            <p className="mt-2 text-sm text-white/70">Complete calibration in the game before playing.</p>
          )}
          {completedRun && (
            <p className="mt-2 text-sm text-emerald-200" role="status">
              Lesson complete: {completedRun.completedEvents} player moments finished in {completedRun.hitAttempts} hit attempts. You can return to song choice when ready.
            </p>
          )}
        </section>
      </main>

      {/* <SongFlowDebugger title="Game Launch Debugger" /> */}
    </div>
  );
}
