"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { FC, SVGProps } from "react";
import { useEffect, useState } from "react";
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

const pagePanelWidth = "85vw";
const headerBackgroundColor = "#2B2B2B";
const pageBackgroundColor = "#191919";
const subtleBorderColor = "#FFFFFF14";

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
          {utilityTabs.map((tab) => {
            const iconHeight = 38;

            return (
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
                    height: iconHeight,
                    display: "block",
                  }}
                />
              </Link>
            );
          })}

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

function SelectionField({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <label
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 6,
        minWidth: 220,
        color: "#FFFFFF",
        textAlign: "left",
      }}
    >
      <span
        style={{
          color: "#FFFFFF",
          fontSize: 13,
          fontWeight: 500,
          lineHeight: "19.5px",
          letterSpacing: 0,
          textAlign: "left",
        }}
      >
        {label}
      </span>
      <select
        value={value}
        onChange={() => undefined}
        style={{
          width: "100%",
          height: 38,
          background: pageBackgroundColor,
          border: `1px solid ${subtleBorderColor}`,
          borderRadius: 8,
          color: "#FFFFFF",
          fontFamily: "Space Grotesk, sans-serif",
          fontSize: 13,
          fontWeight: 500,
          lineHeight: "19.5px",
          letterSpacing: 0,
          padding: "0 12px",
          textAlign: "left",
        }}
      >
        <option value={value}>{value}</option>
      </select>
    </label>
  );
}

function EditorSelectionBar({
  chartFile,
  metadata,
}: {
  chartFile: string;
  metadata?: EditorRedirectPayload["analysisMetadata"];
}) {
  const songTitle = metadata?.songTitle?.trim() || "No song selected";
  const artist = metadata?.artist?.trim();
  const songValue = artist ? `${songTitle} - ${artist}` : songTitle;
  const chartValue = chartFile || metadata?.uploadedFileName || "No chart selected";

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
          minHeight: 86,
          margin: "0 auto",
          boxSizing: "border-box",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 24,
          color: "#FFFFFF",
        }}
      >
        <h1
          className={styles.panelTitle}
          style={{
            margin: 0,
            color: "#FFFFFF",
            flexShrink: 0,
          }}
        >
          Editor
        </h1>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
            gap: 16,
            flexWrap: "wrap",
          }}
        >
          <SelectionField label="Song" value={songValue} />
          <SelectionField label="Chart" value={chartValue} />
        </div>
      </div>
    </section>
  );
}

export default function EditorPage() {
  const pathname = usePathname();
  const setProject = useEditorStore((s) => s.setProject);
  const [chartFile, setChartFile] = useState("");
  const [metadata, setMetadata] = useState<EditorRedirectPayload["analysisMetadata"]>();

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
        const project = chartToProject(payload);
        setProject(project);
      }

      sessionStorage.removeItem("ultrarapid_editor_payload");
    } catch (error) {
      console.error("Failed to hydrate editor payload", error);
    }
  }, [setProject]);

  return (
    <div
      className={styles.studentTypography}
      style={{
        minHeight: "100vh",
        background: pageBackgroundColor,
        color: "#FFFFFF",
        display: "flex",
        flexDirection: "column",
        overflowX: "hidden",
      }}
    >
      <HeaderBar pathname={pathname} />
      <EditorSelectionBar chartFile={chartFile} metadata={metadata} />

      <main
        style={{
          width: "100%",
          background: pageBackgroundColor,
          color: "#FFFFFF",
          overflowX: "hidden",
        }}
      >
        <div
          style={{
            width: pagePanelWidth,
            margin: "0 auto",
            boxSizing: "border-box",
            background: pageBackgroundColor,
            color: "#FFFFFF",
          }}
        >
          <EditorShell chartFile={chartFile} />
        </div>
      </main>
    </div>
  );
}
