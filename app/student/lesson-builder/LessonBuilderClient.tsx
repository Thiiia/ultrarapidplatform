"use client";

import { useRouter } from "next/navigation";
import type { ChangeEvent, DragEvent, PointerEvent, ReactNode } from "react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import WaveSurfer from "wavesurfer.js";
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
  endTick?: number;
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
  endTick?: number;
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

type LessonBuilderClientProps = {
  studentName?: string;
  navBasePath?: string;
};

type PendingMechanicRangeSelection = {
  eventId: string;
  mechanic: "spin" | "drag";
  instanceId: string;
  startTick: number;
};

type CenterChoice = "create" | "premade" | null;
type LibraryTab = "mine" | "premade";

type TimelineMarkerEdge = "start" | "end";

/* VERIFIED_TIMELINE_HIDDEN_SCROLL_DRAG_HANDLE_PATCH */
/* VERIFIED_TIMELINE_UPLOAD_BUTTONS_PATCH: row 3 subrow 2 supports song/chart/sidecar uploads and updates timeline data. */
const pagePanelWidth = "92vw";
const headerHeight = "5.5vh";
const viewerRowHeight = "65vh";
const timelineRowHeight = "29.5vh";
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
              endTick:
                mechanic === "hit"
                  ? undefined
                  : normalizeTick(instance.endTick ?? tick),
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
          endTick:
            mechanic === "hit"
              ? undefined
              : normalizeTick(event.endTick ?? event.tick),
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

      if (mechanicEvent.mechanic !== "hit") {
        instance.endTick = mechanicEvent.endTick ?? mechanicEvent.tick;
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
            endTick:
              mechanic === "hit"
                ? undefined
                : instance?.endTick ?? instance?.tick ?? event.tick,
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

function chartEventsFromSidecar(sidecar: SidecarPayload) {
  return sidecar.events.map((event, index) => ({
    id: `alg-event-${index}-${event.tick}`,
    tick: event.tick,
    eventType: event.type,
    value: JSON.stringify(event),
  }));
}

function sidecarFromChartFile(
  chartText: string,
  analysisMetadata?: LessonBuilderPayload["analysisMetadata"],
): SidecarPayload {
  if (!chartText.trim()) {
    return emptySidecar;
  }

  try {
    const parsedProject = chartToProject({
      chartFile: chartText,
      analysisMetadata,
      rawResults: emptySidecar,
    });

    const events = parsedProject.events.flatMap((event): SidecarEvent[] => {
      if (
        event.eventType !== "ALG_MECHANIC" &&
        event.eventType !== "ALG_EQUATION_STATE"
      ) {
        return [];
      }

      try {
        const parsedValue = JSON.parse(event.value) as Record<string, unknown>;

        return [
          {
            ...parsedValue,
            tick: event.tick,
            type: event.eventType,
          } as SidecarEvent,
        ];
      } catch {
        if (event.eventType === "ALG_EQUATION_STATE" && event.value.trim()) {
          return [
            {
              tick: event.tick,
              type: "ALG_EQUATION_STATE",
              equationId: `eq_${String(event.tick).padStart(3, "0")}`,
              state: event.value,
            },
          ];
        }

        return [];
      }
    });

    return normalizeSidecar({
      version: 1,
      events,
    });
  } catch {
    return emptySidecar;
  }
}

function mergeTimelineSidecarSources(
  sidecarValue: unknown,
  chartText: string,
  analysisMetadata?: LessonBuilderPayload["analysisMetadata"],
): SidecarPayload {
  const normalizedSidecar = normalizeSidecar(sidecarValue ?? emptySidecar);
  const chartSidecar = sidecarFromChartFile(chartText, analysisMetadata);

  if (chartSidecar.events.length === 0) {
    return normalizedSidecar;
  }

  if (normalizedSidecar.events.length === 0) {
    return chartSidecar;
  }

  const mergedEvents = sortEvents([
    ...normalizedSidecar.events,
    ...chartSidecar.events,
  ]);
  const dedupedEvents: SidecarEvent[] = [];
  const seen = new Set<string>();

  mergedEvents.forEach((event) => {
    const key = JSON.stringify(event);

    if (seen.has(key)) {
      return;
    }

    seen.add(key);
    dedupedEvents.push(event);
  });

  return {
    version: 1,
    events: dedupedEvents,
  };
}

function createBlankChartFile(
  analysisMetadata?: LessonBuilderPayload["analysisMetadata"],
) {
  return projectToChart(
    chartToProject({
      chartFile: "",
      analysisMetadata,
      rawResults: emptySidecar,
    }),
  );
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
  studentName,
  isAdvancedMode,
  onToggleAdvancedMode,
}: {
  studentName: string;
  isAdvancedMode: boolean;
  onToggleAdvancedMode: () => void;
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

          <button
            type="button"
            onClick={onToggleAdvancedMode}
            aria-pressed={isAdvancedMode}
            style={{
              minWidth: 106,
              height: 38,
              borderRadius: 999,
              border: "1px solid #7A8FA8",
              background: isAdvancedMode ? "#CFFF04" : "#060B15FC",
              color: isAdvancedMode ? "#071222" : "#7A8FA8",
              fontSize: 14,
              fontWeight: 700,
              cursor: "pointer",
              padding: "0 16px",
              fontFamily: "Space Grotesk, sans-serif",
            }}
          >
            Advanced
          </button>
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
          <span
            aria-label="Student name"
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
              fontFamily: "Space Grotesk, sans-serif",
            }}
          >
            {studentName}
          </span>

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
        const horizontalDistance = Math.abs(deltaX);
        const lift = Math.max(64, Math.min(212, 52 + horizontalDistance * 0.46));
        const controlY = Math.min(arc.startY, arc.endY) - lift;
        const path = `M ${arc.startX} ${arc.startY} C ${
          arc.startX + deltaX * 0.18
        } ${controlY}, ${arc.startX + deltaX * 0.82} ${controlY}, ${
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

function formatTimelineTime(seconds: number, showHundredths = false) {
  const safeSeconds = Math.max(0, seconds);
  const minutes = Math.floor(safeSeconds / 60);
  const secondsWithinMinute = safeSeconds - minutes * 60;

  if (showHundredths) {
    const wholeSeconds = Math.floor(secondsWithinMinute);
    const hundredths = Math.floor((secondsWithinMinute - wholeSeconds) * 100)
      .toString()
      .padStart(2, "0");

    return `${minutes}:${String(wholeSeconds).padStart(2, "0")}.${hundredths}`;
  }

  const wholeSeconds = Math.floor(secondsWithinMinute);

  return `${minutes}:${String(wholeSeconds).padStart(2, "0")}`;
}

function formatSongTime(seconds: number, showHundredths = false) {
  return formatTimelineTime(seconds, showHundredths);
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

const emptyTimelineEventDurationSeconds = 1;

function getMechanicInstanceTimeWindowSeconds(
  eventSlot: TimelineEventSlot,
  mechanic: GameplayMechanic,
  instance: MechanicInstanceState | undefined,
) {
  const startSeconds = timelineTickToSeconds(instance?.tick ?? eventSlot.tick);

  if (mechanic === "hit") {
    return {
      startSeconds,
      endSeconds: startSeconds,
    };
  }

  const rawEndSeconds = timelineTickToSeconds(
    instance?.endTick ?? instance?.tick ?? eventSlot.tick,
  );

  return {
    startSeconds,
    endSeconds: Math.max(startSeconds, rawEndSeconds),
  };
}

function getTimelineEventTimeWindowSeconds(eventSlot: TimelineEventSlot) {
  const hasMechanics = gameplayMechanics.some(
    (mechanic) => (eventSlot.counts?.[mechanic] ?? 0) > 0,
  );

  if (!hasMechanics) {
    const startSeconds = timelineTickToSeconds(eventSlot.tick);

    return {
      startSeconds,
      endSeconds: startSeconds + emptyTimelineEventDurationSeconds,
    };
  }

  let earliestStartSeconds = Number.POSITIVE_INFINITY;
  let latestEndSeconds = Number.NEGATIVE_INFINITY;

  gameplayMechanics.forEach((mechanic) => {
    const count = Math.max(0, eventSlot.counts?.[mechanic] ?? 0);
    const instances = eventSlot.mechanicInstances?.[mechanic] ?? [];

    for (let index = 0; index < count; index += 1) {
      const window = getMechanicInstanceTimeWindowSeconds(
        eventSlot,
        mechanic,
        instances[index],
      );

      earliestStartSeconds = Math.min(earliestStartSeconds, window.startSeconds);
      latestEndSeconds = Math.max(latestEndSeconds, window.endSeconds);
    }
  });

  if (!Number.isFinite(earliestStartSeconds) || !Number.isFinite(latestEndSeconds)) {
    const fallbackSeconds = timelineTickToSeconds(eventSlot.tick);

    return {
      startSeconds: fallbackSeconds,
      endSeconds: fallbackSeconds + emptyTimelineEventDurationSeconds,
    };
  }

  return {
    startSeconds: earliestStartSeconds,
    endSeconds: latestEndSeconds,
  };
}

function findTimelineEventAtSeconds(
  events: TimelineEventSlot[],
  seconds: number,
) {
  const safeSeconds = Math.max(0, seconds);

  return events.find((eventSlot) => {
    const eventWindow = getTimelineEventTimeWindowSeconds(eventSlot);
    const hasMechanics = gameplayMechanics.some(
      (mechanic) => (eventSlot.counts?.[mechanic] ?? 0) > 0,
    );

    if (hasMechanics) {
      return (
        safeSeconds >= eventWindow.startSeconds &&
        safeSeconds <= eventWindow.endSeconds
      );
    }

    return (
      safeSeconds >= eventWindow.startSeconds &&
      safeSeconds < eventWindow.endSeconds
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

function getTimelineMarkerShapeStyles(mechanic: GameplayMechanic) {
  if (mechanic === "hit") {
    return {
      borderRadius: 2,
      transform: "translate(-50%, -50%) rotate(45deg)",
    };
  }

  if (mechanic === "drag") {
    return {
      borderRadius: 2,
      transform: "translate(-50%, -50%)",
    };
  }

  return {
    borderRadius: 999,
    transform: "translate(-50%, -50%)",
  };
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
  onPlayheadDragStart,
  onPlayheadDragEnd,
  onRetimeMechanicMarker,
  audioObjectUrl,
  isAdvancedMode,
}: {
  events: TimelineEventSlot[];
  activeEventId: string | null;
  onSelectEvent: (eventId: string) => void;
  currentSongSeconds: number;
  durationSeconds: number;
  waveformPeaks: number[];
  onSeek: (seconds: number) => void;
  onPlayheadDragStart: () => void;
  onPlayheadDragEnd: () => void;
  onRetimeMechanicMarker: (
    eventId: string,
    mechanic: GameplayMechanic,
    instanceIndex: number,
    edge: TimelineMarkerEdge,
    seconds: number,
  ) => void;
  audioObjectUrl: string;
  isAdvancedMode: boolean;
}) {
  const timelineTrackRef = useRef<HTMLDivElement | null>(null);
  const waveformContainerRef = useRef<HTMLDivElement | null>(null);
  const wavesurferRef = useRef<WaveSurfer | null>(null);
  const [isDraggingPlayhead, setIsDraggingPlayhead] = useState(false);
  const [draggedMechanicMarker, setDraggedMechanicMarker] = useState<{
    eventId: string;
    mechanic: GameplayMechanic;
    instanceIndex: number;
    edge: TimelineMarkerEdge;
  } | null>(null);
  const [viewportWidth, setViewportWidth] = useState(typeof window !== "undefined" ? window.innerWidth : 1280);
  const blockDurationSeconds = isAdvancedMode ? 1 : 8;
  const fineGridIntervalSeconds = isAdvancedMode ? 0.2 : 0;
  const blockWidthPx = viewportWidth * 0.05;
  useEffect(() => {
    if (!waveformContainerRef.current || !waveformPeaks.length) {
      return;
    }

    if (wavesurferRef.current) {
      wavesurferRef.current.destroy();
    }

    const wavesurfer = WaveSurfer.create({
      container: waveformContainerRef.current,
      waveColor: "#CFFF04",
      progressColor: "#CFFF0466",
      height: "auto",
    });

    if (audioObjectUrl) {
      wavesurfer.load(audioObjectUrl);
    }

    wavesurferRef.current = wavesurfer;

    return () => {
      if (wavesurferRef.current) {
        wavesurferRef.current.destroy();
        wavesurferRef.current = null;
      }
    };
  }, [waveformPeaks.length, audioObjectUrl]);

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
    const eventWindow = getTimelineEventTimeWindowSeconds(eventSlot);

    return Math.max(maxSeconds, eventWindow.endSeconds);
  }, 0);
  const visualDurationSeconds = Math.max(
    emptyTimelineEventDurationSeconds,
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
    let snappedSeconds = options.snapToWholeSecond
      ? Math.round(seconds)
      : Math.round(seconds * 50) / 50;

    if (isAdvancedMode) {
      snappedSeconds = Math.round(seconds / 0.2) * 0.2;
    }

    onSeek(snappedSeconds);
  }

  function snapTimelineSeconds(seconds: number) {
    let snappedSeconds = Math.round(seconds * 50) / 50;

    if (isAdvancedMode) {
      snappedSeconds = Math.round(seconds / 0.2) * 0.2;
    }

    return Math.max(0, Math.min(visualDurationSeconds, snappedSeconds));
  }

  function retimeDraggedMarker(
    marker: {
      eventId: string;
      mechanic: GameplayMechanic;
      instanceIndex: number;
      edge: TimelineMarkerEdge;
    },
    clientX: number,
    options: { autoScroll?: boolean } = {},
  ) {
    const seconds = getSecondsFromClientX(clientX, {
      autoScroll: options.autoScroll,
    });

    onRetimeMechanicMarker(
      marker.eventId,
      marker.mechanic,
      marker.instanceIndex,
      marker.edge,
      snapTimelineSeconds(seconds),
    );
  }

  function handleMechanicMarkerPointerDown(
    event: PointerEvent<HTMLButtonElement>,
    marker: {
      eventId: string;
      mechanic: GameplayMechanic;
      instanceIndex: number;
      edge: TimelineMarkerEdge;
    },
  ) {
    event.preventDefault();
    event.stopPropagation();
    onPlayheadDragStart();
    setDraggedMechanicMarker(marker);
    event.currentTarget.setPointerCapture(event.pointerId);
    retimeDraggedMarker(marker, event.clientX);
  }

  function handleMechanicMarkerPointerMove(event: PointerEvent<HTMLButtonElement>) {
    if (!draggedMechanicMarker) {
      return;
    }

    event.preventDefault();
    retimeDraggedMarker(draggedMechanicMarker, event.clientX, {
      autoScroll: true,
    });
  }

  function handleMechanicMarkerPointerUp(event: PointerEvent<HTMLButtonElement>) {
    if (draggedMechanicMarker) {
      event.preventDefault();
      retimeDraggedMarker(draggedMechanicMarker, event.clientX, {
        autoScroll: true,
      });
      setDraggedMechanicMarker(null);
      onPlayheadDragEnd();
    }

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  function handleTimelinePointerDown(event: PointerEvent<HTMLDivElement>) {
    const target = event.target as HTMLElement | null;

    if (target?.closest("[data-timeline-interactive='true']")) {
      return;
    }

    event.preventDefault();
    seekFromClientX(event.clientX, { snapToWholeSecond: true });
    onPlayheadDragEnd();
  }

  function handlePlayheadPointerDown(event: PointerEvent<HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();
    setIsDraggingPlayhead(true);
    onPlayheadDragStart();
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
    onPlayheadDragEnd();

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
            aria-valuenow={
              isAdvancedMode
                ? Math.round(currentSongSeconds * 100) / 100
                : Math.round(currentSongSeconds)
            }
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

            {isAdvancedMode
              ? Array.from(
                  {
                    length:
                      Math.ceil(visualDurationSeconds / fineGridIntervalSeconds) +
                      1,
                  },
                  (_, gridIndex) => {
                    const markerLeft = gridIndex * fineGridIntervalSeconds * pixelsPerSecond;

                    return (
                      <span
                        key={`timeline-fine-grid-${gridIndex}`}
                        style={{
                          position: "absolute",
                          left: markerLeft,
                          top: 0,
                          bottom: 0,
                          width: 1,
                          background: "rgba(255,255,255,0.12)",
                          transform: "translateX(-0.5px)",
                        }}
                      />
                    );
                  },
                )
              : null}
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
                  {formatTimelineTime(startSeconds, isAdvancedMode)}
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
            <div
              ref={waveformContainerRef}
              style={{
                width: "100%",
                height: "100%",
              }}
            />
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
                const eventWindow = getTimelineEventTimeWindowSeconds(eventSlot);
                const eventLeft = Math.min(
                  trackWidth,
                  Math.max(0, eventWindow.startSeconds * pixelsPerSecond),
                );
                const eventWidth = Math.max(
                  44,
                  (eventWindow.endSeconds - eventWindow.startSeconds) *
                    pixelsPerSecond,
                );
                const isActive = eventSlot.id === activeEventId;

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
                    <span style={{ fontSize: 11, fontWeight: 900 }}>
                      Event {index + 1}
                    </span>
                  </button>
                );
              })
            )}
          </div>

          {(["hit", "spin", "drag"] as GameplayMechanic[]).map((mechanic) => {
            const color =
              mechanic === "hit" ? "#2EA7FF" : mechanic === "spin" ? "#FF3535" : "#B45CFF";
            const markerShapeStyle = getTimelineMarkerShapeStyles(mechanic);

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
                  const renderedInstances = [
                    ...instances,
                    ...Array.from({ length: fallbackCount }, () => ({
                      id: "fallback",
                      tick: eventSlot.tick,
                      endTick: eventSlot.tick,
                      hitBubbles: [],
                      spinTargets: [],
                      dragTargets: [],
                    })),
                  ];

                  if (mechanic === "hit") {
                    return (
                      <span key={`${eventSlot.id}-${mechanic}`}>
                        {renderedInstances.map((instance, instanceIndex) => {
                          const markerSeconds = timelineTickToSeconds(
                            instance.tick ?? eventSlot.tick,
                          );
                          const markerLeft = Math.min(
                            trackWidth,
                            Math.max(0, markerSeconds * pixelsPerSecond),
                          );

                          return (
                            <button
                              key={`${eventSlot.id}-${mechanic}-start-${instanceIndex}`}
                              type="button"
                              data-timeline-interactive="true"
                              onPointerDown={(event) =>
                                handleMechanicMarkerPointerDown(event, {
                                  eventId: eventSlot.id,
                                  mechanic,
                                  instanceIndex,
                                  edge: "start",
                                })
                              }
                              onPointerMove={handleMechanicMarkerPointerMove}
                              onPointerUp={handleMechanicMarkerPointerUp}
                              onPointerCancel={handleMechanicMarkerPointerUp}
                              style={{
                                position: "absolute",
                                left: markerLeft,
                                top: "50%",
                                width: 10,
                                height: 10,
                                border: "none",
                                background: color,
                                boxShadow: `0 0 12px ${color}`,
                                ...markerShapeStyle,
                                cursor: "grab",
                                touchAction: "none",
                                padding: 0,
                              }}
                              aria-label={`Drag ${mechanic} timing`}
                            />
                          );
                        })}
                      </span>
                    );
                  }

                  return (
                    <span key={`${eventSlot.id}-${mechanic}-ranges`}>
                      {renderedInstances.map((instance, instanceIndex) => {
                        const window = getMechanicInstanceTimeWindowSeconds(
                          eventSlot,
                          mechanic,
                          instance,
                        );
                        const startLeft = Math.min(
                          trackWidth,
                          Math.max(0, window.startSeconds * pixelsPerSecond),
                        );
                        const endLeft = Math.min(
                          trackWidth,
                          Math.max(0, window.endSeconds * pixelsPerSecond),
                        );
                        const pathLeft = Math.min(startLeft, endLeft);
                        const pathWidth = Math.max(2, Math.abs(endLeft - startLeft));

                        return (
                          <span key={`${eventSlot.id}-${mechanic}-range-${instanceIndex}`}>
                            <span
                              aria-hidden="true"
                              style={{
                                position: "absolute",
                                left: pathLeft,
                                top: "50%",
                                width: pathWidth,
                                height: 4,
                                borderRadius: 999,
                                background: `${color}55`,
                                transform: "translateY(-50%)",
                              }}
                            />
                            {([
                              ["start", startLeft],
                              ["end", endLeft],
                            ] as Array<[TimelineMarkerEdge, number]>).map(
                              ([edge, left]) => (
                                <button
                                  key={`${eventSlot.id}-${mechanic}-${edge}-${instanceIndex}`}
                                  type="button"
                                  data-timeline-interactive="true"
                                  onPointerDown={(event) =>
                                    handleMechanicMarkerPointerDown(event, {
                                      eventId: eventSlot.id,
                                      mechanic,
                                      instanceIndex,
                                      edge,
                                    })
                                  }
                                  onPointerMove={handleMechanicMarkerPointerMove}
                                  onPointerUp={handleMechanicMarkerPointerUp}
                                  onPointerCancel={handleMechanicMarkerPointerUp}
                                  style={{
                                    position: "absolute",
                                    left,
                                    top: "50%",
                                    width: 10,
                                    height: 10,
                                    border: "none",
                                    background: color,
                                    boxShadow: `0 0 12px ${color}`,
                                    ...markerShapeStyle,
                                    cursor: "grab",
                                    touchAction: "none",
                                    padding: 0,
                                  }}
                                  aria-label={`Drag ${mechanic} ${edge} timing`}
                                />
                              ),
                            )}
                          </span>
                        );
                      })}
                    </span>
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
  compactSize,
}: {
  label: string;
  compact?: boolean;
  disabled?: boolean;
  compactSize?: number;
}) {
  const kind = getEquationTileKind(label);
  const isOperator = kind === "operator";
  const isNumber = kind === "number";

  const background = isOperator ? "#6B3312" : isNumber ? "#1B3668" : "#3D1E6B";
  const borderTop = isOperator
    ? "1px solid #FF8C3C73"
    : isNumber
    ? "1px solid #64A0FF73"
    : "1px solid #B478FF73";
  const boxShadow = isOperator
    ? "0px 0px 8px 0px #FF823C4D"
    : isNumber
    ? "0px 0px 8px 0px #3C82FF4D"
    : "0px 0px 8px 0px #A064FF4D";

  return {
    width: compact ? compactSize ?? 42 : "100%",
    minWidth: compact ? compactSize ?? 42 : 0,
    height: compact ? compactSize ?? 34 : undefined,
    minHeight: compact ? undefined : 42,
    borderRadius: 12,
    borderTop,
    borderRight: "none",
    borderBottom: "none",
    borderLeft: "none",
    background,
    boxShadow,
    color: "#FFFFFF",
    fontFamily: "Grandstander, sans-serif",
    fontSize: compact ? (isOperator ? 16 : 19) : isOperator ? 18 : 22,
    fontWeight: 800,
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
  compactSize,
  tokenGap = 6,
  selectedTokenIndex,
  onTokenClick,
  selectedOutlineColor = "#CFFF04",
  mechanicMode = null,
  selectedHitPair,
  onSelectHitPair,
  fontSizeOverride,
  currentSongSeconds,
  mechanicStartSeconds,
  mechanicEndSeconds,
}: {
  tokens: EquationToken[];
  emptyLabel?: string;
  compact?: boolean;
  compactSize?: number;
  tokenGap?: number;
  selectedTokenIndex?: number | null;
  onTokenClick?: (tokenIndex: number) => void;
  selectedOutlineColor?: string;
  mechanicMode?: GameplayMechanic | null;
  selectedHitPair?: HitBubblePair | null;
  onSelectHitPair?: (pair: HitBubblePair) => void;
  fontSizeOverride?: {
    operator: number;
    nonOperator: number;
  };
  currentSongSeconds?: number;
  mechanicStartSeconds?: number | null;
  mechanicEndSeconds?: number | null;
}) {
  const surfaceRef = useRef<HTMLDivElement | null>(null);
  const selectedTokenRef = useRef<HTMLSpanElement | null>(null);
  const destinationRef = useRef<HTMLSpanElement | null>(null);

  const baseTokenWidth = compact ? compactSize ?? 42 : 48;
  const baseTokenHeight = compact ? Math.max(34, Math.round(baseTokenWidth * 0.82)) : 42;
  const hitCircleOffset = Math.max(12, Math.round(baseTokenWidth * 0.38));
  const hitCircleSize = Math.max(10, Math.round(baseTokenWidth * 0.3));
  const hitCircleBorderWidth = Math.max(1.5, Math.round(baseTokenWidth * 0.04));
  const spinInset = -Math.max(24, Math.round(baseTokenWidth * 0.72));
  const dragArcStrokeWidth = Math.max(1, Math.round(baseTokenWidth * 0.025));
  const dragArcDashLength = Math.max(6, Math.round(baseTokenWidth * 0.18));
  const dragArcGapLength = Math.max(5, Math.round(baseTokenWidth * 0.14));

  const equalsIndex = findEqualsIndex(tokens);
  const actualEqualsIndex = tokens.findIndex((token) => token.label === "=");
  const safeSelectedTokenIndex =
    selectedTokenIndex !== null &&
    selectedTokenIndex !== undefined &&
    selectedTokenIndex >= 0 &&
    selectedTokenIndex < tokens.length &&
    !isEquationOperator(tokens[selectedTokenIndex]?.label ?? "")
      ? selectedTokenIndex
      : null;
  const isDragSelectionActive =
    mechanicMode === "drag" && safeSelectedTokenIndex !== null;
  const dragSelectionStartsOnLeft =
    safeSelectedTokenIndex !== null ? safeSelectedTokenIndex < equalsIndex : false;
  const draggingOperatorIndex =
    safeSelectedTokenIndex !== null
      ? (() => {
          const candidate = safeSelectedTokenIndex - 1;
          if (candidate < 0) {
            return null;
          }

          const label = tokens[candidate]?.label;

          return label && ["+", "-", "×", "÷"].includes(label)
            ? candidate
            : null;
        })()
      : null;
  const dragIsComplete =
    mechanicMode === "drag" &&
    typeof mechanicEndSeconds === "number" &&
    Number.isFinite(mechanicEndSeconds) &&
    typeof currentSongSeconds === "number" &&
    Number.isFinite(currentSongSeconds) &&
    currentSongSeconds > mechanicEndSeconds;
  const shouldShowDragDestination = !(
    mechanicMode === "drag" && dragIsComplete
  );

  const slots: Array<
    | { kind: "token"; token: EquationToken; tokenIndex: number }
    | { kind: "destination" }
  > = (() => {
    if (isDragSelectionActive && actualEqualsIndex >= 0 && dragIsComplete) {
      const movingIndexes = new Set<number>();

      if (safeSelectedTokenIndex !== null) {
        movingIndexes.add(safeSelectedTokenIndex);
      }

      if (draggingOperatorIndex !== null) {
        movingIndexes.add(draggingOperatorIndex);
      }

      const movingItems = tokens
        .map((token, tokenIndex) => ({ token, tokenIndex }))
        .filter((item) => movingIndexes.has(item.tokenIndex))
        .map((item) => ({
          ...item,
          token:
            draggingOperatorIndex !== null && item.tokenIndex === draggingOperatorIndex
              ? { ...item.token, label: flipOperatorLabel(item.token.label) }
              : item.token,
        }));

      const stationaryItems = tokens
        .map((token, tokenIndex) => ({ token, tokenIndex }))
        .filter((item) => !movingIndexes.has(item.tokenIndex));

      if (dragSelectionStartsOnLeft) {
        return [...stationaryItems, ...movingItems].map((item) => ({
          kind: "token" as const,
          token: item.token,
          tokenIndex: item.tokenIndex,
        }));
      }

      const insertionIndex = stationaryItems.findIndex(
        (item) => item.tokenIndex === actualEqualsIndex,
      );

      const beforeEquals =
        insertionIndex >= 0
          ? stationaryItems.slice(0, insertionIndex)
          : stationaryItems;
      const afterEquals =
        insertionIndex >= 0 ? stationaryItems.slice(insertionIndex) : [];

      return [...beforeEquals, ...movingItems, ...afterEquals].map((item) => ({
        kind: "token" as const,
        token: item.token,
        tokenIndex: item.tokenIndex,
      }));
    }

    if (!isDragSelectionActive || actualEqualsIndex < 0 || !shouldShowDragDestination) {
      return tokens.map((token, tokenIndex) => ({
        kind: "token" as const,
        token,
        tokenIndex,
      }));
    }

    const left = tokens
      .slice(0, actualEqualsIndex)
      .map((token, tokenIndex) => ({ kind: "token" as const, token, tokenIndex }));
    const equalsToken = {
      kind: "token" as const,
      token: tokens[actualEqualsIndex],
      tokenIndex: actualEqualsIndex,
    };
    const right = tokens
      .slice(actualEqualsIndex + 1)
      .map((token, offset) => ({
        kind: "token" as const,
        token,
        tokenIndex: actualEqualsIndex + 1 + offset,
      }));

    if (dragSelectionStartsOnLeft) {
      return [
        ...left,
        equalsToken,
        ...right,
        { kind: "destination" as const },
      ];
    }

    return [
      ...left,
      { kind: "destination" as const },
      equalsToken,
      ...right,
    ];
  })();

  const slotCount = Math.max(1, slots.length);
  const tokenWidthCss = compact
    ? `var(--equation-token-width, ${baseTokenWidth}px)`
    : undefined;

  useLayoutEffect(() => {
    const surface = surfaceRef.current;
    if (!surface || !compact) {
      return;
    }

    let frameId: number | null = null;

    const updateWidthVariable = () => {
      const availableWidth = surface.clientWidth;
      const idealWidth = slotCount * baseTokenWidth + (slotCount - 1) * tokenGap;

      if (availableWidth <= 0 || idealWidth <= availableWidth) {
        surface.style.removeProperty("--equation-token-width");
        return;
      }

      const shrunkWidth = Math.max(
        22,
        Math.floor((availableWidth - (slotCount - 1) * tokenGap) / slotCount),
      );

      surface.style.setProperty(
        "--equation-token-width",
        `${Math.min(baseTokenWidth, shrunkWidth)}px`,
      );
    };

    const scheduleUpdate = () => {
      if (frameId !== null) {
        cancelAnimationFrame(frameId);
      }

      frameId = requestAnimationFrame(updateWidthVariable);
    };

    scheduleUpdate();

    if (typeof ResizeObserver === "undefined") {
      return () => {
        if (frameId !== null) {
          cancelAnimationFrame(frameId);
        }
      };
    }

    const resizeObserver = new ResizeObserver(() => {
      scheduleUpdate();
    });

    resizeObserver.observe(surface);

    return () => {
      if (frameId !== null) {
        cancelAnimationFrame(frameId);
      }
      resizeObserver.disconnect();
    };
  }, [baseTokenWidth, compact, slotCount, tokenGap]);

  const tokenSlotIndexByTokenIndex = new Map<number, number>();
  let destinationSlotIndex: number | null = null;
  slots.forEach((slot, slotIndex) => {
    if (slot.kind === "token") {
      tokenSlotIndexByTokenIndex.set(slot.tokenIndex, slotIndex);
    } else {
      destinationSlotIndex = slotIndex;
    }
  });

  const selectedSlotIndex =
    safeSelectedTokenIndex !== null
      ? tokenSlotIndexByTokenIndex.get(safeSelectedTokenIndex) ?? null
      : null;

  function slotCenterX(slotIndex: number) {
    return ((slotIndex + 0.5) / slotCount) * 100;
  }

  function clamp01(value: number) {
    return Math.max(0, Math.min(1, value));
  }

  const timingStart =
    typeof mechanicStartSeconds === "number" && Number.isFinite(mechanicStartSeconds)
      ? mechanicStartSeconds
      : null;
  const timingEnd =
    typeof mechanicEndSeconds === "number" && Number.isFinite(mechanicEndSeconds)
      ? mechanicEndSeconds
      : timingStart;
  const nowSeconds =
    typeof currentSongSeconds === "number" && Number.isFinite(currentSongSeconds)
      ? currentSongSeconds
      : null;

  const dragProgress =
    mechanicMode === "drag" &&
    timingStart !== null &&
    timingEnd !== null &&
    nowSeconds !== null &&
    timingEnd > timingStart &&
    nowSeconds >= timingStart &&
    nowSeconds <= timingEnd
      ? clamp01((nowSeconds - timingStart) / (timingEnd - timingStart))
      : null;

  const spinProgress =
    mechanicMode === "spin" &&
    timingStart !== null &&
    timingEnd !== null &&
    nowSeconds !== null &&
    timingEnd > timingStart &&
    nowSeconds >= timingStart &&
    nowSeconds <= timingEnd
      ? clamp01((nowSeconds - timingStart) / (timingEnd - timingStart))
      : null;

  const hitAnimationProgress =
    mechanicMode === "hit" &&
    timingStart !== null &&
    nowSeconds !== null &&
    nowSeconds >= timingStart - 0.5 &&
    nowSeconds <= timingStart + 0.2
      ? clamp01((nowSeconds - (timingStart - 0.5)) / 0.5)
      : null;

  const selectedTokenIsAnimatingDrag =
    dragProgress !== null && selectedSlotIndex !== null && destinationSlotIndex !== null;

  const operatorToMoveIndex =
    selectedTokenIsAnimatingDrag
      ? draggingOperatorIndex
      : null;

  const operatorMovingSlotIndex =
    operatorToMoveIndex !== null
      ? tokenSlotIndexByTokenIndex.get(operatorToMoveIndex) ?? null
      : null;
  const operatorArcOffsetX =
    operatorMovingSlotIndex !== null && selectedSlotIndex !== null
      ? slotCenterX(operatorMovingSlotIndex) - slotCenterX(selectedSlotIndex)
      : null;

  const dragArcMotion =
    selectedTokenIsAnimatingDrag && selectedSlotIndex !== null && destinationSlotIndex !== null
      ? (() => {
          const startX = slotCenterX(selectedSlotIndex);
          const endX = slotCenterX(destinationSlotIndex);
          const controlX = startX + (endX - startX) * 0.5;
          const horizontalDistance = Math.abs(endX - startX);
        const baselineY = 50;
          const arcLift = Math.max(60, Math.min(86, 60 + horizontalDistance * 0.45));

          return {
            startX,
            endX,
            controlX,
          startY: baselineY,
          endY: baselineY,
          controlY: baselineY - arcLift,
          };
        })()
      : null;

  function flipOperatorLabel(label: string) {
    if (label === "+") return "-";
    if (label === "-") return "+";
    if (label === "×") return "÷";
    if (label === "÷") return "×";
    return label;
  }

  const hitPairOffsets: Record<HitBubblePair, Array<{ dx: number; dy: number }>> = {
    leftRight: [
      { dx: 0, dy: -(baseTokenHeight * 0.5 + hitCircleOffset) },
      { dx: 0, dy: baseTokenHeight * 0.5 + hitCircleOffset },
    ],
    topLeftBottomRight: [
      {
        dx: -(baseTokenWidth * 0.5 + hitCircleOffset),
        dy: -(baseTokenHeight * 0.5 + hitCircleOffset),
      },
      {
        dx: baseTokenWidth * 0.5 + hitCircleOffset,
        dy: baseTokenHeight * 0.5 + hitCircleOffset,
      },
    ],
    topRightBottomLeft: [
      {
        dx: baseTokenWidth * 0.5 + hitCircleOffset,
        dy: -(baseTokenHeight * 0.5 + hitCircleOffset),
      },
      {
        dx: -(baseTokenWidth * 0.5 + hitCircleOffset),
        dy: baseTokenHeight * 0.5 + hitCircleOffset,
      },
    ],
  };

  const hitPairs: Array<{
    pair: HitBubblePair;
    positions: Array<{ dx: number; dy: number }>;
  }> = [
    {
      pair: "leftRight",
      // Visually top/bottom while preserving existing stored pair semantics.
      positions: hitPairOffsets.leftRight,
    },
    {
      pair: "topLeftBottomRight",
      positions: hitPairOffsets.topLeftBottomRight,
    },
    {
      pair: "topRightBottomLeft",
      positions: hitPairOffsets.topRightBottomLeft,
    },
  ];

  function renderDragDestination(key: string) {
    return (
      <span
        key={key}
        ref={destinationRef}
        aria-hidden="true"
        style={{
          width: tokenWidthCss ?? baseTokenWidth,
          minWidth: tokenWidthCss ?? baseTokenWidth,
          height: baseTokenHeight,
          borderRadius: 12,
          border: "2px dashed rgba(180,92,255,0.85)",
          background: "rgba(180,92,255,0.14)",
          boxSizing: "border-box",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      />
    );
  }

  function renderTokenNode(
    token: EquationToken,
    tokenIndex: number,
    slotIndex: number,
  ) {
    const isOperator = isEquationOperator(token.label);
    const isSelected = selectedTokenIndex === tokenIndex;
    const isClickable = Boolean(onTokenClick) && !isOperator;
    const hideForDragAnimation =
      selectedTokenIsAnimatingDrag &&
      (tokenIndex === safeSelectedTokenIndex || tokenIndex === operatorToMoveIndex);
    const baseStyle = getEquationTileStyle({
      label: token.label,
      compact,
      compactSize,
    });

    const tileStyle = {
      ...baseStyle,
      fontSize: fontSizeOverride
        ? isOperator
          ? fontSizeOverride.operator
          : fontSizeOverride.nonOperator
        : baseStyle.fontSize,
      width: tokenWidthCss ?? baseStyle.width,
      minWidth: tokenWidthCss ?? baseStyle.minWidth,
      cursor: isClickable ? "pointer" : "default",
      boxShadow: isSelected
        ? `0 0 0 2px ${selectedOutlineColor}, 0 0 16px ${selectedOutlineColor}66`
        : undefined,
      position: "relative" as const,
      zIndex: 2,
      opacity: hideForDragAnimation ? 0 : 1,
    };

    if (hideForDragAnimation) {
      return (
        <span
          key={token.id}
          aria-hidden="true"
          style={{
            width: tokenWidthCss ?? baseStyle.width,
            minWidth: tokenWidthCss ?? baseStyle.minWidth,
            height: baseStyle.height,
            borderRadius: 12,
            border: "2px dashed rgba(180,92,255,0.85)",
            background: "rgba(180,92,255,0.12)",
            boxSizing: "border-box",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            position: "relative",
            zIndex: 2,
          }}
        />
      );
    }

    if (!isClickable) {
      return (
        <span key={token.id} style={tileStyle}>
          {token.label}
        </span>
      );
    }

    return (
      <span
        key={token.id}
        ref={isSelected ? selectedTokenRef : null}
        style={{ position: "relative", display: "inline-flex" }}
      >
        <button
          type="button"
          onClick={() => onTokenClick?.(tokenIndex)}
          style={{
            ...tileStyle,
            border: "none",
            padding: 0,
          }}
          aria-label={`Assign to token ${token.label}`}
        >
          {token.label}
        </button>

        {isSelected && mechanicMode === "spin" && spinProgress !== null ? (
          <span
            aria-hidden="true"
            style={{
              position: "absolute",
              inset: `${spinInset}px`,
              pointerEvents: "none",
              zIndex: 3,
            }}
          >
            <svg
              width="100%"
              height="100%"
              viewBox="0 0 100 100"
              fill="none"
              style={{ overflow: "visible" }}
            >
              {(() => {
                const spinRadius = 41;
                const spinCircumference = 2 * Math.PI * spinRadius;
                const spinHighlightLength = spinCircumference * 0.2;
                const spinGapLength = spinCircumference - spinHighlightLength;
                const spinOffset = -spinProgress * spinCircumference;
                const oppositeSpinOffset = spinOffset + spinCircumference / 2;

                return (
                  <>
                    <circle
                      cx="50"
                      cy="50"
                      r={spinRadius}
                      stroke="rgba(255,53,53,0.22)"
                      strokeWidth="4"
                    />
                    <circle
                      cx="50"
                      cy="50"
                      r={spinRadius}
                      stroke="#FF3535"
                      strokeWidth="5"
                      strokeLinecap="round"
                      strokeDasharray={`${spinHighlightLength} ${spinGapLength}`}
                      strokeDashoffset={spinOffset}
                      transform="rotate(-90 50 50)"
                    />
                    <circle
                      cx="50"
                      cy="50"
                      r={spinRadius}
                      stroke="#FF3535"
                      strokeWidth="5"
                      strokeLinecap="round"
                      strokeDasharray={`${spinHighlightLength} ${spinGapLength}`}
                      strokeDashoffset={oppositeSpinOffset}
                      transform="rotate(-90 50 50)"
                    />
                  </>
                );
              })()}
            </svg>
          </span>
        ) : null}

        {isSelected && mechanicMode === "hit" ? (
          <>
            {hitPairs.map((item) => {
              const isPairSelected = selectedHitPair === item.pair;

              return item.positions.map((position, circleIndex) => (
                <button
                  key={`${token.id}-${item.pair}-${circleIndex}`}
                  type="button"
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    onSelectHitPair?.(item.pair);
                  }}
                  style={{
                    position: "absolute",
                    width: hitCircleSize,
                    height: hitCircleSize,
                    borderRadius: 999,
                    border: `${hitCircleBorderWidth}px solid ${isPairSelected ? "#2EA7FF" : "#7CC8FF"}`,
                    background: isPairSelected ? "#2EA7FF" : "rgba(46,167,255,0.3)",
                    boxShadow: isPairSelected
                      ? "0 0 10px rgba(46,167,255,0.65)"
                      : "none",
                    left: `calc(50% + ${position.dx}px)`,
                    top: `calc(50% + ${position.dy}px)`,
                    transform: "translate(-50%, -50%)",
                    zIndex: 4,
                    cursor: "pointer",
                    padding: 0,
                  }}
                  aria-label={`Set hit pair ${item.pair}`}
                />
              ));
            })}

            {hitAnimationProgress !== null && selectedHitPair
              ? (() => {
                  const targets = hitPairOffsets[selectedHitPair];

                  return targets.map((target, circleIndex) => {
                    const dx = target.dx * hitAnimationProgress;
                    const dy = target.dy * hitAnimationProgress;
                    const size = Math.max(2, hitCircleSize * hitAnimationProgress);

                    return (
                      <span
                        key={`hit-anim-${slotIndex}-${circleIndex}`}
                        aria-hidden="true"
                        style={{
                          position: "absolute",
                          left: `calc(50% + ${dx}px)`,
                          top: `calc(50% + ${dy}px)`,
                          width: size,
                          height: size,
                          borderRadius: 999,
                          border: `${hitCircleBorderWidth}px solid #2EA7FF`,
                          background: "rgba(46,167,255,0.26)",
                          transform: "translate(-50%, -50%)",
                          boxSizing: "border-box",
                          pointerEvents: "none",
                          zIndex: 5,
                        }}
                      />
                    );
                  });
                })()
              : null}
          </>
        ) : null}
      </span>
    );
  }

  if (tokens.length === 0) {
    return (
      <span style={{ color: "#FFFFFF66", fontSize: 11, fontWeight: 800 }}>
        {emptyLabel}
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
        width: "100%",
        gap: tokenGap,
        flexWrap: "nowrap",
        maxWidth: "100%",
        minWidth: 0,
        overflow: "visible",
      }}
    >
      {dragArcMotion ? (
        <svg
          aria-hidden="true"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
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
          <path
            d={`M ${dragArcMotion.startX} ${dragArcMotion.startY} Q ${dragArcMotion.controlX} ${dragArcMotion.controlY} ${dragArcMotion.endX} ${dragArcMotion.endY}`}
            fill="none"
            stroke="#B45CFF"
            strokeWidth={dragArcStrokeWidth}
            strokeDasharray={`${dragArcDashLength * 0.6} ${dragArcGapLength * 0.8}`}
            strokeLinecap="butt"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      ) : null}

      {dragArcMotion && dragProgress !== null ? (
        (() => {
          const { startX, endX, startY, endY, controlX, controlY } = dragArcMotion;
          const t = dragProgress;
          const oneMinus = 1 - t;
          const x =
            oneMinus * oneMinus * startX +
            2 * oneMinus * t * controlX +
            t * t * endX;
          const y =
            oneMinus * oneMinus * startY +
            2 * oneMinus * t * controlY +
            t * t * endY;
          const operatorLabel =
            operatorToMoveIndex !== null ? tokens[operatorToMoveIndex]?.label ?? "" : "";
          const showFlippedOperator = t >= 0.5;

          return (
            <>
              <span
                aria-hidden="true"
                style={{
                  position: "absolute",
                  left: `${x}%`,
                  top: `${y}%`,
                  transform: "translate(-50%, -50%)",
                  zIndex: 6,
                  ...getEquationTileStyle({
                    label: tokens[safeSelectedTokenIndex ?? 0]?.label ?? "X",
                    compact,
                    compactSize,
                  }),
                  width: tokenWidthCss ?? undefined,
                  minWidth: tokenWidthCss ?? undefined,
                  fontSize: fontSizeOverride?.nonOperator,
                }}
              >
                {tokens[safeSelectedTokenIndex ?? 0]?.label ?? "X"}
              </span>

              {operatorMovingSlotIndex !== null && operatorLabel ? (
                <span
                  aria-hidden="true"
                  style={{
                    position: "absolute",
                    left: `${x + (operatorArcOffsetX ?? 0)}%`,
                    top: `${y}%`,
                    transform: "translate(-50%, -50%)",
                    zIndex: 6,
                    ...getEquationTileStyle({
                      label: operatorLabel,
                      compact,
                      compactSize,
                    }),
                    width: tokenWidthCss ?? undefined,
                    minWidth: tokenWidthCss ?? undefined,
                    fontSize: fontSizeOverride?.operator,
                  }}
                >
                  {showFlippedOperator
                    ? flipOperatorLabel(operatorLabel)
                    : operatorLabel}
                </span>
              ) : null}
            </>
          );
        })()
      ) : null}

      {slots.map((slot, slotIndex) =>
        slot.kind === "destination"
          ? renderDragDestination(`drag-destination-${slotIndex}`)
          : renderTokenNode(slot.token, slot.tokenIndex, slotIndex),
      )}
    </div>
  );
}

function LeftEquationBuilderPanel({
  draftTokens,
  onAddToken,
  onClearEquation,
  onSaveEquation,
}: {
  draftTokens: EquationToken[];
  onAddToken: (label: string) => void;
  onClearEquation: () => void;
  onSaveEquation: () => void;
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
          gridTemplateRows: "auto auto",
          gap: 6,
          fontFamily: "Space Grotesk, sans-serif",
        }}
      >
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
  hasSelectedEvent,
  selectedTokenIndex,
  onSelectToken,
  selectedMechanic,
  selectedHitPair,
  onSelectHitPair,
  equationViewerBlockSize,
  currentSongSeconds,
  mechanicStartSeconds,
  mechanicEndSeconds,
  onCreateEquation,
  onBrowseLibrary,
  hideHeader = false,
}: {
  choice: CenterChoice;
  draftTokens: EquationToken[];
  activeEventEquation: SavedEquation | null;
  hasSelectedEvent: boolean;
  selectedTokenIndex: number | null;
  onSelectToken: ((tokenIndex: number) => void) | null;
  selectedMechanic: GameplayMechanic | null;
  selectedHitPair: HitBubblePair | null;
  onSelectHitPair: ((pair: HitBubblePair) => void) | null;
  equationViewerBlockSize: number;
  currentSongSeconds: number;
  mechanicStartSeconds: number | null;
  mechanicEndSeconds: number | null;
  onCreateEquation: () => void;
  onBrowseLibrary: () => void;
  hideHeader?: boolean;
}) {
  const isCreate = choice === "create";
  const isPremade = choice === "premade";
  const hasDraft = draftTokens.length > 0;
  const visibleEquationTokens = hasDraft ? draftTokens : activeEventEquation?.tokens ?? [];
  const visibleEquationLabel = hasDraft
    ? "Current equation being built"
    : activeEventEquation
      ? ""
      : hasSelectedEvent
        ? "No equation is assigned to this event."
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
  const selectedTokenOutlineColor =
    selectedMechanic === "hit"
      ? "#2EA7FF"
      : selectedMechanic === "spin"
        ? "#FF3535"
        : selectedMechanic === "drag"
          ? "#B45CFF"
          : "#CFFF04";

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
        overflow: hideHeader ? "visible" : "hidden",
        display: "flex",
        alignItems: hideHeader ? "stretch" : "center",
        justifyContent: hideHeader ? "stretch" : "center",
        padding: hideHeader ? 0 : 32,
        fontFamily: "Space Grotesk, sans-serif",
      }}
    >
      <div
        style={{
          width: hideHeader ? "100%" : "min(720px, 92%)",
          height: hideHeader ? "100%" : "auto",
          display: "grid",
          justifyItems: hideHeader ? "stretch" : "center",
          alignItems: hideHeader ? "stretch" : "initial",
          gap: hideHeader ? 0 : 18,
          textAlign: "center",
        }}
      >
        {!hideHeader && (
          <>
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
          </>
        )}

        {visibleEquationTokens.length > 0 || visibleEquationLabel ? (
          <div
            aria-label={visibleEquationLabel || "Selected equation"}
            style={{
              marginTop: hideHeader ? 0 : 8,
              width: hideHeader ? "100%" : "min(620px, 100%)",
              height: hideHeader ? "100%" : "auto",
              minHeight: hideHeader ? 0 : 96,
              borderRadius: hideHeader ? 0 : 18,
              border: hideHeader ? "none" : `1px solid ${hasDraft ? "#CFFF04" : subtleBorderColor}`,
              background: hideHeader ? row2Column2BackgroundColor : "#202020",
              display: "grid",
              alignContent: hideHeader ? "stretch" : "center",
              justifyItems: hideHeader ? "stretch" : "center",
              gap: 10,
              padding: hideHeader ? "10px 16px 18px" : 18,
              boxSizing: "border-box",
              overflow: hideHeader ? "visible" : "hidden",
            }}
          >
            {!hideHeader ? (
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
            ) : null}
            {visibleEquationTokens.length > 0 ? (
              <EquationTileStrip
                tokens={visibleEquationTokens}
                compact
                compactSize={equationViewerBlockSize * 1.18}
                tokenGap={Math.max(16, Math.round(equationViewerBlockSize * 0.28))}
                selectedTokenIndex={selectedTokenIndex}
                onTokenClick={onSelectToken ?? undefined}
                selectedOutlineColor={selectedTokenOutlineColor}
                mechanicMode={selectedMechanic}
                selectedHitPair={selectedHitPair}
                onSelectHitPair={onSelectHitPair ?? undefined}
                fontSizeOverride={{
                  operator: 36,
                  nonOperator: 44,
                }}
                currentSongSeconds={currentSongSeconds}
                mechanicStartSeconds={mechanicStartSeconds}
                mechanicEndSeconds={mechanicEndSeconds}
              />
            ) : null}
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
  isAdvancedMode,
  currentSongSeconds,
  onAddEventAtPlayhead,
  onAddHit,
  onAddSpin,
  onAddDrag,
  pendingRangeMechanic,
}: {
  eventSlot: TimelineEventSlot | null;
  eventIndex: number;
  isAdvancedMode: boolean;
  currentSongSeconds: number;
  onAddEventAtPlayhead: () => void;
  onAddHit: () => void;
  onAddSpin: () => void;
  onAddDrag: () => void;
  pendingRangeMechanic: "spin" | "drag" | null;
}) {
  const selectedEventSlot = eventSlot;
  const assignedEquation = selectedEventSlot
    ? getTimelineEventEquation(selectedEventSlot)
    : null;
  const assignedEquationText = selectedEventSlot
    ? assignedEquation
      ? tokensToEquationState(assignedEquation.tokens)
      : "No equation assigned"
    : "No event selected. Add hit/spin/drag to create one.";

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

  const addButtonStyle = {
    width: "100%",
    minHeight: 30,
    borderRadius: 8,
    border: `1px solid ${subtleBorderColor}`,
    background: "#252525",
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: 900,
    cursor: "pointer",
    fontFamily: "Space Grotesk, sans-serif",
  } as const;

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
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
        }}
      >
        <div style={{ textAlign: "left", fontSize: 13, fontWeight: 900 }}>
          Inspector
        </div>
        <button
          type="button"
          onClick={onAddEventAtPlayhead}
          style={{
            minWidth: 86,
            minHeight: 26,
            borderRadius: 8,
            border: `1px solid ${subtleBorderColor}`,
            background: "#252525",
            color: "#FFFFFF",
            fontSize: 10,
            fontWeight: 900,
            cursor: "pointer",
            fontFamily: "Space Grotesk, sans-serif",
            whiteSpace: "nowrap",
          }}
        >
          Add Event
        </button>
      </div>

      {renderInspectorRow(
        "Selected Event",
        <>
          <div>{selectedEventSlot ? `Event ${eventIndex + 1}` : "No event selected"}</div>
          <div style={{ color: "#CFFF04", marginTop: 4 }}>{assignedEquationText}</div>
          <div style={{ marginTop: 4, color: "#FFFFFF99" }}>
            {`Playhead ${formatTimelineTime(currentSongSeconds, isAdvancedMode)}`}
          </div>
        </>,
      )}
      {renderInspectorRow(
        "Hits",
        <button type="button" onClick={onAddHit} style={addButtonStyle}>
          Add Hit At Playhead
        </button>,
      )}
      {renderInspectorRow(
        "Spins",
        <div style={{ display: "grid", gap: 6 }}>
          <button type="button" onClick={onAddSpin} style={addButtonStyle}>
            Add Spin Start At Playhead
          </button>
          {pendingRangeMechanic === "spin" ? (
            <span style={{ color: "#CFFF04", fontSize: 10, fontWeight: 800 }}>
              Move playhead to set spin end.
            </span>
          ) : null}
        </div>,
      )}
      {renderInspectorRow(
        "Drags",
        <div style={{ display: "grid", gap: 6 }}>
          <button type="button" onClick={onAddDrag} style={addButtonStyle}>
            Add Drag Start At Playhead
          </button>
          {pendingRangeMechanic === "drag" ? (
            <span style={{ color: "#CFFF04", fontSize: 10, fontWeight: 800 }}>
              Move playhead to set drag end.
            </span>
          ) : null}
        </div>,
      )}
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
  isAdvancedMode,
  onRewind,
  onTogglePlay,
  onFastForward,
  onSongUpload,
  onChartUpload,
  onSidecarUpload,
  onSaveFiles,
}: {
  isPlaying: boolean;
  currentSongSeconds: number;
  isAdvancedMode: boolean;
  onRewind: () => void;
  onTogglePlay: () => void;
  onFastForward: () => void;
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
        {formatSongTime(currentSongSeconds, isAdvancedMode)}
      </div>

      {isAdvancedMode ? (
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
      ) : null}
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
  studentName = "Student",
  navBasePath = "/student",
}: LessonBuilderClientProps) {
  const router = useRouter();
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
  const [hideEquationHeader, setHideEquationHeader] = useState(false);
  const [currentSongSeconds, setCurrentSongSeconds] = useState(0);
  const [isSongPlaying, setIsSongPlaying] = useState(false);
  const [audioObjectUrl, setAudioObjectUrl] = useState("");
  const [audioDurationSeconds, setAudioDurationSeconds] = useState(0);
  const [waveformPeaks, setWaveformPeaks] = useState<number[]>([]);
  const [row2ColumnWidths, setRow2ColumnWidths] = useState<number[]>([220, 600, 230, 217]);
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
  const [isAdvancedMode, setIsAdvancedMode] = useState(false);
  const [selectedContextMechanicKey, setSelectedContextMechanicKey] =
    useState<string | null>(null);
  const [pendingRangeSelection, setPendingRangeSelection] =
    useState<PendingMechanicRangeSelection | null>(null);
  const [isPlayheadAutoSelectPaused, setIsPlayheadAutoSelectPaused] =
    useState(false);

  const sidecar = useMemo(
    () => sidecarFromTimelineEvents(timelineEvents),
    [timelineEvents],
  );

  const equationViewerBlockSize = useMemo(
    () => row2ColumnWidths[1] * 0.12,
    [row2ColumnWidths],
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

  useEffect(() => {
    if (typeof window === "undefined") return;

    const separatorsWidth = 18;

    const calcWidths = () => {
      const w = window.innerWidth;
      const col1 = Math.round(w * 0.17);
      const col3 = Math.round(w * 0.18);
      const col4 = Math.round(w * 0.17);
      const col2 = Math.max(200, w - separatorsWidth - col1 - col3 - col4);
      setRow2ColumnWidths([col1, col2, col3, col4]);
    };

    calcWidths();
    window.addEventListener("resize", calcWidths);
    return () => window.removeEventListener("resize", calcWidths);
  }, []);

  const timelineDurationSeconds = useMemo(() => {
    const maxEventSeconds = timelineEvents.reduce(
      (maxSeconds, eventSlot) =>
        Math.max(maxSeconds, getTimelineEventTimeWindowSeconds(eventSlot).endSeconds),
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

  const playheadTimelineEvent = useMemo(
    () => findTimelineEventAtSeconds(timelineEvents, currentSongSeconds) ?? null,
    [currentSongSeconds, timelineEvents],
  );

  const centerContextEvent = activeTimelineEvent ?? playheadTimelineEvent;

  const centerContextEventIndex = useMemo(() => {
    if (!centerContextEvent) {
      return -1;
    }

    return timelineEvents.findIndex(
      (eventSlot) => eventSlot.id === centerContextEvent.id,
    );
  }, [centerContextEvent, timelineEvents]);

  const centerContextEventEquation = useMemo(() => {
    return centerContextEvent ? getTimelineEventEquation(centerContextEvent) : null;
  }, [centerContextEvent]);

  const centerContextMechanicItems = useMemo(() => {
    if (!centerContextEvent) {
      return [] as Array<{
        key: string;
        mechanic: GameplayMechanic;
        instanceIndex: number;
        startTick: number;
        endTick: number;
      }>;
    }

    const items: Array<{
      key: string;
      mechanic: GameplayMechanic;
      instanceIndex: number;
      startTick: number;
      endTick: number;
    }> = [];

    gameplayMechanics.forEach((mechanic) => {
      const count = Math.max(0, centerContextEvent.counts?.[mechanic] ?? 0);
      const instances = centerContextEvent.mechanicInstances?.[mechanic] ?? [];

      for (let instanceIndex = 0; instanceIndex < count; instanceIndex += 1) {
        const instance = instances[instanceIndex];
        const startTick = instance?.tick ?? centerContextEvent.tick;
        const endTick =
          mechanic === "hit"
            ? startTick
            : instance?.endTick ?? instance?.tick ?? centerContextEvent.tick;

        items.push({
          key: `${mechanic}:${instanceIndex}`,
          mechanic,
          instanceIndex,
          startTick,
          endTick: Math.max(startTick, endTick),
        });
      }
    });

    return items;
  }, [centerContextEvent]);

  const selectedCenterContextMechanic = useMemo(() => {
    if (centerContextMechanicItems.length === 0) {
      return null;
    }

    return (
      centerContextMechanicItems.find(
        (item) => item.key === selectedContextMechanicKey,
      ) ?? centerContextMechanicItems[0]
    );
  }, [centerContextMechanicItems, selectedContextMechanicKey]);

  const selectedContextMechanicAssignedTokenIndex = useMemo(() => {
    if (!centerContextEvent || !selectedCenterContextMechanic) {
      return null;
    }

    const instance =
      centerContextEvent.mechanicInstances?.[
        selectedCenterContextMechanic.mechanic
      ]?.[selectedCenterContextMechanic.instanceIndex];

    if (!instance) {
      return null;
    }

    if (selectedCenterContextMechanic.mechanic === "hit") {
      return instance.hitBubbles[0]?.tokenIndex ?? null;
    }

    if (selectedCenterContextMechanic.mechanic === "spin") {
      return instance.spinTargets[0]?.tokenIndex ?? null;
    }

    return instance.dragTargets[0]?.tokenIndex ?? null;
  }, [centerContextEvent, selectedCenterContextMechanic]);

  const selectedContextHitPair = useMemo(() => {
    if (
      !centerContextEvent ||
      !selectedCenterContextMechanic ||
      selectedCenterContextMechanic.mechanic !== "hit"
    ) {
      return null;
    }

    const instance =
      centerContextEvent.mechanicInstances?.[
        selectedCenterContextMechanic.mechanic
      ]?.[selectedCenterContextMechanic.instanceIndex];
    const pad = instance?.hitBubbles[0]?.pads?.[0];

    return pad ? getHitBubblePairFromPad(pad) : null;
  }, [centerContextEvent, selectedCenterContextMechanic]);

  const selectedContextMechanicTimeWindow = useMemo(() => {
    if (!selectedCenterContextMechanic) {
      return {
        startSeconds: null as number | null,
        endSeconds: null as number | null,
      };
    }

    return {
      startSeconds: timelineTickToSeconds(selectedCenterContextMechanic.startTick),
      endSeconds: timelineTickToSeconds(selectedCenterContextMechanic.endTick),
    };
  }, [selectedCenterContextMechanic]);

  useEffect(() => {
    if (centerContextMechanicItems.length === 0) {
      if (selectedContextMechanicKey !== null) {
        setSelectedContextMechanicKey(null);
      }
      return;
    }

    if (
      selectedContextMechanicKey &&
      centerContextMechanicItems.some(
        (item) => item.key === selectedContextMechanicKey,
      )
    ) {
      return;
    }

    setSelectedContextMechanicKey(centerContextMechanicItems[0].key);
  }, [centerContextMechanicItems, selectedContextMechanicKey]);

  const row2DisplayWidths = useMemo(() => {
    if (isAdvancedMode) {
      return {
        column1: row2ColumnWidths[0],
        column2: row2ColumnWidths[1],
        column3: row2ColumnWidths[2],
        column4: row2ColumnWidths[3],
      };
    }

    const sharedSideWidth = Math.round((row2ColumnWidths[0] + row2ColumnWidths[2]) / 2);

    return {
      column1: sharedSideWidth,
      column2: row2ColumnWidths[1] + row2ColumnWidths[3],
      column3: sharedSideWidth,
      column4: 0,
    };
  }, [isAdvancedMode, row2ColumnWidths]);

  const studentFirstName = useMemo(
    () => getDisplayFirstName(studentName),
    [studentName],
  );

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
    setHideEquationHeader(true);
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
    setHideEquationHeader(true);
  }

  function handleBrowsePremadeChoice() {
    setCenterChoice("premade");
    setLibraryTab("premade");
    setHideEquationHeader(true);
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
    setActiveEventId((current) => {
      if (current === eventId) {
        setIsPlayheadAutoSelectPaused(true);
        return null;
      }

      setIsPlayheadAutoSelectPaused(false);
      return eventId;
    });
    setMode("event");
    setHideEquationHeader(true);
  }

  function handleAssignTokenToSelectedContextMechanic(tokenIndex: number) {
    if (!centerContextEvent || !selectedCenterContextMechanic) {
      return;
    }

    const { key, mechanic, instanceIndex } = selectedCenterContextMechanic;

    setTimelineEvents((current) => {
      const nextEvents = current.map((eventSlot) => {
        if (eventSlot.id !== centerContextEvent.id) {
          return eventSlot;
        }

        const nextInstances = (eventSlot.mechanicInstances?.[mechanic] ?? []).map(
          (instance, index) => {
            if (index !== instanceIndex) {
              return instance;
            }

            if (mechanic === "hit") {
              const pads = getHitBubblePairPads(
                selectedContextHitPair ?? "leftRight",
              );

              return {
                ...instance,
                hitBubbles: [{ tokenIndex, positions: pads, pads }],
              };
            }

            if (mechanic === "spin") {
              return {
                ...instance,
                spinTargets: [{ tokenIndex }],
              };
            }

            return {
              ...instance,
              dragTargets: [{ tokenIndex }],
            };
          },
        );

        return {
          ...eventSlot,
          mechanicInstances: {
            ...eventSlot.mechanicInstances,
            [mechanic]: nextInstances,
          },
        };
      });

      syncTimelineFilesFromEvents(nextEvents);
      setSelectedContextMechanicKey(key);

      return nextEvents;
    });
  }

  function handleSetSelectedContextHitPair(pair: HitBubblePair) {
    if (
      !centerContextEvent ||
      !selectedCenterContextMechanic ||
      selectedCenterContextMechanic.mechanic !== "hit"
    ) {
      return;
    }

    const tokenIndex = selectedContextMechanicAssignedTokenIndex;

    if (tokenIndex === null) {
      return;
    }

    const { mechanic, instanceIndex } = selectedCenterContextMechanic;
    const pads = getHitBubblePairPads(pair);

    setTimelineEvents((current) => {
      const nextEvents = current.map((eventSlot) => {
        if (eventSlot.id !== centerContextEvent.id) {
          return eventSlot;
        }

        const nextInstances = (eventSlot.mechanicInstances?.[mechanic] ?? []).map(
          (instance, index) => {
            if (index !== instanceIndex) {
              return instance;
            }

            return {
              ...instance,
              hitBubbles: [{ tokenIndex, positions: pads, pads }],
            };
          },
        );

        return {
          ...eventSlot,
          mechanicInstances: {
            ...eventSlot.mechanicInstances,
            [mechanic]: nextInstances,
          },
        };
      });

      syncTimelineFilesFromEvents(nextEvents);
      return nextEvents;
    });
  }

  function handleRemoveSelectedContextMechanic() {
    if (!centerContextEvent || !selectedCenterContextMechanic) {
      return;
    }

    const { mechanic, instanceIndex } = selectedCenterContextMechanic;

    setTimelineEvents((current) => {
      const nextEvents = current.map((eventSlot) => {
        if (eventSlot.id !== centerContextEvent.id) {
          return eventSlot;
        }

        const count = Math.max(0, eventSlot.counts?.[mechanic] ?? 0);
        const currentInstances = resizeMechanicInstances(
          eventSlot.mechanicInstances?.[mechanic],
          count,
        );
        const nextInstances = currentInstances.filter(
          (_, currentIndex) => currentIndex !== instanceIndex,
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

      syncTimelineFilesFromEvents(nextEvents);
      setSaveStatus(
        `Removed ${selectedCenterContextMechanic.mechanic} ${selectedCenterContextMechanic.instanceIndex + 1}.`,
      );

      return nextEvents;
    });
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

    setTimelineEvents((current) => {
      const nextEvents = current.map((eventSlot) => {
        if (eventSlot.id !== activeEventId) {
          return eventSlot;
        }

        return {
          ...eventSlot,
          assignments: {
            hit: cloneEquationForAssignment(equation),
            spin: cloneEquationForAssignment(equation),
            drag: cloneEquationForAssignment(equation),
          },
        };
      });

      syncTimelineFilesFromEvents(nextEvents);
      return nextEvents;
    });
  }

  function updateActiveMechanicInstance(
    mechanic: GameplayMechanic,
    instanceIndex: number,
    updater: (instance: MechanicInstanceState) => MechanicInstanceState,
  ) {
    if (!activeEventId) {
      return;
    }

    setTimelineEvents((current) => {
      const nextEvents = current.map((eventSlot) => {
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
      });

      syncTimelineFilesFromEvents(nextEvents);
      return nextEvents;
    });
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
      const fallbackMetadata = {
        ...metadata,
        uploadedFileName:
          metadata?.uploadedFileName || uploadedSongName || "audio.mp3",
      };
      const timelineSidecar = sidecarFromTimelineEvents(timelineEvents);
      const baseChart = chartFile.trim()
        ? chartFile
        : createBlankChartFile(fallbackMetadata);
      const nextProject = chartToProject({
        chartFile: baseChart,
        analysisMetadata: fallbackMetadata,
        rawResults: timelineSidecar,
      });

      nextProject.events = chartEventsFromSidecar(timelineSidecar);

      const chartText = projectToChart(nextProject);
      const sidecarJson = projectToSidecarJson(timelineSidecar);

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

      setProject(nextProject);
      setChartFile(chartText);
      setStoreSidecar(timelineSidecar as StoreSidecarPayload);
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

      Promise.allSettled([
        textFromSignedUrl(selectedSong.chart.signedUrl),
        selectedSong.sidecar
          ? jsonFromSignedUrl(selectedSong.sidecar.signedUrl)
          : Promise.resolve(emptySidecar),
      ])
        .then(([chartResult, sidecarResult]) => {
          const selectedSongMetadata = {
            songTitle: selectedSong.title ?? selectedSong.name,
            artist: selectedSong.artist ?? undefined,
            uploadedFileName: selectedSong.song.path,
          };
          const fallbackChartFile = createBlankChartFile(selectedSongMetadata);
          const nextChartFile =
            chartResult.status === "fulfilled" && chartResult.value.trim()
              ? chartResult.value
              : fallbackChartFile;
          const sidecarJson =
            sidecarResult.status === "fulfilled"
              ? sidecarResult.value
              : emptySidecar;
          const nextChartName =
            selectedSong.chart.path.split("/").pop() ?? "selected.chart";
          const normalizedSidecar = mergeTimelineSidecarSources(
            sidecarJson ?? emptySidecar,
            nextChartFile,
            selectedSongMetadata,
          );

          if (
            chartResult.status !== "fulfilled" ||
            sidecarResult.status !== "fulfilled"
          ) {
            setSaveStatus("Using blank .chart/JSON fallback files");
          }

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
            analysisMetadata: selectedSongMetadata,
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
      const normalizedSidecar = mergeTimelineSidecarSources(
        payload.rawResults ?? emptySidecar,
        payload.chartFile ?? "",
        payload.analysisMetadata,
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
    const eventAtPlayhead = findTimelineEventAtSeconds(
      timelineEvents,
      currentSongSeconds,
    );

    if (isPlayheadAutoSelectPaused) {
      if (!eventAtPlayhead) {
        setIsPlayheadAutoSelectPaused(false);
      }

      return;
    }

    if (eventAtPlayhead && eventAtPlayhead.id !== activeEventId) {
      setActiveEventId(eventAtPlayhead.id);
    }
  }, [
    activeEventId,
    currentSongSeconds,
    isPlayheadAutoSelectPaused,
    timelineEvents,
  ]);

  useEffect(() => {
    if (!pendingRangeSelection) {
      return;
    }

    const nextEndTick = Number(
      Math.max(pendingRangeSelection.startTick, currentSongSeconds).toFixed(3),
    );

    if (Math.abs(nextEndTick - pendingRangeSelection.startTick) < 0.001) {
      return;
    }

    setTimelineEvents((current) => {
      let didUpdate = false;

      const nextEvents = current.map((eventSlot) => {
        if (eventSlot.id !== pendingRangeSelection.eventId) {
          return eventSlot;
        }

        const nextInstances = (eventSlot.mechanicInstances?.[
          pendingRangeSelection.mechanic
        ] ?? []).map((instance) => {
          if (instance.id !== pendingRangeSelection.instanceId) {
            return instance;
          }

          didUpdate = true;

          return {
            ...instance,
            endTick: nextEndTick,
          };
        });

        return {
          ...eventSlot,
          mechanicInstances: {
            ...eventSlot.mechanicInstances,
            [pendingRangeSelection.mechanic]: nextInstances,
          },
        };
      });

      if (!didUpdate) {
        return current;
      }

      syncTimelineFilesFromEvents(nextEvents);
      return nextEvents;
    });
  }, [currentSongSeconds, pendingRangeSelection]);

  function handleFinalizePendingRangeSelection() {
    if (!pendingRangeSelection) {
      return;
    }

    setPendingRangeSelection(null);
  }

  useEffect(() => {
    const audio = audioRef.current;

    if (!audio) {
      if (!isSongPlaying) {
        return;
      }

      let frameId: number;
      let lastUpdateTime = Date.now();

      const updateFrame = () => {
        const now = Date.now();
        const elapsed = (now - lastUpdateTime) / 1000;
        lastUpdateTime = now;

        setCurrentSongSeconds((current) => {
          const next = Math.min(timelineDurationSeconds, current + elapsed);

          if (next >= timelineDurationSeconds) {
            setIsSongPlaying(false);
          }

          return next;
        });

        frameId = requestAnimationFrame(updateFrame);
      };

      frameId = requestAnimationFrame(updateFrame);

      return () => {
        cancelAnimationFrame(frameId);
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

    try {
      const baseChart = chartFile.trim()
        ? chartFile
        : createBlankChartFile(metadata);
      const nextProject = chartToProject({
        chartFile: baseChart,
        analysisMetadata: metadata,
        rawResults: nextSidecar,
      });

      nextProject.events = chartEventsFromSidecar(nextSidecar);

      setProject(nextProject);
      setChartFile(projectToChart(nextProject));
      setSaveStatus("Updated .chart and sidecar JSON");
    } catch (error) {
      console.error("Failed to update chart after timeline edit", error);
      setSaveStatus("Updated sidecar JSON. Unable to rebuild .chart from the current chart text.");
    }
  }

  function handleRetimeMechanicMarker(
    eventId: string,
    mechanic: GameplayMechanic,
    instanceIndex: number,
    edge: TimelineMarkerEdge,
    seconds: number,
  ) {
    const nextTick = Number(seconds.toFixed(3));

    setTimelineEvents((current) => {
      let didUpdate = false;

      const nextEvents = current.map((eventSlot) => {
        if (eventSlot.id !== eventId) {
          return eventSlot;
        }

        const nextInstances = (eventSlot.mechanicInstances?.[mechanic] ?? []).map(
          (instance, currentIndex) => {
            if (currentIndex !== instanceIndex) {
              return instance;
            }

            didUpdate = true;
            const currentStartTick = Number(
              (instance.tick ?? eventSlot.tick).toFixed(3),
            );
            const currentEndTick = Number(
              (instance.endTick ?? instance.tick ?? eventSlot.tick).toFixed(3),
            );

            if (mechanic === "hit") {
              return {
                ...instance,
                tick: nextTick,
              };
            }

            if (edge === "start") {
              return {
                ...instance,
                tick: Math.min(nextTick, currentEndTick),
                endTick: Math.max(nextTick, currentEndTick),
              };
            }

            return {
              ...instance,
              tick: Math.min(currentStartTick, nextTick),
              endTick: Math.max(currentStartTick, nextTick),
            };
          },
        );

        return {
          ...eventSlot,
          mechanicInstances: {
            ...eventSlot.mechanicInstances,
            [mechanic]: nextInstances,
          },
        };
      });

      if (!didUpdate) {
        return current;
      }

      setActiveEventId(eventId);
      syncTimelineFilesFromEvents(nextEvents);

      return nextEvents;
    });
  }

  function handleAddTimelineEvent() {
    const nextTick = Number(currentSongSeconds.toFixed(3));

    setTimelineEvents((current) => {
      const overlappingEvent = findTimelineEventAtSeconds(
        current,
        currentSongSeconds,
      );

      if (overlappingEvent) {
        setSaveStatus("Event not added: playhead overlaps an existing event window.");
        return current;
      }

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

  function handleAddMechanicAtPlayhead(mechanic: GameplayMechanic) {
    const mechanicSeconds = currentSongSeconds;
    const mechanicTick = Number(mechanicSeconds.toFixed(3));
    let nextAddedInstanceId: string | null = null;

    setTimelineEvents((current) => {
      const selectedEvent =
        activeEventId
          ? current.find((eventSlot) => eventSlot.id === activeEventId) ?? null
          : null;
      const playheadEvent = findTimelineEventAtSeconds(current, mechanicSeconds);
      const targetEvent =
        selectedEvent ??
        playheadEvent ??
        makeTimelineEvent(current.length, mechanicTick);
      const baseEvents = selectedEvent || playheadEvent
        ? current
        : [...current, targetEvent].sort(
            (left, right) =>
              timelineTickToSeconds(left.tick) - timelineTickToSeconds(right.tick),
          );

      const nextEvents = baseEvents.map((eventSlot) => {
        if (eventSlot.id !== targetEvent.id) {
          return eventSlot;
        }

        const nextCount = (eventSlot.counts?.[mechanic] ?? 0) + 1;
        const nextInstances = resizeMechanicInstances(
          eventSlot.mechanicInstances?.[mechanic],
          nextCount,
        );
        const nextInstance = {
          ...nextInstances[nextCount - 1],
          tick: mechanicTick,
          ...(mechanic === "hit" ? {} : { endTick: mechanicTick }),
        };
        nextInstances[nextCount - 1] = nextInstance;
        nextAddedInstanceId = nextInstance.id;

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
      if ((mechanic === "spin" || mechanic === "drag") && nextAddedInstanceId) {
        setPendingRangeSelection({
          eventId: targetEvent.id,
          mechanic,
          instanceId: nextAddedInstanceId,
          startTick: mechanicTick,
        });
      } else {
        setPendingRangeSelection(null);
      }
      syncTimelineFilesFromEvents(nextEvents);
      setSaveStatus(
        `${mechanic.toUpperCase()} added at ${formatSongTime(mechanicSeconds, isAdvancedMode)}.`,
      );

      return nextEvents;
    });
  }

  function handleAddHitAtPlayhead() {
    handleAddMechanicAtPlayhead("hit");
  }

  function handleAddSpinAtPlayhead() {
    handleAddMechanicAtPlayhead("spin");
  }

  function handleAddDragAtPlayhead() {
    handleAddMechanicAtPlayhead("drag");
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

    if (!chartText.trim()) {
      chartText = createBlankChartFile({
        ...metadata,
        uploadedFileName:
          metadata?.uploadedFileName || uploadedSongName || "audio.mp3",
      });
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
        @keyframes urSpinHighlightCcw {
          from { stroke-dashoffset: 0; }
          to { stroke-dashoffset: -322; }
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
      <HeaderBar
        studentName={studentFirstName}
        isAdvancedMode={isAdvancedMode}
        onToggleAdvancedMode={() => setIsAdvancedMode((current) => !current)}
      />

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
          gridTemplateRows: `${viewerRowHeight} ${timelineRowHeight}`,
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
          <div style={{ flex: `0 0 ${row2DisplayWidths.column1}px`, minWidth: 0, height: "100%" }}>
            <LeftEquationBuilderPanel
              draftTokens={draftTokens}
              onAddToken={handleAppendEquationToken}
              onClearEquation={handleClearEquationDraft}
              onSaveEquation={handleSaveEquation}
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

          <div style={{ flex: `0 0 ${row2DisplayWidths.column2}px`, minWidth: 0, height: "100%" }}>
            <div
              style={{
                width: "100%",
                height: "100%",
                minHeight: 0,
                display: "grid",
                gridTemplateRows: centerContextEvent ? "7% 80% 13%" : "0 100% 0",
                background: row2Column2BackgroundColor,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  display: centerContextEvent ? "grid" : "none",
                  minHeight: 0,
                  alignItems: "center",
                  borderBottom: `1px solid ${subtleBorderColor}`,
                  padding: "0 12px",
                  boxSizing: "border-box",
                  color: "#FFFFFF",
                  fontFamily: "Space Grotesk, sans-serif",
                  fontSize: 11,
                  fontWeight: 800,
                }}
              >
                {centerContextEvent && centerContextEventIndex >= 0 ? (
                  <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                    <span>{`Event ${centerContextEventIndex + 1}`}</span>
                    <span>{`Start ${formatTimelineTime(getTimelineEventTimeWindowSeconds(centerContextEvent).startSeconds, isAdvancedMode)}`}</span>
                    <span>{`Spins ${centerContextEvent.counts?.spin ?? 0}`}</span>
                    <span>{`Hits ${centerContextEvent.counts?.hit ?? 0}`}</span>
                    <span>{`Drags ${centerContextEvent.counts?.drag ?? 0}`}</span>
                  </div>
                ) : null}
              </div>

              <div style={{ minHeight: 0 }}>
                <CenterChoicePanel
                  choice={centerChoice}
                  draftTokens={draftTokens}
                  activeEventEquation={centerContextEventEquation ?? activeEventEquation}
                  hasSelectedEvent={Boolean(centerContextEvent)}
                  selectedTokenIndex={selectedContextMechanicAssignedTokenIndex}
                  onSelectToken={
                    selectedCenterContextMechanic && centerContextEventEquation
                      ? handleAssignTokenToSelectedContextMechanic
                      : null
                  }
                  selectedMechanic={selectedCenterContextMechanic?.mechanic ?? null}
                  selectedHitPair={selectedContextHitPair}
                  onSelectHitPair={
                    selectedCenterContextMechanic?.mechanic === "hit"
                      ? handleSetSelectedContextHitPair
                      : null
                  }
                  equationViewerBlockSize={equationViewerBlockSize}
                  currentSongSeconds={currentSongSeconds}
                  mechanicStartSeconds={selectedContextMechanicTimeWindow.startSeconds}
                  mechanicEndSeconds={selectedContextMechanicTimeWindow.endSeconds}
                  onCreateEquation={handleCreateEquationChoice}
                  onBrowseLibrary={handleBrowsePremadeChoice}
                  hideHeader={hideEquationHeader}
                />
              </div>

              <div
                style={{
                  display: centerContextEvent ? "grid" : "none",
                  minHeight: 0,
                  gridTemplateColumns: "minmax(0, 1fr) auto",
                  alignItems: "center",
                  gap: 10,
                  borderTop: `1px solid ${subtleBorderColor}`,
                  padding: "0 12px",
                  boxSizing: "border-box",
                  color: "#FFFFFF",
                  fontFamily: "Space Grotesk, sans-serif",
                  overflow: "hidden",
                }}
              >
                <div style={{ minWidth: 0, overflow: "hidden" }}>
                  {selectedCenterContextMechanic ? (
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        flexWrap: "wrap",
                        gap: 10,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        fontSize: 11,
                        fontWeight: 800,
                      }}
                    >
                      <span style={{ color: "#CFFF04" }}>
                        {`${selectedCenterContextMechanic.mechanic.toUpperCase()} ${selectedCenterContextMechanic.instanceIndex + 1}`}
                      </span>
                      <span>
                        {selectedCenterContextMechanic.mechanic === "hit"
                          ? formatTimelineTime(
                              timelineTickToSeconds(
                                selectedCenterContextMechanic.startTick,
                              ),
                              isAdvancedMode,
                            )
                          : `${formatTimelineTime(
                              timelineTickToSeconds(
                                selectedCenterContextMechanic.startTick,
                              ),
                              isAdvancedMode,
                            )} -> ${formatTimelineTime(
                              timelineTickToSeconds(
                                selectedCenterContextMechanic.endTick,
                              ),
                              isAdvancedMode,
                            )}`}
                      </span>

                      <button
                        type="button"
                        onClick={handleRemoveSelectedContextMechanic}
                        style={{
                          minWidth: 74,
                          height: 22,
                          borderRadius: 999,
                          border: `1px solid ${subtleBorderColor}`,
                          background: "#3A1818",
                          color: "#FFFFFF",
                          fontSize: 9,
                          fontWeight: 900,
                          cursor: "pointer",
                          padding: "0 8px",
                          whiteSpace: "nowrap",
                          fontFamily: "Space Grotesk, sans-serif",
                        }}
                      >
                        Remove
                      </button>
                    </div>
                  ) : (
                    <span style={{ color: "#FFFFFF80", fontSize: 11, fontWeight: 700 }}>
                      No hit/spin/drag assigned
                    </span>
                  )}
                </div>

                <div style={{ minWidth: 0, display: "flex", alignItems: "center", gap: 6, overflowX: "auto" }}>
                  {centerContextMechanicItems.map((item) => {
                    const isSelected = item.key === selectedCenterContextMechanic?.key;

                    return (
                      <button
                        key={item.key}
                        type="button"
                        onClick={() => {
                          setSelectedContextMechanicKey(item.key);
                          seekSong(timelineTickToSeconds(item.startTick));
                        }}
                        style={{
                          minWidth: 44,
                          height: 22,
                          borderRadius: 999,
                          border: `1px solid ${isSelected ? "#CFFF04" : subtleBorderColor}`,
                          background: isSelected ? "rgba(207,255,4,0.12)" : "#252525",
                          color: isSelected ? "#CFFF04" : "#FFFFFF99",
                          fontSize: 9,
                          fontWeight: 900,
                          cursor: "pointer",
                          padding: "0 8px",
                          whiteSpace: "nowrap",
                          fontFamily: "Space Grotesk, sans-serif",
                        }}
                        aria-label={`Select ${item.mechanic} ${item.instanceIndex + 1}`}
                      >
                        {`${item.mechanic[0].toUpperCase()}${item.instanceIndex + 1}`}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
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

          <div style={{ flex: `0 0 ${row2DisplayWidths.column3}px`, minWidth: 0, height: "100%" }}>
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

          {isAdvancedMode ? (
            <>
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

              <div style={{ flex: `0 0 ${row2DisplayWidths.column4}px`, minWidth: 0, height: "100%" }}>
                <InspectorPanel
                  eventSlot={activeTimelineEvent}
                  eventIndex={activeTimelineEventIndex}
                  isAdvancedMode={isAdvancedMode}
                  currentSongSeconds={currentSongSeconds}
                  onAddEventAtPlayhead={handleAddTimelineEvent}
                  onAddHit={handleAddHitAtPlayhead}
                  onAddSpin={handleAddSpinAtPlayhead}
                  onAddDrag={handleAddDragAtPlayhead}
                  pendingRangeMechanic={pendingRangeSelection?.mechanic ?? null}
                />
              </div>
            </>
          ) : null}
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
            gridTemplateRows: "4.5vh 22.5vh",
            transition: "grid-template-rows 1100ms cubic-bezier(0.16, 1, 0.3, 1)",
          }}
        >
          <TimelineControlsRow
            isPlaying={isSongPlaying}
            currentSongSeconds={currentSongSeconds}
            isAdvancedMode={isAdvancedMode}
            onRewind={handleRewindSong}
            onTogglePlay={handleToggleSongPlayback}
            onFastForward={handleFastForwardSong}
            onSongUpload={handleTimelineSongUpload}
            onChartUpload={handleTimelineChartUpload}
            onSidecarUpload={handleTimelineSidecarUpload}
            onSaveFiles={handleSaveToSupabase}
          />
          <EquationTimeline
            events={timelineEvents}
            activeEventId={activeEventId}
            onSelectEvent={handleSelectEvent}
            currentSongSeconds={currentSongSeconds}
            durationSeconds={timelineDurationSeconds}
            waveformPeaks={waveformPeaks}
            onSeek={seekSong}
            onPlayheadDragStart={() => {
              // no-op hook for now; used to align lifecycle with drag-end finalize.
            }}
            onPlayheadDragEnd={handleFinalizePendingRangeSelection}
            onRetimeMechanicMarker={handleRetimeMechanicMarker}
            audioObjectUrl={audioObjectUrl}
            isAdvancedMode={isAdvancedMode}
          />
        </section>
      </main>
    </div>
  );
}
