"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { FC, ReactNode, SVGProps } from "react";
import styles from "../student.module.css";

/* Header Icon imports */
import URIcon from "@/public/header_icons/URIcon.svg";
import HomeIcon from "@/public/header_icons/Home.svg";
import MyLessonsTab from "@/public/header_icons/my_lessons_tab.svg";
import LessonBuilderTab from "@/public/header_icons/lesson_builder_tab.svg";
import ProgressTab from "@/public/header_icons/progress_tab_pressed.svg";

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
        minHeight: 230,
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
      <h3 style={{ margin: "0 0 8px 0", fontSize: 16, color: "#fff" }}>{title}</h3>
      <p style={{ margin: 0, color: "#d1d5db", lineHeight: 1.5 }}>{description}</p>
    </div>
  );
}

export default function ProgressPage() {
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
          background: "#2B2B2B",
          width: "100%",
          boxSizing: "border-box",
          height: 70,
          border: "none",
          borderBottom: "1px solid #FFFFFF14",
          borderRadius: 0,
          padding: "16px 24px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 24,
          flexWrap: "nowrap",
          overflowX: "auto",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 24,
            flexWrap: "nowrap",
            minWidth: 0,
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
              gap: 12,
              flexWrap: "nowrap",
              minWidth: 0,
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
          </div>
        </div>

        <div
          style={{
            display: "flex",
            gap: 6,
            flexWrap: "nowrap",
            marginLeft: "auto",
            alignItems: "center",
            flexShrink: 0,
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

      <DashboardSection title="Progress">
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
            gap: 15,
          }}
        >
          <PlaceholderCard
            title="Weekly Progress"
            description="Track your lesson completion, time spent, and score improvements over time."
          />
          <PlaceholderCard
            title="Achievements"
            description="Review streaks, milestones, and completed learning goals."
          />
          <PlaceholderCard
            title="Performance Trends"
            description="See how your scores and practice consistency are changing across subjects."
          />
        </div>
      </DashboardSection>
    </div>
  );
}