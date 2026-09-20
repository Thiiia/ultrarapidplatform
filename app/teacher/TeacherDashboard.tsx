"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { TeacherDashboardData } from "@/lib/teacher-dashboard";
import { studentCopy } from "@/lib/student-copy";
import styles from "../student/student.module.css";

import URIcon from "@/public/header_icons/URIcon.svg";
import ControllerIcon from "@/public/controller.svg";
import PlayIcon from "@/public/Next_Button.svg";
import numberBondsImage from "@/public/numeracy_icons/number_bonds.png";
import missingNumbersImage from "@/public/numeracy_icons/missing_numbers.png";
import equationsImage from "@/public/numeracy_icons/equations.png";
import earlyAlgebraImage from "@/public/numeracy_icons/early_algebra.png";

type TeacherDashboardProps = {
  dashboardData: TeacherDashboardData;
  navBasePath?: string;
  adminViewing?: boolean;
  viewedUserName?: string | null;
  viewedUserEmail?: string;
  demoTutorial?: boolean;
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
    { label: "Home", href: navBasePath, width: 99 },
    { label: "Assignments", href: `${navBasePath}/assignments`, width: 130 },
    { label: "Classes", href: `${navBasePath}/classes`, width: 120 },
    { label: "Progress", href: `${navBasePath}/progress`, width: 120 },
  ];

  return (
    <header
      style={{
        background: "#060B15FC",
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
            aria-label="Teacher dashboard navigation"
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
              const isHomeTab = tab.label === "Home";
              const isActive =
                pathname === tab.href ||
                (isHomeTab && pathname === navBasePath) ||
                (!isHomeTab && pathname.startsWith(`${tab.href}/`));

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
                    background: "#060B15FC",
                    borderBottom: isActive
                      ? "3px solid #CFFF04"
                      : "3px solid transparent",
                    color: "#FFFFFF",
                    fontSize: 13,
                    fontWeight: 500,
                    lineHeight: "19.5px",
                  }}
                >
                  {tab.label}
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
            href={`${navBasePath}/profile`}
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
              background: "#060B15FC",
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
              background: "#060B15FC",
              color: "#7A8FA8",
              border: "1px solid #7A8FA8",
              borderRadius: 999,
            }}
          >
            Log out
          </a>
        </div>
      </div>
    </header>
  );
}

export default function TeacherDashboard({
  dashboardData,
  navBasePath = "/teacher",
  viewedUserName,
  viewedUserEmail,
}: TeacherDashboardProps) {
  const pathname = usePathname();
  const router = useRouter();
  const displayName =
    viewedUserName ?? dashboardData.name ?? viewedUserEmail ?? dashboardData.email;
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

  const activityKeyByTitle: Record<string, string> = {
    "Number Bonds": "number-bonds",
    Equations: "equations",
    "Missing Numbers": "missing-numbers",
    "Early Algebra": "early-algebra",
  };

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
            aria-label="Play a game"
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
