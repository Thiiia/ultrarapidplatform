"use client";
import {
  requestFreshSongLaunchPackage,
  type FreshSongLaunchPackage,
} from "@/lib/song-launch-client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { FC, SVGProps } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { persistLaunchParams } from "@/lib/launch-handoff";
import { createSongLaunchSearchParams } from "@/lib/platform-launch";
import { appendSongFlowDebug } from "@/lib/song-flow-debug";
import { assertSongActivityMatches } from "@/lib/song-activity-authority";
import { normalizeSongActivityKey } from "@/lib/song-activity-storage";
import {
  buildSongSelectionCacheKey,
  getPlayerLaunchRoute,
  getSongLaunchErrorMessage,
  isPlayableSongLaunchPackage,
  type SongPackageLoadStatus,
} from "@/lib/song-choice-flow";
import { studentCopy } from "@/lib/student-copy";
import type { SongChoice } from "@/lib/song-storage";
import styles from "../student.module.css";

/* Header Icon imports */
import URIcon from "@/public/header_icons/URIcon.svg";
import HomeIcon from "@/public/header_icons/Home.svg";
import HomePressedIcon from "@/public/header_icons/Home_pressed.svg";
import MyLessonsTab from "@/public/header_icons/my_lessons_tab.svg";
import MyLessonsPressedTab from "@/public/header_icons/my_lessons_tab_pressed.svg";
import LessonBuilderTab from "@/public/header_icons/lesson_builder_tab.svg";
import LessonBuilderPressedTab from "@/public/header_icons/lesson_builder_tab_pressed.svg";
import ProgressTab from "@/public/header_icons/progress_tab.svg";
import ProgressPressedTab from "@/public/header_icons/progress_tab_pressed.svg";
import PlayTab from "@/public/header_icons/play_tab.svg";
import PlayPressedTab from "@/public/header_icons/play_tab_pressed.svg";

/* Utility Icon Imports */
import ProfileIcon from "@/public/utility_icons/profile_icon.svg";
import SongChoiceIcon from "@/public/song-choice_icons/song_choice_icon.png";

/* Song Choice Icon Imports */
import NoteIcon from "@/public/song_choice_icons/Note.svg";
import PlayIcon from "@/public/song_choice_icons/Play_Icon.svg";

type TabIcon = FC<SVGProps<SVGSVGElement>>;

type DashboardType = "student" | "teacher";

type HeaderTab = {
  label: string;
  href: string;
  width: number;
  Icon?: TabIcon;
  ActiveIcon?: TabIcon;
};

type SongChoiceWithEquationSlots = SongChoice & {
  equation_slots?: number | string | null;
  equationSlots?: number | string | null;
  equation_slot_ticks?: unknown;
  equationSlotTicks?: unknown;
  hit_counts?: unknown;
  hitCounts?: unknown;
  spin_counts?: unknown;
  spinCounts?: unknown;
  drag_counts?: unknown;
  dragCounts?: unknown;
  songAsset?: {
    equation_slots?: number | string | null;
    equationSlots?: number | string | null;
    equation_slot_ticks?: unknown;
    equationSlotTicks?: unknown;
    hit_counts?: unknown;
    hitCounts?: unknown;
    spin_counts?: unknown;
    spinCounts?: unknown;
    drag_counts?: unknown;
    dragCounts?: unknown;
  } | null;
  song_asset?: {
    equation_slots?: number | string | null;
    equationSlots?: number | string | null;
    equation_slot_ticks?: unknown;
    equationSlotTicks?: unknown;
    hit_counts?: unknown;
    hitCounts?: unknown;
    spin_counts?: unknown;
    spinCounts?: unknown;
    drag_counts?: unknown;
    dragCounts?: unknown;
  } | null;
};

type SongChoiceClientProps = {
  songs: SongChoiceWithEquationSlots[];
  navBasePath?: string;
  dashboardType?: DashboardType;
};

function getStudentTopTabs(navBasePath = "/student"): HeaderTab[] {
  return [
    {
      label: "Home",
      href: navBasePath,
      Icon: HomeIcon,
      ActiveIcon: HomePressedIcon,
      width: 99,
    },
    {
      label: studentCopy.navigation.lessons,
      href: `${navBasePath}/lessons`,
      Icon: MyLessonsTab,
      ActiveIcon: MyLessonsPressedTab,
      width: 139,
    },
    {
      label: studentCopy.navigation.builder,
      href: `${navBasePath}/song-choice`,
      Icon: LessonBuilderTab,
      ActiveIcon: LessonBuilderPressedTab,
      width: 159,
    },
    {
      label: studentCopy.navigation.progress,
      href: `${navBasePath}/progress`,
      Icon: ProgressTab,
      ActiveIcon: ProgressPressedTab,
      width: 120,
    },
    {
      label: studentCopy.navigation.play,
      href: `${navBasePath}/game`,
      Icon: PlayTab,
      ActiveIcon: PlayPressedTab,
      width: 99,
    },
  ];
}

function getTeacherTopTabs(navBasePath = "/teacher"): HeaderTab[] {
  return [
    {
      label: "Home",
      href: navBasePath,
      width: 99,
    },
    {
      label: "Classes",
      href: `${navBasePath}/classes`,
      width: 120,
    },
    {
      label: "Students",
      href: `${navBasePath}/students`,
      width: 120,
    },
    {
      label: "Lessons",
      href: `${navBasePath}/lessons`,
      width: 120,
    },
    {
      label: "Lesson Builder",
      href: `${navBasePath}/song-choice`,
      width: 159,
    },
    {
      label: "Progress",
      href: `${navBasePath}/progress`,
      width: 120,
    },
  ];
}

const pagePanelWidth = "85vw";

const activityLabelMap: Record<string, string> = {
  "number-bonds": "Number Bonds",
  "missing-numbers": "Missing Numbers",
  equations: "Equations",
  "early-algebra": "Early Algebra",
};

const headerStyles = {
  backgroundColor: "var(--ur-canvas-top)",
  borderBottomColor: "#FFFFFF14",
};

function formatDuration(seconds: number | null | undefined) {
  if (!seconds || !Number.isFinite(seconds)) {
    return "--:--";
  }

  const roundedSeconds = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(roundedSeconds / 60);
  const remainingSeconds = roundedSeconds % 60;

  return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
}

function HeaderBar({
  pathname,
  topTabs,
  navBasePath,
  dashboardType,
}: {
  pathname: string;
  topTabs: HeaderTab[];
  navBasePath: string;
  dashboardType: DashboardType;
}) {
  const profileHref = `${navBasePath}/profile`;

  return (
    <header
      style={{
        background: headerStyles.backgroundColor,
        width: "100%",
        boxSizing: "border-box",
        height: 70,
        border: "none",
        borderBottom: `1px solid ${headerStyles.borderBottomColor}`,
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
            aria-label="Dashboard navigation"
            className="experience-navigation"
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

              const Icon = isActive ? tab.ActiveIcon : tab.Icon;

              return (
                <Link
                  key={tab.label}
                  href={tab.href}
                  aria-label={tab.label}
                  aria-current={isActive ? "page" : undefined}
                  data-experience-component="navigation-link"
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
                    textDecoration: "none",
                    background: "var(--ur-canvas-top)",
                    borderBottom:
                      dashboardType === "teacher"
                        ? isActive
                          ? "3px solid #CFFF04"
                          : "3px solid transparent"
                        : undefined,
                    color: "var(--ur-text-marketing)",
                    fontSize: dashboardType === "teacher" ? 13 : undefined,
                    fontWeight: dashboardType === "teacher" ? 500 : undefined,
                    lineHeight:
                      dashboardType === "teacher" ? "19.5px" : undefined,
                  }}
                >
                  {Icon ? (
                    <Icon
                      style={{
                        width: tab.width,
                        height: 45.5,
                        display: "block",
                      }}
                    />
                  ) : (
                    tab.label
                  )}
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
          <Link
            href={profileHref}
            prefetch={false}
            aria-label="Profile"
            className={styles.utilityButton}
            style={{
              width: 134.45,
              height: 38,
            }}
          >
            <ProfileIcon
              style={{
                width: 134.45,
                height: 38,
                display: "block",
              }}
            />
          </Link>

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

function LessonBuilderPanel() {
  return (
    <div
      style={{
        background: "var(--ur-canvas-top)",
        width: "100%",
        borderBottom: "1px solid #FFFFFF14",
      }}
    >
      <section
        style={{
          background: "var(--ur-canvas-top)",
          color: "#FFFFFF",
          width: pagePanelWidth,
          boxSizing: "border-box",
          minHeight: 130,
          border: "none",
          borderRadius: 0,
          padding: "24px 0",
          margin: "0 auto",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "flex-start",
          textAlign: "left",
        }}
      >
        <h1
          className={styles.panelTitle}
          style={{
            margin: "0 0 8px 0",
            color: "#FFFFFF",
            textTransform: "uppercase",
            textAlign: "left",
          }}
        >
          LESSON BUILDER
        </h1>

        <p
          style={{
            margin: 0,
            color: "#D1D5DB",
            fontSize: 13,
            fontWeight: 500,
            lineHeight: "19.5px",
            textAlign: "left",
            width: "100%",
          }}
        >
          Song select
        </p>
      </section>
    </div>
  );
}

export default function SongChoiceClient({
  songs,
  navBasePath = "/student",
  dashboardType = "student",
}: SongChoiceClientProps) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [selectedActivity, setSelectedActivity] = useState<{
    key: string;
    label: string;
  } | null>(null);

  const topTabs =
    dashboardType === "teacher"
      ? getTeacherTopTabs(navBasePath)
      : getStudentTopTabs(navBasePath);

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSongId, setSelectedSongId] = useState<string | null>(null);
  const [isCustomizePromptOpen, setIsCustomizePromptOpen] = useState(false);
  const [isLaunching, setIsLaunching] = useState(false);
  const [launchError, setLaunchError] = useState("");
  const [durationsById, setDurationsById] = useState<Record<string, number>>(
    {},
  );
  const [selectionPackages, setSelectionPackages] = useState<
    Record<string, FreshSongLaunchPackage>
  >({});
  const [selectionStatusById, setSelectionStatusById] = useState<
    Record<string, SongPackageLoadStatus>
  >({});
  const pendingSelectionsRef = useRef<Set<string>>(new Set());
  const launchInFlightRef = useRef(false);
  // Packages are keyed by activity + song, so a completed request is safe to
  // cache even when the learner has already selected another row. Keep the
  // current key only for deciding which request may surface an error.
  const activeSelectionKeyRef = useRef<string | null>(null);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);
  const [previewingSongId, setPreviewingSongId] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState("");

  const routeActivityValue = searchParams.get("activity")?.trim() ?? "";
  const routeActivityKey = normalizeSongActivityKey(routeActivityValue);
  const hasInvalidExplicitRouteActivity = Boolean(
    routeActivityValue && !routeActivityKey,
  );
  // An explicit route is authoritative. The session value is only the
  // recovery fallback used when the route carries no activity.
  // The server catalogue is the authoritative fallback when this page is
  // opened directly without ?activity= or a dashboard session value. This
  // prevents a valid song list from becoming unselectable on a cold entry.
  const catalogueActivityKey = normalizeSongActivityKey(songs[0]?.activityKey);
  const currentActivityKey =
    hasInvalidExplicitRouteActivity
      ? null
      : routeActivityKey ?? catalogueActivityKey ?? normalizeSongActivityKey(selectedActivity?.key);

  function requireActivityKey(fallback?: string | null) {
    if (hasInvalidExplicitRouteActivity) {
      throw new Error("This activity is not supported by the current lesson flow.");
    }
    const activityKey = currentActivityKey ?? normalizeSongActivityKey(fallback);
    if (!activityKey) throw new Error("Selected song activity identity is missing");
    return activityKey;
  }

  const filteredSongs = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

    if (!normalizedQuery) {
      return songs;
    }

    return songs.filter((song) => {
      return (
        song.name.toLowerCase().includes(normalizedQuery) ||
        song.path.toLowerCase().includes(normalizedQuery) ||
        song.artist?.toLowerCase().includes(normalizedQuery)
      );
    });
  }, [searchQuery, songs]);

  const selectedSong = useMemo(() => {
    const baseSong = songs.find((song) => song.id === selectedSongId) ?? null;

    if (!baseSong) {
      return null;
    }

    const activityKey = currentActivityKey ?? baseSong.activityKey;
    const freshPackage = selectionPackages[buildSongSelectionCacheKey(baseSong.id, activityKey)];

    if (!freshPackage) {
      return { ...baseSong, activityKey };
    }

    // Overlay the freshly-resolved dev-authored chart/sidecar (and audio)
    // signed URLs resolved at selection time.
    return {
      ...baseSong,
      activityKey,
      signedUrl: freshPackage.audio.signedUrl,
      song: {
        ...baseSong.song,
        bucket: freshPackage.audio.bucket,
        path: freshPackage.audio.path,
        signedUrl: freshPackage.audio.signedUrl,
      },
      chart: {
        ...baseSong.chart,
        bucket: freshPackage.chart.bucket,
        path: freshPackage.chart.path,
        signedUrl: freshPackage.chart.signedUrl,
      },
      sidecar: {
        bucket: freshPackage.sidecar.bucket,
        path: freshPackage.sidecar.path,
        signedUrl: freshPackage.sidecar.signedUrl,
        contentType: baseSong.sidecar?.contentType ?? "application/json",
      },
    };
  }, [currentActivityKey, selectedSongId, songs, selectionPackages]);

  const selectedSongCacheKey = selectedSong
    ? selectedSong.activityKey
      ? buildSongSelectionCacheKey(selectedSong.id, selectedSong.activityKey)
      : null
    : null;
  const selectedSongPackage = selectedSongCacheKey
    ? selectionPackages[selectedSongCacheKey]
    : undefined;
  const selectedSongCanPlay = isPlayableSongLaunchPackage(selectedSongPackage);
  const selectedSongStatus: SongPackageLoadStatus = selectedSongCacheKey
    ? selectionStatusById[selectedSongCacheKey] ??
      (selectedSongPackage ? "ready" : "idle")
    : "idle";

  function handleSelectSong(song: SongChoiceWithEquationSlots) {
    if (launchInFlightRef.current) return;
    let requestedActivityKey: NonNullable<ReturnType<typeof normalizeSongActivityKey>>;
    try {
      requestedActivityKey = requireActivityKey(song.activityKey);
    } catch (error) {
      setLaunchError(getSongLaunchErrorMessage(error));
      return;
    }
    const selectionKey = buildSongSelectionCacheKey(song.id, requestedActivityKey);
    setSelectedSongId(song.id);
    activeSelectionKeyRef.current = selectionKey;
    setPreviewError("");
    stopSongPreview();
    setLaunchError("");

    if (selectionPackages[selectionKey]) {
      setSelectionStatusById((current) => ({ ...current, [selectionKey]: "ready" }));
      return;
    }

    if (pendingSelectionsRef.current.has(selectionKey)) {
      setSelectionStatusById((current) => ({ ...current, [selectionKey]: "loading" }));
      return;
    }

    pendingSelectionsRef.current.add(selectionKey);
    setSelectionStatusById((current) => ({ ...current, [selectionKey]: "loading" }));

    // Resolving the selection checks for the dev-authored SongChart and signs
    // its chart/sidecar when present; when nothing is authored yet it serves
    // blank chart/sidecar content without persisting anything (a database
    // entry is created on save instead).
    requestFreshSongLaunchPackage({
      songAssetId: song.id,
      activityKey: requestedActivityKey,
      allowBlankPackage: true,
    })
      .then((freshPackage) => {
        assertSongActivityMatches({
          expectedActivityKey: requestedActivityKey,
          actualActivityKey: freshPackage.activityKey,
          boundary: "song-choice-package",
        });
        setSelectionPackages((current) => ({
          ...current,
          [selectionKey]: freshPackage,
        }));

        setSelectionStatusById((current) => ({ ...current, [selectionKey]: "ready" }));
      })
      .catch((error) => {
        setSelectionStatusById((current) => ({ ...current, [selectionKey]: "error" }));
        if (activeSelectionKeyRef.current === selectionKey) {
          setLaunchError(getSongLaunchErrorMessage(error));
        }
      })
      .finally(() => {
        pendingSelectionsRef.current.delete(selectionKey);
      });
  }

  useEffect(() => {
    appendSongFlowDebug("song-choice:loaded-song-assets", "Song assets were loaded into song choice.", {
      songCount: songs.length,
      songs: songs.map((song) => ({
        id: song.id,
        name: song.name,
        artist: song.artist,
        songPath: song.song.path,
        chartPath: song.chart.path,
        sidecarBucket: song.sidecar?.bucket ?? null,
        sidecarPath: song.sidecar?.path ?? null,
        durationSeconds: song.durationSeconds,
      })),
    });
  }, [songs]);

  useEffect(() => {
    if (!selectedSong) {
      return;
    }

    appendSongFlowDebug("song-choice:selected-song", "User selected a song asset in song choice.", {
      id: selectedSong.id,
      name: selectedSong.name,
      artist: selectedSong.artist,
      requestedActivityKey: currentActivityKey,
      songChoiceActivityKey: selectedSong.activityKey,
      packageActivityKey: selectedSongPackage?.activityKey ?? null,
      revision: selectedSongPackage?.revision ?? null,
      source: selectedSongPackage?.source ?? null,
      hasLaunchAttemptId: Boolean(selectedSongPackage?.launchAttemptId),
    });
  }, [currentActivityKey, selectedSong, selectedSongPackage]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const activityFromUrl = normalizeSongActivityKey(
      searchParams.get("activity"),
    );

    if (activityFromUrl) {
      const label = activityLabelMap[activityFromUrl] ?? activityFromUrl;
      const value = { key: activityFromUrl, label };
      setSelectedActivity(value);
      window.sessionStorage.setItem(
        "selectedDashboardActivity",
        JSON.stringify(value),
      );
      return;
    }

    if (searchParams.get("activity")?.trim()) {
      setLaunchError("This activity is not supported by the current lesson flow.");
      return;
    }

    if (catalogueActivityKey) {
      const value = {
        key: catalogueActivityKey,
        label: activityLabelMap[catalogueActivityKey] ?? catalogueActivityKey,
      };
      setSelectedActivity(value);
      window.sessionStorage.setItem(
        "selectedDashboardActivity",
        JSON.stringify(value),
      );
      return;
    }

    const storedActivity = window.sessionStorage.getItem(
      "selectedDashboardActivity",
    );

    if (!storedActivity) {
      return;
    }

    try {
      const parsed = JSON.parse(storedActivity) as { key?: string; label?: string };
      const normalizedKey = normalizeSongActivityKey(parsed?.key);
      if (normalizedKey) {
        const label = parsed.label ?? activityLabelMap[normalizedKey] ?? normalizedKey;
        setSelectedActivity({ key: normalizedKey, label });
      }
    } catch {
      window.sessionStorage.removeItem("selectedDashboardActivity");
    }
  }, [catalogueActivityKey, searchParams]);

  useEffect(() => {
    let cancelled = false;

    songs.forEach((song) => {
      if (song.durationSeconds || durationsById[song.id]) {
        return;
      }

      const audio = new Audio();
      audio.preload = "metadata";
      audio.src = song.signedUrl;

      const handleLoadedMetadata = () => {
        if (cancelled || !Number.isFinite(audio.duration)) {
          return;
        }

        setDurationsById((current) => ({
          ...current,
          [song.id]: audio.duration,
        }));
      };

      audio.addEventListener("loadedmetadata", handleLoadedMetadata);
      audio.load();
    });

    return () => {
      cancelled = true;
    };
  }, [songs, durationsById]);

  function stopSongPreview() {
    const audio = previewAudioRef.current;
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
      audio.src = "";
    }
    previewAudioRef.current = null;
    setPreviewingSongId(null);
  }

  async function handlePreview(song: SongChoiceWithEquationSlots) {
    setPreviewError("");

    if (previewingSongId === song.id) {
      stopSongPreview();
      return;
    }

    stopSongPreview();
    if (!song.signedUrl.trim()) {
      setPreviewError(studentCopy.songChoice.previewUnavailable);
      return;
    }

    const audio = new Audio(song.signedUrl);
    audio.preload = "metadata";
    audio.onended = () => {
      if (previewAudioRef.current !== audio) return;
      previewAudioRef.current = null;
      setPreviewingSongId(null);
    };
    audio.onerror = () => {
      if (previewAudioRef.current !== audio) return;
      previewAudioRef.current = null;
      setPreviewingSongId(null);
      setPreviewError(studentCopy.songChoice.previewUnavailable);
    };
    previewAudioRef.current = audio;
    setPreviewingSongId(song.id);

    try {
      await audio.play();
    } catch {
      if (previewAudioRef.current !== audio) return;
      previewAudioRef.current = null;
      setPreviewingSongId(null);
      setPreviewError(studentCopy.songChoice.previewUnavailable);
    }
  }

  useEffect(() => {
    return () => {
      const audio = previewAudioRef.current;
      if (audio) {
        audio.pause();
        audio.src = "";
      }
      previewAudioRef.current = null;
    };
  }, []);

  function buildSelectedSongPayload(song: SongChoiceWithEquationSlots) {
    const activityKey = requireActivityKey(song.activityKey);
    const rhythmSource = song.requiresRhythmSource
      ? song.rhythmSources?.[0] ?? null
      : null;
    const chart = rhythmSource?.chart ?? song.chart;
    const activityContext = {
      key: activityKey,
      label: selectedActivity?.label ?? activityLabelMap[activityKey] ?? activityKey,
    };

    return {
      id: song.id,
      name: song.name,
      title: song.title,
      artist: song.artist,
      authorId: selectedSongPackage?.authorId ?? null,
      authorName: song.authorName ?? null,
      revision: selectedSongPackage?.revision ?? null,
      rhythmSource,
      rhythmDifficultyKey: selectedSongPackage?.rhythmDifficultyKey ?? null,
      activity: activityContext,

      song: {
        bucket: song.song.bucket,
        path: song.song.path,
        signedUrl: song.song.signedUrl,
        contentType: song.song.contentType,
      },

      chart: {
        bucket: chart.bucket,
        path: chart.path,
        signedUrl: chart.signedUrl,
        contentType: chart.contentType,
      },

      sidecar: song.sidecar
        ? {
            bucket: song.sidecar.bucket,
            path: song.sidecar.path,
            signedUrl: song.sidecar.signedUrl,
            contentType: song.sidecar.contentType,
          }
        : null,
    };
  }

  function handleContinue() {
    if (launchInFlightRef.current) return;
    if (!selectedSong) {
      return;
    }
    if (selectedSongStatus === "error") {
      handleSelectSong(selectedSong);
      return;
    }
    if (selectedSongStatus !== "ready" || !selectedSongPackage) {
      setLaunchError(studentCopy.songChoice.preparingMessage);
      return;
    }

    setIsCustomizePromptOpen(true);
  }

  function handleCustomizeYes() {
    if (launchInFlightRef.current) return;
    if (!selectedSong) {
      return;
    }
    if (selectedSongStatus !== "ready" || !selectedSongPackage) {
      setLaunchError(studentCopy.songChoice.preparingMessage);
      return;
    }

    const selectedSongPayload = buildSelectedSongPayload(selectedSong);

    appendSongFlowDebug("song-choice:continue", "Persisting selected song payload into session storage and routing to lesson builder.", {
      navBasePath,
      lessonBuilderRoute: `${navBasePath}/lesson-builder`,
      requestedActivityKey: currentActivityKey,
      selectedPayloadActivityKey: selectedSongPayload.activity.key,
      hasChart: Boolean(selectedSongPayload.chart.signedUrl),
      hasSidecar: Boolean(selectedSongPayload.sidecar?.signedUrl),
    });

    window.sessionStorage.setItem(
      "ultrarapid_selected_song",
      JSON.stringify(selectedSongPayload),
    );
    window.sessionStorage.setItem("ultrarapid_player_entry_intent", "personalize");

    setIsCustomizePromptOpen(false);
    router.push(`${navBasePath}/lesson-builder`);
  }

  async function handleCustomizeNo() {
    if (!selectedSong || launchInFlightRef.current || !selectedSongCanPlay) return;
    launchInFlightRef.current = true;
    setIsLaunching(true);
    setLaunchError("");
    stopSongPreview();
    try {
      const selectedSongPayload = buildSelectedSongPayload(selectedSong);
      const activityKey = requireActivityKey(selectedSong.activityKey);
      const freshPackage = await requestFreshSongLaunchPackage({
        songAssetId: selectedSong.id,
        activityKey,
      });
      if (freshPackage.songAssetId !== selectedSong.id) {
        throw new Error("The selected song changed while preparing the game.");
      }
      assertSongActivityMatches({
        expectedActivityKey: activityKey,
        actualActivityKey: freshPackage.activityKey,
        boundary: "song-choice-play",
      });
      if (!isPlayableSongLaunchPackage(freshPackage)) {
        throw new Error(freshPackage.readiness.message);
      }
      const launchParams = createSongLaunchSearchParams({
        songAssetId: freshPackage.songAssetId,
        activityKey: freshPackage.activityKey,
        chartUrl: freshPackage.chart.signedUrl,
        sidecarUrl: freshPackage.sidecar.signedUrl,
        audioUrl: freshPackage.audio.signedUrl,
        authorId: freshPackage.authorId,
        revision: freshPackage.revision,
        receipt: freshPackage.receipt,
        source: freshPackage.source,
        templateProvenance: freshPackage.templateProvenance,
        launchAttemptId: freshPackage.launchAttemptId,
        rhythmDifficultyKey: freshPackage.rhythmDifficultyKey,
        learningDifficultyKey: freshPackage.learningDifficultyKey,
      });
      const launchRoute = getPlayerLaunchRoute(navBasePath);
      const launchUrl = `${launchRoute}?${launchParams.toString()}`;

      appendSongFlowDebug(
        "song-choice:continue:no-customize",
        "Skipping gameplay customization and launching with play-formatted URL.",
        {
          navBasePath,
          launchRoute,
          requestedActivityKey: activityKey,
          packageActivityKey: freshPackage.activityKey,
          revision: freshPackage.revision ?? null,
          source: freshPackage.source,
          hasLaunchAttemptId: Boolean(freshPackage.launchAttemptId),
        },
      );

      window.sessionStorage.setItem(
        "ultrarapid_selected_song",
        JSON.stringify(selectedSongPayload),
      );
      window.sessionStorage.setItem("ultrarapid_player_entry_intent", "play");
      persistLaunchParams(launchParams);

      setIsCustomizePromptOpen(false);
      router.push(launchUrl);
    } catch (error) {
      launchInFlightRef.current = false;
      setIsLaunching(false);
      setLaunchError(getSongLaunchErrorMessage(error));
    }
  }

  useEffect(() => {
    if (!isCustomizePromptOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsCustomizePromptOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isCustomizePromptOpen]);

  return (
    <>
      <div
        className={`${styles.studentTypography} experience-role-shell`}
        data-experience-role={dashboardType}
        style={{
          minHeight: "100vh",
          background: "var(--ur-canvas-top)",
          color: "#FFFFFF",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        <HeaderBar
          pathname={pathname}
          topTabs={topTabs}
          navBasePath={navBasePath}
          dashboardType={dashboardType}
        />

        <div
          style={{
            height: "15vh",
            minHeight: 110,
            width: "100%",
            background: "var(--ur-canvas-top)",
            borderBottom: "1px solid #FFFFFF14",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              width: pagePanelWidth,
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              alignItems: "flex-start",
              textAlign: "left",
              gap: 4,
            }}
          >
            {selectedActivity ? (
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 7,
                  color: "#CFFF04",
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: "0.02em",
                }}
              >
                <Image
                  src={SongChoiceIcon}
                  alt="Song choice"
                  width={16}
                  height={16}
                  style={{ width: 16, height: 16, display: "block" }}
                  unoptimized
                />
                <span>{selectedActivity.label}</span>
              </div>
            ) : null}

            <h1
              style={{
                margin: 0,
                fontSize: 32,
                fontWeight: 700,
                textAlign: "left",
                color: "#FFFFFF",
                lineHeight: 1.1,
              }}
            >
              {studentCopy.songChoice.title}
            </h1>

            <p
              style={{
                margin: 0,
                color: "rgba(255,255,255,0.55)",
                fontSize: 14,
                fontWeight: 500,
                lineHeight: "20px",
                textAlign: "left",
              }}
            >
              {studentCopy.songChoice.subtitle}
            </p>
          </div>
        </div>

        <div
          style={{
            flex: 1,
            background: "linear-gradient(180deg, #082733 0%, #030E14 100%)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "flex-start",
            padding: "24px 24px 20px",
            boxSizing: "border-box",
          }}
        >
          <div
            style={{
              width: "min(960px, 100%)",
              display: "flex",
              flexDirection: "column",
              gap: 16,
              minHeight: 0,
              flex: 1,
            }}
          >

            <div
              style={{
                width: "100%",
                height: 44,
                background: "rgba(255,255,255,0.08)",
                border: "1px solid rgba(255,255,255,0.16)",
                borderRadius: 12,
                color: "#FFFFFF",
                padding: "0 16px",
                boxSizing: "border-box",
                display: "flex",
                alignItems: "center",
                gap: 10,
                flexShrink: 0,
              }}
            >
            <svg
              aria-hidden="true"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              style={{
                flexShrink: 0,
                opacity: 0.8,
              }}
            >
              <path
                d="M10.8 18.1C14.8317 18.1 18.1 14.8317 18.1 10.8C18.1 6.76832 14.8317 3.5 10.8 3.5C6.76832 3.5 3.5 6.76832 3.5 10.8C3.5 14.8317 6.76832 18.1 10.8 18.1Z"
                stroke="#D1D5DB"
                strokeWidth="2"
              />
              <path
                d="M16.2 16.2L21 21"
                stroke="#D1D5DB"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>

              <input
                type="search"
                className="experience-field"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder={studentCopy.songChoice.searchPlaceholder}
                aria-label={studentCopy.songChoice.searchLabel}
                style={{
                  width: "100%",
                  height: "100%",
                  background: "transparent",
                  border: "none",
                  color: "#FFFFFF",
                  padding: 0,
                  outline: "none",
                  fontSize: 13,
                  fontWeight: 500,
                  lineHeight: "19.5px",
                  textAlign: "left",
                }}
              />
            </div>

            {previewError ? (
              <p
                role="alert"
                className="experience-status"
                data-status="error"
                style={{
                  margin: "8px 0 0",
                  color: "var(--ur-feedback-error)",
                  fontSize: 12,
                  lineHeight: 1.4,
                }}
              >
                {previewError}
              </p>
            ) : null}

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 0,
                flex: 1,
                minHeight: 0,
                overflowY: "auto",
                paddingBottom: 12,
              }}
            >
            {filteredSongs.length > 0 ? (
              filteredSongs.map((song, index) => {
                const isSelected = selectedSongId === song.id;
                const duration =
                  song.durationSeconds ?? durationsById[song.id] ?? null;

                const isPreviewing = previewingSongId === song.id;

                return (
                  <div
                    key={song.id}
                  className="songChoiceRow"
                  data-selected={isSelected ? "true" : "false"}
                    style={{
                      width: "100%",
                      minHeight: 58,
                      background: isSelected
                        ? "rgba(207, 255, 4, 0.12)"
                        : "rgba(255,255,255,0.04)",
                      borderTop: "none",
                      borderRight: "none",
                      borderBottom: isSelected
                        ? "1px solid #CFFF04"
                        : "1px solid rgba(255, 255, 255, 0.08)",
                      borderLeft: isSelected
                        ? "1px solid #CFFF04"
                        : "1px solid transparent",
                      borderRadius:
                        filteredSongs.length === 1
                          ? 12
                          : index === 0
                            ? "12px 12px 0 0"
                            : index === filteredSongs.length - 1
                              ? "0 0 12px 12px"
                              : 0,
                      color: "#FFFFFF",
                      padding: "0 12px 0 0",
                      display: "grid",
                      gridTemplateColumns: "minmax(0, 1fr) 42px",
                      alignItems: "center",
                      columnGap: 8,
                      rowGap: 0,
                      textAlign: "left",
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => handleSelectSong(song)}
                      aria-pressed={isSelected}
                      style={{
                        width: "100%",
                        minWidth: 0,
                        minHeight: 58,
                        background: "transparent",
                        border: 0,
                        color: "#FFFFFF",
                        padding: "0 0 0 18px",
                        cursor: "pointer",
                        display: "grid",
                        gridTemplateColumns: "44px minmax(0, 1fr) 58px",
                        alignItems: "center",
                        columnGap: 18,
                        rowGap: 0,
                        textAlign: "left",
                      }}
                    >
                    <span
                      style={{
                        width: 32,
                        height: 32,
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        overflow: "visible",
                        transform: "translateY(-10px)",
                      }}
                    >
                      <NoteIcon
                        aria-hidden="true"
                        style={{
                          width: 20,
                          height: 20,
                          display: "block",
                          overflow: "visible",
                        }}
                      />
                    </span>

                    <div
                      style={{
                        minWidth: 0,
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "flex-start",
                        justifyContent: "center",
                        gap: 2,
                        textAlign: "left",
                      }}
                    >
                      <span
                        style={{
                          color: "#FFFFFF",
                          fontSize: 14,
                          fontWeight: 500,
                          lineHeight: "20px",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          textAlign: "left",
                          width: "100%",
                        }}
                      >
                        {song.name}
                      </span>

                      <span
                        style={{
                          color: "#D1D5DB",
                          fontSize: 11,
                          fontWeight: 500,
                          lineHeight: "15px",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          textAlign: "left",
                          width: "100%",
                        }}
                      >
                        {song.artist ?? studentCopy.songChoice.unknownArtist}
                      </span>
                    </div>

                    <span
                      style={{
                        color: "#FFFFFF",
                        fontSize: 13,
                        fontWeight: 500,
                        lineHeight: "19.5px",
                        whiteSpace: "nowrap",
                        textAlign: "right",
                        justifySelf: "end",
                      }}
                    >
                      {formatDuration(duration)}
                    </span>

                    </button>

                    <button
                      type="button"
                      onClick={() => void handlePreview(song)}
                      aria-pressed={isPreviewing}
                      aria-label={
                        isPreviewing
                          ? studentCopy.songChoice.pausePreview(song.name)
                          : studentCopy.songChoice.preview(song.name)
                      }
                      title={
                        isPreviewing
                          ? studentCopy.songChoice.pausePreview(song.name)
                          : studentCopy.songChoice.preview(song.name)
                      }
                      style={{
                        width: 28,
                        height: 28,
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        justifySelf: "end",
                        transform: "translateY(2px)",
                        border: 0,
                        borderRadius: 999,
                        background: isPreviewing
                          ? "rgba(207,255,4,0.18)"
                          : "transparent",
                        color: "#FFFFFF",
                        cursor: "pointer",
                        padding: 0,
                      }}
                    >
                      {isPreviewing ? (
                        <span
                          aria-hidden="true"
                          style={{ display: "inline-flex", gap: 3 }}
                        >
                          <span style={{ width: 3, height: 13, background: "#CFFF04" }} />
                          <span style={{ width: 3, height: 13, background: "#CFFF04" }} />
                        </span>
                      ) : (
                        <PlayIcon
                          aria-hidden="true"
                          style={{
                            width: 22,
                            height: 22,
                            display: "block",
                          }}
                        />
                      )}
                    </button>
                  </div>
                );
              })
            ) : (
              <div
                style={{
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.14)",
                  borderRadius: 12,
                  padding: 16,
                }}
              >
                <h2
                  style={{
                    margin: "0 0 8px 0",
                    fontSize: 15,
                    fontWeight: 600,
                  }}
                >
                  {songs.length === 0
                    ? currentActivityKey === "number-bonds"
                      ? "No Number Bonds songs are ready yet"
                      : "No songs are ready yet"
                    : studentCopy.songChoice.noSongsTitle}
                </h2>
                <p
                  style={{
                    margin: 0,
                    color: "#D1D5DB",
                    fontSize: 13,
                    fontWeight: 500,
                    lineHeight: "19.5px",
                  }}
                >
                  {songs.length === 0
                    ? currentActivityKey === "number-bonds"
                      ? "Number Bonds needs a song with a verified rhythm. Create and publish an Early Algebra lesson for a song first, then come back to build its Number Bonds lesson."
                      : "There are no available songs for this activity right now. Try another activity or ask your teacher to add one."
                    : studentCopy.songChoice.noSongsBody}
                </p>
                {songs.length > 0 ? (
                  <button type="button" onClick={() => setSearchQuery("")} className={styles.songChoiceEmptyAction}>
                    Clear search
                  </button>
                ) : currentActivityKey === "number-bonds" ? (
                  <button
                    type="button"
                    onClick={() => router.push(`${navBasePath}/song-choice?activity=early-algebra`)}
                    className={styles.songChoiceEmptyAction}
                  >
                    Browse Early Algebra songs
                  </button>
                ) : null}
              </div>
            )}
            </div>
          </div>
        </div>
      

      <div
        style={{
          height: "8.5vh",
          background: "var(--ur-canvas-top)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 24px",
          boxSizing: "border-box",
          borderTop: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        {selectedSongCanPlay ? <button
            type="button"
            className={styles.songChoicePlayButton}
            disabled={isLaunching}
            aria-busy={isLaunching}
            onClick={() => void handleCustomizeNo()}
            aria-label={`Play ${selectedSong?.name ?? "selected song"} now`}
          >
            {isLaunching ? "Opening game…" : "Play now"}
          </button> : null}
        <span
          role="status"
          aria-live="polite"
          style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)", whiteSpace: "nowrap" }}
        >
          {isLaunching ? "Opening game" : ""}
        </span>
        <button
          type="button"
          className="experience-button experience-button--secondary"
          onClick={() => router.push(`${navBasePath}`)}
          style={{
            border: "1px solid #7A8FA8",
            borderRadius: 999,
            background: "transparent",
            color: "#FFFFFF",
            padding: "10px 24px",
            fontSize: 14,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          {studentCopy.songChoice.back}
        </button>

        <button
          type="button"
          className="experience-button"
          disabled={isLaunching || !selectedSong || selectedSongStatus === "idle" || selectedSongStatus === "loading"}
          aria-busy={isLaunching || selectedSongStatus === "loading"}
          onClick={handleContinue}
          aria-label={selectedSongStatus === "error" ? "Try loading this song again" : `Continue to ${studentCopy.navigation.builder}`}
          title={
            selectedSongStatus === "loading"
              ? studentCopy.songChoice.preparingMessage
              : selectedSongStatus === "error"
                ? "Try loading this song again"
                : selectedSongStatus === "idle"
                  ? "Select a song to continue"
                  : `Continue to ${studentCopy.navigation.builder}`
          }
          style={{
            border: "none",
            borderRadius: 999,
            background:
              selectedSongStatus === "ready"
                ? "#CFFF04"
                : selectedSongStatus === "error"
                  ? "#FFCB6B"
                  : "rgba(207,255,4,0.35)",
            color: selectedSongStatus === "ready" ? "#082733" : "#082733",
            padding: "10px 24px",
            fontSize: 14,
            fontWeight: 700,
            cursor: selectedSongStatus === "error" || selectedSongStatus === "ready" ? "pointer" : "not-allowed",
            opacity: selectedSongStatus === "ready" || selectedSongStatus === "error" ? 1 : 0.7,
          }}
        >
          {selectedSongStatus === "loading"
            ? studentCopy.songChoice.preparing
            : selectedSongStatus === "error"
              ? "Try again"
              : studentCopy.songChoice.continue}
        </button>
      </div>

      {launchError && !isCustomizePromptOpen ? (
        <p className="experience-status" data-status="error" role="alert" aria-live="assertive" style={{ position: "fixed", left: "50%", bottom: "calc(8.5vh + 12px)", transform: "translateX(-50%)", zIndex: 1201, margin: 0, padding: "8px 12px", border: "1px solid var(--ur-feedback-error)", borderRadius: 10, background: "var(--ur-canvas-top)", color: "var(--ur-feedback-error)", textAlign: "center", maxWidth: "min(680px, calc(100vw - 48px))", boxSizing: "border-box" }}>
          {launchError}
        </p>
      ) : null}
      {isCustomizePromptOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="lesson-entry-title"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.64)",
            zIndex: 1200,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
            boxSizing: "border-box",
          }}
        >
          <div
            className="experience-dialog"
            style={{
              width: "min(420px, 92vw)",
              background: "var(--ur-canvas-top)",
              border: "1px solid rgba(255, 255, 255, 0.2)",
              borderRadius: 16,
              boxShadow: "0 24px 80px rgba(0, 0, 0, 0.46)",
              padding: "22px 20px",
              display: "grid",
              gap: 18,
            }}
          >
            <h2
              style={{
                margin: 0,
                color: "#FFFFFF",
                fontSize: 22,
                fontWeight: 800,
                textAlign: "center",
              }}
            >
              <span id="lesson-entry-title">{studentCopy.songChoice.chooseHowToStart}</span>
            </h2>

            <p style={{ margin: 0, color: "#D1D5DB", textAlign: "center", lineHeight: 1.45 }}>
              {selectedSongCanPlay
                ? studentCopy.songChoice.readyToPlayBody
                : studentCopy.songChoice.needsWorkBody}
            </p>

            {launchError ? (
              <p role="alert" style={{ margin: 0, color: "#FFCB6B", textAlign: "center", lineHeight: 1.45 }}>
                {launchError}
              </p>
            ) : null}

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr",
                gap: 12,
              }}
            >
              <button
                type="button"
                onClick={handleCustomizeYes}
                aria-label={studentCopy.songChoice.makeCopy}
                style={{
                  border: "none",
                  borderRadius: 999,
                  background: "#CFFF04",
                  color: "#082733",
                  padding: "10px 18px",
                  fontSize: 14,
                  fontWeight: 800,
                  cursor: "pointer",
                }}
              >
                <span>{studentCopy.songChoice.makeCopy}</span>
                <small style={{ display: "block", fontWeight: 600 }}>{studentCopy.songChoice.makeCopyBody}</small>
              </button>

              <button
                type="button"
                onClick={handleCustomizeNo}
                disabled={!selectedSongCanPlay}
                  aria-label={studentCopy.songChoice.playLesson}
                title={selectedSongCanPlay ? studentCopy.songChoice.playLessonBody : "Finish the lesson before playing"}
                style={{
                  border: "1px solid #7A8FA8",
                  borderRadius: 999,
                  background: selectedSongCanPlay ? "transparent" : "rgba(255,255,255,0.06)",
                  color: selectedSongCanPlay ? "#FFFFFF" : "#7A8FA8",
                  padding: "10px 18px",
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: selectedSongCanPlay ? "pointer" : "not-allowed",
                  opacity: selectedSongCanPlay ? 1 : 0.65,
                }}
              >
                <span>{studentCopy.songChoice.playLesson}</span>
                <small style={{ display: "block", fontWeight: 600 }}>{studentCopy.songChoice.playLessonBody}</small>
              </button>

              <button type="button" onClick={() => setIsCustomizePromptOpen(false)} aria-label={studentCopy.songChoice.chooseDifferentSong} style={{ border: 0, background: "transparent", color: "#FFFFFF", padding: 8, cursor: "pointer", textDecoration: "underline" }}>
                {studentCopy.songChoice.chooseDifferentSong}
              </button>
            </div>
          </div>
        </div>
      ) : null}

        <style jsx global>{`
          @media (prefers-reduced-motion: reduce) {
            .${styles.songChoicePlayButton} { transition-duration: 0ms !important; }
          }

          .songChoiceRow:hover {
            background: rgba(207, 255, 4, 0.12) !important;
            border-bottom-color: #cfff04 !important;
            border-left-color: #cfff04 !important;
          }

          .songChoiceRow[data-selected="true"] {
            background: rgba(207, 255, 4, 0.12) !important;
            border-bottom-color: #cfff04 !important;
            border-left-color: #cfff04 !important;
          }

          .songChoiceRow[data-selected="false"] {
            border-left-color: transparent !important;
          }

          input[type="search"]::placeholder {
            color: #d1d5db;
            opacity: 1;
          }

          input[type="search"]::-webkit-search-cancel-button {
            filter: invert(1);
          }
        `}</style>
      </div>

    </>
  );
}
