"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { ChangeEvent, DragEvent, FC, SVGProps } from "react";
import { useEffect, useMemo, useState } from "react";
import { useEditorStore } from "@/lib/editor/editor-store";
import { chartToProject } from "@/lib/editor/chart-to-project";
import {
  projectToChart,
  projectToSidecarJson,
} from "@/lib/editor/project-to-chart";
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

type StorageFileRef = {
  bucket: string;
  path: string;
  signedUrl?: string;
  contentType: string | null;
};

type SelectedSongPayload = {
  id: string;
  name: string;
  title?: string;
  artist?: string | null;
  equationSlots?: number | string | null;
  equation_slots?: number | string | null;
hitCounts?: unknown;
hit_counts?: unknown;
hit_count?: unknown;

spinCounts?: unknown;
spin_counts?: unknown;
spin_count?: unknown;

dragCounts?: unknown;
drag_counts?: unknown;
drag_count?: unknown;
  songAsset?: {
    equationSlots?: number | string | null;
    equation_slots?: number | string | null;
    hitCounts?: unknown;
    hit_counts?: unknown;
    spinCounts?: unknown;
    spin_counts?: unknown;
    dragCounts?: unknown;
    drag_counts?: unknown;

    hit_count?: unknown;
spin_count?: unknown;
drag_count?: unknown;
  } | null;
  song_asset?: {
    equationSlots?: number | string | null;
    equation_slots?: number | string | null;
    hitCounts?: unknown;
    hit_counts?: unknown;
    spinCounts?: unknown;
    spin_counts?: unknown;
    dragCounts?: unknown;
    drag_counts?: unknown;

    hit_count?: unknown;
spin_count?: unknown;
drag_count?: unknown;
  } | null;
  song: StorageFileRef & { signedUrl: string };
  chart: StorageFileRef & { signedUrl: string };
  sidecar: (StorageFileRef & { signedUrl: string }) | null;
};

type EquationToken = {
  id: string;
  label: string;
};

type SavedEquation = {
  id: string;
  tokens: EquationToken[];
};

type GameplayMechanic = "hit" | "spin" | "drag";

type HitBubblePosition =
  | "topLeft"
  | "topRight"
  | "left"
  | "right"
  | "bottomLeft"
  | "bottomRight";

type HitBubblePlacement = {
  tokenIndex: number;
  positions: HitBubblePosition[];
};

type SpinTarget = {
  tokenIndex: number;
};

type DragTarget = {
  tokenIndex: number;
};

type HitBubblePair = "topLeftBottomRight" | "topRightBottomLeft" | "leftRight";

type MechanicInstance = {
  id: string;
  equation: SavedEquation | null;
  hitBubbles: HitBubblePlacement[];
  spinTargets: SpinTarget[];
  dragTargets: DragTarget[];
};

type MechanicCounts = Record<GameplayMechanic, number>;

type TimelineEventSlot = {
  id: string;
  tick: number;
  counts: MechanicCounts;
  mechanics: Record<GameplayMechanic, MechanicInstance[]>;
};

type SidecarMechanicEvent = {
  tick: number;
  type: "ALG_MECHANIC";
  mechanic: GameplayMechanic;
  instanceIndex?: number;
  equationId?: string;
  hits?: number;
  hitBubbles?: HitBubblePlacement[];
  spinTargets?: SpinTarget[];
  dragTargets?: DragTarget[];
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
const panelBackgroundColor = "#2B2B2B";
const subtleBorderColor = "#FFFFFF14";
const textColor = "#FFFFFF";

const emptySidecar: SidecarPayload = {
  version: 1,
  events: [],
};

const gameplayMechanics: GameplayMechanic[] = ["hit", "spin", "drag"];
const hitBubblePositions: HitBubblePosition[] = [
  "topLeft",
  "topRight",
  "left",
  "right",
  "bottomLeft",
  "bottomRight",
];

const hitBubblePairPositions: Record<HitBubblePair, HitBubblePosition[]> = {
  topLeftBottomRight: ["topLeft", "bottomRight"],
  topRightBottomLeft: ["topRight", "bottomLeft"],
  leftRight: ["left", "right"],
};

const binaryOperatorLabels = new Set(["+", "-", "×", "÷", "="]);
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
  {
    label: "Profile",
    href: "/student/profile",
    Icon: ProfileIcon,
    width: 134.45,
  },
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

function isEquationOperator(label: string) {
  return binaryOperatorLabels.has(label);
}

function normalizeTick(value: unknown) {
  const nextTick = Number(value);

  if (!Number.isFinite(nextTick)) {
    return 0;
  }

  return Math.max(0, Math.round(nextTick));
}

function normalizeMechanic(value: unknown): GameplayMechanic | null {
  if (value === "hit" || value === "spin" || value === "drag") {
    return value;
  }

  return null;
}

function normalizeNonNegativeInteger(value: unknown, fallback = 0) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed < 0) {
    return fallback;
  }

  return Math.round(parsed);
}

function normalizeIntegerArray(value: unknown): number[] {
  if (Array.isArray(value)) {
    return value.map((item) => normalizeNonNegativeInteger(item));
  }

  if (typeof value === "string") {
    const trimmed = value.trim();

    try {
      const parsed = JSON.parse(trimmed) as unknown;
      return normalizeIntegerArray(parsed);
    } catch {
      if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
        return trimmed
          .slice(1, -1)
          .split(",")
          .map((item) => item.trim().replace(/^"|"$/g, ""))
          .map((item) => normalizeNonNegativeInteger(item));
      }

      return [];
    }
  }

  return [];
}

function normalizeEquationSlotCount(value: unknown): number | null {
  const count = Number(value);

  if (!Number.isFinite(count) || count < 0) {
    return null;
  }

  return Math.round(count);
}

function getSelectedSongEquationSlotCount(selectedSong: SelectedSongPayload) {
  return (
    normalizeEquationSlotCount(selectedSong.equationSlots) ??
    normalizeEquationSlotCount(selectedSong.equation_slots) ??
    normalizeEquationSlotCount(selectedSong.songAsset?.equationSlots) ??
    normalizeEquationSlotCount(selectedSong.songAsset?.equation_slots) ??
    normalizeEquationSlotCount(selectedSong.song_asset?.equationSlots) ??
    normalizeEquationSlotCount(selectedSong.song_asset?.equation_slots) ??
    0
  );
}

function getSelectedSongMechanicCountArray(
  selectedSong: SelectedSongPayload,
  mechanic: GameplayMechanic,
) {
  const camelKey = `${mechanic}Counts` as
    | "hitCounts"
    | "spinCounts"
    | "dragCounts";

  const snakePluralKey = `${mechanic}_counts` as
    | "hit_counts"
    | "spin_counts"
    | "drag_counts";

  const snakeSingularKey = `${mechanic}_count` as
    | "hit_count"
    | "spin_count"
    | "drag_count";

  const candidates = [
    selectedSong[camelKey],
    selectedSong[snakePluralKey],
    selectedSong[snakeSingularKey],

    selectedSong.songAsset?.[camelKey],
    selectedSong.songAsset?.[snakePluralKey],
    selectedSong.songAsset?.[snakeSingularKey],

    selectedSong.song_asset?.[camelKey],
    selectedSong.song_asset?.[snakePluralKey],
    selectedSong.song_asset?.[snakeSingularKey],
  ];

  for (const candidate of candidates) {
    const normalized = normalizeIntegerArray(candidate);

    if (normalized.length > 0) {
      return normalized;
    }
  }

  return [];
}

function getSelectedSongEventCounts(selectedSong: SelectedSongPayload) {
  const hitCounts = getSelectedSongMechanicCountArray(selectedSong, "hit");
  const spinCounts = getSelectedSongMechanicCountArray(selectedSong, "spin");
  const dragCounts = getSelectedSongMechanicCountArray(selectedSong, "drag");

  const explicitEquationSlots = getSelectedSongEquationSlotCount(selectedSong);

  const equationSlots = Math.max(
    explicitEquationSlots,
    hitCounts.length,
    spinCounts.length,
    dragCounts.length,
  );

  return Array.from(
    { length: equationSlots },
    (_, index): MechanicCounts => ({
      hit: hitCounts[index] ?? 0,
      spin: spinCounts[index] ?? 0,
      drag: dragCounts[index] ?? 0,
    }),
  );
}

function normalizeHitBubblePosition(value: unknown): HitBubblePosition | null {
  return hitBubblePositions.includes(value as HitBubblePosition)
    ? (value as HitBubblePosition)
    : null;
}

function normalizeHitBubblePlacements(value: unknown): HitBubblePlacement[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((placement): HitBubblePlacement[] => {
    if (!isObject(placement) || !Array.isArray(placement.positions)) {
      return [];
    }

    const tokenIndex = normalizeNonNegativeInteger(placement.tokenIndex, -1);

    if (tokenIndex < 0) {
      return [];
    }

    const positions = Array.from(
      new Set(
        placement.positions
          .map((position) => normalizeHitBubblePosition(position))
          .filter((position): position is HitBubblePosition =>
            Boolean(position),
          ),
      ),
    );

    if (positions.length === 0) {
      return [];
    }

    return [{ tokenIndex, positions }];
  });
}

function normalizeTokenTargets<T extends SpinTarget | DragTarget>(
  value: unknown,
) {
  if (!Array.isArray(value)) {
    return [] as T[];
  }

  return value.flatMap((target): T[] => {
    if (!isObject(target)) {
      return [];
    }

    const tokenIndex = normalizeNonNegativeInteger(target.tokenIndex, -1);

    if (tokenIndex < 0) {
      return [];
    }

    return [{ tokenIndex } as T];
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

      const equationId =
        typeof event.equationId === "string" ? event.equationId : undefined;
      const instanceIndex = normalizeNonNegativeInteger(event.instanceIndex);

      return [
        {
          tick: normalizeTick(event.tick),
          type: "ALG_MECHANIC",
          mechanic,
          instanceIndex,
          ...(equationId ? { equationId } : {}),
          ...(mechanic === "hit"
            ? {
                hits: Math.max(1, normalizeNonNegativeInteger(event.hits, 1)),
                hitBubbles: normalizeHitBubblePlacements(event.hitBubbles),
              }
            : {}),
          ...(mechanic === "spin"
            ? {
                spinTargets: normalizeTokenTargets<SpinTarget>(
                  event.spinTargets,
                ),
              }
            : {}),
          ...(mechanic === "drag"
            ? {
                dragTargets: normalizeTokenTargets<DragTarget>(
                  event.dragTargets,
                ),
              }
            : {}),
        },
      ];
    }

    if (event.type === "ALG_EQUATION_STATE") {
      const equationId =
        typeof event.equationId === "string" ? event.equationId : "";
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

  return { version: 1, events: sortEvents(events) };
}

function sortEvents(events: SidecarEvent[]) {
  return [...events].sort((left, right) => {
    if (left.tick !== right.tick) {
      return left.tick - right.tick;
    }

    if (left.type !== right.type) {
      return left.type.localeCompare(right.type);
    }

    if (left.type === "ALG_MECHANIC" && right.type === "ALG_MECHANIC") {
      if (left.mechanic !== right.mechanic) {
        return left.mechanic.localeCompare(right.mechanic);
      }

      return (left.instanceIndex ?? 0) - (right.instanceIndex ?? 0);
    }

    return 0;
  });
}

function cloneTokens(tokens: EquationToken[]) {
  return tokens.map((token) => ({ ...token, id: makeId("token") }));
}

function tokensToEquationState(tokens: EquationToken[]) {
  return tokens.map((token) => token.label).join(" ");
}

function equationStateToTokens(state: string): EquationToken[] {
  return state
    .split(/\s+/)
    .map((label) => label.trim())
    .filter(Boolean)
    .map((label) => ({ id: makeId("token"), label }));
}

function cloneSavedEquation(equation: SavedEquation): SavedEquation {
  return {
    id: equation.id || makeId("equation"),
    tokens: cloneTokens(equation.tokens),
  };
}

function savedEquationFromState(
  equationId: string,
  state: string,
): SavedEquation {
  return {
    id: equationId || makeId("equation"),
    tokens: equationStateToTokens(state),
  };
}

function makeMechanicInstance(): MechanicInstance {
  return {
    id: makeId("mechanic"),
    equation: null,
    hitBubbles: [],
    spinTargets: [],
    dragTargets: [],
  };
}

function makeMechanicInstances(count: number) {
  return Array.from({ length: Math.max(0, count) }, () =>
    makeMechanicInstance(),
  );
}

function makeTimelineEvent(
  index: number,
  counts: MechanicCounts,
  tick = 0,
): TimelineEventSlot {
  return {
    id: makeId("event"),
    tick,
    counts,
    mechanics: {
      hit: makeMechanicInstances(counts.hit),
      spin: makeMechanicInstances(counts.spin),
      drag: makeMechanicInstances(counts.drag),
    },
  };
}

function resizeMechanicInstances(instances: MechanicInstance[], count: number) {
  const safeCount = Math.max(0, count);
  const next = instances.slice(0, safeCount);

  while (next.length < safeCount) {
    next.push(makeMechanicInstance());
  }

  return next;
}

function applyCountsToTimelineEvents(
  events: TimelineEventSlot[],
  eventCounts: MechanicCounts[],
): TimelineEventSlot[] {
  return eventCounts.map((counts, index) => {
    const existing = events[index];

    if (!existing) {
      return makeTimelineEvent(index, counts);
    }

    return {
      ...existing,
      counts,
      mechanics: {
        hit: resizeMechanicInstances(existing.mechanics.hit, counts.hit),
        spin: resizeMechanicInstances(existing.mechanics.spin, counts.spin),
        drag: resizeMechanicInstances(existing.mechanics.drag, counts.drag),
      },
    };
  });
}

function equationIdFor(
  eventIndex: number,
  mechanic: GameplayMechanic,
  instanceIndex: number,
) {
  return `eq_${String(eventIndex + 1).padStart(3, "0")}_${mechanic}_${String(instanceIndex + 1).padStart(2, "0")}`;
}

function parseEquationId(equationId: string) {
  const match = equationId.match(/^eq_(\d+)_(hit|spin|drag)_(\d+)$/i);

  if (!match) {
    return null;
  }

  return {
    eventIndex: Math.max(0, Number(match[1]) - 1),
    mechanic: match[2].toLowerCase() as GameplayMechanic,
    instanceIndex: Math.max(0, Number(match[3]) - 1),
  };
}

function timelineEventsFromSidecar(
  sidecar: SidecarPayload,
  eventCounts: MechanicCounts[],
): TimelineEventSlot[] {
  const normalized = normalizeSidecar(sidecar);
  const equationEvents = normalized.events.filter(
    (event): event is SidecarEquationStateEvent =>
      event.type === "ALG_EQUATION_STATE",
  );
  const mechanicEvents = normalized.events.filter(
    (event): event is SidecarMechanicEvent => event.type === "ALG_MECHANIC",
  );

  const events = applyCountsToTimelineEvents([], eventCounts);

  equationEvents.forEach((equationEvent) => {
    const parsed = parseEquationId(equationEvent.equationId);

    if (!parsed) {
      return;
    }

    const eventSlot = events[parsed.eventIndex];
    const instance =
      eventSlot?.mechanics[parsed.mechanic]?.[parsed.instanceIndex];

    if (!instance) {
      return;
    }

    instance.equation = savedEquationFromState(
      equationEvent.equationId,
      equationEvent.state,
    );
  });

  mechanicEvents.forEach((mechanicEvent) => {
    const eventIndex = events.findIndex(
      (eventSlot) => eventSlot.tick === mechanicEvent.tick,
    );
    const fallbackParsed = mechanicEvent.equationId
      ? parseEquationId(mechanicEvent.equationId)
      : null;
    const safeEventIndex = fallbackParsed?.eventIndex ?? eventIndex;
    const safeInstanceIndex =
      fallbackParsed?.instanceIndex ?? mechanicEvent.instanceIndex ?? 0;
    const eventSlot = safeEventIndex >= 0 ? events[safeEventIndex] : null;
    const instance =
      eventSlot?.mechanics[mechanicEvent.mechanic]?.[safeInstanceIndex];

    if (!instance) {
      return;
    }

    if (mechanicEvent.mechanic === "hit") {
      instance.hitBubbles = mechanicEvent.hitBubbles ?? [];
    }

    if (mechanicEvent.mechanic === "spin") {
      instance.spinTargets = mechanicEvent.spinTargets ?? [];
    }

    if (mechanicEvent.mechanic === "drag") {
      instance.dragTargets = mechanicEvent.dragTargets ?? [];
    }
  });

  return events;
}

function savedEquationsFromTimelineEvents(events: TimelineEventSlot[]) {
  const byState = new Map<string, SavedEquation>();

  events.forEach((event) => {
    gameplayMechanics.forEach((mechanic) => {
      event.mechanics[mechanic].forEach((instance) => {
        const state = instance.equation
          ? tokensToEquationState(instance.equation.tokens)
          : "";

        if (!instance.equation || !state || byState.has(state)) {
          return;
        }

        byState.set(state, {
          id: instance.equation.id || makeId("equation"),
          tokens: cloneTokens(instance.equation.tokens),
        });
      });
    });
  });

  return Array.from(byState.values());
}

function sidecarFromTimelineEvents(
  events: TimelineEventSlot[],
): SidecarPayload {
  const sidecarEvents = events.flatMap((event, eventIndex): SidecarEvent[] => {
    return gameplayMechanics.flatMap((mechanic): SidecarEvent[] => {
      return event.mechanics[mechanic].flatMap(
        (instance, instanceIndex): SidecarEvent[] => {
          if (!instance.equation || instance.equation.tokens.length === 0) {
            return [];
          }

          const equationId = equationIdFor(eventIndex, mechanic, instanceIndex);
          const mechanicEvent: SidecarMechanicEvent = {
            tick: event.tick,
            type: "ALG_MECHANIC",
            mechanic,
            instanceIndex,
            equationId,
          };

          if (mechanic === "hit") {
            mechanicEvent.hits = Math.max(1, instance.hitBubbles.length || 1);
            if (instance.hitBubbles.length > 0) {
              mechanicEvent.hitBubbles = instance.hitBubbles;
            }
          }

          if (mechanic === "spin" && instance.spinTargets.length > 0) {
            mechanicEvent.spinTargets = instance.spinTargets;
          }

          if (mechanic === "drag" && instance.dragTargets.length > 0) {
            mechanicEvent.dragTargets = instance.dragTargets;
          }

          return [
            mechanicEvent,
            {
              tick: event.tick,
              type: "ALG_EQUATION_STATE",
              equationId,
              state: tokensToEquationState(instance.equation.tokens),
            },
          ];
        },
      );
    });
  });

  return { version: 1, events: sortEvents(sidecarEvents) };
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
                   prefetch={false}
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
                  }}
                >
                  <Icon
                    style={{ width: tab.width, height: 45.5, display: "block" }}
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
               prefetch={false}
              aria-label={tab.label}
              className={styles.utilityButton}
              style={{ width: tab.width, height: 38 }}
            >
              <tab.Icon
                style={{ width: tab.width, height: 38, display: "block" }}
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

function EditorActionBar({
  saveStatus,
  isSaving,
  onBack,
  onSave,
}: {
  saveStatus: string;
  isSaving: boolean;
  onBack: () => void;
  onSave: () => void;
}) {
  return (
    <section
      aria-label="Lesson builder actions"
      style={{
        width: "100%",
        height: 72,
        minHeight: 72,
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
          height: "100%",
          margin: "0 auto",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
        }}
      >
        <button
          type="button"
          onClick={onBack}
          style={{
            minWidth: 96,
            height: 42,
            background: pageBackgroundColor,
            color: "#FFFFFF",
            border: `1px solid ${subtleBorderColor}`,
            borderRadius: 12,
            fontFamily: "Space Grotesk, sans-serif",
            fontSize: 14,
            fontWeight: 800,
            cursor: "pointer",
          }}
        >
          Back
        </button>

        <div
          aria-live="polite"
          style={{
            minWidth: 0,
            color: saveStatus === "Saved" ? "#CFFF04" : "#FFFFFF99",
            fontSize: 12,
            fontWeight: 700,
            textAlign: "right",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {saveStatus}
        </div>

        <button
          type="button"
          disabled={isSaving}
          onClick={onSave}
          aria-label="Save lesson to Supabase"
          title="Save lesson"
          style={{
            width: 119,
            height: 58,
            border: "none",
            borderRadius: 12,
            background: "transparent",
            padding: 0,
            cursor: isSaving ? "not-allowed" : "pointer",
            opacity: isSaving ? 0.55 : 1,
            flexShrink: 0,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <img
            src="/Save_Button.svg"
            alt=""
            aria-hidden="true"
            style={{
              width: 119,
              height: 58,
              display: "block",
              objectFit: "contain",
            }}
          />
        </button>
      </div>
    </section>
  );
}

function getEquationBubbleSize(label: string, baseSize: number) {
  return isEquationOperator(label) ? Math.round(baseSize * 0.5) : baseSize;
}

function EquationCircle({
  label,
  draggable = true,
  size = 34,
  shrinkOperators = true,
}: {
  label: string;
  draggable?: boolean;
  size?: number;
  shrinkOperators?: boolean;
}) {
  const visualSize =
    shrinkOperators && isEquationOperator(label)
      ? getEquationBubbleSize(label, size)
      : size;

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
        width: visualSize,
        height: visualSize,
        borderRadius: "999px",
        background: "#191919",
        border: "2px solid rgba(255, 255, 255, 0.72)",
        color: "#FFFFFF",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "Grandstander, Space Grotesk, sans-serif",
        fontSize: visualSize >= 60 ? 32 : visualSize >= 40 ? 22 : 15,
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
    return (
      <span style={{ color: "#FFFFFF66", fontSize: 12, fontWeight: 700 }}>
        Empty
      </span>
    );
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
        <EquationCircle
          key={token.id}
          label={token.label}
          draggable={false}
          size={circleSize}
        />
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

    if (!rawToken) return;

    try {
      const parsed = JSON.parse(rawToken) as { label?: string };
      if (parsed.label) onInsertToken(index, parsed.label);
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
        onChange={(event: ChangeEvent<HTMLInputElement>) =>
          onChange(event.target.value.slice(0, 3))
        }
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
  draftTokens,
  customTokenLabel,
  onCustomTokenLabelChange,
  onInsertToken,
  onRemoveToken,
  onSaveEquation,
}: {
  draftTokens: EquationToken[];
  customTokenLabel: string;
  onCustomTokenLabelChange: (value: string) => void;
  onInsertToken: (index: number, label: string) => void;
  onRemoveToken: (id: string) => void;
  onSaveEquation: () => void;
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
          overflow: "auto",
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
            minHeight: 120,
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
                    <EquationCircle
                      label={token.label}
                      draggable={false}
                      size={68}
                    />
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
            border: `1px solid ${draftTokens.length > 0 ? "#CFFF04" : subtleBorderColor}`,
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

function getHitBubblePairFromPosition(
  position: HitBubblePosition,
): HitBubblePair {
  if (position === "topLeft" || position === "bottomRight")
    return "topLeftBottomRight";
  if (position === "topRight" || position === "bottomLeft")
    return "topRightBottomLeft";
  return "leftRight";
}

function getHitBubblePositionStyle(position: HitBubblePosition) {
  const offset = 34;
  const cornerOffset = 28;

  switch (position) {
    case "topLeft":
      return { left: -cornerOffset, top: -cornerOffset };
    case "topRight":
      return { right: -cornerOffset, top: -cornerOffset };
    case "left":
      return { left: -offset, top: "50%", transform: "translateY(-50%)" };
    case "right":
      return { right: -offset, top: "50%", transform: "translateY(-50%)" };
    case "bottomLeft":
      return { left: -cornerOffset, bottom: -cornerOffset };
    case "bottomRight":
      return { right: -cornerOffset, bottom: -cornerOffset };
  }
}

function EmptyEquationBubble({ size = 34 }: { size?: number }) {
  return (
    <span
      aria-hidden="true"
      style={{
        width: size,
        height: size,
        borderRadius: "999px",
        background: "#191919",
        border: "2px dashed rgba(255, 255, 255, 0.58)",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        boxSizing: "border-box",
      }}
    />
  );
}

function HitOptionBubble({
  position,
  onSelect,
}: {
  position: HitBubblePosition;
  onSelect: (position: HitBubblePosition) => void;
}) {
  return (
    <button
      type="button"
      aria-label={`Add hit bubbles at ${position}`}
      onClick={(event) => {
        event.stopPropagation();
        onSelect(position);
      }}
      style={{
        position: "absolute",
        ...getHitBubblePositionStyle(position),
        width: 22,
        height: 22,
        borderRadius: "999px",
        background: "#191919",
        border: "2px dashed rgba(207, 255, 4, 0.85)",
        cursor: "pointer",
        padding: 0,
        zIndex: 4,
        boxShadow: "0 0 12px rgba(207, 255, 4, 0.25)",
      }}
    />
  );
}

function HitPlacedBubble({ position }: { position: HitBubblePosition }) {
  return (
    <span
      style={{
        position: "absolute",
        ...getHitBubblePositionStyle(position),
        width: 34,
        height: 34,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        pointerEvents: "none",
        zIndex: 3,
      }}
    >
      <EmptyEquationBubble size={34} />
    </span>
  );
}

function HitEquationPreview({
  tokens,
  hitBubbles,
  onAddHitBubblePair,
}: {
  tokens: EquationToken[];
  hitBubbles: HitBubblePlacement[];
  onAddHitBubblePair: (tokenIndex: number, pair: HitBubblePair) => void;
}) {
  const [selectedTokenIndex, setSelectedTokenIndex] = useState<number | null>(
    null,
  );

  if (tokens.length === 0) {
    return (
      <span style={{ color: "#FFFFFF66", fontSize: 12, fontWeight: 700 }}>
        Empty
      </span>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 34,
        flexWrap: "wrap",
        padding: 36,
      }}
    >
      {tokens.map((token, tokenIndex) => {
        const isOperator = isEquationOperator(token.label);
        const placement = hitBubbles.find(
          (nextPlacement) => nextPlacement.tokenIndex === tokenIndex,
        );
        const placedPositions = placement?.positions ?? [];
        const isSelected = selectedTokenIndex === tokenIndex && !isOperator;

        return (
          <span
            key={token.id}
            style={{
              position: "relative",
              width: 46,
              height: 46,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            {!isOperator
              ? placedPositions.map((position) => (
                  <HitPlacedBubble key={position} position={position} />
                ))
              : null}

            {isSelected
              ? hitBubblePositions.map((position) => (
                  <HitOptionBubble
                    key={position}
                    position={position}
                    onSelect={(nextPosition) => {
                      onAddHitBubblePair(
                        tokenIndex,
                        getHitBubblePairFromPosition(nextPosition),
                      );
                      setSelectedTokenIndex(null);
                    }}
                  />
                ))
              : null}

            {isOperator ? (
              <EquationCircle label={token.label} draggable={false} size={46} />
            ) : (
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  setSelectedTokenIndex((current) =>
                    current === tokenIndex ? null : tokenIndex,
                  );
                }}
                style={{
                  position: "relative",
                  zIndex: 5,
                  border: "none",
                  background: "transparent",
                  padding: 0,
                  cursor: "pointer",
                }}
                title="Click to add hit bubbles"
              >
                <EquationCircle
                  label={token.label}
                  draggable={false}
                  size={46}
                />
              </button>
            )}
          </span>
        );
      })}
    </div>
  );
}

function SpinOverlay({ compact = false }: { compact?: boolean }) {
  const width = compact ? 48 : 150;
  const height = compact ? 34 : 106;

  return (
    <span
      aria-hidden="true"
      style={{
        position: "absolute",
        left: "50%",
        top: "50%",
        width,
        height,
        transform: "translate(-50%, -50%)",
        pointerEvents: "none",
        zIndex: 1,
      }}
    >
      <svg
        width={width}
        height={height}
        viewBox="0 0 150 106"
        fill="none"
        style={{ display: "block", overflow: "visible" }}
      >
        <ellipse
          cx="75"
          cy="53"
          rx="70"
          ry="46"
          stroke="rgba(255, 255, 255, 0.28)"
          strokeWidth="18"
          strokeLinecap="round"
          strokeDasharray="178 90"
          transform="rotate(-18 75 53)"
        />
        <circle cx="75" cy="8" r="13" fill="rgba(255, 255, 255, 0.18)" />
        <circle cx="75" cy="98" r="13" fill="rgba(255, 255, 255, 0.18)" />
      </svg>
    </span>
  );
}

function SpinEquationPreview({
  tokens,
  spinTargets,
  onToggleSpinTarget,
}: {
  tokens: EquationToken[];
  spinTargets: SpinTarget[];
  onToggleSpinTarget: (tokenIndex: number) => void;
}) {
  const targetIndexes = new Set(spinTargets.map((target) => target.tokenIndex));

  if (tokens.length === 0) {
    return (
      <span style={{ color: "#FFFFFF66", fontSize: 12, fontWeight: 700 }}>
        Empty
      </span>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 34,
        flexWrap: "wrap",
        padding: 44,
      }}
    >
      {tokens.map((token, tokenIndex) => {
        const isOperator = isEquationOperator(token.label);
        const isSpinTarget = targetIndexes.has(tokenIndex);

        return (
          <span
            key={token.id}
            style={{
              position: "relative",
              width: 58,
              height: 58,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            {!isOperator && isSpinTarget ? <SpinOverlay /> : null}
            {isOperator ? (
              <EquationCircle label={token.label} draggable={false} size={58} />
            ) : (
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onToggleSpinTarget(tokenIndex);
                }}
                style={{
                  position: "relative",
                  zIndex: 5,
                  border: "none",
                  background: "transparent",
                  padding: 0,
                  cursor: "pointer",
                }}
                title="Click to add or remove spin behavior"
              >
                <EquationCircle
                  label={token.label}
                  draggable={false}
                  size={58}
                />
              </button>
            )}
          </span>
        );
      })}
    </div>
  );
}

function findEqualsIndex(tokens: EquationToken[]) {
  const index = tokens.findIndex((token) => token.label === "=");
  return index >= 0 ? index : Math.floor(tokens.length / 2);
}

function DragArcOverlay({
  side,
  compact = false,
}: {
  side: "left" | "right";
  compact?: boolean;
}) {
  const isRight = side === "right";
  const width = compact ? 56 : 190;
  const height = compact ? 40 : 140;

  return (
    <span
      aria-hidden="true"
      style={{
        position: "absolute",
        top: "50%",
        [isRight ? "left" : "right"]: compact ? 18 : 36,
        width,
        height,
        transform: `translateY(-10%) ${isRight ? "" : "scaleX(-1)"}`,
        pointerEvents: "none",
        zIndex: 1,
      }}
    >
      <svg
        width={width}
        height={height}
        viewBox="0 0 190 140"
        fill="none"
        style={{ display: "block", overflow: "visible" }}
      >
        <path
          d="M6 8C20 96 83 130 180 104"
          stroke="rgba(255, 72, 72, 0.36)"
          strokeWidth="34"
          strokeLinecap="round"
        />
        <path
          d="M23 38C57 119 121 126 180 104"
          stroke="rgba(207, 255, 4, 0.24)"
          strokeWidth="34"
          strokeLinecap="round"
        />
        <path
          d="M111 113C140 113 164 109 180 104"
          stroke="rgba(255, 255, 255, 0.16)"
          strokeWidth="34"
          strokeLinecap="round"
        />
      </svg>
      <span
        style={{
          position: "absolute",
          right: compact ? -8 : -6,
          top: compact ? -6 : 0,
          width: compact ? 22 : 44,
          height: compact ? 22 : 44,
          borderRadius: "999px",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <EmptyEquationBubble size={compact ? 22 : 44} />
      </span>
    </span>
  );
}

function DragEquationPreview({
  tokens,
  dragTargets,
  onToggleDragTarget,
}: {
  tokens: EquationToken[];
  dragTargets: DragTarget[];
  onToggleDragTarget: (tokenIndex: number) => void;
}) {
  const targetIndexes = new Set(dragTargets.map((target) => target.tokenIndex));
  const equalsIndex = findEqualsIndex(tokens);

  if (tokens.length === 0) {
    return (
      <span style={{ color: "#FFFFFF66", fontSize: 12, fontWeight: 700 }}>
        Empty
      </span>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 34,
        flexWrap: "wrap",
        padding: 44,
      }}
    >
      {tokens.map((token, tokenIndex) => {
        const isOperator = isEquationOperator(token.label);
        const isDragTarget = targetIndexes.has(tokenIndex);
        const targetSide = tokenIndex < equalsIndex ? "right" : "left";

        return (
          <span
            key={token.id}
            style={{
              position: "relative",
              width: 58,
              height: 58,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            {!isOperator && isDragTarget ? (
              <DragArcOverlay side={targetSide} />
            ) : null}
            {isOperator ? (
              <EquationCircle label={token.label} draggable={false} size={58} />
            ) : (
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onToggleDragTarget(tokenIndex);
                }}
                style={{
                  position: "relative",
                  zIndex: 5,
                  border: "none",
                  background: "transparent",
                  padding: 0,
                  cursor: "pointer",
                }}
                title="Click to add or remove drag behavior"
              >
                <EquationCircle
                  label={token.label}
                  draggable={false}
                  size={58}
                />
              </button>
            )}
          </span>
        );
      })}
    </div>
  );
}

function InstancePreview({
  mechanic,
  instance,
  onAddHitBubblePair,
  onToggleSpinTarget,
  onToggleDragTarget,
}: {
  mechanic: GameplayMechanic;
  instance: MechanicInstance;
  onAddHitBubblePair: (tokenIndex: number, pair: HitBubblePair) => void;
  onToggleSpinTarget: (tokenIndex: number) => void;
  onToggleDragTarget: (tokenIndex: number) => void;
}) {
  if (!instance.equation) {
    return (
      <span style={{ color: "#FFFFFF80", fontSize: 12, fontWeight: 700 }}>
        Drop equation here.
      </span>
    );
  }

  if (mechanic === "hit") {
    return (
      <HitEquationPreview
        tokens={instance.equation.tokens}
        hitBubbles={instance.hitBubbles}
        onAddHitBubblePair={onAddHitBubblePair}
      />
    );
  }

  if (mechanic === "spin") {
    return (
      <SpinEquationPreview
        tokens={instance.equation.tokens}
        spinTargets={instance.spinTargets}
        onToggleSpinTarget={onToggleSpinTarget}
      />
    );
  }

  return (
    <DragEquationPreview
      tokens={instance.equation.tokens}
      dragTargets={instance.dragTargets}
      onToggleDragTarget={onToggleDragTarget}
    />
  );
}

function MechanicInstanceCell({
  mechanic,
  instance,
  instanceIndex,
  onDropEquation,
  onAddHitBubblePair,
  onToggleSpinTarget,
  onToggleDragTarget,
}: {
  mechanic: GameplayMechanic;
  instance: MechanicInstance;
  instanceIndex: number;
  onDropEquation: (instanceIndex: number, equation: SavedEquation) => void;
  onAddHitBubblePair: (
    instanceIndex: number,
    tokenIndex: number,
    pair: HitBubblePair,
  ) => void;
  onToggleSpinTarget: (instanceIndex: number, tokenIndex: number) => void;
  onToggleDragTarget: (instanceIndex: number, tokenIndex: number) => void;
}) {
  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    const rawEquation = event.dataTransfer.getData(
      "application/x-saved-equation",
    );

    if (!rawEquation) return;

    try {
      const parsed = JSON.parse(rawEquation) as SavedEquation;
      if (parsed.id && Array.isArray(parsed.tokens)) {
        onDropEquation(instanceIndex, {
          id: parsed.id,
          tokens: cloneTokens(parsed.tokens),
        });
      }
    } catch (error) {
      console.error("Failed to drop saved equation", error);
    }
  }

  return (
    <div
      onDragOver={(event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = "copy";
      }}
      onDrop={handleDrop}
      style={{
        minWidth: 260,
        minHeight: 0,
        background: "#191919",
        border: `1px dashed ${subtleBorderColor}`,
        borderRadius: 14,
        display: "grid",
        gridTemplateRows: "auto 1fr",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          minHeight: 34,
          borderBottom: `1px solid ${subtleBorderColor}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#FFFFFF99",
          fontSize: 11,
          fontWeight: 900,
        }}
      >
        {mechanic.toUpperCase()} {instanceIndex + 1}
      </div>
      <div
        style={{
          padding: 10,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "auto",
        }}
      >
        <InstancePreview
          mechanic={mechanic}
          instance={instance}
          onAddHitBubblePair={(tokenIndex, pair) =>
            onAddHitBubblePair(instanceIndex, tokenIndex, pair)
          }
          onToggleSpinTarget={(tokenIndex) =>
            onToggleSpinTarget(instanceIndex, tokenIndex)
          }
          onToggleDragTarget={(tokenIndex) =>
            onToggleDragTarget(instanceIndex, tokenIndex)
          }
        />
      </div>
    </div>
  );
}

function EventMechanicRow({
  mechanic,
  instances,
  onDropEquation,
  onAddHitBubblePair,
  onToggleSpinTarget,
  onToggleDragTarget,
}: {
  mechanic: GameplayMechanic;
  instances: MechanicInstance[];
  onDropEquation: (
    mechanic: GameplayMechanic,
    instanceIndex: number,
    equation: SavedEquation,
  ) => void;
  onAddHitBubblePair: (
    mechanic: GameplayMechanic,
    instanceIndex: number,
    tokenIndex: number,
    pair: HitBubblePair,
  ) => void;
  onToggleSpinTarget: (
    mechanic: GameplayMechanic,
    instanceIndex: number,
    tokenIndex: number,
  ) => void;
  onToggleDragTarget: (
    mechanic: GameplayMechanic,
    instanceIndex: number,
    tokenIndex: number,
  ) => void;
}) {
  if (instances.length === 0) {
    return null;
  }

  return (
    <div
      style={{
        background: "#191919",
        border: `1px solid ${subtleBorderColor}`,
        borderRadius: 18,
        minHeight: 0,
        display: "grid",
        gridTemplateColumns: "92px minmax(0, 1fr)",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          borderRight: `1px solid ${subtleBorderColor}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: textColor,
          fontFamily: "Space Grotesk, sans-serif",
          fontSize: 14,
          fontWeight: 900,
          textTransform: "uppercase",
        }}
      >
        {mechanic}
      </div>
      <div
        style={{
          padding: 12,
          display: "grid",
          gridTemplateColumns: `repeat(${instances.length}, minmax(260px, 1fr))`,
          gap: 12,
          overflowX: "auto",
          overflowY: "hidden",
        }}
      >
        {instances.map((instance, index) => (
          <MechanicInstanceCell
            key={instance.id}
            mechanic={mechanic}
            instance={instance}
            instanceIndex={index}
            onDropEquation={(instanceIndex, equation) =>
              onDropEquation(mechanic, instanceIndex, equation)
            }
            onAddHitBubblePair={(instanceIndex, tokenIndex, pair) =>
              onAddHitBubblePair(mechanic, instanceIndex, tokenIndex, pair)
            }
            onToggleSpinTarget={(instanceIndex, tokenIndex) =>
              onToggleSpinTarget(mechanic, instanceIndex, tokenIndex)
            }
            onToggleDragTarget={(instanceIndex, tokenIndex) =>
              onToggleDragTarget(mechanic, instanceIndex, tokenIndex)
            }
          />
        ))}
      </div>
    </div>
  );
}

function EventBuilderArea({
  eventSlot,
  onDropEquation,
  onAddHitBubblePair,
  onToggleSpinTarget,
  onToggleDragTarget,
}: {
  eventSlot: TimelineEventSlot | null;
  onDropEquation: (
    mechanic: GameplayMechanic,
    instanceIndex: number,
    equation: SavedEquation,
  ) => void;
  onAddHitBubblePair: (
    mechanic: GameplayMechanic,
    instanceIndex: number,
    tokenIndex: number,
    pair: HitBubblePair,
  ) => void;
  onToggleSpinTarget: (
    mechanic: GameplayMechanic,
    instanceIndex: number,
    tokenIndex: number,
  ) => void;
  onToggleDragTarget: (
    mechanic: GameplayMechanic,
    instanceIndex: number,
    tokenIndex: number,
  ) => void;
}) {
  if (!eventSlot) {
    return (
      <div
        style={{
          flex: 1,
          minHeight: 0,
          background: "#191919",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#FFFFFF80",
          fontFamily: "Space Grotesk, sans-serif",
          fontSize: 14,
          fontWeight: 800,
        }}
      >
        Select an event from the timeline to start assigning equations.
      </div>
    );
  }

  const visibleMechanics = gameplayMechanics.filter(
    (mechanic) => eventSlot.mechanics[mechanic].length > 0,
  );

  return (
    <div
      style={{
        flex: 1,
        minHeight: 0,
        height: "60vh",
        maxHeight: "60vh",
        background: "#191919",
        padding: 18,
        boxSizing: "border-box",
        display: "grid",
        gridTemplateRows:
          visibleMechanics.length > 0
            ? `repeat(${visibleMechanics.length}, minmax(0, 1fr))`
            : "1fr",
        gap: 18,
        overflow: "hidden",
      }}
    >
      {visibleMechanics.length === 0 ? (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#FFFFFF80",
            fontFamily: "Space Grotesk, sans-serif",
            fontSize: 14,
            fontWeight: 800,
          }}
        >
          This event does not have any hit, spin, or drag requirements.
        </div>
      ) : (
        visibleMechanics.map((mechanic) => (
          <EventMechanicRow
            key={mechanic}
            mechanic={mechanic}
            instances={eventSlot.mechanics[mechanic]}
            onDropEquation={onDropEquation}
            onAddHitBubblePair={onAddHitBubblePair}
            onToggleSpinTarget={onToggleSpinTarget}
            onToggleDragTarget={onToggleDragTarget}
          />
        ))
      )}
    </div>
  );
}

function CompactHitPreview({ instance }: { instance: MechanicInstance }) {
  const tokens = instance.equation?.tokens ?? [];

  if (tokens.length === 0)
    return <EquationPreview tokens={[]} circleSize={18} />;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        justifyContent: "center",
        flexWrap: "wrap",
      }}
    >
      {tokens.map((token, tokenIndex) => {
        const isOperator = isEquationOperator(token.label);
        const placement = instance.hitBubbles.find(
          (nextPlacement) => nextPlacement.tokenIndex === tokenIndex,
        );

        return (
          <span
            key={token.id}
            style={{
              position: "relative",
              width: 24,
              height: 24,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {!isOperator && placement?.positions.length
              ? placement.positions.map((position) => (
                  <span
                    key={position}
                    style={{
                      position: "absolute",
                      ...getHitBubblePositionStyle(position),
                      transform:
                        position === "left" || position === "right"
                          ? "translateY(-50%) scale(0.42)"
                          : "scale(0.42)",
                      transformOrigin: "center",
                    }}
                  >
                    <EmptyEquationBubble size={22} />
                  </span>
                ))
              : null}
            <EquationCircle label={token.label} draggable={false} size={20} />
          </span>
        );
      })}
    </div>
  );
}

function CompactSpinPreview({ instance }: { instance: MechanicInstance }) {
  const tokens = instance.equation?.tokens ?? [];
  const targets = new Set(
    instance.spinTargets.map((target) => target.tokenIndex),
  );

  if (tokens.length === 0)
    return <EquationPreview tokens={[]} circleSize={18} />;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        justifyContent: "center",
        flexWrap: "wrap",
      }}
    >
      {tokens.map((token, tokenIndex) => {
        const active =
          !isEquationOperator(token.label) && targets.has(tokenIndex);
        return (
          <span
            key={token.id}
            style={{
              position: "relative",
              width: 24,
              height: 24,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {active ? <SpinOverlay compact /> : null}
            <EquationCircle label={token.label} draggable={false} size={20} />
          </span>
        );
      })}
    </div>
  );
}

function CompactDragPreview({ instance }: { instance: MechanicInstance }) {
  const tokens = instance.equation?.tokens ?? [];
  const targets = new Set(
    instance.dragTargets.map((target) => target.tokenIndex),
  );
  const equalsIndex = findEqualsIndex(tokens);

  if (tokens.length === 0)
    return <EquationPreview tokens={[]} circleSize={18} />;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        justifyContent: "center",
        flexWrap: "wrap",
      }}
    >
      {tokens.map((token, tokenIndex) => {
        const active =
          !isEquationOperator(token.label) && targets.has(tokenIndex);
        const side = tokenIndex < equalsIndex ? "right" : "left";
        return (
          <span
            key={token.id}
            style={{
              position: "relative",
              width: 24,
              height: 24,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {active ? <DragArcOverlay side={side} compact /> : null}
            <EquationCircle label={token.label} draggable={false} size={20} />
          </span>
        );
      })}
    </div>
  );
}

function CompactInstancePreview({
  mechanic,
  instance,
}: {
  mechanic: GameplayMechanic;
  instance: MechanicInstance;
}) {
  if (mechanic === "hit") return <CompactHitPreview instance={instance} />;
  if (mechanic === "spin") return <CompactSpinPreview instance={instance} />;
  return <CompactDragPreview instance={instance} />;
}

function EquationTimeline({
  events,
  activeEventId,
  onSelectEvent,
}: {
  events: TimelineEventSlot[];
  activeEventId: string | null;
  onSelectEvent: (eventId: string) => void;
}) {
  return (
    <section
      aria-label="Timeline"
      style={{
        width: "100%",
        height: "calc(40vh - 142px)",
        minHeight: 180,
        background: panelBackgroundColor,
        borderTop: `1px solid ${subtleBorderColor}`,
        boxSizing: "border-box",
        overflow: "hidden",
        fontFamily: "Space Grotesk, sans-serif",
      }}
    >
      <div
        style={{
          height: "100%",
          display: "flex",
          gap: 14,
          padding: 16,
          boxSizing: "border-box",
          overflowX: "auto",
        }}
      >
        {events.length === 0 ? (
          <div
            style={{
              color: "#FFFFFF80",
              fontSize: 13,
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
            }}
          >
            This song does not have any event slots yet.
          </div>
        ) : (
          events.map((eventSlot, index) => {
            const isActive = eventSlot.id === activeEventId;
            const visibleMechanics = gameplayMechanics.filter(
              (mechanic) => eventSlot.mechanics[mechanic].length > 0,
            );

            return (
              <button
                key={eventSlot.id}
                type="button"
                onClick={() => onSelectEvent(eventSlot.id)}
                style={{
                  width: 300,
                  minWidth: 300,
                  height: "100%",
                  background: isActive ? "#191919" : "#252525",
                  color: textColor,
                  border: `2px solid ${isActive ? "#CFFF04" : subtleBorderColor}`,
                  borderRadius: 16,
                  padding: 12,
                  boxSizing: "border-box",
                  cursor: "pointer",
                  display: "grid",
                  gridTemplateRows: "auto 1fr",
                  gap: 10,
                  textAlign: "left",
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 900 }}>
                  Event {index + 1}
                </div>
                <div
                  style={{
                    border: `1px dashed ${subtleBorderColor}`,
                    borderRadius: 12,
                    padding: 10,
                    display: "grid",
                    gap: 8,
                    overflow: "auto",
                  }}
                >
                  {visibleMechanics.length === 0 ? (
                    <div
                      style={{
                        color: "#FFFFFF80",
                        fontSize: 11,
                        fontWeight: 800,
                      }}
                    >
                      No mechanics
                    </div>
                  ) : (
                    visibleMechanics.map((mechanic) => (
                      <div
                        key={mechanic}
                        style={{
                          display: "grid",
                          gridTemplateColumns: "42px minmax(0, 1fr)",
                          alignItems: "center",
                          gap: 8,
                          minHeight: 32,
                        }}
                      >
                        <span
                          style={{
                            color: "#FFFFFF99",
                            fontSize: 10,
                            fontWeight: 900,
                          }}
                        >
                          {mechanic.toUpperCase()}
                        </span>
                        <div
                          style={{
                            display: "flex",
                            gap: 8,
                            overflowX: "auto",
                            overflowY: "visible",
                            padding: "4px 0",
                          }}
                        >
                          {eventSlot.mechanics[mechanic].map(
                            (instance, instanceIndex) => (
                              <div
                                key={instance.id}
                                title={`${mechanic} ${instanceIndex + 1}`}
                                style={{
                                  minWidth: 82,
                                  border: `1px solid ${subtleBorderColor}`,
                                  borderRadius: 8,
                                  padding: 4,
                                  overflow: "visible",
                                }}
                              >
                                <CompactInstancePreview
                                  mechanic={mechanic}
                                  instance={instance}
                                />
                              </div>
                            ),
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </button>
            );
          })
        )}
      </div>
    </section>
  );
}

function EquationsPanel({
  savedEquations,
  onNewEquation,
}: {
  savedEquations: SavedEquation[];
  onNewEquation: () => void;
}) {
  return (
    <section
      style={{
        width: "12.5vw",
        height: "calc(100vh - 142px)",
        minHeight: "calc(100vh - 142px)",
        background: panelBackgroundColor,
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
        Equations
      </div>
      <div
        style={{ padding: 12, borderBottom: `1px solid ${subtleBorderColor}` }}
      >
        <button
          type="button"
          onClick={onNewEquation}
          style={{
            width: "100%",
            minHeight: 38,
            background: "#CFFF04",
            color: "#000000",
            border: "1px solid #CFFF04",
            borderRadius: 10,
            fontFamily: "Space Grotesk, sans-serif",
            fontSize: 12,
            fontWeight: 800,
            lineHeight: "18px",
            cursor: "pointer",
          }}
        >
          New Equation
        </button>
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
        {savedEquations.length === 0 ? (
          <div
            style={{
              color: "#FFFFFF80",
              fontSize: 12,
              fontWeight: 700,
              lineHeight: 1.4,
            }}
          >
            Build equations here, then drag them into an event.
          </div>
        ) : (
          savedEquations.map((equation) => (
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
                minHeight: 48,
                background: "#191919",
                border: `1px solid ${subtleBorderColor}`,
                borderRadius: 10,
                padding: "8px",
                boxSizing: "border-box",
                color: textColor,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "grab",
              }}
              title={tokensToEquationState(equation.tokens)}
            >
              <EquationPreview tokens={equation.tokens} circleSize={24} />
            </div>
          ))
        )}
      </div>
    </section>
  );
}

function RightLessonPanel() {
  return (
    <section
      style={{
        width: "12.5vw",
        height: "calc(100vh - 142px)",
        minHeight: "calc(100vh - 142px)",
        background: panelBackgroundColor,
        color: textColor,
        borderLeft: `1px solid ${subtleBorderColor}`,
        boxSizing: "border-box",
        overflow: "hidden",
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
        Start Building Your Lesson
      </div>
    </section>
  );
}

function CenterEditorPanel({
  mode,
  timelineEvents,
  activeEventId,
  draftTokens,
  customTokenLabel,
  onCustomTokenLabelChange,
  onSelectEvent,
  onInsertToken,
  onRemoveToken,
  onSaveEquation,
  onDropEquation,
  onAddHitBubblePair,
  onToggleSpinTarget,
  onToggleDragTarget,
}: {
  mode: "event" | "equation";
  timelineEvents: TimelineEventSlot[];
  activeEventId: string | null;
  draftTokens: EquationToken[];
  customTokenLabel: string;
  onCustomTokenLabelChange: (value: string) => void;
  onSelectEvent: (eventId: string) => void;
  onInsertToken: (index: number, label: string) => void;
  onRemoveToken: (id: string) => void;
  onSaveEquation: () => void;
  onDropEquation: (
    mechanic: GameplayMechanic,
    instanceIndex: number,
    equation: SavedEquation,
  ) => void;
  onAddHitBubblePair: (
    mechanic: GameplayMechanic,
    instanceIndex: number,
    tokenIndex: number,
    pair: HitBubblePair,
  ) => void;
  onToggleSpinTarget: (
    mechanic: GameplayMechanic,
    instanceIndex: number,
    tokenIndex: number,
  ) => void;
  onToggleDragTarget: (
    mechanic: GameplayMechanic,
    instanceIndex: number,
    tokenIndex: number,
  ) => void;
}) {
  const activeEvent =
    timelineEvents.find((eventSlot) => eventSlot.id === activeEventId) ?? null;

  return (
    <section
      style={{
        width: "75vw",
        height: "calc(100vh - 142px)",
        minHeight: "calc(100vh - 142px)",
        background: "#191919",
        color: textColor,
        boxSizing: "border-box",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {mode === "equation" ? (
        <EquationBuilderArea
          draftTokens={draftTokens}
          customTokenLabel={customTokenLabel}
          onCustomTokenLabelChange={onCustomTokenLabelChange}
          onInsertToken={onInsertToken}
          onRemoveToken={onRemoveToken}
          onSaveEquation={onSaveEquation}
        />
      ) : (
        <EventBuilderArea
          eventSlot={activeEvent}
          onDropEquation={onDropEquation}
          onAddHitBubblePair={onAddHitBubblePair}
          onToggleSpinTarget={onToggleSpinTarget}
          onToggleDragTarget={onToggleDragTarget}
        />
      )}
      <EquationTimeline
        events={timelineEvents}
        activeEventId={activeEventId}
        onSelectEvent={onSelectEvent}
      />
    </section>
  );
}

export default function LessonBuilderClient({
  navBasePath = "/student",
}: LessonBuilderClientProps) {
  const pathname = usePathname();
  const router = useRouter();
  const topTabs = useMemo(() => getTopTabs(navBasePath), [navBasePath]);
  const project = useEditorStore((s) => s.project);
  const setProject = useEditorStore((s) => s.setProject);
  const setStoreSidecar = useEditorStore((s) => s.setSidecar);

  const [chartFile, setChartFile] = useState("");
  const [metadata, setMetadata] =
    useState<LessonBuilderPayload["analysisMetadata"]>();
  const [uploadedSongName, setUploadedSongName] = useState("");
  const [uploadedChartName, setUploadedChartName] = useState("");
  const [pendingSongFile, setPendingSongFile] = useState<File | null>(null);
  const [eventCounts, setEventCounts] = useState<MechanicCounts[]>([]);
  const [timelineEvents, setTimelineEvents] = useState<TimelineEventSlot[]>([]);
  const [activeEventId, setActiveEventId] = useState<string | null>(null);
  const [savedEquations, setSavedEquations] = useState<SavedEquation[]>([]);
  const [mode, setMode] = useState<"event" | "equation">("event");
  const [draftTokens, setDraftTokens] = useState<EquationToken[]>([]);
  const [customTokenLabel, setCustomTokenLabel] = useState("");
  const [loadError, setLoadError] = useState("");
  const [saveStatus, setSaveStatus] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [selectedSongStorage, setSelectedSongStorage] = useState<{
    id: string;
    chart: StorageFileRef;
    sidecar: StorageFileRef | null;
  } | null>(null);

  const sidecar = useMemo(
    () => sidecarFromTimelineEvents(timelineEvents),
    [timelineEvents],
  );
  const payloadForProject: LessonBuilderPayload = useMemo(
    () => ({ chartFile, analysisMetadata: metadata, rawResults: sidecar }),
    [chartFile, metadata, sidecar],
  );

  function loadSidecarIntoTimeline(
    nextSidecar: SidecarPayload,
    nextEventCounts: MechanicCounts[],
  ) {
    const nextEvents = timelineEventsFromSidecar(nextSidecar, nextEventCounts);
    setEventCounts(nextEventCounts);
    setTimelineEvents(nextEvents);
    setSavedEquations((current) => {
      const importedEquations = savedEquationsFromTimelineEvents(nextEvents);
      const existingStates = new Set(
        current.map((equation) => tokensToEquationState(equation.tokens)),
      );
      const merged = [...current];

      importedEquations.forEach((equation) => {
        const state = tokensToEquationState(equation.tokens);
        if (!existingStates.has(state)) {
          merged.push(equation);
          existingStates.add(state);
        }
      });

      return merged;
    });
    setActiveEventId(nextEvents[0]?.id ?? null);
    setMode("event");
    setStoreSidecar(sidecarFromTimelineEvents(nextEvents));
  }

  function handleNewEquation() {
    setDraftTokens([]);
    setCustomTokenLabel("");
    setMode("equation");
  }

  function handleInsertEquationToken(index: number, label: string) {
    setDraftTokens((current) => {
      const nextToken = { id: makeId("token"), label };
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
    if (draftTokens.length === 0) return;

    setSavedEquations((current) => [
      ...current,
      {
        id: makeId("equation"),
        tokens: cloneTokens(draftTokens),
      },
    ]);
    setDraftTokens([]);
    setCustomTokenLabel("");
    setMode("event");
  }

  function handleSelectEvent(eventId: string) {
    setActiveEventId(eventId);
    setMode("event");
  }

  function updateActiveInstance(
    mechanic: GameplayMechanic,
    instanceIndex: number,
    updater: (instance: MechanicInstance) => MechanicInstance,
  ) {
    if (!activeEventId) return;

    setTimelineEvents((current) =>
      current.map((eventSlot) => {
        if (eventSlot.id !== activeEventId) return eventSlot;

        return {
          ...eventSlot,
          mechanics: {
            ...eventSlot.mechanics,
            [mechanic]: eventSlot.mechanics[mechanic].map((instance, index) =>
              index === instanceIndex ? updater(instance) : instance,
            ),
          },
        };
      }),
    );
  }

  function handleDropEquation(
    mechanic: GameplayMechanic,
    instanceIndex: number,
    equation: SavedEquation,
  ) {
    updateActiveInstance(mechanic, instanceIndex, (instance) => ({
      ...instance,
      equation: cloneSavedEquation(equation),
      hitBubbles: [],
      spinTargets: [],
      dragTargets: [],
    }));
  }

  function handleAddHitBubblePair(
    mechanic: GameplayMechanic,
    instanceIndex: number,
    tokenIndex: number,
    pair: HitBubblePair,
  ) {
    if (mechanic !== "hit") return;
    const pairPositions = hitBubblePairPositions[pair];

    updateActiveInstance("hit", instanceIndex, (instance) => ({
      ...instance,
      hitBubbles: [
        ...instance.hitBubbles.filter(
          (placement) => placement.tokenIndex !== tokenIndex,
        ),
        { tokenIndex, positions: pairPositions },
      ],
    }));
  }

  function handleToggleSpinTarget(
    mechanic: GameplayMechanic,
    instanceIndex: number,
    tokenIndex: number,
  ) {
    if (mechanic !== "spin") return;

    updateActiveInstance("spin", instanceIndex, (instance) => {
      const exists = instance.spinTargets.some(
        (target) => target.tokenIndex === tokenIndex,
      );
      return {
        ...instance,
        spinTargets: exists
          ? instance.spinTargets.filter(
              (target) => target.tokenIndex !== tokenIndex,
            )
          : [...instance.spinTargets, { tokenIndex }],
      };
    });
  }

  function handleToggleDragTarget(
    mechanic: GameplayMechanic,
    instanceIndex: number,
    tokenIndex: number,
  ) {
    if (mechanic !== "drag") return;

    updateActiveInstance("drag", instanceIndex, (instance) => {
      const exists = instance.dragTargets.some(
        (target) => target.tokenIndex === tokenIndex,
      );
      return {
        ...instance,
        dragTargets: exists
          ? instance.dragTargets.filter(
              (target) => target.tokenIndex !== tokenIndex,
            )
          : [...instance.dragTargets, { tokenIndex }],
      };
    });
  }

  function handleBackToSongChoice() {
    router.push(`${navBasePath}/song-choice`);
  }

  async function handleSaveToSupabase() {
    if (!selectedSongStorage) {
      setSaveStatus("No selected song asset is loaded.");
      return;
    }

    setIsSaving(true);
    setSaveStatus("Saving...");

    try {
      const chartText = project ? projectToChart(project) : chartFile;
      const sidecarJson = projectToSidecarJson(sidecar);

      const response = await fetch("/api/lesson-builder/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          songAssetId: selectedSongStorage.id,
          chart: {
            ...selectedSongStorage.chart,
            content: chartText,
            contentType:
              selectedSongStorage.chart.contentType ??
              "text/plain;charset=utf-8",
          },
          sidecar: {
            ...(selectedSongStorage.sidecar ?? {
              bucket: selectedSongStorage.chart.bucket,
              path: selectedSongStorage.chart.path.replace(
                /\.chart$/i,
                ".json",
              ),
              contentType: "application/json;charset=utf-8",
            }),
            content: sidecarJson,
            contentType:
              selectedSongStorage.sidecar?.contentType ??
              "application/json;charset=utf-8",
          },
        }),
      });

      const result = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;
      if (!response.ok) {
        throw new Error(result?.error ?? "Unable to save lesson files");
      }

      setSaveStatus("Saved");
    } catch (error) {
      setSaveStatus(
        error instanceof Error ? error.message : "Unable to save lesson files",
      );
    } finally {
      setIsSaving(false);
    }
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

    if (!raw) return;

    try {
      const selectedSong: SelectedSongPayload = JSON.parse(raw);
      const selectedSongEventCounts = getSelectedSongEventCounts(selectedSong);
      console.log("Lesson builder selected song event counts:", {
  selectedSong,
  selectedSongEventCounts,
});

      setSelectedSongStorage({
        id: selectedSong.id,
        chart: {
          bucket: selectedSong.chart.bucket,
          path: selectedSong.chart.path,
          contentType: selectedSong.chart.contentType,
        },
        sidecar: selectedSong.sidecar
          ? {
              bucket: selectedSong.sidecar.bucket,
              path: selectedSong.sidecar.path,
              contentType: selectedSong.sidecar.contentType,
            }
          : null,
      });

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
        .then((file) => setPendingSongFile(file))
        .catch((error) =>
          console.error("Failed to load selected song file", error),
        );

console.log("Creating timeline slots before chart fetch:", {
  selectedSongEventCounts,
});

loadSidecarIntoTimeline(emptySidecar, selectedSongEventCounts);

      Promise.all([
        textFromSignedUrl(selectedSong.chart.signedUrl),
        selectedSong.sidecar
          ? jsonFromSignedUrl(selectedSong.sidecar.signedUrl)
          : Promise.resolve(null),
      ])
        .then(([nextChartFile, sidecarJson]) => {
          const nextChartName =
            selectedSong.chart.path.split("/").pop() ?? "selected.chart";
          const normalizedSidecar = normalizeSidecar(
            sidecarJson ?? emptySidecar,
          );

          setChartFile(nextChartFile);
          setUploadedChartName(nextChartName);
          loadSidecarIntoTimeline(normalizedSidecar, selectedSongEventCounts);

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
          setLoadError(
            error instanceof Error
              ? error.message
              : "Failed to load selected song package",
          );
        });
    } catch (error) {
      console.error("Failed to parse selected song package", error);
      setLoadError(
        error instanceof Error
          ? error.message
          : "Failed to parse selected song package",
      );
    }
  }, [setProject]);

useEffect(() => {
  const selectedSongRaw = sessionStorage.getItem("ultrarapid_selected_song");

  if (selectedSongRaw) {
    sessionStorage.removeItem("ultrarapid_editor_payload");
    return;
  }

  const raw = sessionStorage.getItem("ultrarapid_editor_payload");
  if (!raw) return;

  try {
    const payload: LessonBuilderPayload = JSON.parse(raw);
    const normalizedSidecar = normalizeSidecar(
      payload.rawResults ?? emptySidecar,
    );

    if (payload?.analysisMetadata) setMetadata(payload.analysisMetadata);

    if (payload?.chartFile) {
      setChartFile(payload.chartFile);
      if (payload.analysisMetadata?.uploadedFileName) {
        setUploadedChartName(payload.analysisMetadata.uploadedFileName);
      }
      loadSidecarIntoTimeline(normalizedSidecar, eventCounts);
      setProject(
        chartToProject({ ...payload, rawResults: normalizedSidecar }),
      );
    } else {
      loadSidecarIntoTimeline(normalizedSidecar, eventCounts);
    }

    sessionStorage.removeItem("ultrarapid_editor_payload");
  } catch (error) {
    console.error("Failed to hydrate lesson builder payload", error);
    setLoadError(
      error instanceof Error
        ? error.message
        : "Failed to hydrate lesson builder payload",
    );
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
      timelineEvents: timelineEvents.length,
    });
  }, [
    chartFile,
    uploadedChartName,
    uploadedSongName,
    metadata,
    timelineEvents.length,
  ]);

  useEffect(() => {
    if (!activeEventId && timelineEvents.length > 0) {
      setActiveEventId(timelineEvents[0].id);
    }
  }, [activeEventId, timelineEvents]);

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
      <EditorActionBar
        saveStatus={loadError || saveStatus}
        isSaving={isSaving}
        onBack={handleBackToSongChoice}
        onSave={handleSaveToSupabase}
      />
      <main
        style={{
          width: "100%",
          height: "calc(100vh - 142px)",
          display: "flex",
          alignItems: "stretch",
          background: pageBackgroundColor,
          color: textColor,
          overflow: "hidden",
        }}
      >
        <EquationsPanel
          savedEquations={savedEquations}
          onNewEquation={handleNewEquation}
        />
        <CenterEditorPanel
          mode={mode}
          timelineEvents={timelineEvents}
          activeEventId={activeEventId}
          draftTokens={draftTokens}
          customTokenLabel={customTokenLabel}
          onCustomTokenLabelChange={setCustomTokenLabel}
          onSelectEvent={handleSelectEvent}
          onInsertToken={handleInsertEquationToken}
          onRemoveToken={handleRemoveEquationToken}
          onSaveEquation={handleSaveEquation}
          onDropEquation={handleDropEquation}
          onAddHitBubblePair={handleAddHitBubblePair}
          onToggleSpinTarget={handleToggleSpinTarget}
          onToggleDragTarget={handleToggleDragTarget}
        />
        <RightLessonPanel />
      </main>
    </div>
  );
}