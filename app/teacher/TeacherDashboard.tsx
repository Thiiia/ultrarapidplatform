"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { TeacherDashboardData } from "@/lib/teacher-dashboard";
import { studentCopy } from "@/lib/student-copy";
import styles from "../student/student.module.css";

import URIcon from "@/public/header_icons/URIcon.svg";
import numberBondsImage from "@/public/numeracy_icons/number_bonds.png";
import missingNumbersImage from "@/public/numeracy_icons/missing_numbers.png";
import equationsImage from "@/public/numeracy_icons/equations.png";
import earlyAlgebraImage from "@/public/numeracy_icons/early_algebra.png";

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
  "linear-gradient(180deg, #082733 0%, #030E14 100%)";

function HeaderBar({
  profileLabel,
  navBasePath,
  pathname,
}: {
  profileLabel: string;
  navBasePath: string;
  pathname: string;
}) {
  const topTabs = [
    { label: "Home", href: navBasePath, width: 99 },
    { label: "Assignments", href: `${navBasePath}/assignments`, width: 130 },
    { label: "Classes", href: `${navBasePath}/classes`, width: 120 },
    { label: "Progress", href: `${navBasePath}/progress`, width: 120 },
  ];

  return (
    <header
      style={{
        background: "#060B15FC",
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

          <nav
            aria-label="Teacher dashboard navigation"
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
              const isHomeTab = tab.label === "Home";
              const isActive =
                pathname === tab.href ||
                (isHomeTab && pathname === navBasePath) ||
                (!isHomeTab && pathname.startsWith(`${tab.href}/`));

              return (
                <Link
                  key={tab.label}
                  href={tab.href}
                  aria-label={tab.label}
                  className={`${styles.headerTabButton} ${
                    isActive ? styles.headerTabButtonActive : ""
                  }`}
                  style={{
                    width: tab.width,
                    height: 45.5,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    textDecoration: "none",
                    background: "#060B15FC",
                    borderBottom: isActive
                      ? "3px solid #CFFF04"
                      : "3px solid transparent",
                    color: "#FFFFFF",
                    fontSize: 13,
                    fontWeight: 500,
                    lineHeight: "19.5px",
                  }}
                >
                  {tab.label}
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
          <Link
            href={`${navBasePath}/profile`}
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
              color: "#7A8FA8",
              fontSize: 14,
              fontWeight: 600,
              borderRadius: 999,
              background: "#060B15FC",
              border: "1px solid #7A8FA8",
            }}
          >
            {profileLabel}
          </Link>

          <a
            href="/auth/logout"
            aria-label="Log out"
            className={`${styles.utilityButton} ${styles.logoutButton}`}
            style={{
              background: "#060B15FC",
              color: "#7A8FA8",
              border: "1px solid #7A8FA8",
              borderRadius: 999,
            }}
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
  navBasePath = "/teacher",
  viewedUserName,
  viewedUserEmail,
}: TeacherDashboardProps) {
  const pathname = usePathname();
  const router = useRouter();
  const displayName =
    viewedUserName ?? dashboardData.name ?? viewedUserEmail ?? dashboardData.email;
  const profileLabel = getDisplayFirstName(displayName);
  const isDemo = navBasePath.startsWith("/demo");

  const gameCards = [
    {
      title: "Number Bonds",
      key: "number-bonds",
      icon: numberBondsImage,
      alt: "Number bonds",
      description: studentCopy.dashboard.gameDescriptions.numberBonds,
      disabled: false,
    },
    {
      title: "Equations",
      key: "equations",
      icon: equationsImage,
      alt: "Equations",
      description: studentCopy.dashboard.gameDescriptions.equations,
      disabled: true,
    },
    {
      title: "Missing Numbers",
      key: "missing-numbers",
      icon: missingNumbersImage,
      alt: "Missing numbers",
      description: studentCopy.dashboard.gameDescriptions.missingNumbers,
      disabled: true,
    },
    {
      title: "Early Algebra",
      key: "early-algebra",
      icon: earlyAlgebraImage,
      alt: "Early algebra",
      description: studentCopy.dashboard.gameDescriptions.earlyAlgebra,
      disabled: false,
    },
  ];

  type WizardTarget =
    | { type: "class"; classId: string; label: string }
    | { type: "student"; classId: string; studentId: string; label: string };

  const [selectedActivity, setSelectedActivity] = useState<
    (typeof gameCards)[number] | null
  >(null);
  const [target, setTarget] = useState<WizardTarget | null>(null);
  const [availableMissions, setAvailableMissions] = useState<
    { id: string; title: string; description: string | null }[]
  >([]);
  const [missionsLoading, setMissionsLoading] = useState(false);
  const [missionsError, setMissionsError] = useState("");
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [newMissionTitle, setNewMissionTitle] = useState("");
  const [assigningMissionId, setAssigningMissionId] = useState<string | null>(null);
  const [assignError, setAssignError] = useState("");
  const [assignedSummary, setAssignedSummary] = useState("");

  const step = !selectedActivity ? 1 : !target ? 2 : 3;

  function resetWizard() {
    setSelectedActivity(null);
    setTarget(null);
    setAvailableMissions([]);
    setMissionsError("");
    setIsCreatingNew(false);
    setNewMissionTitle("");
    setAssignError("");
    setAssignedSummary("");
  }

  async function handleChooseActivity(game: (typeof gameCards)[number]) {
    if (game.disabled) {
      return;
    }

    setSelectedActivity(game);
    setTarget(null);
    setAssignedSummary("");
    setAssignError("");
  }

  async function handleChooseTarget(nextTarget: WizardTarget) {
    if (!selectedActivity) {
      return;
    }

    setTarget(nextTarget);
    setAssignedSummary("");
    setAssignError("");
    setMissionsLoading(true);
    setMissionsError("");

    try {
      const params = new URLSearchParams({ activityKey: selectedActivity.key });
      if (isDemo) {
        params.set("demoTeacherId", dashboardData.id);
      }

      const response = await fetch(`/api/teacher/missions?${params.toString()}`);
      const payload = (await response.json().catch(() => null)) as {
        missions?: { id: string; title: string; description: string | null }[];
        error?: string;
      } | null;

      if (!response.ok || !payload?.missions) {
        throw new Error(payload?.error ?? "Failed to load assignments.");
      }

      setAvailableMissions(payload.missions);
    } catch (error) {
      setMissionsError(
        error instanceof Error ? error.message : "Failed to load assignments.",
      );
    } finally {
      setMissionsLoading(false);
    }
  }

  async function handleAssignMission(missionId: string, missionTitle: string) {
    if (!target) {
      return;
    }

    setAssigningMissionId(missionId);
    setAssignError("");

    try {
      const response = await fetch("/api/assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          classId: target.classId,
          missionId,
          studentId: target.type === "student" ? target.studentId : undefined,
          ...(isDemo ? { demoTeacherId: dashboardData.id } : {}),
        }),
      });

      const payload = (await response.json().catch(() => null)) as {
        assignment?: { id: string };
        error?: string;
      } | null;

      if (!response.ok || !payload?.assignment) {
        throw new Error(payload?.error ?? "Failed to assign lesson.");
      }

      setAssignedSummary(`"${missionTitle}" assigned to ${target.label}.`);
    } catch (error) {
      setAssignError(
        error instanceof Error ? error.message : "Failed to assign lesson.",
      );
    } finally {
      setAssigningMissionId(null);
    }
  }

  async function handleCreateAndAssign() {
    if (!selectedActivity || !target) {
      return;
    }

    const title = newMissionTitle.trim();
    if (!title) {
      setAssignError("Enter a title for the new assignment.");
      return;
    }

    setAssigningMissionId("new");
    setAssignError("");

    try {
      const response = await fetch("/api/teacher/missions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          activityKey: selectedActivity.key,
          ...(isDemo ? { demoTeacherId: dashboardData.id } : {}),
        }),
      });

      const payload = (await response.json().catch(() => null)) as {
        mission?: { id: string; title: string; description: string | null };
        error?: string;
      } | null;

      if (!response.ok || !payload?.mission) {
        throw new Error(payload?.error ?? "Failed to create assignment.");
      }

      setAvailableMissions((previous) => [payload.mission!, ...previous]);
      await handleAssignMission(payload.mission.id, payload.mission.title);
      setIsCreatingNew(false);
      setNewMissionTitle("");
    } catch (error) {
      setAssignError(
        error instanceof Error ? error.message : "Failed to create assignment.",
      );
      setAssigningMissionId(null);
    }
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
        pathname={pathname}
      />

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
            aria-label="Assign an activity"
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
                flex: "1 1 0",
                display: "flex",
                flexDirection: "column",
                minWidth: 0,
                width: "88%",
                margin: "0 auto",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 16,
                  margin: "0 0 20px 0",
                }}
              >
                {[
                  { step: 1, label: "Choose an activity" },
                  { step: 2, label: "Choose a class or student" },
                  { step: 3, label: "Assign the activity" },
                ].map((item, index) => {
                  const isActive = step === item.step;
                  const isComplete = step > item.step;

                  return (
                    <div
                      key={item.step}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 16,
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                          color: isActive || isComplete ? "#FFFFFF" : "rgba(255,255,255,0.4)",
                        }}
                      >
                        <span
                          style={{
                            width: 26,
                            height: 26,
                            borderRadius: "50%",
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: 13,
                            fontWeight: 700,
                            background: isActive
                              ? "#CFFF04"
                              : isComplete
                                ? "#2B2B2B"
                                : "transparent",
                            color: isActive ? "#0B1A1F" : "#FFFFFF",
                            border: isComplete || isActive ? "none" : "1px solid rgba(255,255,255,0.4)",
                          }}
                        >
                          {item.step}
                        </span>
                        <span style={{ fontSize: 15, fontWeight: 700 }}>{item.label}</span>
                      </div>
                      {index < 2 && (
                        <span style={{ width: 24, height: 1, background: "#FFFFFF1F" }} />
                      )}
                    </div>
                  );
                })}

                {(selectedActivity || target) && (
                  <button
                    type="button"
                    onClick={resetWizard}
                    style={{
                      marginLeft: "auto",
                      background: "transparent",
                      border: "1px solid #7A8FA8",
                      color: "#7A8FA8",
                      borderRadius: 999,
                      padding: "6px 14px",
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    Start over
                  </button>
                )}
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
                  gap: 18,
                  alignItems: "stretch",
                  width: "100%",
                }}
              >
                {gameCards.map((game) => {
                  const isDisabled = game.disabled;
                  const isSelected = selectedActivity?.key === game.key;

                  return (
                    <div
                      key={game.title}
                      style={{
                        width: "100%",
                        display: "flex",
                        flexDirection: "column",
                        overflow: "hidden",
                        borderRadius: 12,
                        boxSizing: "border-box",
                        border: isSelected ? "2px solid #CFFF04" : "2px solid transparent",
                      }}
                    >
                      <div
                        style={{
                          height: 150,
                          width: "100%",
                          background: "#222222",
                          border: "1px solid #222222",
                          borderBottom: "none",
                          opacity: isDisabled ? 0.5 : 1,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          padding: 10,
                          boxSizing: "border-box",
                        }}
                      >
                        <Image
                          src={game.icon}
                          alt={game.alt}
                          width={320}
                          height={220}
                          unoptimized
                          style={{
                            objectFit: "contain",
                            objectPosition: "center",
                            width: "100%",
                            height: "100%",
                            padding: 10,
                          }}
                          priority={game.title === "Number Bonds"}
                        />
                      </div>

                      <div
                        style={{
                          flex: 1,
                          background: "#2B2B2B",
                          border: "1px solid #FFFFFF14",
                          borderRadius: 0,
                          display: "flex",
                          flexDirection: "column",
                          padding: "12px 12px 14px",
                          boxSizing: "border-box",
                        }}
                      >
                        <div
                          style={{
                            color: "#FFFFFF",
                            fontSize: 16,
                            fontWeight: 600,
                            marginBottom: 8,
                          }}
                        >
                          {game.title}
                        </div>
                        <div
                          style={{
                            color: "rgba(255,255,255,0.55)",
                            fontSize: 13,
                            lineHeight: 1.45,
                            marginBottom: "auto",
                          }}
                        >
                          {game.description}
                        </div>

                        <button
                          type="button"
                          onClick={() => handleChooseActivity(game)}
                          disabled={isDisabled}
                          style={{
                            width: "90%",
                            margin: "10px auto 0",
                            minHeight: 38,
                            borderRadius: 999,
                            border: "none",
                            background: isDisabled
                              ? "#7A7F86"
                              : isSelected
                                ? "#2B2B2B"
                                : "#CFFF04",
                            color: isDisabled
                              ? "#D9D9D9"
                              : isSelected
                                ? "#CFFF04"
                                : "#0B1A1F",
                            fontWeight: 700,
                            fontSize: 13,
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: 8,
                            cursor: isDisabled ? "not-allowed" : "pointer",
                            opacity: isDisabled ? 0.75 : 1,
                          }}
                        >
                          {isDisabled
                            ? studentCopy.dashboard.comingSoon
                            : isSelected
                              ? "Selected"
                              : "Choose"}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {step >= 2 && selectedActivity && (
                <div style={{ marginTop: 24 }}>
                  <h2
                    style={{
                      margin: "0 0 12px 0",
                      color: "#FFFFFF",
                      fontSize: 18,
                      fontWeight: 700,
                    }}
                  >
                    Choose a class or an individual student
                  </h2>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                      gap: 18,
                    }}
                  >
                    <div
                      style={{
                        background: "#2B2B2B",
                        border: "1px solid #FFFFFF14",
                        borderRadius: 14,
                        padding: 16,
                      }}
                    >
                      <h3 style={{ margin: "0 0 10px 0", color: "#FFFFFF", fontSize: 14, fontWeight: 700 }}>
                        Whole class
                      </h3>

                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {dashboardData.classes.length > 0 ? (
                          dashboardData.classes.map((classItem) => {
                            const isSelectedTarget =
                              target?.type === "class" && target.classId === classItem.id;

                            return (
                              <button
                                key={classItem.id}
                                type="button"
                                onClick={() =>
                                  handleChooseTarget({
                                    type: "class",
                                    classId: classItem.id,
                                    label: classItem.name,
                                  })
                                }
                                style={{
                                  textAlign: "left",
                                  background: isSelectedTarget ? "#CFFF041A" : "#191919",
                                  border: isSelectedTarget
                                    ? "1px solid #CFFF0440"
                                    : "1px solid #FFFFFF14",
                                  borderRadius: 10,
                                  padding: "10px 12px",
                                  color: "#FFFFFF",
                                  cursor: "pointer",
                                  display: "flex",
                                  justifyContent: "space-between",
                                  alignItems: "center",
                                  gap: 8,
                                }}
                              >
                                <span style={{ fontSize: 13, fontWeight: 600 }}>{classItem.name}</span>
                                <span style={{ fontSize: 12, color: "rgba(255,255,255,0.55)" }}>
                                  {classItem.studentCount} student{classItem.studentCount === 1 ? "" : "s"}
                                </span>
                              </button>
                            );
                          })
                        ) : (
                          <p style={{ margin: 0, color: "rgba(255,255,255,0.55)", fontSize: 13 }}>
                            No classes yet.
                          </p>
                        )}
                      </div>
                    </div>

                    <div
                      style={{
                        background: "#2B2B2B",
                        border: "1px solid #FFFFFF14",
                        borderRadius: 14,
                        padding: 16,
                      }}
                    >
                      <h3 style={{ margin: "0 0 10px 0", color: "#FFFFFF", fontSize: 14, fontWeight: 700 }}>
                        Individual student
                      </h3>

                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: 8,
                          maxHeight: 220,
                          overflowY: "auto",
                        }}
                      >
                        {dashboardData.students.length > 0 ? (
                          dashboardData.students.map((student) => {
                            const isSelectedTarget =
                              target?.type === "student" && target.studentId === student.id;

                            return (
                              <button
                                key={student.id}
                                type="button"
                                onClick={() =>
                                  handleChooseTarget({
                                    type: "student",
                                    classId: student.classIds[0],
                                    studentId: student.id,
                                    label: student.name ?? student.email,
                                  })
                                }
                                disabled={student.classIds.length === 0}
                                style={{
                                  textAlign: "left",
                                  background: isSelectedTarget ? "#CFFF041A" : "#191919",
                                  border: isSelectedTarget
                                    ? "1px solid #CFFF0440"
                                    : "1px solid #FFFFFF14",
                                  borderRadius: 10,
                                  padding: "10px 12px",
                                  color: "#FFFFFF",
                                  cursor: student.classIds.length === 0 ? "not-allowed" : "pointer",
                                  opacity: student.classIds.length === 0 ? 0.5 : 1,
                                  display: "flex",
                                  flexDirection: "column",
                                  gap: 2,
                                }}
                              >
                                <span style={{ fontSize: 13, fontWeight: 600 }}>
                                  {student.name ?? student.email}
                                </span>
                                <span style={{ fontSize: 12, color: "rgba(255,255,255,0.55)" }}>
                                  {student.classNames.join(", ") || "No class"}
                                </span>
                              </button>
                            );
                          })
                        ) : (
                          <p style={{ margin: 0, color: "rgba(255,255,255,0.55)", fontSize: 13 }}>
                            No students yet.
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {step === 3 && selectedActivity && target && (
                <div style={{ marginTop: 24 }}>
                  <h2
                    style={{
                      margin: "0 0 12px 0",
                      color: "#FFFFFF",
                      fontSize: 18,
                      fontWeight: 700,
                    }}
                  >
                    Assign {selectedActivity.title} to {target.label}
                  </h2>

                  {assignedSummary && (
                    <div
                      style={{
                        background: "#CFFF041A",
                        border: "1px solid #CFFF0440",
                        color: "#CFFF04",
                        borderRadius: 10,
                        padding: "10px 14px",
                        fontSize: 13,
                        fontWeight: 600,
                        marginBottom: 14,
                      }}
                    >
                      {assignedSummary}
                    </div>
                  )}

                  {assignError && (
                    <div
                      style={{
                        background: "#FF6B6B1A",
                        border: "1px solid #FF6B6B40",
                        color: "#FF6B6B",
                        borderRadius: 10,
                        padding: "10px 14px",
                        fontSize: 13,
                        fontWeight: 600,
                        marginBottom: 14,
                      }}
                    >
                      {assignError}
                    </div>
                  )}

                  <div
                    style={{
                      background: "#2B2B2B",
                      border: "1px solid #FFFFFF14",
                      borderRadius: 14,
                      padding: 16,
                      display: "flex",
                      flexDirection: "column",
                      gap: 10,
                    }}
                  >
                    {missionsLoading ? (
                      <p style={{ margin: 0, color: "rgba(255,255,255,0.55)", fontSize: 13 }}>
                        Loading existing assignments…
                      </p>
                    ) : missionsError ? (
                      <p style={{ margin: 0, color: "#FF6B6B", fontSize: 13 }}>{missionsError}</p>
                    ) : availableMissions.length > 0 ? (
                      availableMissions.map((mission) => (
                        <div
                          key={mission.id}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: 12,
                            background: "#191919",
                            border: "1px solid #FFFFFF14",
                            borderRadius: 10,
                            padding: "10px 14px",
                          }}
                        >
                          <div>
                            <div style={{ color: "#FFFFFF", fontSize: 14, fontWeight: 600 }}>
                              {mission.title}
                            </div>
                            {mission.description && (
                              <div style={{ color: "rgba(255,255,255,0.55)", fontSize: 12, marginTop: 2 }}>
                                {mission.description}
                              </div>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => handleAssignMission(mission.id, mission.title)}
                            disabled={assigningMissionId === mission.id}
                            style={{
                              minWidth: 90,
                              height: 34,
                              borderRadius: 999,
                              border: "none",
                              background: "#CFFF04",
                              color: "#0B1A1F",
                              fontWeight: 700,
                              fontSize: 12,
                              cursor: "pointer",
                              opacity: assigningMissionId === mission.id ? 0.6 : 1,
                            }}
                          >
                            {assigningMissionId === mission.id ? "Assigning…" : "Assign"}
                          </button>
                        </div>
                      ))
                    ) : (
                      <p style={{ margin: 0, color: "rgba(255,255,255,0.55)", fontSize: 13 }}>
                        No existing {selectedActivity.title} assignments yet.
                      </p>
                    )}

                    <div style={{ borderTop: "1px solid #FFFFFF14", marginTop: 6, paddingTop: 14 }}>
                      {isCreatingNew ? (
                        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                          <input
                            value={newMissionTitle}
                            onChange={(event) => setNewMissionTitle(event.target.value)}
                            placeholder="New assignment title"
                            style={{
                              flex: "1 1 220px",
                              height: 38,
                              background: "#191919",
                              color: "#FFFFFF",
                              border: "1px solid #FFFFFF1F",
                              borderRadius: 10,
                              padding: "0 12px",
                              fontSize: 13,
                            }}
                          />
                          <button
                            type="button"
                            onClick={handleCreateAndAssign}
                            disabled={assigningMissionId === "new"}
                            style={{
                              minWidth: 130,
                              height: 38,
                              borderRadius: 999,
                              border: "none",
                              background: "#CFFF04",
                              color: "#0B1A1F",
                              fontWeight: 700,
                              fontSize: 13,
                              cursor: "pointer",
                              opacity: assigningMissionId === "new" ? 0.6 : 1,
                            }}
                          >
                            {assigningMissionId === "new" ? "Creating…" : "Create & assign"}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setIsCreatingNew(false);
                              setNewMissionTitle("");
                            }}
                            style={{
                              height: 38,
                              borderRadius: 999,
                              border: "1px solid #7A8FA8",
                              background: "transparent",
                              color: "#7A8FA8",
                              fontWeight: 600,
                              fontSize: 13,
                              cursor: "pointer",
                              padding: "0 14px",
                            }}
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setIsCreatingNew(true)}
                          style={{
                            height: 38,
                            borderRadius: 999,
                            border: "1px dashed #CFFF04",
                            background: "transparent",
                            color: "#CFFF04",
                            fontWeight: 700,
                            fontSize: 13,
                            cursor: "pointer",
                            padding: "0 16px",
                          }}
                        >
                          + Create a new assignment
                        </button>
                      )}
                    </div>
                  </div>

                  {assignedSummary && (
                    <button
                      type="button"
                      onClick={() => router.push(`${navBasePath}/assignments`)}
                      style={{
                        marginTop: 14,
                        background: "transparent",
                        border: "none",
                        color: "#CFFF04",
                        fontSize: 13,
                        fontWeight: 700,
                        cursor: "pointer",
                        padding: 0,
                      }}
                    >
                      View all assignments →
                    </button>
                  )}
                </div>
              )}
            </div>
          </section>

        </div>
      </main>
    </div>
  );
}
