"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { FC, SVGProps } from "react";
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

type SongChoiceClientProps = {
  songs: SongChoice[];
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

const pagePanelWidth = "85vw";
const pageBackgroundColor = "#191919";

const headerStyles = {
  backgroundColor: "#2B2B2B",
  borderBottomColor: "#FFFFFF14",
};

function formatFileSize(size: number | null) {
  if (!size) {
    return "Unknown size";
  }

  const megabytes = size / 1024 / 1024;

  if (megabytes < 1) {
    return `${Math.round(size / 1024)} KB`;
  }

  return `${megabytes.toFixed(1)} MB`;
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

export default function SongChoiceClient({
  songs,
  navBasePath = "/student",
}: SongChoiceClientProps) {
  const pathname = usePathname();
  const router = useRouter();
  const topTabs = getTopTabs(navBasePath);

  function handleSelectSong(song: SongChoice) {
    window.sessionStorage.setItem(
      "ultrarapid_selected_song",
      JSON.stringify({
        name: song.name,
        path: song.path,
        signedUrl: song.signedUrl,
        contentType: song.contentType,
      }),
    );

    router.push(`${navBasePath}/lesson-builder`);
  }

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
      <HeaderBar pathname={pathname} topTabs={topTabs} />

      <main
        style={{
          background: pageBackgroundColor,
          width: "100%",
          flex: 1,
        }}
      >
        <section
          style={{
            width: pagePanelWidth,
            margin: "0 auto",
            padding: "24px 0",
            boxSizing: "border-box",
          }}
        >
          <h1
            className={styles.panelTitle}
            style={{
              margin: "0 0 8px 0",
              color: "#FFFFFF",
            }}
          >
            Choose a Song
          </h1>

          <p
            style={{
              margin: "0 0 20px 0",
              color: "#D1D5DB",
              fontSize: 13,
              fontWeight: 500,
              lineHeight: "19.5px",
            }}
          >
            Select a song from Supabase Storage to start building a lesson.
          </p>

          {songs.length > 0 ? (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                gap: 15,
              }}
            >
              {songs.map((song) => (
                <button
                  key={song.id}
                  type="button"
                  onClick={() => handleSelectSong(song)}
                  style={{
                    background: "#2B2B2B",
                    border: "1px solid #FFFFFF14",
                    borderRadius: 12,
                    color: "#FFFFFF",
                    padding: 16,
                    minHeight: 116,
                    cursor: "pointer",
                    textAlign: "left",
                  }}
                >
                  <h2
                    style={{
                      margin: "0 0 8px 0",
                      fontSize: 15,
                      fontWeight: 600,
                      lineHeight: "21px",
                      color: "#FFFFFF",
                    }}
                  >
                    {song.name}
                  </h2>

                  <p
                    style={{
                      margin: "0 0 6px 0",
                      color: "#FFFFFF",
                      fontSize: 13,
                      fontWeight: 500,
                      lineHeight: "19.5px",
                    }}
                  >
                    {song.path}
                  </p>

                  <p
                    style={{
                      margin: 0,
                      color: "#D1D5DB",
                      fontSize: 12,
                      fontWeight: 500,
                      lineHeight: "18px",
                    }}
                  >
                    {formatFileSize(song.size)}
                  </p>
                </button>
              ))}
            </div>
          ) : (
            <div
              style={{
                background: "#2B2B2B",
                border: "1px solid #FFFFFF14",
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
                No songs found
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
                Upload audio files to your Supabase Storage bucket, then refresh this page.
              </p>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}