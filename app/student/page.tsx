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
    href: "/student/lesson-builder",
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

type SectionProps = {
  title: string;
  children?: ReactNode;
};

function DashboardSection({ title, children }: SectionProps) {
  return (
    <section
      style={{
        background: "#FFFFFF",
        height: 230,
        border: "none",
        borderBottom: "1px solid #E5E7EB",
        borderRadius: 0,
        padding: 20,
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

function PlaceholderCard({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div
      style={{
        background: "#1f2937",
        border: "1px solid #374151",
        borderRadius: 12,
        padding: 16,
      }}
    >
      <h3 style={{ margin: "0 0 8px 0", fontSize: 16 }}>{title}</h3>
      <p style={{ margin: 0, color: "#d1d5db", lineHeight: 1.5 }}>{description}</p>
    </div>
  );
}

export default function StudentPage() {
  const pathname = usePathname();

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 20,
      }}
    >
      <section
        style={{
          background: "#FFFFFF",
          height: 70,
          border: "none",
          borderBottom: "1px solid #D1D5DC",
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
        </div>
      </section>

      <DashboardSection title="Welcome Back">
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
          />
          <PlaceholderCard
            title="Today at a glance"
            description="3 lessons queued, 1 song recommendation, and 2 activities waiting for review."
          />
        </div>
      </DashboardSection>

      <DashboardSection title="Your Learning Queue">
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
          />
          <PlaceholderCard
            title="Lesson 2: Timing Practice"
            description="Build accuracy with short interactive timing drills."
          />
          <PlaceholderCard
            title="Lesson 3: Chord Flow"
            description="Practice transitions and prepare for your next score submission."
          />
        </div>
      </DashboardSection>

      <DashboardSection title="Learning Insights">
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
            gap: 15,
          }}
        >
          <PlaceholderCard title="Hours Played" description="8.5 hours this week" />
          <PlaceholderCard title="Lessons Completed" description="12 total completed" />
          <PlaceholderCard title="Average Score" description="91%" />
          <PlaceholderCard title="Current Streak" description="5 learning days in a row" />
        </div>
      </DashboardSection>

      <DashboardSection title="Choose a subject">
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
            gap: 15,
          }}
        >
          <PlaceholderCard title="Rhythm" description="Strengthen timing, tempo, and consistency." />
          <PlaceholderCard title="Melody" description="Practice pitch movement and musical phrasing." />
          <PlaceholderCard title="Harmony" description="Explore chord progressions and tonal balance." />
          <PlaceholderCard title="Technique" description="Focus on control, speed, and accuracy." />
        </div>
      </DashboardSection>

      <DashboardSection title="Choose a song">
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
      />
    </Link>

    <Link
      href="/student/combined-analysis"
      style={{ textDecoration: "none", color: "inherit" }}
    >
      <PlaceholderCard
        title="Song B"
        description="A mid-level song with timing and coordination challenges."
      />
    </Link>

    <Link
      href="/student/combined-analysis"
      style={{ textDecoration: "none", color: "inherit" }}
    >
      <PlaceholderCard
        title="Song C"
        description="A performance-based practice song with score tracking."
      />
    </Link>
  </div>
</DashboardSection>

      <DashboardSection title="Recommended for You">
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
          />
          <PlaceholderCard
            title="Recommended Song"
            description="This song matches your current rhythm skill level and recent progress."
          />
          <PlaceholderCard
            title="Recommended Practice Goal"
            description="Spend 20 minutes on timing drills to improve your next assignment score."
          />
        </div>
      </DashboardSection>
    </div>
  );
}