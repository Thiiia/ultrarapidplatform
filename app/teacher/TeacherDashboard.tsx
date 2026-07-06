"use client";

import Image from "next/image";
import Link from "next/link";
import type { TeacherDashboardData } from "@/lib/teacher-dashboard";
import styles from "../student/student.module.css";

import URIcon from "@/public/header_icons/URIcon.svg";
import numberBondsImage from "@/public/numeracy_icons/number_bonds.png";
import missingNumbersImage from "@/public/numeracy_icons/missing_numbers.png";
import equationsImage from "@/public/numeracy_icons/equations.png";
import earlyAlgebraImage from "@/public/numeracy_icons/early_algebra.png";

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
  "linear-gradient(0deg, #F9FAFB, #F9FAFB), linear-gradient(180deg, #082733 0%, #030E14 100%)";

function HeaderBar({ profileLabel }: { profileLabel: string }) {
  return (
    <header
      style={{
        background: "#082733",
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
              minWidth: 112,
              height: 38,
              padding: "0 16px",
              textDecoration: "none",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#FFFFFF",
              fontSize: 14,
              fontWeight: 600,
              borderRadius: 999,
            }}
          >
            {profileLabel}
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

export default function TeacherDashboard({
  dashboardData,
  viewedUserName,
  viewedUserEmail,
}: TeacherDashboardProps) {
  const displayName =
    viewedUserName ?? dashboardData.name ?? viewedUserEmail ?? dashboardData.email;
  const profileLabel = getDisplayFirstName(displayName);

  const numeracyPanels = [
    { title: "Number Bonds", src: numberBondsImage, alt: "Number bonds" },
    { title: "Missing Numbers", src: missingNumbersImage, alt: "Missing numbers" },
    { title: "Equations", src: equationsImage, alt: "Equations" },
    { title: "Early Algebra", src: earlyAlgebraImage, alt: "Early algebra" },
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
      <HeaderBar profileLabel={profileLabel} />

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
            display: "grid",
            gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
            gap: 20,
          }}
        >
          {numeracyPanels.map((panel) => (
            <div
              key={panel.title}
              style={{
                background: "#F9FAFB",
                border: "1px solid #CFFF04",
                borderRadius: 20,
                padding: 1,
                minHeight: 280,
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                alignItems: "center",
                boxShadow: "0 16px 35px rgba(0, 0, 0, 0.16)",
              }}
            >
              <div
                style={{
                  width: "calc(100% - 2px)",
                  aspectRatio: "4 / 3",
                  position: "relative",
                  borderRadius: 19,
                  overflow: "hidden",
                  background: "#F9FAFB",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Image
                  src={panel.src}
                  alt={panel.alt}
                  fill
                  style={{ objectFit: "cover", objectPosition: "center", padding: 1 }}
                  priority={panel.title === "Number Bonds"}
                />
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
