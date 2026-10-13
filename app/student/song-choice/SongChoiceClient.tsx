"use client";
import {
  requestFreshSongLaunchPackage,
  type FreshSongLaunchPackage,
} from "@/lib/song-launch-client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { persistLaunchParams } from "@/lib/launch-handoff";
import { createSongLaunchNavigationParams } from "@/lib/platform-launch";
import { appendSongFlowDebug } from "@/lib/song-flow-debug";
import { assertSongActivityMatches } from "@/lib/song-activity-authority";
import {
  fetchId3FrontCover,
  getSongChoiceCoverArt,
} from "@/lib/song-artwork";
import { normalizeSongActivityKey } from "@/lib/song-activity-storage";
import {
  buildSongSelectionCacheKey,
  getPlayerLaunchRoute,
  getSongLaunchErrorMessage,
  isPlayableSongLaunchPackage,
  type SongPackageLoadStatus,
} from "@/lib/song-choice-flow";
import { studentCopy } from "@/lib/student-copy";
import ExperienceMobileNavigation from "@/app/components/ExperienceMobileNavigation";
import type { SongChoice } from "@/lib/song-storage";
import styles from "../student.module.css";
import songStyles from "./song-choice.module.css";

/* Brand mark */
import URIcon from "@/public/header_icons/URIcon.svg";
import SongChoiceIcon from "@/public/song-choice_icons/song_choice_icon.png";

/* Song Choice Icon Imports */
import PlayIcon from "@/public/song_choice_icons/Play_Icon.svg";

type DashboardType = "student" | "teacher";
type SongChoiceViewMode = "grid" | "list";

const SONG_CHOICE_VIEW_MODE_STORAGE_KEY = "ultrarapid:song-choice:view-mode";

type HeaderTab = {
  label: string;
  href: string;
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
    },
    {
      label: studentCopy.navigation.lessons,
      href: `${navBasePath}/lessons`,
    },
    {
      label: studentCopy.navigation.builder,
      href: `${navBasePath}/song-choice`,
    },
    {
      label: studentCopy.navigation.progress,
      href: `${navBasePath}/progress`,
    },
    {
      label: studentCopy.navigation.play,
      href: `${navBasePath}/game`,
    },
  ];
}

function getTeacherTopTabs(navBasePath = "/teacher"): HeaderTab[] {
  return [
    {
      label: "Home",
      href: navBasePath,
    },
    {
      label: "Classes",
      href: `${navBasePath}/classes`,
    },
    {
      label: "Students",
      href: `${navBasePath}/students`,
    },
    {
      label: "Lessons",
      href: `${navBasePath}/lessons`,
    },
    {
      label: "Lesson Builder",
      href: `${navBasePath}/song-choice`,
    },
    {
      label: "Progress",
      href: `${navBasePath}/progress`,
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
  const mobileItems = [
    ...topTabs.map((tab) => ({
      label: tab.label,
      href: tab.href,
      current: pathname === tab.href,
    })),
    {
      label: studentCopy.navigation.profile,
      href: profileHref,
      current: pathname === profileHref,
    },
    { label: studentCopy.navigation.logout, href: "/auth/logout", current: false },
  ];

  return (
    <header
      className="experience-role-header experience-role-header--wide-nav"
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
            aria-label="Dashboard navigation"
            className="experience-navigation experience-desktop-navigation"
            data-experience-component="navigation"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 3,
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
                >
                  {tab.label}
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
          <Link
            href={profileHref}
            prefetch={false}
            aria-label="Profile"
            className={styles.utilityButton}
          >
            {studentCopy.navigation.profile}
          </Link>

          <a
            href="/auth/logout"
            aria-label="Log out"
            className={`${styles.utilityButton} ${styles.logoutButton}`}
          >
            Log out
          </a>
        </div>
        <ExperienceMobileNavigation
          items={mobileItems}
          label={dashboardType === "teacher" ? "Teacher" : "Student"}
        />
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
  const [songViewMode, setSongViewMode] = useState<SongChoiceViewMode>("grid");
  const [hasLoadedSongViewPreference, setHasLoadedSongViewPreference] =
    useState(false);
  const [selectedSongId, setSelectedSongId] = useState<string | null>(null);
  const [isCustomizePromptOpen, setIsCustomizePromptOpen] = useState(false);
  const customizePromptDialogRef = useRef<HTMLDialogElement | null>(null);
  const [isLaunching, setIsLaunching] = useState(false);
  const [launchError, setLaunchError] = useState("");
  const [durationsById, setDurationsById] = useState<Record<string, number>>(
    {},
  );
  const durationsByIdRef = useRef<Record<string, number>>({});
  const durationLoadsRef = useRef(new Set<string>());
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
  const [coverArtBySongId, setCoverArtBySongId] = useState<Record<string, string>>({});
  const [failedCoverArtBySongId, setFailedCoverArtBySongId] = useState<
    Record<string, string>
  >({});

  useEffect(() => {
    try {
      const savedViewMode = window.localStorage.getItem(
        SONG_CHOICE_VIEW_MODE_STORAGE_KEY,
      );
      if (savedViewMode === "grid" || savedViewMode === "list") {
        setSongViewMode(savedViewMode);
      }
    } catch {
      // The selector still works when browser storage is unavailable.
    } finally {
      setHasLoadedSongViewPreference(true);
    }
  }, []);

  useEffect(() => {
    if (!hasLoadedSongViewPreference) return;
    try {
      window.localStorage.setItem(
        SONG_CHOICE_VIEW_MODE_STORAGE_KEY,
        songViewMode,
      );
    } catch {
      // Keep the current choice for this visit when browser storage is blocked.
    }
  }, [hasLoadedSongViewPreference, songViewMode]);

  useEffect(() => {
    const controller = new AbortController();
    const objectUrls: string[] = [];
    let isCurrent = true;
    setCoverArtBySongId({});

    void Promise.all(
      songs.map(async (song) => {
        const audioUrl = song.song.signedUrl || song.signedUrl;
        if (!audioUrl) return null;

        try {
          const cover = await fetchId3FrontCover(audioUrl, controller.signal);
          if (!cover) return null;

          const objectUrl = URL.createObjectURL(cover);
          if (!isCurrent) {
            URL.revokeObjectURL(objectUrl);
            return null;
          }

          objectUrls.push(objectUrl);
          return [song.id, objectUrl] as const;
        } catch {
          // Cover art is optional. Keep the track's designed fallback if the
          // signed audio range request is unavailable or expires.
          return null;
        }
      }),
    ).then((covers) => {
      if (!isCurrent) return;
      const entries = covers.filter(
        (cover): cover is readonly [string, string] => cover !== null,
      );
      setCoverArtBySongId(Object.fromEntries(entries));
    });

    return () => {
      isCurrent = false;
      controller.abort();
      objectUrls.forEach((objectUrl) => URL.revokeObjectURL(objectUrl));
    };
  }, [songs]);

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
  const selectedSongCoverArtSource = selectedSong
    ? getSongChoiceCoverArt(selectedSong.id, coverArtBySongId)
    : null;
  const selectedSongCoverArt =
    selectedSong &&
    selectedSongCoverArtSource &&
    failedCoverArtBySongId[selectedSong.id] !== selectedSongCoverArtSource
      ? selectedSongCoverArtSource
      : null;

  function markCoverArtUnavailable(songId: string, source: string) {
    setFailedCoverArtBySongId((current) =>
      current[songId] === source
        ? current
        : { ...current, [songId]: source },
    );
  }
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
      setLaunchError(studentCopy.songChoice.activityUnavailable);
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
    const activeLoads: Array<{
      songId: string;
      audio: HTMLAudioElement;
      handleLoadedMetadata: () => void;
      handleError: () => void;
    }> = [];

    const releaseAudio = (load: (typeof activeLoads)[number]) => {
      load.audio.removeEventListener("loadedmetadata", load.handleLoadedMetadata);
      load.audio.removeEventListener("error", load.handleError);
      load.audio.pause();
      load.audio.removeAttribute("src");
      load.audio.load();
      durationLoadsRef.current.delete(load.songId);
    };

    songs.forEach((song) => {
      if (song.durationSeconds && song.durationSeconds > 0) {
        durationsByIdRef.current[song.id] = song.durationSeconds;
        return;
      }
      if (
        durationsByIdRef.current[song.id] ||
        durationLoadsRef.current.has(song.id) ||
        !song.signedUrl.trim()
      ) {
        return;
      }

      durationLoadsRef.current.add(song.id);
      const audio = new Audio();
      audio.preload = "metadata";
      const load = {
        songId: song.id,
        audio,
        handleLoadedMetadata: () => {},
        handleError: () => {},
      };

      load.handleLoadedMetadata = () => {
        if (cancelled || !Number.isFinite(audio.duration) || audio.duration <= 0) {
          releaseAudio(load);
          return;
        }

        durationsByIdRef.current[song.id] = audio.duration;
        setDurationsById((current) => ({
          ...current,
          [song.id]: audio.duration,
        }));
        releaseAudio(load);
      };
      load.handleError = () => releaseAudio(load);

      audio.addEventListener("loadedmetadata", load.handleLoadedMetadata);
      audio.addEventListener("error", load.handleError);
      activeLoads.push(load);
      audio.src = song.signedUrl;
      audio.load();
    });

    return () => {
      cancelled = true;
      activeLoads.forEach(releaseAudio);
    };
  }, [songs]);

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

    if (currentActivityKey === "number-bonds" || !selectedSongCanPlay) {
      handleCustomizeYes();
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
      const launchParams = createSongLaunchNavigationParams({
        songAssetId: freshPackage.songAssetId,
        activityKey: freshPackage.activityKey,
        authorId: freshPackage.authorId,
        revision: freshPackage.revision,
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
    const dialog = customizePromptDialogRef.current;
    if (!dialog) return;

    if (isCustomizePromptOpen && !dialog.open) {
      dialog.showModal();
      dialog.querySelector<HTMLElement>("[data-entry-initial-focus]")?.focus();
    } else if (!isCustomizePromptOpen && dialog.open) {
      dialog.close();
    }
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
            minHeight: 150,
            width: "100%",
            padding: "16px 0",
            boxSizing: "border-box",
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
          <div className={songStyles.workspace}>

            <div className={songStyles.songToolbar}>
              <div className={songStyles.searchBox}>
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
                className={songStyles.searchInput}
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder={studentCopy.songChoice.searchPlaceholder}
                aria-label={studentCopy.songChoice.searchLabel}
              />
              </div>

              <div
                className={songStyles.viewModeToggle}
                role="group"
                aria-label="Song layout"
              >
                <button
                  type="button"
                  className={songStyles.viewModeButton}
                  onClick={() => setSongViewMode("grid")}
                  aria-label="Grid view"
                  aria-pressed={songViewMode === "grid"}
                  title="Grid view"
                >
                  <svg aria-hidden="true" width="18" height="18" viewBox="0 0 20 20" fill="none">
                    <rect x="2.5" y="2.5" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.7" />
                    <rect x="11.5" y="2.5" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.7" />
                    <rect x="2.5" y="11.5" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.7" />
                    <rect x="11.5" y="11.5" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.7" />
                  </svg>
                </button>
                <button
                  type="button"
                  className={songStyles.viewModeButton}
                  onClick={() => setSongViewMode("list")}
                  aria-label="List view"
                  aria-pressed={songViewMode === "list"}
                  title="List view"
                >
                  <svg aria-hidden="true" width="18" height="18" viewBox="0 0 20 20" fill="none">
                    <circle cx="3" cy="4" r="1" fill="currentColor" />
                    <circle cx="3" cy="10" r="1" fill="currentColor" />
                    <circle cx="3" cy="16" r="1" fill="currentColor" />
                    <path d="M7 4h10M7 10h10M7 16h10" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
                  </svg>
                </button>
              </div>
            </div>

            <div className={songStyles.songCount} role="status" aria-live="polite">
              <span>
                {filteredSongs.length === songs.length
                  ? songs.length + (songs.length === 1 ? " song" : " songs")
                  : filteredSongs.length + " of " + songs.length + " songs"}
                {" · "}
                {selectedActivity?.label ??
                  (currentActivityKey
                    ? activityLabelMap[currentActivityKey] ?? currentActivityKey
                    : "Choose an activity")}
              </span>
              {searchQuery.trim() ? <span>Search results</span> : <span>Choose a track</span>}
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
              className={songStyles.songGrid}
              data-view-mode={songViewMode}
              role="list"
              aria-label="Available songs"
            >
            {filteredSongs.length > 0 ? (
              filteredSongs.map((song) => {
                const isSelected = selectedSongId === song.id;
                const duration =
                  song.durationSeconds ?? durationsById[song.id] ?? null;
                const isPreviewing = previewingSongId === song.id;
                const coverArtSource = getSongChoiceCoverArt(
                  song.id,
                  coverArtBySongId,
                );
                const coverArt =
                  coverArtSource &&
                  failedCoverArtBySongId[song.id] !== coverArtSource
                    ? coverArtSource
                    : null;
                const artist = song.artist ?? studentCopy.songChoice.unknownArtist;

                return (
                  <article
                    key={song.id}
                    className={songStyles.songCard}
                    data-selected={isSelected ? "true" : "false"}
                    role="listitem"
                  >
                    <button
                      type="button"
                      onClick={() => handleSelectSong(song)}
                      aria-pressed={isSelected}
                      aria-label={"Select " + song.name + " by " + artist}
                      disabled={isLaunching}
                      className={songStyles.songSelect}
                    >
                      <span className={songStyles.artwork} aria-hidden="true">
                        {coverArt ? (
                          <Image
                            src={coverArt}
                            alt=""
                            fill
                            sizes="(max-width: 520px) 104px, (max-width: 760px) 48vw, 25vw"
                            unoptimized
                            referrerPolicy="no-referrer"
                            className={songStyles.coverImage}
                            onError={() =>
                              markCoverArtUnavailable(song.id, coverArt)
                            }
                          />
                        ) : (
                          <span
                            className={songStyles.coverFallback}
                            data-song-id={song.id}
                          >
                            <span className={songStyles.coverMark}>UltraRapid audio</span>
                            <span className={songStyles.coverTitle}>{song.name}</span>
                            <span className={songStyles.coverArtist}>{artist}</span>
                          </span>
                        )}
                        <span className={songStyles.selectedMark} aria-hidden="true">
                          <svg aria-hidden="true" width="13" height="13" viewBox="0 0 16 16" fill="none">
                            <path d="m3.5 8.3 2.8 2.8 6.2-6.2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                          Selected
                        </span>
                      </span>
                      <span className={songStyles.songDetails}>
                        <span className={songStyles.songText}>
                          <span className={songStyles.songName}>{song.name}</span>
                          <span className={songStyles.songArtist}>{artist}</span>
                        </span>
                        <span className={songStyles.songDuration}>{formatDuration(duration)}</span>
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => void handlePreview(song)}
                      aria-pressed={isPreviewing}
                      aria-label={studentCopy.songChoice.preview(song.name)}
                      title={
                        isPreviewing
                          ? studentCopy.songChoice.pausePreview(song.name)
                          : studentCopy.songChoice.preview(song.name)
                      }
                      className={songStyles.previewButton}
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
                  </article>
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
                      ? studentCopy.songChoice.noNumberBondsSongsBody
                      : studentCopy.songChoice.noActivitySongsBody
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
      

      <div className={songStyles.footer}>
        <div className={songStyles.selectionStatus} role="status" aria-live="polite">
          <span className={songStyles.selectionArtwork} aria-hidden="true">
            {selectedSong ? (
              selectedSongCoverArt ? (
                <Image
                  src={selectedSongCoverArt}
                  alt=""
                  fill
                  unoptimized
                  referrerPolicy="no-referrer"
                  sizes="48px"
                  className={songStyles.coverImage}
                  onError={() =>
                    markCoverArtUnavailable(
                      selectedSong.id,
                      selectedSongCoverArt,
                    )
                  }
                />
              ) : (
                <span className={songStyles.coverFallback} data-song-id={selectedSong.id}>
                  <span className={songStyles.coverMark}>UltraRapid audio</span>
                  <span className={songStyles.coverTitle}>{selectedSong.name}</span>
                  <span className={songStyles.coverArtist}>
                    {selectedSong.artist ?? studentCopy.songChoice.unknownArtist}
                  </span>
                </span>
              )
            ) : null}
          </span>
          <span className={songStyles.selectionCopy}>
            <span className={songStyles.selectionTitle}>
              {selectedSong?.name ?? "Choose a track"}
            </span>
            <span className={songStyles.selectionDetail}>
              {!selectedSong
                ? "Select a song to prepare your lesson"
                : selectedSongStatus === "loading"
                  ? studentCopy.songChoice.preparingMessage
                  : selectedSongStatus === "error"
                    ? "This track could not be prepared. Try again."
                    : selectedSongStatus === "ready"
                      ? selectedSongCanPlay
                        ? "Lesson ready · play now or continue"
                        : "Track ready · continue to build your lesson"
                      : "Selected · preparing your lesson"}
            </span>
          </span>
        </div>
        <div className={songStyles.footerActions}>
          {selectedSongCanPlay ? (
            <button
              type="button"
              className={songStyles.playButton}
              disabled={isLaunching}
              aria-busy={isLaunching}
              onClick={() => void handleCustomizeNo()}
              aria-label={`Play ${selectedSong?.name ?? "selected song"} now`}
            >
              {isLaunching ? "Opening game…" : "Play now"}
            </button>
          ) : null}
          <button
            type="button"
            className={songStyles.backButton}
            onClick={() => router.push(navBasePath)}
          >
            {studentCopy.songChoice.back}
          </button>

          <button
            type="button"
            className={songStyles.primaryButton}
            data-status={selectedSongStatus}
            disabled={
              isLaunching ||
              !selectedSong ||
              selectedSongStatus === "idle" ||
              selectedSongStatus === "loading"
            }
            aria-busy={isLaunching || selectedSongStatus === "loading"}
            onClick={handleContinue}
            aria-label={
              selectedSongStatus === "error"
                ? "Try loading this song again"
                : currentActivityKey === "number-bonds"
                  ? "Make and play a Number Bonds mission"
                  : `Continue to ${studentCopy.navigation.builder}`
            }
            title={
              selectedSongStatus === "loading"
                ? studentCopy.songChoice.preparingMessage
                : selectedSongStatus === "error"
                  ? "Try loading this song again"
                  : selectedSongStatus === "idle"
                    ? "Select a song to continue"
                    : currentActivityKey === "number-bonds"
                      ? selectedSongCanPlay
                        ? "Open the published Number Bonds lesson"
                        : "Use the Number Bonds starter in Lesson Builder, then save to play"
                      : `Continue to ${studentCopy.navigation.builder}`
            }
          >
            {selectedSongStatus === "loading"
              ? studentCopy.songChoice.preparing
              : selectedSongStatus === "error"
                ? "Try again"
                : currentActivityKey === "number-bonds"
                  ? selectedSongCanPlay
                    ? "Edit Number Bonds lesson"
                    : "Build Number Bonds lesson"
                  : selectedSongCanPlay
                    ? "Choose how to start"
                    : "Make a lesson"}
          </button>
        </div>
      </div>

      {launchError && !isCustomizePromptOpen ? (
        <p className="experience-status" data-status="error" role="alert" aria-live="assertive" style={{ position: "fixed", left: "50%", bottom: "calc(8.5vh + 12px)", transform: "translateX(-50%)", zIndex: 1201, margin: 0, padding: "8px 12px", border: "1px solid var(--ur-feedback-error)", borderRadius: 10, background: "var(--ur-canvas-top)", color: "var(--ur-feedback-error)", textAlign: "center", maxWidth: "min(680px, calc(100vw - 48px))", boxSizing: "border-box" }}>
          {launchError}
        </p>
      ) : null}
      <dialog
        ref={customizePromptDialogRef}
        className="experience-dialog"
        aria-modal="true"
        aria-labelledby="lesson-entry-title"
        aria-describedby="lesson-entry-description"
        onCancel={(event) => {
          event.preventDefault();
          setIsCustomizePromptOpen(false);
        }}
        style={{
          width: "min(420px, calc(100vw - 40px))",
          boxSizing: "border-box",
          border: "1px solid rgba(255, 255, 255, 0.2)",
          borderRadius: 16,
          background: "var(--ur-canvas-top)",
          color: "#FFFFFF",
          boxShadow: "0 24px 80px rgba(0, 0, 0, 0.46)",
          padding: "22px 20px",
        }}
      >
        <div style={{ display: "grid", gap: 18 }}>
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

          <p id="lesson-entry-description" style={{ margin: 0, color: "#D1D5DB", textAlign: "center", lineHeight: 1.45 }}>
            {selectedSongCanPlay
              ? studentCopy.songChoice.readyToPlayBody
              : selectedSong?.requiresRhythmSource
                ? "This song has beat timing ready to reuse. Choose a number, then press Play to place its notes and start."
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
              data-entry-initial-focus
              className="experience-button"
              aria-label={studentCopy.songChoice.makeCopy}
              style={{
                width: "100%",
                minHeight: 48,
                display: "grid",
                gap: 4,
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
              className="experience-button experience-button--secondary"
              disabled={!selectedSongCanPlay}
              aria-label={studentCopy.songChoice.playLesson}
              title={selectedSongCanPlay ? studentCopy.songChoice.playLessonBody : "Finish the lesson before playing"}
              style={{
                width: "100%",
                minHeight: 48,
                display: "grid",
                gap: 4,
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

            <button type="button" className="experience-button" onClick={() => setIsCustomizePromptOpen(false)} aria-label={studentCopy.songChoice.chooseDifferentSong} style={{ width: "100%", minHeight: 44, border: 0, borderRadius: 8, background: "transparent", color: "#FFFFFF", padding: 8, cursor: "pointer", textDecoration: "underline" }}>
              {studentCopy.songChoice.chooseDifferentSong}
            </button>
          </div>
        </div>
      </dialog>

      </div>

    </>
  );
}
