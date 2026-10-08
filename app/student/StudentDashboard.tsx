"use client";

import { useId } from "react";
import Link from "next/link";
import type { StudentDashboardData } from "@/lib/student-dashboard";
import { learningActivities } from "@/lib/learning-activities";
import LearningActivityCard from "@/app/components/LearningActivityCard";
import ExperienceRoleHeader from "@/app/components/ExperienceRoleHeader";
import { getStudentRoleNavigationItems } from "@/app/components/experience-role-navigation";
import { studentCopy } from "@/lib/student-copy";
import styles from "./student.module.css";
import NextIcon from "@/public/Next_Button.svg";

type StudentDashboardProps = {
  dashboardData: StudentDashboardData;
  navBasePath?: string;
};

function getDisplayFirstName(value?: string | null) {
  if (!value) {
    return "Student";
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return "Student";
  }

  const [firstName] = trimmed.split(/\s+/);
  return firstName || "Student";
}

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
  const lessonDescriptionId = useId();
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
  }

  return (
    <div
      className={`${styles.studentTypography} ${styles.studentDashboard}`}
    >
      <HeaderBar
        profileLabel={profileLabel}
        navBasePath={navBasePath}
      />
      <main className={styles.studentDashboardMain}>
        <header className={styles.studentDashboardIntro}>
          <h1>{studentCopy.dashboard.welcome(profileLabel)}</h1>
          <p>
            {dashboardData.currentLessons.length > 0
              ? studentCopy.dashboard.welcomeWithLessons
              : studentCopy.dashboard.welcomeBody}
          </p>
        </header>

        {dashboardData.currentLessons.length > 0 ? (
          <section
            className={styles.studentDashboardLessons}
            aria-labelledby="student-lessons-heading"
          >
            <div className={styles.studentDashboardSectionHeading}>
              <h2 id="student-lessons-heading">{studentCopy.dashboard.queueTitle}</h2>
              {dashboardData.currentLessons.length > 3 ? (
                <Link className={styles.studentDashboardSeeAll} href={`${navBasePath}/lessons`}>
                  {studentCopy.dashboard.seeAllLessons}
                </Link>
              ) : null}
            </div>
            <ul className={styles.studentLessonList}>
              {dashboardData.currentLessons.slice(0, 3).map((lesson, index) => {
                const inProgress = lesson.status === "in_progress";
                const status = lesson.status === "assigned"
                  ? studentCopy.dashboard.lessonAssigned
                  : inProgress
                    ? studentCopy.dashboard.lessonInProgress
                    : studentCopy.dashboard.lessonNew;

                return (
                  <li key={lesson.href}>
                    <Link
                      className={styles.studentLessonLink}
                      href={lesson.href}
                      aria-describedby={lesson.description ? `${lessonDescriptionId}-${index}` : undefined}
                      aria-label={`${inProgress ? studentCopy.dashboard.continueLesson : studentCopy.dashboard.startLesson}: ${lesson.title}`}
                    >
                      <span className={styles.studentLessonStatus}>{status}</span>
                      <h3 className={styles.studentLessonTitle}>{lesson.title}</h3>
                      {lesson.description ? (
                        <span
                          id={`${lessonDescriptionId}-${index}`}
                          className={styles.studentLessonDescription}
                        >
                          {lesson.description}
                        </span>
                      ) : null}
                      <span className={styles.studentLessonAction}>
                        {inProgress
                          ? studentCopy.dashboard.continueLesson
                          : studentCopy.dashboard.startLesson}
                        <NextIcon aria-hidden="true" style={{ width: 16, height: 16 }} />
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        ) : null}

        <section
          className={styles.studentDashboardGames}
          aria-labelledby="student-games-heading"
        >
          <div className={styles.studentDashboardSectionHeading}>
            <h2 id="student-games-heading">{studentCopy.dashboard.gamesTitle}</h2>
          </div>
          <div className={styles.learningActivityGrid}>
            {learningActivities.map((game) => (
              <LearningActivityCard
                key={game.key}
                activityKey={game.key}
                title={game.title}
                goal={game.goal}
                description={game.description}
                icon={game.icon}
                actionLabel={studentCopy.dashboard.play}
                href={`${navBasePath}/song-choice?activity=${encodeURIComponent(game.key)}`}
                onAction={() => handlePlayClick(game.key, game.title)}
              />
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
