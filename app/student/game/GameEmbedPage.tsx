"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import type { FC, SVGProps } from "react";
// import SongFlowDebugger from "@/app/components/SongFlowDebugger";
import { resolveLaunchParams } from "@/lib/launch-handoff";
import { buildEmbeddedGameUrl } from "@/lib/platform-launch";
import { createBridgeContext, getOrCreateInstallationId, needsCalibration, validateBridgeMessage, type BridgeContext } from "@/lib/platform-player-bridge";
import { getSongLaunchErrorMessage } from "@/lib/song-choice-flow";
import { requestFreshSongLaunchParams } from "@/lib/song-launch-client";
import { studentCopy } from "@/lib/student-copy";
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

type CompletionSummary = {
  outcome: "completed" | "failed" | "abandoned" | "cancelled";
  completedEvents: number;
  hitAttempts: number;
};

type PendingOutcome = {
  receipt: BridgeContext["receipt"];
  completion: CompletionSummary;
};

type GameEmbedSessionProps = GameEmbedPageProps & {
  pathname: string;
  serializedSearchParams: string;
  onRetry: () => void;
};

function getEmbeddedGameUrl(searchParams: Pick<URLSearchParams, "get">) {
  return buildEmbeddedGameUrl(GAME_URL, resolveLaunchParams(searchParams));
}

function getTopTabs(navBasePath = "/student"): HeaderTab[] {
  return [
    { label: "Home", href: navBasePath, Icon: HomeIcon, width: 99 },
    {
      label: studentCopy.navigation.lessons,
      href: `${navBasePath}/lessons`,
      Icon: MyLessonsTab,
      width: 139,
    },
    {
      label: studentCopy.navigation.builder,
      href: `${navBasePath}/song-choice`,
      Icon: LessonBuilderTab,
      width: 159,
    },
    {
      label: studentCopy.navigation.progress,
      href: `${navBasePath}/progress`,
      Icon: ProgressTab,
      width: 120,
    },
        {
      label: studentCopy.navigation.play,
      href: `${navBasePath}/game`,
      Icon: PlayTab,
      width: 99,
    },
  ];
}

function getUtilityTabs(navBasePath = "/student"): UtilityTab[] {
  return [
    {
      label: "Profile",
      href: navBasePath === "/demo/student" ? `${navBasePath}/profile` : "/student/profile",
      Icon: ProfileIcon,
      width: 134.45,
    },
  ];
}

const pagePanelWidth = "92vw";
const headerBackgroundColor = "#2B2B2B";
const pageBackgroundColor = "#191919";
const subtleBorderColor = "#FFFFFF14";
const textColor = "#FFFFFF";

function HeaderBar({
  pathname,
  topTabs,
  utilityTabs,
}: {
  pathname: string;
  topTabs: HeaderTab[];
  utilityTabs: UtilityTab[];
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
const isLessonBuilderTab = tab.label === studentCopy.navigation.builder;

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
  const [retryNonce, setRetryNonce] = useState(0);
  const serializedSearchParams = searchParams.toString();

  return (
    <GameEmbedSession
      key={`${serializedSearchParams}:${retryNonce}`}
      navBasePath={navBasePath}
      pathname={pathname}
      serializedSearchParams={serializedSearchParams}
      onRetry={() => setRetryNonce((current) => current + 1)}
    />
  );
}

function GameEmbedSession({
  navBasePath = "/student",
  pathname,
  serializedSearchParams,
  onRetry,
}: GameEmbedSessionProps) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [launchParams, setLaunchParams] = useState<URLSearchParams | null>(null);
  const [launchPreparationError, setLaunchPreparationError] = useState("");
  const [calibrationStatus, setCalibrationStatus] = useState<"loading" | "required" | "ready">("loading");
  const [completedRun, setCompletedRun] = useState<{ completedEvents: number; hitAttempts: number } | null>(null);
  const [bridgeStatusMessage, setBridgeStatusMessage] = useState("");
  const [pendingOutcome, setPendingOutcome] = useState<PendingOutcome | null>(null);
  const [outcomeSyncState, setOutcomeSyncState] = useState<"idle" | "saving" | "saved" | "failed">("idle");
  const outcomeKeyRef = useRef("");

  const topTabs = getTopTabs(navBasePath);
  const utilityTabs = getUtilityTabs(navBasePath);
  const resolvedParams = useMemo(
    () => resolveLaunchParams(new URLSearchParams(serializedSearchParams)),
    [serializedSearchParams],
  );
  const songAssetId = resolvedParams.get("songAssetId");
  const activityKey = resolvedParams.get("activityKey");
  const needsSongChoice = resolvedParams.size === 0;
  const activeLaunchParams = launchParams ?? (
    !songAssetId || !activityKey ? resolvedParams : null
  );
  const bridgeSetup = useMemo(() => {
    const receiptRaw = activeLaunchParams?.get("receipt");
    if (!receiptRaw || typeof window === "undefined") {
      return { context: null, error: "" };
    }

    try {
      const receipt = JSON.parse(receiptRaw);
      const installationId = getOrCreateInstallationId(window.localStorage);
      return {
        context: createBridgeContext(receipt, GAME_URL, installationId),
        error: "",
      };
    } catch {
      return {
        context: null,
        error: studentCopy.game.handoffError,
      };
    }
  }, [activeLaunchParams]);
  const bridgeContext = bridgeSetup.context;

  useEffect(() => {
    let cancelled = false;

    if (!songAssetId || !activityKey) {
      return () => { cancelled = true; };
    }

    requestFreshSongLaunchParams({
      songAssetId,
      activityKey,
      authorId: resolvedParams.get("authorId"),
      revision: resolvedParams.get("revision"),
      rhythmDifficultyKey: resolvedParams.get("rhythmDifficultyKey") as "EasySingle" | "MediumSingle" | "HardSingle" | "ExpertSingle" | null ?? undefined,
      learningDifficultyKey: resolvedParams.get("learningDifficultyKey"),
      refreshLaunchAttemptId: resolvedParams.get("launchAttemptId"),
    })
      .then((freshLaunchParams) => {
        if (!cancelled) setLaunchParams(freshLaunchParams);
      })
      .catch((error) => {
        if (!cancelled) {
          setLaunchPreparationError(getSongLaunchErrorMessage(error));
        }
      });

    return () => { cancelled = true; };
  }, [activityKey, resolvedParams, serializedSearchParams, songAssetId]);

  useEffect(() => {
    let cancelled = false;
    if (!bridgeContext) {
      return () => { cancelled = true; };
    }

    fetch(`/api/player-calibration?installationId=${encodeURIComponent(bridgeContext.installationId)}`)
      .then((response) => response.ok ? response.json() : null)
      .then((calibration) => {
        if (!cancelled) setCalibrationStatus(needsCalibration(calibration) ? "required" : "ready");
      })
      .catch(() => {
        if (!cancelled) setCalibrationStatus("required");
      });
    return () => { cancelled = true; };
  }, [bridgeContext]);

  useEffect(() => {
    if (!bridgeContext) return;

    let cancelled = false;
    const launchAttemptId = bridgeContext.receipt.launchAttemptId;
    if (launchAttemptId) {
      fetch(`/api/player-outcomes?launchAttemptId=${encodeURIComponent(launchAttemptId)}`)
        .then((response) => response.ok ? response.json() : null)
        .then((stored) => {
          if (!cancelled && stored?.outcome?.outcome === "completed") {
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
        }).then((response) => {
          if (cancelled) return;
          if (response.ok) {
            setCalibrationStatus("ready");
            setBridgeStatusMessage("");
          } else {
            setBridgeStatusMessage(studentCopy.game.calibrationSaveFailed);
          }
        }).catch(() => {
          if (!cancelled) setBridgeStatusMessage(studentCopy.game.calibrationSaveFailed);
        });
      } else if (result.message.type === "run-complete") {
        const completion = result.message.completion;
        const outcomeKey = `${result.message.receipt.launchAttemptId}:${completion.outcome}:${completion.completedEvents}:${completion.hitAttempts}`;
        if (outcomeKeyRef.current === outcomeKey) return;
        outcomeKeyRef.current = outcomeKey;
        setOutcomeSyncState("saving");
        setPendingOutcome({ receipt: result.message.receipt, completion });
      } else {
        window.location.assign(`${navBasePath}/song-choice`);
      }
    };
    window.addEventListener("message", onMessage);
    return () => {
      cancelled = true;
      window.removeEventListener("message", onMessage);
    };
  }, [bridgeContext, navBasePath]);

  useEffect(() => {
    if (!pendingOutcome) return;

    let cancelled = false;
    fetch("/api/player-outcomes", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(pendingOutcome),
    })
      .then((response) => {
        if (!response.ok) throw new Error("outcome sync failed");
        if (cancelled) return;
        setOutcomeSyncState("saved");
        if (pendingOutcome.completion.outcome === "completed") {
          setCompletedRun({
            completedEvents: pendingOutcome.completion.completedEvents,
            hitAttempts: pendingOutcome.completion.hitAttempts,
          });
        }
        setPendingOutcome(null);
      })
      .catch(() => {
        if (!cancelled) {
          setOutcomeSyncState("failed");
          setBridgeStatusMessage(studentCopy.game.resultSyncFailed);
        }
      });

    return () => { cancelled = true; };
  }, [pendingOutcome]);

  const embeddedGameUrl = useMemo(() => {
    const params = new URLSearchParams(activeLaunchParams?.toString() ?? "");
    if (bridgeContext) {
      params.set("bridgeNonce", bridgeContext.nonce);
      params.set("installationId", bridgeContext.installationId);
      params.set("requiresCalibration", String(calibrationStatus === "required"));
      params.set("calibrationProtocolVersion", String(bridgeContext.protocolVersion));
      params.set("platformOrigin", window.location.origin);
    }
    return getEmbeddedGameUrl(params);
  }, [activeLaunchParams, bridgeContext, calibrationStatus]);

  const canRenderEmbeddedGame = Boolean(
    activeLaunchParams &&
    (!activeLaunchParams.get("receipt") || (bridgeContext && calibrationStatus !== "loading")),
  );
  const launchErrorMessage = launchPreparationError || bridgeSetup.error;

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
      <HeaderBar pathname={pathname} topTabs={topTabs} utilityTabs={utilityTabs} />

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
          {canRenderEmbeddedGame ? (
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
            <div role={launchErrorMessage ? "alert" : "status"} style={{ ...webglFlexFrameStyle, display: "grid", placeItems: "center", border: `1px solid ${subtleBorderColor}`, borderRadius: 12, padding: 24, boxSizing: "border-box", textAlign: "center" }}>
              <div style={{ display: "grid", gap: 14, justifyItems: "center", maxWidth: 460 }}>
                <strong>{launchErrorMessage ? studentCopy.game.prepareErrorTitle : needsSongChoice ? studentCopy.game.chooseSongTitle : studentCopy.game.preparingTitle}</strong>
                <span style={{ color: "#FFFFFFB3", lineHeight: 1.45 }}>
                  {launchErrorMessage || (needsSongChoice ? studentCopy.game.chooseSongBody : studentCopy.game.preparingBody)}
                </span>
                {launchErrorMessage ? (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 10, justifyContent: "center" }}>
                    {launchPreparationError && (
                      <button type="button" onClick={onRetry} style={{ border: "none", borderRadius: 999, background: "#CFFF04", color: "#071222", padding: "10px 18px", fontWeight: 800, cursor: "pointer" }}>
                        Try again
                      </button>
                    )}
                    <Link href={`${navBasePath}/song-choice`} style={{ border: `1px solid ${subtleBorderColor}`, borderRadius: 999, color: "#FFFFFF", padding: "9px 16px", textDecoration: "none", fontWeight: 700 }}>
                      {studentCopy.game.chooseAnotherSong}
                    </Link>
                  </div>
                ) : needsSongChoice ? (
                  <Link href={`${navBasePath}/song-choice`} style={{ border: "none", borderRadius: 999, background: "#CFFF04", color: "#071222", padding: "10px 18px", textDecoration: "none", fontWeight: 800 }}>
                    {studentCopy.game.chooseSong}
                  </Link>
                ) : null}
              </div>
            </div>
          )}
          {bridgeContext && calibrationStatus === "required" && (
            <p className="mt-2 text-sm text-white/70">{studentCopy.game.calibrationRequired}</p>
          )}
          {bridgeStatusMessage && (
            <p className="mt-2 text-sm text-amber-200" role="alert">{bridgeStatusMessage}</p>
          )}
          {pendingOutcome && outcomeSyncState === "saving" && (
            <p className="mt-2 text-sm text-white/70" role="status">{studentCopy.game.savingResult}</p>
          )}
          {pendingOutcome && outcomeSyncState === "failed" && (
            <p className="mt-2 text-sm text-amber-200" role="alert">
              <button
                type="button"
                onClick={() => {
                  setOutcomeSyncState("saving");
                  setPendingOutcome((current) => current ? { ...current } : current);
                }}
                style={{ marginRight: 6, border: 0, borderRadius: 999, background: "#CFFF04", color: "#071222", padding: "5px 10px", fontWeight: 800, cursor: "pointer" }}
              >
                {studentCopy.game.syncAgain}
              </button>
              {studentCopy.game.waitingToSave}
            </p>
          )}
          {completedRun && (
            <p className="mt-2 text-sm text-emerald-200" role="status">
              {studentCopy.game.lessonComplete(completedRun.completedEvents, completedRun.hitAttempts)} {studentCopy.game.returnToSongs}
            </p>
          )}
        </section>
      </main>

      {/* <SongFlowDebugger title="Game Launch Debugger" /> */}
    </div>
  );
}
