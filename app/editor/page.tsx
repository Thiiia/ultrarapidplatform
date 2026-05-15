"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ChangeEvent, FC, SVGProps } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { EditorShell } from "@/components/editor/EditorShell";
import { useEditorStore } from "@/lib/editor/editor-store";
import { chartToProject } from "@/lib/editor/chart-to-project";
import styles from "../student/student.module.css";

/* Header Icon imports */
import URIcon from "@/public/header_icons/URIcon.svg";
import HomeIcon from "@/public/header_icons/Home.svg";
import MyLessonsTab from "@/public/header_icons/my_lessons_tab.svg";
import LessonBuilderTab from "@/public/header_icons/lesson_builder_tab_pressed.svg";
import ProgressTab from "@/public/header_icons/progress_tab.svg";

/* Utility Icon Imports */
// import NotificationsIcon from "@/public/utility_icons/notifications_icon.svg";
// import SettingsIcon from "@/public/utility_icons/settings_icon.svg";
import ProfileIcon from "@/public/utility_icons/profile_icon.svg";

type EditorRedirectPayload = {
  chartFile: string;
  analysisMetadata?: {
    songTitle?: string;
    artist?: string;
    bpm?: number;
    durationSeconds?: number;
    uploadedFileName?: string;
  };
  rawResults?: any;
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

const topTabs: HeaderTab[] = [
  { label: "Home", href: "/student", Icon: HomeIcon, width: 99 },
  { label: "My Lessons", href: "/student/lessons", Icon: MyLessonsTab, width: 139 },
  {
    label: "Lesson Builder",
    href: "/editor",
    Icon: LessonBuilderTab,
    width: 159,
  },
  { label: "Progress", href: "/student/progress", Icon: ProgressTab, width: 120 },
];

const utilityTabs: UtilityTab[] = [
  // { label: "Notifications", href: "/student/notifications", Icon: NotificationsIcon, width: 38 },
  // { label: "Settings", href: "/student/settings", Icon: SettingsIcon, width: 38 },
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
    "  Genre = \"electronic\"",
    "  MediaType = \"digital\"",
    "}",
    "[SyncTrack]",
    "{",
    "  0 = TS 4",
    "  0 = B 120000",
    "}",
    "[Events]",
    "{",
    "  0 = E \"music_start\"",
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

function HeaderBar({ pathname }: { pathname: string }) {
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
              const isActive = pathname === tab.href;

              return (
                <Link
                  key={tab.label}
                  href={tab.href}
                  aria-label={tab.label}
                  className={`${styles.headerTabButton} ${isActive ? styles.headerTabButtonActive : ""}`}
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

function ControlLabel({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        ...sharedTextStyle,
        color: textColor,
        display: "block",
        marginBottom: 6,
        textAlign: "left",
      }}
    >
      {children}
    </span>
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
      }}
    >
      {children}
    </button>
  );
}

function Readout({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        ...sharedTextStyle,
        minHeight: 38,
        border: `1px solid ${subtleBorderColor}`,
        borderRadius: 8,
        background: pageBackgroundColor,
        color: textColor,
        padding: "8px 12px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        minWidth: 220,
        maxWidth: 320,
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
      }}
      title={typeof children === "string" ? children : undefined}
    >
      {children}
    </div>
  );
}

function ChartDropdown({
  chartLabel,
  onCreateBlankChart,
  onUploadChartClick,
}: {
  chartLabel: string;
  onCreateBlankChart: () => void;
  onUploadChartClick: () => void;
}) {
  return (
    <div style={{ width: 260, position: "relative" }}>
      <ControlLabel>Chart</ControlLabel>
      <details className="editorChartDropdown" style={{ position: "relative", width: "100%" }}>
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
          <span
            style={{
              flex: 1,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {chartLabel}
          </span>
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
          <EditorButton width="100%" onClick={onCreateBlankChart}>Create blank chart</EditorButton>
          <EditorButton width="100%" onClick={onUploadChartClick}>Upload chart</EditorButton>
        </div>
      </details>
    </div>
  );
}

function EditorPanel({
  chartLabel,
  chartFile,
  isChartVisible,
  onToggleChartVisible,
  onSongUploadClick,
  onCreateBlankChart,
  onUploadChartClick,
}: {
  chartLabel: string;
  chartFile: string;
  isChartVisible: boolean;
  onToggleChartVisible: () => void;
  onSongUploadClick: () => void;
  onCreateBlankChart: () => void;
  onUploadChartClick: () => void;
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
            alignItems: "flex-end",
            gap: 16,
            flexWrap: "wrap",
          }}
        >
          <div style={{ width: 260 }}>
            <ControlLabel>Song</ControlLabel>
            <EditorButton width="100%" onClick={onSongUploadClick}>Upload song</EditorButton>
          </div>

          <ChartDropdown
            chartLabel={chartLabel}
            onCreateBlankChart={onCreateBlankChart}
            onUploadChartClick={onUploadChartClick}
          />
        </div>

        <EditorButton disabled={!chartFile.trim()} onClick={onToggleChartVisible}>
          {isChartVisible ? "Hide chart" : "View chart"}
        </EditorButton>
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
          "section, aside, [class*='border'], [class*='rounded'], [class*='shadow']"
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

export default function EditorPage() {
  const pathname = usePathname();
  const songUploadInputRef = useRef<HTMLInputElement | null>(null);
  const chartUploadInputRef = useRef<HTMLInputElement | null>(null);
  const setProject = useEditorStore((s) => s.setProject);
  const [chartFile, setChartFile] = useState("");
  const [metadata, setMetadata] = useState<EditorRedirectPayload["analysisMetadata"]>();
  const [uploadedSongName, setUploadedSongName] = useState("");
  const [uploadedChartName, setUploadedChartName] = useState("");
  const [isChartVisible, setIsChartVisible] = useState(false);

  const selectedSongName = useMemo(() => {
    if (uploadedSongName.trim()) return uploadedSongName.trim();

    const title = metadata?.songTitle?.trim();
    const artist = metadata?.artist?.trim();

    if (title && artist) return `${title} - ${artist}`;
    if (title) return title;
    if (metadata?.uploadedFileName?.trim()) return metadata.uploadedFileName.trim();

    return "No song selected";
  }, [metadata, uploadedSongName]);

  const selectedChartLabel = useMemo(() => {
    if (uploadedChartName.trim()) return uploadedChartName.trim();
    if (chartFile.trim()) return "Generated chart loaded";
    return "No chart selected";
  }, [chartFile, uploadedChartName]);

  const applyChartFile = (nextChartFile: string, nextChartName?: string) => {
    setChartFile(nextChartFile);
    setUploadedChartName(nextChartName ?? "");

    const nextPayload: EditorRedirectPayload = {
      chartFile: nextChartFile,
      analysisMetadata: metadata,
    };

    const project = chartToProject(nextPayload);
    setProject(project);
  };

  const handleCreateBlankChart = () => {
    const blankChart = createBlankChart(
      selectedSongName === "No song selected" ? "Untitled Song" : selectedSongName,
      metadata?.artist
    );
    applyChartFile(blankChart, "Blank chart");
    setIsChartVisible(true);
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
      setIsChartVisible(true);
    };
    reader.readAsText(file);
    event.target.value = "";
  };

  useEffect(() => {
    const raw = sessionStorage.getItem("ultrarapid_editor_payload");
    if (!raw) return;

    try {
      const payload: EditorRedirectPayload = JSON.parse(raw);

      if (payload?.analysisMetadata) {
        setMetadata(payload.analysisMetadata);
      }

      if (payload?.chartFile) {
        setChartFile(payload.chartFile);
        setUploadedChartName(payload.analysisMetadata?.uploadedFileName ? "Generated chart loaded" : "");
        const project = chartToProject(payload);
        setProject(project);
      }

      sessionStorage.removeItem("ultrarapid_editor_payload");
    } catch (error) {
      console.error("Failed to hydrate editor payload", error);
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
      <HeaderBar pathname={pathname} />

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
        chartLabel={selectedChartLabel}
        chartFile={chartFile}
        isChartVisible={isChartVisible}
        onToggleChartVisible={() => setIsChartVisible((current) => !current)}
        onSongUploadClick={() => songUploadInputRef.current?.click()}
        onCreateBlankChart={handleCreateBlankChart}
        onUploadChartClick={() => chartUploadInputRef.current?.click()}
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

      <style jsx global>{`
        .editorChartDropdown > summary::-webkit-details-marker {
          display: none;
        }

        .editorPageShell {
          color: #ffffff;
        }

        .editorPageShell * {
          scrollbar-width: none;
        }

        .editorPageShell *::-webkit-scrollbar {
          display: none;
        }

        .editorPageShell [class*="timeline"],
        .editorPageShell [data-panel*="timeline"],
        .editorPageShell [aria-label*="Timeline"] {
          background-color: #2b2b2b !important;
        }

        .editorPageShell > div {
          padding-left: 0 !important;
          padding-right: 0 !important;
        }

        .editorPageShell [class~="grid"][class~="grid-cols-12"] {
          gap: 16px !important;
        }

        /* Hide the original Song Loader card only. Block Palette remains in the sidebar. */
        .editorPageShell [class~="grid"][class~="grid-cols-12"] > div:first-child > *:first-child {
          display: none !important;
        }

        /* Hide the old Lesson Builder/editor header panel. Its controls now live in the custom panel above. */
        .editorPageShell [class~="col-span-8"] > *:first-child {
          display: none !important;
        }

        .editorPageShell [class*="border"],
        .editorPageShell [class*="rounded"],
        .editorPageShell section,
        .editorPageShell aside {
          background-color: #2b2b2b !important;
          border-color: #ffffff14 !important;
          color: #ffffff !important;
        }

        .editorPageShell button,
        .editorPageShell input,
        .editorPageShell select,
        .editorPageShell textarea,
        .editorPageShell [role="button"],
        .editorPageShell [class*="bg-white"],
        .editorPageShell [class*="bg-gray"],
        .editorPageShell [class*="bg-slate"] {
          background-color: #191919 !important;
          border-color: #ffffff14 !important;
          color: #ffffff !important;
        }

        .editorPageShell p,
        .editorPageShell span,
        .editorPageShell h1,
        .editorPageShell h2,
        .editorPageShell h3,
        .editorPageShell h4,
        .editorPageShell label,
        .editorPageShell div {
          color: #ffffff !important;
        }
      `}</style>
    </div>
  );
}
