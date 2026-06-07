"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ChangeEvent, DragEvent, FC, SVGProps } from "react";
import { useEffect, useMemo, useState } from "react";
import { useEditorStore } from "@/lib/editor/editor-store";
import { chartToProject } from "@/lib/editor/chart-to-project";
import styles from "../student.module.css";

/* Header Icon imports */
import URIcon from "@/public/header_icons/URIcon.svg";
import HomeIcon from "@/public/header_icons/Home.svg";
import HomePressedIcon from "@/public/header_icons/Home_pressed.svg";
import MyLessonsTab from "@/public/header_icons/my_lessons_tab.svg";
import MyLessonsPressedTab from "@/public/header_icons/my_lessons_tab_pressed.svg";
import LessonBuilderTab from "@/public/header_icons/lesson_builder_tab.svg";
import LessonBuilderPressedTab from "@/public/header_icons/lesson_builder_tab_pressed.svg";
import ProgressTab from "@/public/header_icons/progress_tab.svg";
import ProgressPressedTab from "@/public/header_icons/progress_tab_pressed.svg";
import PlayTab from "@/public/header_icons/play_tab.svg";
import PlayPressedTab from "@/public/header_icons/play_tab_pressed.svg";

/* Utility Icon Imports */
import ProfileIcon from "@/public/utility_icons/profile_icon.svg";

type LessonBuilderPayload = {
  chartFile: string;
  analysisMetadata?: {
    songTitle?: string;
    artist?: string;
    bpm?: number;
    durationSeconds?: number;
    uploadedFileName?: string;
  };
  rawResults?: unknown;
};

type SelectedSongPayload = {
  id: string;
  name: string;
  title?: string;
  artist?: string | null;

  song: {
    bucket: string;
    path: string;
    signedUrl: string;
    contentType: string | null;
  };

  chart: {
    bucket: string;
    path: string;
    signedUrl: string;
    contentType: string | null;
  };

  sidecar: {
    bucket: string;
    path: string;
    signedUrl: string;
    contentType: string | null;
  } | null;
};

type EquationToken = {
  id: string;
  label: string;
};

type SavedEquation = {
  id: string;
  tokens: EquationToken[];
};

type GameplayMechanic = "spin" | "drag" | "hit";

type SidecarMechanicEvent = {
  tick: number;
  type: "ALG_MECHANIC";
  mechanic: GameplayMechanic;
  hits?: number;
};

type SidecarEquationStateEvent = {
  tick: number;
  type: "ALG_EQUATION_STATE";
  equationId: string;
  state: string;
};

type SidecarEvent = SidecarMechanicEvent | SidecarEquationStateEvent;

type SidecarPayload = {
  version: 1;
  events: SidecarEvent[];
};

type TabIcon = FC<SVGProps<SVGSVGElement>>;

type HeaderTab = {
  label: string;
  href: string;
  Icon: TabIcon;
  ActiveIcon: TabIcon;
  width: number;
};

type UtilityTab = {
  label: string;
  href: string;
  Icon: TabIcon;
  width: number;
};

type LessonBuilderClientProps = {
  navBasePath?: string;
};

function getTopTabs(navBasePath = "/student"): HeaderTab[] {
  return [
    {
      label: "Home",
      href: navBasePath,
      Icon: HomeIcon,
      ActiveIcon: HomePressedIcon,
      width: 99,
    },
    {
      label: "My Lessons",
      href: `${navBasePath}/lessons`,
      Icon: MyLessonsTab,
      ActiveIcon: MyLessonsPressedTab,
      width: 139,
    },
    {
      label: "Lesson Builder",
      href: `${navBasePath}/song-choice`,
      Icon: LessonBuilderTab,
      ActiveIcon: LessonBuilderPressedTab,
      width: 159,
    },
    {
      label: "Progress",
      href: `${navBasePath}/progress`,
      Icon: ProgressTab,
      ActiveIcon: ProgressPressedTab,
      width: 120,
    },
    {
      label: "Play",
      href: `${navBasePath}/game`,
      Icon: PlayTab,
      ActiveIcon: PlayPressedTab,
      width: 99,
    },
  ];
}

const utilityTabs: UtilityTab[] = [
  { label: "Profile", href: "/student/profile", Icon: ProfileIcon, width: 134.45 },
];

const pagePanelWidth = "92vw";
const headerBackgroundColor = "#2B2B2B";
const pageBackgroundColor = "#191919";
const subtleBorderColor = "#FFFFFF14";
const textColor = "#FFFFFF";

const emptySidecar: SidecarPayload = {
  version: 1,
  events: [],
};

const gameplayMechanics: GameplayMechanic[] = ["spin", "drag", "hit"];

const equationPalette = [
  "0",
  "1",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "X",
  "+",
  "-",
  "×",
  "÷",
  "=",
];

function makeId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeTick(value: unknown) {
  const nextTick = Number(value);

  if (!Number.isFinite(nextTick)) {
    return 0;
  }

  return Math.max(0, Math.round(nextTick));
}

function normalizeMechanic(value: unknown): GameplayMechanic | null {
  if (value === "spin" || value === "drag" || value === "hit") {
    return value;
  }

  return null;
}

function sortEvents(events: SidecarEvent[]) {
  return [...events].sort((left, right) => {
    if (left.tick !== right.tick) {
      return left.tick - right.tick;
    }

    return left.type.localeCompare(right.type);
  });
}

function normalizeSidecar(value: unknown): SidecarPayload {
  if (!isObject(value) || !Array.isArray(value.events)) {
    return emptySidecar;
  }

  const events = value.events.flatMap((event): SidecarEvent[] => {
    if (!isObject(event)) {
      return [];
    }

    if (event.type === "ALG_MECHANIC") {
      const mechanic = normalizeMechanic(event.mechanic);

      if (!mechanic) {
        return [];
      }

      const hits = Number(event.hits);

      return [
        {
          tick: normalizeTick(event.tick),
          type: "ALG_MECHANIC",
          mechanic,
          ...(Number.isFinite(hits) && hits > 0
            ? { hits: Math.max(1, Math.round(hits)) }
            : {}),
        },
      ];
    }

    if (event.type === "ALG_EQUATION_STATE") {
      const equationId = typeof event.equationId === "string" ? event.equationId : "";
      const state = typeof event.state === "string" ? event.state : "";

      if (!equationId.trim() || !state.trim()) {
        return [];
      }

      return [
        {
          tick: normalizeTick(event.tick),
          type: "ALG_EQUATION_STATE",
          equationId,
          state,
        },
      ];
    }

    return [];
  });

  return {
    version: 1,
    events: sortEvents(events),
  };
}

function sidecarToJson(sidecar: SidecarPayload) {
  return JSON.stringify(normalizeSidecar(sidecar), null, 2);
}

function tokensToEquationState(tokens: EquationToken[]) {
  return tokens.map((token) => token.label).join(" ");
}

function getSidecarFileName(chartName?: string) {
  const baseName = chartName?.trim()?.replace(/\.chart$/i, "") || "ultrarapid-chart";
  return `${baseName}.json`;
}

async function readFileAsText(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () => reject(reader.error ?? new Error("Unable to read file"));
    reader.readAsText(file);
  });
}

function downloadTextFile(fileName: string, text: string, contentType: string) {
  const blob = new Blob([text], { type: contentType });
  const href = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = href;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(href);
}

async function fileFromSignedUrl({
  signedUrl,
  path,
  name,
  contentType,
}: {
  signedUrl: string;
  path: string;
  name: string;
  contentType: string | null;
}) {
  const response = await fetch(signedUrl);

  if (!response.ok) {
    throw new Error(`Unable to load file: ${response.status}`);
  }

  const blob = await response.blob();
  const extension = path.split(".").pop();
  const fileName = extension ? `${name}.${extension}` : name;

  return new File([blob], fileName, {
    type: contentType ?? blob.type,
  });
}

async function textFromSignedUrl(signedUrl: string) {
  const response = await fetch(signedUrl);

  if (!response.ok) {
    throw new Error(`Unable to load text file: ${response.status}`);
  }

  return response.text();
}

async function jsonFromSignedUrl(signedUrl: string) {
  const response = await fetch(signedUrl);

  if (!response.ok) {
    throw new Error(`Unable to load JSON file: ${response.status}`);
  }

  return response.json();
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
        background: headerBackgroundColor,
        width: "100%",
        boxSizing: "border-box",
        height: 70,
        border: "none",
        borderBottom: `1px solid ${subtleBorderColor}`,
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
            aria-label="Student navigation"
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
              const cleanTabHref = tab.href.split("?")[0];
              const isHomeTab = tab.label === "Home";
              const isPlayTab = tab.label === "Play";
              const isLessonBuilderTab = tab.label === "Lesson Builder";

              const lessonBuilderPath = cleanTabHref.replace(
                "/song-choice",
                "/lesson-builder",
              );

              const isActive =
                pathname === cleanTabHref ||
                (isLessonBuilderTab &&
                  (pathname === lessonBuilderPath ||
                    pathname.startsWith(`${lessonBuilderPath}/`))) ||
                (!isHomeTab &&
                  !isPlayTab &&
                  !isLessonBuilderTab &&
                  cleanTabHref !== "/" &&
                  pathname.startsWith(`${cleanTabHref}/`));

              const Icon = isActive ? tab.ActiveIcon : tab.Icon;

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
                    opacity: 1,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Icon
                    style={{
                      width: tab.width,
                      height: 45.5,
                      display: "block",
                    }}
                  />
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
          {utilityTabs.map((tab) => (
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
                  width: tab.width,
                  height: 38,
                  display: "block",
                }}
              />
            </Link>
          ))}

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

function EditorTopPanel({
  currentTick,
  hits,
  sidecarError,
  chartName,
  onCurrentTickChange,
  onHitsChange,
  onAddMechanic,
  onChartUpload,
  onSidecarUpload,
  onDownloadChart,
  onDownloadSidecar,
}: {
  currentTick: number;
  hits: number;
  sidecarError: string;
  chartName: string;
  onCurrentTickChange: (tick: number) => void;
  onHitsChange: (hits: number) => void;
  onAddMechanic: (mechanic: GameplayMechanic) => void;
  onChartUpload: (file: File) => void;
  onSidecarUpload: (file: File) => void;
  onDownloadChart: () => void;
  onDownloadSidecar: () => void;
}) {
  return (
    <section
      aria-label="Lesson builder controls"
      style={{
        width: "100%",
        minHeight: 96,
        background: headerBackgroundColor,
        borderBottom: `1px solid ${subtleBorderColor}`,
        boxSizing: "border-box",
        color: textColor,
        display: "flex",
        alignItems: "center",
      }}
    >
      <div
        style={{
          width: pagePanelWidth,
          margin: "0 auto",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
          fontFamily: "Space Grotesk, sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <label style={{ fontSize: 12, fontWeight: 700 }}>
            Load .chart
            <input
              type="file"
              accept=".chart,text/plain"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) onChartUpload(file);
                event.currentTarget.value = "";
              }}
              style={{ display: "block", marginTop: 6, maxWidth: 190 }}
            />
          </label>

          <label style={{ fontSize: 12, fontWeight: 700 }}>
            Load sidecar JSON
            <input
              type="file"
              accept=".json,application/json"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) onSidecarUpload(file);
                event.currentTarget.value = "";
              }}
              style={{ display: "block", marginTop: 6, maxWidth: 190 }}
            />
          </label>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <label style={{ fontSize: 12, fontWeight: 700 }}>
            Tick
            <input
              type="number"
              min={0}
              step={1}
              value={currentTick}
              onChange={(event) => onCurrentTickChange(normalizeTick(event.target.value))}
              style={{
                width: 100,
                marginLeft: 8,
                background: "#191919",
                color: textColor,
                border: `1px solid ${subtleBorderColor}`,
                borderRadius: 8,
                padding: "8px 10px",
                fontWeight: 700,
              }}
            />
          </label>

          <label style={{ fontSize: 12, fontWeight: 700 }}>
            Hits
            <input
              type="number"
              min={1}
              step={1}
              value={hits}
              onChange={(event) => onHitsChange(Math.max(1, normalizeTick(event.target.value)))}
              style={{
                width: 70,
                marginLeft: 8,
                background: "#191919",
                color: textColor,
                border: `1px solid ${subtleBorderColor}`,
                borderRadius: 8,
                padding: "8px 10px",
                fontWeight: 700,
              }}
            />
          </label>

          {gameplayMechanics.map((mechanic) => (
            <button
              key={mechanic}
              type="button"
              onClick={() => onAddMechanic(mechanic)}
              style={{
                minHeight: 36,
                background: "#CFFF04",
                color: "#000000",
                border: "1px solid #CFFF04",
                borderRadius: 10,
                padding: "0 14px",
                fontFamily: "Space Grotesk, sans-serif",
                fontSize: 12,
                fontWeight: 800,
                cursor: "pointer",
                textTransform: "capitalize",
              }}
            >
              Add {mechanic}
            </button>
          ))}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <button
            type="button"
            disabled={!chartName.trim()}
            onClick={onDownloadChart}
            style={{
              minHeight: 36,
              background: "#191919",
              color: textColor,
              border: `1px solid ${subtleBorderColor}`,
              borderRadius: 10,
              padding: "0 12px",
              fontFamily: "Space Grotesk, sans-serif",
              fontSize: 12,
              fontWeight: 700,
              cursor: chartName.trim() ? "pointer" : "not-allowed",
            }}
          >
            Download .chart
          </button>

          <button
            type="button"
            onClick={onDownloadSidecar}
            style={{
              minHeight: 36,
              background: "#191919",
              color: textColor,
              border: `1px solid ${sidecarError ? "#FF7777" : subtleBorderColor}`,
              borderRadius: 10,
              padding: "0 12px",
              fontFamily: "Space Grotesk, sans-serif",
              fontSize: 12,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Download JSON
          </button>

          {sidecarError ? (
            <span style={{ color: "#FF8C8C", fontSize: 11, fontWeight: 700, maxWidth: 220 }}>
              {sidecarError}
            </span>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function EquationCircle({
  label,
  draggable = true,
  size = 34,
}: {
  label: string;
  draggable?: boolean;
  size?: number;
}) {
  return (
    <div
      draggable={draggable}
      onDragStart={(event) => {
        if (!draggable) return;

        event.dataTransfer.setData(
          "application/x-equation-token",
          JSON.stringify({ label }),
        );
        event.dataTransfer.effectAllowed = "copy";
      }}
      style={{
        width: size,
        height: size,
        borderRadius: "999px",
        background: "#191919",
        border: "2px solid rgba(255, 255, 255, 0.72)",
        color: "#FFFFFF",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "Grandstander, Space Grotesk, sans-serif",
        fontSize: size >= 60 ? 32 : 16,
        fontWeight: 700,
        lineHeight: 1,
        cursor: draggable ? "grab" : "default",
        userSelect: "none",
        flexShrink: 0,
        textShadow: "0 0 10px rgba(255, 255, 255, 0.25)",
      }}
    >
      {label}
    </div>
  );
}

function EquationDropSlot({
  index,
  onInsertToken,
}: {
  index: number;
  onInsertToken: (index: number, label: string) => void;
}) {
  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();

    const rawToken = event.dataTransfer.getData("application/x-equation-token");

    if (!rawToken) {
      return;
    }

    try {
      const parsed = JSON.parse(rawToken) as { label?: string };

      if (parsed.label) {
        onInsertToken(index, parsed.label);
      }
    } catch (error) {
      console.error("Failed to drop equation token", error);
    }
  }

  return (
    <div
      onDragOver={(event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = "copy";
      }}
      onDrop={handleDrop}
      title="Drop here"
      style={{
        width: 34,
        height: 34,
        borderRadius: "999px",
        background: "#191919",
        border: "2px dashed rgba(255, 255, 255, 0.58)",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}
    />
  );
}

function CustomEquationCircle({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const draggable = value.trim().length > 0;

  return (
    <div
      draggable={draggable}
      onDragStart={(event) => {
        const label = value.trim();

        if (!label) {
          event.preventDefault();
          return;
        }

        event.dataTransfer.setData(
          "application/x-equation-token",
          JSON.stringify({ label }),
        );
        event.dataTransfer.effectAllowed = "copy";
      }}
      style={{
        width: 68,
        height: 68,
        borderRadius: "999px",
        background: "#191919",
        border: "2px dashed rgba(255, 255, 255, 0.72)",
        color: "#FFFFFF",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: draggable ? "grab" : "text",
        flexShrink: 0,
      }}
      title="Click to type a custom number or symbol"
    >
      <input
        value={value}
        onChange={(event: ChangeEvent<HTMLInputElement>) => {
          onChange(event.target.value.slice(0, 3));
        }}
        placeholder=""
        aria-label="Custom equation symbol"
        style={{
          width: 48,
          height: 48,
          border: "none",
          outline: "none",
          background: "transparent",
          color: "#FFFFFF",
          textAlign: "center",
          fontFamily: "Grandstander, Space Grotesk, sans-serif",
          fontSize: 32,
          fontWeight: 700,
          lineHeight: 1,
          textShadow: "0 0 10px rgba(255, 255, 255, 0.25)",
        }}
      />
    </div>
  );
}

function EquationBlocksPanel({
  savedEquations,
  onCreateEquation,
  onAddEquationEvent,
}: {
  savedEquations: SavedEquation[];
  onCreateEquation: () => void;
  onAddEquationEvent: (equation: SavedEquation) => void;
}) {
  return (
    <section
      style={{
        width: "12.5vw",
        height: "calc(100vh - 166px)",
        minHeight: "calc(100vh - 166px)",
        background: "#2B2B2B",
        color: textColor,
        borderRight: `1px solid ${subtleBorderColor}`,
        boxSizing: "border-box",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          padding: "18px 12px",
          borderBottom: `1px solid ${subtleBorderColor}`,
          color: textColor,
          fontFamily: "Space Grotesk, sans-serif",
          fontSize: 13,
          fontWeight: 700,
          lineHeight: "19.5px",
          letterSpacing: 0,
          textAlign: "center",
        }}
      >
        Equation Blocks
      </div>

      <div
        style={{
          padding: 12,
          borderBottom: `1px solid ${subtleBorderColor}`,
        }}
      >
        <button
          type="button"
          onClick={onCreateEquation}
          style={{
            width: "100%",
            minHeight: 38,
            background: "#CFFF04",
            color: "#000000",
            border: "1px solid #CFFF04",
            borderRadius: 10,
            fontFamily: "Space Grotesk, sans-serif",
            fontSize: 12,
            fontWeight: 700,
            lineHeight: "18px",
            cursor: "pointer",
          }}
        >
          Create Equation
        </button>
      </div>

      <div
        style={{
          padding: 12,
          display: "flex",
          flexDirection: "column",
          gap: 10,
          overflowY: "auto",
        }}
      >
        {savedEquations.map((equation) => {
          const equationState = tokensToEquationState(equation.tokens);

          return (
            <div
              key={equation.id}
              draggable
              onDragStart={(event) => {
                event.dataTransfer.setData(
                  "application/x-saved-equation",
                  JSON.stringify(equation),
                );
                event.dataTransfer.effectAllowed = "copy";
              }}
              style={{
                width: "100%",
                minHeight: 70,
                background: "#191919",
                border: `1px solid ${subtleBorderColor}`,
                borderRadius: 10,
                padding: "7px 8px",
                boxSizing: "border-box",
                color: textColor,
                display: "flex",
                flexDirection: "column",
                alignItems: "stretch",
                justifyContent: "center",
                gap: 8,
                overflow: "hidden",
                cursor: "grab",
              }}
              title={equationState}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 4,
                  overflow: "hidden",
                }}
              >
                {equation.tokens.slice(0, 6).map((token) => (
                  <span
                    key={token.id}
                    style={{
                      minWidth: 22,
                      height: 22,
                      borderRadius: "999px",
                      background: "#191919",
                      border: "1.5px solid rgba(255, 255, 255, 0.72)",
                      color: "#FFFFFF",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontFamily: "Grandstander, Space Grotesk, sans-serif",
                      fontSize: 13,
                      fontWeight: 700,
                      flexShrink: 0,
                      textShadow: "0 0 8px rgba(255, 255, 255, 0.25)",
                    }}
                  >
                    {token.label}
                  </span>
                ))}

                {equation.tokens.length > 6 ? (
                  <span
                    style={{
                      color: "#FFFFFF99",
                      fontFamily: "Space Grotesk, sans-serif",
                      fontSize: 10,
                      fontWeight: 700,
                      flexShrink: 0,
                    }}
                  >
                    +{equation.tokens.length - 6}
                  </span>
                ) : null}
              </div>

              <button
                type="button"
                onClick={() => onAddEquationEvent(equation)}
                style={{
                  width: "100%",
                  minHeight: 28,
                  background: "#2B2B2B",
                  color: textColor,
                  border: `1px solid ${subtleBorderColor}`,
                  borderRadius: 8,
                  fontFamily: "Space Grotesk, sans-serif",
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Add at tick
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function EquationBuilderArea({
  isCreatingEquation,
  draftTokens,
  customTokenLabel,
  onCustomTokenLabelChange,
  onInsertToken,
  onRemoveToken,
  onSaveEquation,
}: {
  isCreatingEquation: boolean;
  draftTokens: EquationToken[];
  customTokenLabel: string;
  onCustomTokenLabelChange: (value: string) => void;
  onInsertToken: (index: number, label: string) => void;
  onRemoveToken: (id: string) => void;
  onSaveEquation: () => void;
}) {
  if (!isCreatingEquation) {
    return (
      <div
        style={{
          flex: 1,
          minHeight: 260,
          background: "#191919",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#FFFFFF80",
          fontFamily: "Space Grotesk, sans-serif",
          fontSize: 13,
          fontWeight: 700,
        }}
      >
        Create an equation block, then add it to the current tick.
      </div>
    );
  }

  return (
    <div
      style={{
        flex: 1,
        minHeight: 260,
        background: "#191919",
        boxSizing: "border-box",
        display: "grid",
        gridTemplateRows: "auto 1fr auto",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          minHeight: 100,
          borderBottom: `1px solid ${subtleBorderColor}`,
          display: "flex",
          alignItems: "center",
          gap: 14,
          padding: "0 18px",
          boxSizing: "border-box",
          overflowX: "auto",
          fontFamily: "Space Grotesk, sans-serif",
        }}
      >
        {equationPalette.map((label) => (
          <EquationCircle key={label} label={label} size={68} />
        ))}

        <CustomEquationCircle
          value={customTokenLabel}
          onChange={onCustomTokenLabelChange}
        />
      </div>

      <div
        style={{
          margin: 18,
          border: `1px dashed ${subtleBorderColor}`,
          borderRadius: 18,
          background: "#191919",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxSizing: "border-box",
          overflow: "hidden",
          fontFamily: "Space Grotesk, sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 12,
            flexWrap: "wrap",
            padding: 24,
          }}
        >
          {draftTokens.length === 0 ? (
            <EquationDropSlot index={0} onInsertToken={onInsertToken} />
          ) : (
            <>
              <EquationDropSlot index={0} onInsertToken={onInsertToken} />

              {draftTokens.map((token, index) => (
                <span
                  key={token.id}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 12,
                  }}
                >
                  <button
                    type="button"
                    onClick={() => onRemoveToken(token.id)}
                    title="Click to remove"
                    style={{
                      border: "none",
                      background: "transparent",
                      padding: 0,
                      cursor: "pointer",
                    }}
                  >
                    <EquationCircle label={token.label} draggable={false} size={68} />
                  </button>

                  <EquationDropSlot
                    index={index + 1}
                    onInsertToken={onInsertToken}
                  />
                </span>
              ))}
            </>
          )}
        </div>
      </div>

      <div
        style={{
          minHeight: 70,
          borderTop: `1px solid ${subtleBorderColor}`,
          padding: "14px 18px",
          boxSizing: "border-box",
          display: "flex",
          justifyContent: "flex-end",
          alignItems: "center",
          fontFamily: "Space Grotesk, sans-serif",
        }}
      >
        <button
          type="button"
          disabled={draftTokens.length === 0}
          onClick={onSaveEquation}
          style={{
            minWidth: 150,
            minHeight: 40,
            background: draftTokens.length > 0 ? "#CFFF04" : "#2B2B2B",
            color: draftTokens.length > 0 ? "#000000" : "#FFFFFF80",
            border: `1px solid ${
              draftTokens.length > 0 ? "#CFFF04" : subtleBorderColor
            }`,
            borderRadius: 10,
            fontFamily: "Space Grotesk, sans-serif",
            fontSize: 13,
            fontWeight: 700,
            cursor: draftTokens.length > 0 ? "pointer" : "not-allowed",
          }}
        >
          Save Equation
        </button>
      </div>
    </div>
  );
}

function CenterEditorPanel({
  chartFile,
  isCreatingEquation,
  draftTokens,
  customTokenLabel,
  onCustomTokenLabelChange,
  onInsertToken,
  onRemoveToken,
  onSaveEquation,
  onChartFileChange,
  onDropEquationAtCurrentTick,
}: {
  chartFile: string;
  isCreatingEquation: boolean;
  draftTokens: EquationToken[];
  customTokenLabel: string;
  onCustomTokenLabelChange: (value: string) => void;
  onInsertToken: (index: number, label: string) => void;
  onRemoveToken: (id: string) => void;
  onSaveEquation: () => void;
  onChartFileChange: (chartFile: string) => void;
  onDropEquationAtCurrentTick: (equation: SavedEquation) => void;
}) {
  function handleEquationDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();

    const rawEquation = event.dataTransfer.getData("application/x-saved-equation");

    if (!rawEquation) {
      return;
    }

    try {
      const equation = JSON.parse(rawEquation) as SavedEquation;

      if (equation?.id && Array.isArray(equation.tokens)) {
        onDropEquationAtCurrentTick(equation);
      }
    } catch (error) {
      console.error("Failed to drop saved equation", error);
    }
  }

  return (
    <section
      style={{
        width: "60vw",
        height: "calc(100vh - 166px)",
        minHeight: "calc(100vh - 166px)",
        background: "#191919",
        color: textColor,
        boxSizing: "border-box",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <EquationBuilderArea
        isCreatingEquation={isCreatingEquation}
        draftTokens={draftTokens}
        customTokenLabel={customTokenLabel}
        onCustomTokenLabelChange={onCustomTokenLabelChange}
        onInsertToken={onInsertToken}
        onRemoveToken={onRemoveToken}
        onSaveEquation={onSaveEquation}
      />

      <div
        onDragOver={(event) => {
          event.preventDefault();
          event.dataTransfer.dropEffect = "copy";
        }}
        onDrop={handleEquationDrop}
        style={{
          width: "100%",
          height: "34vh",
          minHeight: "34vh",
          display: "flex",
          flexDirection: "column",
          flexShrink: 0,
          borderTop: `1px solid ${subtleBorderColor}`,
        }}
      >
        <div
          style={{
            minHeight: 42,
            background: "#2B2B2B",
            borderBottom: `1px solid ${subtleBorderColor}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 18px",
            boxSizing: "border-box",
            color: textColor,
            fontFamily: "Space Grotesk, sans-serif",
            fontSize: 13,
            fontWeight: 700,
          }}
        >
          <span>.chart File</span>
          <span style={{ color: "#FFFFFF80", fontSize: 11 }}>
            Drop a saved equation here to create an equation event at the current tick.
          </span>
        </div>

        <textarea
          value={chartFile}
          onChange={(event) => onChartFileChange(event.target.value)}
          spellCheck={false}
          placeholder="Paste or upload a .chart file here."
          style={{
            flex: 1,
            width: "100%",
            resize: "none",
            border: "none",
            outline: "none",
            background: "#111111",
            color: textColor,
            padding: 16,
            boxSizing: "border-box",
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
            fontSize: 12,
            lineHeight: 1.5,
          }}
        />
      </div>
    </section>
  );
}

function SidecarPanel({
  sidecar,
  sidecarText,
  sidecarError,
  onSidecarTextChange,
  onRemoveEvent,
}: {
  sidecar: SidecarPayload;
  sidecarText: string;
  sidecarError: string;
  onSidecarTextChange: (value: string) => void;
  onRemoveEvent: (index: number) => void;
}) {
  return (
    <section
      style={{
        width: "27.5vw",
        height: "calc(100vh - 166px)",
        minHeight: "calc(100vh - 166px)",
        background: "#2B2B2B",
        color: textColor,
        borderLeft: `1px solid ${subtleBorderColor}`,
        boxSizing: "border-box",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          padding: "18px 16px",
          borderBottom: `1px solid ${subtleBorderColor}`,
          color: textColor,
          fontFamily: "Space Grotesk, sans-serif",
          fontSize: 13,
          fontWeight: 700,
          lineHeight: "19.5px",
          letterSpacing: 0,
          textAlign: "left",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <span>Sidecar JSON</span>
        <span style={{ color: sidecarError ? "#FF8C8C" : "#CFFF04", fontSize: 11 }}>
          {sidecarError ? "Invalid" : `${sidecar.events.length} event${sidecar.events.length === 1 ? "" : "s"}`}
        </span>
      </div>

      <div style={{ padding: 12, borderBottom: `1px solid ${subtleBorderColor}` }}>
        <div
          style={{
            color: "#FFFFFFA8",
            fontFamily: "Space Grotesk, sans-serif",
            fontSize: 11,
            lineHeight: 1.45,
          }}
        >
          Expected format: <strong>version: 1</strong> plus an <strong>events</strong> array.
          Mechanics use <strong>ALG_MECHANIC</strong>; equations use <strong>ALG_EQUATION_STATE</strong>.
        </div>
      </div>

      <textarea
        value={sidecarText}
        onChange={(event) => onSidecarTextChange(event.target.value)}
        spellCheck={false}
        style={{
          width: "100%",
          minHeight: "46%",
          resize: "none",
          border: "none",
          outline: "none",
          background: "#111111",
          color: textColor,
          padding: 14,
          boxSizing: "border-box",
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
          fontSize: 12,
          lineHeight: 1.45,
        }}
      />

      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: 12,
          display: "flex",
          flexDirection: "column",
          gap: 8,
          borderTop: `1px solid ${subtleBorderColor}`,
        }}
      >
        {sidecar.events.length === 0 ? (
          <div
            style={{
              color: "#FFFFFF70",
              fontFamily: "Space Grotesk, sans-serif",
              fontSize: 12,
              textAlign: "center",
              padding: "24px 8px",
            }}
          >
            Add spin, drag, hit, or equation events to populate this file.
          </div>
        ) : (
          sidecar.events.map((event, index) => (
            <div
              key={`${event.tick}-${event.type}-${index}`}
              style={{
                background: "#191919",
                border: `1px solid ${subtleBorderColor}`,
                borderRadius: 10,
                padding: 10,
                fontFamily: "Space Grotesk, sans-serif",
                fontSize: 12,
                lineHeight: 1.45,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                <strong>{event.type}</strong>
                <button
                  type="button"
                  onClick={() => onRemoveEvent(index)}
                  style={{
                    background: "transparent",
                    color: "#FF8C8C",
                    border: "none",
                    cursor: "pointer",
                    fontWeight: 800,
                  }}
                >
                  Remove
                </button>
              </div>
              <div>Tick: {event.tick}</div>
              {event.type === "ALG_MECHANIC" ? (
                <div>
                  Mechanic: {event.mechanic}
                  {event.hits ? `, hits: ${event.hits}` : ""}
                </div>
              ) : (
                <div>
                  Equation: {event.equationId}
                  <br />
                  State: {event.state}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </section>
  );
}

export default function LessonBuilderClient({
  navBasePath = "/student",
}: LessonBuilderClientProps) {
  const pathname = usePathname();
  const topTabs = useMemo(() => getTopTabs(navBasePath), [navBasePath]);
  const setProject = useEditorStore((s) => s.setProject);

  const [chartFile, setChartFile] = useState("");
  const [metadata, setMetadata] = useState<LessonBuilderPayload["analysisMetadata"]>();
  const [uploadedSongName, setUploadedSongName] = useState("");
  const [uploadedChartName, setUploadedChartName] = useState("");
  const [pendingSongFile, setPendingSongFile] = useState<File | null>(null);

  const [currentTick, setCurrentTick] = useState(0);
  const [hits, setHits] = useState(1);
  const [sidecar, setSidecar] = useState<SidecarPayload>(emptySidecar);
  const [sidecarText, setSidecarText] = useState(sidecarToJson(emptySidecar));
  const [sidecarError, setSidecarError] = useState("");

  const [isCreatingEquation, setIsCreatingEquation] = useState(false);
  const [draftTokens, setDraftTokens] = useState<EquationToken[]>([]);
  const [savedEquations, setSavedEquations] = useState<SavedEquation[]>([]);
  const [customTokenLabel, setCustomTokenLabel] = useState("");

  const editorPayload = useMemo<LessonBuilderPayload>(
    () => ({
      chartFile,
      analysisMetadata: metadata,
      rawResults: sidecar,
    }),
    [chartFile, metadata, sidecar],
  );

  function replaceSidecar(nextSidecar: SidecarPayload) {
    const normalized = normalizeSidecar(nextSidecar);

    setSidecar(normalized);
    setSidecarText(sidecarToJson(normalized));
    setSidecarError("");
  }

  function patchSidecarEvents(updater: (events: SidecarEvent[]) => SidecarEvent[]) {
    setSidecar((current) => {
      const nextSidecar = normalizeSidecar({
        version: 1,
        events: updater(current.events),
      });

      setSidecarText(sidecarToJson(nextSidecar));
      setSidecarError("");
      return nextSidecar;
    });
  }

  function addSidecarEvent(event: SidecarEvent) {
    patchSidecarEvents((events) => [...events, event]);
  }

  function addEquationEvent(equation: SavedEquation) {
    addSidecarEvent({
      tick: currentTick,
      type: "ALG_EQUATION_STATE",
      equationId: equation.id,
      state: tokensToEquationState(equation.tokens),
    });
  }

  function handleAddMechanic(mechanic: GameplayMechanic) {
    addSidecarEvent({
      tick: currentTick,
      type: "ALG_MECHANIC",
      mechanic,
      hits,
    });
  }

  function handleSidecarTextChange(value: string) {
    setSidecarText(value);

    try {
      const parsed = JSON.parse(value) as unknown;
      const normalized = normalizeSidecar(parsed);

      setSidecar(normalized);
      setSidecarError("");
    } catch (error) {
      setSidecarError(error instanceof Error ? error.message : "Invalid JSON");
    }
  }

  function handleInsertEquationToken(index: number, label: string) {
    setDraftTokens((current) => {
      const nextToken = {
        id: makeId("token"),
        label,
      };

      const safeIndex = Math.max(0, Math.min(index, current.length));

      return [
        ...current.slice(0, safeIndex),
        nextToken,
        ...current.slice(safeIndex),
      ];
    });
  }

  function handleRemoveEquationToken(id: string) {
    setDraftTokens((current) => current.filter((token) => token.id !== id));
  }

  function handleSaveEquation() {
    if (draftTokens.length === 0) {
      return;
    }

    setSavedEquations((current) => [
      ...current,
      {
        id: makeId("equation"),
        tokens: draftTokens,
      },
    ]);

    setDraftTokens([]);
    setCustomTokenLabel("");
    setIsCreatingEquation(false);
  }

  async function handleChartUpload(file: File) {
    try {
      const text = await readFileAsText(file);

      setChartFile(text);
      setUploadedChartName(file.name);
      setMetadata((current) => ({
        ...current,
        uploadedFileName: file.name,
      }));
    } catch (error) {
      console.error("Failed to load uploaded chart file", error);
    }
  }

  async function handleSidecarUpload(file: File) {
    try {
      const text = await readFileAsText(file);
      const parsed = JSON.parse(text) as unknown;

      replaceSidecar(normalizeSidecar(parsed));
    } catch (error) {
      setSidecarText(await readFileAsText(file).catch(() => ""));
      setSidecarError(error instanceof Error ? error.message : "Invalid JSON");
    }
  }

  function handleDownloadChart() {
    if (!uploadedChartName.trim()) {
      return;
    }

    downloadTextFile(uploadedChartName, chartFile, "text/plain;charset=utf-8");
  }

  function handleDownloadSidecar() {
    const normalized = normalizeSidecar(sidecar);

    downloadTextFile(
      getSidecarFileName(uploadedChartName),
      sidecarToJson(normalized),
      "application/json;charset=utf-8",
    );
  }

  useEffect(() => {
    const raw = sessionStorage.getItem("ultrarapid_selected_song");

    if (!raw) {
      return;
    }

    try {
      const selectedSong: SelectedSongPayload = JSON.parse(raw);

      setUploadedSongName(selectedSong.name);
      setMetadata((current) => ({
        ...current,
        songTitle: selectedSong.title ?? selectedSong.name,
        artist: selectedSong.artist ?? current?.artist,
        uploadedFileName: selectedSong.song.path,
      }));

      fileFromSignedUrl({
        signedUrl: selectedSong.song.signedUrl,
        path: selectedSong.song.path,
        name: selectedSong.name,
        contentType: selectedSong.song.contentType,
      })
        .then((file) => {
          setPendingSongFile(file);
        })
        .catch((error) => {
          console.error("Failed to load selected song file", error);
        });

      Promise.all([
        textFromSignedUrl(selectedSong.chart.signedUrl),
        selectedSong.sidecar
          ? jsonFromSignedUrl(selectedSong.sidecar.signedUrl)
          : Promise.resolve(null),
      ])
        .then(([nextChartFile, sidecarJson]) => {
          const nextChartName =
            selectedSong.chart.path.split("/").pop() ?? "selected.chart";
          const nextSidecar = normalizeSidecar(sidecarJson ?? emptySidecar);

          setChartFile(nextChartFile);
          setUploadedChartName(nextChartName);
          replaceSidecar(nextSidecar);
        })
        .catch((error) => {
          console.error("Failed to load selected chart or sidecar JSON", error);
        });
    } catch (error) {
      console.error("Failed to parse selected song package", error);
    }
  }, []);

  useEffect(() => {
    const raw = sessionStorage.getItem("ultrarapid_editor_payload");
    if (!raw) return;

    try {
      const payload: LessonBuilderPayload = JSON.parse(raw);

      if (payload?.analysisMetadata) {
        setMetadata(payload.analysisMetadata);
      }

      if (payload?.chartFile) {
        setChartFile(payload.chartFile);

        if (payload.analysisMetadata?.uploadedFileName) {
          setUploadedChartName(payload.analysisMetadata.uploadedFileName);
        }
      }

      replaceSidecar(normalizeSidecar(payload.rawResults ?? emptySidecar));
      sessionStorage.removeItem("ultrarapid_editor_payload");
    } catch (error) {
      console.error("Failed to hydrate lesson builder payload", error);
    }
  }, []);

  useEffect(() => {
    if (!pendingSongFile) return;

    console.info("Selected song file loaded for editor:", pendingSongFile.name);
  }, [pendingSongFile]);

  useEffect(() => {
    if (!chartFile.trim()) return;

    setProject(chartToProject(editorPayload));
  }, [chartFile, editorPayload, setProject]);

  useEffect(() => {
    if (!chartFile.trim()) return;

    console.info("Chart file loaded for editor:", {
      chartName: uploadedChartName,
      songName: uploadedSongName,
      metadata,
      sidecar,
    });
  }, [chartFile, uploadedChartName, uploadedSongName, metadata, sidecar]);

  return (
    <div
      className={styles.studentTypography}
      style={{
        minHeight: "100vh",
        background: pageBackgroundColor,
        color: textColor,
        display: "flex",
        flexDirection: "column",
        overflowX: "hidden",
      }}
    >
      <HeaderBar pathname={pathname} topTabs={topTabs} />

      <EditorTopPanel
        currentTick={currentTick}
        hits={hits}
        sidecarError={sidecarError}
        chartName={uploadedChartName}
        onCurrentTickChange={setCurrentTick}
        onHitsChange={setHits}
        onAddMechanic={handleAddMechanic}
        onChartUpload={handleChartUpload}
        onSidecarUpload={handleSidecarUpload}
        onDownloadChart={handleDownloadChart}
        onDownloadSidecar={handleDownloadSidecar}
      />

      <main
        style={{
          width: "100%",
          height: "calc(100vh - 166px)",
          display: "flex",
          alignItems: "stretch",
          background: pageBackgroundColor,
          color: textColor,
          overflow: "hidden",
        }}
      >
        <EquationBlocksPanel
          savedEquations={savedEquations}
          onCreateEquation={() => {
            setDraftTokens([]);
            setCustomTokenLabel("");
            setIsCreatingEquation(true);
          }}
          onAddEquationEvent={addEquationEvent}
        />

        <CenterEditorPanel
          chartFile={chartFile}
          isCreatingEquation={isCreatingEquation}
          draftTokens={draftTokens}
          customTokenLabel={customTokenLabel}
          onCustomTokenLabelChange={setCustomTokenLabel}
          onInsertToken={handleInsertEquationToken}
          onRemoveToken={handleRemoveEquationToken}
          onSaveEquation={handleSaveEquation}
          onChartFileChange={setChartFile}
          onDropEquationAtCurrentTick={addEquationEvent}
        />

        <SidecarPanel
          sidecar={sidecar}
          sidecarText={sidecarText}
          sidecarError={sidecarError}
          onSidecarTextChange={handleSidecarTextChange}
          onRemoveEvent={(index) => {
            patchSidecarEvents((events) => events.filter((_, eventIndex) => eventIndex !== index));
          }}
        />
      </main>
    </div>
  );
}
