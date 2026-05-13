"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { FC, ReactNode, SVGProps } from "react";
import styles from "./student.module.css";

/* Header Icon imports */
import URIcon from "@/public/header_icons/URIcon.svg";
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

const topTabs: HeaderTab[] = [
  { label: "Home", href: "/student", Icon: HomeIcon, width: 99 },
  { label: "My Lessons", href: "/student/lessons", Icon: MyLessonsTab, width: 139 },
  {
    label: "Lesson Builder",
    href: "/student/lesson-builder",
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

const headerStyles = {
  backgroundColor: "#2B2B2B",
  borderBottomColor: "#FFFFFF14",
};

const sectionColors = {
  welcome: "#2B2B2B",
  queue: "#191919",
  insights: "#191919",
  subjects: "#191919",
  songs: "#191919",
  recommended: "#191919",
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
          height: 195,
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

function HeaderBar({ pathname }: { pathname: string }) {
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
};

function PlaceholderCard({
  title,
  description,
  backgroundColor = "#2B2B2B",
  borderColor = "#FFFFFF14",
  titleColor = "#FFFFFF",
  textColor = "#FFFFFF",
}: PlaceholderCardProps) {
  return (
    <div
      style={{
        background: backgroundColor,
        border: `1px solid ${borderColor}`,
        borderRadius: 12,
        color: "#FFFFFF",
        padding: 16,
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
}

export default function StudentDashboard() {
  const pathname = usePathname();

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
      <HeaderBar pathname={pathname} />

      <DashboardSection
        title="Welcome Back"
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
            description="Pick up where you left off, continue your current assignment, or explore a new song-based learning challenge."
            backgroundColor="#191919"
            borderColor="#FFFFFF14"
            titleColor="#FFFFFF"
            textColor="#FFFFFF"
          />
          <PlaceholderCard
            title="Today at a glance"
            description="3 lessons queued, 1 song recommendation, and 2 activities waiting for review."
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
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
            gap: 15,
          }}
        >
          <PlaceholderCard
            title="Lesson 1: Rhythm Basics"
            description="Continue your current lesson and complete the next checkpoint."
            backgroundColor="#2B2B2B"
            borderColor="#FFFFFF14"
            titleColor="#FFFFFF"
            textColor="#FFFFFF"
          />
          <PlaceholderCard
            title="Lesson 2: Timing Practice"
            description="Build accuracy with short interactive timing drills."
            backgroundColor="#2B2B2B"
            borderColor="#FFFFFF14"
            titleColor="#FFFFFF"
            textColor="#FFFFFF"
          />
          <PlaceholderCard
            title="Lesson 3: Chord Flow"
            description="Practice transitions and prepare for your next score submission."
            backgroundColor="#2B2B2B"
            borderColor="#FFFFFF14"
            titleColor="#FFFFFF"
            textColor="#FFFFFF"
          />
        </div>
      </DashboardSection>

      {/*
        Temporarily hidden while these lower dashboard panels are still being built.
        Keep this JSX here so the panels can be restored when work resumes.

      <DashboardSection
        title="Learning Insights"
        backgroundColor={sectionColors.insights}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
            gap: 15,
          }}
        >
          <PlaceholderCard
            title="Hours Played"
            description="8.5 hours this week"
            backgroundColor="#2B2B2B"
            borderColor="#FFFFFF14"
          />
          <PlaceholderCard
            title="Lessons Completed"
            description="12 total completed"
            backgroundColor="#2B2B2B"
            borderColor="#FFFFFF14"
          />
          <PlaceholderCard
            title="Average Score"
            description="91%"
            backgroundColor="#2B2B2B"
            borderColor="#FFFFFF14"
          />
          <PlaceholderCard
            title="Current Streak"
            description="5 learning days in a row"
            backgroundColor="#2B2B2B"
            borderColor="#FFFFFF14"
          />
        </div>
      </DashboardSection>

      <DashboardSection
        title="Choose a subject"
        backgroundColor={sectionColors.subjects}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
            gap: 15,
          }}
        >
          <PlaceholderCard
            title="Rhythm"
            description="Strengthen timing, tempo, and consistency."
            backgroundColor="#2B2B2B"
            borderColor="#FFFFFF14"
          />
          <PlaceholderCard
            title="Melody"
            description="Practice pitch movement and musical phrasing."
            backgroundColor="#2B2B2B"
            borderColor="#FFFFFF14"
          />
          <PlaceholderCard
            title="Harmony"
            description="Explore chord progressions and tonal balance."
            backgroundColor="#2B2B2B"
            borderColor="#FFFFFF14"
          />
          <PlaceholderCard
            title="Technique"
            description="Focus on control, speed, and accuracy."
            backgroundColor="#2B2B2B"
            borderColor="#FFFFFF14"
          />
        </div>
      </DashboardSection>

      <DashboardSection
        title="Choose a song"
        backgroundColor={sectionColors.songs}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
            gap: 15,
          }}
        >
          <Link
            href="/student/combined-analysis"
            style={{ textDecoration: "none", color: "inherit" }}
          >
            <PlaceholderCard
              title="Song A"
              description="A beginner-friendly track focused on rhythm recognition."
              backgroundColor="#2B2B2B"
              borderColor="#FFFFFF14"
              titleColor="#FFFFFF"
              textColor="#FFFFFF"
            />
          </Link>

          <Link
            href="/student/combined-analysis"
            style={{ textDecoration: "none", color: "inherit" }}
          >
            <PlaceholderCard
              title="Song B"
              description="A mid-level song with timing and coordination challenges."
              backgroundColor="#2B2B2B"
              borderColor="#FFFFFF14"
              titleColor="#FFFFFF"
              textColor="#FFFFFF"
            />
          </Link>

          <Link
            href="/student/combined-analysis"
            style={{ textDecoration: "none", color: "inherit" }}
          >
            <PlaceholderCard
              title="Song C"
              description="A performance-based practice song with score tracking."
              backgroundColor="#2B2B2B"
              borderColor="#FFFFFF14"
              titleColor="#FFFFFF"
              textColor="#FFFFFF"
            />
          </Link>
        </div>
      </DashboardSection>

      <DashboardSection
        title="Recommended for You"
        backgroundColor={sectionColors.recommended}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
            gap: 16,
          }}
        >
          <PlaceholderCard
            title="Recommended Lesson"
            description="Based on your recent scores, try a lesson focused on tempo consistency."
            backgroundColor="#2B2B2B"
            borderColor="#FFFFFF14"
          />
          <PlaceholderCard
            title="Recommended Song"
            description="This song matches your current rhythm skill level and recent progress."
            backgroundColor="#2B2B2B"
            borderColor="#FFFFFF14"
          />
          <PlaceholderCard
            title="Recommended Practice Goal"
            description="Spend 20 minutes on timing drills to improve your next assignment score."
            backgroundColor="#2B2B2B"
            borderColor="#FFFFFF14"
          />
        </div>
      </DashboardSection>
      */}
    </div>
  );
}
