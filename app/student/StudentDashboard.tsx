"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { StudentDashboardData } from "@/lib/student-dashboard";
import { studentCopy } from "@/lib/student-copy";
import styles from "./student.module.css";

import URIcon from "@/public/header_icons/URIcon.svg";
import HomeIcon from "@/public/header_icons/Home.svg";
import HomePressedIcon from "@/public/header_icons/Home_pressed.svg";
import MyLessonsTab from "@/public/header_icons/my_lessons_tab.svg";
import MyLessonsPressedTab from "@/public/header_icons/my_lessons_tab_pressed.svg";
import LessonBuilderTab from "@/public/header_icons/lesson_builder_tab.svg";
import LessonBuilderPressedTab from "@/public/header_icons/lesson_builder_tab_pressed.svg";
import CheckIcon from "@/public/check.svg";
import CircleCheckIcon from "@/public/circle_check.svg";
import ControllerIcon from "@/public/controller.svg";
import PlayIcon from "@/public/Next_Button.svg";
import numberBondsImage from "@/public/numeracy_icons/number_bonds.png";
import missingNumbersImage from "@/public/numeracy_icons/missing_numbers.png";
import equationsImage from "@/public/numeracy_icons/equations.png";
import earlyAlgebraImage from "@/public/numeracy_icons/early_algebra.png";

type StudentDashboardProps = {
  dashboardData: StudentDashboardData;
  navBasePath?: string;
};

function getDisplayFirstName(value?: string | null) {
  if (!value) {
    return "Profile";
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return "Profile";
  }

  const [firstName] = trimmed.split(/\s+/);
  return firstName || "Profile";
}

const pagePanelWidth = "85vw";
const pageBackgroundStyle =
  "linear-gradient(180deg, #082733 0%, #030E14 100%)";

const activityKeyByTitle: Record<string, string> = {
  "Number Bonds": "number-bonds",
  Equations: "equations",
  "Missing Numbers": "missing-numbers",
  "Early Algebra": "early-algebra",
};

function HeaderBar({
  profileLabel,
  navBasePath,
  pathname,
}: {
  profileLabel: string;
  navBasePath: string;
  pathname: string;
}) {
  const topTabs = [
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
  ];

  return (
    <header
      style={{
        background: "#2B2B2B",
        width: "100%",
        boxSizing: "border-box",
        height: 70,
        border: "none",
        borderBottom: "1px solid #FFFFFF14",
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
            aria-label="Student dashboard navigation"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              minWidth: 0,
            }}
          >
            {topTabs.map((tab) => {
              const lessonBuilderPath = tab.href.replace(
                "/song-choice",
                "/lesson-builder",
              );
              const isHomeTab = tab.label === "Home";
              const isLessonBuilderTab = tab.label === studentCopy.navigation.builder;
              const isActive =
                pathname === tab.href ||
                (isHomeTab && pathname === navBasePath) ||
                (isLessonBuilderTab &&
                  (pathname === lessonBuilderPath ||
                    pathname.startsWith(`${lessonBuilderPath}/`))) ||
                (!isHomeTab && !isLessonBuilderTab && pathname.startsWith(`${tab.href}/`));

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
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    textDecoration: "none",
                    background: "#2B2B2B",
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
          <Link
            href={navBasePath === "/demo/student" ? `${navBasePath}/profile` : "/student/profile"}
            aria-label="Profile"
            className={styles.utilityButton}
            style={{
              minWidth: 112,
              height: 38,
              padding: "0 16px",
              textDecoration: "none",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#7A8FA8",
              fontSize: 14,
              fontWeight: 600,
              borderRadius: 999,
              background: "#2B2B2B",
              border: "1px solid #7A8FA8",
            }}
          >
            {profileLabel}
          </Link>

          <a
            href="/auth/logout"
            aria-label="Log out"
            className={`${styles.utilityButton} ${styles.logoutButton}`}
            style={{
              background: "#2B2B2B",
              color: "#7A8FA8",
              border: "1px solid #7A8FA8",
              borderRadius: 999,
            }}
          >
            {studentCopy.navigation.logout}
          </a>
        </div>
      </div>
    </header>
  );
}

export default function StudentDashboard({
  dashboardData,
  navBasePath = "/student",
}: StudentDashboardProps) {
  const pathname = usePathname();
  const router = useRouter();
  const displayName = dashboardData.name ?? "Student";
  const profileLabel = getDisplayFirstName(displayName);

  const gameCards = [
    {
      title: "Number Bonds",
      icon: numberBondsImage,
      alt: "Number bonds",
      description: studentCopy.dashboard.gameDescriptions.numberBonds,
      action: "play",
      disabled: false,
    },
    {
      title: "Equations",
      icon: equationsImage,
      alt: "Equations",
      description: studentCopy.dashboard.gameDescriptions.equations,
      action: "coming-soon",
      disabled: true,
    },
    {
      title: "Missing Numbers",
      icon: missingNumbersImage,
      alt: "Missing numbers",
      description: studentCopy.dashboard.gameDescriptions.missingNumbers,
      action: "coming-soon",
      disabled: true,
    },
    {
      title: "Early Algebra",
      icon: earlyAlgebraImage,
      alt: "Early algebra",
      description: studentCopy.dashboard.gameDescriptions.earlyAlgebra,
      action: "play",
      disabled: false,
    },
  ];

  function handlePlayClick(activityLabel: string) {
    const activityKey = activityKeyByTitle[activityLabel] ?? "number-bonds";
    const selectedActivity = {
      key: activityKey,
      label: activityLabel,
    };

    if (typeof window !== "undefined") {
      window.sessionStorage.setItem(
        "selectedDashboardActivity",
        JSON.stringify(selectedActivity),
      );
    }

    router.push(
      `${navBasePath}/song-choice?activity=${encodeURIComponent(activityKey)}`,
    );
  }

  return (
    <div
      className={styles.studentTypography}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 0,
        minHeight: "100vh",
        background: pageBackgroundStyle,
        color: "#FFFFFF",
        overflowX: "hidden",
      }}
    >
      <HeaderBar
        profileLabel={profileLabel}
        navBasePath={navBasePath}
        pathname={pathname}
      />

      <div
        style={{
          background: "#2B2B2B",
          width: "100%",
          height: "11vh",
          minHeight: 72,
          borderBottom: "1px solid #FFFFFF14",
          boxSizing: "border-box",
          display: "flex",
          alignItems: "center",
        }}
      >
        <div
          style={{
            width: pagePanelWidth,
            margin: "0 auto",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "flex-start",
            paddingLeft: "0",
            boxSizing: "border-box",
          }}
        >
          <div
            style={{
              fontSize: 12,
              color: "#CFFF04",
              fontWeight: 700,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              marginLeft: 0,
            }}
          >
            {studentCopy.dashboard.welcomeKicker}
          </div>
          <div
            style={{
              fontSize: 18,
              color: "#FFFFFF",
              marginTop: 4,
              lineHeight: 1.2,
            }}
          >
            {studentCopy.dashboard.welcome(profileLabel)}
          </div>
          <div
            style={{
              fontSize: 14,
              color: "rgba(255,255,255,0.55)",
              marginTop: 4,
              lineHeight: 1.4,
            }}
          >
            {studentCopy.dashboard.welcomeBody}
          </div>
        </div>
      </div>

      <main
        style={{
          width: "100%",
          display: "flex",
          justifyContent: "stretch",
          padding: 0,
        }}
      >
        <div
          style={{
            width: "100%",
            display: "flex",
            flexDirection: "column",
            gap: 0,
            padding: 0,
            borderRadius: 0,
            background: "transparent",
          }}
        >
          <section
            aria-label="Queue and games"
            style={{
              width: "100%",
              display: "flex",
              flexDirection: "column",
              gap: 18,
              background: pageBackgroundStyle,
              border: "1px solid #FFFFFF1F",
              borderTop: "none",
              boxSizing: "border-box",
              minHeight: "calc(100vh - 70px - 11vh)",
              padding: "18px 20px",
            }}
          >
            <div
              style={{
                flex: "0 0 42%",
                display: "flex",
                flexDirection: "column",
                alignItems: "stretch",
                minWidth: 0,
                width: "88%",
                margin: "0 auto",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  color: "#FFFFFF",
                  fontSize: 24,
                  fontWeight: 700,
                  margin: "0 0 18px 0",
                }}
              >
                <CheckIcon style={{ width: 18, height: 18, flexShrink: 0 }} />
                <span>{studentCopy.dashboard.queueTitle}</span>
              </div>

              <div
                style={{
                  width: "100%",
                  height: "23vh",
                  minHeight: 180,
                  background: "#2B2B2B",
                  borderRadius: 20,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  textAlign: "center",
                  padding: "20px 18px",
                  boxSizing: "border-box",
                  margin: 0,
                }}
              >
                <CircleCheckIcon style={{ width: 64, height: 64, display: "block" }} />
                <div
                  style={{
                    marginTop: 18,
                    color: "#FFFFFF",
                    fontSize: 18,
                    fontWeight: 600,
                  }}
                >
                  {studentCopy.dashboard.queueEmptyTitle}
                </div>
                <div
                  style={{
                    marginTop: 10,
                    color: "rgba(255,255,255,0.55)",
                    fontSize: 14,
                    lineHeight: 1.4,
                  }}
                >
                  {studentCopy.dashboard.queueEmptyBody}
                </div>
                <div
                  style={{
                    marginTop: 6,
                    color: "rgba(255,255,255,0.55)",
                    fontSize: 14,
                    lineHeight: 1.4,
                  }}
                >
                  {studentCopy.dashboard.queueEmptyAction}
                </div>
              </div>
            </div>

            <div
              style={{
                flex: "1 1 0",
                display: "flex",
                flexDirection: "column",
                minWidth: 0,
                width: "88%",
                margin: "0 auto",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  color: "#FFFFFF",
                  fontSize: 24,
                  fontWeight: 700,
                  margin: "0 0 18px 0",
                }}
              >
                <ControllerIcon style={{ width: 22, height: 22, flexShrink: 0 }} />
                <span>{studentCopy.dashboard.gamesTitle}</span>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
                  gap: 18,
                  alignItems: "stretch",
                  width: "100%",
                  height: "34.5vh",
                  minHeight: 250,
                }}
              >
                {gameCards.map((game) => {
                  const isDisabled = game.disabled;

                  return (
                    <div
                      key={game.title}
                      style={{
                        width: "100%",
                        height: "34.5vh",
                        minHeight: 250,
                        display: "flex",
                        flexDirection: "column",
                        overflow: "hidden",
                        borderRadius: 12,
                        boxSizing: "border-box",
                      }}
                    >
                      <div
                        style={{
                          height: "55.5%",
                          width: "100%",
                          background: "#222222",
                          border: "1px solid #222222",
                          borderBottom: "none",
                          opacity: isDisabled ? 0.5 : 1,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          padding: 10,
                          boxSizing: "border-box",
                        }}
                      >
                        <Image
                          src={game.icon}
                          alt={game.alt}
                          width={320}
                          height={220}
                          unoptimized
                          style={{
                            objectFit: "contain",
                            objectPosition: "center",
                            width: "100%",
                            height: "100%",
                            padding: 10,
                          }}
                          priority={game.title === "Number Bonds"}
                        />
                      </div>

                      <div
                        style={{
                          flex: 1,
                          background: "#2B2B2B",
                          border: "1px solid #FFFFFF14",
                          borderRadius: 0,
                          display: "flex",
                          flexDirection: "column",
                          padding: "12px 12px 14px",
                          boxSizing: "border-box",
                        }}
                      >
                        <div
                          style={{
                            color: "#FFFFFF",
                            fontSize: 16,
                            fontWeight: 600,
                            marginBottom: 8,
                          }}
                        >
                          {game.title}
                        </div>
                        <div
                          style={{
                            color: "rgba(255,255,255,0.55)",
                            fontSize: 13,
                            lineHeight: 1.45,
                            marginBottom: "auto",
                          }}
                        >
                          {game.description}
                        </div>

                        <button
                          type="button"
                          onClick={() => handlePlayClick(game.title)}
                          disabled={isDisabled}
                          style={{
                            width: "90%",
                            margin: "10px auto 0",
                            minHeight: 38,
                            borderRadius: 999,
                            border: "none",
                            background: game.action === "play" ? "#CFFF04" : "#7A7F86",
                            color: game.action === "play" ? "#0B1A1F" : "#D9D9D9",
                            fontWeight: 700,
                            fontSize: 13,
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: 8,
                            cursor: "pointer",
                            opacity: isDisabled ? 0.75 : 1,
                          }}
                        >
                          {game.action === "play" ? (
                            <>
                              <PlayIcon style={{ width: 16, height: 16, display: "block" }} />
                              <span>{studentCopy.dashboard.play}</span>
                            </>
                          ) : (
                            studentCopy.dashboard.comingSoon
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
