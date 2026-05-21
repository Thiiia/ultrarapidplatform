"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import styles from "../student/student.module.css";

import URIcon from "@/public/header_icons/URIcon.svg";
import ProfileIcon from "@/public/utility_icons/profile_icon.svg";

type HeaderTab = {
  label: string;
  href: string;
  width: number;
};

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
      label: "Students",
      href: `${navBasePath}/students`,
      width: 120,
    },
    {
      label: "Lessons",
      href: `${navBasePath}/lessons`,
      width: 120,
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

function HeaderTabButton({
  tab,
  pathname,
}: {
  tab: HeaderTab;
  pathname: string;
}) {
  const isHomeTab = tab.label === "Home";

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
          <Link
            href="/teacher/profile"
            aria-label="Profile"
            className={styles.utilityButton}
            style={{
              width: 134.45,
              height: 38,
            }}
          >
            <ProfileIcon
              style={{
                width: 134.45,
                height: 38,
                display: "block",
              }}
            />
          </Link>

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
}: {
  title: string;
  children?: ReactNode;
}) {
  return (
    <div
      style={{
        background: "#2B2B2B",
        width: "100%",
        borderBottom: `1px solid ${headerStyles.borderBottomColor}`,
      }}
    >
      <section
        style={{
          background: "#2B2B2B",
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
      style={{
        background: "#191919",
        border: "1px solid #FFFFFF14",
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
  const pathname = usePathname();
  const topTabs = getTopTabs(navBasePath);

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