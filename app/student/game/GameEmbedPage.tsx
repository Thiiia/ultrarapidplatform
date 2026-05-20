"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useMemo } from "react";
import type { FC, SVGProps } from "react";
import styles from "../student.module.css";

/* Header Icon imports */
import URIcon from "@/public/header_icons/URIcon.svg";
import HomeIcon from "@/public/header_icons/Home.svg";
import MyLessonsTab from "@/public/header_icons/my_lessons_tab.svg";
import LessonBuilderTab from "@/public/header_icons/lesson_builder_tab_pressed.svg";
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

function getGameHref(navBasePath: string, launch?: string) {
  const href = `${navBasePath}/game`;

  if (!launch) {
    return href;
  }

  return `${href}?launch=${encodeURIComponent(launch)}`;
}

function getEmbeddedGameUrl(launch: string | null) {
  if (!launch) {
    return GAME_URL;
  }

  try {
    const url = new URL(GAME_URL);
    url.searchParams.set("launch", launch);
    return url.toString();
  } catch {
    const separator = GAME_URL.includes("?") ? "&" : "?";
    return `${GAME_URL}${separator}launch=${encodeURIComponent(launch)}`;
  }
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

export default function GameEmbedPage({
  navBasePath = "/student",
}: GameEmbedPageProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const topTabs = getTopTabs(navBasePath);
  const headerGameHref = getGameHref(navBasePath);

  const embeddedGameUrl = useMemo(() => {
    return getEmbeddedGameUrl(searchParams.get("launch"));
  }, [searchParams]);

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
      <HeaderBar
        pathname={pathname}
        topTabs={topTabs}
        gameHref={headerGameHref}
      />

      <main
        style={{
          width: "100%",
          flex: 1,
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
            display: "flex",
            flexDirection: "column",
            gap: 12,
          }}
        >
          <div
            style={{
              background: headerBackgroundColor,
              border: `1px solid ${subtleBorderColor}`,
              borderRadius: 12,
              padding: 12,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            <div>
              <h1 style={{ margin: 0, fontSize: 18 }}>UltraRapid Game</h1>
              <p style={{ margin: "4px 0 0 0", color: "#D1D5DB", fontSize: 13 }}>
                The game is embedded below.
              </p>
            </div>

            <a
              href={embeddedGameUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                color: "#FFFFFF",
                textDecoration: "none",
                border: `1px solid ${subtleBorderColor}`,
                borderRadius: 8,
                padding: "8px 12px",
                background: pageBackgroundColor,
                fontSize: 13,
                fontWeight: 500,
              }}
            >
              Open in new tab
            </a>
          </div>

          <iframe
            src={embeddedGameUrl}
            title="UltraRapid Game"
            allow="fullscreen; gamepad; autoplay"
            allowFullScreen
            style={{
              width: "100%",
              height: "calc(100vh - 170px)",
              minHeight: 640,
              border: `1px solid ${subtleBorderColor}`,
              borderRadius: 12,
              background: "#000000",
            }}
          />
        </section>
      </main>
    </div>
  );
}