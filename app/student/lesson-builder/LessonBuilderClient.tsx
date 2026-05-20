"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ChangeEvent, FC, SVGProps } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { EditorShell } from "@/components/editor/EditorShell";
import { useEditorStore } from "@/lib/editor/editor-store";
import { chartToProject } from "@/lib/editor/chart-to-project";
import styles from "../student.module.css";

/* Header Icon imports */
import URIcon from "@/public/header_icons/URIcon.svg";
import HomeIcon from "@/public/header_icons/Home.svg";
import MyLessonsTab from "@/public/header_icons/my_lessons_tab.svg";
import LessonBuilderTab from "@/public/header_icons/lesson_builder_tab_pressed.svg";
import ProgressTab from "@/public/header_icons/progress_tab.svg";

/* Utility Icon Imports */
import ProfileIcon from "@/public/utility_icons/profile_icon.svg";

type LessonBuilderPayload = {
  chartFile: string;
  analysisMetadata?: {
    songTitle?: string;
    artist?: string;
    bpm?: number;
    durationSeconds?: number;
    uploadedFileName?: string;
  };
  rawResults?: unknown;
};

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

type LessonBuilderClientProps = {
  navBasePath?: string;
};

function getGameHref(navBasePath: string, launch?: string) {
  const href = `${navBasePath}/game`;

  if (!launch) {
    return href;
  }

  return `${href}?launch=${encodeURIComponent(launch)}`;
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
      href: `${navBasePath}/lesson-builder`,
      Icon: LessonBuilderTab,
      width: 159,
    },
    {
      label: "Progress",
      href: `${navBasePath}/progress`,
      Icon: ProgressTab,
      width: 120,
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

const sharedTextStyle = {
  fontFamily: "Space Grotesk, sans-serif",
  fontSize: 13,
  fontWeight: 500,
  fontStyle: "normal",
  lineHeight: "19.5px",
  letterSpacing: 0,
} as const;

function createBlankChart(songName: string, artist = "Unknown Artist") {
  const safeSongName = songName?.trim() || "Untitled Song";
  const safeArtist = artist?.trim() || "Unknown Artist";

  return [
    "[Song]",
    "{",
    `  Name = "${safeSongName.replace(/"/g, "'")}"`,
    `  Artist = "${safeArtist.replace(/"/g, "'")}"`,
    "  Offset = 0",
    "  Resolution = 240",
    "  Player2 = bass",
    "  Difficulty = 0",
    "  PreviewStart = 0",
    "  PreviewEnd = 0",
    '  Genre = "electronic"',
    '  MediaType = "digital"',
    "}",
    "[SyncTrack]",
    "{",
    "  0 = TS 4",
    "  0 = B 120000",
    "}",
    "[Events]",
    "{",
    '  0 = E "music_start"',
    "}",
    "[ExpertSingle]",
    "{",
    "}",
    "[HardSingle]",
    "{",
    "}",
    "[MediumSingle]",
    "{",
    "}",
    "[EasySingle]",
    "{",
    "}",
    "",
  ].join("\n");
}

function HeaderPlayButton({ href }: { href: string }) {
  return (
    <Link
      href={href}
      aria-label="Play UltraRapid"
      style={{
        textDecoration: "none",
        background: "#191919",
        color: "#FFFFFF",
        border: "1px solid #FFFFFF14",
        borderRadius: 8,
        height: 38,
        padding: "0 14px",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 13,
        fontWeight: 500,
        lineHeight: "19.5px",
        whiteSpace: "nowrap",
      }}
    >
      Play UltraRapid
    </Link>
  );
}

function HeaderBar({
  pathname,
  topTabs,
  gameHref,
}: {
  pathname: string;
  topTabs: HeaderTab[];
  gameHref: string;
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

              const isActive =
                pathname === cleanTabHref ||
                (!isHomeTab &&
                  cleanTabHref !== "/" &&
                  pathname.startsWith(`${cleanTabHref}/`));

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
                  <tab.Icon
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
          <HeaderPlayButton href={gameHref} />

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

function EditorButton({
  children,
  disabled = false,
  onClick,
  width,
}: {
  children: React.ReactNode;
  disabled?: boolean;
  onClick?: () => void;
  width?: number | string;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      style={{
        ...sharedTextStyle,
        minHeight: 38,
        width,
        border: `1px solid ${subtleBorderColor}`,
        borderRadius: 8,
        background: pageBackgroundColor,
        color: textColor,
        padding: "8px 14px",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.55 : 1,
        textAlign: "center",
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
      }}
      title={typeof children === "string" ? children : undefined}
    >
      {children}
    </button>
  );
}

function ChartDropdown({
  onCreateBlankChart,
  onUploadChartClick,
}: {
  onCreateBlankChart: () => void;
  onUploadChartClick: () => void;
}) {
  return (
    <div style={{ width: 260, position: "relative" }}>
      <details
        className="editorChartDropdown"
        style={{ position: "relative", width: "100%" }}
      >
        <summary
          style={{
            ...sharedTextStyle,
            minHeight: 38,
            border: `1px solid ${subtleBorderColor}`,
            borderRadius: 8,
            background: pageBackgroundColor,
            color: textColor,
            padding: "8px 12px",
            cursor: "pointer",
            listStyle: "none",
            textAlign: "center",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 10,
          }}
        >
          <span style={{ flex: 1 }}>Select chart</span>
          <span aria-hidden="true" style={{ fontSize: 12, lineHeight: 1 }}>
            ▾
          </span>
        </summary>
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            left: 0,
            right: 0,
            zIndex: 20,
            background: headerBackgroundColor,
            border: `1px solid ${subtleBorderColor}`,
            borderRadius: 10,
            padding: 8,
            display: "grid",
            gap: 8,
            boxShadow: "0 14px 34px rgba(0, 0, 0, 0.34)",
          }}
        >
          <EditorButton width="100%" onClick={onCreateBlankChart}>
            Create blank chart
          </EditorButton>
          <EditorButton width="100%" onClick={onUploadChartClick}>
            Upload chart
          </EditorButton>
        </div>
      </details>
    </div>
  );
}

function EditorPanel({
  songLabel,
  chartLabel,
  chartSelected,
  chartFile,
  isChartVisible,
  onToggleChartVisible,
  onSongUploadClick,
  onCreateBlankChart,
  onUploadChartClick,
  onLaunchGame,
}: {
  songLabel: string;
  chartLabel: string;
  chartSelected: boolean;
  chartFile: string;
  isChartVisible: boolean;
  onToggleChartVisible: () => void;
  onSongUploadClick: () => void;
  onCreateBlankChart: () => void;
  onUploadChartClick: () => void;
  onLaunchGame: () => void;
}) {
  return (
    <section
      style={{
        width: "100%",
        background: headerBackgroundColor,
        borderBottom: `1px solid ${subtleBorderColor}`,
      }}
    >
      <div
        style={{
          width: pagePanelWidth,
          minHeight: 96,
          margin: "0 auto",
          boxSizing: "border-box",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 20,
          color: textColor,
          flexWrap: "wrap",
          padding: "14px 0",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            flexWrap: "wrap",
          }}
        >
          <div style={{ width: 260 }}>
            <EditorButton width="100%" onClick={onSongUploadClick}>
              {songLabel}
            </EditorButton>
          </div>

          <div style={{ width: 260 }}>
            {chartSelected ? (
              <EditorButton width="100%" disabled>
                {chartLabel}
              </EditorButton>
            ) : (
              <ChartDropdown
                onCreateBlankChart={onCreateBlankChart}
                onUploadChartClick={onUploadChartClick}
              />
            )}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <EditorButton onClick={onLaunchGame} width={160}>
            Play Now
          </EditorButton>

          <EditorButton disabled={!chartFile.trim()} onClick={onToggleChartVisible} width={160}>
            {isChartVisible ? "Hide chart" : "View chart"}
          </EditorButton>
        </div>
      </div>
    </section>
  );
}

function normalizeEditorShellDom() {
  const shell = document.querySelector(".editorPageShell");
  if (!shell) return undefined;

  const hiddenTextFragments = [
    "Upload a song to begin",
    "Inspector",
    "Select a block to edit it",
  ];

  const updateDom = () => {
    const walker = document.createTreeWalker(shell, NodeFilter.SHOW_TEXT);
    const textNodes: Text[] = [];

    while (walker.nextNode()) {
      textNodes.push(walker.currentNode as Text);
    }

    textNodes.forEach((node) => {
      const value = node.nodeValue ?? "";

      if (value.includes("Timeline Panel")) {
        node.nodeValue = value.replace(/Timeline Panel/g, "Timeline");
      }

      if (hiddenTextFragments.some((fragment) => value.includes(fragment))) {
        const parent = node.parentElement;
        const container = parent?.closest(
          "section, aside, [class*='border'], [class*='rounded'], [class*='shadow']",
        ) as HTMLElement | null;
        const target = container ?? parent;

        if (target) {
          target.style.display = "none";
        }
      }
    });
  };

  updateDom();

  const observer = new MutationObserver(updateDom);
  observer.observe(shell, {
    childList: true,
    characterData: true,
    subtree: true,
  });

  return () => observer.disconnect();
}

function syncSongFileIntoEmbeddedLoader(file: File) {
  const shell = document.querySelector(".editorPageShell");
  if (!shell) return false;

  const inputs = Array.from(shell.querySelectorAll('input[type="file"]')) as HTMLInputElement[];
  const target = inputs.find((input) => {
    const accept = (input.getAttribute("accept") || "").toLowerCase();
    return accept.includes(".mp3") || accept.includes(".ogg") || accept.includes("audio/");
  });

  if (!target) return false;

  try {
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(file);
    target.files = dataTransfer.files;
    target.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  } catch (error) {
    console.error("Failed to sync song file into embedded loader", error);
    return false;
  }
}

export default function LessonBuilderClient({
  navBasePath = "/student",
}: LessonBuilderClientProps) {
  const pathname = usePathname();
  const topTabs = useMemo(() => getTopTabs(navBasePath), [navBasePath]);

  const headerGameHref = useMemo(() => getGameHref(navBasePath), [navBasePath]);
  const playNowHref = useMemo(() => getGameHref(navBasePath, "play-now"), [navBasePath]);

  const songUploadInputRef = useRef<HTMLInputElement | null>(null);
  const chartUploadInputRef = useRef<HTMLInputElement | null>(null);

  const setProject = useEditorStore((s) => s.setProject);

  const [chartFile, setChartFile] = useState("");
  const [metadata, setMetadata] = useState<LessonBuilderPayload["analysisMetadata"]>();
  const [uploadedSongName, setUploadedSongName] = useState("");
  const [uploadedChartName, setUploadedChartName] = useState("");
  const [isChartVisible, setIsChartVisible] = useState(false);
  const [pendingSongFile, setPendingSongFile] = useState<File | null>(null);

  const songButtonLabel = useMemo(() => {
    return uploadedSongName.trim() ? uploadedSongName.trim() : "Upload song";
  }, [uploadedSongName]);

  const chartButtonLabel = useMemo(() => {
    return uploadedChartName.trim() ? uploadedChartName.trim() : "No chart selected";
  }, [uploadedChartName]);

  const selectedSongNameForBlankChart = useMemo(() => {
    if (uploadedSongName.trim()) return uploadedSongName.replace(/\.[^/.]+$/, "");
    const title = metadata?.songTitle?.trim();
    if (title) return title;
    return "Untitled Song";
  }, [metadata, uploadedSongName]);

  const applyChartFile = (nextChartFile: string, nextChartName?: string) => {
    setChartFile(nextChartFile);
    setUploadedChartName(nextChartName ?? "");

    const nextPayload: LessonBuilderPayload = {
      chartFile: nextChartFile,
      analysisMetadata: metadata,
    };

    const project = chartToProject(nextPayload);
    setProject(project);
  };

  const handleCreateBlankChart = () => {
    const blankChart = createBlankChart(
      selectedSongNameForBlankChart,
      metadata?.artist,
    );
    applyChartFile(blankChart, "blank.chart");
    setIsChartVisible(false);
  };

  const handleLaunchGame = () => {
    window.location.href = playNowHref;
  };

  const handleSongUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadedSongName(file.name);
    setMetadata((current) => ({
      ...current,
      songTitle: file.name.replace(/\.[^/.]+$/, ""),
      uploadedFileName: file.name,
    }));
    setPendingSongFile(file);

    event.target.value = "";
  };

  const handleChartUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const nextChartFile = typeof reader.result === "string" ? reader.result : "";
      if (!nextChartFile.trim()) return;

      applyChartFile(nextChartFile, file.name);
      setIsChartVisible(false);
    };
    reader.readAsText(file);
    event.target.value = "";
  };

  useEffect(() => {
    if (!pendingSongFile) return;

    let cancelled = false;
    let attempts = 0;

    const trySync = () => {
      if (cancelled) return;

      const synced = syncSongFileIntoEmbeddedLoader(pendingSongFile);
      if (synced) {
        setPendingSongFile(null);
        return;
      }

      attempts += 1;
      if (attempts < 10) {
        window.requestAnimationFrame(trySync);
      }
    };

    trySync();

    return () => {
      cancelled = true;
    };
  }, [pendingSongFile, chartFile, isChartVisible]);

  useEffect(() => {
    const raw = sessionStorage.getItem("ultrarapid_editor_payload");
    if (!raw) return;

    try {
      const payload: LessonBuilderPayload = JSON.parse(raw);

      if (payload?.analysisMetadata) {
        setMetadata(payload.analysisMetadata);
      }

      if (payload?.chartFile) {
        setChartFile(payload.chartFile);
        if (payload.analysisMetadata?.uploadedFileName) {
          setUploadedChartName(payload.analysisMetadata.uploadedFileName);
        }
        const project = chartToProject(payload);
        setProject(project);
      }

      sessionStorage.removeItem("ultrarapid_editor_payload");
    } catch (error) {
      console.error("Failed to hydrate lesson builder payload", error);
    }
  }, [setProject]);

  useEffect(() => {
    return normalizeEditorShellDom();
  }, [chartFile, isChartVisible]);

  return (
    <div
      className={styles.studentTypography}
      style={{
        minHeight: "100vh",
        background: headerBackgroundColor,
        color: textColor,
        display: "flex",
        flexDirection: "column",
        overflowX: "hidden",
      }}
    >
      <HeaderBar pathname={pathname} topTabs={topTabs} gameHref={headerGameHref} />

      <input
        ref={songUploadInputRef}
        type="file"
        accept="audio/*,.mp3,.wav,.m4a,.ogg"
        onChange={handleSongUpload}
        style={{ display: "none" }}
      />
      <input
        ref={chartUploadInputRef}
        type="file"
        accept=".chart,text/plain"
        onChange={handleChartUpload}
        style={{ display: "none" }}
      />

      <EditorPanel
        songLabel={songButtonLabel}
        chartLabel={chartButtonLabel}
        chartSelected={!!uploadedChartName.trim()}
        chartFile={chartFile}
        isChartVisible={isChartVisible}
        onToggleChartVisible={() => setIsChartVisible((current) => !current)}
        onSongUploadClick={() => songUploadInputRef.current?.click()}
        onCreateBlankChart={handleCreateBlankChart}
        onUploadChartClick={() => chartUploadInputRef.current?.click()}
        onLaunchGame={handleLaunchGame}
      />

      {isChartVisible && (
        <section
          style={{
            width: "100%",
            background: headerBackgroundColor,
            borderBottom: `1px solid ${subtleBorderColor}`,
          }}
        >
          <div
            style={{
              width: pagePanelWidth,
              margin: "0 auto",
              padding: "16px 0",
              boxSizing: "border-box",
            }}
          >
            <textarea
              readOnly
              value={chartFile}
              style={{
                ...sharedTextStyle,
                width: "100%",
                minHeight: 220,
                boxSizing: "border-box",
                background: pageBackgroundColor,
                border: `1px solid ${subtleBorderColor}`,
                borderRadius: 12,
                color: textColor,
                padding: 16,
                resize: "vertical",
                textAlign: "left",
                fontFamily: "Space Grotesk, monospace",
              }}
            />
          </div>
        </section>
      )}

      <main
        style={{
          width: "100%",
          background: headerBackgroundColor,
          color: textColor,
          overflowX: "hidden",
        }}
      >
        <div
          className="editorPageShell"
          style={{
            width: pagePanelWidth,
            margin: "0 auto",
            boxSizing: "border-box",
            background: pageBackgroundColor,
            color: textColor,
          }}
        >
          <EditorShell chartFile={chartFile} />
        </div>
      </main>
    </div>
  );
}