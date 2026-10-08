"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import ExperienceRoleHeader, {
  type ExperienceRoleHeaderAction,
  type ExperienceRoleNavigationItem,
} from "@/app/components/ExperienceRoleHeader";
import styles from "../student/student.module.css";

import ProfileIcon from "@/public/utility_icons/profile_icon.svg";

type TeacherSubpageCard = {
  title: string;
  description: string;
  href?: string;
};

type TeacherSubpageShellProps = {
  title: string;
  cards: TeacherSubpageCard[];
  navBasePath?: string;
  children?: ReactNode;
};

function getTopTabs(navBasePath = "/teacher"): ExperienceRoleNavigationItem[] {
  return [
    {
      label: "Home",
      href: navBasePath,
      width: 99,
      matchNested: false,
    },
    {
      label: "Assignments",
      href: `${navBasePath}/assignments`,
      width: 130,
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

const utilityItems: ExperienceRoleHeaderAction[] = [
  {
    label: "Profile",
    Icon: ProfileIcon,
    width: 134.45,
    disabled: true,
  },
];

const pagePanelWidth = "85vw";
const pageBackgroundColor = "var(--ur-canvas-deep)";

const headerStyles = {
  backgroundColor: "var(--ur-canvas-top)",
  borderBottomColor: "#FFFFFF14",
};

function DashboardSection({
  title,
  children,
}: {
  title: string;
  children?: ReactNode;
}) {
  return (
    <div
      style={{
        background: headerStyles.backgroundColor,
        width: "100%",
        borderBottom: `1px solid ${headerStyles.borderBottomColor}`,
      }}
    >
      <section
        style={{
          background: headerStyles.backgroundColor,
          color: "#FFFFFF",
          width: pagePanelWidth,
          boxSizing: "border-box",
          minHeight: 230,
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
      className="experience-card"
      style={{
        background: "var(--ur-canvas-deep)",
        border: "1px solid rgba(255, 255, 255, 0.14)",
        borderRadius: 12,
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
    <Link href={href} style={{ color: "inherit", textDecoration: "none" }}>
      {card}
    </Link>
  );
}

export default function TeacherSubpageShell({
  title,
  cards,
  navBasePath = "/teacher",
  children,
}: TeacherSubpageShellProps) {
  const topTabs = getTopTabs(navBasePath);

  return (
    <div
      className={`${styles.studentTypography} experience-role-shell`}
      data-experience-role="teacher"
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
      <ExperienceRoleHeader
        role="Teacher"
        navigationLabel="Teacher navigation"
        navigationItems={topTabs}
        utilityItems={utilityItems}
        logoutLabel="Log out"
      />

      <DashboardSection title={title}>
        {children ?? (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
              gap: 15,
            }}
          >
            {cards.map((card) => (
              <TeacherCard
                key={card.title}
                title={card.title}
                description={card.description}
                href={card.href}
              />
            ))}
          </div>
        )}
      </DashboardSection>
    </div>
  );
}
