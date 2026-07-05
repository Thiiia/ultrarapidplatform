"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import type { TeacherDashboardData } from "@/lib/teacher-dashboard";
// Demo overlay removed per request
import styles from "../student/student.module.css";

import URIcon from "@/public/header_icons/URIcon.svg";
import ProfileIcon from "@/public/utility_icons/profile_icon.svg";

type HeaderTab = {
  label: string;
  href: string;
  width: number;
};

type TeacherDashboardProps = {
  dashboardData: TeacherDashboardData;
  navBasePath?: string;
  adminViewing?: boolean;
  viewedUserName?: string | null;
  viewedUserEmail?: string;
  demoTutorial?: boolean;
};

function getTopTabs(navBasePath = "/teacher"): HeaderTab[] {
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

const sectionColors = {
  welcome: "#2B2B2B",
  overview: "#191919",
  classes: "#191919",
  lessons: "#191919",
};

function formatDate(value: Date | string | null | undefined) {
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

function HeaderTabButton({
  tab,
  pathname,
}: {
  tab: HeaderTab;
  pathname: string;
}) {
  const isHomeTab = tab.label === "Home";
  const isClassesTab = tab.label === "Classes";

  const isActive =
    pathname === tab.href ||
    (!isHomeTab && tab.href !== "/" && pathname.startsWith(`${tab.href}/`));

  return (
    <Link
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
        borderBottom: isActive ? "3px solid #CFFF04" : "3px solid transparent",
        color: "#FFFFFF",
        fontSize: 13,
        fontWeight: 500,
        lineHeight: "19.5px",
        position: isClassesTab ? "relative" : undefined,
        zIndex: isClassesTab ? 9001 : undefined,
      }}
    >
      {tab.label}
    </Link>
  );
}

function HeaderBar({
  pathname,
  topTabs,
}: {
  pathname: string;
  topTabs: HeaderTab[];
}) {
  const profileHref = `${topTabs[0].href}/profile`;

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
            aria-label="Teacher navigation"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              flexWrap: "nowrap",
              minWidth: 0,
              overflow: "visible",
            }}
          >
            {topTabs.map((tab) => (
              <HeaderTabButton key={tab.label} tab={tab} pathname={pathname} />
            ))}
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
<button
  type="button"
  aria-label="Profile"
  className={styles.utilityButton}
  onClick={() => {
    console.info("Profile page is not enabled yet.");
  }}
  style={{
    width: 134.45,
    height: 38,
    border: "none",
    background: "transparent",
    padding: 0,
    cursor: "default",
  }}
>
  <ProfileIcon
    style={{
      width: 134.45,
      height: 38,
      display: "block",
    }}
  />
</button>

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

function DashboardSection({
  title,
  children,
  backgroundColor = pageBackgroundColor,
}: {
  title: string;
  children?: ReactNode;
  backgroundColor?: string;
}) {
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

function TeacherCard({
  title,
  description,
  href,
}: {
  title: string;
  description: string;
  href?: string;
}) {
  const card = (
    <div
      style={{
        background: "#2B2B2B",
        border: "1px solid #FFFFFF14",
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
          color: "#FFFFFF",
        }}
      >
        {title}
      </h3>
      <p
        style={{
          margin: 0,
          color: "#FFFFFF",
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

export default function TeacherDashboard({
  dashboardData,
  navBasePath = "/teacher",
  adminViewing = false,
  viewedUserName,
  viewedUserEmail,
  demoTutorial = false,
}: TeacherDashboardProps) {
  const pathname = usePathname();
  const topTabs = getTopTabs(navBasePath);

  const displayName =
    viewedUserName ?? dashboardData.name ?? viewedUserEmail ?? dashboardData.email;

  const recentClasses = dashboardData.classes.slice(0, 3);
  const recentLessons = dashboardData.authoredMissions.slice(0, 3);

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
        title={adminViewing ? `Viewing ${displayName}` : `Welcome Back, ${displayName}`}
        backgroundColor={sectionColors.welcome}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "2fr 1fr",
            gap: 15,
          }}
        >
          <TeacherCard
            title="Teaching overview"
            description={`School: ${
              dashboardData.school?.name ?? "Not assigned"
            }. ${dashboardData.totals.classCount} class${
              dashboardData.totals.classCount === 1 ? "" : "es"
            }, ${dashboardData.totals.studentCount} student${
              dashboardData.totals.studentCount === 1 ? "" : "s"
            }.`}
          />

          <TeacherCard
            title="Active assignments"
            description={`${dashboardData.totals.activeAssignmentCount} assigned or in-progress item${
              dashboardData.totals.activeAssignmentCount === 1 ? "" : "s"
            } across your classes.`}
            href={`${navBasePath}/lessons`}
          />
        </div>
      </DashboardSection>

      <DashboardSection title="Teacher Overview" backgroundColor={sectionColors.overview}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
            gap: 15,
          }}
        >
          <TeacherCard
            title="Classes"
            description={`${dashboardData.totals.classCount} total`}
            href={`${navBasePath}/classes`}
          />
          <TeacherCard
            title="Students"
            description={`${dashboardData.totals.studentCount} total`}
            href={`${navBasePath}/students`}
          />
          <TeacherCard
            title="Lessons"
            description={`${dashboardData.totals.missionCount} authored`}
            href={`${navBasePath}/lessons`}
          />
          <TeacherCard
            title="Progress"
            description="Review assignment activity and class progress."
            href={`${navBasePath}/progress`}
          />
        </div>
      </DashboardSection>

      <DashboardSection title="Your Classes" backgroundColor={sectionColors.classes}>
        {recentClasses.length > 0 ? (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
              gap: 15,
            }}
          >
            {recentClasses.map((classItem) => (
              <TeacherCard
                key={classItem.id}
                title={classItem.name}
                description={`${classItem.studentCount} student${
                  classItem.studentCount === 1 ? "" : "s"
                } • ${classItem.assignments.length} assignment${
                  classItem.assignments.length === 1 ? "" : "s"
                }`}
                href={`${navBasePath}/classes`}
              />
            ))}
          </div>
        ) : (
          <TeacherCard
            title="No classes assigned yet"
            description="Once an admin assigns you to a class, it will appear here."
          />
        )}
      </DashboardSection>

      <DashboardSection title="Recent Lessons" backgroundColor={sectionColors.lessons}>
        {recentLessons.length > 0 ? (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
              gap: 15,
            }}
          >
            {recentLessons.map((lesson) => (
              <TeacherCard
                key={lesson.id}
                title={lesson.title}
                description={`${lesson.published ? "Published" : "Draft"} • Updated ${formatDate(
                  lesson.updatedAt,
                )}`}
                href={`${navBasePath}/lessons`}
              />
            ))}
          </div>
        ) : (
          <TeacherCard
            title="No lessons yet"
            description="Lessons you create or author will appear here."
          />
        )}
      </DashboardSection>

      {/* demoTutorial removed: overlay and popup text intentionally disabled */}
    </div>
  );
}