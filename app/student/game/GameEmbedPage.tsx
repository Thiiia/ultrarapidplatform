"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FC, SVGProps } from "react";
// import SongFlowDebugger from "@/app/components/SongFlowDebugger";
import { persistLaunchParams, resolveEmbeddedCalibrationLaunchSnapshot, resolveLaunchParams, type EmbeddedCalibrationLaunchSnapshot } from "@/lib/launch-handoff";
import { buildEmbeddedGameUrl } from "@/lib/platform-launch";
import { createBridgeContext, getOrCreateInstallationId, parseCalibrationState, validateBridgeMessage, type BridgeContext, type CalibrationState, type PlatformPlayerCompletion } from "@/lib/platform-player-bridge";
import { PlayerRunOutcomeBarrier } from "@/lib/player-run-outcome-barrier";
import { clearPendingPlayerOutcome, getPendingPlayerOutcome, rememberPendingPlayerOutcome, type PendingPlayerOutcome } from "@/lib/pending-player-outcome-store";
import { parseStoredPlayerOutcome, recoverPendingPlayerOutcome, recoverRoutePlayerOutcome } from "@/lib/pending-player-outcome-recovery";
import { demoCalibrationStorageKey } from "@/lib/player-calibration-reset";
import { getSongLaunchErrorMessage } from "@/lib/song-choice-flow";
import { requestFreshSongLaunchParams, SongLaunchRequestError } from "@/lib/song-launch-client";
import { getUnityGameUrl } from "@/lib/unity-game-url";
import { studentCopy } from "@/lib/student-copy";
import ExperienceMobileNavigation from "@/app/components/ExperienceMobileNavigation";
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

const GAME_URL = getUnityGameUrl();
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

type CompletionSummary = PlatformPlayerCompletion;

type PendingOutcome = PendingPlayerOutcome;

type GameEmbedRetryRequest = {
  freshAttempt?: boolean;
  launchSearchParams?: string | null;
};

type DeferredGameEmbedAction =
  | { type: "retry"; request: GameEmbedRetryRequest }
  | { type: "return"; receipt: BridgeContext["receipt"] };

type GameEmbedSessionProps = GameEmbedPageProps & {
  pathname: string;
  serializedSearchParams: string;
  onRetry: (request?: GameEmbedRetryRequest) => void;
};

function getEmbeddedGameUrl(searchParams: Pick<URLSearchParams, "get">) {
  return buildEmbeddedGameUrl(GAME_URL, resolveLaunchParams(searchParams));
}

async function readExistingPlayerOutcome(launchAttemptId: string) {
  const response = await fetch(`/api/player-outcomes?launchAttemptId=${encodeURIComponent(launchAttemptId)}`, {
    cache: "no-store",
  });
  if (!response.ok) return { ok: false };
  const stored = await response.json().catch(() => null);
  return { ok: true, outcome: stored?.outcome ?? null };
}

async function refreshPendingPlayerAttempt(pending: PendingOutcome) {
  const receipt = pending.receipt;
  const freshLaunchParams = await requestFreshSongLaunchParams({
    songAssetId: receipt.songAssetId,
    activityKey: receipt.activityKey,
    authorId: receipt.authorId,
    revision: receipt.revision,
    rhythmDifficultyKey: receipt.rhythmDifficultyKey,
    learningDifficultyKey: receipt.learningDifficultyKey,
    refreshLaunchAttemptId: receipt.launchAttemptId,
  });
  let refreshedReceipt: unknown = null;
  try {
    const rawReceipt = freshLaunchParams.get("receipt");
    refreshedReceipt = rawReceipt ? JSON.parse(rawReceipt) : null;
  } catch {
    refreshedReceipt = null;
  }
  return { receipt: refreshedReceipt, value: null };
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
const headerBackgroundColor = "var(--ur-canvas-top)";
const pageBackgroundColor = "var(--ur-canvas-deep)";
const subtleBorderColor = "#FFFFFF14";
const textColor = "var(--ur-text-marketing)";

function HeaderBar({
  pathname,
  topTabs,
  utilityTabs,
}: {
  pathname: string;
  topTabs: HeaderTab[];
  utilityTabs: UtilityTab[];
}) {
  const mobileItems = [
    ...topTabs.map((tab) => ({
      label: tab.label,
      href: tab.href,
      current: pathname === tab.href,
    })),
    ...utilityTabs.map((tab) => ({
      label: tab.label,
      href: tab.href,
      current: pathname === tab.href,
    })),
    { label: studentCopy.navigation.logout, href: "/auth/logout", current: false },
  ];
  return (
    <header
      className={`${styles.gameEmbedHeader} experience-role-header experience-role-header--wide-nav`}
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
        className="experience-role-header-inner"
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
          className="experience-role-brand-group"
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
            className="experience-navigation experience-desktop-navigation"
            data-experience-component="navigation"
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
                  aria-current={isActive ? "page" : undefined}
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
          className="experience-role-utilities"
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
        <ExperienceMobileNavigation items={mobileItems} label="Student" />
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
  const [retrySearchParams, setRetrySearchParams] = useState<{
    originalSearchParams: string;
    searchParams: string;
  } | null>(null);
  const serializedSearchParams = searchParams.toString();
  const sessionSearchParams = retrySearchParams?.originalSearchParams === serializedSearchParams
    ? retrySearchParams.searchParams
    : serializedSearchParams;
  const retry = useCallback((request?: GameEmbedRetryRequest) => {
    const nextSearchParams = new URLSearchParams(request?.launchSearchParams ?? sessionSearchParams);
    if (request?.freshAttempt) nextSearchParams.delete("launchAttemptId");
    setRetrySearchParams({
      originalSearchParams: serializedSearchParams,
      searchParams: nextSearchParams.toString(),
    });
    setRetryNonce((current) => current + 1);
  }, [serializedSearchParams, sessionSearchParams]);

  return (
    <GameEmbedSession
      key={`${serializedSearchParams}:${retryNonce}`}
      navBasePath={navBasePath}
      pathname={pathname}
      serializedSearchParams={sessionSearchParams}
      onRetry={retry}
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
  const [calibration, setCalibration] = useState<CalibrationState | null>(null);
  const [iframeCalibrationLaunchState, setIframeCalibrationLaunchState] = useState<{
    bridgeNonce: string;
    snapshot: EmbeddedCalibrationLaunchSnapshot;
  } | null>(null);
  const [completedRun, setCompletedRun] = useState<Pick<CompletionSummary, "completedEvents" | "requiredEvents" | "solvedSets" | "hitAttempts"> | null>(null);
  const [recoveredOutcome, setRecoveredOutcome] = useState(false);
  const [bridgeStatusMessage, setBridgeStatusMessage] = useState("");
  const [pendingOutcome, setPendingOutcome] = useState<PendingOutcome | null>(null);
  const [outcomeRecoveryBlocked, setOutcomeRecoveryBlocked] = useState(false);
  const [outcomeLookupSettledAttemptId, setOutcomeLookupSettledAttemptId] = useState<string | null>(null);
  const [outcomeSyncState, setOutcomeSyncState] = useState<"idle" | "saving" | "saved" | "failed">("idle");
  const [returnSyncState, setReturnSyncState] = useState<"idle" | "saving" | "failed">("idle");
  const returnReceiptRef = useRef<BridgeContext["receipt"] | null>(null);
  const terminalAttemptRef = useRef(false);
  const acceptedOutcomeAttemptIdRef = useRef("");
  const recoveredOutcomeAttemptIdRef = useRef("");
  const outcomeBarrierRef = useRef(new PlayerRunOutcomeBarrier<DeferredGameEmbedAction>());
  const isDemoMode = navBasePath.startsWith("/demo/");

  const topTabs = getTopTabs(navBasePath);
  const utilityTabs = getUtilityTabs(navBasePath);
  const resolvedParams = useMemo(
    () => resolveLaunchParams(new URLSearchParams(serializedSearchParams)),
    [serializedSearchParams],
  );
  const songAssetId = resolvedParams.get("songAssetId");
  const activityKey = resolvedParams.get("activityKey");
  const needsSongChoice = !songAssetId || !activityKey;
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
        context: createBridgeContext(receipt, GAME_URL, installationId, { allowGuestReceipt: isDemoMode }),
        error: "",
      };
    } catch {
      return {
        context: null,
        error: studentCopy.game.handoffError,
      };
    }
  }, [activeLaunchParams, isDemoMode]);
  const bridgeContext = bridgeSetup.context;

  const iframeCalibrationLaunchStateMatches =
    Boolean(bridgeContext) && iframeCalibrationLaunchState?.bridgeNonce === bridgeContext?.nonce;
  const iframeCalibrationLaunchSnapshot = iframeCalibrationLaunchStateMatches
    ? iframeCalibrationLaunchState?.snapshot ?? null
    : resolveEmbeddedCalibrationLaunchSnapshot(
        null,
        bridgeContext?.nonce ?? null,
        calibrationStatus,
        calibration?.offsetMs ?? null,
      );

  if (bridgeContext && iframeCalibrationLaunchSnapshot && !iframeCalibrationLaunchStateMatches) {
    setIframeCalibrationLaunchState({
      bridgeNonce: bridgeContext.nonce,
      snapshot: iframeCalibrationLaunchSnapshot,
    });
  }

  const handleAttemptReturn = useCallback(async (receipt: BridgeContext["receipt"]) => {
    terminalAttemptRef.current = true;
    returnReceiptRef.current = receipt;
    setReturnSyncState("saving");
    if (iframeRef.current) iframeRef.current.src = "about:blank";
    try {
      const response = await fetch("/api/player-launch-attempts/return", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ receipt }),
        keepalive: true,
      });
      if (!response.ok) throw new Error("launch return sync failed");
      window.location.assign(`${navBasePath}/song-choice`);
    } catch {
      setReturnSyncState("failed");
      setBridgeStatusMessage(studentCopy.game.returnSyncFailed);
    }
  }, [navBasePath]);

  const markOutcomeSaved = useCallback((completion: CompletionSummary, launchAttemptId: string, recovered = false) => {
    try {
      clearPendingPlayerOutcome(window.localStorage, launchAttemptId);
    } catch {
      // The server result is authoritative even if browser storage is unavailable.
    }
    setOutcomeSyncState("saved");
    if (recoveredOutcomeAttemptIdRef.current === launchAttemptId) {
      recoveredOutcomeAttemptIdRef.current = "";
    }
    if (completion.outcome === "completed") {
      setCompletedRun({
        completedEvents: completion.completedEvents,
        requiredEvents: completion.requiredEvents,
        solvedSets: completion.solvedSets,
        hitAttempts: completion.hitAttempts,
      });
    }
    setRecoveredOutcome(recovered);
    setPendingOutcome(null);
    const deferredAction = outcomeBarrierRef.current.settle(launchAttemptId);
    if (deferredAction?.type === "retry") {
      onRetry(deferredAction.request);
    } else if (deferredAction?.type === "return") {
      void handleAttemptReturn(deferredAction.receipt);
    }
  }, [handleAttemptReturn, onRetry]);

  const retryPendingOutcomeSync = useCallback(async () => {
    if (!pendingOutcome) return;
    const currentPendingOutcome = pendingOutcome;
    const launchAttemptId = currentPendingOutcome.receipt.launchAttemptId;
    setOutcomeSyncState("saving");
    setBridgeStatusMessage("");

    const recovery = await recoverPendingPlayerOutcome({
      pending: currentPendingOutcome,
      readExistingOutcome: () => readExistingPlayerOutcome(launchAttemptId),
      refreshAttempt: () => refreshPendingPlayerAttempt(currentPendingOutcome),
    });
    if (recovery.kind === "already-saved") {
      const wasRecovered = recoveredOutcomeAttemptIdRef.current === launchAttemptId || !activeLaunchParams;
      markOutcomeSaved(recovery.completion, launchAttemptId, wasRecovered);
      return;
    }
    if (recovery.kind === "active") {
      setOutcomeRecoveryBlocked(false);
      setPendingOutcome((current) => current ? { ...current } : current);
      return;
    }

    setOutcomeSyncState("failed");
    setBridgeStatusMessage(studentCopy.game.resultSyncFailed);
  }, [activeLaunchParams, markOutcomeSaved, pendingOutcome]);

  useEffect(() => {
    let cancelled = false;

    if (!songAssetId || !activityKey) {
      return () => { cancelled = true; };
    }

    const refreshLaunchAttemptId = resolvedParams.get("launchAttemptId");
    let queuedOutcome: PendingOutcome | null = null;
    if (!isDemoMode && refreshLaunchAttemptId) {
      try {
        queuedOutcome = getPendingPlayerOutcome(window.localStorage, refreshLaunchAttemptId);
      } catch {
        queuedOutcome = null;
      }
    }

    const launchRequest = {
      songAssetId,
      activityKey,
      authorId: resolvedParams.get("authorId"),
      revision: resolvedParams.get("revision"),
      rhythmDifficultyKey: resolvedParams.get("rhythmDifficultyKey") as "EasySingle" | "MediumSingle" | "HardSingle" | "ExpertSingle" | null ?? undefined,
      learningDifficultyKey: resolvedParams.get("learningDifficultyKey"),
      refreshLaunchAttemptId,
    };

    const pendingToRecover = queuedOutcome;
    const prepareLaunch = async () => {
      if (pendingToRecover) {
        outcomeBarrierRef.current.begin(pendingToRecover.receipt.launchAttemptId);
        const recovery = await recoverPendingPlayerOutcome({
          pending: pendingToRecover,
          readExistingOutcome: () => readExistingPlayerOutcome(pendingToRecover.receipt.launchAttemptId),
          refreshAttempt: () => refreshPendingPlayerAttempt(pendingToRecover),
        });
        if (cancelled) return;

        if (recovery.kind === "already-saved") {
          markOutcomeSaved(recovery.completion, pendingToRecover.receipt.launchAttemptId, true);
          return;
        }

        if (recovery.kind === "active") {
          recoveredOutcomeAttemptIdRef.current = pendingToRecover.receipt.launchAttemptId;
          setCompletedRun({
            completedEvents: pendingToRecover.completion.completedEvents,
            requiredEvents: pendingToRecover.completion.requiredEvents,
            solvedSets: pendingToRecover.completion.solvedSets,
            hitAttempts: pendingToRecover.completion.hitAttempts,
          });
          setRecoveredOutcome(true);
          setOutcomeRecoveryBlocked(false);
          setLaunchPreparationError("");
          setOutcomeSyncState("saving");
          setPendingOutcome(queuedOutcome);
          return;
        }

        setOutcomeRecoveryBlocked(true);
        setOutcomeSyncState("failed");
        setLaunchPreparationError(studentCopy.game.resultSyncFailed);
        return;
      }

      const routeAttemptId = !isDemoMode ? refreshLaunchAttemptId : null;
      const recovery = await recoverRoutePlayerOutcome({
        launchAttemptId: routeAttemptId,
        readExistingOutcome: async () => {
          const existing = await readExistingPlayerOutcome(refreshLaunchAttemptId ?? "");
          if (!cancelled && existing.ok && routeAttemptId) {
            setOutcomeLookupSettledAttemptId(routeAttemptId);
          }
          return existing;
        },
        refreshAttempt: () => requestFreshSongLaunchParams(launchRequest),
        isTerminalRefreshError: (error) =>
          error instanceof SongLaunchRequestError && error.status === 409,
      });
      if (cancelled) return;

      if (recovery.kind === "already-saved") {
        if (recovery.completion.outcome === "completed") {
          setCompletedRun({
            completedEvents: recovery.completion.completedEvents,
            requiredEvents: recovery.completion.requiredEvents,
            solvedSets: recovery.completion.solvedSets,
            hitAttempts: recovery.completion.hitAttempts,
          });
        }
        setRecoveredOutcome(true);
        setOutcomeSyncState("saved");
        setOutcomeRecoveryBlocked(false);
        setLaunchPreparationError("");
        return;
      }

      if (recovery.kind === "launched") {
        setOutcomeRecoveryBlocked(false);
        persistLaunchParams(recovery.value);
        setLaunchParams(recovery.value);
        return;
      }

      setOutcomeRecoveryBlocked(false);
      setLaunchPreparationError(getSongLaunchErrorMessage(recovery.error));
    };

    void prepareLaunch();

    return () => { cancelled = true; };
  }, [activityKey, isDemoMode, markOutcomeSaved, resolvedParams, serializedSearchParams, songAssetId]);

  useEffect(() => {
    let cancelled = false;
    if (!bridgeContext) {
      return () => { cancelled = true; };
    }

    if (isDemoMode) {
      queueMicrotask(() => {
        if (cancelled) return;

        const storedCalibration = window.localStorage.getItem(
          demoCalibrationStorageKey(bridgeContext.installationId),
        );
        let parsedCalibration: CalibrationState | null = null;
        try {
          parsedCalibration = parseCalibrationState(
            storedCalibration ? JSON.parse(storedCalibration) : null,
            bridgeContext.protocolVersion,
          );
        } catch {
          parsedCalibration = null;
        }
        if (!cancelled) {
          setCalibration(parsedCalibration);
          setCalibrationStatus(parsedCalibration ? "ready" : "required");
        }
      });
      return () => { cancelled = true; };
    }

    fetch(`/api/player-calibration?installationId=${encodeURIComponent(bridgeContext.installationId)}`)
      .then((response) => response.ok ? response.json() : null)
      .then((calibration) => {
        const parsedCalibration = parseCalibrationState(calibration, bridgeContext.protocolVersion);
        if (!cancelled) {
          setCalibration(parsedCalibration);
          setCalibrationStatus(parsedCalibration ? "ready" : "required");
        }
      })
      .catch(() => {
        if (!cancelled) {
          setCalibration(null);
          setCalibrationStatus("required");
        }
      });
    return () => { cancelled = true; };
  }, [bridgeContext, isDemoMode]);

  useEffect(() => {
    if (!bridgeContext) return;

    let cancelled = false;
    const launchAttemptId = bridgeContext.receipt.launchAttemptId;
    if (!isDemoMode && launchAttemptId && outcomeLookupSettledAttemptId !== launchAttemptId) {
      void readExistingPlayerOutcome(launchAttemptId)
        .then(({ outcome }) => {
          const completion = parseStoredPlayerOutcome(launchAttemptId, outcome);
          if (!cancelled && completion) {
            if (completion.outcome === "completed") {
              setCompletedRun({
                completedEvents: completion.completedEvents,
                requiredEvents: completion.requiredEvents,
                solvedSets: completion.solvedSets,
                hitAttempts: completion.hitAttempts,
              });
            }
            setRecoveredOutcome(true);
            setOutcomeSyncState("saved");
            setOutcomeRecoveryBlocked(false);
            setLaunchPreparationError("");
          }
        })
        .catch(() => undefined)
        .finally(() => {
          if (!cancelled) setOutcomeLookupSettledAttemptId(launchAttemptId);
        });
    }

    const onMessage = (event: MessageEvent) => {
      if (cancelled || terminalAttemptRef.current) return;
      if (event.source !== iframeRef.current?.contentWindow) return;
      if (event.origin !== bridgeContext.origin) return;
      const result = validateBridgeMessage(event.data, bridgeContext);
      if (!result.ok) return;
      if (result.message.type === "retry") {
        terminalAttemptRef.current = true;
        const request = {
          freshAttempt: true,
          launchSearchParams: launchParams?.toString() ?? serializedSearchParams,
        } satisfies GameEmbedRetryRequest;
        const deferred = outcomeBarrierRef.current.defer(
          result.message.receipt.launchAttemptId,
          { type: "retry", request },
        );
        if (!deferred) onRetry(request);
      } else if (result.message.type === "calibration-complete") {
        if (isDemoMode) {
          window.localStorage.setItem(
            demoCalibrationStorageKey(bridgeContext.installationId),
            JSON.stringify({
              protocolVersion: result.message.protocolVersion,
              offsetMs: result.message.offsetMs,
            }),
          );
          setCalibration({
            protocolVersion: result.message.protocolVersion,
            offsetMs: result.message.offsetMs,
          });
          setCalibrationStatus("ready");
          setBridgeStatusMessage("");
          return;
        }
        fetch("/api/player-calibration", {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ installationId: bridgeContext.installationId, offsetMs: result.message.offsetMs, protocolVersion: result.message.protocolVersion }),
        }).then(async (response) => {
          if (cancelled) return;
          const storedCalibration = response.ok
            ? parseCalibrationState(await response.json(), bridgeContext.protocolVersion)
            : null;
          if (storedCalibration) {
            setCalibration(storedCalibration);
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
        const launchAttemptId = result.message.receipt.launchAttemptId;
        // Only authenticated outcomes have a server-owned attempt id. A guest
        // completion remains local and is not deduplicated through that API key.
        if (launchAttemptId) {
          if (acceptedOutcomeAttemptIdRef.current === launchAttemptId) return;
          acceptedOutcomeAttemptIdRef.current = launchAttemptId;
        } else if (!isDemoMode) {
          return;
        }
        if (isDemoMode) {
          setOutcomeSyncState("idle");
          setPendingOutcome(null);
          if (completion.outcome === "completed") {
            setCompletedRun({
              completedEvents: completion.completedEvents,
              requiredEvents: completion.requiredEvents,
              solvedSets: completion.solvedSets,
              hitAttempts: completion.hitAttempts,
            });
          }
          return;
        }
        if (!launchAttemptId) return;
        setOutcomeSyncState("saving");
        outcomeBarrierRef.current.begin(launchAttemptId);
        const nextPendingOutcome: PendingOutcome = {
          receipt: { ...result.message.receipt, launchAttemptId },
          completion,
        };
        try {
          rememberPendingPlayerOutcome(window.localStorage, nextPendingOutcome);
        } catch {
          // Keep the in-memory path working if browser storage is unavailable.
        }
        setPendingOutcome(nextPendingOutcome);
      } else if (isDemoMode) {
        terminalAttemptRef.current = true;
        if (iframeRef.current) iframeRef.current.src = "about:blank";
        window.location.assign(`${navBasePath}/song-choice`);
      } else {
        const deferred = outcomeBarrierRef.current.defer(
          result.message.receipt.launchAttemptId,
          { type: "return", receipt: result.message.receipt },
        );
        if (deferred) {
          terminalAttemptRef.current = true;
          return;
        }
        void handleAttemptReturn(result.message.receipt);
      }
    };
    window.addEventListener("message", onMessage);
    return () => {
      cancelled = true;
      window.removeEventListener("message", onMessage);
    };
  }, [bridgeContext, handleAttemptReturn, isDemoMode, launchParams, navBasePath, onRetry, outcomeLookupSettledAttemptId, serializedSearchParams]);

  useEffect(() => {
    if (isDemoMode || !pendingOutcome) return;

    let cancelled = false;
    const requestBody = JSON.stringify(pendingOutcome);
    const keepalive = new Blob([requestBody]).size <= 60 * 1024;
    fetch("/api/player-outcomes", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: requestBody,
      keepalive,
    })
      .then((response) => {
        if (!response.ok) throw new Error("outcome sync failed");
        if (cancelled) {
          try {
            clearPendingPlayerOutcome(window.localStorage, pendingOutcome.receipt.launchAttemptId);
          } catch {
            // The server result is authoritative even if browser storage is unavailable.
          }
          return;
        }
        const wasRecovered = recoveredOutcomeAttemptIdRef.current === pendingOutcome.receipt.launchAttemptId || !activeLaunchParams;
        markOutcomeSaved(pendingOutcome.completion, pendingOutcome.receipt.launchAttemptId, wasRecovered);
      })
      .catch(() => {
        if (!cancelled) {
          setOutcomeSyncState("failed");
          setBridgeStatusMessage(studentCopy.game.resultSyncFailed);
        }
      });

    return () => { cancelled = true; };
  }, [activeLaunchParams, isDemoMode, markOutcomeSaved, pendingOutcome]);

  const embeddedGameUrl = useMemo(() => {
    const params = new URLSearchParams(activeLaunchParams?.toString() ?? "");
    if (bridgeContext) {
      params.set("bridgeNonce", bridgeContext.nonce);
      params.set("installationId", bridgeContext.installationId);
      params.set("calibrationProtocolVersion", String(bridgeContext.protocolVersion));
      params.delete("calibrationOffsetMs");
      const launchCalibration = resolveEmbeddedCalibrationLaunchSnapshot(
        iframeCalibrationLaunchSnapshot,
        bridgeContext.nonce,
        calibrationStatus,
        calibration?.offsetMs ?? null,
      );
      params.set("requiresCalibration", String(launchCalibration?.requiresCalibration ?? true));
      if (launchCalibration?.calibrationOffsetMs !== undefined) {
        params.set("calibrationOffsetMs", String(launchCalibration.calibrationOffsetMs));
      }
      params.set("platformOrigin", window.location.origin);
    }
    return getEmbeddedGameUrl(params);
  }, [activeLaunchParams, bridgeContext, calibration, calibrationStatus, iframeCalibrationLaunchSnapshot]);

  const outcomeLookupReady = isDemoMode || !bridgeContext?.receipt.launchAttemptId ||
    outcomeLookupSettledAttemptId === bridgeContext.receipt.launchAttemptId;
  const canRenderEmbeddedGame = !needsSongChoice && returnSyncState === "idle" && outcomeLookupReady && Boolean(
    activeLaunchParams &&
    (!activeLaunchParams.get("receipt") || (bridgeContext && calibrationStatus !== "loading")),
  );
  const launchErrorMessage = launchPreparationError || bridgeSetup.error;

  return (
    <div
      className={`${styles.studentTypography} ${styles.gameEmbedShell} experience-role-shell`}
      data-experience-role="student"
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
        className={styles.gameEmbedMain}
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
          className={styles.gameEmbedStage}
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
          {recoveredOutcome ? (
            <div className="experience-card" role="status" aria-live="polite" style={{ ...webglFlexFrameStyle, display: "grid", placeItems: "center", borderRadius: 12, padding: 24, boxSizing: "border-box", textAlign: "center" }}>
              <div style={{ display: "grid", gap: 14, justifyItems: "center", maxWidth: 460 }}>
                <strong>{completedRun
                  ? studentCopy.game.lessonComplete(completedRun.solvedSets, completedRun.completedEvents, completedRun.requiredEvents, completedRun.hitAttempts)
                  : "Your lesson result is saved."}</strong>
                {pendingOutcome && outcomeSyncState !== "saved" ? (
                  <span role="status" aria-live="polite">
                    {outcomeSyncState === "saving" ? studentCopy.game.savingResult : studentCopy.game.waitingToSave}
                  </span>
                ) : (
                  <Link className="experience-button" href={`${navBasePath}/song-choice`} style={{ border: "none", borderRadius: 999, background: "var(--ur-accent-lime)", color: "var(--ur-canvas-deep)", padding: "10px 18px", textDecoration: "none", fontWeight: 800 }}>
                    {studentCopy.game.chooseAnotherSong}
                  </Link>
                )}
              </div>
            </div>
          ) : returnSyncState !== "idle" ? (
            <div className="experience-card" role={returnSyncState === "failed" ? "alert" : "status"} aria-live={returnSyncState === "failed" ? "assertive" : "polite"} style={{ ...webglFlexFrameStyle, display: "grid", placeItems: "center", borderRadius: 12, padding: 24, boxSizing: "border-box", textAlign: "center" }}>
              <div style={{ display: "grid", gap: 14, justifyItems: "center", maxWidth: 460 }}>
                <strong>{returnSyncState === "saving" ? studentCopy.game.returning : studentCopy.game.returnSyncFailed}</strong>
                {returnSyncState === "saving" ? null : (
                  <button
                    type="button"
                    className="experience-button"
                    onClick={() => {
                      const receipt = returnReceiptRef.current;
                      if (receipt) void handleAttemptReturn(receipt);
                    }}
                    style={{ border: "none", borderRadius: 999, background: "var(--ur-accent-lime)", color: "var(--ur-canvas-deep)", padding: "10px 18px", fontWeight: 800, cursor: "pointer" }}
                  >
                    {studentCopy.game.retryReturn}
                  </button>
                )}
              </div>
            </div>
          ) : canRenderEmbeddedGame ? (
            <iframe
              ref={iframeRef}
              src={embeddedGameUrl}
              title="UltraRapid Game"
              className={styles.gameFrame}
              allow="gamepad; autoplay"
              allowFullScreen
              style={{
                ...webglFlexFrameStyle,
                border: `1px solid ${subtleBorderColor}`,
                borderRadius: 12,
                background: "#000000",
              }}
            />
          ) : (
            <div className="experience-card" data-state={launchErrorMessage ? "error" : needsSongChoice ? "empty" : "loading"} role={launchErrorMessage ? "alert" : "status"} aria-live={launchErrorMessage ? "assertive" : "polite"} style={{ ...webglFlexFrameStyle, display: "grid", placeItems: "center", borderRadius: 12, padding: 24, boxSizing: "border-box", textAlign: "center" }}>
              <div style={{ display: "grid", gap: 14, justifyItems: "center", maxWidth: 460 }}>
                {!launchErrorMessage && !needsSongChoice ? <span className={styles.gamePreparingPulse} aria-hidden="true" /> : null}
                <strong>{outcomeRecoveryBlocked ? studentCopy.game.resultSyncFailed : launchErrorMessage ? studentCopy.game.prepareErrorTitle : needsSongChoice ? studentCopy.game.chooseSongTitle : studentCopy.game.preparingTitle}</strong>
                <span style={{ color: "#FFFFFFB3", lineHeight: 1.45 }}>
                  {launchErrorMessage || (needsSongChoice ? studentCopy.game.chooseSongBody : studentCopy.game.preparingBody)}
                </span>
                {launchErrorMessage ? (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 10, justifyContent: "center" }}>
                    <button type="button" className="experience-button" onClick={() => outcomeRecoveryBlocked ? window.location.reload() : onRetry()} style={{ border: "none", borderRadius: 999, background: "var(--ur-accent-lime)", color: "var(--ur-canvas-deep)", padding: "10px 18px", fontWeight: 800, cursor: "pointer" }}>
                      {outcomeRecoveryBlocked ? studentCopy.game.syncAgain : "Try again"}
                    </button>
                    <Link className="experience-button experience-button--secondary" href={`${navBasePath}/song-choice`} style={{ borderRadius: 999, color: "var(--ur-text-marketing)", padding: "9px 16px", textDecoration: "none", fontWeight: 700 }}>
                      {studentCopy.game.chooseAnotherSong}
                    </Link>
                  </div>
                ) : needsSongChoice ? (
                  <Link className="experience-button" href={`${navBasePath}/song-choice`} style={{ border: "none", borderRadius: 999, background: "var(--ur-accent-lime)", color: "var(--ur-canvas-deep)", padding: "10px 18px", textDecoration: "none", fontWeight: 800 }}>
                    {studentCopy.game.chooseSong}
                  </Link>
                ) : null}
              </div>
            </div>
          )}
          {bridgeContext && calibrationStatus === "required" && (
            <p className={`${styles.gameEmbedCalibrationNotice} mt-2 text-sm text-white/70`}>
              {studentCopy.game.calibrationRequired}
            </p>
          )}
          {bridgeStatusMessage && (
            <p className="experience-status mt-2 text-sm" data-status="error" role="alert" aria-live="assertive">{bridgeStatusMessage}</p>
          )}
          {pendingOutcome && outcomeSyncState === "saving" && (
            <p className="experience-status mt-2 text-sm" data-status="pending" role="status" aria-live="polite" aria-busy="true">{studentCopy.game.savingResult}</p>
          )}
          {pendingOutcome && outcomeSyncState === "failed" && (
            <p className="experience-status mt-2 text-sm" data-status="error" role="alert" aria-live="assertive">
              <button
                type="button"
                className="experience-button"
                onClick={() => {
                  void retryPendingOutcomeSync();
                }}
                style={{ marginRight: 6, border: 0, borderRadius: 999, background: "var(--ur-accent-lime)", color: "var(--ur-canvas-deep)", padding: "5px 10px", fontWeight: 800, cursor: "pointer" }}
              >
                {studentCopy.game.syncAgain}
              </button>
              {studentCopy.game.waitingToSave}
            </p>
          )}
          {completedRun && (
            <p className="experience-status mt-2 text-sm" data-status="success" role="status" aria-live="polite">
              {studentCopy.game.lessonComplete(completedRun.solvedSets, completedRun.completedEvents, completedRun.requiredEvents, completedRun.hitAttempts)} {studentCopy.game.returnToSongs}
            </p>
          )}
        </section>
      </main>

      {/* <SongFlowDebugger title="Game Launch Debugger" /> */}
    </div>
  );
}
