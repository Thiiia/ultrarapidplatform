"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { ChangeEvent, DragEvent, FC, PointerEvent, ReactNode, SVGProps } from "react";
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
  tick?: number;
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

type LessonBuilderClientProps = {
  navBasePath?: string;
};

type CenterChoice = "create" | "premade" | null;
type LibraryTab = "mine" | "premade";

/* VERIFIED_TIMELINE_HIDDEN_SCROLL_DRAG_HANDLE_PATCH */
/* VERIFIED_TIMELINE_UPLOAD_BUTTONS_PATCH: row 3 subrow 2 supports song/chart/sidecar uploads and updates timeline data. */
const pagePanelWidth = "92vw";
const headerHeight = "5.5vh";
const viewerRowHeight = "60vh";
const timelineRowHeight = `calc(40vh - ${headerHeight})`;
const headerBackgroundColor = "#060B15FC";
const row2Column1BackgroundColor = "#0A1222FA";
const row2Column2BackgroundColor = "#070C16FA";
const row2Column3BackgroundColor = "#09101FF7";
const row3BackgroundColor = "#060B15FC";
const pageBackgroundColor = "#060B15FC";
const panelBackgroundColor = "#2B2B2B";
const subtleBorderColor = "#FFFFFF14";
const textColor = "#FFFFFF";

const emptySidecar: SidecarPayload = {
  version: 1,
  events: [],
};

const gameplayMechanics: GameplayMechanic[] = ["hit", "spin", "drag"];
// Previous hard cap preserved for reference; event slots are no longer capped.
// const maxEditableEquationSlots = 5;

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

function makeMechanicInstance(tick?: number): MechanicInstanceState {
  return {
    id: makeId("mechanic"),
    ...(typeof tick === "number" ? { tick } : {}),
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

  const eventStartTicks = Array.from(
    new Set([
      ...equationEvents.map((event) => event.tick),
      ...fallbackEventTicks,
      ...(equationEvents.length === 0 && fallbackEventTicks.length === 0
        ? mechanicEvents.map((event) => event.tick)
        : []),
    ]),
  ).sort((left, right) => left - right);

  const expandedMechanicEvents = mechanicEvents.flatMap((mechanicEvent) => {
    const instanceCount =
      mechanicEvent.mechanic === "hit"
        ? Math.max(1, Math.round(Number(mechanicEvent.hits ?? 1)))
        : 1;

    return Array.from({ length: instanceCount }, (_, offset) => ({
      ...mechanicEvent,
      hits: mechanicEvent.mechanic === "hit" ? 1 : mechanicEvent.hits,
      instanceIndex:
        typeof mechanicEvent.instanceIndex === "number"
          ? mechanicEvent.instanceIndex + offset
          : undefined,
    }));
  });

  function eventStartTickForMechanicTick(mechanicTick: number) {
    const mechanicSeconds = timelineTickToSeconds(mechanicTick);

    return [...eventStartTicks]
      .reverse()
      .find((eventTick) => {
        const eventSeconds = timelineTickToSeconds(eventTick);

        return (
          mechanicSeconds >= eventSeconds &&
          mechanicSeconds < eventSeconds + timelineEventDurationSeconds
        );
      });
  }

  const slots = eventStartTicks.map((tick, index) => {
    const mechanicsInEvent = expandedMechanicEvents.filter(
      (event) => eventStartTickForMechanicTick(event.tick) === tick,
    );
    const equationsAtTick = equationEvents.filter(
      (event) => event.tick === tick,
    );
    const counts = makeEmptyMechanicCounts();

    mechanicsInEvent.forEach((mechanicEvent) => {
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

    const nextInstanceIndexByMechanic: Record<GameplayMechanic, number> = {
      hit: 0,
      spin: 0,
      drag: 0,
    };

    mechanicsInEvent.forEach((mechanicEvent) => {
      const mechanic = mechanicEvent.mechanic;
      const instanceIndex =
        mechanicEvent.instanceIndex ?? nextInstanceIndexByMechanic[mechanic];
      nextInstanceIndexByMechanic[mechanic] = Math.max(
        nextInstanceIndexByMechanic[mechanic],
        instanceIndex + 1,
      );

      const instance = slot.mechanicInstances[mechanic]?.[instanceIndex];

      if (!instance) {
        return;
      }

      instance.tick = mechanicEvent.tick;

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
      : typeof targetCount === "number"
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

    if (!equation || equation.tokens.length === 0) {
      return [];
    }

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
            tick: instance?.tick ?? event.tick,
            type: "ALG_MECHANIC",
            mechanic,
            instanceIndex,
            equationId,
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
        height: headerHeight,
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
        background: pageBackgroundColor,
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
            background: panelBackgroundColor,
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
        fontFamily: "Grandstander, sans-serif",
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
        border: `2px solid ${
          isActive ? "rgba(255, 53, 53, 0.72)" : "rgba(255,255,255,0.18)"
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
          fontFamily: "Grandstander, sans-serif",
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
        const path = `M ${arc.startX} ${arc.startY} C ${
          arc.startX + deltaX * 0.25
        } ${controlY}, ${arc.startX + deltaX * 0.75} ${controlY}, ${
          arc.endX
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
                  borderBottom: `3px solid ${
                    isActive ? "#CFFF04" : "transparent"
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
        // Previous embedded-center-panel sizing kept this at 60vh.
        // height: "60vh",
        // maxHeight: "60vh",
        height: "100%",
        maxHeight: "100%",
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
          // Previous embedded-center-panel sizing kept this at 60vh.
          // height: "60vh",
          // maxHeight: "60vh",
          height: "100%",
          maxHeight: "100%",
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

function formatTimelineTime(seconds: number) {
  const safeSeconds = Math.max(0, seconds);
  const minutes = Math.floor(safeSeconds / 60);
  const wholeSeconds = Math.floor(safeSeconds - minutes * 60);
  const hundredths = Math.floor((safeSeconds - Math.floor(safeSeconds)) * 100);

  return `${minutes}:${String(wholeSeconds).padStart(2, "0")}.${String(hundredths).padStart(2, "0")}`;
}

function formatSongTime(seconds: number) {
  return formatTimelineTime(seconds);
}

function timelineTickToSeconds(tick: number) {
  if (!Number.isFinite(tick)) {
    return 0;
  }

  // Existing song assets appear to store event timing as ticks. Treat large
  // values as milliseconds for this visual pass, and small values as seconds.
  return tick > 1000 ? tick / 1000 : tick;
}

const timelineEventDurationSeconds = 8;

function findTimelineEventAtSeconds(
  events: TimelineEventSlot[],
  seconds: number,
) {
  const safeSeconds = Math.max(0, seconds);

  return events.find((eventSlot) => {
    const eventStartSeconds = timelineTickToSeconds(eventSlot.tick);
    return (
      safeSeconds >= eventStartSeconds &&
      safeSeconds < eventStartSeconds + timelineEventDurationSeconds
    );
  });
}

function getDownloadBaseName(name: string, fallback: string) {
  const trimmedName = name.trim();

  if (!trimmedName) {
    return fallback;
  }

  return trimmedName.replace(/\.[^.]+$/, "") || fallback;
}

function downloadTextFile(fileName: string, text: string, contentType: string) {
  const blob = new Blob([text], { type: contentType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function buildWaveformPeaksFromChannelData(channelData: Float32Array, peakCount: number) {
  const safePeakCount = Math.max(1, Math.round(peakCount));
  const samplesPerPeak = Math.max(1, Math.floor(channelData.length / safePeakCount));

  return Array.from({ length: safePeakCount }, (_, peakIndex) => {
    const start = peakIndex * samplesPerPeak;
    const end = Math.min(channelData.length, start + samplesPerPeak);
    let peak = 0;

    for (let sampleIndex = start; sampleIndex < end; sampleIndex += 1) {
      peak = Math.max(peak, Math.abs(channelData[sampleIndex] ?? 0));
    }

    return peak;
  });
}

function buildSmoothWaveformPath(peaks: number[], width: number, height: number) {
  if (!peaks.length) {
    return `M 0 ${height / 2} L ${width} ${height / 2}`;
  }

  const safeWidth = Math.max(1, width);
  const safeHeight = Math.max(1, height);
  const baseline = safeHeight / 2;
  const points = peaks.map((peak, index) => {
    const x = peaks.length === 1 ? safeWidth / 2 : (index / (peaks.length - 1)) * safeWidth;
    const amplitude = Math.max(2, peak * safeHeight * 0.8);
    const y = baseline + ((index % 2 === 0 ? 1 : -1) * 0.08 + 0.92) * amplitude / 2;

    return { x, y };
  });

  if (points.length === 1) {
    return `M ${points[0].x} ${points[0].y} L ${points[0].x} ${points[0].y}`;
  }

  const pathSegments: string[] = [`M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`];

  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1];
    const current = points[index];
    const midpointX = (previous.x + current.x) / 2;
    const midpointY = (previous.y + current.y) / 2;
    pathSegments.push(`Q ${previous.x.toFixed(2)} ${previous.y.toFixed(2)} ${midpointX.toFixed(2)} ${midpointY.toFixed(2)}`);
    pathSegments.push(`T ${current.x.toFixed(2)} ${current.y.toFixed(2)}`);
  }

  return pathSegments.join(" ");
}

function TimelineMarkerDots({
  color,
  lefts,
}: {
  color: string;
  lefts: number[];
}) {
  if (lefts.length === 0) {
    return null;
  }

  return (
    <>
      {lefts.map((left, dotIndex) => (
        <span
          key={dotIndex}
          aria-hidden="true"
          style={{
            position: "absolute",
            left,
            top: "50%",
            width: 9,
            height: 9,
            borderRadius: 999,
            background: color,
            boxShadow: `0 0 12px ${color}`,
            transform: "translate(-50%, -50%)",
          }}
        />
      ))}
    </>
  );
}

/* VERIFIED_LAYOUT_PATCH_2026_06_23: row2 shrinks; timeline has no horizontal scrollbar; draggable playhead controls song time; shared equation tiles. */
function EquationTimeline({
  events,
  activeEventId,
  onSelectEvent,
  currentSongSeconds,
  durationSeconds,
  waveformPeaks,
  onSeek,
}: {
  events: TimelineEventSlot[];
  activeEventId: string | null;
  onSelectEvent: (eventId: string) => void;
  currentSongSeconds: number;
  durationSeconds: number;
  waveformPeaks: number[];
  onSeek: (seconds: number) => void;
}) {
  const timelineTrackRef = useRef<HTMLDivElement | null>(null);
  const [isDraggingPlayhead, setIsDraggingPlayhead] = useState(false);
  const [viewportWidth, setViewportWidth] = useState(typeof window !== "undefined" ? window.innerWidth : 1280);
  const blockDurationSeconds = 8;
  const blockWidthPx = Math.max(96, viewportWidth * 0.05);
  useEffect(() => {
    const handleResize = () => {
      setViewportWidth(window.innerWidth);
    };

    handleResize();
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []);
  const pixelsPerSecond = blockWidthPx / blockDurationSeconds;
  const maxTimelineSeconds = events.reduce((maxSeconds, eventSlot) => {
    const eventStartSeconds = timelineTickToSeconds(eventSlot.tick);
    const eventEndSeconds = eventStartSeconds + timelineEventDurationSeconds;
    const mechanicSeconds = gameplayMechanics.flatMap((mechanic) =>
      (eventSlot.mechanicInstances?.[mechanic] ?? []).map((instance) =>
        timelineTickToSeconds(instance.tick ?? eventSlot.tick),
      ),
    );

    return Math.max(maxSeconds, eventEndSeconds, ...mechanicSeconds);
  }, 0);
  const visualDurationSeconds = Math.max(
    timelineEventDurationSeconds,
    durationSeconds,
    maxTimelineSeconds,
  );
  const blockCount = Math.max(1, Math.ceil(visualDurationSeconds / blockDurationSeconds));
  const playheadMaxLeft = visualDurationSeconds * pixelsPerSecond;
  const endScrollBuffer = 260;
  const trackWidth = Math.max(blockCount * blockWidthPx + endScrollBuffer, blockWidthPx);
  const playheadLeft = Math.min(
    playheadMaxLeft,
    Math.max(0, currentSongSeconds * pixelsPerSecond),
  );
  const labelRows = [
    { key: "merged", label: "", color: "#FFFFFF" },
    { key: "equations", label: "Equations", color: "#CFFF04" },
    { key: "hits", label: "Hits", color: "#2EA7FF" },
    { key: "spinouts", label: "Spinouts", color: "#FF3535" },
    { key: "drags", label: "Drags", color: "#B45CFF" },
  ];

  function getSecondsFromClientX(clientX: number, options: { autoScroll?: boolean } = {}) {
    const track = timelineTrackRef.current;

    if (!track) {
      return currentSongSeconds;
    }

    const rect = track.getBoundingClientRect();

    if (options.autoScroll) {
      const edgeThreshold = 54;
      const scrollStep = 8;

      if (clientX > rect.right - edgeThreshold) {
        track.scrollLeft = Math.min(
          track.scrollWidth - track.clientWidth,
          track.scrollLeft + scrollStep,
        );
      }

      if (clientX < rect.left + edgeThreshold) {
        track.scrollLeft = Math.max(0, track.scrollLeft - scrollStep);
      }
    }

    const xWithinScrollableTrack = clientX - rect.left + track.scrollLeft;

    return Math.max(
      0,
      Math.min(visualDurationSeconds, xWithinScrollableTrack / pixelsPerSecond),
    );
  }

  function seekFromClientX(
    clientX: number,
    options: { snapToWholeSecond?: boolean; autoScroll?: boolean } = {},
  ) {
    const seconds = getSecondsFromClientX(clientX, {
      autoScroll: options.autoScroll,
    });
    const snappedSeconds = options.snapToWholeSecond
      ? Math.round(seconds)
      : Math.round(seconds * 50) / 50;

    onSeek(snappedSeconds);
  }

  function handleTimelinePointerDown(event: PointerEvent<HTMLDivElement>) {
    const target = event.target as HTMLElement | null;

    if (target?.closest("[data-timeline-interactive='true']")) {
      return;
    }

    event.preventDefault();
    seekFromClientX(event.clientX, { snapToWholeSecond: true });
  }

  function handlePlayheadPointerDown(event: PointerEvent<HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();
    setIsDraggingPlayhead(true);
    event.currentTarget.setPointerCapture(event.pointerId);
    seekFromClientX(event.clientX);
  }

  function handlePlayheadPointerMove(event: PointerEvent<HTMLDivElement>) {
    if (!isDraggingPlayhead) {
      return;
    }

    event.preventDefault();
    seekFromClientX(event.clientX, { autoScroll: true });
  }

  function handlePlayheadPointerUp(event: PointerEvent<HTMLDivElement>) {
    if (isDraggingPlayhead) {
      event.preventDefault();
      seekFromClientX(event.clientX, { autoScroll: true });
    }

    setIsDraggingPlayhead(false);

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  return (
    <section
      aria-label="Timeline"
      style={{
        width: "100%",
        height: "100%",
        minHeight: 0,
        background: row3BackgroundColor,
        borderTop: `1px solid ${subtleBorderColor}`,
        boxSizing: "border-box",
        overflow: "visible",
        fontFamily: "Space Grotesk, sans-serif",
        display: "grid",
        gridTemplateColumns: "12.5vw minmax(0, 1fr)",
      }}
    >
      <div
        aria-label="Timeline labels"
        style={{
          minHeight: 0,
          height: "100%",
          display: "grid",
          gridTemplateRows: "15% repeat(5, 17%)",
          background: row3BackgroundColor,
          borderRight: `1px solid ${subtleBorderColor}`,
          boxSizing: "border-box",
        }}
      >
        <div
          style={{
            gridRow: "1 / span 2",
            borderBottom: `1px solid ${subtleBorderColor}`,
            boxSizing: "border-box",
          }}
        />
        {labelRows.slice(1).map((row) => (
          <div
            key={row.key}
            style={{
              display: "flex",
              alignItems: "center",
              paddingLeft: 16,
              borderBottom: `1px solid ${subtleBorderColor}`,
              boxSizing: "border-box",
              color: row.color,
              fontSize: 13,
              fontWeight: 900,
              textTransform: "uppercase",
              letterSpacing: 0.4,
            }}
          >
            {row.label}
          </div>
        ))}
      </div>

      <div
        ref={timelineTrackRef}
        aria-label="Timeline tracks"
        className="ur-hidden-horizontal-scroll"
        style={{
          position: "relative",
          minWidth: 0,
          minHeight: 0,
          overflowX: "auto",
          overflowY: "visible",
          background: row3BackgroundColor,
        }}
      >
        <div
          onPointerDown={handleTimelinePointerDown}
          style={{
            position: "relative",
            width: trackWidth,
            minWidth: "100%",
            height: "100%",
            display: "grid",
            gridTemplateRows: "15% repeat(5, 17%)",
            cursor: "crosshair",
          }}
        >
          <div
            style={{
              position: "absolute",
              left: playheadLeft,
              top: -20,
              bottom: 0,
              width: 28,
              zIndex: 30,
              transform: "translateX(-50%)",
              cursor: isDraggingPlayhead ? "grabbing" : "grab",
              touchAction: "none",
              pointerEvents: "auto",
            }}
            role="slider"
            data-timeline-interactive="true"
            aria-label="Song position"
            aria-valuemin={0}
            aria-valuemax={Math.round(visualDurationSeconds)}
            aria-valuenow={Math.round(currentSongSeconds)}
            tabIndex={0}
            onPointerDown={handlePlayheadPointerDown}
            onPointerMove={handlePlayheadPointerMove}
            onPointerUp={handlePlayheadPointerUp}
            onPointerCancel={handlePlayheadPointerUp}
          >
            <span
              aria-hidden="true"
              style={{
                position: "absolute",
                left: "50%",
                top: -2,
                width: 0,
                height: 0,
                borderLeft: "8px solid transparent",
                borderRight: "8px solid transparent",
                borderTop: "12px solid #CFFF04",
                transform: "translateX(-50%)",
                filter: "drop-shadow(0 0 12px rgba(207,255,4,0.78))",
              }}
            />
            <span
              aria-hidden="true"
              style={{
                position: "absolute",
                left: "50%",
                top: 20,
                bottom: 0,
                width: 3,
                background: "#CFFF04",
                boxShadow: "0 0 18px rgba(207,255,4,0.78)",
                transform: "translateX(-50%)",
              }}
            />
          </div>

          <div
            aria-hidden="true"
            style={{
              position: "absolute",
              inset: 0,
              zIndex: 0,
              pointerEvents: "none",
            }}
          >
            {Array.from({ length: blockCount }, (_, blockIndex) => {
              const markerLeft = blockIndex * blockWidthPx;

              return (
                <span
                  key={`timeline-grid-${blockIndex}`}
                  style={{
                    position: "absolute",
                    left: markerLeft,
                    top: 0,
                    bottom: 0,
                    width: 1,
                    background: "rgba(207,255,4,0.34)",
                    transform: "translateX(-0.5px)",
                  }}
                />
              );
            })}
          </div>

          <div
            style={{
              position: "relative",
              borderBottom: `1px solid ${subtleBorderColor}`,
              boxSizing: "border-box",
              zIndex: 2,
            }}
          >
            {Array.from({ length: blockCount }, (_, blockIndex) => {
              const markerLeft = blockIndex * blockWidthPx;
              const startSeconds = blockIndex * blockDurationSeconds;

              return (
                <span
                  key={`timeline-label-${blockIndex}`}
                  style={{
                    position: "absolute",
                    left: markerLeft + 6,
                    top: 7,
                    color: "#FFFFFF99",
                    fontSize: 10,
                    fontWeight: 900,
                    whiteSpace: "nowrap",
                    pointerEvents: "none",
                  }}
                >
                  {formatTimelineTime(startSeconds)}
                </span>
              );
            })}
          </div>

          <div
            style={{
              position: "relative",
              borderBottom: `1px solid ${subtleBorderColor}`,
              boxSizing: "border-box",
              overflow: "hidden",
            }}
          >
            {waveformPeaks.length > 0 ? (
              <svg
                aria-label="Song waveform"
                width={trackWidth}
                height="100%"
                viewBox={`0 0 ${trackWidth} 100`}
                preserveAspectRatio="none"
                style={{ position: "absolute", inset: 0, display: "block" }}
              >
                <path
                  d={buildSmoothWaveformPath(waveformPeaks, trackWidth, 100)}
                  fill="none"
                  stroke="#CFFF04"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity="0.96"
                />
              </svg>
            ) : (
              <div
                style={{
                  height: "100%",
                  display: "flex",
                  alignItems: "center",
                  paddingLeft: 16,
                  color: "#FFFFFF66",
                  fontSize: 12,
                  fontWeight: 800,
                }}
              >
                Waveform loads after the selected song file is decoded.
              </div>
            )}
          </div>

          <div
            style={{
              position: "relative",
              borderBottom: `1px solid ${subtleBorderColor}`,
              boxSizing: "border-box",
            }}
          >
            {events.length === 0 ? (
              <div
                style={{
                  height: "100%",
                  display: "flex",
                  alignItems: "center",
                  paddingLeft: 16,
                  color: "#FFFFFF66",
                  fontSize: 12,
                  fontWeight: 800,
                }}
              >
                No timeline events yet.
              </div>
            ) : (
              events.map((eventSlot, index) => {
                const eventSeconds = timelineTickToSeconds(eventSlot.tick);
                const eventLeft = Math.min(
                  trackWidth,
                  Math.max(0, eventSeconds * pixelsPerSecond),
                );
                const eventWidth = Math.max(
                  44,
                  timelineEventDurationSeconds * pixelsPerSecond,
                );
                const isActive = eventSlot.id === activeEventId;
                const assignedEquation = getTimelineEventEquation(eventSlot);

                return (
                  <button
                    key={eventSlot.id}
                    type="button"
                    data-timeline-interactive="true"
                    onPointerDown={(event) => event.stopPropagation()}
                    onClick={() => onSelectEvent(eventSlot.id)}
                    style={{
                      position: "absolute",
                      left: eventLeft,
                      top: "50%",
                      width: eventWidth,
                      minWidth: 44,
                      minHeight: 30,
                      transform: "translateY(-50%)",
                      borderRadius: 10,
                      border: `2px solid ${isActive ? "#CFFF04" : subtleBorderColor}`,
                      background: isActive ? "#252525" : "#202020",
                      color: "#FFFFFF",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 8,
                      padding: "4px 8px",
                      boxSizing: "border-box",
                      cursor: "pointer",
                      overflow: "hidden",
                    }}
                  >
                    {assignedEquation ? (
                      <EquationTileStrip tokens={assignedEquation.tokens} compact />
                    ) : (
                      <span style={{ fontSize: 11, fontWeight: 900 }}>
                        Event {index + 1}
                      </span>
                    )}
                  </button>
                );
              })
            )}
          </div>

          {(["hit", "spin", "drag"] as GameplayMechanic[]).map((mechanic) => {
            const color =
              mechanic === "hit" ? "#2EA7FF" : mechanic === "spin" ? "#FF3535" : "#B45CFF";

            return (
              <div
                key={mechanic}
                style={{
                  position: "relative",
                  borderBottom: `1px solid ${subtleBorderColor}`,
                  boxSizing: "border-box",
                }}
              >
                {events.map((eventSlot) => {
                  const instances = eventSlot.mechanicInstances?.[mechanic] ?? [];
                  const fallbackCount = Math.max(
                    0,
                    (eventSlot.counts?.[mechanic] ?? 0) - instances.length,
                  );
                  const markerTicks = [
                    ...instances.map((instance) => instance.tick ?? eventSlot.tick),
                    ...Array.from({ length: fallbackCount }, () => eventSlot.tick),
                  ];
                  const lefts = markerTicks.map((tick) => {
                    const markerSeconds = timelineTickToSeconds(tick);

                    return Math.min(
                      trackWidth,
                      Math.max(0, markerSeconds * pixelsPerSecond),
                    );
                  });

                  return (
                    <TimelineMarkerDots
                      key={`${eventSlot.id}-${mechanic}`}
                      color={color}
                      lefts={lefts}
                    />
                  );
                })}
              </div>
            );
          })}
        </div>
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
        // The top-level viewer row now controls panel height.
        // height: "calc(100vh - 142px)",
        // minHeight: "calc(100vh - 142px)",
        height: "100%",
        minHeight: 0,
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

function getEquationTileKind(label: string): "number" | "operator" | "variable" {
  if (isEquationOperator(label)) {
    return "operator";
  }

  if (/^\d+$/.test(label)) {
    return "number";
  }

  return "variable";
}

function getEquationTileStyle({
  label,
  compact = false,
  disabled = false,
}: {
  label: string;
  compact?: boolean;
  disabled?: boolean;
}) {
  const kind = getEquationTileKind(label);
  const isOperator = kind === "operator";

  return {
    width: compact ? (isOperator ? 44 : 42) : "100%",
    minWidth: compact ? (isOperator ? 44 : 42) : 0,
    height: compact ? (isOperator ? 28 : 34) : undefined,
    minHeight: compact ? undefined : isOperator ? 26 : 42,
    borderRadius: isOperator ? 999 : 12,
    border: `1px solid ${isOperator ? "#CFFF04" : "rgba(255,255,255,0.18)"}`,
    background: isOperator ? "rgba(207,255,4,0.12)" : "#191919",
    color: isOperator ? "#CFFF04" : "#FFFFFF",
    fontFamily: "Grandstander, sans-serif",
    fontSize: compact ? (isOperator ? 14 : 17) : isOperator ? 14 : 20,
    fontWeight: 800,
    boxShadow: "0 10px 22px rgba(0,0,0,0.18)",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    opacity: disabled ? 0.55 : 1,
    boxSizing: "border-box" as const,
  };
}

function EquationTileButton({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      key={label}
      type="button"
      onClick={onClick}
      style={{
        ...getEquationTileStyle({ label }),
        cursor: "pointer",
      }}
    >
      {label}
    </button>
  );
}

function EquationTileStrip({
  tokens,
  emptyLabel = "Equation preview",
  compact = true,
}: {
  tokens: EquationToken[];
  emptyLabel?: string;
  compact?: boolean;
}) {
  if (tokens.length === 0) {
    return (
      <span style={{ color: "#FFFFFF66", fontSize: 11, fontWeight: 800 }}>
        {emptyLabel}
      </span>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        flexWrap: "wrap",
        maxWidth: "100%",
        minWidth: 0,
      }}
    >
      {tokens.map((token) => (
        <span key={token.id} style={getEquationTileStyle({ label: token.label, compact })}>
          {token.label}
        </span>
      ))}
    </div>
  );
}

function LeftEquationBuilderPanel({
  draftTokens,
  onAddToken,
  onClearEquation,
  onSaveEquation,
  shouldScrollTiles,
}: {
  draftTokens: EquationToken[];
  onAddToken: (label: string) => void;
  onClearEquation: () => void;
  onSaveEquation: () => void;
  shouldScrollTiles: boolean;
}) {
  const numberTiles = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"];
  const operatorTiles = ["+", "-", "×", "÷", "="];
  const variableTiles = ["X", "Y", "Z"];
  const hasDraft = draftTokens.length > 0;

  function renderTile(label: string, kind: "number" | "operator" | "variable") {
    return <EquationTileButton key={`${kind}-${label}`} label={label} onClick={() => onAddToken(label)} />;
  }

  return (
    <section
      aria-label="Equation builder column"
      style={{
        width: "100%",
        height: "100%",
        minHeight: 0,
        minWidth: 0,
        background: row2Column1BackgroundColor,
        color: textColor,
        borderRight: `1px solid ${subtleBorderColor}`,
        boxSizing: "border-box",
        overflow: "hidden",
        display: "grid",
        gridTemplateRows: "calc(60vh * 0.1) minmax(0, 1fr) calc(60vh * 0.15)",
      }}
    >
      <div
        style={{
          minHeight: 0,
          padding: "10px 10px 8px",
          borderBottom: `1px solid ${subtleBorderColor}`,
          boxSizing: "border-box",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "flex-start",
          gap: 4,
          fontFamily: "Space Grotesk, sans-serif",
        }}
      >
        <div style={{ fontSize: 13, fontWeight: 900, lineHeight: 1.1 }}>
          Equation Builder
        </div>
        <div
          style={{
            color: "#CFFF04",
            fontSize: 11,
            fontWeight: 900,
            letterSpacing: "0.03em",
            textTransform: "uppercase",
            animation: "urFlash 900ms ease-in-out infinite alternate",
          }}
        >
          Start Here
        </div>
      </div>

      <div
        style={{
          minHeight: 0,
          padding: 10,
          boxSizing: "border-box",
          overflowY: "auto",
          fontFamily: "Space Grotesk, sans-serif",
        }}
      >
        <div style={{ display: "grid", gap: 12 }}>
          <div>
            <div style={{ color: "#FFFFFF99", fontSize: 10, fontWeight: 900, marginBottom: 6, textTransform: "uppercase" }}>
              Numbers
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 6 }}>
              {numberTiles.map((label) => renderTile(label, "number"))}
            </div>
          </div>

          <div>
            <div style={{ color: "#FFFFFF99", fontSize: 10, fontWeight: 900, marginBottom: 6, textTransform: "uppercase" }}>
              Operators
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 6 }}>
              {operatorTiles.map((label) => renderTile(label, "operator"))}
            </div>
          </div>

          <div>
            <div style={{ color: "#FFFFFF99", fontSize: 10, fontWeight: 900, marginBottom: 6, textTransform: "uppercase" }}>
              Variables
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 6 }}>
              {variableTiles.map((label) => renderTile(label, "variable"))}
            </div>
          </div>
        </div>
      </div>

      <div
        style={{
          minHeight: 0,
          padding: 8,
          borderTop: `1px solid ${subtleBorderColor}`,
          boxSizing: "border-box",
          display: "grid",
          gridTemplateRows: "1fr auto auto",
          gap: 6,
          fontFamily: "Space Grotesk, sans-serif",
        }}
      >
        <div
          style={{
            border: "1px dashed rgba(255,255,255,0.36)",
            borderRadius: 10,
            color: "#FFFFFF99",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center",
            fontSize: 10,
            fontWeight: 800,
            lineHeight: 1.15,
            padding: "4px 6px",
          }}
        >
          ↑ Click a tile to begin
        </div>

        <div
          aria-label="Draft equation preview"
          style={{
            minHeight: 22,
            borderRadius: 8,
            background: "#191919",
            border: `1px solid ${subtleBorderColor}`,
            color: hasDraft ? "#FFFFFF" : "#FFFFFF66",
            display: "flex",
            alignItems: "center",
            gap: 4,
            overflow: "hidden",
            padding: "2px 6px",
            boxSizing: "border-box",
            fontSize: 11,
            fontWeight: 800,
            whiteSpace: "nowrap",
          }}
        >
          {hasDraft ? tokensToEquationState(draftTokens) : "Equation preview"}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1.45fr", gap: 6 }}>
          <button
            type="button"
            onClick={onClearEquation}
            disabled={!hasDraft}
            style={{
              minHeight: 26,
              borderRadius: 8,
              border: `1px solid ${subtleBorderColor}`,
              background: "#252525",
              color: hasDraft ? "#FFFFFF" : "#FFFFFF66",
              fontSize: 10,
              fontWeight: 900,
              cursor: hasDraft ? "pointer" : "not-allowed",
            }}
          >
            Clear
          </button>
          <button
            type="button"
            onClick={onSaveEquation}
            disabled={!hasDraft}
            style={{
              minHeight: 26,
              borderRadius: 8,
              border: `1px solid ${hasDraft ? "#CFFF04" : subtleBorderColor}`,
              background: hasDraft ? "#CFFF04" : "#252525",
              color: hasDraft ? "#000000" : "#FFFFFF66",
              fontSize: 10,
              fontWeight: 900,
              cursor: hasDraft ? "pointer" : "not-allowed",
            }}
          >
            Save Equation
          </button>
        </div>
      </div>
    </section>
  );
}

function CenterChoicePanel({
  choice,
  draftTokens,
  activeEventEquation,
  hasInspector,
  onCreateEquation,
  onBrowseLibrary,
}: {
  choice: CenterChoice;
  draftTokens: EquationToken[];
  activeEventEquation: SavedEquation | null;
  hasInspector: boolean;
  onCreateEquation: () => void;
  onBrowseLibrary: () => void;
}) {
  const isCreate = choice === "create";
  const isPremade = choice === "premade";
  const hasDraft = draftTokens.length > 0;
  const visibleEquationTokens = hasDraft ? draftTokens : activeEventEquation?.tokens ?? [];
  const visibleEquationLabel = hasDraft
    ? "Current equation being built"
    : activeEventEquation
      ? "Equation assigned to selected event"
      : "";
  const title = isCreate
    ? "Build your equation"
    : isPremade
      ? "Choose a pre-made equation"
      : "Build or choose a pre-made equation";
  const subtitle = isCreate
    ? "Use the builder on the left, then assign it to a timeline event."
    : isPremade
      ? "Select an equation from the library, then click a timeline event to assign it."
      : "Create an equation from scratch or start with a curriculum-aligned equation";

  return (
    <section
      aria-label="Equation workspace choice"
      style={{
        width: "100%",
        height: "100%",
        minHeight: 0,
        minWidth: 0,
        background: row2Column2BackgroundColor,
        color: textColor,
        boxSizing: "border-box",
        overflow: "hidden",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 32,
        fontFamily: "Space Grotesk, sans-serif",
      }}
    >
      <div
        style={{
          width: "min(720px, 92%)",
          display: "grid",
          justifyItems: "center",
          gap: 18,
          textAlign: "center",
        }}
      >
        <URIcon
          aria-label="UltraRapid"
          style={{
            width: 220,
            height: 50,
            display: "block",
            overflow: "visible",
            animation: "urFlash 1s ease-in-out infinite alternate",
          }}
        />

        <div style={{ display: "grid", gap: 8 }}>
          <h1 style={{ margin: 0, color: "#FFFFFF", fontSize: 30, lineHeight: 1.1, fontWeight: 900 }}>
            {title}
          </h1>
          <p style={{ margin: 0, color: "#FFFFFF99", fontSize: 15, lineHeight: 1.4, fontWeight: 700 }}>
            {subtitle}
          </p>
        </div>

        {choice === null ? (
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center" }}>
            <button
              type="button"
              onClick={onCreateEquation}
              style={{
                minWidth: 178,
                minHeight: 46,
                borderRadius: 14,
                border: "1px solid #CFFF04",
                background: "#CFFF04",
                color: "#000000",
                fontSize: 14,
                fontWeight: 900,
                cursor: "pointer",
              }}
            >
              Create Equation
            </button>
            <button
              type="button"
              onClick={onBrowseLibrary}
              style={{
                minWidth: 220,
                minHeight: 46,
                borderRadius: 14,
                border: `1px solid ${subtleBorderColor}`,
                background: "#2B2B2B",
                color: "#FFFFFF",
                fontSize: 14,
                fontWeight: 900,
                cursor: "pointer",
              }}
            >
              Browse Pre-Made Library
            </button>
          </div>
        ) : (
          <div
            style={{
              color: "#CFFF04",
              fontSize: 16,
              fontWeight: 900,
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            {isCreate ? "← Start in the Equation Builder" : "Browse the Pre-Made Library →"}
          </div>
        )}

        {visibleEquationTokens.length > 0 ? (
          <div
            aria-label={visibleEquationLabel}
            style={{
              marginTop: 8,
              minHeight: 96,
              width: "min(620px, 100%)",
              borderRadius: 18,
              border: `1px solid ${hasDraft ? "#CFFF04" : subtleBorderColor}`,
              background: "#202020",
              display: "grid",
              alignContent: "center",
              justifyItems: "center",
              gap: 10,
              padding: 18,
              boxSizing: "border-box",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                color: hasDraft ? "#CFFF04" : "#FFFFFF99",
                fontSize: 11,
                fontWeight: 900,
                textTransform: "uppercase",
                letterSpacing: 0.4,
              }}
            >
              {visibleEquationLabel}
            </div>
            <EquationTileStrip tokens={visibleEquationTokens} compact />
          </div>
        ) : null}
      </div>
    </section>
  );
}

function LibraryPanel({
  activeTab,
  savedEquations,
  activeEventId,
  selectedEquationId,
  onTabChange,
  onSelectEquation,
  onAddSelectedEquationToEvent,
  shouldScrollLibrary,
}: {
  activeTab: LibraryTab;
  savedEquations: SavedEquation[];
  activeEventId: string | null;
  selectedEquationId: string | null;
  onTabChange: (tab: LibraryTab) => void;
  onSelectEquation: (equationId: string) => void;
  onAddSelectedEquationToEvent: () => void;
  shouldScrollLibrary: boolean;
}) {
  const canAddEquation = activeTab === "mine" && Boolean(activeEventId && selectedEquationId);

  return (
    <section
      aria-label="Equation library"
      style={{
        width: "100%",
        height: "100%",
        minHeight: 0,
        minWidth: 0,
        background: row2Column3BackgroundColor,
        color: textColor,
        borderLeft: `1px solid ${subtleBorderColor}`,
        boxSizing: "border-box",
        overflow: "hidden",
        display: "grid",
        gridTemplateRows: "10% 90%",
        fontFamily: "Space Grotesk, sans-serif",
      }}
    >
      <div
        style={{
          minHeight: 0,
          padding: "8px 8px 6px",
          borderBottom: `1px solid ${subtleBorderColor}`,
          boxSizing: "border-box",
          display: "grid",
          alignContent: "center",
          gap: 6,
        }}
      >
        <div style={{ textAlign: "left", fontSize: 13, fontWeight: 900 }}>Library</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4 }}>
          {(["mine", "premade"] as LibraryTab[]).map((tab) => {
            const isActive = activeTab === tab;
            return (
              <button
                key={tab}
                type="button"
                onClick={() => onTabChange(tab)}
                style={{
                  minHeight: 24,
                  borderRadius: 8,
                  border: `1px solid ${isActive ? "#CFFF04" : subtleBorderColor}`,
                  background: isActive ? "rgba(207,255,4,0.12)" : "#252525",
                  color: isActive ? "#CFFF04" : "#FFFFFF99",
                  fontSize: 9,
                  fontWeight: 900,
                  cursor: "pointer",
                  padding: "0 4px",
                }}
              >
                {tab === "mine" ? "My Equations" : "Pre-Made"}
              </button>
            );
          })}
        </div>
      </div>

      <div
        style={{
          minHeight: 0,
          padding: 10,
          boxSizing: "border-box",
          display: "grid",
          gridTemplateRows: "minmax(0, 1fr) auto",
          gap: 10,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            minHeight: 0,
            overflowY: shouldScrollLibrary ? "auto" : "hidden",
            paddingRight: shouldScrollLibrary ? 4 : 0,
            boxSizing: "border-box",
          }}
        >
          {activeTab === "mine" ? (
            savedEquations.length === 0 ? (
              <div style={{ color: "#FFFFFF80", fontSize: 11, fontWeight: 700, lineHeight: 1.35 }}>
                Saved equations will appear here.
              </div>
            ) : (
              <div style={{ display: "grid", gap: 10 }}>
                {savedEquations.map((equation) => {
                  const isSelected = equation.id === selectedEquationId;

                  return (
                    <button
                      key={equation.id}
                      type="button"
                      draggable
                      onClick={() => onSelectEquation(equation.id)}
                      onDragStart={(event) => {
                        event.dataTransfer.setData(
                          "application/x-saved-equation",
                          JSON.stringify(equation),
                        );
                        event.dataTransfer.effectAllowed = "copy";
                      }}
                      style={{
                        minHeight: 52,
                        padding: 6,
                        borderRadius: 10,
                        border: `2px solid ${isSelected ? "#CFFF04" : subtleBorderColor}`,
                        background: isSelected ? "rgba(207,255,4,0.10)" : "#191919",
                        color: textColor,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        cursor: "pointer",
                      }}
                      title={tokensToEquationState(equation.tokens)}
                    >
                      <span
                        style={{
                          width: "100%",
                          color: textColor,
                          fontSize: 11,
                          fontWeight: 900,
                          lineHeight: 1.25,
                          textAlign: "center",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "normal",
                          wordBreak: "break-word",
                        }}
                      >
                        {tokensToEquationState(equation.tokens)}
                      </span>
                    </button>
                  );
                })}
              </div>
            )
          ) : (
            <div style={{ color: "#FFFFFF66", fontSize: 11, fontWeight: 700, lineHeight: 1.35 }} />
          )}
        </div>

        {activeEventId ? (
          <button
            type="button"
            onClick={onAddSelectedEquationToEvent}
            disabled={!canAddEquation}
            style={{
              width: "100%",
              minHeight: 34,
              borderRadius: 10,
              border: `1px solid ${canAddEquation ? "#CFFF04" : subtleBorderColor}`,
              background: canAddEquation ? "#CFFF04" : "#252525",
              color: canAddEquation ? "#000000" : "#FFFFFF66",
              fontSize: 10,
              fontWeight: 900,
              cursor: canAddEquation ? "pointer" : "not-allowed",
            }}
          >
            Add Equation
          </button>
        ) : null}
      </div>
    </section>
  );
}

function InspectorPanel({
  eventSlot,
  eventIndex,
}: {
  eventSlot: TimelineEventSlot | null;
  eventIndex: number;
}) {
  if (!eventSlot) {
    return null;
  }

  const selectedEventSlot = eventSlot;
  const assignedEquation = getTimelineEventEquation(selectedEventSlot);
  const assignedEquationText = assignedEquation
    ? tokensToEquationState(assignedEquation.tokens)
    : "No equation assigned";

  function getMechanicRows(mechanic: GameplayMechanic) {
    const count = Math.max(0, selectedEventSlot.counts?.[mechanic] ?? 0);
    const instances = selectedEventSlot.mechanicInstances?.[mechanic] ?? [];

    if (count === 0) {
      return ["None"];
    }

    return Array.from({ length: count }, (_, index) => {
      const instanceTick = instances[index]?.tick ?? selectedEventSlot.tick;
      const timestamp = formatTimelineTime(timelineTickToSeconds(instanceTick));
      const label =
        mechanic === "hit" ? "Hit" : mechanic === "spin" ? "Spin" : "Drag";

      return `${label} ${index + 1} @ ${timestamp}`;
    });
  }

  function renderInspectorRow(title: string, children: ReactNode) {
    return (
      <div
        style={{
          minHeight: 0,
          padding: "9px 10px",
          borderBottom: `1px solid ${subtleBorderColor}`,
          boxSizing: "border-box",
          overflow: "auto",
          fontFamily: "Space Grotesk, sans-serif",
        }}
      >
        <div
          style={{
            color: "#FFFFFF99",
            fontSize: 9,
            fontWeight: 900,
            letterSpacing: 0.35,
            textTransform: "uppercase",
            marginBottom: 5,
          }}
        >
          {title}
        </div>
        <div
          style={{
            color: "#FFFFFF",
            fontSize: 11,
            fontWeight: 800,
            lineHeight: 1.35,
            wordBreak: "break-word",
          }}
        >
          {children}
        </div>
      </div>
    );
  }

  function renderMechanicList(mechanic: GameplayMechanic) {
    const rows = getMechanicRows(mechanic);

    return (
      <div style={{ display: "grid", gap: 3 }}>
        {rows.map((row, index) => (
          <span key={`${mechanic}-inspector-${index}`}>{row}</span>
        ))}
      </div>
    );
  }

  return (
    <section
      aria-label="Inspector"
      style={{
        width: "100%",
        height: "100%",
        minHeight: 0,
        minWidth: 0,
        background: row2Column3BackgroundColor,
        color: textColor,
        borderLeft: `1px solid ${subtleBorderColor}`,
        boxSizing: "border-box",
        overflow: "hidden",
        display: "grid",
        gridTemplateRows: "10% 15% 13% 13% 13% minmax(0, 1fr)",
        fontFamily: "Space Grotesk, sans-serif",
      }}
    >
      <div
        style={{
          minHeight: 0,
          padding: "8px 8px 6px",
          borderBottom: `1px solid ${subtleBorderColor}`,
          boxSizing: "border-box",
          display: "grid",
          alignContent: "center",
        }}
      >
        <div style={{ textAlign: "left", fontSize: 13, fontWeight: 900 }}>
          Inspector
        </div>
      </div>

      {renderInspectorRow(
        "Selected Event",
        <>
          <div>{`Event ${eventIndex + 1}`}</div>
          <div style={{ color: "#CFFF04", marginTop: 4 }}>{assignedEquationText}</div>
        </>,
      )}
      {renderInspectorRow("Hits", renderMechanicList("hit"))}
      {renderInspectorRow("Spins", renderMechanicList("spin"))}
      {renderInspectorRow("Drags", renderMechanicList("drag"))}
      <div style={{ minHeight: 0, background: "#191919" }} />
    </section>
  );
}

function TimelineInstructionPanel({ choice }: { choice: CenterChoice }) {
  const text =
    choice === "premade"
      ? "Choose a curriculum-aligned equation template from the panel on the right"
      : "Build your equation using the blocks on the left";

  return (
    <div
      aria-hidden={choice === null}
      style={{
        minHeight: 0,
        height: "100%",
        background: row3BackgroundColor,
        borderTop: `1px solid ${subtleBorderColor}`,
        borderBottom: `1px solid ${subtleBorderColor}`,
        boxSizing: "border-box",
        display: "flex",
        alignItems: "center",
        padding: "0 20px",
        gap: 10,
        overflow: "hidden",
        opacity: choice === null ? 0 : 1,
        transform: "none",
        transition: "opacity 1100ms cubic-bezier(0.16, 1, 0.3, 1)",
        fontFamily: "Space Grotesk, sans-serif",
      }}
    >
      <span
        aria-hidden="true"
        style={{
          width: 10,
          height: 10,
          borderRadius: 999,
          background: "#CFFF04",
          boxShadow: "0 0 18px rgba(207,255,4,0.8)",
          flexShrink: 0,
          animation: "urPulseDot 850ms ease-in-out infinite alternate",
        }}
      />
      <span style={{ color: "#FFFFFF", fontSize: 13, fontWeight: 900 }}>
        {text}
      </span>
    </div>
  );
}

function TimelineControlsRow({
  isPlaying,
  currentSongSeconds,
  onRewind,
  onTogglePlay,
  onFastForward,
  onAddEvent,
  onRemoveEvent,
  onAddMechanic,
  onRemoveMechanic,
  onSongUpload,
  onChartUpload,
  onSidecarUpload,
  onSaveFiles,
}: {
  isPlaying: boolean;
  currentSongSeconds: number;
  onRewind: () => void;
  onTogglePlay: () => void;
  onFastForward: () => void;
  onAddEvent: () => void;
  onRemoveEvent: () => void;
  onAddMechanic: (mechanic: GameplayMechanic) => void;
  onRemoveMechanic: (mechanic: GameplayMechanic) => void;
  onSongUpload: (event: ChangeEvent<HTMLInputElement>) => void;
  onChartUpload: (event: ChangeEvent<HTMLInputElement>) => void;
  onSidecarUpload: (event: ChangeEvent<HTMLInputElement>) => void;
  onSaveFiles: () => void;
}) {
  const controls = [
    { label: "⏪", ariaLabel: "Rewind", onClick: onRewind },
    { label: isPlaying ? "⏸" : "▶", ariaLabel: isPlaying ? "Pause" : "Play", onClick: onTogglePlay },
    { label: "⏩", ariaLabel: "Fast forward", onClick: onFastForward },
  ];

  const uploadControlStyle = {
    minWidth: 92,
    height: 30,
    borderRadius: 10,
    border: `1px solid ${subtleBorderColor}`,
    background: "#191919",
    color: "#FFFFFF",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "0 10px",
    boxSizing: "border-box" as const,
    fontSize: 10,
    fontWeight: 900,
    cursor: "pointer",
    whiteSpace: "nowrap" as const,
  };

  const timelineEditButtonStyle = {
    minWidth: 78,
    height: 30,
    borderRadius: 10,
    border: `1px solid ${subtleBorderColor}`,
    background: "#191919",
    color: "#FFFFFF",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "0 9px",
    boxSizing: "border-box" as const,
    fontSize: 10,
    fontWeight: 900,
    cursor: "pointer",
    whiteSpace: "nowrap" as const,
  };

  return (
    <div
      aria-label="Song controls"
      style={{
        minHeight: 0,
        height: "100%",
        background: row3BackgroundColor,
        borderBottom: `1px solid ${subtleBorderColor}`,
        boxSizing: "border-box",
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "0 16px",
        fontFamily: "Space Grotesk, sans-serif",
      }}
    >
      {controls.map((control) => (
        <button
          key={control.ariaLabel}
          type="button"
          aria-label={control.ariaLabel}
          onClick={control.onClick}
          style={{
            width: 38,
            height: 30,
            borderRadius: 10,
            border: `1px solid ${subtleBorderColor}`,
            background: "#191919",
            color: "#FFFFFF",
            fontSize: 13,
            fontWeight: 900,
            cursor: "pointer",
          }}
        >
          {control.label}
        </button>
      ))}
      <div
        aria-label="Current song time"
        style={{
          marginLeft: 8,
          minWidth: 74,
          height: 30,
          borderRadius: 10,
          border: `1px solid ${subtleBorderColor}`,
          background: "#191919",
          color: "#FFFFFF",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 13,
          fontWeight: 900,
        }}
      >
        {formatSongTime(currentSongSeconds)}
      </div>

      <button type="button" onClick={onAddEvent} style={timelineEditButtonStyle}>
        Add Event
      </button>
      <button type="button" onClick={onRemoveEvent} style={timelineEditButtonStyle}>
        Remove Event
      </button>

      <div
        aria-label="Timeline mechanic controls"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          minWidth: 0,
        }}
      >
        <button type="button" onClick={() => onAddMechanic("hit")} style={timelineEditButtonStyle}>
          Add Hit
        </button>
        <button type="button" onClick={() => onAddMechanic("spin")} style={timelineEditButtonStyle}>
          Add Spin
        </button>
        <button type="button" onClick={() => onAddMechanic("drag")} style={timelineEditButtonStyle}>
          Add Drag
        </button>
        <button type="button" onClick={() => onRemoveMechanic("hit")} style={timelineEditButtonStyle}>
          Remove Hit
        </button>
        <button type="button" onClick={() => onRemoveMechanic("spin")} style={timelineEditButtonStyle}>
          Remove Spin
        </button>
        <button type="button" onClick={() => onRemoveMechanic("drag")} style={timelineEditButtonStyle}>
          Remove Drag
        </button>
      </div>

      <div
        aria-label="Timeline file uploads"
        style={{
          marginLeft: "auto",
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-end",
          gap: 8,
          minWidth: 0,
        }}
      >
        <label style={uploadControlStyle}>
          Upload Song
          <input
            type="file"
            accept="audio/*,.mp3,.wav,.ogg,.m4a,.aac,.flac"
            onChange={onSongUpload}
            style={{ display: "none" }}
          />
        </label>
        <label style={uploadControlStyle}>
          Upload .chart
          <input
            type="file"
            accept=".chart,text/plain"
            onChange={onChartUpload}
            style={{ display: "none" }}
          />
        </label>
        <label style={uploadControlStyle}>
          Upload JSON
          <input
            type="file"
            accept=".json,application/json"
            onChange={onSidecarUpload}
            style={{ display: "none" }}
          />
        </label>
        <button type="button" onClick={onSaveFiles} style={uploadControlStyle}>
          Save
        </button>
      </div>
    </div>
  );
}

function CenterEditorPanel({
  mode,
  timelineEvents,
  activeEventId,
  draftTokens,
  customTokenLabel,
  onCustomTokenLabelChange,
  // Timeline selection moved to the top-level row 3 render.
  // onSelectEvent,
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
  // Timeline selection moved to the top-level row 3 render.
  // onSelectEvent: (eventId: string) => void;
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
}) {
  const activeEvent =
    timelineEvents.find((eventSlot) => eventSlot.id === activeEventId) ?? null;

  return (
    <section
      style={{
        width: "75vw",
        // The top-level viewer row now controls this panel height.
        // height: "calc(100vh - 142px)",
        // minHeight: "calc(100vh - 142px)",
        height: "100%",
        minHeight: 0,
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

      {/*
        Timeline moved out of CenterEditorPanel so the page can be three
        top-level rows: header, viewer, timeline.
        <EquationTimeline
          events={timelineEvents}
          activeEventId={activeEventId}
          onSelectEvent={onSelectEvent}
        />
      */}
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

  const [timelineEvents, setTimelineEvents] = useState<TimelineEventSlot[]>([]);
  const [activeEventId, setActiveEventId] = useState<string | null>(null);
  const [savedEquations, setSavedEquations] = useState<SavedEquation[]>([]);
  const [mode, setMode] = useState<"event" | "equation">("event");
  const [centerChoice, setCenterChoice] = useState<CenterChoice>(null);
  const [libraryTab, setLibraryTab] = useState<LibraryTab>("mine");
  const [selectedEquationId, setSelectedEquationId] = useState<string | null>(null);
  const [currentSongSeconds, setCurrentSongSeconds] = useState(0);
  const [isSongPlaying, setIsSongPlaying] = useState(false);
  const [audioObjectUrl, setAudioObjectUrl] = useState("");
  const [audioDurationSeconds, setAudioDurationSeconds] = useState(0);
  const [waveformPeaks, setWaveformPeaks] = useState<number[]>([]);
  const [row2ColumnWidths, setRow2ColumnWidths] = useState([220, 500, 180]);
  const [activeResizeHandle, setActiveResizeHandle] = useState<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const resizeStartRef = useRef<{ handleIndex: number; startX: number; startWidths: number[] } | null>(null);
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

  useEffect(() => {
    if (activeResizeHandle === null) {
      return;
    }

    const handlePointerMove = (event: Event) => {
      const resizeState = resizeStartRef.current;

      if (!resizeState) {
        return;
      }

      const pointerEvent = event as globalThis.PointerEvent;
      const handleIndex = resizeState.handleIndex;
      const delta = pointerEvent.clientX - resizeState.startX;
      const availableWidth = resizeState.startWidths[handleIndex] + resizeState.startWidths[handleIndex + 1];
      const nextLeftWidth = Math.min(
        Math.max(180, resizeState.startWidths[handleIndex] + delta),
        availableWidth - 180,
      );
      const nextWidths = [...resizeState.startWidths];
      nextWidths[handleIndex] = nextLeftWidth;
      nextWidths[handleIndex + 1] = availableWidth - nextLeftWidth;
      setRow2ColumnWidths(nextWidths);
    };

    const handlePointerUp = () => {
      setActiveResizeHandle(null);
      resizeStartRef.current = null;
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [activeResizeHandle]);

  const timelineDurationSeconds = useMemo(() => {
    const maxEventSeconds = timelineEvents.reduce(
      (maxSeconds, eventSlot) =>
        Math.max(maxSeconds, timelineTickToSeconds(eventSlot.tick)),
      0,
    );

    return Math.max(8, audioDurationSeconds, metadata?.durationSeconds ?? 0, maxEventSeconds);
  }, [audioDurationSeconds, metadata?.durationSeconds, timelineEvents]);

  const activeTimelineEvent = useMemo(
    () => timelineEvents.find((eventSlot) => eventSlot.id === activeEventId) ?? null,
    [activeEventId, timelineEvents],
  );

  const activeTimelineEventIndex = useMemo(
    () => timelineEvents.findIndex((eventSlot) => eventSlot.id === activeEventId),
    [activeEventId, timelineEvents],
  );

  const activeEventEquation = useMemo(() => {
    return activeTimelineEvent ? getTimelineEventEquation(activeTimelineEvent) : null;
  }, [activeTimelineEvent]);

  const isInspectorVisible = Boolean(activeTimelineEvent);

  const selectedEquation = useMemo(
    () => savedEquations.find((equation) => equation.id === selectedEquationId) ?? null,
    [savedEquations, selectedEquationId],
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

  function handleAppendEquationToken(label: string) {
    setMode("equation");
    setDraftTokens((current) => [
      ...current,
      {
        id: makeId("token"),
        label,
      },
    ]);
  }

  function handleClearEquationDraft() {
    setDraftTokens([]);
    setCustomTokenLabel("");
  }

  function handleCreateEquationChoice() {
    setCenterChoice("create");
    setMode("equation");
  }

  function handleBrowsePremadeChoice() {
    setCenterChoice("premade");
    setLibraryTab("premade");
  }

  function handleRemoveEquationToken(id: string) {
    setDraftTokens((current) => current.filter((token) => token.id !== id));
  }

  function handleSaveEquation() {
    if (draftTokens.length === 0) {
      return;
    }

    const nextEquation = {
      id: makeId("equation"),
      tokens: cloneTokens(draftTokens),
    };

    setSavedEquations((current) => [...current, nextEquation]);
    setSelectedEquationId(nextEquation.id);
    setLibraryTab("mine");
    setDraftTokens([]);
    setCustomTokenLabel("");
    setMode("event");
  }

  function handleSelectEvent(eventId: string) {
    setActiveEventId(eventId);
    setMode("event");
  }

  function beginColumnResize(handleIndex: number, event: PointerEvent<HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();
    resizeStartRef.current = {
      handleIndex,
      startX: event.clientX,
      startWidths: row2ColumnWidths,
    };
    setActiveResizeHandle(handleIndex);
  }

  function handleSelectLibraryEquation(equationId: string) {
    setSelectedEquationId(equationId);
    setLibraryTab("mine");
  }

  function handleAddSelectedEquationToEvent() {
    if (!selectedEquation || !activeEventId) {
      return;
    }

    handleDropEquation(selectedEquation);
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
        headers: {
          "Content-Type": "application/json",
        },
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
              bucket: "SidecarJsons",
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
      const selectedSongEventCounts = getSelectedSongEventCounts(selectedSong);
      const selectedSongEquationSlots =
        selectedSongEventCounts.length ||
        getSelectedSongEquationSlotCount(selectedSong);
      const selectedSongEventTicks = getSelectedSongEquationSlotTicks(
        selectedSong,
        typeof selectedSongEquationSlots === "number"
          ? selectedSongEquationSlots
          : 0,
      );

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

      applySongAssetEquationSlotCount(selectedSongEquationSlots);
      loadSidecarIntoTimeline(
        emptySidecar,
        selectedSongEquationSlots,
        selectedSongEventCounts,
        selectedSongEventTicks,
      );
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
          loadSidecarIntoTimeline(
            normalizedSidecar,
            selectedSongEquationSlots,
            selectedSongEventCounts,
            selectedSongEventTicks,
          );

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
    if (!pendingSongFile) {
      setAudioObjectUrl("");
      setAudioDurationSeconds(0);
      setWaveformPeaks([]);
      return;
    }

    let isCancelled = false;
    const objectUrl = URL.createObjectURL(pendingSongFile);
    const audio = new Audio(objectUrl);

    audio.preload = "auto";
    audioRef.current = audio;
    setAudioObjectUrl(objectUrl);
    setCurrentSongSeconds(0);
    setIsSongPlaying(false);

    function handleLoadedMetadata() {
      if (!Number.isFinite(audio.duration)) {
        return;
      }

      setAudioDurationSeconds(audio.duration);
      setMetadata((current) => ({
        ...current,
        durationSeconds: audio.duration,
      }));
    }

    function handleTimeUpdate() {
      setCurrentSongSeconds(audio.currentTime);
    }

    function handleEnded() {
      setIsSongPlaying(false);
      setCurrentSongSeconds(audio.duration || 0);
    }

    audio.addEventListener("loadedmetadata", handleLoadedMetadata);
    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("ended", handleEnded);

    pendingSongFile
      .arrayBuffer()
      .then(async (arrayBuffer) => {
        const audioContext = new AudioContext();
        const decodedAudio = await audioContext.decodeAudioData(arrayBuffer.slice(0));
        const channelData = decodedAudio.getChannelData(0);
        const peaks = buildWaveformPeaksFromChannelData(channelData, 900);

        await audioContext.close();

        if (!isCancelled) {
          setWaveformPeaks(peaks);
          setAudioDurationSeconds(decodedAudio.duration);
          setMetadata((current) => ({
            ...current,
            durationSeconds: decodedAudio.duration,
          }));
        }
      })
      .catch((error) => {
        console.error("Failed to decode selected song waveform", error);
        if (!isCancelled) {
          setWaveformPeaks([]);
        }
      });

    console.info("Selected song file loaded for editor:", pendingSongFile.name);

    return () => {
      isCancelled = true;
      audio.pause();
      audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("ended", handleEnded);
      URL.revokeObjectURL(objectUrl);

      if (audioRef.current === audio) {
        audioRef.current = null;
      }
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

  useEffect(() => {
    const audio = audioRef.current;

    if (!audio) {
      if (!isSongPlaying) {
        return;
      }

      const intervalId = window.setInterval(() => {
        setCurrentSongSeconds((current) => {
          const next = Math.min(timelineDurationSeconds, current + 0.02);

          if (next >= timelineDurationSeconds) {
            setIsSongPlaying(false);
          }

          return next;
        });
      }, 100);

      return () => {
        window.clearInterval(intervalId);
      };
    }

    if (isSongPlaying) {
      audio.play().catch((error) => {
        console.error("Unable to play selected song", error);
        setIsSongPlaying(false);
      });
    } else {
      audio.pause();
    }
  }, [isSongPlaying, timelineDurationSeconds, audioObjectUrl]);

  function seekSong(seconds: number) {
    const nextSeconds = Math.max(0, Math.min(timelineDurationSeconds, Math.round(seconds * 50) / 50));
    const audio = audioRef.current;

    if (audio) {
      audio.currentTime = nextSeconds;
    }

    setCurrentSongSeconds(nextSeconds);
  }

  function handleRewindSong() {
    seekSong(currentSongSeconds - 8);
  }

  function handleToggleSongPlayback() {
    const audio = audioRef.current;

    if (audio && currentSongSeconds >= timelineDurationSeconds) {
      audio.currentTime = 0;
      setCurrentSongSeconds(0);
    }

    setIsSongPlaying((current) => !current);
  }

  function handleFastForwardSong() {
    seekSong(currentSongSeconds + 8);
  }

  useEffect(() => {
    function handleDocumentKeyDown(event: KeyboardEvent) {
      if (event.code !== "Space") {
        return;
      }

      const target = event.target as HTMLElement | null;
      const isTypingTarget =
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.tagName === "SELECT" ||
        target?.isContentEditable;

      if (isTypingTarget) {
        return;
      }

      event.preventDefault();
      handleToggleSongPlayback();
    }

    document.addEventListener("keydown", handleDocumentKeyDown);

    return () => {
      document.removeEventListener("keydown", handleDocumentKeyDown);
    };
  }, [currentSongSeconds, timelineDurationSeconds]);

  function syncTimelineFilesFromEvents(nextEvents: TimelineEventSlot[]) {
    const nextSidecar = sidecarFromTimelineEvents(nextEvents);

    setStoreSidecar(nextSidecar as StoreSidecarPayload);

    if (!chartFile.trim()) {
      setSaveStatus("Updated sidecar JSON");
      return;
    }

    try {
      const nextProject = chartToProject({
        chartFile,
        analysisMetadata: metadata,
        rawResults: nextSidecar,
      });

      setProject(nextProject);
      setChartFile(projectToChart(nextProject));
      setSaveStatus("Updated .chart and sidecar JSON");
    } catch (error) {
      console.error("Failed to update chart after timeline edit", error);
      setSaveStatus("Updated sidecar JSON. Unable to rebuild .chart from the current chart text.");
    }
  }

  function handleAddTimelineEvent() {
    const nextTick = Number(currentSongSeconds.toFixed(3));

    setTimelineEvents((current) => {
      const nextEvent = makeTimelineEvent(current.length, nextTick);
      const nextEvents = [...current, nextEvent].sort(
        (left, right) => timelineTickToSeconds(left.tick) - timelineTickToSeconds(right.tick),
      );

      setActiveEventId(nextEvent.id);
      syncTimelineFilesFromEvents(nextEvents);

      return nextEvents;
    });
  }

  function handleRemoveSelectedTimelineEvent() {
    if (!activeEventId) {
      return;
    }

    setTimelineEvents((current) => {
      const selectedIndex = current.findIndex((eventSlot) => eventSlot.id === activeEventId);

      if (selectedIndex < 0) {
        return current;
      }

      const nextEvents = current.filter((eventSlot) => eventSlot.id !== activeEventId);
      const nextActiveEvent = nextEvents[Math.min(selectedIndex, nextEvents.length - 1)] ?? null;

      setActiveEventId(nextActiveEvent?.id ?? null);
      syncTimelineFilesFromEvents(nextEvents);

      return nextEvents;
    });
  }

  function handleAddMechanicToSelectedEvent(mechanic: GameplayMechanic) {
    const mechanicSeconds = currentSongSeconds;

    setTimelineEvents((current) => {
      const targetEvent = findTimelineEventAtSeconds(current, mechanicSeconds);

      if (!targetEvent) {
        setSaveStatus(
          `No event at ${formatSongTime(mechanicSeconds)}. Add an event there first.`,
        );
        return current;
      }

      const nextEvents = current.map((eventSlot) => {
        if (eventSlot.id !== targetEvent.id) {
          return eventSlot;
        }

        const nextCount = (eventSlot.counts?.[mechanic] ?? 0) + 1;
        const nextInstances = resizeMechanicInstances(
          eventSlot.mechanicInstances?.[mechanic],
          nextCount,
        );
        nextInstances[nextCount - 1] = {
          ...nextInstances[nextCount - 1],
          tick: Number(mechanicSeconds.toFixed(3)),
        };

        return {
          ...eventSlot,
          counts: {
            ...eventSlot.counts,
            [mechanic]: nextCount,
          },
          mechanicInstances: {
            ...eventSlot.mechanicInstances,
            [mechanic]: nextInstances,
          },
        };
      });

      setActiveEventId(targetEvent.id);
      syncTimelineFilesFromEvents(nextEvents);

      return nextEvents;
    });
  }


  function handleRemoveNearestMechanic(mechanic: GameplayMechanic) {
    const targetSeconds = currentSongSeconds;

    type NearestMechanicMatch = {
      eventId: string;
      instanceIndex: number;
      distanceSeconds: number;
    };

    setTimelineEvents((current) => {
      const nearestMatch = current.reduce<NearestMechanicMatch | null>(
        (bestMatch, eventSlot) => {
          const count = Math.max(0, eventSlot.counts?.[mechanic] ?? 0);
          const instances = resizeMechanicInstances(
            eventSlot.mechanicInstances?.[mechanic],
            count,
          );

          return instances.reduce<NearestMechanicMatch | null>(
            (bestInstanceMatch, instance, instanceIndex) => {
              const instanceSeconds = timelineTickToSeconds(
                instance.tick ?? eventSlot.tick,
              );
              const distanceSeconds = Math.abs(instanceSeconds - targetSeconds);

              if (
                bestInstanceMatch &&
                bestInstanceMatch.distanceSeconds <= distanceSeconds
              ) {
                return bestInstanceMatch;
              }

              return {
                eventId: eventSlot.id,
                instanceIndex,
                distanceSeconds,
              };
            },
            bestMatch,
          );
        },
        null,
      );

      if (!nearestMatch) {
        setSaveStatus(`No ${mechanic} to remove.`);
        return current;
      }

      const eventIdToUpdate = nearestMatch.eventId;
      const instanceIndexToRemove = nearestMatch.instanceIndex;

      const nextEvents = current.map((eventSlot) => {
        if (eventSlot.id !== eventIdToUpdate) {
          return eventSlot;
        }

        const count = Math.max(0, eventSlot.counts?.[mechanic] ?? 0);
        const currentInstances = resizeMechanicInstances(
          eventSlot.mechanicInstances?.[mechanic],
          count,
        );
        const nextInstances = currentInstances.filter(
          (_, instanceIndex) => instanceIndex !== instanceIndexToRemove,
        );
        const nextCount = Math.max(0, count - 1);

        return {
          ...eventSlot,
          counts: {
            ...eventSlot.counts,
            [mechanic]: nextCount,
          },
          mechanicInstances: {
            ...eventSlot.mechanicInstances,
            [mechanic]: nextInstances,
          },
        };
      });

      setActiveEventId(eventIdToUpdate);
      syncTimelineFilesFromEvents(nextEvents);
      setSaveStatus(
        `Removed nearest ${mechanic} to ${formatSongTime(targetSeconds)}.`,
      );

      return nextEvents;
    });
  }

  function handleDownloadTimelineFiles() {
    const currentSidecar = sidecarFromTimelineEvents(timelineEvents);
    const baseName = getDownloadBaseName(
      uploadedChartName || metadata?.uploadedFileName || metadata?.songTitle || uploadedSongName,
      "lesson",
    );
    const sidecarJson = projectToSidecarJson(currentSidecar);
    let chartText = chartFile;

    if (chartFile.trim()) {
      try {
        const nextProject = chartToProject({
          chartFile,
          analysisMetadata: metadata,
          rawResults: currentSidecar,
        });

        chartText = projectToChart(nextProject);
      } catch (error) {
        console.error("Failed to rebuild chart for download", error);
        chartText = project ? projectToChart(project) : chartFile;
      }
    } else if (project) {
      chartText = projectToChart(project);
    }

    downloadTextFile(
      `${baseName}.json`,
      sidecarJson,
      "application/json;charset=utf-8",
    );
    downloadTextFile(
      `${baseName}.chart`,
      chartText,
      "text/plain;charset=utf-8",
    );
    setSaveStatus("Downloaded .chart and sidecar JSON");
  }

  function handleTimelineSongUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    setIsSongPlaying(false);
    setCurrentSongSeconds(0);
    setPendingSongFile(file);
    setUploadedSongName(file.name);
    setLoadError("");
    setMetadata((current) => ({
      ...current,
      songTitle: current?.songTitle ?? file.name.replace(/\.[^.]+$/, ""),
      uploadedFileName: file.name,
    }));
  }

  async function handleTimelineChartUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    try {
      const nextChartFile = await file.text();
      const nextMetadata = {
        ...metadata,
        uploadedFileName: file.name,
      };

      setChartFile(nextChartFile);
      setUploadedChartName(file.name);
      setMetadata(nextMetadata);
      setLoadError("");
      setSaveStatus(`Loaded ${file.name}`);

      try {
        setProject(
          chartToProject({
            chartFile: nextChartFile,
            analysisMetadata: nextMetadata,
            rawResults: sidecar,
          }),
        );
      } catch (error) {
        console.error("Failed to rebuild project from uploaded chart", error);
      }
    } catch (error) {
      setLoadError(
        error instanceof Error ? error.message : "Failed to load .chart file",
      );
    }
  }

  async function handleTimelineSidecarUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    try {
      const parsedSidecar = JSON.parse(await file.text());
      const normalizedSidecar = normalizeSidecar(parsedSidecar);

      setLoadError("");
      setSaveStatus(`Loaded ${file.name}`);
      loadSidecarIntoTimeline(normalizedSidecar, null);

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
      setLoadError(
        error instanceof Error ? error.message : "Failed to load sidecar JSON",
      );
    }
  }

  const isTimelineInstructionVisible = centerChoice !== null;
  // When the instruction strip appears, row 3 grows upward by the exact
  // strip height so row 2 shrinks instead of being covered. Avoid CSS calc()
  // multiplication here because it can be unsupported and make the timeline
  // visually overlay row 2 instead of participating in the grid.
  const timelineInstructionHeight = "calc(7.058823529vh - 12.352941176px)";
  const viewerRowTemplate = isTimelineInstructionVisible
    ? `calc(${viewerRowHeight} - ${timelineInstructionHeight})`
    : viewerRowHeight;
  const timelineRowTemplate = isTimelineInstructionVisible
    ? `calc(${timelineRowHeight} + ${timelineInstructionHeight})`
    : timelineRowHeight;

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
      <style>{`
        @keyframes urFlash {
          from { opacity: 0.45; filter: drop-shadow(0 0 0 rgba(207,255,4,0)); }
          to { opacity: 1; filter: drop-shadow(0 0 16px rgba(207,255,4,0.55)); }
        }
        @keyframes urPulseDot {
          from { transform: scale(0.7); opacity: 0.45; }
          to { transform: scale(1.15); opacity: 1; }
        }
        .ur-hidden-horizontal-scroll {
          scrollbar-width: none;
          -ms-overflow-style: none;
        }
        .ur-hidden-horizontal-scroll::-webkit-scrollbar {
          display: none;
          width: 0;
          height: 0;
        }
      `}</style>
      <HeaderBar pathname={pathname} topTabs={topTabs} />

      {/*
        The action bar is preserved for later, but commented out because the
        requested layout starts with the existing header as row 1, then uses
        row 2 for the viewer and row 3 for the timeline.
        <EditorActionBar
          saveStatus={loadError || saveStatus}
          isSaving={isSaving}
          onBack={handleBackToSongChoice}
          onSave={handleSaveToSupabase}
        />
      */}

      <main
        style={{
          width: "100%",
          flex: 1,
          minHeight: 0,
          display: "grid",
          gridTemplateRows: `${viewerRowTemplate} ${timelineRowTemplate}`,
          transition: "grid-template-rows 1100ms cubic-bezier(0.16, 1, 0.3, 1)",
          background: pageBackgroundColor,
          color: textColor,
          overflow: "hidden",
        }}
      >
        <section
          aria-label="Main viewer"
          style={{
            minHeight: 0,
            display: "flex",
            alignItems: "stretch",
            background: pageBackgroundColor,
            color: textColor,
            overflow: "hidden",
          }}
        >
          <div style={{ flex: `0 0 ${row2ColumnWidths[0]}px`, minWidth: 0, height: "100%" }}>
            <LeftEquationBuilderPanel
              draftTokens={draftTokens}
              onAddToken={handleAppendEquationToken}
              onClearEquation={handleClearEquationDraft}
              onSaveEquation={handleSaveEquation}
              shouldScrollTiles={isTimelineInstructionVisible}
            />
          </div>

          <div
            role="separator"
            aria-orientation="vertical"
            onPointerDown={(event) => beginColumnResize(0, event)}
            style={{
              width: 6,
              flex: "0 0 6px",
              cursor: "col-resize",
              background: activeResizeHandle === 0 ? "rgba(207,255,4,0.22)" : "transparent",
            }}
          />

          <div style={{ flex: `0 0 ${row2ColumnWidths[1]}px`, minWidth: 0, height: "100%" }}>
            <CenterChoicePanel
              choice={centerChoice}
              draftTokens={draftTokens}
              activeEventEquation={activeEventEquation}
              hasInspector={isInspectorVisible}
              onCreateEquation={handleCreateEquationChoice}
              onBrowseLibrary={handleBrowsePremadeChoice}
            />
          </div>

          <div
            role="separator"
            aria-orientation="vertical"
            onPointerDown={(event) => beginColumnResize(1, event)}
            style={{
              width: 6,
              flex: "0 0 6px",
              cursor: "col-resize",
              background: activeResizeHandle === 1 ? "rgba(207,255,4,0.22)" : "transparent",
            }}
          />

          <div style={{ flex: `0 0 ${row2ColumnWidths[2]}px`, minWidth: 0, height: "100%" }}>
            <LibraryPanel
              activeTab={libraryTab}
              savedEquations={savedEquations}
              activeEventId={activeEventId}
              selectedEquationId={selectedEquationId}
              onTabChange={setLibraryTab}
              onSelectEquation={handleSelectLibraryEquation}
              onAddSelectedEquationToEvent={handleAddSelectedEquationToEvent}
              shouldScrollLibrary={isTimelineInstructionVisible}
            />
          </div>

          <div
            role="separator"
            aria-orientation="vertical"
            onPointerDown={(event) => beginColumnResize(2, event)}
            style={{
              width: 6,
              flex: "0 0 6px",
              cursor: "col-resize",
              background: activeResizeHandle === 2 ? "rgba(207,255,4,0.22)" : "transparent",
            }}
          />

        </section>

        <section
          aria-label="Timeline row"
          style={{
            minHeight: 0,
            background: row3BackgroundColor,
            overflow: "visible",
            position: "relative",
            zIndex: 2,
            display: "grid",
            gridTemplateRows: "0px 15% 85%",
            transition: "grid-template-rows 1100ms cubic-bezier(0.16, 1, 0.3, 1)",
          }}
        >
          <div style={{ display: "none" }}>
            <TimelineInstructionPanel choice={centerChoice} />
          </div>
          <TimelineControlsRow
            isPlaying={isSongPlaying}
            currentSongSeconds={currentSongSeconds}
            onRewind={handleRewindSong}
            onTogglePlay={handleToggleSongPlayback}
            onFastForward={handleFastForwardSong}
            onAddEvent={handleAddTimelineEvent}
            onRemoveEvent={handleRemoveSelectedTimelineEvent}
            onAddMechanic={handleAddMechanicToSelectedEvent}
            onRemoveMechanic={handleRemoveNearestMechanic}
            onSongUpload={handleTimelineSongUpload}
            onChartUpload={handleTimelineChartUpload}
            onSidecarUpload={handleTimelineSidecarUpload}
            onSaveFiles={handleDownloadTimelineFiles}
          />
          <EquationTimeline
            events={timelineEvents}
            activeEventId={activeEventId}
            onSelectEvent={handleSelectEvent}
            currentSongSeconds={currentSongSeconds}
            durationSeconds={timelineDurationSeconds}
            waveformPeaks={waveformPeaks}
            onSeek={seekSong}
          />
        </section>
      </main>
    </div>
  );
}
