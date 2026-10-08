"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { studentCopy } from "@/lib/student-copy";
import ExperienceRoleHeader, {
  type ExperienceRoleHeaderAction,
} from "@/app/components/ExperienceRoleHeader";
import { getStudentRoleNavigationItems } from "@/app/components/experience-role-navigation";
import styles from "./student.module.css";

import ProfileIcon from "@/public/utility_icons/profile_icon.svg";

type StudentSubpageCard = {
  title: string;
  description: string;
  href?: string;
};

type StudentSubpageShellProps = {
  title: string;
  cards: StudentSubpageCard[];
  navBasePath?: string;
  children?: ReactNode;
};

function getUtilityItems(navBasePath = "/student"): ExperienceRoleHeaderAction[] {
  return [
    {
      label: "Profile",
      href: navBasePath === "/demo/student" ? `${navBasePath}/profile` : "/student/profile",
      Icon: ProfileIcon,
      width: 134.45,
      mobile: true,
    },
  ];
}

const headerStyles = {
  backgroundColor: "var(--ur-canvas-top)",
  borderBottomColor: "#FFFFFF14",
};

const pagePanelWidth = "85vw";
const pageBackgroundColor = "var(--ur-canvas-deep)";
const firstPanelBackgroundColor = headerStyles.backgroundColor;

type SectionProps = {
  title: string;
  children?: ReactNode;
};

function DashboardSection({ title, children }: SectionProps) {
  return (
    <div
      style={{
        background: firstPanelBackgroundColor,
        width: "100%",
        borderBottom: `1px solid ${headerStyles.borderBottomColor}`,
      }}
    >
      <section
        style={{
          background: firstPanelBackgroundColor,
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

function PlaceholderCard({
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
        background: "var(--ur-canvas-top)",
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
          color: "#fff",
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

export default function StudentSubpageShell({
  title,
  cards,
  children,
  navBasePath = "/student",
}: StudentSubpageShellProps) {
  const topTabs = getStudentRoleNavigationItems(navBasePath);

  return (
    <div
      className={`${styles.studentTypography} experience-role-shell`}
      data-experience-role="student"
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
        role="Student"
        navigationLabel="Student navigation"
        navigationItems={topTabs}
        utilityItems={getUtilityItems(navBasePath)}
        logoutLabel={studentCopy.navigation.logout}
      />

      <DashboardSection title={title}>
        <div className={styles.subpageCardGrid}>
          {cards.map((card) => (
            <PlaceholderCard
              key={card.title}
              title={card.title}
              description={card.description}
              href={card.href}
            />
          ))}
        </div>
        {children}
      </DashboardSection>
    </div>
  );
}
