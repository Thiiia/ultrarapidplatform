"use client";

import { useRouter } from "next/navigation";
import type { StudentDashboardData } from "@/lib/student-dashboard";
import { learningActivities } from "@/lib/learning-activities";
import LearningActivityCard from "@/app/components/LearningActivityCard";
import ExperienceRoleHeader from "@/app/components/ExperienceRoleHeader";
import { getStudentRoleNavigationItems } from "@/app/components/experience-role-navigation";
import { studentCopy } from "@/lib/student-copy";
import styles from "./student.module.css";

import CheckIcon from "@/public/check.svg";
import CircleCheckIcon from "@/public/circle_check.svg";
import ControllerIcon from "@/public/controller.svg";

type StudentDashboardProps = {
  dashboardData: StudentDashboardData;
  navBasePath?: string;
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
  "linear-gradient(180deg, #082733 0%, #030E14 100%)";

function HeaderBar({
  profileLabel,
  navBasePath,
}: {
  profileLabel: string;
  navBasePath: string;
}) {
  return (
    <ExperienceRoleHeader
      role="Student"
      navigationLabel="Student navigation"
      navigationItems={getStudentRoleNavigationItems(navBasePath)}
      utilityItems={[
        {
          label: profileLabel,
          ariaLabel: "Profile",
          mobileLabel: "Profile",
          href:
            navBasePath === "/demo/student"
              ? `${navBasePath}/profile`
              : "/student/profile",
          mobile: true,
          variant: "profile",
        },
      ]}
      logoutLabel={studentCopy.navigation.logout}
    />
  );
}

export default function StudentDashboard({
  dashboardData,
  navBasePath = "/student",
}: StudentDashboardProps) {
  const router = useRouter();
  const displayName = dashboardData.name ?? "Student";
  const profileLabel = getDisplayFirstName(displayName);

  function handlePlayClick(activityKey: string, activityLabel: string) {
    const selectedActivity = {
      key: activityKey,
      label: activityLabel,
    };

    if (typeof window !== "undefined") {
      window.sessionStorage.setItem(
        "selectedDashboardActivity",
        JSON.stringify(selectedActivity),
      );
    }

    router.push(
      `${navBasePath}/song-choice?activity=${encodeURIComponent(activityKey)}`,
    );
  }

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
      <HeaderBar
        profileLabel={profileLabel}
        navBasePath={navBasePath}
      />

      <div
        style={{
          background: "#2B2B2B",
          width: "100%",
          height: "11vh",
          minHeight: 72,
          borderBottom: "1px solid #FFFFFF14",
          boxSizing: "border-box",
          display: "flex",
          alignItems: "center",
        }}
      >
        <div
          style={{
            width: pagePanelWidth,
            margin: "0 auto",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "flex-start",
            paddingLeft: "0",
            boxSizing: "border-box",
          }}
        >
          <h1
            style={{
              fontSize: 18,
              color: "#FFFFFF",
              fontWeight: 700,
              margin: "4px 0 0",
              lineHeight: 1.2,
            }}
          >
            {studentCopy.dashboard.welcome(profileLabel)}
          </h1>
          <p
            style={{
              fontSize: 14,
              color: "rgba(255,255,255,0.55)",
              margin: "4px 0 0",
              lineHeight: 1.4,
            }}
          >
            {studentCopy.dashboard.welcomeBody}
          </p>
        </div>
      </div>

      <main
        style={{
          width: "100%",
          display: "flex",
          justifyContent: "stretch",
          padding: 0,
        }}
      >
        <div
          style={{
            width: "100%",
            display: "flex",
            flexDirection: "column",
            gap: 0,
            padding: 0,
            borderRadius: 0,
            background: "transparent",
          }}
        >
          <section
            aria-label="Queue and games"
            style={{
              width: "100%",
              display: "flex",
              flexDirection: "column",
              gap: 18,
              background: pageBackgroundStyle,
              border: "1px solid #FFFFFF1F",
              borderTop: "none",
              boxSizing: "border-box",
              minHeight: "calc(100vh - 70px - 11vh)",
              padding: "18px 20px",
            }}
          >
            <div
              style={{
                flex: "0 0 auto",
                display: "flex",
                flexDirection: "column",
                alignItems: "stretch",
                minWidth: 0,
                width: "88%",
                margin: "0 auto",
              }}
            >
              <h2
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  color: "#FFFFFF",
                  fontSize: 24,
                  fontWeight: 700,
                  margin: "0 0 18px 0",
                }}
              >
                <CheckIcon style={{ width: 18, height: 18, flexShrink: 0 }} />
                <span>{studentCopy.dashboard.queueTitle}</span>
              </h2>

              <div
                style={{
                  width: "100%",
                  minHeight: 88,
                  background: "rgba(255,255,255,0.04)",
                  borderRadius: 16,
                  border: "1px solid rgba(255,255,255,0.1)",
                  display: "flex",
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "flex-start",
                  gap: 14,
                  textAlign: "left",
                  padding: "16px 18px",
                  boxSizing: "border-box",
                  margin: 0,
                }}
              >
                <CircleCheckIcon style={{ width: 32, height: 32, flexShrink: 0, display: "block" }} />
                <div
                  style={{
                    minWidth: 0,
                    display: "flex",
                    flexDirection: "column",
                    gap: 4,
                  }}
                >
                  <div style={{ color: "#FFFFFF", fontSize: 16, fontWeight: 600, lineHeight: 1.25 }}>
                    {studentCopy.dashboard.queueEmptyTitle}
                  </div>
                  <div style={{ color: "rgba(255,255,255,0.72)", fontSize: 13, lineHeight: 1.4 }}>
                    {studentCopy.dashboard.queueEmptyBody}
                  </div>
                </div>
              </div>
            </div>

            <div
              style={{
                flex: "1 1 0",
                display: "flex",
                flexDirection: "column",
                minWidth: 0,
                width: "88%",
                margin: "0 auto",
              }}
            >
              <h2
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  color: "#FFFFFF",
                  fontSize: 24,
                  fontWeight: 700,
                  margin: "0 0 18px 0",
                }}
              >
                <ControllerIcon style={{ width: 22, height: 22, flexShrink: 0 }} />
                <span>{studentCopy.dashboard.gamesTitle}</span>
              </h2>

              <div className={styles.learningActivityGrid}>
                {learningActivities.map((game) => (
                  <LearningActivityCard
                    key={game.key}
                    activityKey={game.key}
                    title={game.title}
                    goal={game.goal}
                    description={game.description}
                    icon={game.icon}
                    actionLabel={`Play ${game.title}`}
                    onAction={() => handlePlayClick(game.key, game.title)}
                  />
                ))}
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
