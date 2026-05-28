"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { FC, SVGProps } from "react";
import { useEffect, useMemo, useState } from "react";
import { useEditorStore } from "@/lib/editor/editor-store";
import { chartToProject } from "@/lib/editor/chart-to-project";
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

type SelectedSongPayload = {
  id: string;
  name: string;
  title?: string;
  artist?: string | null;

  song: {
    bucket: string;
    path: string;
    signedUrl: string;
    contentType: string | null;
  };

  chart: {
    bucket: string;
    path: string;
    signedUrl: string;
    contentType: string | null;
  };

  sidecar: {
    bucket: string;
    path: string;
    signedUrl: string;
    contentType: string | null;
  } | null;
};

type TabIcon = FC<SVGProps<SVGSVGElement>>;

type HeaderTab = {
  label: string;
  href: string;
  Icon: TabIcon;
  ActiveIcon: TabIcon;
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

function getTopTabs(navBasePath = "/student"): HeaderTab[] {
  return [
    {
      label: "Home",
      href: navBasePath,
      Icon: HomeIcon,
      ActiveIcon: HomePressedIcon,
      width: 99,
    },
    {
      label: "My Lessons",
      href: `${navBasePath}/lessons`,
      Icon: MyLessonsTab,
      ActiveIcon: MyLessonsPressedTab,
      width: 139,
    },
    {
      label: "Lesson Builder",
      href: `${navBasePath}/song-choice`,
      Icon: LessonBuilderTab,
      ActiveIcon: LessonBuilderPressedTab,
      width: 159,
    },
    {
      label: "Progress",
      href: `${navBasePath}/progress`,
      Icon: ProgressTab,
      ActiveIcon: ProgressPressedTab,
      width: 120,
    },
    {
      label: "Play",
      href: `${navBasePath}/game`,
      Icon: PlayTab,
      ActiveIcon: PlayPressedTab,
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

async function fileFromSignedUrl({
  signedUrl,
  path,
  name,
  contentType,
}: {
  signedUrl: string;
  path: string;
  name: string;
  contentType: string | null;
}) {
  const response = await fetch(signedUrl);

  if (!response.ok) {
    throw new Error(`Unable to load file: ${response.status}`);
  }

  const blob = await response.blob();
  const extension = path.split(".").pop();
  const fileName = extension ? `${name}.${extension}` : name;

  return new File([blob], fileName, {
    type: contentType ?? blob.type,
  });
}

async function textFromSignedUrl(signedUrl: string) {
  const response = await fetch(signedUrl);

  if (!response.ok) {
    throw new Error(`Unable to load text file: ${response.status}`);
  }

  return response.text();
}

async function jsonFromSignedUrl(signedUrl: string) {
  const response = await fetch(signedUrl);

  if (!response.ok) {
    throw new Error(`Unable to load JSON file: ${response.status}`);
  }

  return response.json();
}

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

              const Icon = isActive ? tab.ActiveIcon : tab.Icon;

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

function EmptyEditorTopPanel() {
  return (
    <section
      aria-label="Lesson builder controls"
      style={{
        width: "100%",
        minHeight: 96,
        background: headerBackgroundColor,
        borderBottom: `1px solid ${subtleBorderColor}`,
        boxSizing: "border-box",
      }}
    />
  );
}

function WorkspacePanel({
  title,
  width,
  background,
  children,
}: {
  title?: string;
  width: string;
  background: string;
  children?: React.ReactNode;
}) {
  return (
    <section
      style={{
        width,
        height: "calc(100vh - 166px)",
        minHeight: "calc(100vh - 166px)",
        background,
        color: textColor,
        borderRight: `1px solid ${subtleBorderColor}`,
        boxSizing: "border-box",
        overflow: "hidden",
      }}
    >
      {title ? (
        <div
          style={{
            padding: "18px 16px",
            borderBottom: `1px solid ${subtleBorderColor}`,
            color: textColor,
            fontFamily: "Space Grotesk, sans-serif",
            fontSize: 13,
            fontWeight: 700,
            lineHeight: "19.5px",
            letterSpacing: 0,
            textAlign: "left",
          }}
        >
          {title}
        </div>
      ) : null}

      {children}
    </section>
  );
}

function CenterEditorPanel() {
  const subpanels = ["", "Lyrics", "Strings", "Bass", "Drums"];

  return (
    <section
      style={{
        width: "75vw",
        height: "calc(100vh - 166px)",
        minHeight: "calc(100vh - 166px)",
        background: "#191919",
        color: textColor,
        boxSizing: "border-box",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        justifyContent: "flex-end",
      }}
    >
      {subpanels.map((title, index) => (
        <div
          key={`${title}-${index}`}
          style={{
            width: "100%",
            height: "6vh",
            minHeight: "6vh",
            background: "#2B2B2B",
            borderTop: index === 0 ? `1px solid ${subtleBorderColor}` : "none",
            borderBottom: `1px solid ${subtleBorderColor}`,
            boxSizing: "border-box",
            display: "flex",
            alignItems: "center",
            padding: "0 18px",
            color: textColor,
            fontFamily: "Space Grotesk, sans-serif",
            fontSize: 13,
            fontWeight: 700,
            lineHeight: "19.5px",
            letterSpacing: 0,
            textAlign: "left",
          }}
        >
          {title}
        </div>
      ))}
    </section>
  );
}

export default function LessonBuilderClient({
  navBasePath = "/student",
}: LessonBuilderClientProps) {
  const pathname = usePathname();
  const topTabs = useMemo(() => getTopTabs(navBasePath), [navBasePath]);
  const setProject = useEditorStore((s) => s.setProject);

  const [chartFile, setChartFile] = useState("");
  const [metadata, setMetadata] = useState<LessonBuilderPayload["analysisMetadata"]>();
  const [uploadedSongName, setUploadedSongName] = useState("");
  const [uploadedChartName, setUploadedChartName] = useState("");
  const [pendingSongFile, setPendingSongFile] = useState<File | null>(null);

  /*
   * Editor display panels are intentionally hidden for the new layout.
   * The state above is kept so selected songs/charts can still hydrate
   * editor data through chartToProject and useEditorStore.
   */

  useEffect(() => {
    const raw = sessionStorage.getItem("ultrarapid_selected_song");

    if (!raw) {
      return;
    }

    try {
      const selectedSong: SelectedSongPayload = JSON.parse(raw);

      setUploadedSongName(selectedSong.name);
      setMetadata((current) => ({
        ...current,
        songTitle: selectedSong.title ?? selectedSong.name,
        artist: selectedSong.artist ?? current?.artist,
        uploadedFileName: selectedSong.song.path,
      }));

      fileFromSignedUrl({
        signedUrl: selectedSong.song.signedUrl,
        path: selectedSong.song.path,
        name: selectedSong.name,
        contentType: selectedSong.song.contentType,
      })
        .then((file) => {
          setPendingSongFile(file);
        })
        .catch((error) => {
          console.error("Failed to load selected song file", error);
        });

      Promise.all([
        textFromSignedUrl(selectedSong.chart.signedUrl),
        selectedSong.sidecar
          ? jsonFromSignedUrl(selectedSong.sidecar.signedUrl)
          : Promise.resolve(null),
      ])
        .then(([nextChartFile, sidecarJson]) => {
          const nextChartName =
            selectedSong.chart.path.split("/").pop() ?? "selected.chart";

          setChartFile(nextChartFile);
          setUploadedChartName(nextChartName);

          const payload: LessonBuilderPayload = {
            chartFile: nextChartFile,
            analysisMetadata: {
              songTitle: selectedSong.title ?? selectedSong.name,
              artist: selectedSong.artist ?? undefined,
              uploadedFileName: selectedSong.song.path,
            },
            rawResults: sidecarJson,
          };

          const project = chartToProject(payload);
          setProject(project);
        })
        .catch((error) => {
          console.error("Failed to load selected chart or sidecar JSON", error);
        });
    } catch (error) {
      console.error("Failed to parse selected song package", error);
    }
  }, [setProject]);

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
    if (!pendingSongFile) return;

    /*
     * Song file is loaded and kept in state for editor logic.
     * The previous visible EditorShell file input syncing is disabled
     * while the editor display is being rebuilt.
     */
    console.info("Selected song file loaded for editor:", pendingSongFile.name);
  }, [pendingSongFile]);

  useEffect(() => {
    if (!chartFile.trim()) return;

    console.info("Chart file loaded for editor:", {
      chartName: uploadedChartName,
      songName: uploadedSongName,
      metadata,
    });
  }, [chartFile, uploadedChartName, uploadedSongName, metadata]);

  return (
    <div
      className={styles.studentTypography}
      style={{
        minHeight: "100vh",
        background: pageBackgroundColor,
        color: textColor,
        display: "flex",
        flexDirection: "column",
        overflowX: "hidden",
      }}
    >
      <HeaderBar pathname={pathname} topTabs={topTabs} />

      <EmptyEditorTopPanel />

      <main
        style={{
          width: "100%",
          height: "calc(100vh - 166px)",
          display: "flex",
          alignItems: "stretch",
          background: pageBackgroundColor,
          color: textColor,
          overflow: "hidden",
        }}
      >
        <WorkspacePanel
          title="Equation Blocks"
          width="12.5vw"
          background="#2B2B2B"
        />

        <CenterEditorPanel />

        <WorkspacePanel
          title="Teacher Feedback"
          width="12.5vw"
          background="#2B2B2B"
        />
      </main>
    </div>
  );
}