"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { FC, ReactNode, SVGProps } from "react";
import styles from "./student.module.css";
import clsx from "clsx";

/* Header Icon imports */
import URIcon from "@/public/header_icons/URIcon.svg";
import HomeIcon from "@/public/header_icons/Home_pressed.svg";
import MyLessonsTab from "@/public/header_icons/my_lessons_tab.svg";
import LessonBuilderTab from "@/public/header_icons/lesson_builder_tab.svg";
import ProgressTab from "@/public/header_icons/progress_tab.svg";

/* Utility Icon Imports */
import NotificationsIcon from "@/public/utility_icons/notifications_icon.svg";
import SettingsIcon from "@/public/utility_icons/settings_icon.svg";
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
  { label: "Home", href: "/student", Icon: HomeIcon, width: 81.77 },
  { label: "My Lessons", href: "/student/lessons", Icon: MyLessonsTab, width: 117.37 },
  {
    label: "Lesson Builder",
    href: "/editor",
    Icon: LessonBuilderTab,
    width: 134.83,
  },
  { label: "Progress", href: "/student/progress", Icon: ProgressTab, width: 99.69 },
];

const utilityTabs: UtilityTab[] = [
  { label: "Notifications", href: "/student/notifications", Icon: NotificationsIcon, width: 38 },
  { label: "Settings", href: "/student/settings", Icon: SettingsIcon, width: 38 },
  { label: "Profile", href: "/student/profile", Icon: ProfileIcon, width: 134.45 },
];

const headerStyles = {
  backgroundColor: "#2B2B2B",
  borderBottomColor: "#FFFFFF14",
};

const sectionColors = {
  welcome: "#2B2B2B",
  queue: "#EFF6FF",
  insights: "#F3E8FF",
  subjects: "#ECFDF5",
  songs: "#FEF3C7",
  recommended: "#FCE7F3",
};

type SectionProps = {
  title: string;
  children?: ReactNode;
  backgroundColor?: string;
};

function DashboardSection({
  title,
  children,
  backgroundColor = "#FFFFFF",
}: SectionProps) {
  return (
    <section
      style={{
        background: backgroundColor,
        height: 195,
        border: "none",
        borderBottom: "1px solid #E5E7EB",
        borderRadius: 0,
        padding: "20px 56px",
      }}
    >
      <h2
        style={{
          margin: "0 0 16px 0",
          fontSize: 22,
          fontWeight: 700,
        }}
      >
        {title}
      </h2>
      {children}
    </section>
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
  backgroundColor = "#1f2937",
  borderColor = "#374151",
  titleColor = "#FFFFFF",
  textColor = "#d1d5db",
}: PlaceholderCardProps) {
  return (
    <div
      style={{
        background: backgroundColor,
        border: `1px solid ${borderColor}`,
        borderRadius: 12,
        padding: 16,
      }}
    >
      <h3
        style={{
          margin: "0 0 8px 0",
          fontSize: 16,
          color: titleColor,
        }}
      >
        {title}
      </h3>
      <p
        style={{
          margin: 0,
          color: textColor,
          lineHeight: 1.5,
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
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 0,
        paddingTop: 20,
      }}
    >
      <section
        style={{
          background: headerStyles.backgroundColor,
          height: 70,
          border: "none",
          borderBottom: `1px solid ${headerStyles.borderBottomColor}`,
          borderRadius: 0,
          padding: 16,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 7.5,
          flexWrap: "wrap",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            flexWrap: "wrap",
          }}
        >
          <URIcon
            aria-label="UltraRapid"
            style={{ width: 145.95, height: 35, display: "block", flexShrink: 0 }}
          />

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              flexWrap: "wrap",
            }}
          >
            {topTabs.map((tab) => {
              const isActive = pathname === tab.href;

              return (
                <Link
                  key={tab.label}
                  href={tab.href}
                  aria-label={tab.label}
                  className={clsx(
                    styles.headerTabButton,
                    isActive && styles.headerTabButtonActive
                  )}
                  style={{
                    width: tab.width,
                    height: 45.5,
                    opacity: 1,
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
          </div>
        </div>

        <div
          style={{
            display: "flex",
            gap: 6,
            flexWrap: "wrap",
            marginLeft: "auto",
            alignItems: "center",
          }}
        >
          {utilityTabs.map((tab) => {
            const iconWidth =
              tab.label === "Profile" ? 134.45 :
              tab.label === "Notifications" ? 38 :
              38;

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
            style={{
              textDecoration: "none",
              background: "#DC2626",
              color: "#FFFFFF",
              padding: "10px 14px",
              borderRadius: 8,
              fontWeight: 600,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              height: 38,
            }}
          >
            Log out
          </a>
        </div>
      </section>

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
            backgroundColor="#7C3AED"
            borderColor="#6D28D9"
            titleColor="#FFFFFF"
            textColor="#EDE9FE"
          />
          <PlaceholderCard
            title="Today at a glance"
            description="3 lessons queued, 1 song recommendation, and 2 activities waiting for review."
            backgroundColor="#2563EB"
            borderColor="#1D4ED8"
            titleColor="#FFFFFF"
            textColor="#DBEAFE"
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
            backgroundColor="#0F766E"
            borderColor="#115E59"
            titleColor="#FFFFFF"
            textColor="#CCFBF1"
          />
          <PlaceholderCard
            title="Lesson 2: Timing Practice"
            description="Build accuracy with short interactive timing drills."
            backgroundColor="#0891B2"
            borderColor="#0E7490"
            titleColor="#FFFFFF"
            textColor="#CFFAFE"
          />
          <PlaceholderCard
            title="Lesson 3: Chord Flow"
            description="Practice transitions and prepare for your next score submission."
            backgroundColor="#1D4ED8"
            borderColor="#1E40AF"
            titleColor="#FFFFFF"
            textColor="#DBEAFE"
          />
        </div>
      </DashboardSection>

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
            backgroundColor="#581C87"
            borderColor="#6B21A8"
          />
          <PlaceholderCard
            title="Lessons Completed"
            description="12 total completed"
            backgroundColor="#6D28D9"
            borderColor="#7C3AED"
          />
          <PlaceholderCard
            title="Average Score"
            description="91%"
            backgroundColor="#7E22CE"
            borderColor="#9333EA"
          />
          <PlaceholderCard
            title="Current Streak"
            description="5 learning days in a row"
            backgroundColor="#A21CAF"
            borderColor="#C026D3"
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
            backgroundColor="#166534"
            borderColor="#15803D"
          />
          <PlaceholderCard
            title="Melody"
            description="Practice pitch movement and musical phrasing."
            backgroundColor="#15803D"
            borderColor="#16A34A"
          />
          <PlaceholderCard
            title="Harmony"
            description="Explore chord progressions and tonal balance."
            backgroundColor="#047857"
            borderColor="#059669"
          />
          <PlaceholderCard
            title="Technique"
            description="Focus on control, speed, and accuracy."
            backgroundColor="#0F766E"
            borderColor="#14B8A6"
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
              backgroundColor="#B45309"
              borderColor="#92400E"
              titleColor="#FFFFFF"
              textColor="#FEF3C7"
            />
          </Link>

          <Link
            href="/student/combined-analysis"
            style={{ textDecoration: "none", color: "inherit" }}
          >
            <PlaceholderCard
              title="Song B"
              description="A mid-level song with timing and coordination challenges."
              backgroundColor="#C2410C"
              borderColor="#9A3412"
              titleColor="#FFFFFF"
              textColor="#FFEDD5"
            />
          </Link>

          <Link
            href="/student/combined-analysis"
            style={{ textDecoration: "none", color: "inherit" }}
          >
            <PlaceholderCard
              title="Song C"
              description="A performance-based practice song with score tracking."
              backgroundColor="#DC2626"
              borderColor="#B91C1C"
              titleColor="#FFFFFF"
              textColor="#FEE2E2"
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
            backgroundColor="#9D174D"
            borderColor="#BE185D"
          />
          <PlaceholderCard
            title="Recommended Song"
            description="This song matches your current rhythm skill level and recent progress."
            backgroundColor="#BE185D"
            borderColor="#DB2777"
          />
          <PlaceholderCard
            title="Recommended Practice Goal"
            description="Spend 20 minutes on timing drills to improve your next assignment score."
            backgroundColor="#C026D3"
            borderColor="#D946EF"
          />
        </div>
      </DashboardSection>
    </div>
  );
}