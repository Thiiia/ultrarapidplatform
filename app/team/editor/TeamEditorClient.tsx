"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { ChangeEvent, DragEvent, FC, RefObject, SVGProps } from "react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  useEditorStore,
  type SidecarPayload as StoreSidecarPayload,
} from "@/lib/editor/editor-store";
import { chartToProject } from "@/lib/editor/chart-to-project";
import {
  projectToChart,
  projectToSidecarJson,
} from "@/lib/editor/project-to-chart";
import { persistLaunchParams } from "@/lib/launch-handoff";
import { loadSongPackageAssets } from "@/lib/editor/song-package";
import { createSongLaunchSearchParams } from "@/lib/platform-launch";
import {
  inferSongActivityKeyFromChartPath,
  resolveSongAssetStoragePaths,
  type SongActivityKey,
} from "@/lib/song-activity-storage";
import type { SongChoice } from "@/lib/song-storage";
import styles from "../../student/student.module.css";

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
  activityKey?: SongActivityKey;
  name: string;
  title?: string;
  artist?: string | null;
  equationSlots?: unknown;
  equation_slots?: unknown;
  equationSlotTicks?: unknown;
  equation_slot_ticks?: unknown;
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
    equationSlots?: unknown;
    equation_slots?: unknown;
    equationSlotTicks?: unknown;
    equation_slot_ticks?: unknown;
    hitCounts?: unknown;
    hit_counts?: unknown;
    hit_count?: unknown;
    spinCounts?: unknown;
    spin_counts?: unknown;
    spin_count?: unknown;
    dragCounts?: unknown;
    drag_counts?: unknown;
    drag_count?: unknown;
  } | null;
  song_asset?: {
    equationSlots?: unknown;
    equation_slots?: unknown;
    equationSlotTicks?: unknown;
    equation_slot_ticks?: unknown;
    hitCounts?: unknown;
    hit_counts?: unknown;
    hit_count?: unknown;
    spinCounts?: unknown;
    spin_counts?: unknown;
    spin_count?: unknown;
    dragCounts?: unknown;
    drag_counts?: unknown;
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

type HitBubblePad =
  | "topLeft"
  | "topRight"
  | "left"
  | "right"
  | "bottomLeft"
  | "bottomRight";

type HitBubblePlacement = {
  tokenIndex: number;
  positions: HitBubblePad[];
  pads: HitBubblePad[];
};

type SpinTarget = {
  tokenIndex: number;
};

type DragTarget = {
  tokenIndex: number;
};

type HitBubblePair = "topLeftBottomRight" | "topRightBottomLeft" | "leftRight";

type MechanicInstanceState = {
  id: string;
  hitBubbles: HitBubblePlacement[];
  spinTargets: SpinTarget[];
  dragTargets: DragTarget[];
};

type MechanicCounts = Record<GameplayMechanic, number>;

type TimelineEventSlot = {
  id: string;
  tick: number;
  counts: MechanicCounts;
  assignments: Record<GameplayMechanic, SavedEquation | null>;
  mechanicInstances: Record<GameplayMechanic, MechanicInstanceState[]>;
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

type TeamSongChoice = SongChoice & {
  equation_slots?: number | string | null;
  equationSlots?: number | string | null;
  equation_slot_ticks?: unknown;
  equationSlotTicks?: unknown;
  hit_counts?: unknown;
  hitCounts?: unknown;
  spin_counts?: unknown;
  spinCounts?: unknown;
  drag_counts?: unknown;
  dragCounts?: unknown;
  songAsset?: {
    equation_slots?: number | string | null;
    equationSlots?: number | string | null;
    equation_slot_ticks?: unknown;
    equationSlotTicks?: unknown;
    hit_counts?: unknown;
    hitCounts?: unknown;
    spin_counts?: unknown;
    spinCounts?: unknown;
    drag_counts?: unknown;
    dragCounts?: unknown;
  } | null;
  song_asset?: {
    equation_slots?: number | string | null;
    equationSlots?: number | string | null;
    equation_slot_ticks?: unknown;
    equationSlotTicks?: unknown;
    hit_counts?: unknown;
    hitCounts?: unknown;
    spin_counts?: unknown;
    spinCounts?: unknown;
    drag_counts?: unknown;
    dragCounts?: unknown;
  } | null;
};

type LessonBuilderClientProps = {
  navBasePath?: string;
  songs?: SelectedSongPayload[];
};

type EditorWorkspaceMode = "equationEditor" | "chartEditor";


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

function formatEditorTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) {
    return "0:00.000";
  }

  const minutes = Math.floor(seconds / 60);
  const wholeSeconds = Math.floor(seconds % 60);
  const milliseconds = Math.floor((seconds % 1) * 1000);

  return `${minutes}:${String(wholeSeconds).padStart(2, "0")}.${String(
    milliseconds,
  ).padStart(3, "0")}`;
}

function getMaxTimelineTick(events: TimelineEventSlot[]) {
  return events.reduce((maxTick, eventSlot) => Math.max(maxTick, eventSlot.tick), 0);
}

function getChartEditorTick(
  currentTime: number,
  duration: number,
  events: TimelineEventSlot[],
) {
  const maxTick = getMaxTimelineTick(events);

  if (duration > 0 && maxTick > 0) {
    return Math.max(0, Math.round((currentTime / duration) * maxTick));
  }

  return Math.max(0, Math.round(currentTime * 1000));
}

function getEventAtOrBeforeTick(events: TimelineEventSlot[], tick: number) {
  return [...events]
    .filter((eventSlot) => eventSlot.tick <= tick)
    .sort((left, right) => right.tick - left.tick)[0] ?? null;
}

function getEventsAtTick(events: TimelineEventSlot[], tick: number) {
  return events.filter((eventSlot) => eventSlot.tick === tick);
}

function getChartLinesForTick(chartText: string, tick: number) {
  if (!chartText.trim()) {
    return [];
  }

  const tickText = String(tick);

  return chartText
    .split(/\r?\n/)
    .filter((line) => line.includes(tickText))
    .slice(0, 8);
}

function normalizePromptedCount(value: string | null) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed < 0) {
    return 0;
  }

  return Math.round(parsed);
}

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

function normalizeTokenIndex(value: unknown) {
  const tokenIndex = Number(value);

  if (!Number.isFinite(tokenIndex) || tokenIndex < 0) {
    return null;
  }

  return Math.floor(tokenIndex);
}

function normalizeHitBubblePad(value: unknown): HitBubblePad | null {
  if (
    value === "topLeft" ||
    value === "topRight" ||
    value === "left" ||
    value === "right" ||
    value === "bottomLeft" ||
    value === "bottomRight"
  ) {
    return value;
  }

  return null;
}

function normalizeHitBubblePlacements(value: unknown): HitBubblePlacement[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((placement): HitBubblePlacement[] => {
    if (!isObject(placement)) {
      return [];
    }

    const tokenIndex = normalizeTokenIndex(placement.tokenIndex);
    const rawPads = Array.isArray(placement.pads)
      ? placement.pads
      : Array.isArray(placement.positions)
        ? placement.positions
        : [];
    const pads = Array.from(
      new Set(
        rawPads.flatMap((pad) => {
          const normalizedPad = normalizeHitBubblePad(pad);
          return normalizedPad ? [normalizedPad] : [];
        }),
      ),
    );

    if (tokenIndex === null || pads.length === 0) {
      return [];
    }

    return [{ tokenIndex, positions: pads, pads }];
  });
}

function normalizeTokenTargets<T extends SpinTarget | DragTarget>(
  value: unknown,
): T[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((target): T[] => {
    if (!isObject(target)) {
      return [];
    }

    const tokenIndex = normalizeTokenIndex(target.tokenIndex);

    if (tokenIndex === null) {
      return [];
    }

    return [{ tokenIndex } as T];
  });
}

function normalizeSidecar(value: unknown): SidecarPayload {
  if (!isObject(value)) {
    return emptySidecar;
  }

  if (value.version === 2 && Array.isArray(value.equations)) {
    const events = value.equations.flatMap(
      (equation, equationIndex): SidecarEvent[] => {
        if (!isObject(equation)) {
          return [];
        }

        const tick = normalizeTick(equation.tick);
        const equationId =
          typeof equation.id === "string" && equation.id.trim()
            ? equation.id
            : `eq_${String(equationIndex + 1).padStart(3, "0")}`;
        const state = typeof equation.state === "string" ? equation.state : "";
        const counts = isObject(equation.counts) ? equation.counts : {};
        const result: SidecarEvent[] = [];

        gameplayMechanics.forEach((mechanic) => {
          const count = Math.max(0, Math.round(Number(counts[mechanic] ?? 0)));
          const rawInstances: unknown[] = Array.isArray(
            equation[`${mechanic}s`],
          )
            ? (equation[`${mechanic}s`] as unknown[])
            : [];

          for (let index = 0; index < count; index += 1) {
            const rawInstance = rawInstances[index];
            const instance = isObject(rawInstance) ? rawInstance : {};
            const mechanicEvent: SidecarMechanicEvent = {
              tick,
              type: "ALG_MECHANIC",
              mechanic,
              instanceIndex: index,
              equationId,
            };

            if (mechanic === "hit") {
              mechanicEvent.hits = 1;
              mechanicEvent.hitBubbles = normalizeHitBubblePlacements(
                instance.bubbles,
              );
            }

            if (mechanic === "spin") {
              mechanicEvent.spinTargets = normalizeTokenTargets<SpinTarget>(
                instance.targets,
              );
            }

            if (mechanic === "drag") {
              mechanicEvent.dragTargets = normalizeTokenTargets<DragTarget>(
                instance.targets,
              );
            }

            result.push(mechanicEvent);
          }
        });

        if (state.trim()) {
          result.push({
            tick,
            type: "ALG_EQUATION_STATE",
            equationId,
            state,
          });
        }

        return result;
      },
    );

    return {
      version: 1,
      events: sortEvents(events),
    };
  }

  if (!Array.isArray(value.events)) {
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
          instanceIndex: normalizeTokenIndex(event.instanceIndex) ?? undefined,
          equationId:
            typeof event.equationId === "string" ? event.equationId : undefined,
          ...(Number.isFinite(hits) && hits > 0
            ? { hits: Math.max(1, Math.round(hits)) }
            : {}),
          hitBubbles: normalizeHitBubblePlacements(event.hitBubbles),
          spinTargets: normalizeTokenTargets<SpinTarget>(event.spinTargets),
          dragTargets: normalizeTokenTargets<DragTarget>(event.dragTargets),
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

  return {
    version: 1,
    events: sortEvents(events),
  };
}

function sortEvents(events: SidecarEvent[]) {
  return [...events].sort((left, right) => {
    if (left.tick !== right.tick) {
      return left.tick - right.tick;
    }

    if (left.type !== right.type) {
      return left.type.localeCompare(right.type);
    }

    const leftMechanic = left.type === "ALG_MECHANIC" ? left.mechanic : "";
    const rightMechanic = right.type === "ALG_MECHANIC" ? right.mechanic : "";

    return leftMechanic.localeCompare(rightMechanic);
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
    .map((label) => ({
      id: makeId("token"),
      label,
    }));
}

function makeEmptyAssignments(): Record<
  GameplayMechanic,
  SavedEquation | null
> {
  return {
    hit: null,
    spin: null,
    drag: null,
  };
}

function makeEmptyMechanicCounts(): MechanicCounts {
  return {
    hit: 0,
    spin: 0,
    drag: 0,
  };
}

function makeMechanicInstance(): MechanicInstanceState {
  return {
    id: makeId("mechanic"),
    hitBubbles: [],
    spinTargets: [],
    dragTargets: [],
  };
}

function makeMechanicInstances(count: number) {
  return Array.from({ length: Math.max(0, Math.round(count)) }, () =>
    makeMechanicInstance(),
  );
}

function resizeMechanicInstances(
  instances: MechanicInstanceState[] | undefined,
  count: number,
) {
  const safeCount = Math.max(0, Math.round(count));
  const next = (instances ?? []).slice(0, safeCount);

  while (next.length < safeCount) {
    next.push(makeMechanicInstance());
  }

  return next;
}

function getTimelineEventEquation(eventSlot: TimelineEventSlot) {
  return (
    eventSlot.assignments.hit ??
    eventSlot.assignments.spin ??
    eventSlot.assignments.drag ??
    null
  );
}

function cloneEquationForAssignment(equation: SavedEquation): SavedEquation {
  return {
    ...equation,
    tokens: cloneTokens(equation.tokens),
  };
}

function makeTimelineEvent(
  index: number,
  tick = 0,
  counts: Partial<MechanicCounts> = {},
): TimelineEventSlot {
  const normalizedCounts = {
    ...makeEmptyMechanicCounts(),
    ...counts,
  };

  return {
    id: makeId("event"),
    tick,
    counts: normalizedCounts,
    assignments: makeEmptyAssignments(),
    mechanicInstances: {
      hit: makeMechanicInstances(normalizedCounts.hit),
      spin: makeMechanicInstances(normalizedCounts.spin),
      drag: makeMechanicInstances(normalizedCounts.drag),
    },
  };
}

function normalizeEquationSlotCount(value: unknown): number | null {
  const count = Number(value);

  if (!Number.isFinite(count) || count < 0) {
    return null;
  }

  return Math.round(count);
}

function getSelectedSongEquationSlotCount(
  selectedSong: SelectedSongPayload,
): number | null {
  return (
    normalizeEquationSlotCount(selectedSong.equationSlots) ??
    normalizeEquationSlotCount(selectedSong.equation_slots) ??
    normalizeEquationSlotCount(selectedSong.songAsset?.equationSlots) ??
    normalizeEquationSlotCount(selectedSong.songAsset?.equation_slots) ??
    normalizeEquationSlotCount(selectedSong.song_asset?.equationSlots) ??
    normalizeEquationSlotCount(selectedSong.song_asset?.equation_slots)
  );
}

function normalizeIntegerArray(value: unknown): number[] {
  if (Array.isArray(value)) {
    return value.flatMap((item) => {
      const parsed = Number(item);
      return Number.isFinite(parsed) ? [Math.max(0, Math.round(parsed))] : [];
    });
  }

  if (typeof value === "string") {
    const trimmed = value.trim();

    if (!trimmed) {
      return [];
    }

    if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
      try {
        return normalizeIntegerArray(JSON.parse(trimmed));
      } catch {
        return [];
      }
    }

    if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
      return normalizeIntegerArray(
        trimmed
          .slice(1, -1)
          .split(",")
          .map((item) => item.trim()),
      );
    }

    return normalizeIntegerArray(trimmed.split(","));
  }

  return [];
}

function getSelectedSongMechanicCountArray(
  selectedSong: SelectedSongPayload,
  mechanic: GameplayMechanic,
) {
  const camelKey = `${mechanic}Counts` as keyof SelectedSongPayload;
  const snakePluralKey = `${mechanic}_counts` as keyof SelectedSongPayload;
  const snakeSingularKey = `${mechanic}_count` as keyof SelectedSongPayload;

  const candidates = [
    selectedSong[camelKey],
    selectedSong[snakePluralKey],
    selectedSong[snakeSingularKey],
    selectedSong.songAsset?.[
    camelKey as keyof NonNullable<SelectedSongPayload["songAsset"]>
    ],
    selectedSong.songAsset?.[
    snakePluralKey as keyof NonNullable<SelectedSongPayload["songAsset"]>
    ],
    selectedSong.songAsset?.[
    snakeSingularKey as keyof NonNullable<SelectedSongPayload["songAsset"]>
    ],
    selectedSong.song_asset?.[
    camelKey as keyof NonNullable<SelectedSongPayload["song_asset"]>
    ],
    selectedSong.song_asset?.[
    snakePluralKey as keyof NonNullable<SelectedSongPayload["song_asset"]>
    ],
    selectedSong.song_asset?.[
    snakeSingularKey as keyof NonNullable<SelectedSongPayload["song_asset"]>
    ],
  ];

  for (const candidate of candidates) {
    const normalized = normalizeIntegerArray(candidate);

    if (normalized.length > 0) {
      return normalized;
    }
  }

  return [];
}

function getSelectedSongEquationSlotTicks(
  selectedSong: SelectedSongPayload,
  slotCount: number,
) {
  const candidates = [
    selectedSong.equationSlotTicks,
    selectedSong.equation_slot_ticks,
    selectedSong.songAsset?.equationSlotTicks,
    selectedSong.songAsset?.equation_slot_ticks,
    selectedSong.song_asset?.equationSlotTicks,
    selectedSong.song_asset?.equation_slot_ticks,
  ];

  for (const candidate of candidates) {
    const normalized = normalizeIntegerArray(candidate);

    if (normalized.length > 0) {
      return Array.from(
        { length: slotCount },
        (_, index) => normalized[index] ?? 0,
      );
    }
  }

  return Array.from({ length: slotCount }, () => 0);
}

function getSelectedSongEventCounts(
  selectedSong: SelectedSongPayload,
): MechanicCounts[] {
  const explicitSlotCount = getSelectedSongEquationSlotCount(selectedSong) ?? 0;
  const hitCounts = getSelectedSongMechanicCountArray(selectedSong, "hit");
  const spinCounts = getSelectedSongMechanicCountArray(selectedSong, "spin");
  const dragCounts = getSelectedSongMechanicCountArray(selectedSong, "drag");
  const slotCount = Math.max(
    explicitSlotCount,
    hitCounts.length,
    spinCounts.length,
    dragCounts.length,
  );

  return Array.from({ length: slotCount }, (_, index) => ({
    hit: hitCounts[index] ?? 0,
    spin: spinCounts[index] ?? 0,
    drag: dragCounts[index] ?? 0,
  }));
}

function applySongAssetMechanicCountsToTimelineEvents(
  events: TimelineEventSlot[],
  eventCounts: MechanicCounts[],
  eventTicks: number[] = [],
): TimelineEventSlot[] {
  if (eventCounts.length === 0) {
    return events;
  }

  return eventCounts.map((counts, index) => {
    const existing = events[index];
    const tick = eventTicks[index] ?? existing?.tick ?? 0;
    const nextCounts = {
      ...makeEmptyMechanicCounts(),
      ...counts,
    };

    if (!existing) {
      return makeTimelineEvent(index, tick, nextCounts);
    }

    return {
      ...existing,
      tick,
      counts: nextCounts,
      mechanicInstances: {
        hit: resizeMechanicInstances(
          existing.mechanicInstances.hit,
          nextCounts.hit,
        ),
        spin: resizeMechanicInstances(
          existing.mechanicInstances.spin,
          nextCounts.spin,
        ),
        drag: resizeMechanicInstances(
          existing.mechanicInstances.drag,
          nextCounts.drag,
        ),
      },
    };
  });
}

function resizeTimelineEvents(
  events: TimelineEventSlot[],
  targetCount: number,
): TimelineEventSlot[] {
  const safeCount = Math.max(0, Math.round(targetCount));
  const nextEvents = events.slice(0, safeCount).map((eventSlot) => {
    const counts = {
      ...makeEmptyMechanicCounts(),
      ...(eventSlot.counts ?? {}),
    };

    return {
      ...eventSlot,
      counts,
      mechanicInstances: {
        hit: resizeMechanicInstances(
          eventSlot.mechanicInstances?.hit,
          counts.hit,
        ),
        spin: resizeMechanicInstances(
          eventSlot.mechanicInstances?.spin,
          counts.spin,
        ),
        drag: resizeMechanicInstances(
          eventSlot.mechanicInstances?.drag,
          counts.drag,
        ),
      },
    };
  });

  for (let index = nextEvents.length; index < safeCount; index += 1) {
    nextEvents.push(makeTimelineEvent(index));
  }

  return nextEvents;
}

function inferMechanicFromEquationId(
  equationId: string,
): GameplayMechanic | null {
  const normalizedId = equationId.toLowerCase();

  return (
    gameplayMechanics.find((mechanic) => normalizedId.includes(mechanic)) ??
    null
  );
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

function timelineEventsFromSidecar(
  sidecar: SidecarPayload,
  targetCount: number | null,
  fallbackEventCounts: MechanicCounts[] = [],
  fallbackEventTicks: number[] = [],
): TimelineEventSlot[] {
  const normalized = normalizeSidecar(sidecar);
  const equationEvents = normalized.events.filter(
    (event): event is SidecarEquationStateEvent =>
      event.type === "ALG_EQUATION_STATE",
  );
  const mechanicEvents = normalized.events.filter(
    (event): event is SidecarMechanicEvent => event.type === "ALG_MECHANIC",
  );

  const ticks = Array.from(
    new Set([
      ...mechanicEvents.map((event) => event.tick),
      ...equationEvents.map((event) => event.tick),
    ]),
  ).sort((left, right) => left - right);

  const slots = ticks.map((tick, index) => {
    const mechanicsAtTick = mechanicEvents.filter(
      (event) => event.tick === tick,
    );
    const equationsAtTick = equationEvents.filter(
      (event) => event.tick === tick,
    );
    const counts = makeEmptyMechanicCounts();

    mechanicsAtTick.forEach((mechanicEvent) => {
      if (mechanicEvent.mechanic === "hit") {
        counts.hit += Math.max(1, Math.round(Number(mechanicEvent.hits ?? 1)));
        return;
      }

      counts[mechanicEvent.mechanic] += 1;
    });

    const slot = makeTimelineEvent(index, tick, counts);
    const firstEquationEvent = equationsAtTick[0];

    if (firstEquationEvent) {
      const equation = savedEquationFromState(
        firstEquationEvent.equationId,
        firstEquationEvent.state,
      );

      gameplayMechanics.forEach((mechanic) => {
        if (slot.counts[mechanic] > 0) {
          slot.assignments[mechanic] = cloneEquationForAssignment(equation);
        }
      });
    }

    mechanicsAtTick.forEach((mechanicEvent) => {
      const instanceIndex = mechanicEvent.instanceIndex ?? 0;
      const instance =
        slot.mechanicInstances[mechanicEvent.mechanic]?.[instanceIndex];

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

    return slot;
  });

  const targetSlots =
    fallbackEventCounts.length > 0
      ? fallbackEventCounts.length
      : typeof targetCount === "number" && targetCount > 0
        ? targetCount
        : null;

  const resizedSlots =
    typeof targetSlots === "number"
      ? resizeTimelineEvents(slots, targetSlots)
      : slots;

  return applySongAssetMechanicCountsToTimelineEvents(
    resizedSlots,
    fallbackEventCounts,
    fallbackEventTicks,
  );
}

function savedEquationsFromTimelineEvents(events: TimelineEventSlot[]) {
  const byState = new Map<string, SavedEquation>();

  events.forEach((event) => {
    const equation = getTimelineEventEquation(event);
    const state = equation ? tokensToEquationState(equation.tokens) : "";

    if (!equation || !state || byState.has(state)) {
      return;
    }

    byState.set(state, {
      id: equation.id || makeId("equation"),
      tokens: cloneTokens(equation.tokens),
    });
  });

  return Array.from(byState.values());
}

function sidecarFromTimelineEvents(
  events: TimelineEventSlot[],
): SidecarPayload {
  const sidecarEvents = events.flatMap((event, eventIndex): SidecarEvent[] => {
    const equation = getTimelineEventEquation(event);
    const equationId = `eq_${String(eventIndex + 1).padStart(3, "0")}`;

    const mechanicEvents = gameplayMechanics.flatMap(
      (mechanic): SidecarEvent[] => {
        const count = event.counts?.[mechanic] ?? 0;

        if (count <= 0) {
          return [];
        }

        return Array.from({ length: count }, (_, instanceIndex) => {
          const instance = event.mechanicInstances?.[mechanic]?.[instanceIndex];
          const mechanicEvent: SidecarMechanicEvent = {
            tick: event.tick,
            type: "ALG_MECHANIC",
            mechanic,
            instanceIndex,
            ...(equation ? { equationId } : {}),
          };

          if (mechanic === "hit") {
            mechanicEvent.hits = 1;

            if (instance?.hitBubbles.length) {
              mechanicEvent.hitBubbles = instance.hitBubbles;
            }
          }

          if (mechanic === "spin" && instance?.spinTargets.length) {
            mechanicEvent.spinTargets = instance.spinTargets;
          }

          if (mechanic === "drag" && instance?.dragTargets.length) {
            mechanicEvent.dragTargets = instance.dragTargets;
          }

          return mechanicEvent;
        });
      },
    );

    if (mechanicEvents.length === 0) {
      return [];
    }

    if (!equation || equation.tokens.length === 0) {
      return mechanicEvents;
    }

    return [
      ...mechanicEvents,
      {
        tick: event.tick,
        type: "ALG_EQUATION_STATE",
        equationId,
        state: tokensToEquationState(equation.tokens),
      },
    ];
  });

  return {
    version: 1,
    events: sortEvents(sidecarEvents),
  };
}

function fileFromBlob({
  blob,
  path,
  name,
  contentType,
}: {
  blob: Blob;
  path: string;
  name: string;
  contentType: string | null;
}) {
  const extension = path.split(".").pop();
  const fileName = extension ? `${name}.${extension}` : name;

  return new File([blob], fileName, {
    type: contentType ?? blob.type,
  });
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

  return fileFromBlob({
    blob: await response.blob(),
    path,
    name,
    contentType,
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

function EditorToolbarButton({
  children,
  onClick,
  disabled = false,
  title,
}: {
  children: string;
  onClick: () => void;
  disabled?: boolean;
  title?: string;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      title={title}
      style={{
        minWidth: 132,
        height: 40,
        background: disabled ? "#252525" : "#CFFF04",
        color: disabled ? "#FFFFFF80" : "#000000",
        border: `1px solid ${disabled ? subtleBorderColor : "#CFFF04"}`,
        borderRadius: 10,
        fontFamily: "Space Grotesk, sans-serif",
        fontSize: 12,
        fontWeight: 900,
        cursor: disabled ? "not-allowed" : "pointer",
        padding: "0 14px",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </button>
  );
}

function EditorActionBar({
  saveStatus,
  isSaving,
  onSave,
  onUploadSong,
  onUploadChart,
  onUploadSidecar,
  songs,
  onSelectSupabaseSong,
  canLaunch,
  onLaunch,
}: {
  saveStatus: string;
  isSaving: boolean;
  onSave: () => void;
  onUploadSong: (file: File) => void;
  onUploadChart: (file: File) => void;
  onUploadSidecar: (file: File) => void;
  songs: SelectedSongPayload[];
  onSelectSupabaseSong: (song: SelectedSongPayload) => void;
  canLaunch: boolean;
  onLaunch: () => void;
}) {
  const songInputRef = useRef<HTMLInputElement | null>(null);
  const chartInputRef = useRef<HTMLInputElement | null>(null);
  const sidecarInputRef = useRef<HTMLInputElement | null>(null);
  const [isSongPickerOpen, setIsSongPickerOpen] = useState(false);
  const [songSearchQuery, setSongSearchQuery] = useState("");

  const filteredSongs = useMemo(() => {
    const query = songSearchQuery.trim().toLowerCase();

    if (!query) {
      return songs;
    }

    return songs.filter((song) => {
      return (
        song.name.toLowerCase().includes(query) ||
        song.song.path.toLowerCase().includes(query) ||
        song.artist?.toLowerCase().includes(query)
      );
    });
  }, [songSearchQuery, songs]);

  return (
    <section
      aria-label="Team editor actions"
      style={{
        width: "100%",
        minHeight: 72,
        background: pageBackgroundColor,
        borderBottom: `1px solid ${subtleBorderColor}`,
        boxSizing: "border-box",
        color: textColor,
        fontFamily: "Space Grotesk, sans-serif",
        position: "relative",
      }}
    >
      <input
        ref={songInputRef}
        type="file"
        accept="audio/*,.mp3,.ogg,.wav,.m4a,.aac,.flac"
        style={{ display: "none" }}
        onChange={(event) => {
          const file = event.target.files?.[0];

          if (file) {
            onUploadSong(file);
          }

          event.target.value = "";
        }}
      />

      <input
        ref={chartInputRef}
        type="file"
        accept=".chart,text/plain"
        style={{ display: "none" }}
        onChange={(event) => {
          const file = event.target.files?.[0];

          if (file) {
            onUploadChart(file);
          }

          event.target.value = "";
        }}
      />

      <input
        ref={sidecarInputRef}
        type="file"
        accept=".json,application/json"
        style={{ display: "none" }}
        onChange={(event) => {
          const file = event.target.files?.[0];

          if (file) {
            onUploadSidecar(file);
          }

          event.target.value = "";
        }}
      />

      <div
        style={{
          width: pagePanelWidth,
          minHeight: 72,
          margin: "0 auto",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            minWidth: 0,
            overflowX: "auto",
          }}
        >
          <EditorToolbarButton onClick={() => songInputRef.current?.click()}>
            Upload Song
          </EditorToolbarButton>

          <EditorToolbarButton onClick={() => chartInputRef.current?.click()}>
            Upload .chart
          </EditorToolbarButton>

          <EditorToolbarButton onClick={() => sidecarInputRef.current?.click()}>
            Upload Sidecar JSON
          </EditorToolbarButton>

          <EditorToolbarButton
            onClick={() => setIsSongPickerOpen(true)}
            disabled={songs.length === 0}
            title={
              songs.length === 0
                ? "No Supabase songs were passed into TeamEditorClient."
                : "Choose a song from Supabase."
            }
          >
            Download Song
          </EditorToolbarButton>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            flexShrink: 0,
          }}
        >
          <div
            aria-live="polite"
            style={{
              maxWidth: 280,
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

          <EditorToolbarButton
            onClick={onLaunch}
            disabled={!canLaunch}
            title={
              canLaunch
                ? "Launch the selected song in the game."
                : "Choose a Supabase song before launching the game."
            }
          >
            Play selected song
          </EditorToolbarButton>

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
      </div>

      {isSongPickerOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Choose a song from Supabase"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.64)",
            zIndex: 100,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
            boxSizing: "border-box",
          }}
        >
          <div
            style={{
              width: "min(760px, 92vw)",
              maxHeight: "78vh",
              background: "#2B2B2B",
              border: `1px solid ${subtleBorderColor}`,
              borderRadius: 18,
              boxShadow: "0 24px 80px rgba(0,0,0,0.46)",
              display: "grid",
              gridTemplateRows: "auto auto 1fr auto",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                padding: "18px 20px",
                borderBottom: `1px solid ${subtleBorderColor}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 14,
              }}
            >
              <div
                style={{
                  color: "#FFFFFF",
                  fontSize: 16,
                  fontWeight: 900,
                }}
              >
                Download Song
              </div>

              <button
                type="button"
                onClick={() => setIsSongPickerOpen(false)}
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 999,
                  border: `1px solid ${subtleBorderColor}`,
                  background: "#191919",
                  color: "#FFFFFF",
                  cursor: "pointer",
                  fontSize: 18,
                  fontWeight: 900,
                }}
                aria-label="Close song picker"
              >
                ×
              </button>
            </div>

            <div
              style={{
                padding: 16,
                borderBottom: `1px solid ${subtleBorderColor}`,
              }}
            >
              <input
                type="search"
                value={songSearchQuery}
                onChange={(event) => setSongSearchQuery(event.target.value)}
                placeholder="Search songs"
                aria-label="Search songs"
                style={{
                  width: "100%",
                  height: 42,
                  background: "#191919",
                  border: `1px solid ${subtleBorderColor}`,
                  borderRadius: 12,
                  color: "#FFFFFF",
                  fontFamily: "Space Grotesk, sans-serif",
                  fontSize: 13,
                  fontWeight: 700,
                  outline: "none",
                  padding: "0 14px",
                  boxSizing: "border-box",
                }}
              />
            </div>

            <div
              style={{
                overflowY: "auto",
                padding: 12,
                display: "grid",
                gap: 8,
              }}
            >
              {filteredSongs.length === 0 ? (
                <div
                  style={{
                    padding: 18,
                    color: "#FFFFFF80",
                    fontSize: 13,
                    fontWeight: 700,
                  }}
                >
                  No songs found.
                </div>
              ) : (
                filteredSongs.map((song) => (
                  <button
                    key={song.id}
                    type="button"
                    onClick={() => {
                      onSelectSupabaseSong(song);
                      setIsSongPickerOpen(false);
                    }}
                    style={{
                      width: "100%",
                      minHeight: 58,
                      background: "#191919",
                      color: "#FFFFFF",
                      border: `1px solid ${subtleBorderColor}`,
                      borderRadius: 12,
                      padding: "10px 14px",
                      cursor: "pointer",
                      display: "grid",
                      gridTemplateColumns: "minmax(0, 1fr) auto",
                      gap: 12,
                      textAlign: "left",
                    }}
                  >
                    <span
                      style={{
                        minWidth: 0,
                        display: "grid",
                        gap: 3,
                      }}
                    >
                      <span
                        style={{
                          fontSize: 14,
                          fontWeight: 900,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {song.name}
                      </span>

                      <span
                        style={{
                          color: "#FFFFFF99",
                          fontSize: 11,
                          fontWeight: 700,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {song.artist ?? "Unknown artist"} · {song.song.path}
                      </span>
                    </span>

                    <span
                      style={{
                        color: "#CFFF04",
                        fontSize: 12,
                        fontWeight: 900,
                        alignSelf: "center",
                      }}
                    >
                      Select
                    </span>
                  </button>
                ))
              )}
            </div>

            <div
              style={{
                padding: 14,
                borderTop: `1px solid ${subtleBorderColor}`,
                color: "#FFFFFF80",
                fontSize: 11,
                fontWeight: 700,
              }}
            >
              Selecting a song loads its audio, .chart file, and sidecar JSON if
              those files exist.
            </div>
          </div>
        </div>
      ) : null}
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
        fontFamily: "Space Grotesk, sans-serif",
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

function getEquationEditorTokenSize(label: string) {
  return isEquationOperator(label) ? 34 : 68;
}

function EquationInsertionSlot({
  index,
  isActive,
  onHover,
  onLeave,
  onInsertToken,
}: {
  index: number;
  isActive: boolean;
  onHover: (index: number) => void;
  onLeave: () => void;
  onInsertToken: (index: number, label: string) => void;
}) {
  function acceptsPaletteToken(event: DragEvent<HTMLElement>) {
    return Array.from(event.dataTransfer.types).includes(
      "application/x-equation-token",
    );
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();

    const rawToken = event.dataTransfer.getData("application/x-equation-token");

    if (!rawToken) {
      onLeave();
      return;
    }

    try {
      const parsed = JSON.parse(rawToken) as { label?: string };

      if (parsed.label) {
        onInsertToken(index, parsed.label);
      }
    } catch (error) {
      console.error("Failed to drop equation token", error);
    } finally {
      onLeave();
    }
  }

  return (
    <span
      onDragEnter={(event) => {
        if (!acceptsPaletteToken(event)) return;
        event.preventDefault();
        onHover(index);
      }}
      onDragOver={(event) => {
        if (!acceptsPaletteToken(event)) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = "copy";
        onHover(index);
      }}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          onLeave();
        }
      }}
      onDrop={handleDrop}
      style={{
        width: isActive ? 74 : 10,
        height: 82,
        borderRadius: 999,
        background: isActive ? "rgba(207, 255, 4, 0.16)" : "transparent",
        outline: isActive ? "2px solid rgba(207, 255, 4, 0.48)" : "none",
        boxSizing: "border-box",
        transition: "width 140ms ease, background 140ms ease, outline 140ms ease",
        flexShrink: 0,
      }}
      aria-label={`Drop token at position ${index + 1}`}
    />
  );
}

function DraftEquationToken({
  token,
}: {
  token: EquationToken;
}) {
  const tokenSize = getEquationEditorTokenSize(token.label);

  return (
    <span
      draggable
      onDragStart={(event) => {
        event.dataTransfer.setData(
          "application/x-draft-equation-token",
          JSON.stringify({ id: token.id }),
        );
        event.dataTransfer.effectAllowed = "move";
      }}
      title="Drag to the trash to delete"
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 68,
        height: 68,
        cursor: "grab",
        flexShrink: 0,
      }}
    >
      <EquationCircle
        label={token.label}
        draggable={false}
        size={tokenSize}
      />
    </span>
  );
}

function EquationTrashDropZone({
  isActive,
  onActiveChange,
  onRemoveToken,
}: {
  isActive: boolean;
  onActiveChange: (isActive: boolean) => void;
  onRemoveToken: (id: string) => void;
}) {
  function acceptsDraftToken(event: DragEvent<HTMLElement>) {
    return Array.from(event.dataTransfer.types).includes(
      "application/x-draft-equation-token",
    );
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();

    const rawToken = event.dataTransfer.getData(
      "application/x-draft-equation-token",
    );

    if (!rawToken) {
      onActiveChange(false);
      return;
    }

    try {
      const parsed = JSON.parse(rawToken) as { id?: string };

      if (parsed.id) {
        onRemoveToken(parsed.id);
      }
    } catch (error) {
      console.error("Failed to delete draft equation token", error);
    } finally {
      onActiveChange(false);
    }
  }

  return (
    <div
      onDragEnter={(event) => {
        if (!acceptsDraftToken(event)) return;
        event.preventDefault();
        onActiveChange(true);
      }}
      onDragOver={(event) => {
        if (!acceptsDraftToken(event)) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
        onActiveChange(true);
      }}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          onActiveChange(false);
        }
      }}
      onDrop={handleDrop}
      title="Drag tokens here to delete them"
      style={{
        position: "absolute",
        left: 18,
        bottom: 18,
        width: 62,
        height: 62,
        borderRadius: 18,
        background: isActive ? "rgba(255, 53, 53, 0.22)" : "#111111",
        border: `2px solid ${isActive ? "rgba(255, 53, 53, 0.72)" : "rgba(255,255,255,0.18)"
          }`,
        boxShadow: isActive
          ? "0 0 26px rgba(255, 53, 53, 0.24)"
          : "0 12px 26px rgba(0,0,0,0.24)",
        color: "#FFFFFF",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 28,
        pointerEvents: "auto",
        transition: "background 140ms ease, border 140ms ease, box-shadow 140ms ease",
        zIndex: 30,
      }}
      aria-label="Trash. Drop a token here to delete it."
    >
      🗑
    </div>
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
          fontFamily: "Space Grotesk, sans-serif",
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
  const [hoveredInsertIndex, setHoveredInsertIndex] = useState<number | null>(
    null,
  );
  const [isTrashActive, setIsTrashActive] = useState(false);

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
          <span
            key={label}
            style={{
              width: 68,
              height: 68,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <EquationCircle
              label={label}
              size={getEquationEditorTokenSize(label)}
            />
          </span>
        ))}

        <CustomEquationCircle
          value={customTokenLabel}
          onChange={onCustomTokenLabelChange}
        />
      </div>

      <div
        style={{
          position: "relative",
          margin: 18,
          border: `1px solid ${subtleBorderColor}`,
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
        <EquationTrashDropZone
          isActive={isTrashActive}
          onActiveChange={setIsTrashActive}
          onRemoveToken={onRemoveToken}
        />

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 0,
            flexWrap: "wrap",
            padding: "44px 96px 84px",
            minHeight: 150,
          }}
        >
          {draftTokens.length === 0 ? (
            <div
              onDragOver={(event) => {
                if (
                  !Array.from(event.dataTransfer.types).includes(
                    "application/x-equation-token",
                  )
                ) {
                  return;
                }

                event.preventDefault();
                event.dataTransfer.dropEffect = "copy";
                setHoveredInsertIndex(0);
              }}
              onDrop={(event) => {
                event.preventDefault();

                const rawToken = event.dataTransfer.getData(
                  "application/x-equation-token",
                );

                if (!rawToken) {
                  setHoveredInsertIndex(null);
                  return;
                }

                try {
                  const parsed = JSON.parse(rawToken) as { label?: string };

                  if (parsed.label) {
                    onInsertToken(0, parsed.label);
                  }
                } catch (error) {
                  console.error("Failed to drop equation token", error);
                } finally {
                  setHoveredInsertIndex(null);
                }
              }}
              style={{
                minWidth: 260,
                minHeight: 96,
                borderRadius: 24,
                background:
                  hoveredInsertIndex === 0
                    ? "rgba(207, 255, 4, 0.12)"
                    : "transparent",
                color: "#FFFFFF66",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 13,
                fontWeight: 800,
                textAlign: "center",
                transition: "background 140ms ease",
              }}
            >
              Drag a token here to start the equation
            </div>
          ) : (
            <>
              <EquationInsertionSlot
                index={0}
                isActive={hoveredInsertIndex === 0}
                onHover={setHoveredInsertIndex}
                onLeave={() => setHoveredInsertIndex(null)}
                onInsertToken={onInsertToken}
              />

              {draftTokens.map((token, index) => (
                <span
                  key={token.id}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 0,
                  }}
                >
                  <DraftEquationToken token={token} />

                  <EquationInsertionSlot
                    index={index + 1}
                    isActive={hoveredInsertIndex === index + 1}
                    onHover={setHoveredInsertIndex}
                    onLeave={() => setHoveredInsertIndex(null)}
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
            border: `1px solid ${draftTokens.length > 0 ? "#CFFF04" : subtleBorderColor
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

function isEquationOperator(label: string) {
  return (
    label === "+" ||
    label === "-" ||
    label === "×" ||
    label === "÷" ||
    label === "="
  );
}

function getHitBubblePairPads(pair: HitBubblePair): HitBubblePad[] {
  if (pair === "topLeftBottomRight") return ["topLeft", "bottomRight"];
  if (pair === "topRightBottomLeft") return ["topRight", "bottomLeft"];
  return ["left", "right"];
}

function getHitBubblePairFromPads(pads: HitBubblePad[]): HitBubblePair | null {
  const uniquePads = Array.from(new Set(pads));
  const padSet = new Set(uniquePads);

  if (padSet.has("topLeft") && padSet.has("bottomRight")) {
    return "topLeftBottomRight";
  }

  if (padSet.has("topRight") && padSet.has("bottomLeft")) {
    return "topRightBottomLeft";
  }

  if (padSet.has("left") && padSet.has("right")) {
    return "leftRight";
  }

  if (uniquePads.length > 0) {
    return getHitBubblePairFromPad(uniquePads[0]);
  }

  return null;
}

function getHitBubblePairFromPlacement(
  placement: HitBubblePlacement | undefined,
): HitBubblePair | null {
  const pads = placement?.pads ?? placement?.positions ?? [];
  return getHitBubblePairFromPads(pads);
}

function getHitBubblePairFromPad(pad: HitBubblePad): HitBubblePair {
  if (pad === "topLeft" || pad === "bottomRight") return "topLeftBottomRight";
  if (pad === "topRight" || pad === "bottomLeft") return "topRightBottomLeft";
  return "leftRight";
}

function getHitBubblePadStyle(pad: HitBubblePad, bubbleSize: number) {
  const offset = bubbleSize * 0.72;
  const cornerOffset = bubbleSize * 0.58;

  switch (pad) {
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

function EmptyEquationBubble({
  size = 34,
  borderColor = "rgba(255, 255, 255, 0.42)",
  background = "rgba(255, 255, 255, 0.08)",
}: {
  size?: number;
  borderColor?: string;
  background?: string;
}) {
  return (
    <span
      aria-hidden="true"
      style={{
        width: size,
        height: size,
        borderRadius: "999px",
        background,
        border: `2px dashed ${borderColor}`,
        boxSizing: "border-box",
        display: "inline-block",
      }}
    />
  );
}

function HitBubbleChoice({
  onSelect,
}: {
  onSelect: (pair: HitBubblePair) => void;
}) {
  const choices: Array<{ pair: HitBubblePair; label: string }> = [
    { pair: "topLeftBottomRight", label: "↘" },
    { pair: "topRightBottomLeft", label: "↙" },
    { pair: "leftRight", label: "↔" },
  ];

  return (
    <span
      style={{
        position: "absolute",
        left: "50%",
        top: -48,
        transform: "translateX(-50%)",
        zIndex: 20,
        display: "flex",
        gap: 6,
        padding: 6,
        borderRadius: 999,
        background: "#111111",
        border: `1px solid ${subtleBorderColor}`,
        boxShadow: "0 12px 28px rgba(0,0,0,0.32)",
      }}
    >
      {choices.map((choice) => (
        <button
          key={choice.pair}
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onSelect(choice.pair);
          }}
          style={{
            width: 30,
            height: 30,
            borderRadius: 999,
            border: "1px solid rgba(255,255,255,0.24)",
            background: "#252525",
            color: textColor,
            cursor: "pointer",
            fontSize: 15,
            fontWeight: 900,
          }}
          aria-label={`Choose hit pads ${choice.label}`}
        >
          {choice.label}
        </button>
      ))}
    </span>
  );
}

function HitEquationEditor({
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
  const bubbleSize = 28;
  const largeCircleSize = 68;
  const tokenSlotSize = 68;

  if (tokens.length === 0) {
    return (
      <span style={{ color: "#FFFFFF66", fontSize: 12, fontWeight: 700 }}>
        Empty
      </span>
    );
  }

  return (
    <div
      onClick={() => setSelectedTokenIndex(null)}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 42,
        flexWrap: "wrap",
        padding: 46,
      }}
    >
      {tokens.map((token, tokenIndex) => {
        const isOperator = isEquationOperator(token.label);
        const tokenSize = getEquationEditorTokenSize(token.label);
        const placement = hitBubbles.find(
          (item) => item.tokenIndex === tokenIndex,
        );

        return (
          <span
            key={token.id}
            style={{
              position: "relative",
              width: tokenSlotSize,
              height: tokenSlotSize,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            {!isOperator && placement?.pads.length
              ? placement.pads.map((pad) => (
                <span
                  key={pad}
                  style={{
                    position: "absolute",
                    ...getHitBubblePadStyle(pad, bubbleSize),
                    zIndex: 1,
                  }}
                >
                  <EmptyEquationBubble
                    size={bubbleSize}
                    borderColor="#CFFF04"
                    background="rgba(207, 255, 4, 0.08)"
                  />
                </span>
              ))
              : null}

            {!isOperator && selectedTokenIndex === tokenIndex ? (
              <HitBubbleChoice
                onSelect={(pair) => {
                  onAddHitBubblePair(tokenIndex, pair);
                  setSelectedTokenIndex(null);
                }}
              />
            ) : null}

            {isOperator ? (
              <EquationCircle
                label={token.label}
                draggable={false}
                size={tokenSize}
              />
            ) : (
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  setSelectedTokenIndex((current) =>
                    current === tokenIndex ? null : tokenIndex,
                  );
                }}
                title="Click to choose hit pads"
                style={{
                  position: "relative",
                  zIndex: 5,
                  border: "none",
                  background: "transparent",
                  padding: 0,
                  cursor: "pointer",
                }}
              >
                <EquationCircle
                  label={token.label}
                  draggable={false}
                  size={largeCircleSize}
                />
              </button>
            )}
          </span>
        );
      })}
    </div>
  );
}

function SpinOverlay() {
  return (
    <span
      aria-hidden="true"
      style={{
        position: "absolute",
        left: "50%",
        top: "50%",
        width: 150,
        height: 106,
        transform: "translate(-50%, -50%)",
        pointerEvents: "none",
        zIndex: 1,
      }}
    >
      <svg
        width="150"
        height="106"
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

function SpinEquationEditor({
  tokens,
  spinTargets,
  onToggleSpinTarget,
}: {
  tokens: EquationToken[];
  spinTargets: SpinTarget[];
  onToggleSpinTarget: (tokenIndex: number) => void;
}) {
  const targetIndexes = new Set(spinTargets.map((target) => target.tokenIndex));
  const largeCircleSize = 68;
  const tokenSlotSize = 68;

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
        gap: 42,
        flexWrap: "wrap",
        padding: 46,
      }}
    >
      {tokens.map((token, tokenIndex) => {
        const isOperator = isEquationOperator(token.label);
        const isSpinTarget = targetIndexes.has(tokenIndex);
        const tokenSize = getEquationEditorTokenSize(token.label);

        return (
          <span
            key={token.id}
            style={{
              position: "relative",
              width: tokenSlotSize,
              height: tokenSlotSize,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            {!isOperator && isSpinTarget ? <SpinOverlay /> : null}

            {isOperator ? (
              <EquationCircle
                label={token.label}
                draggable={false}
                size={tokenSize}
              />
            ) : (
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onToggleSpinTarget(tokenIndex);
                }}
                title="Click to add or remove spin behavior"
                style={{
                  position: "relative",
                  zIndex: 5,
                  border: "none",
                  background: "transparent",
                  padding: 0,
                  cursor: "pointer",
                }}
              >
                <EquationCircle
                  label={token.label}
                  draggable={false}
                  size={largeCircleSize}
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

const dragGradient =
  "linear-gradient(89.9deg, rgba(255, 53, 53, 0.3) 0.11%, rgba(187, 255, 0, 0.3) 43.96%, rgba(255, 255, 255, 0.1) 82.59%)";

type DragArcGeometry = {
  targetIndex: number;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
};

function DragDestinationBubble({ size }: { size: number }) {
  return (
    <span
      aria-hidden="true"
      style={{
        width: size,
        height: size,
        borderRadius: 999,
        border: "3px solid transparent",
        background: `linear-gradient(#191919, #191919) padding-box, ${dragGradient} border-box`,
        boxSizing: "border-box",
        boxShadow: "0 0 20px rgba(187, 255, 0, 0.08)",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    />
  );
}

function DragArcSvg({ arcs }: { arcs: DragArcGeometry[] }) {
  if (arcs.length === 0) {
    return null;
  }

  return (
    <svg
      aria-hidden="true"
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        overflow: "visible",
        pointerEvents: "none",
        zIndex: 1,
      }}
    >
      <defs>
        <linearGradient id="dragArcGradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0.11%" stopColor="rgba(255, 53, 53, 0.3)" />
          <stop offset="43.96%" stopColor="rgba(187, 255, 0, 0.3)" />
          <stop offset="82.59%" stopColor="rgba(255, 255, 255, 0.1)" />
        </linearGradient>
      </defs>

      {arcs.map((arc) => {
        const deltaX = arc.endX - arc.startX;
        const lift = Math.max(76, Math.min(170, Math.abs(deltaX) * 0.32));
        const controlY = Math.min(arc.startY, arc.endY) - lift;
        const path = `M ${arc.startX} ${arc.startY} C ${arc.startX + deltaX * 0.25
          } ${controlY}, ${arc.startX + deltaX * 0.75} ${controlY}, ${arc.endX
          } ${arc.endY}`;

        return (
          <g key={arc.targetIndex}>
            <path
              d={path}
              fill="none"
              stroke="url(#dragArcGradient)"
              strokeWidth="58"
              strokeLinecap="round"
            />
            <path
              d={path}
              fill="none"
              stroke="rgba(255, 255, 255, 0.16)"
              strokeWidth="20"
              strokeLinecap="round"
            />
          </g>
        );
      })}
    </svg>
  );
}

function DragEquationEditor({
  tokens,
  dragTargets,
  onToggleDragTarget,
}: {
  tokens: EquationToken[];
  dragTargets: DragTarget[];
  onToggleDragTarget: (tokenIndex: number) => void;
}) {
  const targetIndexes = new Set(dragTargets.map((target) => target.tokenIndex));
  const selectedTargetIndex = dragTargets[0]?.tokenIndex ?? null;
  const equalsIndex = findEqualsIndex(tokens);
  const actualEqualsIndex = tokens.findIndex((token) => token.label === "=");
  const largeCircleSize = 68;
  const tokenSlotSize = 68;

  const surfaceRef = useRef<HTMLDivElement | null>(null);
  const tokenRefs = useRef<Map<number, HTMLSpanElement>>(new Map());
  const destinationRefs = useRef<Map<number, HTMLSpanElement>>(new Map());
  const [arcs, setArcs] = useState<DragArcGeometry[]>([]);

  const leftTokens = tokens
    .map((token, tokenIndex) => ({ token, tokenIndex }))
    .filter(({ tokenIndex }) => tokenIndex < equalsIndex);

  const rightTokens = tokens
    .map((token, tokenIndex) => ({ token, tokenIndex }))
    .filter(({ tokenIndex }) => tokenIndex > equalsIndex);

  const equalsToken =
    actualEqualsIndex >= 0 ? tokens[actualEqualsIndex] : null;

  const targetsStartingOnLeft =
    selectedTargetIndex !== null && selectedTargetIndex < equalsIndex
      ? [selectedTargetIndex]
      : [];

  const targetsStartingOnRight =
    selectedTargetIndex !== null && selectedTargetIndex > equalsIndex
      ? [selectedTargetIndex]
      : [];

  useLayoutEffect(() => {
    const surface = surfaceRef.current;

    if (!surface || dragTargets.length === 0) {
      setArcs([]);
      return;
    }

    const surfaceRect = surface.getBoundingClientRect();

    const nextArcs = dragTargets.flatMap((target): DragArcGeometry[] => {
      const tokenNode = tokenRefs.current.get(target.tokenIndex);
      const destinationNode = destinationRefs.current.get(target.tokenIndex);

      if (!tokenNode || !destinationNode) {
        return [];
      }

      const tokenRect = tokenNode.getBoundingClientRect();
      const destinationRect = destinationNode.getBoundingClientRect();

      return [
        {
          targetIndex: target.tokenIndex,
          startX: tokenRect.left + tokenRect.width / 2 - surfaceRect.left,
          startY: tokenRect.top + tokenRect.height / 2 - surfaceRect.top,
          endX:
            destinationRect.left +
            destinationRect.width / 2 -
            surfaceRect.left,
          endY:
            destinationRect.top +
            destinationRect.height / 2 -
            surfaceRect.top,
        },
      ];
    });

    setArcs(nextArcs);
  }, [dragTargets, tokens]);

  useEffect(() => {
    function handleResize() {
      const surface = surfaceRef.current;

      if (!surface || dragTargets.length === 0) {
        setArcs([]);
        return;
      }

      const surfaceRect = surface.getBoundingClientRect();

      const nextArcs = dragTargets.flatMap((target): DragArcGeometry[] => {
        const tokenNode = tokenRefs.current.get(target.tokenIndex);
        const destinationNode = destinationRefs.current.get(target.tokenIndex);

        if (!tokenNode || !destinationNode) {
          return [];
        }

        const tokenRect = tokenNode.getBoundingClientRect();
        const destinationRect = destinationNode.getBoundingClientRect();

        return [
          {
            targetIndex: target.tokenIndex,
            startX: tokenRect.left + tokenRect.width / 2 - surfaceRect.left,
            startY: tokenRect.top + tokenRect.height / 2 - surfaceRect.top,
            endX:
              destinationRect.left +
              destinationRect.width / 2 -
              surfaceRect.left,
            endY:
              destinationRect.top +
              destinationRect.height / 2 -
              surfaceRect.top,
          },
        ];
      });

      setArcs(nextArcs);
    }

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, [dragTargets]);

  if (tokens.length === 0) {
    return (
      <span style={{ color: "#FFFFFF66", fontSize: 12, fontWeight: 700 }}>
        Empty
      </span>
    );
  }

  function renderToken(token: EquationToken, tokenIndex: number) {
    const isOperator = isEquationOperator(token.label);
    const isDragTarget = targetIndexes.has(tokenIndex);
    const tokenSize = getEquationEditorTokenSize(token.label);

    return (
      <span
        key={token.id}
        ref={(node) => {
          if (node) {
            tokenRefs.current.set(tokenIndex, node);
          } else {
            tokenRefs.current.delete(tokenIndex);
          }
        }}
        style={{
          position: "relative",
          width: tokenSlotSize,
          height: tokenSlotSize,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          zIndex: 5,
        }}
      >
        {isOperator ? (
          <EquationCircle
            label={token.label}
            draggable={false}
            size={tokenSize}
          />
        ) : (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onToggleDragTarget(tokenIndex);
            }}
            title="Click to add or remove drag behavior"
            style={{
              position: "relative",
              zIndex: 5,
              border: "none",
              background: "transparent",
              padding: 0,
              cursor: "pointer",
            }}
          >
            <EquationCircle
              label={token.label}
              draggable={false}
              size={largeCircleSize}
            />
          </button>
        )}

        {!isOperator && isDragTarget ? (
          <span
            aria-hidden="true"
            style={{
              position: "absolute",
              inset: -6,
              borderRadius: 999,
              border: "2px solid rgba(207, 255, 4, 0.38)",
              pointerEvents: "none",
            }}
          />
        ) : null}
      </span>
    );
  }

  function renderDestination(targetIndex: number) {
    return (
      <span
        key={`drag-destination-${targetIndex}`}
        ref={(node) => {
          if (node) {
            destinationRefs.current.set(targetIndex, node);
          } else {
            destinationRefs.current.delete(targetIndex);
          }
        }}
        style={{
          position: "relative",
          width: largeCircleSize,
          height: largeCircleSize,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          zIndex: 5,
        }}
      >
        <DragDestinationBubble size={largeCircleSize} />
      </span>
    );
  }

  return (
    <div
      ref={surfaceRef}
      style={{
        position: "relative",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 42,
        flexWrap: "wrap",
        padding: 46,
        overflow: "visible",
      }}
    >
      <DragArcSvg arcs={arcs} />

      {leftTokens.map(({ token, tokenIndex }) =>
        renderToken(token, tokenIndex),
      )}

      {targetsStartingOnRight.map(renderDestination)}

      {equalsToken ? renderToken(equalsToken, actualEqualsIndex) : null}

      {rightTokens.map(({ token, tokenIndex }) =>
        renderToken(token, tokenIndex),
      )}

      {targetsStartingOnLeft.map(renderDestination)}
    </div>
  );
}

function MechanicEquationEditor({
  mechanic,
  equation,
  instance,
  onAddHitBubblePair,
  onToggleSpinTarget,
  onToggleDragTarget,
}: {
  mechanic: GameplayMechanic;
  equation: SavedEquation | null;
  instance: MechanicInstanceState | undefined;
  onAddHitBubblePair: (tokenIndex: number, pair: HitBubblePair) => void;
  onToggleSpinTarget: (tokenIndex: number) => void;
  onToggleDragTarget: (tokenIndex: number) => void;
}) {
  if (!equation) {
    return (
      <div
        style={{
          color: "#FFFFFF80",
          fontSize: 13,
          fontWeight: 700,
          textAlign: "center",
        }}
      >
        Drag an equation into this event to assign it to all {mechanic}s.
      </div>
    );
  }

  if (mechanic === "hit") {
    return (
      <HitEquationEditor
        tokens={equation.tokens}
        hitBubbles={instance?.hitBubbles ?? []}
        onAddHitBubblePair={onAddHitBubblePair}
      />
    );
  }

  if (mechanic === "spin") {
    return (
      <SpinEquationEditor
        tokens={equation.tokens}
        spinTargets={instance?.spinTargets ?? []}
        onToggleSpinTarget={onToggleSpinTarget}
      />
    );
  }

  return (
    <DragEquationEditor
      tokens={equation.tokens}
      dragTargets={instance?.dragTargets ?? []}
      onToggleDragTarget={onToggleDragTarget}
    />
  );
}

function MechanicInstanceRow({
  mechanic,
  count,
  equation,
  instances,
  onDropEquation,
  onAddHitBubblePair,
  onToggleSpinTarget,
  onToggleDragTarget,
}: {
  mechanic: GameplayMechanic;
  count: number;
  equation: SavedEquation | null;
  instances: MechanicInstanceState[];
  onDropEquation: (equation: SavedEquation) => void;
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
  const [activeInstanceIndex, setActiveInstanceIndex] = useState(0);
  const safeCount = Math.max(0, Math.round(count));
  const tabLabel =
    mechanic === "hit" ? "Hit" : mechanic === "spin" ? "Spin" : "Drag";

  useEffect(() => {
    setActiveInstanceIndex((current) =>
      safeCount > 0 ? Math.min(current, safeCount - 1) : 0,
    );
  }, [safeCount]);

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();

    const rawEquation = event.dataTransfer.getData(
      "application/x-saved-equation",
    );

    if (!rawEquation) {
      return;
    }

    try {
      const parsed = JSON.parse(rawEquation) as SavedEquation;

      if (parsed.id && Array.isArray(parsed.tokens)) {
        onDropEquation({
          id: parsed.id,
          tokens: cloneTokens(parsed.tokens),
        });
      }
    } catch (error) {
      console.error("Failed to drop saved equation", error);
    }
  }

  if (safeCount <= 0) {
    return null;
  }

  const activeInstance = instances[activeInstanceIndex];

  return (
    <div
      onDragOver={(event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = "copy";
      }}
      onDrop={handleDrop}
      style={{
        background: "#191919",
        border: `1px dashed ${subtleBorderColor}`,
        borderRadius: 18,
        minHeight: 196,
        display: "grid",
        gridTemplateColumns: "140px minmax(0, 1fr)",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          borderRight: `1px solid ${subtleBorderColor}`,
          padding: 14,
          display: "grid",
          alignContent: "center",
          gap: 10,
        }}
      >
        <div
          style={{
            color: textColor,
            fontFamily: "Space Grotesk, sans-serif",
            fontSize: 14,
            fontWeight: 900,
            textTransform: "uppercase",
          }}
        >
          {mechanic}s
        </div>
        <div
          style={{
            color: "#FFFFFF99",
            fontFamily: "Space Grotesk, sans-serif",
            fontSize: 12,
            fontWeight: 700,
          }}
        >
          {safeCount} total
        </div>
      </div>

      <div
        style={{
          padding: 0,
          display: "grid",
          gridTemplateRows: "auto 1fr",
          minWidth: 0,
        }}
      >
        <div
          role="tablist"
          aria-label={`${tabLabel} selector`}
          style={{
            minHeight: 44,
            display: "flex",
            alignItems: "stretch",
            gap: 0,
            overflowX: "auto",
            borderBottom: `1px solid ${subtleBorderColor}`,
            background: "#151515",
          }}
        >
          {Array.from({ length: safeCount }, (_, index) => {
            const isActive = index === activeInstanceIndex;

            return (
              <button
                key={`${mechanic}-tab-${index}`}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setActiveInstanceIndex(index)}
                style={{
                  minWidth: 92,
                  minHeight: 44,
                  border: "none",
                  borderRight: `1px solid ${subtleBorderColor}`,
                  borderBottom: `3px solid ${isActive ? "#CFFF04" : "transparent"
                    }`,
                  background: isActive ? "#252525" : "transparent",
                  color: isActive ? "#FFFFFF" : "#FFFFFF99",
                  fontFamily: "Space Grotesk, sans-serif",
                  fontSize: 12,
                  fontWeight: 900,
                  cursor: "pointer",
                  textTransform: "uppercase",
                }}
              >
                {tabLabel} {index + 1}
              </button>
            );
          })}
        </div>

        <div
          style={{
            minHeight: 132,
            padding: 14,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            overflow: "auto",
          }}
        >
          <MechanicEquationEditor
            mechanic={mechanic}
            equation={equation}
            instance={activeInstance}
            onAddHitBubblePair={(tokenIndex, pair) =>
              onAddHitBubblePair(
                mechanic,
                activeInstanceIndex,
                tokenIndex,
                pair,
              )
            }
            onToggleSpinTarget={(tokenIndex) =>
              onToggleSpinTarget(mechanic, activeInstanceIndex, tokenIndex)
            }
            onToggleDragTarget={(tokenIndex) =>
              onToggleDragTarget(mechanic, activeInstanceIndex, tokenIndex)
            }
          />
        </div>
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
  onDropEquation: (equation: SavedEquation) => void;
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
  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();

    const rawEquation = event.dataTransfer.getData(
      "application/x-saved-equation",
    );

    if (!rawEquation) {
      return;
    }

    try {
      const parsed = JSON.parse(rawEquation) as SavedEquation;

      if (parsed.id && Array.isArray(parsed.tokens)) {
        onDropEquation({
          id: parsed.id,
          tokens: cloneTokens(parsed.tokens),
        });
      }
    } catch (error) {
      console.error("Failed to drop saved equation", error);
    }
  }

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

  const assignedEquation = getTimelineEventEquation(eventSlot);
  const visibleMechanics = gameplayMechanics.filter(
    (mechanic) => (eventSlot.counts?.[mechanic] ?? 0) > 0,
  );

  return (
    <div
      onDragOver={(event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = "copy";
      }}
      onDrop={handleDrop}
      style={{
        flex: 1,
        minHeight: 0,
        height: "60vh",
        maxHeight: "60vh",
        background: "#191919",
        padding: 18,
        boxSizing: "border-box",
        display: "grid",
        gridTemplateRows: "auto 1fr",
        gap: 16,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          display: "none",
        }}
      />

      <div
        style={{
          display: "grid",
          alignContent: "start",
          gap: 14,
          overflow: "auto",
          minHeight: 0,
        }}
      >
        {visibleMechanics.length === 0 ? (
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
              gridTemplateRows: "1fr",
              gap: 0,
              overflow: "hidden",
            }}
          >
            This event does not have any hits, spins, or drags.
          </div>
        ) : (
          visibleMechanics.map((mechanic) => (
            <MechanicInstanceRow
              key={mechanic}
              mechanic={mechanic}
              count={eventSlot.counts[mechanic]}
              equation={assignedEquation}
              instances={eventSlot.mechanicInstances[mechanic] ?? []}
              onDropEquation={onDropEquation}
              onAddHitBubblePair={onAddHitBubblePair}
              onToggleSpinTarget={onToggleSpinTarget}
              onToggleDragTarget={onToggleDragTarget}
            />
          ))
        )}
      </div>
    </div>
  );
}


function EditorWorkspaceTabs({
  workspaceMode,
  onWorkspaceModeChange,
}: {
  workspaceMode: EditorWorkspaceMode;
  onWorkspaceModeChange: (mode: EditorWorkspaceMode) => void;
}) {
  const tabs: Array<{ mode: EditorWorkspaceMode; label: string }> = [
    { mode: "equationEditor", label: "Equation Editor" },
    { mode: "chartEditor", label: "Chart Editor" },
  ];

  return (
    <div
      role="tablist"
      aria-label="Editor mode"
      style={{
        minHeight: 48,
        display: "flex",
        alignItems: "stretch",
        borderBottom: `1px solid ${subtleBorderColor}`,
        background: "#151515",
        fontFamily: "Space Grotesk, sans-serif",
      }}
    >
      {tabs.map((tab) => {
        const isActive = workspaceMode === tab.mode;

        return (
          <button
            key={tab.mode}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onWorkspaceModeChange(tab.mode)}
            style={{
              minWidth: 170,
              border: "none",
              borderRight: `1px solid ${subtleBorderColor}`,
              borderBottom: `3px solid ${isActive ? "#CFFF04" : "transparent"}`,
              background: isActive ? "#252525" : "transparent",
              color: isActive ? "#FFFFFF" : "#FFFFFF99",
              fontFamily: "Space Grotesk, sans-serif",
              fontSize: 13,
              fontWeight: 900,
              cursor: "pointer",
            }}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

function ChartWaveform({
  events,
  currentTime,
  duration,
  currentTick,
  onSeek,
}: {
  events: TimelineEventSlot[];
  currentTime: number;
  duration: number;
  currentTick: number;
  onSeek: (time: number) => void;
}) {
  const progress = duration > 0 ? Math.min(1, Math.max(0, currentTime / duration)) : 0;
  const maxTick = getMaxTimelineTick(events);
  const bars = Array.from({ length: 120 }, (_, index) => {
    const wave = Math.sin(index * 0.43) * 0.5 + Math.sin(index * 0.13) * 0.35;
    return Math.max(14, Math.round(34 + Math.abs(wave) * 72));
  });

  return (
    <div
      onClick={(event) => {
        if (duration <= 0) return;
        const rect = event.currentTarget.getBoundingClientRect();
        const ratio = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
        onSeek(ratio * duration);
      }}
      style={{
        position: "relative",
        height: 120,
        borderRadius: 18,
        border: `1px solid ${subtleBorderColor}`,
        background: "#101010",
        overflow: "hidden",
        cursor: duration > 0 ? "pointer" : "default",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: "12px 14px",
          display: "flex",
          alignItems: "center",
          gap: 3,
        }}
      >
        {bars.map((height, index) => (
          <span
            key={index}
            style={{
              flex: 1,
              height,
              maxHeight: "100%",
              borderRadius: 999,
              background: "rgba(207, 255, 4, 0.38)",
              opacity: index / bars.length <= progress ? 1 : 0.32,
            }}
          />
        ))}
      </div>

      {events.map((eventSlot) => {
        const left = maxTick > 0 ? (eventSlot.tick / maxTick) * 100 : 0;

        return (
          <span
            key={eventSlot.id}
            title={`Event at tick ${eventSlot.tick}`}
            style={{
              position: "absolute",
              left: `${Math.min(100, Math.max(0, left))}%`,
              top: 8,
              bottom: 8,
              width: 2,
              background: "rgba(255, 255, 255, 0.32)",
              transform: "translateX(-50%)",
            }}
          />
        );
      })}

      <div
        style={{
          position: "absolute",
          left: `${progress * 100}%`,
          top: 0,
          bottom: 0,
          width: 3,
          background: "#FFFFFF",
          boxShadow: "0 0 18px rgba(255,255,255,0.48)",
          transform: "translateX(-50%)",
        }}
      />

      <div
        style={{
          position: "absolute",
          left: `min(calc(${progress * 100}% + 10px), calc(100% - 160px))`,
          top: 10,
          padding: "6px 8px",
          borderRadius: 10,
          background: "rgba(0,0,0,0.74)",
          color: "#FFFFFF",
          fontSize: 11,
          fontWeight: 800,
          fontFamily: "Space Grotesk, sans-serif",
          whiteSpace: "nowrap",
        }}
      >
        {formatEditorTime(currentTime)} · Tick {currentTick}
      </div>
    </div>
  );
}

function ChartEditorViewer({
  audioUrl,
  audioRef,
  isAudioPlaying,
  currentTime,
  duration,
  currentTick,
  timelineEvents,
  chartFile,
  sidecar,
  onTogglePlay,
  onTimeUpdate,
  onDurationChange,
  onSeek,
  onSelectEvent,
}: {
  audioUrl: string;
  audioRef: RefObject<HTMLAudioElement | null>;
  isAudioPlaying: boolean;
  currentTime: number;
  duration: number;
  currentTick: number;
  timelineEvents: TimelineEventSlot[];
  chartFile: string;
  sidecar: SidecarPayload;
  onTogglePlay: () => void;
  onTimeUpdate: (time: number) => void;
  onDurationChange: (duration: number) => void;
  onSeek: (time: number) => void;
  onSelectEvent: (eventId: string) => void;
}) {
  const currentEvent = getEventAtOrBeforeTick(timelineEvents, currentTick);
  const exactEvents = getEventsAtTick(timelineEvents, currentTick);
  const sidecarEventsAtTick = sidecar.events.filter((event) => event.tick === currentTick);
  const chartLinesAtTick = getChartLinesForTick(chartFile, currentTick);

  return (
    <>
      <div
        style={{
          minHeight: 0,
          padding: 18,
          display: "grid",
          gridTemplateRows: "auto 1fr",
          gap: 14,
          overflow: "hidden",
          fontFamily: "Space Grotesk, sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 16,
            color: textColor,
          }}
        >
          <div>
            <div style={{ fontSize: 18, fontWeight: 900 }}>Chart Editor</div>
            <div style={{ color: "#FFFFFF99", fontSize: 12, fontWeight: 700 }}>
              {formatEditorTime(currentTime)} / {formatEditorTime(duration)} · Tick {currentTick}
            </div>
          </div>
          <div style={{ color: "#FFFFFF99", fontSize: 12, fontWeight: 800 }}>
            {timelineEvents.length} events
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1fr) minmax(280px, 0.55fr)",
            gap: 14,
            minHeight: 0,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              border: `1px solid ${subtleBorderColor}`,
              borderRadius: 18,
              background: "#111111",
              padding: 16,
              overflow: "auto",
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 900, color: "#CFFF04", marginBottom: 10 }}>
              Current timing data
            </div>

            {exactEvents.length > 0 ? (
              exactEvents.map((eventSlot) => (
                <button
                  key={eventSlot.id}
                  type="button"
                  onClick={() => onSelectEvent(eventSlot.id)}
                  style={{
                    width: "100%",
                    marginBottom: 10,
                    padding: 12,
                    borderRadius: 14,
                    border: "1px solid rgba(207, 255, 4, 0.44)",
                    background: "rgba(207, 255, 4, 0.08)",
                    color: "#FFFFFF",
                    textAlign: "left",
                    cursor: "pointer",
                    fontFamily: "Space Grotesk, sans-serif",
                  }}
                >
                  <div style={{ fontWeight: 900 }}>Event at tick {eventSlot.tick}</div>
                  <div style={{ fontSize: 12, color: "#FFFFFFB3", marginTop: 6 }}>
                    Hits {eventSlot.counts.hit} · Spins {eventSlot.counts.spin} · Drags {eventSlot.counts.drag}
                  </div>
                </button>
              ))
            ) : currentEvent ? (
              <div style={{ color: "#FFFFFFCC", fontSize: 13, lineHeight: 1.55 }}>
                Nearest previous event is tick {currentEvent.tick}: H {currentEvent.counts.hit}, S {currentEvent.counts.spin}, D {currentEvent.counts.drag}.
              </div>
            ) : (
              <div style={{ color: "#FFFFFF80", fontSize: 13, lineHeight: 1.55 }}>
                No chart or sidecar event data is available at this timing yet.
              </div>
            )}
          </div>

          <div
            style={{
              border: `1px solid ${subtleBorderColor}`,
              borderRadius: 18,
              background: "#111111",
              padding: 16,
              overflow: "auto",
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 900, color: "#CFFF04", marginBottom: 10 }}>
              Raw data at current tick
            </div>
            <div style={{ color: "#FFFFFF99", fontSize: 11, fontWeight: 800, marginBottom: 8 }}>
              Sidecar JSON
            </div>
            <pre
              style={{
                margin: 0,
                marginBottom: 14,
                color: "#FFFFFFCC",
                fontSize: 11,
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
              }}
            >
              {sidecarEventsAtTick.length > 0
                ? JSON.stringify(sidecarEventsAtTick, null, 2)
                : "No sidecar events at this exact tick."}
            </pre>
            <div style={{ color: "#FFFFFF99", fontSize: 11, fontWeight: 800, marginBottom: 8 }}>
              Chart lines
            </div>
            <pre
              style={{
                margin: 0,
                color: "#FFFFFFCC",
                fontSize: 11,
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
              }}
            >
              {chartLinesAtTick.length > 0
                ? chartLinesAtTick.join("\n")
                : "No .chart lines matched this tick string."}
            </pre>
          </div>
        </div>
      </div>

      <section
        aria-label="Song waveform"
        style={{
          width: "100%",
          height: "calc(40vh - 142px)",
          minHeight: 180,
          background: panelBackgroundColor,
          borderTop: `1px solid ${subtleBorderColor}`,
          boxSizing: "border-box",
          padding: 16,
          display: "grid",
          gridTemplateColumns: "120px minmax(0, 1fr)",
          gap: 16,
          alignItems: "center",
          fontFamily: "Space Grotesk, sans-serif",
        }}
      >
        <audio
          ref={audioRef}
          src={audioUrl || undefined}
          onTimeUpdate={(event) => onTimeUpdate(event.currentTarget.currentTime)}
          onLoadedMetadata={(event) => onDurationChange(event.currentTarget.duration || 0)}
          onEnded={() => onTimeUpdate(duration)}
        />
        <button
          type="button"
          disabled={!audioUrl}
          onClick={onTogglePlay}
          style={{
            minHeight: 54,
            borderRadius: 16,
            border: "1px solid #CFFF04",
            background: audioUrl ? "#CFFF04" : "#2B2B2B",
            color: audioUrl ? "#000000" : "#FFFFFF80",
            fontFamily: "Space Grotesk, sans-serif",
            fontWeight: 900,
            cursor: audioUrl ? "pointer" : "not-allowed",
          }}
        >
          {isAudioPlaying ? "Pause" : "Play"}
        </button>

        <ChartWaveform
          events={timelineEvents}
          currentTime={currentTime}
          duration={duration}
          currentTick={currentTick}
          onSeek={onSeek}
        />
      </section>
    </>
  );
}

function ChartEventsPanel({
  currentTick,
  events,
  activeEventId,
  onAddEvent,
  onDeleteEvent,
  onSelectEvent,
}: {
  currentTick: number;
  events: TimelineEventSlot[];
  activeEventId: string | null;
  onAddEvent: () => void;
  onDeleteEvent: (eventId: string) => void;
  onSelectEvent: (eventId: string) => void;
}) {
  const sortedEvents = [...events].sort((left, right) => left.tick - right.tick);

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
        fontFamily: "Space Grotesk, sans-serif",
      }}
    >
      <div
        style={{
          padding: "18px 12px",
          borderBottom: `1px solid ${subtleBorderColor}`,
          fontSize: 13,
          fontWeight: 800,
          textAlign: "center",
        }}
      >
        Chart Events
      </div>

      <div style={{ padding: 12, borderBottom: `1px solid ${subtleBorderColor}` }}>
        <div style={{ color: "#FFFFFF99", fontSize: 11, fontWeight: 800, marginBottom: 8 }}>
          Current tick: {currentTick}
        </div>
        <button
          type="button"
          onClick={onAddEvent}
          style={{
            width: "100%",
            minHeight: 42,
            background: "#CFFF04",
            color: "#000000",
            border: "1px solid #CFFF04",
            borderRadius: 10,
            fontFamily: "Space Grotesk, sans-serif",
            fontSize: 12,
            fontWeight: 900,
            cursor: "pointer",
          }}
        >
          Add Event Here
        </button>
      </div>

      <div style={{ padding: 12, display: "grid", gap: 10, overflowY: "auto" }}>
        {sortedEvents.length === 0 ? (
          <div style={{ color: "#FFFFFF80", fontSize: 12, fontWeight: 700, lineHeight: 1.4 }}>
            Play or scrub the waveform, then add an event at the current tick.
          </div>
        ) : (
          sortedEvents.map((eventSlot) => {
            const isActive = eventSlot.id === activeEventId;

            return (
              <div
                key={eventSlot.id}
                style={{
                  border: `1px solid ${isActive ? "#CFFF04" : subtleBorderColor}`,
                  borderRadius: 12,
                  background: isActive ? "rgba(207,255,4,0.08)" : "#191919",
                  padding: 10,
                  display: "grid",
                  gap: 8,
                }}
              >
                <button
                  type="button"
                  onClick={() => onSelectEvent(eventSlot.id)}
                  style={{
                    border: "none",
                    background: "transparent",
                    color: "#FFFFFF",
                    textAlign: "left",
                    padding: 0,
                    cursor: "pointer",
                    fontFamily: "Space Grotesk, sans-serif",
                    fontWeight: 900,
                    fontSize: 12,
                  }}
                >
                  Tick {eventSlot.tick}
                </button>
                <div style={{ color: "#FFFFFF99", fontSize: 11, fontWeight: 800 }}>
                  H {eventSlot.counts.hit} · S {eventSlot.counts.spin} · D {eventSlot.counts.drag}
                </div>
                <button
                  type="button"
                  onClick={() => onDeleteEvent(eventSlot.id)}
                  style={{
                    minHeight: 28,
                    borderRadius: 8,
                    border: "1px solid rgba(255, 53, 53, 0.45)",
                    background: "rgba(255, 53, 53, 0.12)",
                    color: "#FFFFFF",
                    fontFamily: "Space Grotesk, sans-serif",
                    fontSize: 11,
                    fontWeight: 900,
                    cursor: "pointer",
                  }}
                >
                  Delete
                </button>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
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
            const assignedEquation = getTimelineEventEquation(eventSlot);

            return (
              <button
                key={eventSlot.id}
                type="button"
                onClick={() => onSelectEvent(eventSlot.id)}
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
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    overflow: "hidden",
                    textAlign: "center",
                  }}
                >
                  {assignedEquation ? (
                    <EquationPreview
                      tokens={assignedEquation.tokens}
                      circleSize={24}
                    />
                  ) : (
                    <span
                      style={{
                        color: "#FFFFFF80",
                        fontSize: 12,
                        fontWeight: 800,
                        lineHeight: 1.3,
                      }}
                    >
                      Click here to Assign an Equation
                    </span>
                  )}
                </div>

                <div
                  style={{
                    color: "#FFFFFF99",
                    fontSize: 10,
                    fontWeight: 900,
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 8,
                    textTransform: "uppercase",
                  }}
                >
                  <span>H {eventSlot.counts?.hit ?? 0}</span>
                  <span>S {eventSlot.counts?.spin ?? 0}</span>
                  <span>D {eventSlot.counts?.drag ?? 0}</span>
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
        style={{
          padding: 12,
          borderBottom: `1px solid ${subtleBorderColor}`,
        }}
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
                minHeight: 42,
                padding: "4px 0",
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
  workspaceMode,
  onWorkspaceModeChange,
  mode,
  timelineEvents,
  activeEventId,
  draftTokens,
  customTokenLabel,
  audioUrl,
  audioRef,
  isAudioPlaying,
  audioCurrentTime,
  audioDuration,
  currentChartTick,
  chartFile,
  sidecar,
  onCustomTokenLabelChange,
  onSelectEvent,
  onInsertToken,
  onRemoveToken,
  onSaveEquation,
  onDropEquation,
  onAddHitBubblePair,
  onToggleSpinTarget,
  onToggleDragTarget,
  onToggleAudio,
  onAudioTimeUpdate,
  onAudioDurationChange,
  onAudioSeek,
}: {
  workspaceMode: EditorWorkspaceMode;
  onWorkspaceModeChange: (mode: EditorWorkspaceMode) => void;
  mode: "event" | "equation";
  timelineEvents: TimelineEventSlot[];
  activeEventId: string | null;
  draftTokens: EquationToken[];
  customTokenLabel: string;
  audioUrl: string;
  audioRef: RefObject<HTMLAudioElement | null>;
  isAudioPlaying: boolean;
  audioCurrentTime: number;
  audioDuration: number;
  currentChartTick: number;
  chartFile: string;
  sidecar: SidecarPayload;
  onCustomTokenLabelChange: (value: string) => void;
  onSelectEvent: (eventId: string) => void;
  onInsertToken: (index: number, label: string) => void;
  onRemoveToken: (id: string) => void;
  onSaveEquation: () => void;
  onDropEquation: (equation: SavedEquation) => void;
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
  onToggleAudio: () => void;
  onAudioTimeUpdate: (time: number) => void;
  onAudioDurationChange: (duration: number) => void;
  onAudioSeek: (time: number) => void;
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
        display: "grid",
        gridTemplateRows: "auto 1fr",
      }}
    >
      <EditorWorkspaceTabs
        workspaceMode={workspaceMode}
        onWorkspaceModeChange={onWorkspaceModeChange}
      />

      {workspaceMode === "chartEditor" ? (
        <div
          style={{
            minHeight: 0,
            display: "grid",
            gridTemplateRows: "1fr auto",
            overflow: "hidden",
          }}
        >
          <ChartEditorViewer
            audioUrl={audioUrl}
            audioRef={audioRef}
            isAudioPlaying={isAudioPlaying}
            currentTime={audioCurrentTime}
            duration={audioDuration}
            currentTick={currentChartTick}
            timelineEvents={timelineEvents}
            chartFile={chartFile}
            sidecar={sidecar}
            onTogglePlay={onToggleAudio}
            onTimeUpdate={onAudioTimeUpdate}
            onDurationChange={onAudioDurationChange}
            onSeek={onAudioSeek}
            onSelectEvent={onSelectEvent}
          />
        </div>
      ) : (
        <div
          style={{
            minHeight: 0,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
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
        </div>
      )}
    </section>
  );
}

export default function LessonBuilderClient({
  navBasePath = "/student",
  songs = [],
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

  const [workspaceMode, setWorkspaceMode] =
    useState<EditorWorkspaceMode>("equationEditor");
  const [audioUrl, setAudioUrl] = useState("");
  const [audioCurrentTime, setAudioCurrentTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

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
  const [selectedSongLaunch, setSelectedSongLaunch] = useState<{
    songAssetId: string;
    activityKey: SongActivityKey;
    chartUrl: string;
    sidecarUrl: string | null;
    audioUrl: string;
  } | null>(null);

  const sidecar = useMemo(
    () => sidecarFromTimelineEvents(timelineEvents),
    [timelineEvents],
  );

  const currentChartTick = useMemo(
    () => getChartEditorTick(audioCurrentTime, audioDuration, timelineEvents),
    [audioCurrentTime, audioDuration, timelineEvents],
  );

  const payloadForProject: LessonBuilderPayload = useMemo(
    () => ({
      chartFile,
      analysisMetadata: metadata,
      rawResults: sidecar,
    }),
    [chartFile, metadata, sidecar],
  );

  function loadSidecarIntoTimeline(
    nextSidecar: SidecarPayload,
    equationSlotCount: number | null,
    eventCounts: MechanicCounts[] = [],
    eventTicks: number[] = [],
  ) {
    const nextEvents = timelineEventsFromSidecar(
      nextSidecar,
      equationSlotCount,
      eventCounts,
      eventTicks,
    );

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
    setStoreSidecar(
      sidecarFromTimelineEvents(nextEvents) as StoreSidecarPayload,
    );
  }

  function applySongAssetEquationSlotCount(count: number | null) {
    if (typeof count !== "number") {
      return;
    }

    setTimelineEvents((current) => {
      const nextEvents = resizeTimelineEvents(current, count);

      setActiveEventId((currentId) => {
        if (
          currentId &&
          nextEvents.some((eventSlot) => eventSlot.id === currentId)
        ) {
          return currentId;
        }

        return nextEvents[0]?.id ?? null;
      });

      return nextEvents;
    });
  }

  async function handleUploadSongFile(file: File) {
    setPendingSongFile(file);
    setUploadedSongName(file.name);
    setSelectedSongStorage(null);
    setSelectedSongLaunch(null);
    setSaveStatus(`Loaded song: ${file.name}`);

    setMetadata((current) => ({
      ...current,
      songTitle: file.name.replace(/\.[^/.]+$/, ""),
      uploadedFileName: file.name,
    }));
  }

  async function handleUploadChartFile(file: File) {
    try {
      const nextChartFile = await file.text();

      setChartFile(nextChartFile);
      setUploadedChartName(file.name);
      setSaveStatus(`Loaded chart: ${file.name}`);

      try {
        setProject(
          chartToProject({
            chartFile: nextChartFile,
            analysisMetadata: metadata,
            rawResults: sidecar,
          }),
        );
      } catch (error) {
        console.error("Failed to rebuild project from uploaded chart", error);
      }
    } catch (error) {
      setSaveStatus(
        error instanceof Error ? error.message : "Unable to load .chart file",
      );
    }
  }

  async function handleUploadSidecarJsonFile(file: File) {
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as unknown;
      const normalizedSidecar = normalizeSidecar(parsed);

      loadSidecarIntoTimeline(normalizedSidecar, null);
      setSaveStatus(`Loaded sidecar JSON: ${file.name}`);

      if (chartFile.trim()) {
        try {
          setProject(
            chartToProject({
              chartFile,
              analysisMetadata: metadata,
              rawResults: normalizedSidecar,
            }),
          );
        } catch (error) {
          console.error("Failed to rebuild project from uploaded sidecar", error);
        }
      }
    } catch (error) {
      setSaveStatus(
        error instanceof Error
          ? error.message
          : "Unable to load sidecar JSON file",
      );
    }
  }

  async function handleSelectSupabaseSong(song: SelectedSongPayload) {
    setSaveStatus(`Loading ${song.name}...`);

    try {
      setSelectedSongStorage({
        id: song.id,
        chart: {
          bucket: song.chart.bucket,
          path: song.chart.path,
          contentType: song.chart.contentType,
        },
        sidecar: song.sidecar
          ? {
            bucket: song.sidecar.bucket,
            path: song.sidecar.path,
            contentType: song.sidecar.contentType,
          }
          : null,
      });

      setSelectedSongLaunch({
        songAssetId: song.id,
        activityKey:
          song.activityKey ??
          inferSongActivityKeyFromChartPath(song.chart.path) ??
          "number-bonds",
        chartUrl: song.chart.signedUrl,
        sidecarUrl: song.sidecar?.signedUrl ?? null,
        audioUrl: song.song.signedUrl,
      });

      setPendingSongFile(null);
      setUploadedSongName(song.name);

      setMetadata((current) => ({
        ...current,
        songTitle: song.title ?? song.name,
        artist: song.artist ?? current?.artist,
        uploadedFileName: song.song.path,
      }));

      const loadedPackage = await loadSongPackageAssets({
        chartUrl: song.chart.signedUrl,
        sidecarUrl: song.sidecar?.signedUrl,
        audioUrl: song.song.signedUrl,
      });

      if (loadedPackage.audioBlob) {
        setPendingSongFile(
          fileFromBlob({
            blob: loadedPackage.audioBlob,
            path: song.song.path,
            name: song.name,
            contentType: song.song.contentType,
          }),
        );
      }

      const normalizedSidecar = normalizeSidecar(
        loadedPackage.sidecarJson ?? emptySidecar,
      );
      const nextChartName = song.chart.path.split("/").pop() ?? "selected.chart";

      setChartFile(loadedPackage.chartText);
      setUploadedChartName(nextChartName);
      loadSidecarIntoTimeline(normalizedSidecar, null);

      setProject(
        chartToProject({
          chartFile: loadedPackage.chartText,
          analysisMetadata: {
            songTitle: song.title ?? song.name,
            artist: song.artist ?? undefined,
            uploadedFileName: song.song.path,
          },
          rawResults: normalizedSidecar,
        }),
      );

      setSaveStatus(
        loadedPackage.audioError
          ? `Loaded ${song.name}; audio unavailable (${loadedPackage.audioError})`
          : `Loaded ${song.name}`,
      );
    } catch (error) {
      setSaveStatus(
        error instanceof Error
          ? error.message
          : "Unable to download selected song package",
      );
    }
  }

  function handleNewEquation() {
    setDraftTokens([]);
    setCustomTokenLabel("");
    setMode("equation");
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

  function handleDropEquation(equation: SavedEquation) {
    if (!activeEventId) {
      return;
    }

    setTimelineEvents((current) =>
      current.map((eventSlot) => {
        if (eventSlot.id !== activeEventId) {
          return eventSlot;
        }

        const nextAssignments = makeEmptyAssignments();

        gameplayMechanics.forEach((mechanic) => {
          if ((eventSlot.counts?.[mechanic] ?? 0) > 0) {
            nextAssignments[mechanic] = cloneEquationForAssignment(equation);
          }
        });

        return {
          ...eventSlot,
          assignments: nextAssignments,
        };
      }),
    );
  }

  function updateActiveMechanicInstance(
    mechanic: GameplayMechanic,
    instanceIndex: number,
    updater: (instance: MechanicInstanceState) => MechanicInstanceState,
  ) {
    if (!activeEventId) {
      return;
    }

    setTimelineEvents((current) =>
      current.map((eventSlot) => {
        if (eventSlot.id !== activeEventId) {
          return eventSlot;
        }

        const currentInstances = eventSlot.mechanicInstances[mechanic] ?? [];

        return {
          ...eventSlot,
          mechanicInstances: {
            ...eventSlot.mechanicInstances,
            [mechanic]: currentInstances.map((instance, index) =>
              index === instanceIndex ? updater(instance) : instance,
            ),
          },
        };
      }),
    );
  }

  function handleAddHitBubblePair(
    mechanic: GameplayMechanic,
    instanceIndex: number,
    tokenIndex: number,
    pair: HitBubblePair,
  ) {
    const pads = getHitBubblePairPads(pair);

    updateActiveMechanicInstance(mechanic, instanceIndex, (instance) => {
      return {
        ...instance,
        // Only keep the newly selected hit token.
        hitBubbles: [{ tokenIndex, positions: pads, pads }],
      };
    });
  }

  function handleToggleSpinTarget(
    mechanic: GameplayMechanic,
    instanceIndex: number,
    tokenIndex: number,
  ) {
    updateActiveMechanicInstance(mechanic, instanceIndex, (instance) => {
      const isSameTokenAlreadySelected =
        instance.spinTargets.length === 1 &&
        instance.spinTargets[0]?.tokenIndex === tokenIndex;

      return {
        ...instance,
        // Clicking the same token again clears it.
        // Clicking a different token replaces the old one.
        spinTargets: isSameTokenAlreadySelected ? [] : [{ tokenIndex }],
      };
    });
  }

  function handleToggleDragTarget(
    mechanic: GameplayMechanic,
    instanceIndex: number,
    tokenIndex: number,
  ) {
    updateActiveMechanicInstance(mechanic, instanceIndex, (instance) => {
      const isSameTokenAlreadySelected =
        instance.dragTargets.length === 1 &&
        instance.dragTargets[0]?.tokenIndex === tokenIndex;

      return {
        ...instance,
        // Clicking the same token again clears it.
        // Clicking a different token replaces the old one.
        dragTargets: isSameTokenAlreadySelected ? [] : [{ tokenIndex }],
      };
    });
  }

  function handleAddChartEventAtCurrentTick() {
    const hit = normalizePromptedCount(window.prompt("How many hits should this event have?", "0"));
    const spin = normalizePromptedCount(window.prompt("How many spins should this event have?", "0"));
    const drag = normalizePromptedCount(window.prompt("How many drags should this event have?", "0"));

    if (hit + spin + drag <= 0) {
      setSaveStatus("Event was not added because all counts were 0.");
      return;
    }

    const tick = currentChartTick;

    setTimelineEvents((current) => {
      const nextEvent = makeTimelineEvent(current.length, tick, { hit, spin, drag });
      const nextEvents = [...current.filter((eventSlot) => eventSlot.tick !== tick), nextEvent].sort(
        (left, right) => left.tick - right.tick,
      );

      setActiveEventId(nextEvent.id);
      return nextEvents;
    });
    setMode("event");
    setSaveStatus("Unsaved chart event changes");
  }

  function handleDeleteChartEvent(eventId: string) {
    setTimelineEvents((current) => {
      const nextEvents = current.filter((eventSlot) => eventSlot.id !== eventId);

      setActiveEventId((currentId) => {
        if (currentId !== eventId) {
          return currentId;
        }

        return nextEvents[0]?.id ?? null;
      });

      return nextEvents;
    });
    setSaveStatus("Unsaved chart event changes");
  }

  function handleToggleAudio() {
    const audio = audioRef.current;

    if (!audio) {
      return;
    }

    if (audio.paused) {
      audio
        .play()
        .then(() => setIsAudioPlaying(true))
        .catch((error) => {
          console.error("Failed to play song", error);
          setIsAudioPlaying(false);
        });
      return;
    }

    audio.pause();
    setIsAudioPlaying(false);
  }

  function handleAudioSeek(time: number) {
    const audio = audioRef.current;

    if (!audio) {
      return;
    }

    audio.currentTime = Math.max(0, Math.min(time, audio.duration || time));
    setAudioCurrentTime(audio.currentTime);
  }

  function handleBackToSongChoice() {
    router.push(`${navBasePath}/song-choice`);
  }

  function handleLaunchGame() {
    if (!selectedSongLaunch) {
      setSaveStatus("Choose a Supabase song before launching the game.");
      return;
    }

    const launchParams = createSongLaunchSearchParams(selectedSongLaunch);

    persistLaunchParams(launchParams);
    router.push(navBasePath + "/game");
  }

  async function handleSaveToSupabase() {
    if (!selectedSongStorage) {
      setSaveStatus("No selected song asset is loaded.");
      return;
    }

    setIsSaving(true);
    setSaveStatus("Saving...");

    try {
      /*
       * IMPORTANT:
       * The .chart file is canonical gameplay data.
       *
       * The editor should NOT deserialize the chart into the project model
       * and serialize it back out. That round-trip can discard chart
       * difficulties/sections/metadata that the project model does not own.
       *
       * The editor saves the chart exactly as it was loaded and saves
       * lesson-specific changes through the sidecar.
       */
      const chartText = chartFile;

      if (!chartText.trim()) {
        throw new Error(
          "Cannot save lesson: original chart content is empty.",
        );
      }

      const sidecarJson = projectToSidecarJson(sidecar);

      const activityKey = inferSongActivityKeyFromChartPath(
        selectedSongStorage.chart.path,
      );

      const resolvedPaths = resolveSongAssetStoragePaths({
        activityKey,
        chartPath: selectedSongStorage.chart.path,
        sidecarPath:
          selectedSongStorage.sidecar?.path ??
          selectedSongStorage.chart.path.replace(/\.chart$/i, ".json"),
      });

      const response = await fetch("/api/lesson-builder/save", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          songAssetId: selectedSongStorage.id,
          activityKey,

          chart: {
            ...selectedSongStorage.chart,
            path: resolvedPaths.chartPath,
            content: chartText,
            contentType:
              selectedSongStorage.chart.contentType ??
              "text/plain;charset=utf-8",
          },

          sidecar: {
            ...(selectedSongStorage.sidecar ?? {
              bucket: "SidecarJsons",
              path: resolvedPaths.sidecarPath,
              contentType: "application/json;charset=utf-8",
            }),
            path: resolvedPaths.sidecarPath,
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
        throw new Error(
          result?.error ?? "Unable to save lesson files",
        );
      }

      setSaveStatus("Saved");
    } catch (error) {
      setSaveStatus(
        error instanceof Error
          ? error.message
          : "Unable to save lesson files",
      );
    } finally {
      setIsSaving(false);
    }
  }

  useEffect(() => {
    setStoreSidecar(sidecar as StoreSidecarPayload);
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

      setSelectedSongLaunch({
        songAssetId: selectedSong.id,
        activityKey:
          selectedSong.activityKey ??
          inferSongActivityKeyFromChartPath(selectedSong.chart.path) ??
          "number-bonds",
        chartUrl: selectedSong.chart.signedUrl,
        sidecarUrl: selectedSong.sidecar?.signedUrl ?? null,
        audioUrl: selectedSong.song.signedUrl,
      });

      setPendingSongFile(null);
      loadSidecarIntoTimeline(emptySidecar, null);
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
          const normalizedSidecar = normalizeSidecar(
            sidecarJson ?? emptySidecar,
          );

          setChartFile(nextChartFile);
          setUploadedChartName(nextChartName);
          loadSidecarIntoTimeline(normalizedSidecar, null);

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
    const raw = sessionStorage.getItem("ultrarapid_editor_payload");
    if (!raw) return;

    try {
      const payload: LessonBuilderPayload = JSON.parse(raw);
      const normalizedSidecar = normalizeSidecar(
        payload.rawResults ?? emptySidecar,
      );

      if (payload?.analysisMetadata) {
        setMetadata(payload.analysisMetadata);
      }

      if (payload?.chartFile) {
        setChartFile(payload.chartFile);

        if (payload.analysisMetadata?.uploadedFileName) {
          setUploadedChartName(payload.analysisMetadata.uploadedFileName);
        }

        loadSidecarIntoTimeline(normalizedSidecar, null);
        setProject(
          chartToProject({ ...payload, rawResults: normalizedSidecar }),
        );
      } else {
        loadSidecarIntoTimeline(normalizedSidecar, null);
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

    const nextAudioUrl = URL.createObjectURL(pendingSongFile);
    setAudioUrl(nextAudioUrl);
    console.info("Selected song file loaded for editor:", pendingSongFile.name);

    return () => {
      URL.revokeObjectURL(nextAudioUrl);
    };
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
        onSave={handleSaveToSupabase}
        onUploadSong={handleUploadSongFile}
        onUploadChart={handleUploadChartFile}
        onUploadSidecar={handleUploadSidecarJsonFile}
        songs={songs}
        onSelectSupabaseSong={handleSelectSupabaseSong}
        canLaunch={Boolean(selectedSongLaunch)}
        onLaunch={handleLaunchGame}
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
        {workspaceMode === "chartEditor" ? (
          <ChartEventsPanel
            currentTick={currentChartTick}
            events={timelineEvents}
            activeEventId={activeEventId}
            onAddEvent={handleAddChartEventAtCurrentTick}
            onDeleteEvent={handleDeleteChartEvent}
            onSelectEvent={handleSelectEvent}
          />
        ) : (
          <EquationsPanel
            savedEquations={savedEquations}
            onNewEquation={handleNewEquation}
          />
        )}

        <CenterEditorPanel
          workspaceMode={workspaceMode}
          onWorkspaceModeChange={setWorkspaceMode}
          mode={mode}
          timelineEvents={timelineEvents}
          activeEventId={activeEventId}
          draftTokens={draftTokens}
          customTokenLabel={customTokenLabel}
          audioUrl={audioUrl}
          audioRef={audioRef}
          isAudioPlaying={isAudioPlaying}
          audioCurrentTime={audioCurrentTime}
          audioDuration={audioDuration}
          currentChartTick={currentChartTick}
          chartFile={chartFile}
          sidecar={sidecar}
          onCustomTokenLabelChange={setCustomTokenLabel}
          onSelectEvent={handleSelectEvent}
          onInsertToken={handleInsertEquationToken}
          onRemoveToken={handleRemoveEquationToken}
          onSaveEquation={handleSaveEquation}
          onDropEquation={handleDropEquation}
          onAddHitBubblePair={handleAddHitBubblePair}
          onToggleSpinTarget={handleToggleSpinTarget}
          onToggleDragTarget={handleToggleDragTarget}
          onToggleAudio={handleToggleAudio}
          onAudioTimeUpdate={setAudioCurrentTime}
          onAudioDurationChange={setAudioDuration}
          onAudioSeek={handleAudioSeek}
        />

        <RightLessonPanel />
      </main>
    </div>
  );
}
