"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ChangeEvent, DragEvent, FC, SVGProps } from "react";
import { useEffect, useMemo, useState } from "react";
import { useEditorStore } from "@/lib/editor/editor-store";
import { chartToProject } from "@/lib/editor/chart-to-project";
import { projectToChart, projectToSidecarJson } from "@/lib/editor/project-to-chart";
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
  /**
   * Supabase SongAsset equation slot count.
   * Accept both camelCase from app code and snake_case directly from Supabase rows.
   */
  equationSlots?: number | null;
  equation_slots?: number | null;
  songAsset?: {
    equationSlots?: number | null;
    equation_slots?: number | null;
  } | null;
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

type EquationTimelineSlot = {
  id: string;
  equationId: string;
  tick: number;
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
  "x",
  "+",
  "-",
  "×",
  "÷",
  "=",
];

const utilityTabs: UtilityTab[] = [
  { label: "Profile", href: "/student/profile", Icon: ProfileIcon, width: 134.45 },
];

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

      if (!equationId.trim()) {
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

function tokensToEquationState(tokens: EquationToken[]) {
  return tokens.map((token) => token.label).join(" ");
}

function equationStateToTokens(state: string): EquationToken[] {
  return state
    .split(/\s+/)
    .map((label) => label.trim())
    .filter(Boolean)
    .map((label) => ({
      id: makeId("token"),
      label,
    }));
}

function slotsFromSidecar(sidecar: SidecarPayload): EquationTimelineSlot[] {
  return sidecar.events
    .filter((event): event is SidecarEquationStateEvent => event.type === "ALG_EQUATION_STATE")
    .sort((left, right) => left.tick - right.tick)
    .map((event, index) => ({
      id: makeId(`slot-${index + 1}`),
      equationId: event.equationId,
      tick: event.tick,
      tokens: equationStateToTokens(event.state),
    }));
}

function normalizeEquationSlotCount(value: unknown): number | null {
  const count = Number(value);

  if (!Number.isFinite(count) || count < 0) {
    return null;
  }

  return Math.round(count);
}

function getSelectedSongEquationSlotCount(selectedSong: SelectedSongPayload): number | null {
  return (
    normalizeEquationSlotCount(selectedSong.equationSlots) ??
    normalizeEquationSlotCount(selectedSong.equation_slots) ??
    normalizeEquationSlotCount(selectedSong.songAsset?.equationSlots) ??
    normalizeEquationSlotCount(selectedSong.songAsset?.equation_slots)
  );
}

function resizeEquationSlots(
  slots: EquationTimelineSlot[],
  targetCount: number,
  defaultTick: number,
): EquationTimelineSlot[] {
  const safeCount = Math.max(0, Math.round(targetCount));
  const nextSlots = slots.slice(0, safeCount);

  for (let index = nextSlots.length; index < safeCount; index += 1) {
    nextSlots.push({
      id: makeId("slot"),
      equationId: `eq_${String(index + 1).padStart(3, "0")}`,
      tick: defaultTick,
      tokens: [],
    });
  }

  return nextSlots.map((slot, index) => ({
    ...slot,
    equationId: slot.equationId.trim() || `eq_${String(index + 1).padStart(3, "0")}`,
  }));
}

function sidecarFromSlots(
  slots: EquationTimelineSlot[],
  mechanicEvents: SidecarMechanicEvent[],
): SidecarPayload {
  return normalizeSidecar({
    version: 1,
    events: [
      ...mechanicEvents,
      ...slots.map((slot): SidecarEquationStateEvent => ({
        tick: slot.tick,
        type: "ALG_EQUATION_STATE",
        equationId: slot.equationId,
        state: tokensToEquationState(slot.tokens),
      })),
    ],
  });
}

function getChartFileName(chartName?: string) {
  return chartName?.trim() || "ultrarapid-chart.chart";
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
        borderBottom: `1px solid ${subtleBorderColor}`,
        display: "flex",
        alignItems: "center",
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
          overflow: "visible",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 28,
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
              minWidth: 0,
              overflow: "visible",
            }}
          >
            {topTabs.map((tab) => {
              const cleanTabHref = tab.href.split("?")[0];
              const isHomeTab = tab.label === "Home";
              const isPlayTab = tab.label === "Play";
              const isLessonBuilderTab = tab.label === "Lesson Builder";
              const lessonBuilderPath = cleanTabHref.replace("/song-choice", "/lesson-builder");

              const isActive =
                pathname === cleanTabHref ||
                (isLessonBuilderTab &&
                  (pathname === lessonBuilderPath || pathname.startsWith(`${lessonBuilderPath}/`))) ||
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
                  className={`${styles.headerTabButton} ${isActive ? styles.headerTabButtonActive : ""}`}
                  style={{
                    width: tab.width,
                    height: 45.5,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Icon style={{ width: tab.width, height: 45.5, display: "block" }} />
                </Link>
              );
            })}
          </nav>
        </div>

        <div
          style={{
            display: "flex",
            gap: 6,
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
              style={{ width: tab.width, height: 38 }}
            >
              <tab.Icon style={{ width: tab.width, height: 38, display: "block" }} />
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
  chartName,
  currentTick,
  hits,
  requiredEquationSlots,
  actualEquationSlots,
  loadError,
  onChartUpload,
  onSidecarUpload,
  onCurrentTickChange,
  onHitsChange,
  onAddMechanic,

  onDownloadChart,
  onDownloadSidecar,
}: {
  chartName: string;
  currentTick: number;
  hits: number;
  requiredEquationSlots: number | null;
  actualEquationSlots: number;
  loadError: string;
  onChartUpload: (file: File) => void;
  onSidecarUpload: (file: File) => void;
  onCurrentTickChange: (tick: number) => void;
  onHitsChange: (hits: number) => void;
  onAddMechanic: (mechanic: GameplayMechanic) => void;
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
        fontFamily: "Space Grotesk, sans-serif",
      }}
    >
      <div
        style={{
          width: pagePanelWidth,
          minHeight: 96,
          margin: "0 auto",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 20,
          flexWrap: "wrap",
          padding: "14px 0",
          boxSizing: "border-box",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
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

          <div style={{ fontSize: 12, color: "#FFFFFF99", fontWeight: 700 }}>
            {chartName ? `Loaded: ${chartName}` : "No chart loaded"}
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <label style={{ fontSize: 12, fontWeight: 700 }}>
            Selected tick
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

          <div style={{ fontSize: 12, fontWeight: 700 }}>
            Equation slots
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                minHeight: 34,
                marginLeft: 8,
                background: "#191919",
                color: textColor,
                border: `1px solid ${subtleBorderColor}`,
                borderRadius: 8,
                padding: "0 12px",
                fontWeight: 800,
              }}
              title="This comes from the SongAsset.equation_slots value in Supabase."
            >
              {requiredEquationSlots ?? actualEquationSlots}
            </span>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
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
                padding: "0 12px",
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
              border: `1px solid ${subtleBorderColor}`,
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

          {loadError ? (
            <span style={{ color: "#FF8C8C", fontSize: 11, fontWeight: 700, maxWidth: 220 }}>
              {loadError}
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

        event.dataTransfer.setData("application/x-equation-token", JSON.stringify({ label }));
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

function EquationPreview({
  tokens,
  circleSize = 34,
}: {
  tokens: EquationToken[];
  circleSize?: number;
}) {
  if (tokens.length === 0) {
    return <span style={{ color: "#FFFFFF66", fontSize: 12, fontWeight: 700 }}>Empty equation</span>;
  }

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: Math.max(4, circleSize / 7),
        flexWrap: "wrap",
      }}
    >
      {tokens.map((token) => (
        <EquationCircle key={token.id} label={token.label} draggable={false} size={circleSize} />
      ))}
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

        event.dataTransfer.setData("application/x-equation-token", JSON.stringify({ label }));
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

function EquationBuilderArea({
  activeSlot,
  customTokenLabel,
  onCustomTokenLabelChange,
  onInsertToken,
  onRemoveToken,
  onClearSlot,
}: {
  activeSlot: EquationTimelineSlot | null;
  customTokenLabel: string;
  onCustomTokenLabelChange: (value: string) => void;
  onInsertToken: (index: number, label: string) => void;
  onRemoveToken: (id: string) => void;
  onClearSlot: () => void;
}) {
  return (
    <div
      style={{
        flex: 1,
        minHeight: 0,
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
          <EquationCircle key={label} label={label} size={68} draggable={Boolean(activeSlot)} />
        ))}

        <CustomEquationCircle value={customTokenLabel} onChange={onCustomTokenLabelChange} />
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
          overflow: "auto",
          fontFamily: "Space Grotesk, sans-serif",
        }}
      >
        {!activeSlot ? (
          <div style={{ color: "#FFFFFF80", fontWeight: 700 }}>
            Create or select an equation slot to start editing.
          </div>
        ) : (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 12,
              flexWrap: "wrap",
              padding: 24,
              minHeight: 120,
            }}
          >
            {activeSlot.tokens.length === 0 ? (
              <EquationDropSlot index={0} onInsertToken={onInsertToken} />
            ) : (
              <>
                <EquationDropSlot index={0} onInsertToken={onInsertToken} />

                {activeSlot.tokens.map((token, index) => (
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

                    <EquationDropSlot index={index + 1} onInsertToken={onInsertToken} />
                  </span>
                ))}
              </>
            )}
          </div>
        )}
      </div>

      <div
        style={{
          minHeight: 70,
          borderTop: `1px solid ${subtleBorderColor}`,
          padding: "14px 18px",
          boxSizing: "border-box",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 16,
          fontFamily: "Space Grotesk, sans-serif",
        }}
      >
        <div style={{ color: "#FFFFFF99", fontSize: 12, fontWeight: 700 }}>
          {activeSlot
            ? `Editing ${activeSlot.equationId} at tick ${activeSlot.tick}`
            : "No active equation slot"}
        </div>

        <button
          type="button"
          disabled={!activeSlot || activeSlot.tokens.length === 0}
          onClick={onClearSlot}
          style={{
            minWidth: 130,
            minHeight: 40,
            background: "#2B2B2B",
            color: activeSlot && activeSlot.tokens.length > 0 ? textColor : "#FFFFFF80",
            border: `1px solid ${subtleBorderColor}`,
            borderRadius: 10,
            fontFamily: "Space Grotesk, sans-serif",
            fontSize: 13,
            fontWeight: 700,
            cursor: activeSlot && activeSlot.tokens.length > 0 ? "pointer" : "not-allowed",
          }}
        >
          Clear slot
        </button>
      </div>
    </div>
  );
}

function EquationTimeline({
  slots,
  activeSlotId,
  onSelectSlot,
}: {
  slots: EquationTimelineSlot[];
  activeSlotId: string | null;
  onSelectSlot: (slotId: string) => void;
}) {
  return (
    <section
      aria-label="Equation timeline"
      style={{
        width: "100%",
        height: "28vh",
        minHeight: 210,
        background: "#2B2B2B",
        borderTop: `1px solid ${subtleBorderColor}`,
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        fontFamily: "Space Grotesk, sans-serif",
      }}
    >
      <div
        style={{
          minHeight: 44,
          borderBottom: `1px solid ${subtleBorderColor}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 18px",
          boxSizing: "border-box",
        }}
      >
        <div style={{ color: textColor, fontSize: 13, fontWeight: 800 }}>
          Equation Timeline
        </div>

        <div style={{ color: "#FFFFFF80", fontSize: 12, fontWeight: 700 }}>
          Slots are set on the SongAsset in Supabase
        </div>
      </div>

      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: "flex",
          gap: 14,
          padding: 16,
          boxSizing: "border-box",
          overflowX: "auto",
        }}
      >
        {slots.length === 0 ? (
          <div
            style={{
              color: "#FFFFFF80",
              fontSize: 13,
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
            }}
          >
            No equation slots yet. Set SongAsset.equation_slots in Supabase or load a sidecar JSON.
          </div>
        ) : (
          slots.map((slot, index) => {
            const isActive = slot.id === activeSlotId;

            return (
              <button
                key={slot.id}
                type="button"
                onClick={() => onSelectSlot(slot.id)}
                style={{
                  width: 240,
                  minWidth: 240,
                  height: "100%",
                  background: isActive ? "#191919" : "#252525",
                  color: textColor,
                  border: `2px solid ${isActive ? "#CFFF04" : subtleBorderColor}`,
                  borderRadius: 16,
                  padding: 12,
                  boxSizing: "border-box",
                  cursor: "pointer",
                  display: "grid",
                  gridTemplateRows: "auto 1fr auto",
                  gap: 8,
                  textAlign: "left",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 8,
                    fontSize: 12,
                    fontWeight: 800,
                  }}
                >
                  <span>Equation {index + 1}</span>
                  <span style={{ color: "#FFFFFF99" }}>Tick {slot.tick}</span>
                </div>

                <div
                  style={{
                    border: `1px dashed ${subtleBorderColor}`,
                    borderRadius: 12,
                    padding: 10,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    overflow: "hidden",
                  }}
                >
                  <EquationPreview tokens={slot.tokens} circleSize={30} />
                </div>

                <div
                  style={{
                    color: "#FFFFFF80",
                    fontSize: 11,
                    fontWeight: 700,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {slot.equationId}
                </div>
              </button>
            );
          })
        )}
      </div>
    </section>
  );
}

function CenterEditorPanel({
  slots,
  activeSlotId,
  customTokenLabel,
  onCustomTokenLabelChange,
  onSelectSlot,
  onInsertToken,
  onRemoveToken,
  onClearSlot,
}: {
  slots: EquationTimelineSlot[];
  activeSlotId: string | null;
  customTokenLabel: string;
  onCustomTokenLabelChange: (value: string) => void;
  onSelectSlot: (slotId: string) => void;
  onInsertToken: (index: number, label: string) => void;
  onRemoveToken: (id: string) => void;
  onClearSlot: () => void;
}) {
  const activeSlot = slots.find((slot) => slot.id === activeSlotId) ?? null;

  return (
    <section
      style={{
        width: "75vw",
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
        activeSlot={activeSlot}
        customTokenLabel={customTokenLabel}
        onCustomTokenLabelChange={onCustomTokenLabelChange}
        onInsertToken={onInsertToken}
        onRemoveToken={onRemoveToken}
        onClearSlot={onClearSlot}
      />

      <EquationTimeline
        slots={slots}
        activeSlotId={activeSlotId}
        onSelectSlot={onSelectSlot}
      />
    </section>
  );
}

function WorkspacePanel({
  title,
  width,
  background,
  children,
}: {
  title?: string;
  width: string;
  background: string;
  children?: React.ReactNode;
}) {
  return (
    <section
      style={{
        width,
        height: "calc(100vh - 166px)",
        minHeight: "calc(100vh - 166px)",
        background,
        color: textColor,
        borderRight: `1px solid ${subtleBorderColor}`,
        boxSizing: "border-box",
        overflow: "hidden",
      }}
    >
      {title ? (
        <div
          style={{
            padding: "18px 16px",
            borderBottom: `1px solid ${subtleBorderColor}`,
            color: textColor,
            fontFamily: "Space Grotesk, sans-serif",
            fontSize: 13,
            fontWeight: 700,
            lineHeight: "19.5px",
            textAlign: "left",
          }}
        >
          {title}
        </div>
      ) : null}

      {children}
    </section>
  );
}

function TimelineOverviewPanel({
  slots,
  activeSlotId,
  onSelectSlot,
}: {
  slots: EquationTimelineSlot[];
  activeSlotId: string | null;
  onSelectSlot: (slotId: string) => void;
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
          textAlign: "center",
        }}
      >
        Song Equations
      </div>

      <div
        style={{
          padding: 12,
          display: "flex",
          flexDirection: "column",
          gap: 10,
          overflowY: "auto",
          fontFamily: "Space Grotesk, sans-serif",
        }}
      >
        {slots.length === 0 ? (
          <div style={{ color: "#FFFFFF80", fontSize: 12, fontWeight: 700, lineHeight: 1.4 }}>
            Set SongAsset.equation_slots in Supabase or load a sidecar JSON.
          </div>
        ) : (
          slots.map((slot, index) => {
            const isActive = slot.id === activeSlotId;

            return (
              <button
                key={slot.id}
                type="button"
                onClick={() => onSelectSlot(slot.id)}
                style={{
                  width: "100%",
                  minHeight: 48,
                  background: isActive ? "#191919" : "#252525",
                  border: `1px solid ${isActive ? "#CFFF04" : subtleBorderColor}`,
                  borderRadius: 10,
                  padding: "8px 10px",
                  boxSizing: "border-box",
                  color: textColor,
                  cursor: "pointer",
                  textAlign: "left",
                }}
              >
                <div style={{ fontSize: 12, fontWeight: 800 }}>Equation {index + 1}</div>
                <div style={{ color: "#FFFFFF80", fontSize: 11, fontWeight: 700 }}>
                  Tick {slot.tick}
                </div>
              </button>
            );
          })
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
  const project = useEditorStore((s) => s.project);
  const setProject = useEditorStore((s) => s.setProject);
  const setStoreSidecar = useEditorStore((s) => s.setSidecar);

  const [chartFile, setChartFile] = useState("");
  const [metadata, setMetadata] = useState<LessonBuilderPayload["analysisMetadata"]>();
  const [uploadedSongName, setUploadedSongName] = useState("");
  const [uploadedChartName, setUploadedChartName] = useState("");
  const [pendingSongFile, setPendingSongFile] = useState<File | null>(null);

  const [mechanicEvents, setMechanicEvents] = useState<SidecarMechanicEvent[]>([]);
  const [equationSlots, setEquationSlots] = useState<EquationTimelineSlot[]>([]);
  const [activeSlotId, setActiveSlotId] = useState<string | null>(null);
  const [requiredEquationSlots, setRequiredEquationSlots] = useState<number | null>(null);
  const [customTokenLabel, setCustomTokenLabel] = useState("");
  const [currentTick, setCurrentTick] = useState(0);
  const [hits, setHits] = useState(1);
  const [loadError, setLoadError] = useState("");

  const sidecar = useMemo(
    () => sidecarFromSlots(equationSlots, mechanicEvents),
    [equationSlots, mechanicEvents],
  );

  const payloadForProject: LessonBuilderPayload = useMemo(
    () => ({
      chartFile,
      analysisMetadata: metadata,
      rawResults: sidecar,
    }),
    [chartFile, metadata, sidecar],
  );

  const activeSlot = useMemo(
    () => equationSlots.find((slot) => slot.id === activeSlotId) ?? null,
    [activeSlotId, equationSlots],
  );

  function loadSidecarIntoTimeline(nextSidecar: SidecarPayload, equationSlotCount = requiredEquationSlots) {
    const normalized = normalizeSidecar(nextSidecar);
    const nextMechanics = normalized.events.filter(
      (event): event is SidecarMechanicEvent => event.type === "ALG_MECHANIC",
    );
    const importedSlots = slotsFromSidecar(normalized);
    const nextSlots =
      typeof equationSlotCount === "number"
        ? resizeEquationSlots(importedSlots, equationSlotCount, importedSlots[0]?.tick ?? currentTick)
        : importedSlots;

    setMechanicEvents(nextMechanics);
    setEquationSlots(nextSlots);
    setActiveSlotId(nextSlots[0]?.id ?? null);
    setCurrentTick(nextSlots[0]?.tick ?? 0);
    setStoreSidecar(sidecarFromSlots(nextSlots, nextMechanics));
  }

  function applySongAssetEquationSlotCount(count: number | null) {
    setRequiredEquationSlots(count);

    if (typeof count !== "number") {
      return;
    }

    setEquationSlots((current) => {
      const nextSlots = resizeEquationSlots(current, count, current[0]?.tick ?? currentTick);

      setActiveSlotId((currentId) => {
        if (currentId && nextSlots.some((slot) => slot.id === currentId)) {
          return currentId;
        }

        return nextSlots[0]?.id ?? null;
      });

      return nextSlots;
    });
  }

  function handleSelectSlot(slotId: string) {
    setActiveSlotId(slotId);

    const slot = equationSlots.find((candidate) => candidate.id === slotId);

    if (slot) {
      setCurrentTick(slot.tick);
    }
  }

  function patchActiveSlot(updater: (slot: EquationTimelineSlot) => EquationTimelineSlot) {
    setEquationSlots((current) =>
      current.map((slot) => (slot.id === activeSlotId ? updater(slot) : slot)),
    );
  }

  function handleCurrentTickChange(nextTick: number) {
    setCurrentTick(nextTick);

    if (activeSlotId) {
      patchActiveSlot((slot) => ({
        ...slot,
        tick: nextTick,
      }));
    }
  }

  function handleInsertEquationToken(index: number, label: string) {
    if (!activeSlotId) {
      return;
    }

    patchActiveSlot((slot) => {
      const nextToken = {
        id: makeId("token"),
        label,
      };
      const safeIndex = Math.max(0, Math.min(index, slot.tokens.length));

      return {
        ...slot,
        tokens: [...slot.tokens.slice(0, safeIndex), nextToken, ...slot.tokens.slice(safeIndex)],
      };
    });
  }

  function handleRemoveEquationToken(id: string) {
    patchActiveSlot((slot) => ({
      ...slot,
      tokens: slot.tokens.filter((token) => token.id !== id),
    }));
  }

  function handleClearSlot() {
    patchActiveSlot((slot) => ({
      ...slot,
      tokens: [],
    }));
  }

  function handleAddMechanic(mechanic: GameplayMechanic) {
    setMechanicEvents((current) =>
      sortEvents([
        ...current,
        {
          tick: currentTick,
          type: "ALG_MECHANIC",
          mechanic,
          hits,
        },
      ]) as SidecarMechanicEvent[],
    );
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
      setProject(chartToProject({ ...payloadForProject, chartFile: text }));
      setLoadError("");
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Unable to read chart file");
    }
  }

  async function handleSidecarUpload(file: File) {
    try {
      const text = await readFileAsText(file);
      const parsed = JSON.parse(text) as unknown;
      const normalized = normalizeSidecar(parsed);
      loadSidecarIntoTimeline(normalized);
      setLoadError("");
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Unable to read sidecar JSON");
    }
  }

  function handleDownloadChart() {
    if (!project) {
      if (chartFile.trim()) {
        downloadTextFile(getChartFileName(uploadedChartName), chartFile, "text/plain;charset=utf-8");
      }
      return;
    }

    downloadTextFile(getChartFileName(uploadedChartName), projectToChart(project), "text/plain;charset=utf-8");
  }

  function handleDownloadSidecar() {
    downloadTextFile(
      getSidecarFileName(uploadedChartName),
      projectToSidecarJson(sidecar),
      "application/json;charset=utf-8",
    );
  }

  useEffect(() => {
    setStoreSidecar(sidecar);
  }, [setStoreSidecar, sidecar]);

  useEffect(() => {
    if (!chartFile.trim()) return;

    try {
      setProject(chartToProject(payloadForProject));
    } catch (error) {
      console.error("Failed to rebuild project after sidecar update", error);
    }
  }, [chartFile, payloadForProject, setProject]);

  useEffect(() => {
    const raw = sessionStorage.getItem("ultrarapid_selected_song");

    if (!raw) {
      return;
    }

    try {
      const selectedSong: SelectedSongPayload = JSON.parse(raw);
      const selectedSongEquationSlots = getSelectedSongEquationSlotCount(selectedSong);

      applySongAssetEquationSlotCount(selectedSongEquationSlots);
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
        selectedSong.sidecar ? jsonFromSignedUrl(selectedSong.sidecar.signedUrl) : Promise.resolve(null),
      ])
        .then(([nextChartFile, sidecarJson]) => {
          const nextChartName = selectedSong.chart.path.split("/").pop() ?? "selected.chart";
          const normalizedSidecar = normalizeSidecar(sidecarJson ?? emptySidecar);

          setChartFile(nextChartFile);
          setUploadedChartName(nextChartName);
          loadSidecarIntoTimeline(normalizedSidecar, selectedSongEquationSlots);

          const payload: LessonBuilderPayload = {
            chartFile: nextChartFile,
            analysisMetadata: {
              songTitle: selectedSong.title ?? selectedSong.name,
              artist: selectedSong.artist ?? undefined,
              uploadedFileName: selectedSong.song.path,
            },
            rawResults: normalizedSidecar,
          };

          setProject(chartToProject(payload));
        })
        .catch((error) => {
          console.error("Failed to load selected chart or sidecar JSON", error);
          setLoadError(error instanceof Error ? error.message : "Failed to load selected song package");
        });
    } catch (error) {
      console.error("Failed to parse selected song package", error);
      setLoadError(error instanceof Error ? error.message : "Failed to parse selected song package");
    }
  }, [setProject]);

  useEffect(() => {
    const raw = sessionStorage.getItem("ultrarapid_editor_payload");
    if (!raw) return;

    try {
      const payload: LessonBuilderPayload = JSON.parse(raw);
      const normalizedSidecar = normalizeSidecar(payload.rawResults ?? emptySidecar);
      setRequiredEquationSlots(null);

      if (payload?.analysisMetadata) {
        setMetadata(payload.analysisMetadata);
      }

      if (payload?.chartFile) {
        setChartFile(payload.chartFile);

        if (payload.analysisMetadata?.uploadedFileName) {
          setUploadedChartName(payload.analysisMetadata.uploadedFileName);
        }

        loadSidecarIntoTimeline(normalizedSidecar);
        setProject(chartToProject({ ...payload, rawResults: normalizedSidecar }));
      } else {
        loadSidecarIntoTimeline(normalizedSidecar);
      }

      sessionStorage.removeItem("ultrarapid_editor_payload");
    } catch (error) {
      console.error("Failed to hydrate lesson builder payload", error);
      setLoadError(error instanceof Error ? error.message : "Failed to hydrate lesson builder payload");
    }
  }, [setProject]);

  useEffect(() => {
    if (!pendingSongFile) return;

    console.info("Selected song file loaded for editor:", pendingSongFile.name);
  }, [pendingSongFile]);

  useEffect(() => {
    if (!chartFile.trim()) return;

    console.info("Chart file loaded for editor:", {
      chartName: uploadedChartName,
      songName: uploadedSongName,
      metadata,
      equationSlots: equationSlots.length,
    });
  }, [chartFile, uploadedChartName, uploadedSongName, metadata, equationSlots.length]);

  useEffect(() => {
    if (!activeSlot && equationSlots.length > 0) {
      setActiveSlotId(equationSlots[0].id);
    }
  }, [activeSlot, equationSlots]);

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
        chartName={uploadedChartName}
        currentTick={currentTick}
        hits={hits}
        requiredEquationSlots={requiredEquationSlots}
        actualEquationSlots={equationSlots.length}
        loadError={loadError}
        onChartUpload={handleChartUpload}
        onSidecarUpload={handleSidecarUpload}
        onCurrentTickChange={handleCurrentTickChange}
        onHitsChange={setHits}
        onAddMechanic={handleAddMechanic}

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
        <TimelineOverviewPanel
          slots={equationSlots}
          activeSlotId={activeSlotId}
          onSelectSlot={handleSelectSlot}
        />

        <CenterEditorPanel
          slots={equationSlots}
          activeSlotId={activeSlotId}
          customTokenLabel={customTokenLabel}
          onCustomTokenLabelChange={setCustomTokenLabel}
          onSelectSlot={handleSelectSlot}
          onInsertToken={handleInsertEquationToken}
          onRemoveToken={handleRemoveEquationToken}
          onClearSlot={handleClearSlot}
        />

        <WorkspacePanel title="Teacher Feedback" width="12.5vw" background="#2B2B2B" />
      </main>
    </div>
  );
}
