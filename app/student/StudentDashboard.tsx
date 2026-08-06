"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { StudentDashboardData } from "@/lib/student-dashboard";
import styles from "./student.module.css";

import URIcon from "@/public/header_icons/URIcon.svg";
import MyLessonsTab from "@/public/header_icons/my_lessons_tab.svg";
import MyLessonsPressedTab from "@/public/header_icons/my_lessons_tab_pressed.svg";
import LessonBuilderTab from "@/public/header_icons/lesson_builder_tab.svg";
import LessonBuilderPressedTab from "@/public/header_icons/lesson_builder_tab_pressed.svg";
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
              const isActive =
                pathname === tab.href ||
                (tab.label === "Lesson Builder" &&
                  (pathname === lessonBuilderPath ||
                    pathname.startsWith(`${lessonBuilderPath}/`))) ||
                pathname.startsWith(`${tab.href}/`);

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
                    background: "#060B15FC",
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
            href="/student/profile"
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

export default function StudentDashboard({
  dashboardData,
  navBasePath = "/student",
}: StudentDashboardProps) {
  const pathname = usePathname();
  const displayName = dashboardData.name ?? "Student";
  const profileLabel = getDisplayFirstName(displayName);

  const numeracyPanels = [
    {
      title: "Number Bonds",
      src: numberBondsImage,
      alt: "Number bonds",
      selection: "number-bonds",
    },
    {
      title: "Missing Numbers",
      src: missingNumbersImage,
      alt: "Missing numbers",
      selection: "missing-numbers",
    },
    {
      title: "Equations",
      src: equationsImage,
      alt: "Equations",
      selection: "equations",
    },
    {
      title: "Early Algebra",
      src: earlyAlgebraImage,
      alt: "Early algebra",
      selection: "early-algebra",
    },
  ];

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
          justifyContent: "center",
          padding: "28px 0 40px",
        }}
      >
        <div
          style={{
            width: pagePanelWidth,
            display: "flex",
            flexDirection: "column",
            gap: 14,
            padding: 0,
            borderRadius: 0,
            background: "transparent",
            boxShadow: "0 18px 40px rgba(0, 0, 0, 0.14)",
          }}
        >
          <section
            aria-label="Numeracy activities"
            style={{
              width: "100%",
              display: "grid",
              gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
              gap: 6,
            }}
          >
            {numeracyPanels.map((panel) => (
              <Link
                key={panel.title}
                href={{ pathname: "/demo/student/song-choice", query: { activity: panel.selection } }}
                aria-label={`Open ${panel.alt}`}
                onClick={() => {
                  if (typeof window !== "undefined") {
                    window.sessionStorage.setItem(
                      "selectedDashboardActivity",
                      JSON.stringify({ key: panel.selection, label: panel.title }),
                    );
                  }
                }}
                style={{
                  background: "#CFFF04",
                  border: "2px solid #CFFF04",
                  borderRadius: 0,
                  padding: 0,
                  minHeight: 128,
                  maxHeight: 148,
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "center",
                  alignItems: "center",
                  boxShadow: "0 12px 26px rgba(0, 0, 0, 0.16)",
                  boxSizing: "border-box",
                  textDecoration: "none",
                  cursor: "pointer",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    width: "100%",
                    height: "100%",
                    position: "relative",
                    borderRadius: 0,
                    overflow: "hidden",
                    background: "#CFFF04",
                  }}
                >
                  <Image
                    src={panel.src}
                    alt={panel.alt}
                    fill
                    style={{
                      objectFit: "cover",
                      objectPosition: "center",
                    }}
                    priority={panel.title === "Number Bonds"}
                  />
                </div>
              </Link>
            ))}
          </section>

          <section
            aria-label="Your Learning Queue"
            style={{
              background: "rgba(6, 11, 21, 0.72)",
              border: "1px solid #FFFFFF1F",
              minHeight: 160,
              padding: "18px 20px",
              boxSizing: "border-box",
            }}
          >
            <h2
              style={{
                margin: 0,
                color: "#FFFFFF",
                fontSize: 24,
                fontWeight: 700,
                textAlign: "left",
              }}
            >
              Your Learning Queue
            </h2>
          </section>
        </div>
      </main>
    </div>
  );
}
