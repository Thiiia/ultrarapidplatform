"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { FC, ReactNode, SVGProps } from "react";
import type { StudentDashboardData } from "@/lib/student-dashboard";
import styles from "./student.module.css";

/* Header Icon imports */
import URIcon from "@/public/header_icons/URIcon.svg";
import PlayTab from "@/public/header_icons/play_tab.svg";
import PlayPressedTab from "@/public/header_icons/play_tab_pressed.svg";
import HomeIcon from "@/public/header_icons/Home_pressed.svg";
import MyLessonsTab from "@/public/header_icons/my_lessons_tab.svg";
import LessonBuilderTab from "@/public/header_icons/lesson_builder_tab.svg";
import ProgressTab from "@/public/header_icons/progress_tab.svg";

/* Utility Icon Imports */
// import NotificationsIcon from "@/public/utility_icons/notifications_icon.svg";
// import SettingsIcon from "@/public/utility_icons/settings_icon.svg";
import ProfileIcon from "@/public/utility_icons/profile_icon.svg";

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

type StudentDashboardProps = {
  dashboardData: StudentDashboardData;
  navBasePath?: string;
};

function getTopTabs(navBasePath = "/student"): HeaderTab[] {
  return [
    {
      label: "Home",
      href: navBasePath,
      Icon: HomeIcon,
      width: 99,
    },
    {
      label: "My Lessons",
      href: `${navBasePath}/lessons`,
      Icon: MyLessonsTab,
      width: 139,
    },
    {
      label: "Lesson Builder",
      href: `${navBasePath}/song-choice`,
      Icon: LessonBuilderTab,
      width: 159,
    },
    {
      label: "Progress",
      href: `${navBasePath}/progress`,
      Icon: ProgressTab,
      width: 120,
    },
        {
      label: "Play",
      href: `${navBasePath}/game`,
      Icon: PlayTab,
      width: 99,
    },
  ];
}

const utilityTabs: UtilityTab[] = [
  // { label: "Notifications", href: "/student/notifications", Icon: NotificationsIcon, width: 38 },
  // { label: "Settings", href: "/student/settings", Icon: SettingsIcon, width: 38 },
  { label: "Profile", href: "/student/profile", Icon: ProfileIcon, width: 134.45 },
];

const headerStyles = {
  backgroundColor: "#2B2B2B",
  borderBottomColor: "#FFFFFF14",
};

const sectionColors = {
  welcome: "#2B2B2B",
  queue: "#191919",
};

const pagePanelWidth = "85vw";
const pageBackgroundColor = "#191919";

type SectionProps = {
  title: string;
  children?: ReactNode;
  backgroundColor?: string;
};

function DashboardSection({
  title,
  children,
  backgroundColor = pageBackgroundColor,
}: SectionProps) {
  return (
    <div
      style={{
        background: backgroundColor,
        width: "100%",
        borderBottom: "1px solid #FFFFFF14",
      }}
    >
      <section
        style={{
          background: backgroundColor,
          color: "#FFFFFF",
          width: pagePanelWidth,
          boxSizing: "border-box",
          minHeight: 195,
          border: "none",
          borderRadius: 0,
          padding: "20px 0",
          margin: "0 auto",
        }}
      >
        <h2
          className={styles.panelTitle}
          style={{
            margin: "0 0 16px 0",
            color: "#FFFFFF",
          }}
        >
          {title}
        </h2>
        {children}
      </section>
    </div>
  );
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

              const Icon = isPlayTab && isActive ? PlayPressedTab : tab.Icon;

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
          {utilityTabs.map((tab) => {
            const iconWidth = tab.width;
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
                    width: iconWidth,
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

type PlaceholderCardProps = {
  title: string;
  description: string;
  backgroundColor?: string;
  borderColor?: string;
  titleColor?: string;
  textColor?: string;
  href?: string;
};

function PlaceholderCard({
  title,
  description,
  backgroundColor = "#2B2B2B",
  borderColor = "#FFFFFF14",
  titleColor = "#FFFFFF",
  textColor = "#FFFFFF",
  href,
}: PlaceholderCardProps) {
  const card = (
    <div
      style={{
        background: backgroundColor,
        border: `1px solid ${borderColor}`,
        borderRadius: 12,
        color: "#FFFFFF",
        padding: 16,
        minHeight: 88,
      }}
    >
      <h3
        style={{
          margin: "0 0 8px 0",
          fontSize: 13,
          fontWeight: 500,
          lineHeight: "19.5px",
          letterSpacing: 0,
          textAlign: "center",
          color: titleColor,
        }}
      >
        {title}
      </h3>
      <p
        style={{
          margin: 0,
          color: textColor,
          fontSize: 13,
          fontWeight: 500,
          lineHeight: "19.5px",
          letterSpacing: 0,
          textAlign: "center",
        }}
      >
        {description}
      </p>
    </div>
  );

  if (!href) {
    return card;
  }

  return (
    <Link href={href} style={{ textDecoration: "none", color: "inherit" }}>
      {card}
    </Link>
  );
}

function formatDueDate(value: Date | string | null | undefined) {
  if (!value) {
    return "No due date";
  }

  const date = typeof value === "string" ? new Date(value) : value;

  if (Number.isNaN(date.getTime())) {
    return "No due date";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(date);
}

export default function StudentDashboard({
  dashboardData,
  navBasePath = "/student",
}: StudentDashboardProps) {
  const pathname = usePathname();
  const topTabs = getTopTabs(navBasePath);

  const displayName = dashboardData.name ?? "Student";

  const classSummary =
    dashboardData.classes.length > 0
      ? dashboardData.classes.map((classItem) => classItem.name).join(", ")
      : "No class assigned yet";

  const teacherSummary =
    dashboardData.teachers.length > 0
      ? dashboardData.teachers
          .map((teacher) => teacher.name ?? teacher.email)
          .join(", ")
      : "No teacher assigned yet";

  const currentLessons = dashboardData.currentLessons.slice(0, 3);

  return (
    <div
      className={styles.studentTypography}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 0,
        minHeight: "100vh",
        background: pageBackgroundColor,
        color: "#FFFFFF",
        overflowX: "hidden",
      }}
    >
      <HeaderBar pathname={pathname} topTabs={topTabs} />

      <DashboardSection
        title={`Welcome Back, ${displayName}`}
        backgroundColor={sectionColors.welcome}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "2fr 1fr",
            gap: 15,
          }}
        >
          <PlaceholderCard
            title="Ready for your next lesson?"
            description={
              currentLessons.length > 0
                ? `You have ${currentLessons.length} current lesson${
                    currentLessons.length === 1 ? "" : "s"
                  } ready.`
                : "You do not have any lessons assigned yet."
            }
            backgroundColor="#191919"
            borderColor="#FFFFFF14"
            titleColor="#FFFFFF"
            textColor="#FFFFFF"
            href={currentLessons[0]?.href}
          />

          <PlaceholderCard
            title="Today at a glance"
            description={`School: ${
              dashboardData.school?.name ?? "Not assigned"
            }. Class: ${classSummary}. Teacher: ${teacherSummary}.`}
            backgroundColor="#191919"
            borderColor="#FFFFFF14"
            titleColor="#FFFFFF"
            textColor="#FFFFFF"
          />
        </div>
      </DashboardSection>

      <DashboardSection
        title="Your Learning Queue"
        backgroundColor={sectionColors.queue}
      >
        {currentLessons.length > 0 ? (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
              gap: 15,
            }}
          >
            {currentLessons.map((lesson) => (
              <PlaceholderCard
                key={`${lesson.missionId}-${lesson.assignmentId ?? "progress"}`}
                title={lesson.title}
                description={`${lesson.className ?? "Current lesson"} • ${
                  lesson.teacherName ?? "Self-paced"
                } • ${formatDueDate(lesson.dueAt)}`}
                backgroundColor="#2B2B2B"
                borderColor="#FFFFFF14"
                titleColor="#FFFFFF"
                textColor="#FFFFFF"
                href={lesson.href}
              />
            ))}
          </div>
        ) : (
          <PlaceholderCard
            title="No lessons assigned yet"
            description="Your teacher has not assigned any current lessons. Once they do, they will appear here."
            backgroundColor="#2B2B2B"
            borderColor="#FFFFFF14"
            titleColor="#FFFFFF"
            textColor="#FFFFFF"
          />
        )}
      </DashboardSection>
    </div>
  );
}