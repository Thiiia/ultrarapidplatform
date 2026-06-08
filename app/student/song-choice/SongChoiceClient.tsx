"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { FC, SVGProps } from "react";
import { useEffect, useMemo, useState } from "react";
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
  equation_slots?: number | null;
  equationSlots?: number | null;
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
const pageBackgroundColor = "#191919";

const headerStyles = {
  backgroundColor: "#2B2B2B",
  borderBottomColor: "#FFFFFF14",
};

function getEquationSlots(song: SongChoiceWithEquationSlots) {
  const rawSlots = song.equation_slots ?? song.equationSlots ?? 0;
  const parsedSlots =
    typeof rawSlots === "number" ? rawSlots : Number.parseInt(String(rawSlots), 10);

  if (!Number.isFinite(parsedSlots)) {
    return 0;
  }

  return Math.max(0, Math.floor(parsedSlots));
}

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
                    textDecoration: "none",
                    background: "#2B2B2B",
                    borderBottom:
                      dashboardType === "teacher"
                        ? isActive
                          ? "3px solid #CFFF04"
                          : "3px solid transparent"
                        : undefined,
                    color: "#FFFFFF",
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
        background: "#2B2B2B",
        width: "100%",
        borderBottom: "1px solid #FFFFFF14",
      }}
    >
      <section
        style={{
          background: "#2B2B2B",
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

  const topTabs =
    dashboardType === "teacher"
      ? getTeacherTopTabs(navBasePath)
      : getStudentTopTabs(navBasePath);

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSongId, setSelectedSongId] = useState<string | null>(null);
  const [durationsById, setDurationsById] = useState<Record<string, number>>(
    {},
  );

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
    return songs.find((song) => song.id === selectedSongId) ?? null;
  }, [selectedSongId, songs]);

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

  function handleContinue() {
    if (!selectedSong) {
      return;
    }

    window.sessionStorage.setItem(
      "ultrarapid_selected_song",
      JSON.stringify({
        id: selectedSong.id,
        name: selectedSong.name,
        title: selectedSong.title,
        artist: selectedSong.artist,
        equation_slots: getEquationSlots(selectedSong),
        equationSlots: getEquationSlots(selectedSong),

        song: {
          bucket: selectedSong.song.bucket,
          path: selectedSong.song.path,
          signedUrl: selectedSong.song.signedUrl,
          contentType: selectedSong.song.contentType,
        },

        chart: {
          bucket: selectedSong.chart.bucket,
          path: selectedSong.chart.path,
          signedUrl: selectedSong.chart.signedUrl,
          contentType: selectedSong.chart.contentType,
        },

        sidecar: selectedSong.sidecar
          ? {
              bucket: selectedSong.sidecar.bucket,
              path: selectedSong.sidecar.path,
              signedUrl: selectedSong.sidecar.signedUrl,
              contentType: selectedSong.sidecar.contentType,
            }
          : null,
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
      <HeaderBar
        pathname={pathname}
        topTabs={topTabs}
        navBasePath={navBasePath}
        dashboardType={dashboardType}
      />

      <LessonBuilderPanel />

      <main
        style={{
          background: pageBackgroundColor,
          width: "100%",
          flex: 1,
          position: "relative",
        }}
      >
        <section
          style={{
            width: pagePanelWidth,
            margin: "0 auto",
            padding: "20px 0 96px 0",
            boxSizing: "border-box",
            position: "relative",
          }}
        >
          <div
            style={{
              width: "100%",
              height: 44,
              background: "#2B2B2B",
              border: "1px solid #FFFFFF14",
              borderRadius: 12,
              color: "#FFFFFF",
              padding: "0 16px",
              boxSizing: "border-box",
              display: "flex",
              alignItems: "center",
              gap: 10,
              marginBottom: 16,
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
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search for a song"
              aria-label="Search for a song"
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

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 0,
              maxHeight: "calc(100vh - 320px)",
              minHeight: 240,
              overflowY: "auto",
              paddingBottom: 92,
            }}
          >
            {filteredSongs.length > 0 ? (
              filteredSongs.map((song, index) => {
                const isSelected = selectedSongId === song.id;
                const duration =
                  song.durationSeconds ?? durationsById[song.id] ?? null;

                return (
                  <button
                    key={song.id}
                    type="button"
                    onClick={() => setSelectedSongId(song.id)}
                    className="songChoiceRow"
                    data-selected={isSelected ? "true" : "false"}
                    style={{
                      width: "100%",
                      minHeight: 58,
                      background: isSelected
                        ? "rgba(207, 255, 4, 0.12)"
                        : "#2B2B2B",
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
                      padding: "0 24px 0 18px",
                      cursor: "pointer",
                      display: "grid",
                      gridTemplateColumns: "44px minmax(0, 1fr) 58px 28px",
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
                        {song.artist ?? "Unknown artist"} · {getEquationSlots(song)} equation slots
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

                    <span
                      style={{
                        width: 28,
                        height: 28,
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        justifySelf: "end",
                        transform: "translateY(2px)",
                      }}
                    >
                      <PlayIcon
                        aria-hidden="true"
                        style={{
                          width: 22,
                          height: 22,
                          display: "block",
                        }}
                      />
                    </span>
                  </button>
                );
              })
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
                  No matching songs
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
                  Try a different search term.
                </p>
              </div>
            )}
          </div>

          <div
            style={{
              position: "sticky",
              bottom: 0,
              marginTop: -71,
              height: 71,
              minHeight: 71,
              width: "100vw",
              marginLeft: "calc((85vw - 100vw) / 2)",
              marginRight: "calc((85vw - 100vw) / 2)",
              background: "#2B2B2B",
              borderTop: "1px solid #FFFFFF14",
              borderRight: "none",
              borderBottom: "none",
              borderLeft: "none",
              borderRadius: 0,
              padding: "0 30px",
              boxSizing: "border-box",
              display: "flex",
              alignItems: "center",
              justifyContent: "flex-end",
              gap: 12,
              boxShadow: "0 -12px 32px rgba(0, 0, 0, 0.28)",
              zIndex: 5,
            }}
          >
            <button
              type="button"
              disabled={!selectedSong}
              onClick={handleContinue}
              aria-label="Continue to Lesson Builder"
              style={{
                width: 132,
                height: 64,
                border: "none",
                borderRadius: 12,
                background: "transparent",
                padding: 0,
                cursor: selectedSong ? "pointer" : "not-allowed",
                opacity: selectedSong ? 1 : 0.4,
                flexShrink: 0,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <img
                src="/Next_Button.svg"
                alt=""
                aria-hidden="true"
                style={{
                  width: 132,
                  height: 64,
                  display: "block",
                  objectFit: "contain",
                }}
              />
            </button>
          </div>
        </section>
      </main>

      <style jsx global>{`
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
  );
}