"use client";

import { useRouter } from "next/navigation";
import type { ChangeEvent, DragEvent, PointerEvent, ReactNode } from "react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import WaveSurfer from "wavesurfer.js";
import ReplayRoundedIcon from "@mui/icons-material/ReplayRounded";
import SwipeRoundedIcon from "@mui/icons-material/SwipeRounded";
import TouchAppRoundedIcon from "@mui/icons-material/TouchAppRounded";
import {
  useEditorStore,
  type SidecarPayload as StoreSidecarPayload,
} from "@/lib/editor/editor-store";
import { chartToProject } from "@/lib/editor/chart-to-project";
import { loadLessonAssets } from "@/lib/editor/lesson-hydration";
import {
  serializeAuthoredLesson,
  timelineEventsFromAuthoredLesson,
  type AuthoredLessonDraft,
  type AuthoredTimelineEvent,
} from "@/lib/authored-lesson-serialization";
import { isAuthoredEquationOperator, parseAuthoredLessonDraft } from "@/lib/authored-lesson";
import { repairLegacyMigratedAuthoredLesson } from "@/lib/legacy-authored-migration";
import { isLegacyEncounterSidecar, validateLegacyEncounters, persistLegacyEncounters, type LegacyEncounter, type LegacyEncounterSidecar } from "@/lib/legacy-encounters";
import { validateLessonContent } from "@/lib/lesson-content";
import { extractRevisionFromStoragePath } from "@/lib/song-launch-identity";
import { tokenizeAuthoredEquationState } from "@/lib/authored-lesson";
import { createLessonClock, mapLessonTimes } from "@/lib/editor/lesson-timing";
import {
  projectToChart,
  projectToSidecarJson,
} from "@/lib/editor/project-to-chart";
import { applyEquationToEvent as applyEquationToEventInstances } from "@/lib/authored-lesson-event-assignment";
// import SongFlowDebugger from "@/app/components/SongFlowDebugger";
import { persistLaunchParams } from "@/lib/launch-handoff";
import { createSongLaunchSearchParams } from "@/lib/platform-launch";
import {
  requestFreshSongLaunchPackage,
  type FreshSongLaunchPackage,
} from "@/lib/song-launch-client";
import { appendSongFlowDebug } from "@/lib/song-flow-debug";
import { getPlayerLaunchRoute } from "@/lib/song-choice-flow";
import {
  assertSongActivityMatches,
  resolveSongActivityIdentity,
} from "@/lib/song-activity-authority";
import {
  getActivityAuthoringCapabilities,
  NUMBER_BONDS_TIMING_POLICY,
} from "@/lib/activity-authoring-capabilities";
import { getLearnerFacingError, studentCopy } from "@/lib/student-copy";
import GuidedTemplateStart from "./GuidedTemplateStart";
import { GuidedEncounterComposer } from "./GuidedEncounterComposer";
import { EncounterReadinessPanel } from "./EncounterReadinessPanel";
import {
  evaluateEncounterReadiness,
  findGuidedEncounterSelection,
  inputFromEvent,
  normalizeStagedMechanic,
  type GuidedEncounterInput,
  evaluateLessonPublishReadiness,
} from "@/lib/guided-authored-encounter";
import {
	deletePlayerLessonWorkspaceDraft,
	readPlayerLessonWorkspaceDraft,
	resolveLessonWorkspaceSource,
	writePlayerLessonWorkspaceDraft,
  type LessonSourceIdentity,
  type PlayerLessonEntryIntent,
} from "@/lib/player-lesson-workspace";
import {
  classifyWorkspaceError,
  classifyWorkspaceResponse,
  MAX_WORKSPACE_RETRIES,
  prepareWorkspaceMutation,
  workspaceRetryDelay,
  type WorkspaceResponseResult,
} from "@/lib/player-workspace-client";
import {
  lessonLaunchStrategy,
  libraryEquationsForTab,
  shouldOfferStarterTemplate,
} from "@/lib/starter-template-guidance";
import {
  defaultSongActivityKey,
  inferSongActivityKeyFromChartPath,
  normalizeSongActivityKey,
  resolveRequestedSongActivityPackage,
  type SongActivityKey,
} from "@/lib/song-activity-storage";
import styles from "../student.module.css";

/* Header Icon imports */
import URIcon from "@/public/header_icons/URIcon.svg";
import SpinIcon from "@/public/lesson_builder_icons/Spin.svg";

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

type RhythmSourceOption = {
  activityKey: SongActivityKey;
  revision: string;
  chartSha256: string;
  audioSha256: string;
  chart: StorageFileRef & { signedUrl: string };
};

type SelectedSongPayload = {
  id: string;
  name: string;
  title?: string;
  artist?: string | null;
  authorId?: string | null;
  authorName?: string | null;
  revision?: string | null;
  rhythmSource?: RhythmSourceOption | null;
  rhythmDifficultyKey?: "EasySingle" | "MediumSingle" | "HardSingle" | "ExpertSingle" | null;
  rhythm_difficulty_key?: "EasySingle" | "MediumSingle" | "HardSingle" | "ExpertSingle" | null;
  activity?: {
    key?: string;
    label?: string;
  } | null;
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

type SongChoiceOption = {
  id: string;
  activityKey: SongActivityKey;
  name: string;
  title?: string;
  artist?: string | null;
  authorName?: string | null;
  requiresRhythmSource?: boolean;
  rhythmSources?: RhythmSourceOption[];
  song: StorageFileRef & { signedUrl: string };
  chart: StorageFileRef & { signedUrl: string };
  sidecar: (StorageFileRef & { signedUrl: string }) | null;
};

type SongChartAuthorOption = {
  id: string;
  name: string;
  email: string | null;
  chartCount: number;
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
  sourceHitId?: string;
};

type HitBubblePair = "topLeftBottomRight" | "topRightBottomLeft" | "leftRight";

type MechanicInstanceState = {
  equation?: SavedEquation | null;
  id: string;
  tick?: number;
  endTick?: number;
  hitBubbles: HitBubblePlacement[];
  spinTargets: SpinTarget[];
  dragTargets: DragTarget[];
};

type MechanicCounts = Record<GameplayMechanic, number>;

type TimelineEventSlot = {
  legacyEncounter?: LegacyEncounter;
  id: string;
  tick: number;
  endTick?: number;
  rctm2Number?: number;
  counts: MechanicCounts;
  assignments: Record<GameplayMechanic, SavedEquation | null>;
  mechanicInstances: Record<GameplayMechanic, MechanicInstanceState[]>;
};

type RtcmDraftMechanic = {
  id: string;
  mechanic: GameplayMechanic;
  /** Captured when the mechanic is authored; never inferred at save time. */
  equationId?: string;
  tick: number;
  endTick?: number;
  hitBubbles: HitBubblePlacement[];
  spinTargets: SpinTarget[];
  dragTargets: DragTarget[];
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

type SidecarEventSlotEvent = {
  legacyEncounter?: LegacyEncounter;
  tick: number;
  type: "ALG_EVENT_SLOT";
  endTick?: number;
};

type SidecarEvent =
  | SidecarMechanicEvent
  | SidecarEquationStateEvent
  | SidecarEventSlotEvent;

type SidecarPayload = {
  legacySource?: LegacyEncounterSidecar;
  authoredSource?: AuthoredLessonDraft;
  version: 1;
  // Seconds after the last event ends at which the game should stop.
  stopAtSeconds?: number;
  events: SidecarEvent[];
};

type LessonBuilderClientProps = {
  studentName?: string;
  navBasePath?: string;
  /** Demo lessons are intentionally local-only; authenticated lessons sync recovery drafts. */
  enableWorkspaceSync?: boolean;
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

type Rctm2BondZone = "leftBond" | "rightBond";
type Rctm2Point = {
  x: number;
  y: number;
};

/* VERIFIED_TIMELINE_HIDDEN_SCROLL_DRAG_HANDLE_PATCH */
/* VERIFIED_TIMELINE_UPLOAD_BUTTONS_PATCH: row 3 subrow 2 supports song/chart/sidecar uploads and updates timeline data. */
const pagePanelWidth = "92vw";
const headerHeight = "5vh";
const viewerRowHeight = "61vh";
const timelineRowHeight = "25vh";
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

// The game should stop this many seconds after the last event in the chart/json ends.
const endOfChartStopBufferSeconds = 5;

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

const activityLabelByKey: Record<SongActivityKey, string> = {
  "number-bonds": "Number Bonds",
  equations: "Equations",
  "missing-numbers": "Missing Numbers",
  "early-algebra": "Early Algebra",
};

const activityKeys: SongActivityKey[] = [
  "number-bonds",
  "equations",
  "missing-numbers",
  "early-algebra",
];

function getActivityLabel(activityKey: SongActivityKey | null | undefined) {
  if (!activityKey) {
    return activityLabelByKey[defaultSongActivityKey];
  }

  return activityLabelByKey[activityKey] ?? activityKey;
}

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

  return Math.max(0, Number(nextTick.toFixed(3)));
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

    const sourceHitId =
      typeof target.sourceHitId === "string" && target.sourceHitId.trim().length > 0
        ? target.sourceHitId
        : undefined;

    return [
      {
        tokenIndex,
        ...(sourceHitId ? { sourceHitId } : {}),
      } as T,
    ];
  });
}

function normalizeSidecar(value: unknown): SidecarPayload {
  if (!isObject(value)) {
    return emptySidecar;
  }

  if (isLegacyEncounterSidecar(value)) {
    validateLegacyEncounters(value);
    const extra = value.events === undefined ? [] : normalizeSidecar({ version: 1, events: value.events }).events;
    return {
      version: 1,
      legacySource: value,
      events: sortEvents([
        ...value.encounters.map(row => ({ tick: row.tick, type: "ALG_EVENT_SLOT" as const, legacyEncounter: row })),
        ...extra,
      ]),
    };
  }

  const authoredSource = repairLegacyMigratedAuthoredLesson(value);
  if (
    authoredSource.version === 3 &&
    authoredSource.mode === "authored" &&
    Array.isArray(authoredSource.equations) &&
    Array.isArray(authoredSource.encounters)
  ) {
    const events: SidecarEvent[] = [];
    const slotByEventId = new Map<string, SidecarEventSlotEvent>();
    const firstTickByEquationId = new Map<string, number>();

    authoredSource.encounters.forEach((rawEncounter) => {
      if (!isObject(rawEncounter)) return;
      const mechanic = normalizeMechanic(rawEncounter.type);
      if (!mechanic) return;
      const tick = normalizeTick(rawEncounter.startTick);
      const eventId =
        typeof rawEncounter.eventId === "string" && rawEncounter.eventId.trim()
          ? rawEncounter.eventId
          : `${mechanic}-${tick}`;
      const currentSlot = slotByEventId.get(eventId);
      const endTick = normalizeTick(rawEncounter.endTick ?? tick);
      if (!currentSlot) {
        const slot: SidecarEventSlotEvent = { tick, endTick, type: "ALG_EVENT_SLOT" };
        slotByEventId.set(eventId, slot);
        events.push(slot);
      } else if (endTick > (currentSlot.endTick ?? currentSlot.tick)) {
        currentSlot.endTick = endTick;
      }

      const equationId =
        typeof rawEncounter.equationId === "string" ? rawEncounter.equationId : "";
      if (equationId && !firstTickByEquationId.has(equationId)) {
        firstTickByEquationId.set(equationId, tick);
      }

      events.push({
        tick,
        endTick: mechanic === "hit" ? undefined : endTick,
        type: "ALG_MECHANIC",
        mechanic,
        hits: mechanic === "hit" ? 1 : undefined,
        equationId: equationId || undefined,
        hitBubbles: Array.isArray(rawEncounter.hitBubbles)
          ? normalizeHitBubblePlacements(rawEncounter.hitBubbles)
          : [],
        spinTargets: Array.isArray(rawEncounter.spinTargets)
          ? normalizeTokenTargets<SpinTarget>(rawEncounter.spinTargets)
          : [],
        dragTargets: Array.isArray(rawEncounter.dragTargets)
          ? normalizeTokenTargets<DragTarget>(rawEncounter.dragTargets)
          : [],
      });
    });

    authoredSource.equations.forEach((rawEquation) => {
      if (!isObject(rawEquation)) return;
      const equationId = typeof rawEquation.id === "string" ? rawEquation.id : "";
      const state = typeof rawEquation.state === "string" ? rawEquation.state : "";
      const tick = firstTickByEquationId.get(equationId);
      if (equationId && state && typeof tick === "number") {
        events.push({ tick, type: "ALG_EQUATION_STATE", equationId, state });
      }
    });

    return {
      version: 1,
      authoredSource: parseAuthoredLessonDraft(authoredSource),
      ...(typeof authoredSource.stopAtSeconds === "number"
        ? { stopAtSeconds: authoredSource.stopAtSeconds }
        : {}),
      events: sortEvents(events),
    };
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

        result.push({
          tick,
          type: "ALG_EVENT_SLOT",
        });

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

    if (event.type === "ALG_EVENT_SLOT") {
      return [
        {
          ...(isObject(event.legacyEncounter) ? { legacyEncounter: event.legacyEncounter as LegacyEncounter } : {}),
          tick: normalizeTick(event.tick),
          ...(typeof event.endTick === "number"
            ? { endTick: normalizeTick(event.endTick) }
            : {}),
          type: "ALG_EVENT_SLOT",
        },
      ];
    }

    return [];
  });

  return {
    version: 1,
    ...(isLegacyEncounterSidecar(value.legacySource) ? { legacySource: value.legacySource } : {}),
    ...(value.authoredSource ? { authoredSource: value.authoredSource as AuthoredLessonDraft } : {}),
    ...(typeof value.stopAtSeconds === "number"
      ? { stopAtSeconds: value.stopAtSeconds }
      : {}),
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
  return tokenizeAuthoredEquationState(state)
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

function applyEquationToEvent(
  eventSlot: TimelineEventSlot,
  equation: SavedEquation,
): TimelineEventSlot {
  const applyToMechanic = (mechanic: GameplayMechanic) =>
    resizeMechanicInstances(
      eventSlot.mechanicInstances?.[mechanic],
      eventSlot.counts?.[mechanic] ?? 0,
    ).map((instance) => ({
      ...instance,
      equation: cloneEquationForAssignment(equation),
    }));

  return applyEquationToEventInstances(
    {
      ...eventSlot,
      mechanicInstances: {
        hit: applyToMechanic("hit"),
        spin: applyToMechanic("spin"),
        drag: applyToMechanic("drag"),
      },
    },
    equation,
  );
}

function makeTimelineEvent(
  index: number,
  tick = 0,
  counts: Partial<MechanicCounts> = {},
  endTick?: number,
): TimelineEventSlot {
  const normalizedCounts = {
    ...makeEmptyMechanicCounts(),
    ...counts,
  };

  return {
    id: makeId("event"),
    tick,
    ...(typeof endTick === "number" ? { endTick } : {}),
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
  const eventSlotEvents = normalized.events.filter(
    (event): event is SidecarEventSlotEvent => event.type === "ALG_EVENT_SLOT",
  );
  const mechanicEvents = normalized.events.filter(
    (event): event is SidecarMechanicEvent => event.type === "ALG_MECHANIC",
  );

  const eventStartTicks = Array.from(
    new Set([
      ...eventSlotEvents.map((event) => event.tick),
      ...equationEvents.map((event) => event.tick),
      ...fallbackEventTicks,
      ...(eventSlotEvents.length === 0 &&
        equationEvents.length === 0 &&
        fallbackEventTicks.length === 0
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

    const matchedEventTick = [...eventStartTicks]
      .reverse()
      .find((eventTick) => {
        const eventSeconds = timelineTickToSeconds(eventTick);

        return (
          mechanicSeconds >= eventSeconds &&
          mechanicSeconds < eventSeconds + timelineEventDurationSeconds
        );
      });

    if (typeof matchedEventTick === "number") {
      return matchedEventTick;
    }

    if (eventStartTicks.length === 0) {
      return undefined;
    }

    // Fallback: keep mechanics attached to the nearest slot instead of dropping
    // them when timing units or window assumptions do not line up.
    return eventStartTicks.reduce((closestTick, tick) => {
      const closestDistance = Math.abs(
        timelineTickToSeconds(closestTick) - mechanicSeconds,
      );
      const nextDistance = Math.abs(timelineTickToSeconds(tick) - mechanicSeconds);

      return nextDistance < closestDistance ? tick : closestTick;
    });
  }

  const slots = eventStartTicks.map((tick, index) => {
    const mechanicsInEvent = expandedMechanicEvents.filter(
      (event) => eventStartTickForMechanicTick(event.tick) === tick,
    );
    const equationsAtTick = equationEvents.filter(
      (event) => event.tick === tick,
    );
    const eventSlotEvent = eventSlotEvents.find((event) => event.tick === tick);
    const counts = makeEmptyMechanicCounts();

    mechanicsInEvent.forEach((mechanicEvent) => {
      counts[mechanicEvent.mechanic] += 1;
    });

    const slot = makeTimelineEvent(
      index,
      tick,
      counts,
      typeof eventSlotEvent?.endTick === "number" ? eventSlotEvent.endTick : undefined,
    );
    const firstEquationEvent = equationsAtTick[0];
    if (eventSlotEvent?.legacyEncounter) slot.legacyEncounter = eventSlotEvent.legacyEncounter;

    if (firstEquationEvent?.state.trim()) {
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

function sidecarInSecondsFromTimelineEvents(
  events: TimelineEventSlot[],
): SidecarPayload {
  const sidecarEvents = events.flatMap((event, eventIndex): SidecarEvent[] => {
    const equation = getTimelineEventEquation(event);
    const equationId = `eq_${String(eventIndex + 1).padStart(3, "0")}`;
    const mechanicEvents = gameplayMechanics.flatMap((mechanic): SidecarEvent[] => {
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
          equationId:
            equation && equation.tokens.length > 0 ? equationId : undefined,
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
    });

    const serializedEvents: SidecarEvent[] = [
      {
        ...(event.legacyEncounter ? { legacyEncounter: event.legacyEncounter } : {}),
        tick: event.tick,
        type: "ALG_EVENT_SLOT",
        ...(typeof event.endTick === "number"
          ? { endTick: normalizeTick(event.endTick) }
          : {}),
      },
      ...mechanicEvents,
    ];

    if (equation && equation.tokens.length > 0) {
      serializedEvents.push({
        tick: event.tick,
        type: "ALG_EQUATION_STATE",
        equationId,
        state: tokensToEquationState(equation.tokens),
      });
    }

    return serializedEvents;
  });

  return {
    version: 1,
    events: sortEvents(sidecarEvents),
  };
}

/**
 * Serialize the editor timeline to the v3 authored draft. Editor positions are
 * fractional audio seconds; conversion to integer chart ticks happens exactly
 * once here through the shared chart tempo map (createLessonClock). Identity
 * (event/instance/equation IDs) is passed through unchanged.
 */
function authoredSidecarFromTimelineEvents(
  events: Array<TimelineEventSlot | AuthoredTimelineEvent>,
  identity: { songAssetId: string; activityKey: string; authorId?: string | null; revision?: string | null },
  clock: ReturnType<typeof createLessonClock>,
  stopAtSeconds?: number,
  equationQueue: SavedEquation[] = [],
  options: { forPublish?: boolean; activityKey?: string | null } = {},
): AuthoredLessonDraft {
  return serializeAuthoredLesson(
    events as unknown as AuthoredTimelineEvent[],
    identity,
    clock,
    stopAtSeconds,
    equationQueue,
    options,
  );
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
        event.eventType !== "ALG_EVENT_SLOT" &&
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
        if (event.eventType === "ALG_EVENT_SLOT") {
          return [
            {
              tick: event.tick,
              type: "ALG_EVENT_SLOT",
            },
          ];
        }

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
  // A supplied sidecar is authoritative, including deliberate deletions.
  if (isObject(sidecarValue) && (
    Array.isArray(sidecarValue.events) || Array.isArray(sidecarValue.encounters) ||
    Array.isArray(sidecarValue.equations)
  )) return normalizedSidecar;
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
  debugLabel,
  signal,
}: {
  signedUrl: string;
  path: string;
  name: string;
  contentType: string | null;
  debugLabel?: string;
  signal?: AbortSignal;
}) {
  appendSongFlowDebug(
    `lesson-builder:${debugLabel ?? "file"}:fetch:start`,
    "Fetching binary asset from signed URL.",
    { path, hasSignedUrl: Boolean(signedUrl), contentType },
  );

  const response = await fetch(signedUrl, { signal });

  appendSongFlowDebug(
    `lesson-builder:${debugLabel ?? "file"}:fetch:response`,
    "Received binary asset response from signed URL.",
    {
      path,
      status: response.status,
      ok: response.ok,
      responseContentType: response.headers.get("content-type"),
    },
  );

  if (!response.ok) {
    const error = new Error(`Unable to load file: ${response.status}`) as Error & { status?: number };
    error.status = response.status;
    throw error;
  }

  const blob = await response.blob();
  const extension = path.split(".").pop();
  const fileName = extension ? `${name}.${extension}` : name;

  return new File([blob], fileName, {
    type: contentType ?? blob.type,
  });
}

async function textFromSignedUrl(signedUrl: string, signal?: AbortSignal) {
  appendSongFlowDebug("lesson-builder:chart:fetch:start", "Fetching chart text from signed URL.", {
    hasSignedUrl: Boolean(signedUrl),
  });

  const response = await fetch(signedUrl, {
    cache: "no-store",
    signal,
    headers: {
      "Cache-Control": "no-cache",
      Pragma: "no-cache",
    },
  });

  appendSongFlowDebug("lesson-builder:chart:fetch:response", "Received chart response from signed URL.", {
    status: response.status,
    ok: response.ok,
    responseContentType: response.headers.get("content-type"),
  });

  if (!response.ok) {
    const error = new Error(`Unable to load text file: ${response.status}`) as Error & { status?: number };
    error.status = response.status;
    throw error;
  }

  const text = await response.text();

  appendSongFlowDebug("lesson-builder:chart:fetch:complete", "Chart text was read from the signed URL response.", {
    length: text.length,
  });

  return text;
}

async function jsonFromSignedUrl(signedUrl: string, signal?: AbortSignal) {
  appendSongFlowDebug("lesson-builder:sidecar:fetch:start", "Fetching sidecar JSON from signed URL.", {
    hasSignedUrl: Boolean(signedUrl),
  });

  const response = await fetch(signedUrl, {
    cache: "no-store",
    signal,
    headers: {
      "Cache-Control": "no-cache",
      Pragma: "no-cache",
    },
  });

  appendSongFlowDebug("lesson-builder:sidecar:fetch:response", "Received sidecar response from signed URL.", {
    status: response.status,
    ok: response.ok,
    responseContentType: response.headers.get("content-type"),
  });

  if (!response.ok) {
    const error = new Error(`Unable to load JSON file: ${response.status}`) as Error & { status?: number };
    error.status = response.status;
    throw error;
  }

  const payload = await response.json();

  appendSongFlowDebug("lesson-builder:sidecar:fetch:complete", "Sidecar JSON was parsed from the signed URL response.", {
    eventCount:
      payload && typeof payload === "object" && Array.isArray((payload as { events?: unknown[] }).events)
        ? (payload as { events: unknown[] }).events.length
        : null,
    version: payload && typeof payload === "object" ? (payload as { version?: unknown }).version ?? null : null,
    mode: payload && typeof payload === "object" ? (payload as { mode?: unknown }).mode ?? null : null,
    activityKey: payload && typeof payload === "object" ? (payload as { activityKey?: unknown }).activityKey ?? null : null,
  });

  return payload;
}

function HeaderBar({
  selectedSongTitle,
  selectedSongArtist,
  selectedActivityLabel,
  isSaving,
  onNavigateHome,
  onOpenFile,
  onLaunch,
  onSave,
  canLaunch,
  canPublish = true,
  isRctm1Mode,
  isRctm2Mode,
  hideChartmaker,
  onToggleRctm1Mode,
  onToggleRctm2Mode,
  selectedActivityKey,
}: {
  selectedSongTitle: string;
  selectedSongArtist: string;
  selectedActivityLabel: string;
  selectedActivityKey: SongActivityKey | null;
  isSaving: boolean;
  onNavigateHome: () => void;
  onOpenFile: () => void;
  onLaunch: () => void;
  onSave: () => void;
  canLaunch: boolean;
  canPublish?: boolean;
  isRctm1Mode: boolean;
  isRctm2Mode: boolean;
  hideChartmaker?: boolean;
  onToggleRctm1Mode: () => void;
  onToggleRctm2Mode: () => void;
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
          <button
            type="button"
            onClick={onNavigateHome}
            aria-label="Back to dashboard home"
            title="Back to dashboard home"
            style={{
              width: 156,
              height: 35,
              display: "inline-flex",
              alignItems: "center",
              flexShrink: 0,
              overflow: "visible",
              background: "none",
              border: "none",
              padding: 0,
              cursor: "pointer",
            }}
          >
            <URIcon
              aria-hidden="true"
              style={{
                width: 156,
                height: 35,
                display: "block",
                flexShrink: 0,
                overflow: "visible",
              }}
            />
          </button>

          <div
            style={{
              minWidth: 0,
              height: 38,
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "0 14px",
              borderRadius: 999,
              border: "1px solid #7A8FA8",
              background: "#060B15FC",
              color: "#FFFFFF",
              fontFamily: "Space Grotesk, sans-serif",
              maxWidth: 320,
              overflow: "hidden",
            }}
          >
            <span
              style={{
                minWidth: 0,
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-start",
                justifyContent: "center",
                lineHeight: 1.05,
              }}
            >
              <span
                style={{
                  width: "100%",
                  color: "#FFFFFF",
                  fontSize: 11,
                  fontWeight: 700,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
                title={selectedSongTitle}
              >
                {selectedSongTitle}
              </span>
              <span
                style={{
                  width: "100%",
                  color: "#D1D5DB",
                  fontSize: 10,
                  fontWeight: 500,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
                title={selectedSongArtist}
              >
                {selectedSongArtist}
              </span>
            </span>
          </div>

          <span
            aria-label="Selected activity"
            style={{
              minWidth: 0,
              maxWidth: 200,
              height: 38,
              padding: "0 14px",
              textDecoration: "none",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#CFFF04",
              fontSize: 12,
              fontWeight: 700,
              borderRadius: 999,
              background: "#060B15FC",
              border: "1px solid #7A8FA8",
              fontFamily: "Space Grotesk, sans-serif",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
            title={selectedActivityLabel}
          >
            {selectedActivityLabel}
          </span>

          {(() => {
            const chartmakerInfo = (() => {
              if (selectedActivityKey === "early-algebra") {
                return { label: studentCopy.editor.advancedTools, onClick: onToggleRctm1Mode, isActive: isRctm1Mode };
              } else if (selectedActivityKey === "equations") {
                return { label: studentCopy.editor.advancedTools, onClick: onToggleRctm1Mode, isActive: isRctm1Mode };
              } else if (selectedActivityKey === "missing-numbers") {
                return { label: studentCopy.editor.advancedTools, onClick: onToggleRctm2Mode, isActive: isRctm2Mode };
              }
              return null;
            })();

            if (!chartmakerInfo || hideChartmaker) return null;

            return (
              <button
                type="button"
                onClick={chartmakerInfo.onClick}
                aria-pressed={chartmakerInfo.isActive}
                style={{
                  minWidth: 106,
                  height: 38,
                  borderRadius: 999,
                  border: "1px solid #7A8FA8",
                  background: chartmakerInfo.isActive ? "#CFFF04" : "#060B15FC",
                  color: chartmakerInfo.isActive ? "#071222" : "#7A8FA8",
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: "pointer",
                  padding: "0 16px",
                  fontFamily: "Space Grotesk, sans-serif",
                }}
              >
                {chartmakerInfo.label}
              </button>
            );
          })()}
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
          <button
            type="button"
            onClick={onOpenFile}
            aria-label={studentCopy.editor.changeSongLabel}
            title={studentCopy.editor.changeSongLabel}
            style={{
              width: 64,
              height: 30,
              borderRadius: 12,
              border: `1px solid ${subtleBorderColor}`,
              background: panelBackgroundColor,
              padding: "0 8px",
              color: "#FFFFFF",
              fontSize: 10,
              fontWeight: 800,
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 5,
              fontFamily: "Space Grotesk, sans-serif",
            }}
          >
            <img
              src="/file.svg"
              alt=""
              aria-hidden="true"
              style={{ width: 12, height: 12, display: "block" }}
            />
            {studentCopy.editor.changeSong}
          </button>

          <button
            type="button"
            onClick={onLaunch}
            disabled={!canLaunch || isSaving}
            aria-label={studentCopy.editor.playLessonLabel}
            title={isSaving ? "Saving lesson changes" : canLaunch ? studentCopy.editor.playLessonLabel : studentCopy.editor.pickSongBeforePlay}
            style={{
              minWidth: 70,
              height: 30,
              borderRadius: 12,
              border: `1px solid ${subtleBorderColor}`,
              background: canLaunch && !isSaving ? "#CFFF04" : "rgba(207,255,4,0.12)",
              color: canLaunch && !isSaving ? "#071222" : "#7A8FA8",
              fontFamily: "Space Grotesk, sans-serif",
              fontSize: 11,
              fontWeight: 800,
              cursor: canLaunch && !isSaving ? "pointer" : "not-allowed",
              opacity: canLaunch && !isSaving ? 1 : 0.55,
            }}
          >
            Play
          </button>

          <button
            type="button"
            disabled={!canPublish || isSaving}
            onClick={onSave}
            aria-label={studentCopy.editor.saveLessonLabel}
            title={canPublish ? studentCopy.editor.saveLessonLabel : "Finish the lesson before saving"}
            style={{
              width: 60,
              height: 29,
              border: "none",
              borderRadius: 12,
              background: "transparent",
              padding: 0,
              cursor: canPublish && !isSaving ? "pointer" : "not-allowed",
              opacity: canPublish && !isSaving ? 1 : 0.55,
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
                width: 60,
                height: 29,
                display: "block",
                objectFit: "contain",
              }}
            />
          </button>
        </div>
      </div>
    </header>
  );
}

function UnsavedChangesModal({
  isSaving,
  onSaveAndLeave,
  onLeaveWithoutSaving,
  onStay,
}: {
  isSaving: boolean;
  onSaveAndLeave: () => void;
  onLeaveWithoutSaving: () => void;
  onStay: () => void;
}) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.6)",
        display: "grid",
        placeItems: "center",
        zIndex: 2000,
        padding: 20,
      }}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-label="Unsaved changes"
        style={{
          width: "min(440px, 92vw)",
          borderRadius: 14,
          border: `1px solid ${subtleBorderColor}`,
          background: "#101621",
          color: "#FFFFFF",
          padding: 18,
          boxSizing: "border-box",
          fontFamily: "Space Grotesk, sans-serif",
          display: "grid",
          gap: 14,
        }}
      >
        <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>{studentCopy.editor.unsavedTitle}</h2>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "#D1D5DB", lineHeight: 1.45 }}>
          {studentCopy.editor.unsavedBody}
        </p>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={onStay}
            style={{
              minHeight: 34,
              borderRadius: 999,
              border: `1px solid ${subtleBorderColor}`,
              background: "#1D2533",
              color: "#FFFFFF",
              fontSize: 12,
              fontWeight: 700,
              padding: "0 14px",
              cursor: "pointer",
            }}
          >
            {studentCopy.editor.keepEditing}
          </button>
          <button
            type="button"
            onClick={onLeaveWithoutSaving}
            style={{
              minHeight: 34,
              borderRadius: 999,
              border: `1px solid ${subtleBorderColor}`,
              background: "#252525",
              color: "#FF9B9B",
              fontSize: 12,
              fontWeight: 700,
              padding: "0 14px",
              cursor: "pointer",
            }}
          >
            {studentCopy.editor.leaveWithoutSaving}
          </button>
          <button
            type="button"
            onClick={onSaveAndLeave}
            disabled={isSaving}
            style={{
              minHeight: 34,
              borderRadius: 999,
              border: "1px solid #CFFF04",
              background: "#CFFF04",
              color: "#071222",
              fontSize: 12,
              fontWeight: 800,
              padding: "0 14px",
              cursor: isSaving ? "not-allowed" : "pointer",
              opacity: isSaving ? 0.6 : 1,
            }}
          >
            {isSaving ? "Saving…" : studentCopy.editor.saveAndLeave}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Small tutorial callout used by the demo walkthrough. It stays out of the
 * way of the editor and offers a quick way to dismiss the tips.
 */
function TutorialBubble({
  text,
  onSkip,
}: {
  text: string;
  onSkip: () => void;
}) {
  return (
    <div
      role="dialog"
      aria-label="Tutorial step"
      style={{
        position: "relative",
        borderRadius: 10,
        border: "1px solid #CFFF04",
        background: "#101621",
        color: "#FFFFFF",
        padding: "22px 12px 10px",
        boxSizing: "border-box",
        fontFamily: "Space Grotesk, sans-serif",
        fontSize: 12,
        fontWeight: 700,
        lineHeight: 1.4,
        boxShadow: "0 8px 24px rgba(0,0,0,0.45)",
      }}
    >
      <button
        type="button"
        onClick={onSkip}
        style={{
          position: "absolute",
          top: 4,
          left: 6,
          background: "none",
          border: "none",
          padding: 0,
          color: "#FFFFFF80",
          fontSize: 9,
          fontWeight: 800,
          textDecoration: "underline",
          cursor: "pointer",
        }}
      >
        {studentCopy.editor.tutorialSkip}
      </button>
      {text}
    </div>
  );
}

type EditorToastKind = "info" | "success" | "error";

function editorToastKindForMessage(message: string): EditorToastKind {
  if (/could not|unable|failed|rejected|blocked|conflict|error|invalid|unavailable/i.test(message)) {
    return "error";
  }

  if (/saved|published|ready|loaded|added|showing|deleted|kept|downloaded|updated|created|removed/i.test(message)) {
    return "success";
  }

  return "info";
}

function EditorToast({
  message,
  hasUnsavedChanges,
}: {
  message: string;
  hasUnsavedChanges: boolean;
}) {
  const [isMounted, setIsMounted] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const removeTimerRef = useRef<number | null>(null);
  const hideTimerRef = useRef<number | null>(null);
  const kind = editorToastKindForMessage(message);

  useEffect(() => {
    if (removeTimerRef.current !== null) {
      window.clearTimeout(removeTimerRef.current);
    }
    if (hideTimerRef.current !== null) {
      window.clearTimeout(hideTimerRef.current);
    }

    if (!message) {
      const hideFrameId = window.requestAnimationFrame(() => setIsVisible(false));
      removeTimerRef.current = window.setTimeout(() => setIsMounted(false), 220);
      return () => {
        window.cancelAnimationFrame(hideFrameId);
        if (removeTimerRef.current !== null) {
          window.clearTimeout(removeTimerRef.current);
        }
      };
    }

    let enterFrameId: number | null = null;
    const mountFrameId = window.requestAnimationFrame(() => {
      setIsMounted(true);
      setIsVisible(false);
      enterFrameId = window.requestAnimationFrame(() => setIsVisible(true));
    });
    const duration = kind === "error" ? 5000 : kind === "success" ? 2800 : 2400;
    hideTimerRef.current = window.setTimeout(() => {
      setIsVisible(false);
      removeTimerRef.current = window.setTimeout(() => setIsMounted(false), 240);
    }, duration);

    return () => {
      window.cancelAnimationFrame(mountFrameId);
      if (enterFrameId !== null) {
        window.cancelAnimationFrame(enterFrameId);
      }
      if (hideTimerRef.current !== null) {
        window.clearTimeout(hideTimerRef.current);
      }
      if (removeTimerRef.current !== null) {
        window.clearTimeout(removeTimerRef.current);
      }
    };
  }, [kind, message]);

  if (!isMounted || !message) {
    return null;
  }

  return (
    <div
      className={`${styles.editorToast} ${styles[`editorToast${kind[0].toUpperCase()}${kind.slice(1)}`]} ${isVisible ? styles.editorToastVisible : styles.editorToastHiding}`}
      role={kind === "error" ? "alert" : "status"}
      aria-live={kind === "error" ? "assertive" : "polite"}
      aria-atomic="true"
    >
      <span className={styles.editorToastIndicator} aria-hidden="true" />
      <span className={styles.editorToastMessage}>
        <span className={styles.editorToastLabel}>
          {kind === "error" ? "Needs attention" : "Update"}
        </span>
        <span>{message}</span>
        {hasUnsavedChanges ? (
          <span className={styles.editorToastSecondary}>
            Save your lesson to use these changes when you play.
          </span>
        ) : null}
      </span>
      <button
        type="button"
        className={styles.editorToastDismiss}
        aria-label="Dismiss notification"
        onClick={() => {
          setIsVisible(false);
          removeTimerRef.current = window.setTimeout(() => setIsMounted(false), 240);
        }}
      >
        ×
      </button>
    </div>
  );
}

function EditorPanelRail({
  label,
  onOpen,
}: {
  label: string;
  onOpen: () => void;
}) {
  return (
    <div className={styles.editorPanelRail}>
      <button type="button" onClick={onOpen} className={styles.editorPanelRailButton} aria-label={`Open ${label}`}>
        <span aria-hidden="true">{label}</span>
        <span className={styles.editorPanelRailIcon} aria-hidden="true">+</span>
      </button>
    </div>
  );
}

function SongFilePickerModal({
  isOpen,
  isLoading,
  error,
  authors,
  isLoadingAuthors,
  authorName,
  activityKey,
  songs,
  selectedSongId,
  selectedRhythmSourceRevision,
  onAuthorChange,
  onActivityChange,
  onSelectSong,
  onSelectRhythmSource,
  onClose,
  onLoad,
}: {
  isOpen: boolean;
  isLoading: boolean;
  error: string;
  authors: SongChartAuthorOption[];
  isLoadingAuthors: boolean;
  authorName: string | null;
  activityKey: SongActivityKey;
  songs: SongChoiceOption[];
  selectedSongId: string | null;
  selectedRhythmSourceRevision: string | null;
  onAuthorChange: (value: string) => void;
  onActivityChange: (value: SongActivityKey) => void;
  onSelectSong: (songId: string) => void;
  onSelectRhythmSource: (revision: string) => void;
  onClose: () => void;
  onLoad: () => void;
}) {
  if (!isOpen) {
    return null;
  }

  const selectedSong = songs.find((song) => song.id === selectedSongId) ?? null;
  const requiresRhythmSource = selectedSong?.requiresRhythmSource === true;
  const rhythmSources = selectedSong?.rhythmSources ?? [];
  const canLoad = Boolean(
    selectedSongId &&
    (!requiresRhythmSource || rhythmSources.some((source) => source.revision === selectedRhythmSourceRevision)),
  );

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.6)",
        display: "grid",
        placeItems: "center",
        zIndex: 1000,
        padding: 20,
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Select song and activity"
        style={{
          width: "min(580px, 92vw)",
          borderRadius: 14,
          border: `1px solid ${subtleBorderColor}`,
          background: "#101621",
          color: "#FFFFFF",
          padding: 16,
          boxSizing: "border-box",
          fontFamily: "Space Grotesk, sans-serif",
          display: "grid",
          gap: 12,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>Choose a song</h2>
          <button
            type="button"
            onClick={onClose}
            style={{
              border: `1px solid ${subtleBorderColor}`,
              borderRadius: 8,
              background: "#1D2533",
              color: "#FFFFFF",
              fontSize: 12,
              fontWeight: 700,
              height: 30,
              padding: "0 10px",
              cursor: "pointer",
            }}
          >
            Close
          </button>
        </div>

        <div style={{ display: "grid", gap: 6 }}>
          <label htmlFor="lesson-builder-author-select" style={{ fontSize: 12, fontWeight: 700, color: "#D1D5DB" }}>
            Teacher or creator
          </label>
          <select
            id="lesson-builder-author-select"
            value={authorName ?? ""}
            onChange={(event) => onAuthorChange(event.target.value)}
            disabled={isLoadingAuthors || authors.length === 0}
            style={{
              height: 34,
              borderRadius: 10,
              border: `1px solid ${subtleBorderColor}`,
              background: "#151E2B",
              color: "#FFFFFF",
              padding: "0 10px",
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            {authors.length === 0 ? (
              <option value="">
                {isLoadingAuthors ? "Loading creators…" : "No creators found"}
              </option>
            ) : (
              authors.map((author) => (
                <option key={author.id} value={author.name}>
                  {`${author.name} (${author.chartCount})`}
                </option>
              ))
            )}
          </select>
        </div>

        <div style={{ display: "grid", gap: 6 }}>
          <label htmlFor="lesson-builder-activity-select" style={{ fontSize: 12, fontWeight: 700, color: "#D1D5DB" }}>
            Learning activity
          </label>
          <select
            id="lesson-builder-activity-select"
            value={activityKey}
            onChange={(event) => onActivityChange(event.target.value as SongActivityKey)}
            disabled={!authorName}
            style={{
              height: 34,
              borderRadius: 10,
              border: `1px solid ${subtleBorderColor}`,
              background: "#151E2B",
              color: "#FFFFFF",
              padding: "0 10px",
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            {activityKeys.map((key) => (
              <option key={key} value={key}>
                {getActivityLabel(key)}
              </option>
            ))}
          </select>
        </div>

        <div style={{ display: "grid", gap: 6 }}>
          <label htmlFor="lesson-builder-song-select" style={{ fontSize: 12, fontWeight: 700, color: "#D1D5DB" }}>
            Song
          </label>
          <select
            id="lesson-builder-song-select"
            value={selectedSongId ?? ""}
            onChange={(event) => onSelectSong(event.target.value)}
            disabled={isLoading || songs.length === 0}
            style={{
              height: 34,
              borderRadius: 10,
              border: `1px solid ${subtleBorderColor}`,
              background: "#151E2B",
              color: "#FFFFFF",
              padding: "0 10px",
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            {songs.length === 0 ? (
              <option value="">
                {authorName ? "No songs found" : "Choose a creator first"}
              </option>
            ) : (
              songs.map((song) => (
                <option key={song.id} value={song.id}>
                  {`${song.name}${song.artist ? ` - ${song.artist}` : ""}`}
                </option>
              ))
            )}
          </select>
        </div>

        {requiresRhythmSource ? (
          <div style={{ display: "grid", gap: 6 }}>
            <label htmlFor="lesson-builder-rhythm-source-select" style={{ fontSize: 12, fontWeight: 700, color: "#D1D5DB" }}>
              Use this song&apos;s rhythm from
            </label>
            <select
              id="lesson-builder-rhythm-source-select"
              value={selectedRhythmSourceRevision ?? ""}
              onChange={(event) => onSelectRhythmSource(event.target.value)}
              disabled={rhythmSources.length === 0}
              style={{
                height: 38,
                borderRadius: 10,
                border: "1px solid #CFFF0466",
                background: "#151E2B",
                color: "#FFFFFF",
                padding: "0 10px",
                fontSize: 12,
                fontWeight: 700,
              }}
            >
              <option value="">Choose a verified rhythm…</option>
              {rhythmSources.map((source) => (
                <option key={source.revision} value={source.revision}>
                  {`${getActivityLabel(source.activityKey)} · revision ${source.revision.slice(0, 8)}`}
                </option>
              ))}
            </select>
            <div style={{ color: rhythmSources.length ? "#AFC2D8" : "#FF9B9B", fontSize: 11, lineHeight: 1.45 }}>
              {rhythmSources.length
                ? "This brings across verified beat timing only. Your Number Bonds equation and catches start fresh; the song audio remains shared."
                : "This song has no verified rhythm revision available to start from."}
            </div>
          </div>
        ) : null}

        {isLoading ? (
          <div style={{ color: "#D1D5DB", fontSize: 12, fontWeight: 600 }}>
            Loading songs…
          </div>
        ) : null}

        {error ? (
          <div style={{ color: "#FF9B9B", fontSize: 12, fontWeight: 600 }}>
            {error}
          </div>
        ) : null}

        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button
            type="button"
            onClick={onLoad}
            disabled={isLoading || !canLoad}
            style={{
              minWidth: 132,
              height: 34,
              borderRadius: 999,
              border: "1px solid #CFFF04",
              background: "#CFFF04",
              color: "#071222",
              fontSize: 12,
              fontWeight: 800,
              cursor: isLoading || !canLoad ? "not-allowed" : "pointer",
              opacity: isLoading || !canLoad ? 0.6 : 1,
            }}
          >
            Choose this song
          </button>
        </div>
      </div>
    </div>
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
  const [equationScale, setEquationScale] = useState(1);
  const equationContainerRef = useRef<HTMLDivElement>(null);
  const equationContentRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const container = equationContainerRef.current;
    const content = equationContentRef.current;

    if (!container || !content) return;

    const measureAndScale = () => {
      const containerWidth = container.clientWidth;
      const contentWidth = content.scrollWidth;
      const containerHeight = container.clientHeight;
      const contentHeight = content.scrollHeight;

      if (contentWidth > containerWidth || contentHeight > containerHeight) {
        const scaleWidth = containerWidth / contentWidth;
        const scaleHeight = containerHeight / contentHeight;
        const newScale = Math.min(scaleWidth, scaleHeight, 1);
        setEquationScale(Math.max(0.5, newScale));
      } else {
        setEquationScale(1);
      }
    };

    // Measure on next frame to ensure DOM is ready
    const rafId = requestAnimationFrame(measureAndScale);

    // Also use ResizeObserver for responsive scaling
    const resizeObserver = new ResizeObserver(measureAndScale);
    resizeObserver.observe(container);

    return () => {
      cancelAnimationFrame(rafId);
      resizeObserver.disconnect();
    };
  }, [draftTokens]);

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
        ref={equationContainerRef}
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
          overflow: "hidden",
          fontFamily: "Space Grotesk, sans-serif",
        }}
      >
        <EquationTrashDropZone
          isActive={isTrashActive}
          onActiveChange={setIsTrashActive}
          onRemoveToken={onRemoveToken}
        />

        <div
          ref={equationContentRef}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 0,
            flexWrap: "wrap",
            padding: "0 96px",
            minHeight: 150,
            width: "100%",
            maxWidth: "100%",
            transform: `scale(${equationScale})`,
            transformOrigin: "center",
            transition: "transform 200ms ease",
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
              {studentCopy.editor.emptyEquation}
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
          {studentCopy.editor.saveEquation}
        </button>
      </div>
    </div>
  );
}

function isEquationOperator(label: string) {
  return isAuthoredEquationOperator(label);
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

function getHitPadNumber(pad: HitBubblePad): 1 | 2 | 3 | 4 | 5 | 6 {
  if (pad === "topLeft") return 1;
  if (pad === "topRight") return 2;
  if (pad === "left") return 3;
  if (pad === "right") return 4;
  if (pad === "bottomLeft") return 5;
  return 6;
}

function getHitPadNumberFromPlacement(
  placement: HitBubblePlacement | undefined,
): number | null {
  const pair = getHitBubblePairFromPlacement(placement);
  const pad = pair ? getHitBubblePairPads(pair)[0] : null;

  return pad ? getHitPadNumber(pad) : null;
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
  onSelect: (pad: HitBubblePad) => void;
}) {
  const choices: Array<{ pad: HitBubblePad; label: string; position: string }> = [
    { pad: "topLeft", label: "↖", position: "top-left" },
    { pad: "topRight", label: "↗", position: "top-right" },
    { pad: "left", label: "←", position: "left" },
    { pad: "right", label: "→", position: "right" },
    { pad: "bottomLeft", label: "↙", position: "bottom-left" },
    { pad: "bottomRight", label: "↘", position: "bottom-right" },
  ];

  return (
    <span
      style={{
        position: "absolute",
        left: "50%",
        top: -48,
        transform: "translateX(-50%)",
        zIndex: 20,
        display: "grid",
        gridTemplateColumns: "repeat(3, 1fr)",
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
          key={choice.pad}
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onSelect(choice.pad);
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
          aria-label={`Choose hit pad ${choice.position}`}
          title={choice.position}
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
  onAddHitPad,
}: {
  tokens: EquationToken[];
  hitBubbles: HitBubblePlacement[];
  onAddHitPad: (tokenIndex: number, pad: HitBubblePad) => void;
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
                onSelect={(pad) => {
                  onAddHitPad(tokenIndex, pad);
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
        const path = `M ${arc.startX} ${arc.startY} C ${arc.startX + deltaX * 0.18
          } ${controlY}, ${arc.startX + deltaX * 0.82} ${controlY}, ${arc.endX
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
      queueMicrotask(() => setArcs([]));
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
  onAddHitPad,
  onToggleSpinTarget,
  onToggleDragTarget,
}: {
  mechanic: GameplayMechanic;
  equation: SavedEquation | null;
  instance: MechanicInstanceState | undefined;
  onAddHitPad: (tokenIndex: number, pad: HitBubblePad) => void;
  onToggleSpinTarget: (tokenIndex: number) => void;
  onToggleDragTarget: (tokenIndex: number) => void;
}) {
  if (!equation) {
    return (
      <div
        style={{
          position: "relative",
          minWidth: 140,
          minHeight: 140,
          display: "grid",
          placeItems: "center",
          overflow: "visible",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "grid",
            placeItems: "center",
            pointerEvents: "none",
          }}
        >
          <EquationCircle label="" draggable={false} size={68} />
        </div>

        {mechanic === "hit" ? (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "grid",
              placeItems: "center",
              pointerEvents: "none",
            }}
          >
            <span style={{ color: "#FFFFFF66", fontSize: 11, fontWeight: 700 }}>
              Empty hit token
            </span>
          </div>
        ) : mechanic === "spin" ? (
          <SpinOverlay />
        ) : (
          <svg
            aria-hidden="true"
            viewBox="0 0 240 180"
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              overflow: "visible",
              pointerEvents: "none",
            }}
          >
            <path
              d="M 70 115 C 110 55, 150 55, 190 115"
              fill="none"
              stroke="#B45CFF"
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray="18 12"
            />
          </svg>
        )}
      </div>
    );
  }

  if (mechanic === "hit") {
    return (
      <HitEquationEditor
        tokens={equation.tokens}
        hitBubbles={instance?.hitBubbles ?? []}
        onAddHitPad={onAddHitPad}
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
  activityKey,
  count,
  equation,
  instances,
  onDropEquation,
  onAddHitPad,
  onToggleSpinTarget,
  onToggleDragTarget,
  onPatchInstance,
  dragSources = [],
}: {
  mechanic: GameplayMechanic;
  activityKey?: SongActivityKey | null;
  count: number;
  equation: SavedEquation | null;
  instances: MechanicInstanceState[];
  onDropEquation: (equation: SavedEquation) => void;
  onAddHitPad: (
    mechanic: GameplayMechanic,
    instanceIndex: number,
    tokenIndex: number,
    pad: HitBubblePad,
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
  onPatchInstance: (instanceId: string, patch: Partial<MechanicInstanceState>) => void;
  dragSources?: Array<{ id: string; label: string }>;
}) {
  const [activeInstanceIndex, setActiveInstanceIndex] = useState(0);
  const safeCount = Math.max(0, Math.round(count));
  const tabLabel =
    mechanic === "hit" ? "Hit" : mechanic === "spin" ? "Spin" : "Drag";

  useEffect(() => {
    queueMicrotask(() => setActiveInstanceIndex((current) =>
      safeCount > 0 ? Math.min(current, safeCount - 1) : 0,
    ));
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
  const composerInstance = (activeInstance ?? {
    ...makeMechanicInstance(),
    id: `${mechanic}-draft-${activeInstanceIndex + 1}`,
  }) as GuidedEncounterInput;
  const guidedInstance: GuidedEncounterInput = {
    ...composerInstance,
    mechanic,
    equation: activeInstance?.equation ?? equation,
  };
  const readiness = evaluateEncounterReadiness(guidedInstance, new Set(), { activityKey });

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
        overflow: "visible",
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
            overflow: "visible",
          }}
        >
          <GuidedEncounterComposer
            instance={guidedInstance}
            tokens={equation?.tokens ?? []}
            readiness={readiness}
            step={activeInstanceIndex + 1}
            stepCount={safeCount}
            dragSources={dragSources}
            onPatchInstance={(instanceId, patch) => onPatchInstance(instanceId, patch as Partial<MechanicInstanceState>)}
          />
        </div>
      </div>
    </div>
  );
}

function EventBuilderArea({
  eventSlot,
  activityKey,
  onDropEquation,
  onAddHitPad,
  onToggleSpinTarget,
  onToggleDragTarget,
  onPatchInstance,
  dragSources = [],
}: {
  eventSlot: TimelineEventSlot | null;
  activityKey?: SongActivityKey | null;
  onDropEquation: (equation: SavedEquation) => void;
  onAddHitPad: (
    mechanic: GameplayMechanic,
    instanceIndex: number,
    tokenIndex: number,
    pad: HitBubblePad,
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
  onPatchInstance: (mechanic: GameplayMechanic, instanceIndex: number, patch: Partial<MechanicInstanceState>) => void;
  dragSources?: Array<{ id: string; label: string }>;
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
        {studentCopy.editor.chooseEventFirst}
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
            No moves in this encounter yet.
          </div>
        ) : (
          visibleMechanics.map((mechanic) => (
            <MechanicInstanceRow
              key={mechanic}
              mechanic={mechanic}
              activityKey={activityKey}
              count={eventSlot.counts[mechanic]}
              equation={assignedEquation}
              instances={eventSlot.mechanicInstances[mechanic] ?? []}
              onDropEquation={onDropEquation}
              onAddHitPad={onAddHitPad}
              onToggleSpinTarget={onToggleSpinTarget}
              onToggleDragTarget={onToggleDragTarget}
              onPatchInstance={(instanceId, patch) => {
                const instanceIndex = (eventSlot.mechanicInstances[mechanic] ?? []).findIndex((instance) => instance.id === instanceId);
                onPatchInstance(mechanic, instanceIndex >= 0 ? instanceIndex : 0, patch);
              }}
              dragSources={dragSources}
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

  // All editor positions use audio seconds. Convert at the file boundary.
  return tick;
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
  if (typeof eventSlot.endTick === "number") {
    const startSeconds = timelineTickToSeconds(eventSlot.tick);
    const endSeconds = timelineTickToSeconds(eventSlot.endTick);

    return {
      startSeconds,
      endSeconds: Math.max(startSeconds, endSeconds),
    };
  }

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

    if (hasMechanics || typeof eventSlot.endTick === "number") {
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

function getRctmDeleteTargetEventId({
  mode,
  activeEventId,
  playheadEventId,
  eventIds,
}: {
  mode: string;
  activeEventId: string | null;
  playheadEventId: string | null;
  eventIds: string[];
}) {
  if (mode === "rctm1" || mode === "rctm2") {
    if (activeEventId && eventIds.includes(activeEventId)) {
      return activeEventId;
    }

    return playheadEventId ?? null;
  }

  return activeEventId ?? null;
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
  hideSpinouts = false,
  activityKey,
  activeEventId,
  onSelectEvent,
  currentSongSeconds,
  durationSeconds,
  waveformPeaks,
  onSeek,
  onPlayheadDragStart,
  onPlayheadDragEnd,
  onRetimeMechanicMarker,
  onRetimeEventEdge,
  audioObjectUrl,
  isAdvancedMode,
}: {
  events: TimelineEventSlot[];
  hideSpinouts?: boolean;
  activityKey: SongActivityKey | null;
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
  onRetimeEventEdge: (
    eventId: string,
    edge: TimelineMarkerEdge,
    seconds: number,
  ) => void;
  audioObjectUrl: string;
  isAdvancedMode: boolean;
}) {
  const timelineTrackRef = useRef<HTMLDivElement | null>(null);
  const waveformContainerRef = useRef<HTMLDivElement | null>(null);
  const wavesurferRef = useRef<{
    load(url: string): void;
    destroy(): void;
  } | null>(null);
  const [isDraggingPlayhead, setIsDraggingPlayhead] = useState(false);
  const [draggedMechanicMarker, setDraggedMechanicMarker] = useState<{
    eventId: string;
    mechanic: GameplayMechanic;
    instanceIndex: number;
    edge: TimelineMarkerEdge;
  } | null>(null);
  const [draggedEventEdge, setDraggedEventEdge] = useState<{
    eventId: string;
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
  const authoringCapabilities = getActivityAuthoringCapabilities(activityKey);
  const mechanicsForTimeline = authoringCapabilities.supportedAuthoredMechanics
    .filter((mechanic) => !(hideSpinouts && mechanic === "spin"));
  const isNumberBondsTimeline = authoringCapabilities.activityKey === "number-bonds";
  const rowCountAfterHeader = 2 + mechanicsForTimeline.length;
  const rowHeightPercent = (100 - 15) / rowCountAfterHeader;
  const timelineGridRows = `15% repeat(${rowCountAfterHeader}, ${rowHeightPercent}%)`;

  const labelRows = [
    { key: "merged", label: "", color: "#FFFFFF" },
    { key: "equations", label: isNumberBondsTimeline ? "Bond" : "Equations", color: "#CFFF04" },
    ...mechanicsForTimeline.map((mechanic) => ({
      key: mechanic,
      label: mechanic === "hit" ? (isNumberBondsTimeline ? "Catch cues" : "Hits") : mechanic === "spin" ? "Spinouts" : "Drags",
      color: mechanic === "hit" ? "#2EA7FF" : mechanic === "spin" ? "#FF3535" : "#B45CFF",
    })),
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

  function retimeDraggedEventEdge(
    edgeDrag: {
      eventId: string;
      edge: TimelineMarkerEdge;
    },
    clientX: number,
    options: { autoScroll?: boolean } = {},
  ) {
    const seconds = getSecondsFromClientX(clientX, {
      autoScroll: options.autoScroll,
    });

    onRetimeEventEdge(
      edgeDrag.eventId,
      edgeDrag.edge,
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

  function handleEventEdgePointerDown(
    event: PointerEvent<HTMLButtonElement>,
    edgeDrag: {
      eventId: string;
      edge: TimelineMarkerEdge;
    },
  ) {
    event.preventDefault();
    event.stopPropagation();
    onPlayheadDragStart();
    setDraggedEventEdge(edgeDrag);
    event.currentTarget.setPointerCapture(event.pointerId);
    retimeDraggedEventEdge(edgeDrag, event.clientX);
  }

  function handleEventEdgePointerMove(event: PointerEvent<HTMLButtonElement>) {
    if (!draggedEventEdge) {
      return;
    }

    event.preventDefault();
    retimeDraggedEventEdge(draggedEventEdge, event.clientX, {
      autoScroll: true,
    });
  }

  function handleEventEdgePointerUp(event: PointerEvent<HTMLButtonElement>) {
    if (draggedEventEdge) {
      event.preventDefault();
      retimeDraggedEventEdge(draggedEventEdge, event.clientX, {
        autoScroll: true,
      });
      setDraggedEventEdge(null);
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
          gridTemplateRows: timelineGridRows,
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
            gridTemplateRows: timelineGridRows,
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
                  <div
                    key={eventSlot.id}
                    data-timeline-interactive="true"
                    style={{
                      position: "absolute",
                      left: eventLeft,
                      top: "50%",
                      width: eventWidth,
                      minWidth: 44,
                      minHeight: 30,
                      transform: "translateY(-50%)",
                    }}
                  >
                    <button
                      type="button"
                      onPointerDown={(event) => event.stopPropagation()}
                      onClick={() => onSelectEvent(eventSlot.id)}
                      style={{
                        position: "absolute",
                        inset: 0,
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
                        {eventSlot.rctm2Number
                          ? `${studentCopy.editor.moveGroup(index + 1)} · #${eventSlot.rctm2Number}`
                          : studentCopy.editor.moveGroup(index + 1)}
                      </span>
                    </button>

                    {(["start", "end"] as TimelineMarkerEdge[]).map((edge) => (
                      <button
                        key={`${eventSlot.id}-event-edge-${edge}`}
                        type="button"
                        aria-label={`Drag event ${edge} edge`}
                        onPointerDown={(event) =>
                          handleEventEdgePointerDown(event, {
                            eventId: eventSlot.id,
                            edge,
                          })
                        }
                        onPointerMove={handleEventEdgePointerMove}
                        onPointerUp={handleEventEdgePointerUp}
                        onPointerCancel={handleEventEdgePointerUp}
                        style={{
                          position: "absolute",
                          top: -1,
                          bottom: -1,
                          width: 16,
                          [edge === "start" ? "left" : "right"]: -8,
                          border: "none",
                          borderRadius: 0,
                          background: "transparent",
                          boxShadow: "none",
                          opacity: 0,
                          cursor: "ew-resize",
                          padding: 0,
                          touchAction: "none",
                        }}
                      />
                    ))}
                  </div>
                );
              })
            )}
          </div>

          {mechanicsForTimeline.map((mechanic) => {
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
                                width: 20,
                                height: 20,
                                border: `1px solid ${color}`,
                                borderRadius: 999,
                                background: color,
                                boxShadow: `0 0 12px ${color}`,
                                transform: "translate(-50%, -50%)",
                                cursor: "grab",
                                touchAction: "none",
                                padding: 0,
                                color: "#071222",
                                fontSize: 10,
                                fontWeight: 900,
                                lineHeight: "20px",
                                textAlign: "center",
                              }}
                              aria-label={`Drag ${mechanic} timing`}
                            >
                              {getHitPadNumberFromPlacement(instance.hitBubbles?.[0]) ?? ""}
                            </button>
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
  selectedHitPad,
  onSelectHitPad,
  fontSizeOverride,
  currentSongSeconds,
  mechanicStartSeconds,
  mechanicEndSeconds,
  isSongPlaying = false,
  onQuickAddHit,
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
  selectedHitPad?: HitBubblePad | null;
  onSelectHitPad?: (pad: HitBubblePad) => void;
  fontSizeOverride?: {
    operator: number;
    nonOperator: number;
  };
  currentSongSeconds?: number;
  mechanicStartSeconds?: number | null;
  mechanicEndSeconds?: number | null;
  isSongPlaying?: boolean;
  onQuickAddHit?: () => void;
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

  const hitPadOffsets: Record<HitBubblePad, { dx: number; dy: number }> = {
    topLeft: {
      dx: -(baseTokenWidth * 0.5 + hitCircleOffset),
      dy: -(baseTokenHeight * 0.5 + hitCircleOffset),
    },
    topRight: {
      dx: baseTokenWidth * 0.5 + hitCircleOffset,
      dy: -(baseTokenHeight * 0.5 + hitCircleOffset),
    },
    left: {
      dx: 0,
      dy: -(baseTokenHeight * 0.5 + hitCircleOffset),
    },
    right: {
      dx: 0,
      dy: baseTokenHeight * 0.5 + hitCircleOffset,
    },
    bottomLeft: {
      dx: -(baseTokenWidth * 0.5 + hitCircleOffset),
      dy: baseTokenHeight * 0.5 + hitCircleOffset,
    },
    bottomRight: {
      dx: baseTokenWidth * 0.5 + hitCircleOffset,
      dy: baseTokenHeight * 0.5 + hitCircleOffset,
    },
  };

  const hitPads: HitBubblePad[] = ["topLeft", "topRight", "left", "right", "bottomLeft", "bottomRight"];

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
            {hitPads.map((pad) => {
              const isPadSelected = selectedHitPad === pad;
              const position = hitPadOffsets[pad];

              return (
                <button
                  key={`${token.id}-${pad}`}
                  type="button"
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    if (mechanicMode === "hit" && isSongPlaying) {
                      onQuickAddHit?.();
                    }
                    onSelectHitPad?.(pad);
                  }}
                  style={{
                    position: "absolute",
                    width: hitCircleSize,
                    height: hitCircleSize,
                    borderRadius: 999,
                    border: `${hitCircleBorderWidth}px solid ${isPadSelected ? "#2EA7FF" : "#7CC8FF"}`,
                    background: isPadSelected ? "#2EA7FF" : "rgba(46,167,255,0.3)",
                    boxShadow: isPadSelected
                      ? "0 0 10px rgba(46,167,255,0.65)"
                      : "none",
                    left: `calc(50% + ${position.dx}px)`,
                    top: `calc(50% + ${position.dy}px)`,
                    transform: "translate(-50%, -50%)",
                    zIndex: 4,
                    cursor: "pointer",
                    padding: 0,
                  }}
                  aria-label={`Set hit pad ${pad}`}
                />
              );
            })}

            {hitAnimationProgress !== null && selectedHitPad
              ? (() => {
                const target = hitPadOffsets[selectedHitPad];
                const dx = target.dx * hitAnimationProgress;
                const dy = target.dy * hitAnimationProgress;
                const size = Math.max(2, hitCircleSize * hitAnimationProgress);

                return (
                  <span
                    key={`hit-anim-${slotIndex}`}
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
  activeEventLabel,
  activeEventEquationText,
  onAddToken,
  onClearEquation,
  onSaveEquation,
  onUseDraftInEvent,
  tutorialPrompt = null,
  onSkipTutorial,
}: {
  draftTokens: EquationToken[];
  activeEventLabel: string | null;
  activeEventEquationText: string | null;
  onAddToken: (label: string) => void;
  onClearEquation: () => void;
  onSaveEquation: () => void;
  onUseDraftInEvent: () => void;
  tutorialPrompt?: string | null;
  onSkipTutorial?: () => void;
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
        gridTemplateRows: "auto minmax(0, 1fr) auto",
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
          gap: 6,
          fontFamily: "Space Grotesk, sans-serif",
        }}
      >
        <div style={{ fontSize: 13, fontWeight: 900, lineHeight: 1.1 }}>
          Make an equation
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
          {activeEventLabel ? `For ${activeEventLabel}` : "Choose an encounter below to start"}
        </div>
        <div
          title={activeEventEquationText ?? undefined}
          style={{
            width: "100%",
            overflow: "hidden",
            color: "#FFFFFF99",
            fontSize: 10,
            fontWeight: 700,
            lineHeight: 1.25,
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {activeEventEquationText ? `Current: ${activeEventEquationText}` : "Your equation will be used by the selected encounter."}
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
          gridTemplateRows: "auto auto auto",
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
          <div style={{ position: "relative" }}>
            {tutorialPrompt ? (
              <div
                style={{
                  position: "absolute",
                  bottom: "calc(100% + 8px)",
                  right: 0,
                  width: 240,
                  zIndex: 1300,
                }}
              >
                <TutorialBubble
                  text={tutorialPrompt}
                  onSkip={onSkipTutorial ?? (() => {})}
                />
              </div>
            ) : null}
            <button
              type="button"
              onClick={onSaveEquation}
              disabled={!hasDraft}
              style={{
                width: "100%",
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
          {studentCopy.editor.saveEquation}
            </button>
          </div>
        </div>
        <button
          type="button"
          onClick={onUseDraftInEvent}
          disabled={!hasDraft || !activeEventLabel}
          style={{
            width: "100%",
            minHeight: 28,
            borderRadius: 8,
            border: `1px solid ${hasDraft && activeEventLabel ? "#2EA7FF" : subtleBorderColor}`,
            background: hasDraft && activeEventLabel ? "rgba(46,167,255,0.16)" : "#252525",
            color: hasDraft && activeEventLabel ? "#BDE4FF" : "#FFFFFF66",
            fontSize: 10,
            fontWeight: 900,
            cursor: hasDraft && activeEventLabel ? "pointer" : "not-allowed",
          }}
        >
          {studentCopy.editor.useEquationForGroup(activeEventLabel ?? "the selected encounter")}
        </button>
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
  selectedHitPad,
  onSelectHitPad,
  equationViewerBlockSize,
  currentSongSeconds,
  mechanicStartSeconds,
  mechanicEndSeconds,
  isSongPlaying,
  onQuickAddHit,
  onCreateEquation,
  onBrowseLibrary,
  showWorkspacePrompt,
  hideHeader = false,
}: {
  choice: CenterChoice;
  draftTokens: EquationToken[];
  activeEventEquation: SavedEquation | null;
  hasSelectedEvent: boolean;
  selectedTokenIndex: number | null;
  onSelectToken: ((tokenIndex: number) => void) | null;
  selectedMechanic: GameplayMechanic | null;
  selectedHitPad: HitBubblePad | null;
  onSelectHitPad: ((pad: HitBubblePad) => void) | null;
  equationViewerBlockSize: number;
  currentSongSeconds: number;
  mechanicStartSeconds: number | null;
  mechanicEndSeconds: number | null;
  isSongPlaying: boolean;
  onQuickAddHit: (() => void) | null;
  onCreateEquation: () => void;
  onBrowseLibrary: () => void;
  showWorkspacePrompt: boolean;
  hideHeader?: boolean;
}) {
  const isCreate = choice === "create";
  const isPremade = choice === "premade";
  const hasDraft = draftTokens.length > 0;
  const visibleEquationTokens = hasDraft ? draftTokens : activeEventEquation?.tokens ?? [];
  const hasVisibleEquation = visibleEquationTokens.length > 0;
  const visibleEquationLabel = hasDraft
    ? "Current equation being built"
    : activeEventEquation
      ? ""
      : hasSelectedEvent
        ? "No equation is assigned to this encounter."
        : "";
  const title = isCreate
    ? "Build your equation"
    : isPremade
    ? "Choose an equation"
      : "Build or choose an equation";
  const subtitle = isCreate
      ? "Use the builder on the left, then add it to an encounter."
    : isPremade
      ? "Choose an equation from the library, then add it to an encounter."
      : "Make an equation or start with one from the lesson library.";
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
          justifyItems: "center",
          alignItems: "center",
          gap: hideHeader ? 0 : 18,
          textAlign: "center",
          overflow: "visible",
        }}
      >
        {!hideHeader && showWorkspacePrompt && !hasVisibleEquation && (
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
                  Make an equation
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
                  Browse the equation library
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
                {isCreate ? "← Use the equation builder" : "Browse the equation library →"}
              </div>
            )}
          </>
        )}

        {visibleEquationTokens.length > 0 || visibleEquationLabel ? (
          <div
            aria-label={visibleEquationLabel || "Selected equation"}
            style={{
              marginTop: hideHeader ? 0 : 8,
              width: "100%",
              height: hideHeader ? "100%" : "auto",
              minHeight: hideHeader ? 0 : 96,
              borderRadius: 0,
              border: "none",
              background: "transparent",
              display: "grid",
              alignContent: "center",
              justifyItems: "center",
              gap: 10,
              padding: hideHeader ? "10px 16px" : 0,
              boxSizing: "border-box",
              overflow: "visible",
            }}
          >
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
                selectedHitPad={selectedHitPad}
                onSelectHitPad={onSelectHitPad ?? undefined}
                fontSizeOverride={{
                  operator: 36,
                  nonOperator: 44,
                }}
                currentSongSeconds={currentSongSeconds}
                mechanicStartSeconds={mechanicStartSeconds}
                mechanicEndSeconds={mechanicEndSeconds}
                isSongPlaying={isSongPlaying}
                onQuickAddHit={onQuickAddHit ?? undefined}
              />
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}

function RtcmBlankNumberToken({
  size = 68,
  borderColor = "#64A0FF73",
  background = "#1B3668",
}: {
  size?: number;
  borderColor?: string;
  background?: string;
}) {
  const baseStyle = getEquationTileStyle({
    label: "0",
    compact: true,
    compactSize: size,
  });

  return (
    <span
      aria-hidden="true"
      style={{
        ...baseStyle,
        width: size,
        minWidth: size,
        height: Math.max(34, Math.round(size * 0.82)),
        borderTop: `1px solid ${borderColor}`,
        background,
        color: "transparent",
        textShadow: "none",
      }}
    >
      0
    </span>
  );
}

function RtcmHitPadToken({
  onAddHit,
  isSongPlaying,
}: {
  onAddHit: (pad: HitBubblePad) => void;
  isSongPlaying: boolean;
}) {
  const emptyTokenSize = Math.round(74 * 0.75);
  const hitPadDiameter = Math.max(34, Math.round(emptyTokenSize * 0.82 * 2));
  const hitPadAnchorSize = 84;
  const pads: HitBubblePad[] = [
    "topLeft",
    "topRight",
    "left",
    "right",
    "bottomLeft",
    "bottomRight",
  ];

  return (
    <div
      style={{
        position: "relative",
        width: 300,
        height: 260,
        display: "grid",
        placeItems: "center",
        overflow: "visible",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "grid",
          placeItems: "center",
          pointerEvents: "none",
        }}
      >
        <RtcmBlankNumberToken size={emptyTokenSize} />
      </div>

      {pads.map((pad) => {
        const padStyle = getHitBubblePadStyle(pad, hitPadAnchorSize);
        const padNumber = getHitPadNumber(pad);

        return (
          <button
            key={pad}
            type="button"
            onClick={isSongPlaying ? () => onAddHit(pad) : undefined}
            aria-label={`Add hit at pad ${padNumber}`}
            disabled={!isSongPlaying}
            style={{
              position: "absolute",
              width: hitPadDiameter,
              height: hitPadDiameter,
              borderRadius: 999,
              border: "1px solid #7CC8FF",
              background: isSongPlaying ? "#2EA7FF" : "rgba(46,167,255,0.4)",
              boxShadow: "0 0 10px rgba(46,167,255,0.3)",
              cursor: isSongPlaying ? "pointer" : "not-allowed",
              padding: 0,
              opacity: isSongPlaying ? 1 : 0.65,
              ...padStyle,
            }}
          >
            <span
              aria-hidden="true"
              style={{
                color: "#FFFFFF",
                fontSize: 24,
                fontWeight: 900,
                lineHeight: 1,
                textShadow: "0 0 8px rgba(0,0,0,0.28)",
              }}
            >
              {padNumber}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function RtcmHoldToken({
  mechanic,
  isSongPlaying,
  isArmed,
  onStartHold,
  onEndHold,
}: {
  mechanic: Exclude<GameplayMechanic, "hit">;
  isSongPlaying: boolean;
  isArmed: boolean;
  onStartHold: (mechanic: Exclude<GameplayMechanic, "hit">) => void;
  onEndHold: () => void;
}) {
  const [dragArcProgress, setDragArcProgress] = useState(0);
  const [dragArcSide, setDragArcSide] = useState<-1 | 1>(-1);
  const [isDraggingToken, setIsDraggingToken] = useState(false);
  const [spinHandleAngle, setSpinHandleAngle] = useState(-90);
  const [isDraggingSpinHandle, setIsDraggingSpinHandle] = useState(false);
  const pointerStateRef = useRef<{
    pointerId: number;
    startedHold: boolean;
  } | null>(null);
  const spinHandleStateRef = useRef<{
    pointerId: number;
    startedHold: boolean;
  } | null>(null);
  const surfaceRef = useRef<HTMLDivElement | null>(null);
  const spinRingDiameter = 230;
  const spinHandleDiameter = Math.max(34, Math.round(68 * 0.75));
  const spinRingRadius = spinRingDiameter / 2;
  const dragArcCenterX = 130;
  const dragArcCenterY = 99;
  const dragArcRadiusX = 125;
  const dragArcRadiusY = 72;

  const tokenBasePosition = {
    left: 130,
    top: 98,
  };

  function clamp(value: number, min: number, max: number) {
    return Math.min(max, Math.max(min, value));
  }

  function dragPositionFromClientPosition(clientX: number, clientY: number) {
    const surface = surfaceRef.current;

    if (!surface) {
      return {
        progress: dragArcProgress,
        side: dragArcSide,
      };
    }

    const rect = surface.getBoundingClientRect();
    const localX = clientX - rect.left;
    const localY = clientY - rect.top;
    const normalizedX = (localX - dragArcCenterX) / dragArcRadiusX;
    const normalizedY = (localY - dragArcCenterY) / dragArcRadiusY;
    const theta = Math.atan2(Math.abs(normalizedY), normalizedX);
    const side: -1 | 1 = normalizedY > 0 ? 1 : -1;

    return {
      progress: clamp(1 - theta / Math.PI, 0, 1),
      side,
    };
  }

  function handleTokenPointerDown(event: PointerEvent<HTMLButtonElement>) {
    if (mechanic === "spin") {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);

    const startedHold = isSongPlaying;

    if (mechanic === "drag") {
      const nextPosition = dragPositionFromClientPosition(
        event.clientX,
        event.clientY,
      );
      setDragArcProgress(nextPosition.progress);
      setDragArcSide(nextPosition.side);
    }

    pointerStateRef.current = {
      pointerId: event.pointerId,
      startedHold,
    };

    setIsDraggingToken(true);

    if (startedHold) {
      onStartHold(mechanic);
    }
  }

  function handleTokenPointerMove(event: PointerEvent<HTMLButtonElement>) {
    if (mechanic === "spin") {
      return;
    }

    const pointerState = pointerStateRef.current;

    if (!pointerState || pointerState.pointerId !== event.pointerId) {
      return;
    }

    event.preventDefault();
    if (mechanic === "drag") {
      const nextPosition = dragPositionFromClientPosition(
        event.clientX,
        event.clientY,
      );
      setDragArcProgress(nextPosition.progress);
      setDragArcSide(nextPosition.side);
    }
  }

  function finishTokenGesture(event: PointerEvent<HTMLButtonElement>) {
    if (mechanic === "spin") {
      return;
    }

    const pointerState = pointerStateRef.current;

    if (!pointerState || pointerState.pointerId !== event.pointerId) {
      return;
    }

    event.preventDefault();
    pointerStateRef.current = null;
    setIsDraggingToken(false);
    if (mechanic === "drag") {
      setDragArcProgress(0);
      setDragArcSide(-1);
    }

    if (pointerState.startedHold) {
      onEndHold();
    }

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  function angleFromClientPosition(clientX: number, clientY: number) {
    const surface = surfaceRef.current;

    if (!surface) {
      return spinHandleAngle;
    }

    const rect = surface.getBoundingClientRect();
    const centerX = rect.left + tokenBasePosition.left;
    const centerY = rect.top + tokenBasePosition.top;

    return (Math.atan2(clientY - centerY, clientX - centerX) * 180) / Math.PI;
  }

  function handleSpinHandlePointerDown(event: PointerEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);

    const startedHold = isSongPlaying;

    spinHandleStateRef.current = {
      pointerId: event.pointerId,
      startedHold,
    };

    setIsDraggingSpinHandle(true);
    setSpinHandleAngle(angleFromClientPosition(event.clientX, event.clientY));

    if (startedHold) {
      onStartHold("spin");
    }
  }

  function handleSpinHandlePointerMove(event: PointerEvent<HTMLButtonElement>) {
    const state = spinHandleStateRef.current;

    if (!state || state.pointerId !== event.pointerId) {
      return;
    }

    event.preventDefault();
    setSpinHandleAngle(angleFromClientPosition(event.clientX, event.clientY));
  }

  function finishSpinHandleGesture(event: PointerEvent<HTMLButtonElement>) {
    const state = spinHandleStateRef.current;

    if (!state || state.pointerId !== event.pointerId) {
      return;
    }

    event.preventDefault();
    spinHandleStateRef.current = null;
    setIsDraggingSpinHandle(false);
    setSpinHandleAngle(-90);

    if (state.startedHold) {
      onEndHold();
    }

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  const spinHandleX =
    tokenBasePosition.left + spinRingRadius * Math.cos((spinHandleAngle * Math.PI) / 180);
  const spinHandleY =
    tokenBasePosition.top + spinRingRadius * Math.sin((spinHandleAngle * Math.PI) / 180);
  const dragTokenAngle = Math.PI * (1 - dragArcProgress);
  const dragTokenX = dragArcCenterX + dragArcRadiusX * Math.cos(dragTokenAngle);
  const dragTokenY =
    dragArcCenterY + dragArcSide * dragArcRadiusY * Math.sin(dragTokenAngle);

  return (
    <div
      ref={surfaceRef}
      style={{
        position: "relative",
        width: 260,
        height: 198,
        display: "grid",
        placeItems: "center",
        overflow: "visible",
      }}
    >
      {mechanic === "spin" ? (
        <span
          aria-hidden="true"
          style={{
            position: "absolute",
            inset: 0,
            display: "grid",
            placeItems: "center",
            pointerEvents: "none",
            zIndex: 1,
          }}
        >
          <SpinIcon
            style={{
              width: 172,
              height: 180,
              opacity: 0.95,
              filter: isArmed ? "drop-shadow(0 0 22px rgba(255,255,255,0.15))" : "none",
            }}
          />
        </span>
      ) : (
        <span
          aria-hidden="true"
          style={{
            position: "absolute",
            inset: 0,
            pointerEvents: "none",
            zIndex: 1,
            opacity: 0.95,
          }}
        >
          <svg
            width="100%"
            height="100%"
            viewBox="0 0 260 198"
            fill="none"
            preserveAspectRatio="none"
            style={{ display: "block", overflow: "visible" }}
          >
            <path
              d="M 5 99 A 125 72 0 0 1 255 99"
              stroke="rgba(180, 92, 255, 0.32)"
              strokeWidth="72"
              strokeLinecap="round"
            />
            <path
              d="M 5 99 A 125 72 0 0 0 255 99"
              stroke="rgba(180, 92, 255, 0.32)"
              strokeWidth="72"
              strokeLinecap="round"
            />
          </svg>
        </span>
      )}

      {mechanic === "spin" ? (
        <span
          aria-hidden="true"
          style={{
            position: "absolute",
            left: tokenBasePosition.left,
            top: tokenBasePosition.top,
            width: spinRingDiameter,
            height: spinRingDiameter,
            borderRadius: 999,
            border: "5px solid rgba(255, 138, 138, 0.7)",
            transform: "translate(-50%, -50%)",
            pointerEvents: "none",
            zIndex: 2,
          }}
        />
      ) : null}

      {mechanic === "spin" ? (
        <button
          type="button"
          onPointerDown={handleSpinHandlePointerDown}
          onPointerMove={handleSpinHandlePointerMove}
          onPointerUp={finishSpinHandleGesture}
          onPointerCancel={finishSpinHandleGesture}
          disabled={!isSongPlaying}
          style={{
            position: "absolute",
            left: spinHandleX,
            top: spinHandleY,
            width: spinHandleDiameter,
            height: spinHandleDiameter,
            borderRadius: 999,
            border: "1px solid #7CC8FF",
            background: isSongPlaying ? "#2EA7FF" : "rgba(46,167,255,0.4)",
            boxShadow: "0 0 10px rgba(46,167,255,0.3)",
            cursor: isSongPlaying ? "grab" : "not-allowed",
            padding: 0,
            transform: "translate(-50%, -50%)",
            zIndex: 4,
            touchAction: "none",
            opacity: isSongPlaying ? 1 : 0.65,
            transition: isDraggingSpinHandle ? "none" : "left 120ms linear, top 120ms linear",
          }}
          aria-label="Hold to add spin timing"
          title={
            isSongPlaying
              ? "Hold and drag around the ring to create spin timing, then release to end."
              : "Play song to capture timing while dragging this circle around the ring."
          }
        />
      ) : null}

      <button
        type="button"
        onPointerDown={handleTokenPointerDown}
        onPointerMove={handleTokenPointerMove}
        onPointerUp={finishTokenGesture}
        onPointerCancel={finishTokenGesture}
        style={{
          position: "absolute",
          left: mechanic === "drag" ? dragTokenX : tokenBasePosition.left,
          top: mechanic === "drag" ? dragTokenY : tokenBasePosition.top,
          transform: "translate(-50%, -50%)",
          transition:
            mechanic === "drag"
              ? isDraggingToken
                ? "none"
                : "left 180ms ease-out, top 180ms ease-out"
              : isDraggingToken
                ? "none"
                : "transform 180ms ease-out",
          border: "none",
          background: "transparent",
          cursor: mechanic === "spin" ? "default" : isDraggingToken ? "grabbing" : "grab",
          padding: 0,
          zIndex: 3,
          touchAction: "none",
          filter: isArmed
            ? mechanic === "spin"
              ? "drop-shadow(0 0 20px rgba(255,53,53,0.36))"
              : "drop-shadow(0 0 20px rgba(180,92,255,0.42))"
            : "none",
          pointerEvents: mechanic === "spin" ? "none" : "auto",
        }}
        aria-label={`Hold to add ${mechanic} timing`}
        title={
          isSongPlaying
            ? `Hold to create ${mechanic} timing, then release to end.`
            : "Play song to capture timing while dragging this token."
        }
      >
        <RtcmBlankNumberToken
          size={mechanic === "drag" ? 144 : 72}
          borderColor={mechanic === "spin" ? "#FF8A8A99" : "#D2A9FF99"}
          background={mechanic === "spin" ? "#4A1D22" : "#2D1A47"}
        />
      </button>
    </div>
  );
}

function RtcmModePanel({
  onAddHit,
  onStartHold,
  onEndHold,
  onCreateEvent,
  onDeleteEvent,
  onClear,
  isSongPlaying,
  pendingRangeMechanic,
  eventRangeStartTick,
  canDeleteEvent,
  draftedActionCount,
}: {
  onAddHit: (pad: HitBubblePad) => void;
  onStartHold: (tool: Exclude<GameplayMechanic, "hit">) => void;
  onEndHold: () => void;
  onCreateEvent: () => void;
  onDeleteEvent: () => void;
  onClear: () => void;
  isSongPlaying: boolean;
  pendingRangeMechanic: "spin" | "drag" | null;
  eventRangeStartTick: number | null;
  canDeleteEvent: boolean;
  draftedActionCount: number;
}) {
  const [selectedTool, setSelectedTool] = useState<GameplayMechanic>("hit");
  const isEncounterOpen = eventRangeStartTick !== null;
  const canRecord = isSongPlaying && isEncounterOpen;

  return (
    <section
      aria-label="Real-time chart maker"
      style={{
        width: "100%",
        height: "100%",
        minHeight: 0,
        minWidth: 0,
        background: row2Column2BackgroundColor,
        color: textColor,
        boxSizing: "border-box",
        overflow: "visible",
        display: "grid",
        gridTemplateRows: "auto auto 1fr",
        justifyItems: "center",
        alignItems: "start",
        padding: "16px 0 0",
        fontFamily: "Space Grotesk, sans-serif",
      }}
    >
      <div
        style={{
          width: "90vw",
          display: "flex",
          justifyContent: "center",
          paddingBottom: 12,
          boxSizing: "border-box",
          overflow: "visible",
        }}
      >
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
          <button
            type="button"
            onClick={onCreateEvent}
            style={{
              minWidth: 132,
              minHeight: 38,
              borderRadius: 10,
              border: `1px solid ${eventRangeStartTick !== null ? "#CFFF04" : subtleBorderColor}`,
              background: eventRangeStartTick !== null ? "rgba(207,255,4,0.14)" : "#252525",
              color: eventRangeStartTick !== null ? "#CFFF04" : "#FFFFFFDD",
              fontSize: 11,
              fontWeight: 900,
              cursor: "pointer",
              padding: "0 12px",
            }}
          >
            {eventRangeStartTick === null ? "Start encounter" : "Save encounter"}
          </button>
          <button
            type="button"
            onClick={onDeleteEvent}
            disabled={!canDeleteEvent}
            style={{
              minWidth: 120,
              minHeight: 38,
              borderRadius: 10,
              border: `1px solid ${subtleBorderColor}`,
              background: canDeleteEvent ? "#252525" : "#1D1D1D",
              color: canDeleteEvent ? "#FFFFFFDD" : "#FFFFFF55",
              fontSize: 11,
              fontWeight: 900,
              cursor: canDeleteEvent ? "pointer" : "not-allowed",
              padding: "0 12px",
            }}
          >
            Delete Event
          </button>
          <button
            type="button"
            onClick={onClear}
            style={{
              minWidth: 100,
              minHeight: 38,
              borderRadius: 10,
              border: "1px solid #FF6B6B",
              background: "#2B1414",
              color: "#FF9C9C",
              fontSize: 11,
              fontWeight: 900,
              cursor: "pointer",
              padding: "0 12px",
            }}
          >
            Clear draft
          </button>
        </div>
      </div>

      <div style={{ width: "min(720px, 90vw)", display: "grid", gap: 10, paddingBottom: 12 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }} aria-label="Choose recorder tool">
          {gameplayMechanics.map((mechanic) => (
            <button
              key={mechanic}
              type="button"
              onClick={() => setSelectedTool(mechanic)}
              aria-pressed={selectedTool === mechanic}
              style={{
                minHeight: 36,
                borderRadius: 999,
                border: `1px solid ${selectedTool === mechanic ? "#CFFF04" : subtleBorderColor}`,
                background: selectedTool === mechanic ? "rgba(207,255,4,0.14)" : "#151E2B",
                color: selectedTool === mechanic ? "#CFFF04" : "#FFFFFFB3",
                fontWeight: 900,
                cursor: "pointer",
                textTransform: "capitalize",
              }}
            >
              {mechanic}
            </button>
          ))}
        </div>
        <div role="status" style={{ color: isEncounterOpen ? "#DFFF70" : "#AFC2D8", fontSize: 12, fontWeight: 700, textAlign: "center" }}>
          {isEncounterOpen
            ? `${draftedActionCount} action${draftedActionCount === 1 ? "" : "s"} recorded in this encounter draft. Play the song, record one action at a time, then save the encounter.`
            : "Start an encounter first. Then play the song and record one action at a time."}
        </div>
      </div>

      <div
        style={{
          width: "min(720px, 90vw)",
          height: "75%",
          minHeight: 0,
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr)",
          gap: 14,
        }}
      >
        <div
          style={{
            display: selectedTool === "hit" ? "grid" : "none",
            height: "100%",
            borderRadius: 14,
            border: `1px solid ${subtleBorderColor}`,
            background: "#141414",
            padding: "12px 8px 14px",
            boxSizing: "border-box",
            gridTemplateRows: "auto 1fr auto",
            justifyItems: "center",
            gap: 10,
            alignItems: "center",
          }}
        >
          <div style={{ color: "#2EA7FF", fontSize: 12, fontWeight: 900, textTransform: "uppercase" }}>
            Hit
          </div>
          <RtcmHitPadToken onAddHit={onAddHit} isSongPlaying={canRecord} />
          <div style={{ color: "#FFFFFF99", fontSize: 11, fontWeight: 700, textAlign: "center" }}>
            While the song plays, click the pad the learner should hit.
          </div>
        </div>

        <div
          style={{
            display: selectedTool === "spin" ? "grid" : "none",
            height: "100%",
            borderRadius: 14,
            border: `1px solid ${pendingRangeMechanic === "spin" ? "#FF3535AA" : subtleBorderColor}`,
            background: "#141414",
            padding: "12px 8px 14px",
            boxSizing: "border-box",
            gridTemplateRows: "auto 1fr auto",
            justifyItems: "center",
            gap: 10,
            alignItems: "center",
          }}
        >
          <div style={{ color: "#FF3535", fontSize: 12, fontWeight: 900, textTransform: "uppercase" }}>
            Spin
          </div>
          <RtcmHoldToken
            mechanic="spin"
            isSongPlaying={canRecord}
            isArmed={pendingRangeMechanic === "spin"}
            onStartHold={onStartHold}
            onEndHold={onEndHold}
          />
          <div style={{ color: "#FFFFFF99", fontSize: 11, fontWeight: 700, textAlign: "center" }}>
            Hold for the full spin duration. Release to record it in this encounter draft.
          </div>
        </div>

        <div
          style={{
            display: selectedTool === "drag" ? "grid" : "none",
            height: "100%",
            borderRadius: 14,
            border: `1px solid ${pendingRangeMechanic === "drag" ? "#B45CFFAA" : subtleBorderColor}`,
            background: "#141414",
            padding: "12px 8px 14px",
            boxSizing: "border-box",
            gridTemplateRows: "auto 1fr auto",
            justifyItems: "center",
            gap: 10,
            alignItems: "center",
          }}
        >
          <div style={{ color: "#B45CFF", fontSize: 12, fontWeight: 900, textTransform: "uppercase" }}>
            Drag
          </div>
          <RtcmHoldToken
            mechanic="drag"
            isSongPlaying={canRecord}
            isArmed={pendingRangeMechanic === "drag"}
            onStartHold={onStartHold}
            onEndHold={onEndHold}
          />
          <div style={{ color: "#FFFFFF99", fontSize: 11, fontWeight: 700, textAlign: "center" }}>
            Hold for the full drag duration. Release to record it in this encounter draft.
          </div>
        </div>
      </div>
    </section>
  );
}

function Rctm2ModePanel({
  onAddHitMarker,
  onBeginDragMarker,
  onCompleteDragMarker,
  onCancelDragMarker,
  onCreateEvent,
  onDeleteEvent,
  onClear,
  eventRangeStartTick,
  canDeleteEvent,
  currentSongSeconds,
  isSongPlaying,
  events,
  rtcmDraftMechanics,
  hitPlacements,
  dragStartPoints,
  dragSourceHitIds,
}: {
  onAddHitMarker: (point: Rctm2Point) => void;
  onBeginDragMarker: (startPoint: Rctm2Point, sourceHitId: string) => string;
  onCompleteDragMarker: (draftId: string, zone: Rctm2BondZone) => void;
  onCancelDragMarker: (draftId: string) => void;
  onCreateEvent: (numberValue: number) => void;
  onDeleteEvent: () => void;
  onClear: () => void;
  eventRangeStartTick: number | null;
  canDeleteEvent: boolean;
  currentSongSeconds: number;
  isSongPlaying: boolean;
  events: TimelineEventSlot[];
  rtcmDraftMechanics: RtcmDraftMechanic[];
  hitPlacements: Record<string, Rctm2Point>;
  dragStartPoints: Record<string, Rctm2Point>;
  dragSourceHitIds: Record<string, string>;
}) {
  const [numberValue, setNumberValue] = useState("1");
  const [hoverPoint, setHoverPoint] = useState<{ x: number; y: number } | null>(null);
  const [draggingHitId, setDraggingHitId] = useState<string | null>(null);
  const [isDragTimingArmed, setIsDragTimingArmed] = useState(false);
  const draggingDraftIdRef = useRef<string | null>(null);
  const didDropRef = useRef(false);
  const dragOverlayRef = useRef<HTMLDivElement | null>(null);
  const displayWindowRef = useRef<HTMLDivElement | null>(null);
  const dragPathSurfaceRef = useRef<HTMLDivElement | null>(null);
  const [dragPathSurfaceSize, setDragPathSurfaceSize] = useState({ width: 0, height: 0 });
  const [dragOverlaySize, setDragOverlaySize] = useState({ width: 0, height: 0 });
  const leftBondRef = useRef<HTMLDivElement | null>(null);
  const rightBondRef = useRef<HTMLDivElement | null>(null);
  const [displayWindowSize, setDisplayWindowSize] = useState({ width: 0, height: 0 });

  const circleRadius = 16;
  const circleDiameter = circleRadius * 2;
  const circleGap = 10;
  const parsedNumber = Number.parseInt(numberValue, 10);
  const safeNumber = Number.isFinite(parsedNumber)
    ? Math.max(1, Math.min(20, parsedNumber))
    : 1;
  const bondSize = Math.ceil(safeNumber / 2) + 1;
  const bondColumns = Math.max(1, Math.min(5, bondSize));
  const bondRows = Math.max(1, Math.ceil(bondSize / bondColumns));
  const bondBoxWidth = bondColumns * circleDiameter + (bondColumns - 1) * circleGap + 24;
  const bondBoxHeight = bondRows * circleDiameter + (bondRows - 1) * circleGap + 24;

  const isDraggingGesture = draggingHitId !== null || isDragTimingArmed;

  useEffect(() => {
    const element = dragPathSurfaceRef.current;

    if (!element) {
      return;
    }

    const updateSurfaceSize = () => {
      setDragPathSurfaceSize({
        width: element.clientWidth,
        height: element.clientHeight,
      });
    };

    updateSurfaceSize();
    const resizeObserver = new ResizeObserver(() => updateSurfaceSize());
    resizeObserver.observe(element);

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  useEffect(() => {
    const element = dragOverlayRef.current;

    if (!element) {
      return;
    }

    const updateOverlaySize = () => {
      setDragOverlaySize({
        width: element.clientWidth,
        height: element.clientHeight,
      });
    };

    updateOverlaySize();
    const resizeObserver = new ResizeObserver(() => updateOverlaySize());
    resizeObserver.observe(element);

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  useEffect(() => {
    const element = displayWindowRef.current;

    if (!element) {
      return;
    }

    const updateDisplaySize = () => {
      setDisplayWindowSize({
        width: element.clientWidth,
        height: element.clientHeight,
      });
    };

    updateDisplaySize();
    const resizeObserver = new ResizeObserver(() => updateDisplaySize());
    resizeObserver.observe(element);

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  function toNormalizedPoint(point: { x: number; y: number }) {
    const safeWidth = Math.max(1, displayWindowSize.width);
    const safeHeight = Math.max(1, displayWindowSize.height);

    return {
      x: Math.max(0, Math.min(1, point.x / safeWidth)),
      y: Math.max(0, Math.min(1, point.y / safeHeight)),
    } satisfies Rctm2Point;
  }

  function fromNormalizedPoint(point: Rctm2Point) {
    if (point.x > 1 || point.y > 1) {
      return {
        x: point.x,
        y: point.y,
      };
    }

    return {
      x: point.x * Math.max(1, displayWindowSize.width),
      y: point.y * Math.max(1, displayWindowSize.height),
    };
  }

  function projectDisplayPointToOverlay(point: Rctm2Point) {
    const overlay = dragOverlayRef.current;
    const display = displayWindowRef.current;

    if (!overlay || !display) {
      return null;
    }

    const overlayRect = overlay.getBoundingClientRect();
    const displayRect = display.getBoundingClientRect();
    const localPoint = fromNormalizedPoint(point);

    return {
      x: displayRect.left - overlayRect.left + localPoint.x,
      y: displayRect.top - overlayRect.top + localPoint.y,
    };
  }

  function getBondCenterInOverlay(zone: Rctm2BondZone) {
    const overlay = dragOverlayRef.current;
    const target = zone === "leftBond" ? leftBondRef.current : rightBondRef.current;

    if (!overlay || !target) {
      return null;
    }

    const overlayRect = overlay.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();

    return {
      x: targetRect.left - overlayRect.left + targetRect.width / 2,
      y: targetRect.top - overlayRect.top + targetRect.height / 2,
    };
  }

  const hitDisplayStates = useMemo(() => {
    type HitSnapshot = {
      id: string;
      hitTime: number;
      point: Rctm2Point;
      dragStartTime: number | null;
    };

    const hits = new Map<string, HitSnapshot>();
    const dragStartByHit = new Map<string, number>();

    events.forEach((eventSlot) => {
      const hitInstances = eventSlot.mechanicInstances?.hit ?? [];
      hitInstances.forEach((instance) => {
        const point = hitPlacements[instance.id];

        if (!point) {
          return;
        }

        hits.set(instance.id, {
          id: instance.id,
          hitTime: timelineTickToSeconds(instance.tick ?? eventSlot.tick),
          point,
          dragStartTime: null,
        });
      });

      const dragInstances = eventSlot.mechanicInstances?.drag ?? [];
      dragInstances.forEach((instance) => {
        const sourceHitId = instance.dragTargets?.[0]?.sourceHitId;

        if (!sourceHitId) {
          return;
        }

        const dragStart = timelineTickToSeconds(instance.tick ?? eventSlot.tick);
        const currentStart = dragStartByHit.get(sourceHitId);

        if (typeof currentStart !== "number" || dragStart < currentStart) {
          dragStartByHit.set(sourceHitId, dragStart);
        }
      });
    });

    rtcmDraftMechanics.forEach((draft) => {
      if (draft.mechanic === "hit") {
        const point = hitPlacements[draft.id];

        if (!point) {
          return;
        }

        hits.set(draft.id, {
          id: draft.id,
          hitTime: timelineTickToSeconds(draft.tick),
          point,
          dragStartTime: null,
        });

        return;
      }

      if (draft.mechanic === "drag") {
        const hasCompletedTarget = Array.isArray(draft.dragTargets) && draft.dragTargets.length > 0;
        const sourceHitId = hasCompletedTarget
          ? dragSourceHitIds[draft.id] ?? draft.dragTargets?.[0]?.sourceHitId
          : undefined;

        if (!sourceHitId) {
          return;
        }

        const dragStart = timelineTickToSeconds(draft.tick);
        const currentStart = dragStartByHit.get(sourceHitId);

        if (typeof currentStart !== "number" || dragStart < currentStart) {
          dragStartByHit.set(sourceHitId, dragStart);
        }
      }
    });

    const visibleStates = Array.from(hits.values())
      .map((hit) => {
        const dragStartTime = dragStartByHit.get(hit.id) ?? null;

        return {
          ...hit,
          dragStartTime,
          state:
            currentSongSeconds < hit.hitTime
              ? "hidden"
              : dragStartTime !== null && currentSongSeconds >= dragStartTime
                ? "hollow"
                : "solid",
        };
      })
      .filter((hit) => hit.state !== "hidden");

    return {
      solid: visibleStates.filter((hit) => hit.state === "solid"),
      hollow: visibleStates.filter((hit) => hit.state === "hollow"),
    };
  }, [currentSongSeconds, dragSourceHitIds, events, hitPlacements, rtcmDraftMechanics]);

  const bondCircleCounts = useMemo(() => {
    const counts = {
      leftBond: 0,
      rightBond: 0,
    };

    events.forEach((eventSlot) => {
      const dragInstances = eventSlot.mechanicInstances?.drag ?? [];

      dragInstances.forEach((instance) => {
        if (!instance.dragTargets?.length) {
          return;
        }

        const dragStart = timelineTickToSeconds(instance.tick ?? eventSlot.tick);
        const dragEnd = timelineTickToSeconds(instance.endTick ?? instance.tick ?? eventSlot.tick);

        if (currentSongSeconds < dragEnd || dragEnd < dragStart) {
          return;
        }

        const tokenIndex = instance.dragTargets?.[0]?.tokenIndex ?? 1;
        counts[tokenIndex === 0 ? "leftBond" : "rightBond"] += 1;
      });
    });

    rtcmDraftMechanics
      .filter((draft) => draft.mechanic === "drag")
      .forEach((draft) => {
        if (!draft.dragTargets?.length) {
          return;
        }

        const dragStart = timelineTickToSeconds(draft.tick);
        const dragEnd = timelineTickToSeconds(draft.endTick ?? draft.tick);

        if (currentSongSeconds < dragEnd || dragEnd < dragStart) {
          return;
        }

        const tokenIndex = draft.dragTargets[0]?.tokenIndex ?? 1;
        counts[tokenIndex === 0 ? "leftBond" : "rightBond"] += 1;
      });

    return counts;
  }, [currentSongSeconds, events, rtcmDraftMechanics]);

  const activeDragAnimations = useMemo(() => {
    const empty: Array<{
      id: string;
      progress: number;
      zone: Rctm2BondZone;
      startPoint: Rctm2Point;
    }> = [];

    if (events.length === 0 && rtcmDraftMechanics.length === 0) {
      return empty;
    }

    const items: Array<{ id: string; progress: number; zone: Rctm2BondZone; startPoint: Rctm2Point }> = [];

    events.forEach((eventSlot) => {
      const instances = eventSlot.mechanicInstances?.drag ?? [];

      instances.forEach((instance, instanceIndex) => {
        if (!instance.dragTargets?.length) {
          return;
        }

        const window = getMechanicInstanceTimeWindowSeconds(
          eventSlot,
          "drag",
          instance,
        );

        if (window.endSeconds <= window.startSeconds) {
          return;
        }

        if (
          currentSongSeconds < window.startSeconds ||
          currentSongSeconds > window.endSeconds
        ) {
          return;
        }

        const progress =
          (currentSongSeconds - window.startSeconds) /
          (window.endSeconds - window.startSeconds);
        const tokenIndex = instance.dragTargets[0]?.tokenIndex ?? 1;
        const startPoint = dragStartPoints[instance.id];

        if (!startPoint) {
          return;
        }

        items.push({
          id: `${eventSlot.id}-drag-${instanceIndex}`,
          progress: Math.max(0, Math.min(1, progress)),
          zone: tokenIndex === 0 ? "leftBond" : "rightBond",
          startPoint,
        });
      });
    });

    rtcmDraftMechanics
      .filter((draft) => draft.mechanic === "drag" && typeof draft.endTick === "number")
      .forEach((draft) => {
        if (!draft.dragTargets?.length) {
          return;
        }

        const startSeconds = timelineTickToSeconds(draft.tick);
        const endSeconds = timelineTickToSeconds(draft.endTick ?? draft.tick);

        if (endSeconds <= startSeconds) {
          return;
        }

        if (currentSongSeconds < startSeconds || currentSongSeconds > endSeconds) {
          return;
        }

        const progress = (currentSongSeconds - startSeconds) / (endSeconds - startSeconds);
        const tokenIndex = draft.dragTargets[0]?.tokenIndex ?? 1;
        const startPoint = dragStartPoints[draft.id];

        if (!startPoint) {
          return;
        }

        items.push({
          id: draft.id,
          progress: Math.max(0, Math.min(1, progress)),
          zone: tokenIndex === 0 ? "leftBond" : "rightBond",
          startPoint,
        });
      });

    return items;
  }, [currentSongSeconds, dragStartPoints, events, rtcmDraftMechanics]);

  function pointOnQuadraticPath(
    start: { x: number; y: number },
    control: { x: number; y: number },
    end: { x: number; y: number },
    progress: number,
  ) {
    const t = Math.max(0, Math.min(1, progress));
    const oneMinus = 1 - t;

    return {
      x: oneMinus * oneMinus * start.x + 2 * oneMinus * t * control.x + t * t * end.x,
      y: oneMinus * oneMinus * start.y + 2 * oneMinus * t * control.y + t * t * end.y,
    };
  }

  function beginDragTiming(startPoint: Rctm2Point, sourceHitId: string) {
    if (draggingDraftIdRef.current) {
      return;
    }

    draggingDraftIdRef.current = onBeginDragMarker(startPoint, sourceHitId);
    setIsDragTimingArmed(true);
  }

  function getLocalPoint(event: React.MouseEvent<HTMLDivElement, MouseEvent>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    return {
      x: Math.max(circleRadius, Math.min(rect.width - circleRadius, x)),
      y: Math.max(circleRadius, Math.min(rect.height - circleRadius, y)),
    };
  }

  function handleDisplayClick(event: React.MouseEvent<HTMLDivElement, MouseEvent>) {
    const target = event.target as HTMLElement;

    if (target.closest("[data-rctm2-circle='true']")) {
      return;
    }

    const nextPoint = getLocalPoint(event);

    onAddHitMarker(toNormalizedPoint(nextPoint));
  }

  function handleDropIntoBond(
    zone: Rctm2BondZone,
    event: React.DragEvent<HTMLDivElement>,
  ) {
    if (!draggingHitId) {
      return;
    }

    const rect = event.currentTarget.getBoundingClientRect();
    const centerInsideInterior =
      event.clientX >= rect.left + circleRadius &&
      event.clientX <= rect.right - circleRadius &&
      event.clientY >= rect.top + circleRadius &&
      event.clientY <= rect.bottom - circleRadius;

    if (!centerInsideInterior) {
      didDropRef.current = false;
      return;
    }

    if (draggingDraftIdRef.current) {
      onCompleteDragMarker(draggingDraftIdRef.current, zone);
    }

    didDropRef.current = true;
    setDraggingHitId(null);
    draggingDraftIdRef.current = null;
    setIsDragTimingArmed(false);
  }

  function renderBondBox(
    title: "left bond" | "right bond",
    zone: Rctm2BondZone,
    circleCount: number,
    bondRef: React.MutableRefObject<HTMLDivElement | null>,
  ) {
    return (
      <div
        ref={bondRef}
        onDragOver={(event) => {
          event.preventDefault();
          event.dataTransfer.dropEffect = "move";
        }}
        onDrop={(event) => {
          event.preventDefault();
          handleDropIntoBond(zone, event);
        }}
        style={{
          width: bondBoxWidth,
          minWidth: bondBoxWidth,
          height: bondBoxHeight,
          borderRadius: 12,
          border: `1px solid ${isDraggingGesture ? "#B45CFFAA" : subtleBorderColor
            }`,
          background: "#141414",
          display: "flex",
          flexWrap: "wrap",
          alignContent: "flex-start",
          gap: circleGap,
          padding: 12,
          boxSizing: "border-box",
          overflow: "hidden",
          boxShadow: isDraggingGesture
            ? "0 0 16px rgba(180,92,255,0.35)"
            : "none",
        }}
      >
        {Array.from({ length: bondSize }).map((_, slotIndex) => {
          const hasCircle = slotIndex < circleCount;

          return (
            <span
              key={`${title}-slot-${slotIndex}`}
              style={{
                width: circleDiameter,
                height: circleDiameter,
                borderRadius: 999,
                border: "1px dashed rgba(255,255,255,0.26)",
                background: hasCircle ? "#2EA7FF" : "transparent",
                boxShadow: hasCircle ? "0 0 10px rgba(46,167,255,0.42)" : "none",
              }}
            />
          );
        })}
      </div>
    );
  }

  return (
    <section
      aria-label="RCTM2"
      style={{
        width: "100%",
        height: "100%",
        minHeight: 0,
        minWidth: 0,
        background: row2Column2BackgroundColor,
        color: textColor,
        boxSizing: "border-box",
        overflow: "hidden",
        display: "grid",
        gridTemplateRows: "auto minmax(0, 1fr)",
        gap: 12,
        padding: "14px 16px 16px",
        fontFamily: "Space Grotesk, sans-serif",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 16,
          color: "#FFFFFF",
          fontSize: 12,
          fontWeight: 800,
        }}
      >
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
          <button
            type="button"
            onClick={() => onCreateEvent(safeNumber)}
            style={{
              minWidth: 132,
              minHeight: 38,
              borderRadius: 10,
              border: `1px solid ${eventRangeStartTick !== null ? "#CFFF04" : subtleBorderColor}`,
              background: eventRangeStartTick !== null ? "rgba(207,255,4,0.14)" : "#252525",
              color: eventRangeStartTick !== null ? "#CFFF04" : "#FFFFFFDD",
              fontSize: 11,
              fontWeight: 900,
              cursor: "pointer",
              padding: "0 12px",
            }}
          >
            {eventRangeStartTick === null ? "Create Event" : "Finalize Event"}
          </button>
          <button
            type="button"
            onClick={onDeleteEvent}
            disabled={!canDeleteEvent}
            style={{
              minWidth: 120,
              minHeight: 38,
              borderRadius: 10,
              border: `1px solid ${subtleBorderColor}`,
              background: canDeleteEvent ? "#252525" : "#1D1D1D",
              color: canDeleteEvent ? "#FFFFFFDD" : "#FFFFFF55",
              fontSize: 11,
              fontWeight: 900,
              cursor: canDeleteEvent ? "pointer" : "not-allowed",
              padding: "0 12px",
            }}
          >
            Delete Event
          </button>
          <button
            type="button"
            onClick={onClear}
            style={{
              minWidth: 100,
              minHeight: 38,
              borderRadius: 10,
              border: "1px solid #FF6B6B",
              background: "#2B1414",
              color: "#FF9C9C",
              fontSize: 11,
              fontWeight: 900,
              cursor: "pointer",
              padding: "0 12px",
            }}
          >
            Clear
          </button>
        </div>
      </div>

      <div
        ref={dragOverlayRef}
        style={{
          minHeight: 0,
          borderRadius: 14,
          border: `1px solid ${subtleBorderColor}`,
          background: "#101621",
          padding: 14,
          display: "grid",
          gridTemplateRows: "auto minmax(0, 1fr)",
          gap: 14,
          position: "relative",
        }}
      >
        {dragOverlaySize.width > 0 && dragOverlaySize.height > 0 ? (
          <svg
            aria-hidden="true"
            width={dragOverlaySize.width}
            height={dragOverlaySize.height}
            viewBox={`0 0 ${dragOverlaySize.width} ${dragOverlaySize.height}`}
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              overflow: "visible",
              pointerEvents: "none",
              zIndex: 4,
            }}
          >
            {/* DOM positions are intentionally read by this render-only overlay after layout measurement. */}
            {/* eslint-disable-next-line react-hooks/refs */}
            {activeDragAnimations.map((animation) => {
              const start = projectDisplayPointToOverlay(animation.startPoint);
              const end = getBondCenterInOverlay(animation.zone);

              if (!start || !end) {
                return null;
              }

              const control = {
                x: (start.x + end.x) / 2,
                y: Math.max(16, Math.min(start.y, end.y) - Math.max(48, Math.abs(end.x - start.x) * 0.28)),
              };
              const point = pointOnQuadraticPath(
                start,
                control,
                end,
                animation.progress,
              );

              return (
                <circle
                  key={animation.id}
                  cx={point.x}
                  cy={point.y}
                  r={circleRadius}
                  fill="#2EA7FF"
                  stroke="#BDE4FF"
                  strokeWidth="1.5"
                />
              );
            })}
          </svg>
        ) : null}

        <div
          ref={dragPathSurfaceRef}
          style={{
            minHeight: 0,
            display: "grid",
            gridTemplateColumns: "minmax(0, 1fr) auto minmax(0, 1fr)",
            alignItems: "center",
            gap: 12,
            position: "relative",
            zIndex: 1,
          }}
        >
          <div style={{ display: "grid", justifyItems: "center", gap: 8, position: "relative", zIndex: 1 }}>
            <div style={{ color: "#FFFFFF99", fontSize: 11, fontWeight: 900, textTransform: "uppercase" }}>
              left bond
            </div>
            {renderBondBox("left bond", "leftBond", bondCircleCounts.leftBond, leftBondRef)}
          </div>

          <div
            style={{
              minWidth: 240,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
              position: "relative",
              zIndex: 1,
            }}
          >
            <span
              aria-hidden="true"
              style={{
                width: 66,
                height: 2,
                background: "rgba(255,255,255,0.4)",
              }}
            />
            <label
              style={{
                width: 110,
                height: 52,
                borderRadius: 12,
                border: `1px solid ${isDraggingGesture ? "rgba(46,167,255,0.65)" : subtleBorderColor}`,
                background: "#192232",
                display: "grid",
                placeItems: "center",
                color: "#FFFFFF",
                fontSize: 11,
                fontWeight: 900,
                textTransform: "uppercase",
                gap: 3,
                paddingTop: 4,
                boxShadow: isDraggingGesture ? "0 0 16px rgba(46,167,255,0.35)" : "none",
              }}
            >
              <span>number box</span>
              <input
                type="number"
                min={1}
                max={20}
                value={numberValue}
                onChange={(event) => {
                  const rawValue = event.target.value;

                  if (rawValue === "") {
                    setNumberValue("");
                    return;
                  }

                  const parsed = Number.parseInt(rawValue, 10);

                  if (!Number.isFinite(parsed)) {
                    return;
                  }

                  setNumberValue(String(Math.max(1, Math.min(20, parsed))));
                }}
                onBlur={() => {
                  if (numberValue.trim() === "") {
                    setNumberValue("1");
                  }
                }}
                style={{
                  width: 56,
                  borderRadius: 8,
                  border: `1px solid ${subtleBorderColor}`,
                  background: "#0D1320",
                  color: "#FFFFFF",
                  textAlign: "center",
                  fontSize: 14,
                  fontWeight: 900,
                }}
              />
            </label>
            <span
              aria-hidden="true"
              style={{
                width: 66,
                height: 2,
                background: "rgba(255,255,255,0.4)",
              }}
            />
          </div>

          <div style={{ display: "grid", justifyItems: "center", gap: 8, position: "relative", zIndex: 1 }}>
            <div style={{ color: "#FFFFFF99", fontSize: 11, fontWeight: 900, textTransform: "uppercase" }}>
              right bond
            </div>
            {renderBondBox("right bond", "rightBond", bondCircleCounts.rightBond, rightBondRef)}
          </div>
        </div>

        <div
          ref={displayWindowRef}
          onMouseMove={(event) => {
            setHoverPoint(getLocalPoint(event));
          }}
          onMouseLeave={() => setHoverPoint(null)}
          onClick={handleDisplayClick}
          style={{
            minHeight: 0,
            borderRadius: 14,
            border: `1px solid ${isDraggingGesture ? "rgba(46,167,255,0.65)" : subtleBorderColor}`,
            background: "#0A0F18",
            position: "relative",
            overflow: "hidden",
            cursor: "crosshair",
            boxShadow: isDraggingGesture ? "inset 0 0 0 1px rgba(46,167,255,0.35)" : "none",
            zIndex: 1,
          }}
        >
          {hitDisplayStates.solid.map((circle) => {
            const localPoint = fromNormalizedPoint(circle.point);

            return (
              <button
                key={circle.id}
                type="button"
                data-rctm2-circle="true"
                draggable
                onDragStart={(event) => {
                  setDraggingHitId(circle.id);
                  didDropRef.current = false;
                  event.dataTransfer.setData("text/plain", circle.id);
                  event.dataTransfer.effectAllowed = "move";
                  beginDragTiming(circle.point, circle.id);
                }}
                onDragEnd={() => {
                  setDraggingHitId(null);
                  if (!didDropRef.current && draggingDraftIdRef.current) {
                    onCancelDragMarker(draggingDraftIdRef.current);
                  }
                  draggingDraftIdRef.current = null;
                  didDropRef.current = false;
                  setIsDragTimingArmed(false);
                }}
                style={{
                  position: "absolute",
                  left: localPoint.x,
                  top: localPoint.y,
                  width: circleDiameter,
                  height: circleDiameter,
                  borderRadius: 999,
                  border: "1px solid rgba(46,167,255,0.85)",
                  background: "#2EA7FF",
                  boxShadow: "0 0 10px rgba(46,167,255,0.55)",
                  transform: "translate(-50%, -50%)",
                  cursor: "grab",
                  padding: 0,
                }}
                aria-label="Drag circle to bond box"
                title="Drag to left bond or right bond"
              />
            );
          })}

          {hoverPoint ? (
            <span
              aria-hidden="true"
              style={{
                position: "absolute",
                left: hoverPoint.x,
                top: hoverPoint.y,
                width: circleDiameter,
                height: circleDiameter,
                borderRadius: 999,
                border: "1px solid rgba(255,255,255,0.48)",
                background: "rgba(255,255,255,0.12)",
                transform: "translate(-50%, -50%)",
                pointerEvents: "none",
              }}
            />
          ) : null}

          {hitDisplayStates.hollow.map((marker) => {
            const localPoint = fromNormalizedPoint(marker.point);

            return (
              <span
                key={`rctm2-hit-marker-${marker.id}`}
                aria-hidden="true"
                style={{
                  position: "absolute",
                  left: localPoint.x,
                  top: localPoint.y,
                  width: Math.max(8, circleRadius * 0.9),
                  height: Math.max(8, circleRadius * 0.9),
                  borderRadius: 999,
                  border: "2px solid rgba(46,167,255,0.7)",
                  background: "rgba(46,167,255,0.2)",
                  transform: "translate(-50%, -50%)",
                  pointerEvents: "none",
                }}
              />
            );
          })}
        </div>
      </div>
    </section>
  );
}

function LibraryPanel({
  activeTab,
  savedEquations,
  templateEquations,
  hiddenSourceEquationIds,
  activeEventId,
  selectedEquationId,
  onTabChange,
  onSelectEquation,
  onAddSelectedEquationToEvent,
  onHideSourceEquation,
  onRestoreSourceEquation,
  onDeleteMineEquation,
  shouldScrollLibrary,
  tutorialPrompt = null,
  onSkipTutorial,
}: {
  activeTab: LibraryTab;
  savedEquations: SavedEquation[];
  templateEquations: SavedEquation[];
  hiddenSourceEquationIds: string[];
  activeEventId: string | null;
  selectedEquationId: string | null;
  onTabChange: (tab: LibraryTab) => void;
  onSelectEquation: (equationId: string) => void;
  onAddSelectedEquationToEvent: () => void;
  onHideSourceEquation: (equationId: string) => void;
  onRestoreSourceEquation: (equationId: string) => void;
  onDeleteMineEquation: (equationId: string) => void;
  shouldScrollLibrary: boolean;
  tutorialPrompt?: string | null;
  onSkipTutorial?: () => void;
}) {
  const displayedEquations = libraryEquationsForTab(
    activeTab,
    savedEquations,
    templateEquations.filter((equation) => !hiddenSourceEquationIds.includes(equation.id)),
  );
  const canAddEquation = Boolean(activeEventId && selectedEquationId);

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
                {tab === "mine" ? "Mine" : "Lesson template"}
              </button>
            );
            })}
        </div>
        <div style={{ color: "#FFFFFF80", fontSize: 9, lineHeight: 1.3 }}>
          {activeTab === "premade"
            ? "These are ready-made equations. Hide one just for your lesson, or show it again later."
            : "Your saved equations are here. Choose one, then add it to the selected part."}
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
          {displayedEquations.length === 0 ? (
              <div style={{ color: "#FFFFFF80", fontSize: 11, fontWeight: 700, lineHeight: 1.35 }}>
                {activeTab === "mine"
                  ? "Equations you make in this session will appear here."
                  : "This template has no reusable equations."}
              </div>
            ) : (
              <div style={{ display: "grid", gap: 10 }}>
                {displayedEquations.map((equation) => {
                  const isSelected = equation.id === selectedEquationId;

                  return (
                    <div key={equation.id} style={{ display: "grid", gap: 5 }}>
                    <button
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
                    {activeTab === "premade" ? (
                      <button type="button" aria-label={`Hide ${tokensToEquationState(equation.tokens)} from my lesson`} onClick={() => onHideSourceEquation(equation.id)} style={{ border: `1px solid ${subtleBorderColor}`, borderRadius: 7, background: "#252525", color: "#FFFFFFAA", fontSize: 9, padding: "4px 2px", cursor: "pointer" }}>
                        Hide from my lesson
                      </button>
                    ) : (
                      <button type="button" onClick={() => onDeleteMineEquation(equation.id)} style={{ border: "1px solid #FF7F7F66", borderRadius: 7, background: "#2A1414", color: "#FFB0B0", fontSize: 9, padding: "4px 2px", cursor: "pointer" }}>
                        Delete my equation
                      </button>
                    )}
                    </div>
                  );
                })}
              </div>
          )}
          {hiddenSourceEquationIds.length > 0 ? (
            <div style={{ marginTop: 12, paddingTop: 10, borderTop: `1px solid ${subtleBorderColor}`, display: "grid", gap: 5 }}>
              <span style={{ color: "#FFFFFF80", fontSize: 9, fontWeight: 800 }}>Hidden in my lesson</span>
              {hiddenSourceEquationIds.map((equationId) => {
                const hiddenEquation = templateEquations.find((equation) => equation.id === equationId);
                return (
                  <button key={equationId} type="button" aria-label={`Show ${hiddenEquation ? tokensToEquationState(hiddenEquation.tokens) : "this equation"} again`} onClick={() => onRestoreSourceEquation(equationId)} style={{ border: `1px solid ${subtleBorderColor}`, borderRadius: 7, background: "transparent", color: "#CFFF04", fontSize: 9, padding: "4px 2px", cursor: "pointer" }}>
                    Show again: {hiddenEquation ? tokensToEquationState(hiddenEquation.tokens) : "this equation"}
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>

        {activeEventId ? (
          <div style={{ position: "relative" }}>
            {tutorialPrompt ? (
              <div
                style={{
                  position: "absolute",
                  bottom: "calc(100% + 8px)",
                  left: "50%",
                  transform: "translateX(-50%)",
                  width: 240,
                  zIndex: 1300,
                }}
              >
                <TutorialBubble
                  text={tutorialPrompt}
                  onSkip={onSkipTutorial ?? (() => {})}
                />
              </div>
            ) : null}
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
              Assign to every move in this encounter
            </button>
          </div>
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
    : "No encounter selected. Add a Hit, Spin, or Drag to create one.";

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
          Add encounter
        </button>
      </div>

      {renderInspectorRow(
        "Encounter (timed)",
        <>
          <div>{selectedEventSlot ? studentCopy.editor.moveGroup(eventIndex + 1) : "No encounter selected"}</div>
          <div style={{ color: "#CFFF04", marginTop: 4 }}>{assignedEquationText}</div>
          <div style={{ marginTop: 4, color: "#FFFFFF99" }}>
            {`Playhead ${formatTimelineTime(currentSongSeconds, isAdvancedMode)}`}
          </div>
          <div style={{ marginTop: 6, color: "#FFFFFF99", fontSize: 10, fontWeight: 700 }}>
            Each Hit, Spin, or Drag becomes its own move in the game when you save.
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
  activeEventNumber,
  activeEventHasEquation,
  onRewind,
  onTogglePlay,
  onFastForward,
}: {
  isPlaying: boolean;
  currentSongSeconds: number;
  isAdvancedMode: boolean;
  activeEventNumber: number | null;
  activeEventHasEquation: boolean;
  onRewind: () => void;
  onTogglePlay: () => void;
  onFastForward: () => void;
}) {
  const controls = [
    { label: "⏪", ariaLabel: "Rewind", onClick: onRewind },
    { label: isPlaying ? "⏸" : "▶", ariaLabel: isPlaying ? "Pause" : "Play", onClick: onTogglePlay },
    { label: "⏩", ariaLabel: "Fast forward", onClick: onFastForward },
  ];

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
      <div
        aria-live="polite"
        style={{
          minWidth: 0,
          marginLeft: "auto",
          overflow: "hidden",
          color: "#FFFFFF99",
          fontSize: 10,
          fontWeight: 800,
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {activeEventNumber === null
          ? "Choose an encounter below to edit it"
          : activeEventHasEquation
            ? studentCopy.editor.editingMoveGroup(activeEventNumber)
            : `Editing ${studentCopy.editor.moveGroup(activeEventNumber)} · build an equation on the left`}
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
  onAddHitPad,
  onToggleSpinTarget,
  onToggleDragTarget,
  onPatchInstance,
  dragSources = [],
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
  onAddHitPad: (
    mechanic: GameplayMechanic,
    instanceIndex: number,
    tokenIndex: number,
    pad: HitBubblePad,
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
  onPatchInstance: (mechanic: GameplayMechanic, instanceIndex: number, patch: Partial<MechanicInstanceState>) => void;
  dragSources?: Array<{ id: string; label: string }>;
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
          onAddHitPad={onAddHitPad}
          onToggleSpinTarget={onToggleSpinTarget}
          onToggleDragTarget={onToggleDragTarget}
          onPatchInstance={onPatchInstance}
          dragSources={dragSources}
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
  enableWorkspaceSync = true,
}: LessonBuilderClientProps) {
  type EditorStoreState = ReturnType<typeof useEditorStore.getState>;

  const router = useRouter();
  const project = useEditorStore((state: EditorStoreState) => state.project);
  const setProject = useEditorStore(
    (state: EditorStoreState) => state.setProject,
  );
  const setStoreSidecar = useEditorStore(
    (state: EditorStoreState) => state.setSidecar,
  );

  const [chartFile, setChartFile] = useState("");
  const originalChartFileRef = useRef("");
  const [metadata, setMetadata] =
    useState<LessonBuilderPayload["analysisMetadata"]>();
  const [uploadedSongName, setUploadedSongName] = useState("");
  const [uploadedChartName, setUploadedChartName] = useState("");
  const [pendingSongFile, setPendingSongFile] = useState<File | null>(null);

  const [timelineEvents, setTimelineEvents] = useState<TimelineEventSlot[]>([]);
  const [activeEventId, setActiveEventId] = useState<string | null>(null);
  const [savedEquations, setSavedEquations] = useState<SavedEquation[]>([]);
  const [templateEquations, setTemplateEquations] = useState<SavedEquation[]>([]);
  const [hiddenSourceEquationIds, setHiddenSourceEquationIds] = useState<string[]>([]);
  const [authoredEquationQueue, setAuthoredEquationQueue] = useState<SavedEquation[]>([]);
  const [mode, setMode] = useState<"event" | "equation" | "rctm1" | "rctm2">("event");
  const [centerChoice, setCenterChoice] = useState<CenterChoice>(null);
  const [libraryTab, setLibraryTab] = useState<LibraryTab>("mine");
  const [selectedEquationId, setSelectedEquationId] = useState<string | null>(null);
  const [hideEquationHeader, setHideEquationHeader] = useState(false);
  const [rtcmDraftMechanics, setRtcmDraftMechanics] = useState<RtcmDraftMechanic[]>([]);
  const [rtcmEventRangeStartTick, setRtcmEventRangeStartTick] = useState<number | null>(null);
  const [rtcmPendingHold, setRtcmPendingHold] = useState<{
    draftId: string;
    mechanic: "spin" | "drag";
    startTick: number;
  } | null>(null);
  const rtcmPendingHoldRef = useRef<{
    draftId: string;
    mechanic: "spin" | "drag";
    startTick: number;
  } | null>(null);
  const [currentSongSeconds, setCurrentSongSeconds] = useState(0);
  const [isSongPlaying, setIsSongPlaying] = useState(false);
  const [audioObjectUrl, setAudioObjectUrl] = useState("");
  const [audioDurationSeconds, setAudioDurationSeconds] = useState(0);
  const [waveformPeaks, setWaveformPeaks] = useState<number[]>([]);
  const [row2ColumnWidths, setRow2ColumnWidths] = useState<number[]>([220, 600, 230]);
  const [activeResizeHandle, setActiveResizeHandle] = useState<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const resizeStartRef = useRef<{ handleIndex: number; startX: number; startWidths: number[] } | null>(null);
  const [draftTokens, setDraftTokens] = useState<EquationToken[]>([]);
  const [customTokenLabel, setCustomTokenLabel] = useState("");
  const [loadError, setLoadError] = useState("");
  const [lessonReadiness, setLessonReadiness] = useState<
    FreshSongLaunchPackage["readiness"] | null
  >(null);
  const [saveStatus, setSaveStatus] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [entryIntent, setEntryIntent] = useState<PlayerLessonEntryIntent>("play");
  const [guidedStarted, setGuidedStarted] = useState(false);
  const [advancedMode, setAdvancedMode] = useState(false);
  const [isLessonLoaded, setIsLessonLoaded] = useState(false);
  const [advancedConfirmOpen, setAdvancedConfirmOpen] = useState(false);
  const [isReadinessOpen, setIsReadinessOpen] = useState(false);
  const [isBuilderPanelOpen, setIsBuilderPanelOpen] = useState(false);
  const [isLibraryPanelOpen, setIsLibraryPanelOpen] = useState(false);
  const [selectedSongStorage, setSelectedSongStorage] = useState<{
    id: string;
    chart: StorageFileRef;
    sidecar: StorageFileRef | null;
  } | null>(null);
  const [starterTemplateDismissedForSongId, setStarterTemplateDismissedForSongId] =
    useState<string | null>(null);
  const [selectedSongLaunch, setSelectedSongLaunch] = useState<{
    songAssetId: string;
    activityKey: SongActivityKey;
    authorName?: string | null;
    rhythmDifficultyKey?: "EasySingle" | "MediumSingle" | "HardSingle" | "ExpertSingle";
    chartUrl: string;
    sidecarUrl: string | null;
    audioUrl: string;
  } | null>(null);
  const [selectedSongActivity, setSelectedSongActivity] = useState<{
    key: SongActivityKey;
    label: string;
  } | null>(null);
  // Author (plaintext name, e.g. "dev") of the currently loaded chart.
  // Determines which SongChart row a save writes to (dev when null).
  const [selectedSongAuthorName, setSelectedSongAuthorName] = useState<string | null>(null);
  const [selectedSongAuthorId, setSelectedSongAuthorId] = useState<string | null>(null);
  const [lastSavedAuthorId, setLastSavedAuthorId] = useState<string | null>(null);
  const [lastSavedRevision, setLastSavedRevision] = useState<string | null>(null);
  const [selectedRhythmSource, setSelectedRhythmSource] = useState<RhythmSourceOption | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const editGenerationRef = useRef(0);
  const publicationRequestIdRef = useRef<string | null>(null);
  function markDirty() {
    editGenerationRef.current += 1;
    publicationRequestIdRef.current = null;
    setHasUnsavedChanges(true);
  }
  const workspaceVersionRef = useRef(0);
  const workspaceRestoredSourceRef = useRef<string | null>(null);
  const [workspaceStatus, setWorkspaceStatus] = useState<"idle" | "loading" | "ready" | "offline" | "conflict">("idle");
  const [workspaceConflict, setWorkspaceConflict] = useState<{ version: number; payload: { equations: SavedEquation[]; hiddenSourceEquationIds: string[]; timelineEdits: unknown[] } } | null>(null);
  const [workspaceRetryNonce, setWorkspaceRetryNonce] = useState(0);
  // Pending in-app navigation blocked by the unsaved-changes popup.
  const [pendingNavigation, setPendingNavigation] = useState<(() => void) | null>(null);
  const isDemoMode = navBasePath.startsWith("/demo");
  const canSyncWorkspace = enableWorkspaceSync && !isDemoMode;
  // Demo tutorial: it starts only after the player chooses to personalise,
  // never while they are still choosing between playing and editing.
  const [tutorialStep, setTutorialStep] = useState<"welcome" | "build" | "save" | "add" | null>(null);
  const [isFilePickerOpen, setIsFilePickerOpen] = useState(false);
  const [isFilePickerLoading, setIsFilePickerLoading] = useState(false);
  const [filePickerError, setFilePickerError] = useState("");
  const [filePickerSongs, setFilePickerSongs] = useState<SongChoiceOption[]>([]);
  const [filePickerSongId, setFilePickerSongId] = useState<string | null>(null);
  const [filePickerRhythmSourceRevision, setFilePickerRhythmSourceRevision] = useState<string | null>(null);
  const [filePickerAuthors, setFilePickerAuthors] = useState<SongChartAuthorOption[]>([]);
  const [isFilePickerAuthorsLoading, setIsFilePickerAuthorsLoading] = useState(false);
  const [filePickerAuthorName, setFilePickerAuthorName] = useState<string | null>(null);
  const [filePickerActivityKey, setFilePickerActivityKey] =
    useState<SongActivityKey>(defaultSongActivityKey);
  const isAdvancedMode = advancedMode;
  const isGuidedStart = entryIntent === "personalize" && !guidedStarted && isLessonLoaded;
  const [selectedContextMechanicKey, setSelectedContextMechanicKey] =
    useState<string | null>(null);
  const [pendingRangeSelection, setPendingRangeSelection] =
    useState<PendingMechanicRangeSelection | null>(null);
  const [rctm2PendingEventNumber, setRctm2PendingEventNumber] =
    useState<number | null>(null);
  const [rctm2HitPlacements, setRctm2HitPlacements] =
    useState<Record<string, Rctm2Point>>({});
  const [rctm2DragStartPoints, setRctm2DragStartPoints] =
    useState<Record<string, Rctm2Point>>({});
  const [rctm2DragSourceHitIds, setRctm2DragSourceHitIds] =
    useState<Record<string, string>>({});
  const timelineRehydrateSourceRef = useRef<SidecarPayload>(emptySidecar);
  const legacyEncounterSourceRef = useRef<LegacyEncounterSidecar | null>(null);
  const loadedSongReadyRef = useRef(false);
  const lessonLoadGenerationRef = useRef(0);
  const lessonLoadAbortRef = useRef<AbortController | null>(null);
  const rctm2EntrySidecarRef = useRef<SidecarPayload>(emptySidecar);
  const rctm2EntryChartFileRef = useRef("");

  const sidecar = useMemo(
    () => sidecarFromTimelineEvents(timelineEvents),
    [timelineEvents, chartFile, selectedSongActivity, selectedSongLaunch],
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

    const separatorsWidth = 12;

    const calcWidths = () => {
      const w = window.innerWidth;
      if (w < 1050) {
        setIsBuilderPanelOpen(false);
        setIsLibraryPanelOpen(false);
      }
      // Stretch the viewer/equation-builder/library columns across the full
      // width now that there is no fourth (inspector) column reserving space.
      const availableWidth = Math.max(0, w - separatorsWidth);
      const col1 = Math.round(Math.min(300, Math.max(210, availableWidth * 0.19)));
      const col3 = Math.round(Math.min(260, Math.max(180, availableWidth * 0.15)));
      const col2 = Math.max(320, availableWidth - col1 - col3);
      setRow2ColumnWidths([col1, col2, col3]);
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

  const workspaceSource = useMemo<LessonSourceIdentity | null>(() => {
    return resolveLessonWorkspaceSource({
      songAssetId: selectedSongStorage?.id,
      activityKey: selectedSongActivity?.key,
      lastSavedAuthorId,
      selectedAuthorId: selectedSongAuthorId,
      selectedAuthorName: selectedSongAuthorName,
      revision: lastSavedRevision,
    });
  }, [lastSavedAuthorId, lastSavedRevision, selectedSongActivity, selectedSongAuthorId, selectedSongAuthorName, selectedSongStorage]);

  useEffect(() => {
    if (!isLessonLoaded || entryIntent !== "personalize" || guidedStarted || !workspaceSource) return;
    const sourceKey = JSON.stringify(workspaceSource);
    if (workspaceRestoredSourceRef.current === sourceKey) return;
    workspaceRestoredSourceRef.current = sourceKey;
    setWorkspaceStatus("loading");
    let cancelled = false;
    const applyPayload = (payload: { equations?: unknown[]; hiddenSourceEquationIds?: unknown[]; timelineEdits?: unknown[] }, message: string) => {
      if (cancelled) return;
      const restoredEvents = Array.isArray(payload.timelineEdits)
        ? payload.timelineEdits.filter((event): event is TimelineEventSlot => Boolean(event && typeof event === "object" && typeof (event as { id?: unknown }).id === "string" && typeof (event as { tick?: unknown }).tick === "number"))
        : [];
      if (restoredEvents.length > 0) {
        setTimelineEvents(restoredEvents);
        setActiveEventId(restoredEvents[0]?.id ?? null);
        markDirty();
      }
      if (Array.isArray(payload.equations)) setSavedEquations(payload.equations as SavedEquation[]);
      if (Array.isArray(payload.hiddenSourceEquationIds)) setHiddenSourceEquationIds(payload.hiddenSourceEquationIds.filter((id): id is string => typeof id === "string"));
      setWorkspaceStatus("ready");
      if (message) setSaveStatus(message);
    };
    if (!canSyncWorkspace) {
      const draft = readPlayerLessonWorkspaceDraft(sessionStorage, workspaceSource);
      if (draft) {
        applyPayload({ equations: draft.equationEdits, hiddenSourceEquationIds: draft.hiddenSourceEquationIds, timelineEdits: draft.timelineEvents }, "Your saved changes are back on this device. The original lesson stays safe to play.");
      } else {
        setWorkspaceStatus("ready");
      }
      return;
    }

    fetch(`/api/player-workspace?${new URLSearchParams(workspaceSource as Record<string, string>)}`)
      .then(async (response) => {
        const result = await classifyWorkspaceResponse(response);
        if (result.kind === "success") return result.record;
        if (result.kind === "permanent" || result.kind === "retryable") {
          setSaveStatus(getLearnerFacingError(result.message, studentCopy.editor.draftRecoveryFailed));
        }
        return null;
      })
      .then((record: { version?: number; payload?: { equations?: unknown[]; hiddenSourceEquationIds?: unknown[]; timelineEdits?: unknown[] } | null } | null) => {
        if (record?.payload) {
          workspaceVersionRef.current = record.version ?? 0;
          applyPayload(record.payload, "Your saved changes are back. The original lesson stays safe.");
          return;
        }
        const draft = readPlayerLessonWorkspaceDraft(sessionStorage, workspaceSource);
        if (draft) applyPayload({ equations: draft.equationEdits, hiddenSourceEquationIds: draft.hiddenSourceEquationIds, timelineEdits: draft.timelineEvents }, "Your saved changes are back on this device. The original lesson stays safe to play.");
        else { setWorkspaceStatus("ready"); }
      })
      .catch(() => {
        const draft = readPlayerLessonWorkspaceDraft(sessionStorage, workspaceSource);
        if (draft) applyPayload({ equations: draft.equationEdits, hiddenSourceEquationIds: draft.hiddenSourceEquationIds, timelineEdits: draft.timelineEvents }, "Your saved changes are back. They will sync when you are connected.");
        else { setWorkspaceStatus("offline"); }
      });
    return () => { cancelled = true; };
  }, [canSyncWorkspace, entryIntent, guidedStarted, isLessonLoaded, workspaceSource]);

  useEffect(() => {
    if (!guidedStarted || workspaceStatus === "loading" || !workspaceSource || (!hasUnsavedChanges && savedEquations.length === 0 && hiddenSourceEquationIds.length === 0)) return;
    let cancelled = false;
    let retryTimer: number | null = null;
    const timer = window.setTimeout(() => {
      const payload = {
        version: 1,
        equations: savedEquations,
        hiddenSourceEquationIds,
        timelineEdits: timelineEvents as unknown[],
        tutorial: { step: tutorialStep === "welcome" ? "welcome" : tutorialStep === "build" || tutorialStep === "save" ? "equation" : tutorialStep === "add" ? "encounter" : "done" } as const,
        updatedAt: Date.now(),
      };
      try {
        writePlayerLessonWorkspaceDraft(sessionStorage, {
          version: 1,
          source: workspaceSource,
          timelineEvents,
          equationEdits: savedEquations,
          hiddenSourceEquationIds,
          updatedAt: Date.now(),
        });
        if (!canSyncWorkspace) {
          setWorkspaceStatus("ready");
          return;
        }
        const prepared = prepareWorkspaceMutation({ key: workspaceSource, expectedVersion: workspaceVersionRef.current, payload });
        if (prepared.kind !== "ready") {
          setWorkspaceStatus("offline");
          setSaveStatus(getLearnerFacingError(prepared.message, studentCopy.editor.draftRecoveryFailed));
          return;
        }

        let attempt = 0;
        const sync = async () => {
          if (cancelled) return;
          let result: WorkspaceResponseResult;
          try {
            const response = await fetch("/api/player-workspace", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(prepared.mutation) });
            result = await classifyWorkspaceResponse(response);
          } catch {
            result = classifyWorkspaceError();
          }
          if (cancelled) return;
          if (result.kind === "success") {
            workspaceVersionRef.current = result.record?.version ?? workspaceVersionRef.current;
            setWorkspaceStatus("ready");
            return;
          }
          if (result.kind === "conflict") {
            if (result.current?.payload) {
              workspaceVersionRef.current = result.current.version ?? workspaceVersionRef.current;
              setWorkspaceConflict({ version: result.current.version ?? 0, payload: result.current.payload });
              setWorkspaceStatus("conflict");
            } else {
              setWorkspaceStatus("offline");
              setSaveStatus(getLearnerFacingError(result.message, studentCopy.editor.draftRecoveryFailed));
            }
            return;
          }
          if (result.kind === "permanent") {
            setWorkspaceStatus("offline");
            setSaveStatus(getLearnerFacingError(result.message, studentCopy.editor.draftRecoveryFailed));
            return;
          }
          if (attempt < MAX_WORKSPACE_RETRIES) {
            const delay = workspaceRetryDelay(attempt, result.retryAfterMs);
            attempt += 1;
            retryTimer = window.setTimeout(() => void sync(), delay);
            return;
          }
          setWorkspaceStatus("offline");
          setSaveStatus(getLearnerFacingError(result.message, studentCopy.editor.draftRecoveryFailed));
        };
        void sync();
      } catch (error) {
        console.warn("Unable to save private lesson recovery copy", error);
        setWorkspaceStatus("offline");
        setSaveStatus(studentCopy.editor.draftRecoveryFailed);
      }
    }, 750);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      if (retryTimer !== null) window.clearTimeout(retryTimer);
    };
  }, [canSyncWorkspace, guidedStarted, hasUnsavedChanges, hiddenSourceEquationIds, savedEquations, timelineEvents, tutorialStep, workspaceRetryNonce, workspaceSource]);

  const shouldShowStarterTemplate = shouldOfferStarterTemplate({
    songId: selectedSongStorage?.id ?? null,
    encounterCount: timelineEvents.length,
    dismissedForSongId: starterTemplateDismissedForSongId,
  });

  const activeEventEquation = useMemo(() => {
    return activeTimelineEvent ? getTimelineEventEquation(activeTimelineEvent) : null;
  }, [activeTimelineEvent]);

  const centerContextEvent = activeTimelineEvent;

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

  const selectedContextHitPad = useMemo(() => {
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

    return instance?.hitBubbles[0]?.pads[0] ?? null;
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

  const lessonPublishReadiness = useMemo(
    () => evaluateLessonPublishReadiness(timelineEvents as unknown as AuthoredTimelineEvent[], {
      activityKey: selectedSongActivity?.key ?? selectedSongLaunch?.activityKey ?? null,
      equationQueue: authoredEquationQueue,
      clock: createLessonClock(chartFile || originalChartFileRef.current),
      stopAtSeconds: sidecar.stopAtSeconds,
    }),
    [authoredEquationQueue, chartFile, selectedSongActivity, selectedSongLaunch, sidecar, timelineEvents],
  );

  const needsReadinessCheck = !lessonPublishReadiness.ready
    || !(selectedSongStorage || selectedSongLaunch)
    || !isLessonLoaded
    || Boolean(loadError);

  const selectedGuidedEncounter = useMemo<GuidedEncounterInput | null>(() => {
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

    return {
      id: instance.id,
      mechanic: selectedCenterContextMechanic.mechanic,
      tick: instance.tick ?? centerContextEvent.tick,
      endTick: inputFromEvent(centerContextEvent, selectedCenterContextMechanic.mechanic, instance).endTick,
      equation:
        instance.equation ??
        centerContextEvent.assignments[selectedCenterContextMechanic.mechanic] ??
        centerContextEventEquation,
      hitBubbles: instance.hitBubbles,
      spinTargets: instance.spinTargets,
      dragTargets: instance.dragTargets,
    };
  }, [centerContextEvent, centerContextEventEquation, selectedCenterContextMechanic]);

  const selectedGuidedReadiness = useMemo(() => {
    if (!selectedGuidedEncounter) {
      return null;
    }

    const issues = lessonPublishReadiness.blockers.filter(
      (blocker) => blocker.encounterId === selectedGuidedEncounter.id,
    );

    return {
      encounterId: selectedGuidedEncounter.id,
      ready: issues.length === 0,
      issueCodes: issues.map((item) => item.code),
      issues,
      nextAction: issues[0]?.nextAction ?? "Ready to publish and play.",
    };
  }, [lessonPublishReadiness, selectedGuidedEncounter]);

  const isFocusedGuidedEditor = Boolean(selectedGuidedEncounter) && !isAdvancedMode;

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
    return {
      column1: row2ColumnWidths[0],
      column2: row2ColumnWidths[1],
      column3: row2ColumnWidths[2],
    };
  }, [row2ColumnWidths]);

  const studentFirstName = useMemo(
    () => getDisplayFirstName(studentName),
    [studentName],
  );

  const selectedEquation = useMemo(
    () =>
      [...savedEquations, ...templateEquations].find(
        (equation) => equation.id === selectedEquationId,
      ) ?? null,
    [savedEquations, selectedEquationId, templateEquations],
  );

  const payloadForProject: LessonBuilderPayload = useMemo(
    () => ({
      chartFile,
      analysisMetadata: metadata,
      rawResults: sidecar,
    }),
    [chartFile, metadata, sidecar],
  );

  function sidecarFromTimelineEvents(events: TimelineEventSlot[], includeRecorded = false): SidecarPayload {
    const seconds = sidecarInSecondsFromTimelineEvents(events);
    if (includeRecorded) {
      const recorded: SidecarEvent[] = rtcmDraftMechanics.map((draft) => ({
        ...draft,
        type: "ALG_MECHANIC" as const,
        ...(draft.mechanic === "hit" ? { hits: 1 } : {
          endTick: draft.id === rtcmPendingHold?.draftId
            ? Math.max(draft.tick, currentSongSeconds)
            : draft.endTick ?? draft.tick,
        }),
      }));
      seconds.events = sortEvents([...seconds.events, ...recorded]);
    }

    // The game should stop a few seconds after the last event ends.
    const eventEndSeconds = events.reduce(
      (maxSeconds, eventSlot) =>
        Math.max(maxSeconds, getTimelineEventTimeWindowSeconds(eventSlot).endSeconds),
      0,
    );
    const draftEndSeconds = includeRecorded
      ? rtcmDraftMechanics.reduce((maxSeconds, draft) => {
          const endTick =
            draft.id === rtcmPendingHold?.draftId
              ? Math.max(draft.tick, currentSongSeconds)
              : draft.endTick ?? draft.tick;
          return Math.max(maxSeconds, timelineTickToSeconds(endTick));
        }, 0)
      : 0;
    const hasAnyEvents = events.length > 0 || (includeRecorded && rtcmDraftMechanics.length > 0);
    const baseStopAtSeconds = hasAnyEvents
      ? Math.max(eventEndSeconds, draftEndSeconds) + endOfChartStopBufferSeconds
      : undefined;
    const activityKey = selectedSongActivity?.key ?? selectedSongLaunch?.activityKey ?? null;
    const finalNumberBondsHitSeconds = activityKey === "number-bonds"
      ? [
          ...events.flatMap((event) => event.mechanicInstances.hit.map((instance) =>
            typeof instance.tick === "number" ? timelineTickToSeconds(instance.tick) : timelineTickToSeconds(event.tick),
          )),
          ...(includeRecorded ? rtcmDraftMechanics
            .filter((draft) => draft.mechanic === "hit")
            .map((draft) => timelineTickToSeconds(draft.tick)) : []),
        ].reduce((latest, secondsAt) => Math.max(latest, secondsAt), Number.NEGATIVE_INFINITY)
      : Number.NEGATIVE_INFINITY;
    const stopAtSeconds = Number.isFinite(finalNumberBondsHitSeconds)
      ? Math.max(
          baseStopAtSeconds ?? 0,
          finalNumberBondsHitSeconds + NUMBER_BONDS_TIMING_POLICY.finalInteractionTailSeconds,
        )
      : baseStopAtSeconds;

    const clock = createLessonClock(chartFile || originalChartFileRef.current);
    return {
      ...seconds,
      ...(legacyEncounterSourceRef.current ? { legacySource: legacyEncounterSourceRef.current } : {}),
      stopAtSeconds,
      events: mapLessonTimes(seconds.events, clock.toTick),
    };
  }

  function hasCompleteAuthoredEquationBindings(events: TimelineEventSlot[]) {
    return events.every((event) =>
      gameplayMechanics.every((mechanic) => {
        if ((event.counts?.[mechanic] ?? 0) <= 0) {
          return true;
        }

        return Array.from({ length: event.counts[mechanic] }, (_, index) => {
          const equation = event.mechanicInstances[mechanic]?.[index]?.equation ?? event.assignments?.[mechanic];
          return Boolean(equation?.id && equation.tokens.length > 0);
        }).every(Boolean);
      }),
    );
  }

  function loadSidecarIntoTimeline(
    nextSidecar: SidecarPayload,
    equationSlotCount: number | null,
    eventCounts: MechanicCounts[] = [],
    eventTicks: number[] = [],
    nextMode: "event" | "equation" | "rctm1" | "rctm2" = "event",
    sourceChart = chartFile || originalChartFileRef.current,
  ) {
    const clock = createLessonClock(sourceChart);
    legacyEncounterSourceRef.current = nextSidecar.legacySource ?? null;
    const authoredInput = nextSidecar.authoredSource ?? nextSidecar;

    // v3 authored fast-path: strict-validate the draft, then hydrate through
    // the tempo map while preserving event/instance/equation identity and
    // equations that no mechanic references. Falls through to the legacy v1
    // bridge for non-authored content.
    if (
      nextSidecar &&
      (authoredInput as { version?: unknown }).version === 3 &&
      (authoredInput as { mode?: unknown }).mode === "authored"
    ) {
      const authoredDraft = parseAuthoredLessonDraft(authoredInput);
      const hydrated = timelineEventsFromAuthoredLesson(authoredDraft, clock);
      const nextEvents = hydrated.events as unknown as TimelineEventSlot[];
      const importedEquations = hydrated.equations as unknown as SavedEquation[];

      appendSongFlowDebug("lesson-builder:timeline:hydrate", "Hydrated authored v3 lesson with identity preserved.", {
        authoredEventCount: nextEvents.length,
        authoredEquationCount: importedEquations.length,
        authoredEncounterCount: authoredDraft.encounters.length,
      });

      setTimelineEvents(nextEvents);
      timelineRehydrateSourceRef.current = nextSidecar;
      setAuthoredEquationQueue(importedEquations);
      setTemplateEquations(importedEquations);
      setActiveEventId(nextEvents[0]?.id ?? null);
      setMode(nextMode);
      setStoreSidecar(nextSidecar as StoreSidecarPayload);
      setSaveStatus(
        `Loaded ${authoredDraft.encounters.length} move${authoredDraft.encounters.length === 1 ? "" : "s"} across ${nextEvents.length} encounter${nextEvents.length === 1 ? "" : "s"}.`,
      );
      return;
    }

    const legacySlots = nextSidecar.events.filter((event): event is SidecarEventSlotEvent => event.type === "ALG_EVENT_SLOT" && Boolean(event.legacyEncounter));
    const nextEvents = timelineEventsFromSidecar(
      { ...nextSidecar, events: mapLessonTimes(nextSidecar.events.filter(event => !(event.type === "ALG_EVENT_SLOT" && event.legacyEncounter)), clock.toSeconds) },
      equationSlotCount,
      eventCounts,
      eventTicks.map(clock.toSeconds),
    );
    legacySlots.forEach((slot, index) => nextEvents.push({
      ...makeTimelineEvent(index, clock.toSeconds(slot.tick), {},
        typeof slot.legacyEncounter?.expectedSolveSeconds === "number"
          ? clock.toSeconds(slot.tick) + slot.legacyEncounter.expectedSolveSeconds : undefined),
      legacyEncounter: slot.legacyEncounter,
    }));
    nextEvents.sort((a, b) => a.tick - b.tick);
    const importedEquations = savedEquationsFromTimelineEvents(nextEvents);

    appendSongFlowDebug("lesson-builder:timeline:hydrate", "Converted chart/sidecar content into timeline events.", {
      sidecarEventCount: nextSidecar.events.length,
      timelineEventCount: nextEvents.length,
      importedEquationCount: importedEquations.length,
      equationSlotCount,
      fallbackEventCount: eventCounts.length,
      fallbackTickCount: eventTicks.length,
      firstTimelineTick: nextEvents[0]?.tick ?? null,
      timeline: nextEvents.map((eventSlot) => ({
        id: eventSlot.id,
        tick: eventSlot.tick,
        counts: eventSlot.counts,
      })),
    });

    setTimelineEvents(nextEvents);
    timelineRehydrateSourceRef.current = nextSidecar;
    setAuthoredEquationQueue(importedEquations);
    setTemplateEquations(importedEquations);
    setActiveEventId(nextEvents[0]?.id ?? null);
    setMode(nextMode);
    setStoreSidecar(nextSidecar as StoreSidecarPayload);
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
    setIsBuilderPanelOpen(true);
    setMode("equation");
  }

  function beginGuidedEditing() {
    setGuidedStarted(true);
    setAdvancedMode(false);
    setIsBuilderPanelOpen(false);
  }

  function handleUseAdvanced() {
    setAdvancedConfirmOpen(true);
  }

  function handlePersonalizeStarterEncounter() {
    const firstEncounter = timelineEvents[0];
    if (!firstEncounter) {
      return;
    }

    setActiveEventId(firstEncounter.id);
    beginGuidedEditing();
    setMode("event");
    setHideEquationHeader(false);
    setTutorialStep(null);
    setStarterTemplateDismissedForSongId(selectedSongStorage?.id ?? null);
    setSaveStatus("Editing encounter 1. The other moves stay the same.");
  }

  function handleAddToStarterTemplate() {
    handleNewEquation();
    beginGuidedEditing();
    setTutorialStep(isDemoMode ? "welcome" : null);
    setLibraryTab("mine");
    setStarterTemplateDismissedForSongId(selectedSongStorage?.id ?? null);
    setSaveStatus("Add an equation if you want to. The other moves are ready to play.");
  }

  function handleKeepStarterTemplate() {
    setStarterTemplateDismissedForSongId(selectedSongStorage?.id ?? null);
    setSaveStatus("Lesson kept safe. You can play it now or change a move later.");
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
    // Demo tutorial step 1: any equation-builder interaction clears the welcome popup.
    setTutorialStep((current) => (current === "welcome" ? "build" : current));
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
    setTutorialStep((current) => (current === "welcome" ? "build" : current));
    setDraftTokens([]);
    setCustomTokenLabel("");
  }

  function handleCreateEquationChoice() {
    setCenterChoice("create");
    setMode("equation");
    setHideEquationHeader(true);
    setTutorialStep((current) => (isDemoMode && current === null ? "welcome" : current));
  }

  function handleToggleRctm1Mode() {
    setAdvancedMode(true);
    if (mode === "rctm1") {
      setMode("event");
      return;
    }

    setTimelineEvents([]);
    setRtcmDraftMechanics([]);
    setRtcmEventRangeStartTick(null);
    setRtcmPendingHold(null);
    rtcmPendingHoldRef.current = null;
    setRctm2PendingEventNumber(null);
    setRctm2HitPlacements({});
    setRctm2DragStartPoints({});
    setRctm2DragSourceHitIds({});
    setPendingRangeSelection(null);
    setActiveEventId(null);

    const shouldUseRctm2Snapshot =
      mode === "rctm2" &&
      (rctm2EntryChartFileRef.current.trim().length > 0 ||
        rctm2EntrySidecarRef.current.events.length > 0);
    const baseChartForRehydrate = shouldUseRctm2Snapshot
      ? rctm2EntryChartFileRef.current
      : chartFile;
    const baseSidecarForRehydrate = shouldUseRctm2Snapshot
      ? rctm2EntrySidecarRef.current
      : timelineRehydrateSourceRef.current;
    const rehydratedSidecar = mergeTimelineSidecarSources(
      baseSidecarForRehydrate,
      baseChartForRehydrate,
      metadata,
    );

    const nextChartFile =
      baseChartForRehydrate.trim().length > 0
        ? baseChartForRehydrate
        : createBlankChartFile(metadata);

    setChartFile(nextChartFile);

    loadSidecarIntoTimeline(rehydratedSidecar, null, [], [], "rctm1", nextChartFile);

    try {
      setProject(
        chartToProject({
          chartFile: nextChartFile,
          analysisMetadata: metadata,
          rawResults: rehydratedSidecar,
        }),
      );
    } catch (error) {
      console.error("Failed to rebuild project while entering RCTM1", error);
    }

    setCenterChoice(null);
  }

  function handleToggleRctm2Mode() {
    setAdvancedMode(true);
    if (mode === "rctm2") {
      setMode("event");
      return;
    }

    const entrySidecar = sidecarFromTimelineEvents(timelineEvents);
    timelineRehydrateSourceRef.current = entrySidecar;
    rctm2EntrySidecarRef.current = entrySidecar;
    rctm2EntryChartFileRef.current = chartFile;
    setTimelineEvents([]);
    setRtcmDraftMechanics([]);
    setRtcmEventRangeStartTick(null);
    setRtcmPendingHold(null);
    rtcmPendingHoldRef.current = null;
    setRctm2PendingEventNumber(null);
    setRctm2HitPlacements({});
    setRctm2DragStartPoints({});
    setRctm2DragSourceHitIds({});
    setPendingRangeSelection(null);
    setActiveEventId(null);
    setMode("rctm2");
    setCenterChoice(null);
  }

  function handleClearRtcmChart() {
    setTimelineEvents([]);
    setRtcmDraftMechanics([]);
    setRtcmEventRangeStartTick(null);
    setRtcmPendingHold(null);
    rtcmPendingHoldRef.current = null;
    setRctm2PendingEventNumber(null);
    setRctm2HitPlacements({});
    setRctm2DragStartPoints({});
    setRctm2DragSourceHitIds({});
    setPendingRangeSelection(null);
    setActiveEventId(null);

    // Nothing to rehydrate back to once mode is exited - the chart and json are blank now.
    timelineRehydrateSourceRef.current = emptySidecar;
    legacyEncounterSourceRef.current = null;
    rctm2EntrySidecarRef.current = emptySidecar;
    rctm2EntryChartFileRef.current = "";

    const blankChartFile = createBlankChartFile(metadata);
    originalChartFileRef.current = blankChartFile;
    setChartFile(blankChartFile);

    try {
      setProject(
        chartToProject({
          chartFile: blankChartFile,
          analysisMetadata: metadata,
          rawResults: emptySidecar,
        }),
      );
    } catch (error) {
      console.error("Failed to rebuild project after clearing the chart", error);
    }

    setSaveStatus("Lesson data cleared.");
  }

  function addRtcmDraftMechanic(
    mechanic: GameplayMechanic,
    seconds: number,
    options: { endSeconds?: number; hitPad?: HitBubblePad } = {},
  ) {
    const capabilities = getActivityAuthoringCapabilities(
      selectedSongActivity?.key ?? selectedSongLaunch?.activityKey,
    );
    if (!capabilities.supportedAuthoredMechanics.includes(mechanic)) {
      setSaveStatus(
        `${studentCopy.mechanics[mechanic]} is generated by the Number Bonds runtime; add a Hit cue instead.`,
      );
      return "";
    }
    const tick = Number(seconds.toFixed(3));
    const endTick =
      typeof options.endSeconds === "number"
        ? Number(options.endSeconds.toFixed(3))
        : mechanic === "hit"
          ? undefined
          : tick;
    const draftId = makeId("rtcm");
    const hitBubbles: HitBubblePlacement[] = mechanic === "hit" && options.hitPad
      ? [{ tokenIndex: 0, positions: [options.hitPad], pads: [options.hitPad] }]
      : [];
    const normalized = normalizeStagedMechanic(
      {
        id: draftId,
        mechanic,
        tick,
        ...(typeof endTick === "number" ? { endTick } : {}),
        ...(selectedEquationId ? { equationId: selectedEquationId } : {}),
        hitBubbles,
        spinTargets: [],
        dragTargets: [],
      },
      selectedEquation,
      { activityKey: selectedSongActivity?.key ?? selectedSongLaunch?.activityKey ?? null },
    );

    setRtcmDraftMechanics((current) => [
      ...current,
      {
        id: draftId,
        mechanic,
        ...(selectedEquationId ? { equationId: selectedEquationId } : {}),
        tick,
        ...(typeof endTick === "number" ? { endTick } : {}),
        hitBubbles,
        spinTargets: [],
        dragTargets: [],
      },
    ]);
    setSaveStatus(
      studentCopy.editor.moveDrafted(
        studentCopy.mechanics[mechanic],
        formatSongTime(seconds, isAdvancedMode),
        getLearnerFacingError(new Error(normalized.readiness.nextAction), studentCopy.editor.readyToPlay),
      ),
    );

    return draftId;
  }

  function handleStartRtcmEventCreation(pendingRctm2Number: number | null = null) {
    setCenterChoice(null);
    setRtcmEventRangeStartTick(Number(currentSongSeconds.toFixed(3)));
    setRctm2PendingEventNumber(pendingRctm2Number);
    setSaveStatus(`Encounter starts at ${formatSongTime(currentSongSeconds, isAdvancedMode)}. Move the playhead to choose when it ends.`);
  }

  function handleToggleRtcmEventCreation(pendingRctm2Number: number | null = null) {
    if (rtcmEventRangeStartTick === null) {
      handleStartRtcmEventCreation(pendingRctm2Number);
      return;
    }

    handleFinalizeRtcmEventCreation({
      rctm2Number:
        mode === "rctm2"
          ? (rctm2PendingEventNumber ?? pendingRctm2Number ?? undefined)
          : undefined,
    });
  }

  function handleStartRtcmHold(mechanic: "spin" | "drag") {
    const tick = Number(currentSongSeconds.toFixed(3));
    const draftId = addRtcmDraftMechanic(mechanic, currentSongSeconds, {
      endSeconds: currentSongSeconds,
    });

    const pendingHold = {
      draftId,
      mechanic,
      startTick: tick,
    };
    rtcmPendingHoldRef.current = pendingHold;
    setRtcmPendingHold(pendingHold);
  }

  function handleFinalizeRtcmHold() {
    const pendingHold = rtcmPendingHoldRef.current ?? rtcmPendingHold;
    if (!pendingHold) {
      return;
    }

    const endTick = Number(currentSongSeconds.toFixed(3));

    setRtcmDraftMechanics((current) =>
      current.map((draft) => {
        if (draft.id !== pendingHold.draftId) {
          return draft;
        }

        return {
          ...draft,
          endTick: Math.max(pendingHold.startTick, endTick),
        };
      }),
    );

    rtcmPendingHoldRef.current = null;
    setRtcmPendingHold(null);
    setSaveStatus(`${studentCopy.mechanics[pendingHold.mechanic]} recorded in the current encounter draft. Save the encounter when it is complete.`);
  }

  function handleFinalizeRtcmEventCreation(options: { rctm2Number?: number } = {}) {
    if (rtcmEventRangeStartTick === null) {
      return;
    }

    const endTick = Number(currentSongSeconds.toFixed(3));
    const startTick = Math.min(rtcmEventRangeStartTick, endTick);
    const finalEndTick = Math.max(rtcmEventRangeStartTick, endTick);

    if (Math.abs(finalEndTick - startTick) < 0.001) {
      setSaveStatus("Move the playhead to set how long this encounter lasts.");
      return;
    }

    const selectedDrafts = rtcmDraftMechanics.filter((draft) => {
      if (draft.tick < startTick || draft.tick > finalEndTick) {
        return false;
      }

      if (draft.mechanic === "hit") {
        return true;
      }

      return typeof draft.endTick === "number"
        ? draft.endTick <= finalEndTick
        : true;
    });

    setTimelineEvents((current) => {
      const nextEvent = makeTimelineEvent(
        current.length,
        startTick,
        selectedDrafts.reduce<Partial<MechanicCounts>>((counts, draft) => {
          counts[draft.mechanic] = (counts[draft.mechanic] ?? 0) + 1;
          return counts;
        }, {}),
        finalEndTick,
      );

      if (typeof options.rctm2Number === "number") {
        nextEvent.rctm2Number = Math.max(
          1,
          Math.min(20, Math.round(options.rctm2Number)),
        );
      }

      const nextDraftsByMechanic: Record<GameplayMechanic, MechanicInstanceState[]> = {
        hit: [],
        spin: [],
        drag: [],
      };

      selectedDrafts.forEach((draft) => {
        const instance = {
          id: draft.id,
          tick: draft.tick,
          ...(draft.mechanic === "hit" ? {} : { endTick: draft.endTick ?? draft.tick }),
          hitBubbles: draft.hitBubbles,
          spinTargets: draft.spinTargets,
          dragTargets: draft.dragTargets,
        } satisfies MechanicInstanceState;

        nextDraftsByMechanic[draft.mechanic].push(instance);
      });

      nextEvent.mechanicInstances = {
        hit: nextDraftsByMechanic.hit,
        spin: nextDraftsByMechanic.spin,
        drag: nextDraftsByMechanic.drag,
      };

      const nextEvents = [...current, nextEvent].sort(
        (left, right) => timelineTickToSeconds(left.tick) - timelineTickToSeconds(right.tick),
      );

      syncTimelineFilesFromEvents(nextEvents);
      return nextEvents;
    });

    setRtcmDraftMechanics((current) =>
      current.filter((draft) => !selectedDrafts.some((selected) => selected.id === draft.id)),
    );
    setRtcmEventRangeStartTick(null);
    setRctm2PendingEventNumber(null);
    setSaveStatus(
      `Encounter created from ${formatSongTime(startTick, isAdvancedMode)} to ${formatSongTime(finalEndTick, isAdvancedMode)}.`,
    );
  }

  function handleBrowsePremadeChoice() {
    setCenterChoice("premade");
    setLibraryTab("premade");
    setHideEquationHeader(true);
    setIsLibraryPanelOpen(true);
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

    setSavedEquations((current) => [nextEquation, ...current]);
    setAuthoredEquationQueue((current) =>
      current.some((equation) => equation.id === nextEquation.id)
        ? current
        : [...current, nextEquation],
    );
    setSelectedEquationId(nextEquation.id);
    setLibraryTab("mine");
    setIsLibraryPanelOpen(true);
    setDraftTokens([]);
    setCustomTokenLabel("");
    setMode("event");
    markDirty();
    // Demo tutorial step 2 -> 3: equation saved, point at the Add Equation button.
    setTutorialStep((current) => (current === null ? null : "add"));
  }

  function handleUseDraftInActiveEvent() {
    if (!activeEventId) {
      setSaveStatus(studentCopy.editor.chooseEventFirst);
      return;
    }

    const equalsIndex = draftTokens.findIndex((token) => token.label === "=");
    if (equalsIndex <= 0 || equalsIndex >= draftTokens.length - 1) {
      setSaveStatus(studentCopy.editor.equationNeedsBothSides);
      return;
    }

    const nextEquation: SavedEquation = {
      id: makeId("equation"),
      tokens: cloneTokens(draftTokens),
    };

    setSavedEquations((current) => [nextEquation, ...current]);
    setAuthoredEquationQueue((current) => [...current, nextEquation]);
    handleDropEquation(nextEquation);
    setSelectedEquationId(nextEquation.id);
    setDraftTokens([]);
    setCustomTokenLabel("");
    setMode("event");
    setHideEquationHeader(false);
    setTutorialStep(null);
    const activeEventIndex = timelineEvents.findIndex((eventSlot) => eventSlot.id === activeEventId);
    setSaveStatus(
      activeEventIndex >= 0
        ? `Added your equation to this lesson. Every move in ${studentCopy.editor.moveGroup(activeEventIndex + 1)} will use it.`
        : "Added your equation to this lesson. Every move in the selected encounter will use it.",
    );
  }

  // Draft counts as a full equation once "=" has tokens on both sides.
  const draftEqualsIndex = draftTokens.findIndex((token) => token.label === "=");
  const isDraftEquationValid =
    draftEqualsIndex > 0 && draftEqualsIndex < draftTokens.length - 1;
  // Demo tutorial step 2: show the save prompt as soon as the draft is valid.
  const showSaveEquationTutorialPrompt =
    tutorialStep === "save" || (tutorialStep === "build" && isDraftEquationValid);

  function requestNavigation(navigate: () => void) {
    if (hasUnsavedChanges) {
      setPendingNavigation(() => navigate);
      return;
    }

    navigate();
  }

  function handleLeaveWithoutSaving() {
    const navigate = pendingNavigation;
    setPendingNavigation(null);
    setHasUnsavedChanges(false);
    navigate?.();
  }

  async function handleSaveAndLeave() {
    // Nothing loaded means nothing to persist; just leave.
    if (!selectedSongStorage) {
      handleLeaveWithoutSaving();
      return;
    }

    const didSave = await handlePublishChanges();

    if (!didSave) {
      return;
    }

    const navigate = pendingNavigation;
    setPendingNavigation(null);
    navigate?.();
  }

  // Browser tab close / refresh guard for unsaved work.
  useEffect(() => {
    if (!hasUnsavedChanges) {
      return;
    }

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasUnsavedChanges]);

  function handleSelectEvent(eventId: string) {
    if (mode === "rctm2") {
      return;
    }

    setActiveEventId((current) => (current === eventId ? null : eventId));
    setHideEquationHeader(true);
  }

  function handleDeleteActiveEvent() {
    const playheadEvent =
      mode === "rctm1" || mode === "rctm2"
        ? findTimelineEventAtSeconds(timelineEvents, currentSongSeconds)
        : null;
    const targetEventId = getRctmDeleteTargetEventId({
      mode,
      activeEventId,
      playheadEventId: playheadEvent?.id ?? null,
      eventIds: timelineEvents.map((eventSlot) => eventSlot.id),
    });

    if (!targetEventId) {
      setSaveStatus(
        mode === "rctm1" || mode === "rctm2"
          ? "Move the playhead over an encounter to remove it."
          : "Pick an encounter to remove.",
      );
      return;
    }

    setTimelineEvents((current) => {
      const deleteIndex = current.findIndex((eventSlot) => eventSlot.id === targetEventId);

      if (deleteIndex < 0) {
        return current;
      }

      const deletedEvent = current[deleteIndex];
      const deletedHitIds = (deletedEvent.mechanicInstances?.hit ?? [])
        .map((instance) => instance.id)
        .filter((id): id is string => Boolean(id));
      const deletedDragIds = (deletedEvent.mechanicInstances?.drag ?? [])
        .map((instance) => instance.id)
        .filter((id): id is string => Boolean(id));
      const nextEvents = current.filter((eventSlot) => eventSlot.id !== targetEventId).sort(
        (left, right) => timelineTickToSeconds(left.tick) - timelineTickToSeconds(right.tick),
      );

      if (deletedHitIds.length > 0) {
        setRctm2HitPlacements((placements) => {
          const next = { ...placements };
          deletedHitIds.forEach((id) => {
            delete next[id];
          });
          return next;
        });
      }

      if (deletedDragIds.length > 0) {
        setRctm2DragStartPoints((points) => {
          const next = { ...points };
          deletedDragIds.forEach((id) => {
            delete next[id];
          });
          return next;
        });
        setRctm2DragSourceHitIds((mappings) => {
          const next = { ...mappings };
          deletedDragIds.forEach((id) => {
            delete next[id];
          });
          return next;
        });
      }

      syncTimelineFilesFromEvents(nextEvents);

      if (mode === "rctm1" || mode === "rctm2") {
        setActiveEventId(null);
      } else {
        const nextActiveEvent = nextEvents[deleteIndex] ?? nextEvents[deleteIndex - 1] ?? null;
        setActiveEventId(nextActiveEvent?.id ?? null);
      }

      setSaveStatus(`${studentCopy.editor.moveGroup(deleteIndex + 1)} removed.`);

      return nextEvents;
    });
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
              return {
                ...instance,
                hitBubbles: [{ tokenIndex, positions: selectedContextHitPad ? [selectedContextHitPad] : ["left"], pads: selectedContextHitPad ? [selectedContextHitPad] : ["left"] }],
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

  function handleSetSelectedContextHitPad(pad: HitBubblePad) {
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
              hitBubbles: [{ tokenIndex, positions: [pad], pads: [pad] }],
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
        `${studentCopy.mechanics[selectedCenterContextMechanic.mechanic]} ${selectedCenterContextMechanic.instanceIndex + 1} removed.`,
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
    setIsLibraryPanelOpen(true);
  }

  function handleSelectLibraryTab(tab: LibraryTab) {
    setLibraryTab(tab);
    setSelectedEquationId(null);
    setIsLibraryPanelOpen(true);
  }

  function handleHideSourceEquation(equationId: string) {
    setHiddenSourceEquationIds((current) => current.includes(equationId) ? current : [...current, equationId]);
    setSelectedEquationId(null);
    markDirty();
    setSaveStatus("This equation is hidden. You can show it again any time.");
  }

  function handleRestoreSourceEquation(equationId: string) {
    setHiddenSourceEquationIds((current) => current.filter((id) => id !== equationId));
    markDirty();
    setSaveStatus("This equation is back in your lesson.");
  }

  function handleDeleteMineEquation(equationId: string) {
    setSavedEquations((current) => current.filter((equation) => equation.id !== equationId));
    setSelectedEquationId((current) => current === equationId ? null : current);
    markDirty();
    setSaveStatus("Your saved equation was deleted. Moves already using it stay the same.");
  }

  function handleReloadLatestWorkspace() {
    if (!workspaceConflict) return;
    const latestEvents = workspaceConflict.payload.timelineEdits.filter((event): event is TimelineEventSlot => Boolean(event && typeof event === "object" && typeof (event as { id?: unknown }).id === "string" && typeof (event as { tick?: unknown }).tick === "number"));
    setTimelineEvents(latestEvents);
    setActiveEventId(latestEvents[0]?.id ?? null);
    setSavedEquations(workspaceConflict.payload.equations);
    setHiddenSourceEquationIds(workspaceConflict.payload.hiddenSourceEquationIds);
    workspaceVersionRef.current = workspaceConflict.version;
    setWorkspaceConflict(null);
    setWorkspaceStatus("ready");
    setHasUnsavedChanges(false);
    setSaveStatus("Latest saved copy loaded.");
  }

  function handleKeepLocalWorkspace() {
    setWorkspaceConflict(null);
    setWorkspaceStatus("ready");
    setWorkspaceRetryNonce((current) => current + 1);
    setSaveStatus("Your changes will replace the latest saved copy after you confirm.");
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

    // Demo tutorial step 3: equation assigned to an event, tutorial done.
    setTutorialStep((current) => (current === "add" ? null : current));
    setAuthoredEquationQueue((current) =>
      current.some((entry) => entry.id === equation.id)
        ? current
        : [...current, cloneEquationForAssignment(equation)],
    );

    setTimelineEvents((current) => {
      const nextEvents = current.map((eventSlot) => {
        if (eventSlot.id !== activeEventId) {
          return eventSlot;
        }

        return applyEquationToEvent(eventSlot, equation);
      });

      syncTimelineFilesFromEvents(nextEvents);
      return nextEvents;
    });
    markDirty();
    setCenterChoice(null);
    setIsLibraryPanelOpen(false);
    const activeEventIndex = activeEventId
      ? timelineEvents.findIndex((eventSlot) => eventSlot.id === activeEventId)
      : -1;
    setSaveStatus(
      activeEventIndex >= 0
        ? `Added your equation to this lesson. Every move in ${studentCopy.editor.moveGroup(activeEventIndex + 1)} will use it.`
        : "Added your equation to this lesson. Every move in the selected encounter will use it.",
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

  function handleAddHitPad(
    mechanic: GameplayMechanic,
    instanceIndex: number,
    tokenIndex: number,
    pad: HitBubblePad,
  ) {
    updateActiveMechanicInstance(mechanic, instanceIndex, (instance) => {
      return {
        ...instance,
        // Only keep the newly selected hit token.
        hitBubbles: [{ tokenIndex, positions: [pad], pads: [pad] }],
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
        dragTargets: isSameTokenAlreadySelected ? [] : [{ tokenIndex, sourceHitId: instance.dragTargets[0]?.sourceHitId }],
      };
    });
  }

  function handlePatchSelectedGuidedEncounter(
    instanceId: string,
    patch: Partial<GuidedEncounterInput>,
  ) {
    if (!activeEventId || !selectedCenterContextMechanic || selectedGuidedEncounter?.id !== instanceId) {
      return;
    }

    const { mechanic, instanceIndex } = selectedCenterContextMechanic;

    setTimelineEvents((current) => {
      const nextEvents = current.map((eventSlot) => {
        if (eventSlot.id !== activeEventId) {
          return eventSlot;
        }

        const instances = eventSlot.mechanicInstances[mechanic] ?? [];
        return {
          ...eventSlot,
          mechanicInstances: {
            ...eventSlot.mechanicInstances,
            [mechanic]: instances.map((instance, index) =>
              index === instanceIndex
                ? { ...instance, ...patch, id: instance.id }
                : instance,
            ),
          },
        };
      });

      syncTimelineFilesFromEvents(nextEvents);
      return nextEvents;
    });
    markDirty();
  }

  function handleBackToSongChoice() {
    requestNavigation(() => router.push(`${navBasePath}/song-choice`));
  }

  async function handleLaunchGame(playTemplateOnly = false) {
    if (isSaving) return;
    if (!playTemplateOnly && !lessonPublishReadiness.ready) {
      const blocker = lessonPublishReadiness.blockers[0];
      savePrivateDraft();
      handleSelectReadinessEncounter(blocker.encounterId);
      setSaveStatus(`${studentCopy.editor.draftSaved} ${blocker.message} ${blocker.nextAction}`);
      return;
    }
    if (!selectedSongLaunch) {
      setSaveStatus(studentCopy.editor.pickSongBeforePlay);
      return;
    }

    const strategy = playTemplateOnly ? "published-template" : lessonLaunchStrategy(hasUnsavedChanges);
    let launchAuthorId = lastSavedAuthorId ?? selectedSongAuthorId ?? null;
    let launchRevision = lastSavedRevision;

    if (strategy === "publish-draft") {
      const didSave = await handleSaveToSupabase();

      if (!didSave) {
        setSaveStatus(
          `${studentCopy.editor.lessonSaveFailed} Fix the highlighted move, or play the saved lesson instead.`,
        );
        return;
      }
      launchAuthorId = didSave.authorId;
      launchRevision = didSave.revision;
    }

    try {
      const freshSongLaunch = await requestFreshSongLaunchPackage({
        ...selectedSongLaunch,
        authorId: launchAuthorId,
        authorName: selectedSongLaunch.authorName ?? null,
        revision: launchRevision,
        allowBlankPackage: !loadedSongReadyRef.current && !launchRevision,
      });
      setLessonReadiness(freshSongLaunch.readiness);
      if (!freshSongLaunch.readiness.canLaunch) {
        setSaveStatus(getLearnerFacingError(freshSongLaunch.readiness.message, studentCopy.game.preparingBody));
        return;
      }
      if (freshSongLaunch.readiness.state === "template-fallback") {
        setSaveStatus(getLearnerFacingError(freshSongLaunch.readiness.message, studentCopy.game.preparingBody));
      }
      const launchParams = createSongLaunchSearchParams({
      songAssetId: freshSongLaunch.songAssetId,
      activityKey: freshSongLaunch.activityKey,
      chartUrl: freshSongLaunch.chart.signedUrl,
      sidecarUrl: freshSongLaunch.sidecar.signedUrl,
      audioUrl: freshSongLaunch.audio.signedUrl,
      authorId: freshSongLaunch.authorId,
      revision: freshSongLaunch.revision,
      receipt: freshSongLaunch.receipt,
      rhythmDifficultyKey: freshSongLaunch.rhythmDifficultyKey ?? selectedSongLaunch.rhythmDifficultyKey,
      learningDifficultyKey: freshSongLaunch.learningDifficultyKey,
      source: freshSongLaunch.source === "editor-scaffold" ? undefined : freshSongLaunch.source,
      templateProvenance: freshSongLaunch.templateProvenance,
      launchAttemptId: freshSongLaunch.launchAttemptId,
      });
      const launchRoute = getPlayerLaunchRoute(navBasePath);

      appendSongFlowDebug(
        "lesson-builder:launch:play",
        "Play pressed. Launch URL and params prepared.",
        {
          launchRoute,
          strategy,
          requestedActivityKey: selectedSongLaunch.activityKey,
          launchActivityKey: freshSongLaunch.activityKey,
          launchAuthorId,
          launchRevision,
          source: freshSongLaunch.source,
          hasLaunchAttemptId: Boolean(freshSongLaunch.launchAttemptId),
          hasReceipt: Boolean(freshSongLaunch.receipt),
          hasChart: Boolean(freshSongLaunch.chart.signedUrl),
          hasSidecar: Boolean(freshSongLaunch.sidecar.signedUrl),
          hasAudio: Boolean(freshSongLaunch.audio.signedUrl),
        },
      );

      persistLaunchParams(launchParams);
      router.push(launchRoute);
    } catch (error) {
      setSaveStatus(getLearnerFacingError(error, `${studentCopy.game.prepareErrorTitle}. Try again, or choose another song.`));
    }
  }

  async function handleSaveToSupabase(options: { showNotice?: boolean } = {}) {
    const { showNotice = false } = options;

    if (!selectedSongStorage) {
      setSaveStatus(studentCopy.editor.chooseSong);
      return false;
    }

    setIsSaving(true);
    setSaveStatus("Saving…");

    try {
      const fallbackMetadata = {
        ...metadata,
        uploadedFileName:
          metadata?.uploadedFileName || uploadedSongName || "audio.mp3",
      };

      if (!loadedSongReadyRef.current || loadError) {
        throw new Error(loadError || "Wait for the selected lesson to finish loading before saving.");
      }

      if (!hasUnsavedChanges) {
        const message = studentCopy.editor.noChanges;
        setSaveStatus(message);
        return false;
      }

      const activityKey = selectedSongActivity?.key ?? selectedSongLaunch?.activityKey ?? null;
      if (!activityKey) {
        throw new Error("The selected song activity identity is missing; reload the lesson before saving.");
      }

      const saveEditGeneration = editGenerationRef.current;

      const timelineSidecar = sidecarFromTimelineEvents(timelineEvents, true);
      const authoredClock = createLessonClock(chartFile || originalChartFileRef.current);
      const hasCompleteTimelineBindings = hasCompleteAuthoredEquationBindings(timelineEvents);
      const hasLegacyEncounters = timelineEvents.some(event => event.legacyEncounter);
      const canSaveAsAuthored = (!legacyEncounterSourceRef.current || (!hasLegacyEncounters && authoredEquationQueue.length > 0)) && hasCompleteTimelineBindings;
      if (!canSaveAsAuthored && (authoredEquationQueue.length > 0 || rtcmDraftMechanics.length > 0)) {
        throw new Error("This lesson mixes legacy or unassigned encounters with authored equations. Complete the assignments in an authored lesson before saving to avoid losing equation data.");
      }
      const rtcmEvents: AuthoredTimelineEvent[] = rtcmDraftMechanics.map((draft) => {
        const equation = authoredEquationQueue.find((entry) => entry.id === draft.equationId) ?? null;
        const endSeconds =
          draft.id === rtcmPendingHold?.draftId
            ? Math.max(draft.tick, currentSongSeconds)
            : draft.endTick ?? draft.tick;
        const instance: MechanicInstanceState = {
          id: draft.id,
          tick: draft.tick,
          endTick: endSeconds,
          hitBubbles: draft.hitBubbles,
          spinTargets: draft.spinTargets,
          dragTargets: draft.dragTargets,
        };
        return {
          id: draft.id,
          tick: draft.tick,
          endTick: endSeconds,
          counts: { hit: draft.mechanic === "hit" ? 1 : 0, spin: draft.mechanic === "spin" ? 1 : 0, drag: draft.mechanic === "drag" ? 1 : 0 },
          assignments: {
            hit: draft.mechanic === "hit" ? equation : null,
            spin: draft.mechanic === "spin" ? equation : null,
            drag: draft.mechanic === "drag" ? equation : null,
          },
          mechanicInstances: {
            hit: draft.mechanic === "hit" ? [{ ...instance, equation }] : [],
            spin: draft.mechanic === "spin" ? [{ ...instance, equation }] : [],
            drag: draft.mechanic === "drag" ? [{ ...instance, equation }] : [],
          },
        };
      });
      const authoredSidecar = canSaveAsAuthored
        ? authoredSidecarFromTimelineEvents(
            [...timelineEvents, ...rtcmEvents],
            {
              songAssetId: selectedSongStorage.id,
              activityKey,
              authorId: lastSavedAuthorId,
              revision: lastSavedRevision,
            },
            authoredClock,
            timelineSidecar.stopAtSeconds,
            authoredEquationQueue,
            { forPublish: true, activityKey },
          )
        : null;

      /*
       * IMPORTANT:
       * Imported charts retain their source document. The serializer patches
       * supported Expert notes only, preserving other difficulties and metadata.
       * Without that source document, keep the original chart bytes.
       */
      const chartText = project?.sourceChart ? projectToChart(project) : originalChartFileRef.current;

      if (!chartText.trim()) {
        throw new Error("Cannot save lesson: original chart content is empty.");
      }

      const legacySource = legacyEncounterSourceRef.current;
      const legacyTimeline = { version: 1 as const, events: timelineSidecar.events, stopAtSeconds: timelineSidecar.stopAtSeconds };
      const sidecarToPersist = legacySource && !authoredSidecar
        ? {
            ...persistLegacyEncounters(legacySource, timelineEvents, authoredClock.toTick),
            events: legacyTimeline.events.filter(event => !(event.type === "ALG_EVENT_SLOT" && event.legacyEncounter)),
            stopAtSeconds: legacyTimeline.stopAtSeconds,
          }
        : authoredSidecar ?? legacyTimeline;
      const sidecarJson = JSON.stringify(sidecarToPersist, null, 2);
      validateLessonContent(chartText, sidecarJson, { forSave: true });
      if (!selectedSongStorage.sidecar) {
        throw new Error("The selected song activity does not have a complete save package.");
      }

      appendSongFlowDebug("lesson-builder:save:start", "Saving edited chart and sidecar back to Supabase.", {
        songAssetId: selectedSongStorage.id,
        chartPath: selectedSongStorage.chart.path,
        sidecarPath: selectedSongStorage.sidecar.path,
        chartLength: chartText.length,
        sidecarEventCount: timelineSidecar.events.length,
      });

      const publicationRequestId = publicationRequestIdRef.current ?? crypto.randomUUID();
      publicationRequestIdRef.current = publicationRequestId;
      const response = await fetch("/api/lesson-builder/save", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": publicationRequestId,
        },
        body: JSON.stringify({
          songAssetId: selectedSongStorage.id,
          activityKey,
          authorId: lastSavedAuthorId ?? selectedSongAuthorId ?? undefined,
          authorName: selectedSongAuthorName ?? undefined,
          revision: lastSavedRevision ?? undefined,
          publicationRequestId,
          chart: selectedRhythmSource
            ? undefined
            : {
                ...selectedSongStorage.chart,
                path: selectedSongStorage.chart.path,
                content: chartText,
                contentType:
                  selectedSongStorage.chart.contentType ??
                  "text/plain;charset=utf-8",
              },
          rhythmSource: selectedRhythmSource
            ? {
                activityKey: selectedRhythmSource.activityKey,
                revision: selectedRhythmSource.revision,
              }
            : undefined,
          sidecar: {
            ...selectedSongStorage.sidecar,
            path: selectedSongStorage.sidecar.path,
            content: sidecarJson,
            contentType:
              selectedSongStorage.sidecar?.contentType ??
              "application/json;charset=utf-8",
          },
        }),
      });

      const result = (await response.json().catch(() => null)) as {
        error?: string;
        chart?: { bucket?: string; path?: string };
        sidecar?: { bucket?: string; path?: string };
        authorId?: string;
        revision?: string;
      } | null;

      if (!response.ok) {
        appendSongFlowDebug("lesson-builder:save:failed", "The server rejected this save.", {
          status: response.status, error: result?.error, sidecarVersion: sidecarToPersist.version,
        });
        throw new Error(result?.error ?? "Unable to save lesson files");
      }

      const savedChartPath = result?.chart?.path ?? null;
      const savedSidecarPath = result?.sidecar?.path ?? null;

      if (!result?.authorId || !result.revision) {
        throw new Error("Saved lesson identity could not be verified");
      }
      const publishedCurrentSnapshot = editGenerationRef.current === saveEditGeneration;
      if (publishedCurrentSnapshot && workspaceSource) deletePlayerLessonWorkspaceDraft(sessionStorage, workspaceSource);
      setLastSavedAuthorId(result.authorId);
      setLastSavedRevision(result.revision);
      setSelectedRhythmSource(null);

      if (
        !savedChartPath ||
        !savedSidecarPath ||
        !result?.chart?.bucket ||
        !result?.sidecar?.bucket
      ) {
        throw new Error("Saved files could not be verified");
      }

      setSelectedSongStorage((current) =>
        current?.id === selectedSongStorage.id
          ? {
              ...current,
              chart: {
                ...current.chart,
                bucket: result.chart!.bucket!,
                path: savedChartPath,
              },
              sidecar: current.sidecar
                ? {
                    ...current.sidecar,
                    bucket: result.sidecar!.bucket!,
                    path: savedSidecarPath,
                  }
                : null,
            }
          : current,
      );

      appendSongFlowDebug("lesson-builder:save:complete", "Supabase save completed successfully.", {
        songAssetId: selectedSongStorage.id,
        activityKey,
        authorId: result.authorId,
        revision: result.revision,
        hasChartPath: Boolean(savedChartPath),
        hasSidecarPath: Boolean(savedSidecarPath),
      });

      if (publishedCurrentSnapshot) {
        setChartFile(chartText);
        setStoreSidecar(sidecarToPersist as StoreSidecarPayload);
        setSaveStatus(studentCopy.editor.changesSaved);
        setHasUnsavedChanges(false);
      } else {
        setSaveStatus(studentCopy.editor.newerChangesRemain);
        setHasUnsavedChanges(true);
      }
      publicationRequestIdRef.current = null;
      setLessonReadiness({
        state: "ready",
        source: "authored",
        canLaunch: true,
        message: "Your saved lesson is ready to play.",
      });

      if (showNotice) {
        const activityLabel = getActivityLabel(activityKey);
        const songLabel =
          metadata?.songTitle?.trim() || uploadedSongName || "Selected song";

        setSaveStatus(studentCopy.editor.savedSnapshot(songLabel, activityLabel));
      }

      return { authorId: result.authorId, revision: result.revision };
    } catch (error) {
      const reason = getLearnerFacingError(error, studentCopy.editor.lessonSaveFailed);
      appendSongFlowDebug("lesson-builder:save:error", "Lesson save failed.", {
        message: error instanceof Error ? error.message : String(error),
      });
      setSaveStatus(`${reason}${workspaceSource && guidedStarted ? " A backup stays in this browser." : ""}`);
      return false;
    } finally {
      setIsSaving(false);
    }
  }

  function buildSelectedSongPayloadFromChoice(
    song: SongChoiceOption,
  ): SelectedSongPayload {
    const rhythmSource = song.rhythmSources?.find(
      (source) => source.revision === filePickerRhythmSourceRevision,
    ) ?? null;
    const chart = rhythmSource?.chart ?? song.chart;
    return {
      id: song.id,
      name: song.name,
      title: song.title,
      artist: song.artist,
      authorName: song.authorName ?? filePickerAuthorName ?? null,
      rhythmSource,
      activity: {
        key: song.activityKey,
        label: getActivityLabel(song.activityKey),
      },
      song: {
        bucket: song.song.bucket,
        path: song.song.path,
        signedUrl: song.song.signedUrl,
        contentType: song.song.contentType,
      },
      chart: {
        bucket: chart.bucket,
        path: chart.path,
        signedUrl: chart.signedUrl,
        contentType: chart.contentType,
      },
      sidecar: song.sidecar
        ? {
          bucket: song.sidecar.bucket,
          path: song.sidecar.path,
          signedUrl: song.sidecar.signedUrl,
          contentType: song.sidecar.contentType,
        }
        : null,
    };
  }

  async function fetchSongChoicesForActivity(
    authorName: string,
    activityKey: SongActivityKey,
  ) {
    setIsFilePickerLoading(true);
    setFilePickerError("");
    setFilePickerRhythmSourceRevision(null);

    try {
      const response = await fetch(
        `/api/song-choice?activity=${encodeURIComponent(activityKey)}&context=editor&author=${encodeURIComponent(authorName)}`,
      );
      const payload = (await response.json().catch(() => null)) as {
        songs?: SongChoiceOption[];
        error?: string;
      } | null;

      if (!response.ok || !payload?.songs) {
        throw new Error(payload?.error ?? "Unable to load songs for activity");
      }

      const availableSongs = payload.songs;

      setFilePickerSongs(availableSongs);
      setFilePickerSongId((current) => {
        if (current && availableSongs.some((song) => song.id === current)) {
          return current;
        }

        if (
          selectedSongStorage &&
          availableSongs.some((song) => song.id === selectedSongStorage.id)
        ) {
          return selectedSongStorage.id;
        }

        return availableSongs[0]?.id ?? null;
      });
    } catch (error) {
      setFilePickerSongs([]);
      setFilePickerSongId(null);
      setFilePickerError(
        error instanceof Error ? error.message : "Unable to load songs",
      );
    } finally {
      setIsFilePickerLoading(false);
    }
  }

  async function fetchSongChartAuthors() {
    setIsFilePickerAuthorsLoading(true);

    try {
      const response = await fetch("/api/song-choice?context=authors");
      const payload = (await response.json().catch(() => null)) as {
        authors?: SongChartAuthorOption[];
        error?: string;
      } | null;

      if (!response.ok || !payload?.authors) {
        throw new Error(payload?.error ?? "Unable to load chart authors");
      }

      const authors = payload.authors;

      setFilePickerAuthors(authors);
      // Default to the dev author (listed first) so the directory is
      // pre-selected and its charts load immediately.
      setFilePickerAuthorName((current) =>
        current && authors.some((author) => author.name === current)
          ? current
          : authors[0]?.name ?? null,
      );
    } catch (error) {
      setFilePickerAuthors([]);
      setFilePickerAuthorName(null);
      setFilePickerError(
        error instanceof Error ? error.message : "Unable to load chart authors",
      );
    } finally {
      setIsFilePickerAuthorsLoading(false);
    }
  }

  function handleOpenFilePicker() {
    setIsFilePickerOpen(true);
    setFilePickerError("");
    void fetchSongChartAuthors();

    if (selectedSongActivity?.key) {
      setFilePickerActivityKey(selectedSongActivity.key);
      return;
    }

    const inferredActivity = normalizeSongActivityKey(
      inferSongActivityKeyFromChartPath(selectedSongStorage?.chart.path ?? ""),
    );

    setFilePickerActivityKey(inferredActivity ?? defaultSongActivityKey);
  }

  function hydrateSelectedSong(selectedSong: SelectedSongPayload) {
    const generation = ++lessonLoadGenerationRef.current;
    lessonLoadAbortRef.current?.abort();
    const controller = new AbortController();
    lessonLoadAbortRef.current = controller;
    loadedSongReadyRef.current = false;
    legacyEncounterSourceRef.current = null;
    setIsReadinessOpen(false);
    setIsLibraryPanelOpen(false);
    setLessonReadiness(null);
    setIsLessonLoaded(false);
    setSaveStatus("Loading your lesson…");
    appendSongFlowDebug(
      "lesson-builder:session:selected-song",
      "Hydrated selected song payload from session storage.",
      {
        selectedSongId: selectedSong.id,
        requestedActivityKey: selectedSong.activity?.key ?? null,
        revision: selectedSong.revision ?? null,
        hasChart: Boolean(selectedSong.chart.signedUrl),
        hasSidecar: Boolean(selectedSong.sidecar?.signedUrl),
      },
    );

    const storedActivityRaw = sessionStorage.getItem("selectedDashboardActivity");
    let storedActivity: { key?: string; label?: string } | null = null;

    if (storedActivityRaw) {
      try {
        storedActivity = JSON.parse(storedActivityRaw) as {
          key?: string;
          label?: string;
        };
      } catch {
        storedActivity = null;
      }
    }

    let requestedActivityKey: SongActivityKey | null = null;
    let activityIdentitySource = "none";
    let resolvedPackage: ReturnType<
      typeof resolveRequestedSongActivityPackage
    >;

    try {
      const storedActivityKey = normalizeSongActivityKey(storedActivity?.key);
      const payloadActivityKey = normalizeSongActivityKey(selectedSong.activity?.key);
      if (storedActivityKey && payloadActivityKey && storedActivityKey !== payloadActivityKey) {
        throw new Error(
          `Current activity ${storedActivityKey} does not match the selected song payload activity ${payloadActivityKey}. Reload the lesson from Song Choice.`,
        );
      }
      const identity = resolveSongActivityIdentity({
        sessionActivityKey: storedActivityKey,
        selectedPayloadActivityKey: payloadActivityKey,
        chartPath: selectedSong.chart.path,
      });
      requestedActivityKey = identity.activityKey;
      activityIdentitySource = identity.source;
      if (!requestedActivityKey) {
        throw new Error("Selected song package is missing an explicit activity identity.");
      }
      resolvedPackage = resolveRequestedSongActivityPackage({
        requestedActivityKey,
        chartPath: selectedSong.chart.path,
        sidecarPath: selectedSong.sidecar?.path ?? null,
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Selected song package is invalid";

      appendSongFlowDebug(
        "lesson-builder:activity:contract-rejected",
        "Rejected a selected song package whose activity contract could not be resolved.",
        {
          selectedSongId: selectedSong.id,
          requestedActivityKey,
          identitySource: activityIdentitySource,
          message,
        },
      );
      setSelectedSongStorage(null);
      setSelectedSongLaunch(null);
      setSelectedSongActivity(null);
      setLoadError(message);
      setLessonReadiness({
        state: "repairable",
        source: "authored",
        canLaunch: false,
        message: `This lesson needs a quick fix before it can play: ${message}`,
      });
      return;
    }

    const resolvedActivityKey = resolvedPackage.activityKey;
    const resolvedActivityLabel =
      selectedSong.activity?.label ??
      storedActivity?.label ??
      getActivityLabel(resolvedActivityKey);

    setLoadError("");

    setSelectedSongActivity({
      key: resolvedActivityKey,
      label: resolvedActivityLabel,
    });
    setFilePickerActivityKey(resolvedActivityKey);
    setSelectedSongAuthorId(selectedSong.authorId ?? null);
    setLastSavedAuthorId(selectedSong.authorId ?? null);
    setLastSavedRevision(
      selectedSong.rhythmSource
        ? null
        : selectedSong.revision ?? extractRevisionFromStoragePath(selectedSong.chart.path),
    );
    setSelectedRhythmSource(selectedSong.rhythmSource ?? null);
    setSelectedSongAuthorName(selectedSong.authorName ?? null);
    if (selectedSong.authorName) {
      setFilePickerAuthorName(selectedSong.authorName);
    }

    appendSongFlowDebug(
      "lesson-builder:activity:contract-check",
      "Validated the selected activity identity before fetching the immutable lesson references.",
      {
        selectedSongId: selectedSong.id,
        selectedSongName: selectedSong.name,
        requestedActivityKey,
        payloadActivityKey: normalizeSongActivityKey(selectedSong.activity?.key),
        storedActivityKey: normalizeSongActivityKey(storedActivity?.key),
        identitySource: activityIdentitySource,
        resolvedActivityKey,
        revision: selectedSong.revision ?? extractRevisionFromStoragePath(selectedSong.chart.path),
        source: "selected-song-session",
      },
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

    setSelectedSongLaunch({
      songAssetId: selectedSong.id,
      activityKey: resolvedActivityKey,
      authorName: selectedSong.authorName ?? null,
      rhythmDifficultyKey: selectedSong.rhythmDifficultyKey ?? selectedSong.rhythm_difficulty_key ?? undefined,
      chartUrl: selectedSong.chart.signedUrl,
      sidecarUrl: selectedSong.sidecar?.signedUrl ?? null,
      audioUrl: selectedSong.song.signedUrl,
    });

    setUploadedSongName(selectedSong.name);
    setMetadata((current) => ({
      ...current,
      songTitle: selectedSong.title ?? selectedSong.name,
      artist: selectedSong.artist ?? current?.artist,
      uploadedFileName: selectedSong.song.path,
    }));

    const selectedSongMetadata = {
      songTitle: selectedSong.title ?? selectedSong.name,
      artist: selectedSong.artist ?? undefined,
      uploadedFileName: selectedSong.song.path,
    };
    const initialRefs = {
      audioUrl: selectedSong.song.signedUrl,
      chartUrl: selectedSong.chart.signedUrl,
      sidecarUrl: selectedSong.sidecar?.signedUrl ?? null,
    };

    void loadLessonAssets({
      refs: initialRefs,
      signal: controller.signal,
      fetchAudio: (url, signal) => fileFromSignedUrl({
        signedUrl: url,
        path: selectedSong.song.path,
        name: selectedSong.name,
        contentType: selectedSong.song.contentType,
        debugLabel: "audio",
        signal,
      }),
      fetchChart: (url, signal) => textFromSignedUrl(url, signal),
      fetchSidecar: (url, signal) => selectedSong.sidecar
        ? jsonFromSignedUrl(url, signal)
        : Promise.resolve(emptySidecar),
      refresh: async () => {
        const revision = selectedSong.revision ?? extractRevisionFromStoragePath(selectedSong.chart.path);
        if (!revision) return null;
        const fresh = await requestFreshSongLaunchPackage({
          songAssetId: selectedSong.id,
          activityKey: resolvedActivityKey,
          authorId: selectedSong.authorId ?? null,
          authorName: selectedSong.authorName ?? null,
          revision,
          allowBlankPackage: false,
          rhythmDifficultyKey: selectedSong.rhythmDifficultyKey ?? selectedSong.rhythm_difficulty_key ?? undefined,
        });
        if (fresh.revision !== revision) {
          throw new Error("Lesson refresh returned a different revision; reload the lesson before editing.");
        }
        if (selectedSong.authorId && fresh.authorId !== selectedSong.authorId) {
          throw new Error("Lesson refresh returned a different author package; reload the lesson before editing.");
        }
        return {
          audioUrl: fresh.audio.signedUrl,
          chartUrl: fresh.chart.signedUrl,
          sidecarUrl: fresh.sidecar.signedUrl,
        };
      },
    })
      .then(({ audio, chart, sidecar, urls, retried }) => {
        if (generation !== lessonLoadGenerationRef.current || controller.signal.aborted) return;
        appendSongFlowDebug(
          "lesson-builder:hydrate:fetch-results",
          "Loaded the audio, chart, and sidecar as one lesson package.",
          {
            retried,
            chartPath: selectedSong.chart.path,
            sidecarPath: selectedSong.sidecar?.path ?? null,
          },
        );

        if (!chart.trim()) {
          throw new Error(
            "We could not load the original lesson file. Your current work is still here.",
          );
        }
        validateLessonContent(chart, JSON.stringify(sidecar), { forSave: true });
        const nextChartName = selectedSong.chart.path.split("/").pop() ?? "selected.chart";
        const normalizedSidecar = mergeTimelineSidecarSources(
          sidecar ?? emptySidecar,
          chart,
          selectedSongMetadata,
        );
        const sidecarActivityKey = normalizeSongActivityKey(
          normalizedSidecar.authoredSource?.activityKey ?? null,
        );
        if (sidecarActivityKey) {
          assertSongActivityMatches({
            expectedActivityKey: resolvedActivityKey,
            actualActivityKey: sidecarActivityKey,
            boundary: "lesson-sidecar",
          });
        }

        originalChartFileRef.current = chart;
        setChartFile(chart);
        setUploadedChartName(nextChartName);
        loadSidecarIntoTimeline(normalizedSidecar, null, [], [], "event", chart);
        setPendingSongFile(audio);
        if (retried) {
          setSelectedSongLaunch((current) => current ? {
            ...current,
            audioUrl: urls.audioUrl,
            chartUrl: urls.chartUrl,
            sidecarUrl: urls.sidecarUrl,
          } : current);
        }
        loadedSongReadyRef.current = true;
        setIsLessonLoaded(true);
        setSaveStatus(studentCopy.editor.lessonLoaded);
        setLessonReadiness({
          state: "ready",
          source: "authored",
          canLaunch: true,
          message: studentCopy.editor.readyToPlay,
        });

        setProject(chartToProject({
          chartFile: chart,
          analysisMetadata: selectedSongMetadata,
          rawResults: normalizedSidecar,
        }));
      })
      .catch((error) => {
        if (generation !== lessonLoadGenerationRef.current || controller.signal.aborted) return;
        loadedSongReadyRef.current = false;
        setIsLessonLoaded(false);
        console.error("Failed to hydrate selected lesson", error);
        const message = getLearnerFacingError(error, studentCopy.editor.lessonLoadFailed);
        setLoadError(message);
        setSaveStatus(studentCopy.editor.lessonLoadFailed);
        setLessonReadiness({
          state: "repairable",
          source: "authored",
          canLaunch: false,
          message: `This lesson could not be read. It has not been replaced: ${message}`,
        });
      });
  }

  function savePrivateDraft() {
    try {
      if (workspaceSource && typeof window !== "undefined") {
        writePlayerLessonWorkspaceDraft(sessionStorage, {
          version: 1,
          source: workspaceSource,
          timelineEvents,
          equationEdits: savedEquations,
          hiddenSourceEquationIds,
          updatedAt: Date.now(),
        });
      }
      setSaveStatus(studentCopy.editor.draftSaved);
      return true;
    } catch {
      setSaveStatus(studentCopy.editor.draftRecoveryFailed);
      return false;
    }
  }

  async function handlePublishChanges(options: { showNotice?: boolean } = {}) {
    if (!lessonPublishReadiness.ready) {
      const blocker = lessonPublishReadiness.blockers[0];
      savePrivateDraft();
      handleSelectReadinessEncounter(blocker.encounterId);
      setSaveStatus(`${studentCopy.editor.draftSaved} ${blocker.message} ${blocker.nextAction}`);
      return false;
    }

    return handleSaveToSupabase(options);
  }

  function handleRetryCurrentLesson() {
    const stored = window.sessionStorage.getItem("ultrarapid_selected_song");
    if (!stored) {
      handleOpenFilePicker();
      return;
    }

    try {
      hydrateSelectedSong(JSON.parse(stored) as SelectedSongPayload);
    } catch {
      handleOpenFilePicker();
    }
  }

  function handleLoadSongFromFilePicker() {
    if (!filePickerSongId) {
      return;
    }

    const selectedSong = filePickerSongs.find((song) => song.id === filePickerSongId);

    if (!selectedSong) {
      setFilePickerError("Select a song to continue.");
      return;
    }

    if (
      selectedSong.requiresRhythmSource &&
      !selectedSong.rhythmSources?.some((source) => source.revision === filePickerRhythmSourceRevision)
    ) {
      setFilePickerError("Choose a verified rhythm source before creating this Number Bonds lesson.");
      return;
    }

    const selectedSongPayload = buildSelectedSongPayloadFromChoice(
      selectedSong,
    );

    window.sessionStorage.setItem(
      "ultrarapid_selected_song",
      JSON.stringify(selectedSongPayload),
    );
    window.sessionStorage.setItem(
      "selectedDashboardActivity",
      JSON.stringify({
        key: filePickerActivityKey,
        label: getActivityLabel(filePickerActivityKey),
      }),
    );

    hydrateSelectedSong(selectedSongPayload);
    setIsFilePickerOpen(false);
    setSaveStatus(
      `Loaded ${selectedSong.name} (${getActivityLabel(filePickerActivityKey)}).`,
    );
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
    const intent = sessionStorage.getItem("ultrarapid_player_entry_intent");
    if (intent === "personalize" || intent === "play") setEntryIntent(intent);
  }, []);

  useEffect(() => {
    const raw = sessionStorage.getItem("ultrarapid_selected_song");

    if (!raw) {
      return;
    }

    try {
      const selectedSong: SelectedSongPayload = JSON.parse(raw);
      hydrateSelectedSong(selectedSong);
    } catch (error) {
      console.error("Failed to parse selected song package", error);
      appendSongFlowDebug("lesson-builder:session:parse-error", "Failed to parse the selected song payload from session storage.", {
        message: error instanceof Error ? error.message : String(error),
        hasStoredPayload: Boolean(raw),
      });
      setLoadError(
        error instanceof Error
          ? error.message
          : "Failed to parse selected song package",
      );
    }
  }, [setProject]);

  useEffect(() => {
    if (!isFilePickerOpen || !filePickerAuthorName) {
      return;
    }

    void fetchSongChoicesForActivity(filePickerAuthorName, filePickerActivityKey);
  }, [filePickerAuthorName, filePickerActivityKey, isFilePickerOpen]);

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
        originalChartFileRef.current = payload.chartFile;
        setChartFile(payload.chartFile);

        if (payload.analysisMetadata?.uploadedFileName) {
          setUploadedChartName(payload.analysisMetadata.uploadedFileName);
        }

        loadSidecarIntoTimeline(normalizedSidecar, null, [], [], "event", payload.chartFile);
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

  // Event selection is intentionally manual.
  // Playback and playhead movement should not force-select an event.

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

    const finalEndTick = Number(currentSongSeconds.toFixed(3));

    setTimelineEvents((current) => {
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

          return {
            ...instance,
            endTick: Math.max(pendingRangeSelection.startTick, finalEndTick),
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

      syncTimelineFilesFromEvents(nextEvents);
      return nextEvents;
    });

    setPendingRangeSelection(null);
  }

  function handleFinalizeAnyPendingHold() {
    handleFinalizePendingRangeSelection();
    handleFinalizeRtcmHold();
  }

  function handleFinalizeTimelineInteraction() {
    if (rtcmEventRangeStartTick !== null) {
      handleFinalizeRtcmEventCreation({
        rctm2Number:
          mode === "rctm2" && rctm2PendingEventNumber !== null
            ? rctm2PendingEventNumber
            : undefined,
      });
      return;
    }

    handleFinalizeAnyPendingHold();
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
    markDirty();
    const nextSidecar = sidecarFromTimelineEvents(nextEvents);
    timelineRehydrateSourceRef.current = nextSidecar;

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
      setSaveStatus(studentCopy.editor.changesSaved);
    } catch (error) {
      console.error("Failed to update chart after timeline edit", error);
      setSaveStatus(studentCopy.editor.lessonSaveFailed);
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

  function handleRetimeEventEdge(
    eventId: string,
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

        const currentStartTick = Number(eventSlot.tick.toFixed(3));
        const currentEndTick = Number(
          (
            typeof eventSlot.endTick === "number"
              ? eventSlot.endTick
              : getTimelineEventTimeWindowSeconds(eventSlot).endSeconds
          ).toFixed(3),
        );

        didUpdate = true;

        if (edge === "start") {
          const clampedStartTick = Math.min(nextTick, currentEndTick);

          return {
            ...eventSlot,
            tick: clampedStartTick,
            endTick: currentEndTick,
          };
        }

        const clampedEndTick = Math.max(nextTick, currentStartTick);

        return {
          ...eventSlot,
          endTick: clampedEndTick,
        };
      });

      if (!didUpdate) {
        return current;
      }

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
        setSaveStatus("Encounter not added: the playhead is already inside another encounter.");
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

      const nextEvents = current.filter((eventSlot) => eventSlot.id !== activeEventId).sort(
        (left, right) => timelineTickToSeconds(left.tick) - timelineTickToSeconds(right.tick),
      );
      const nextActiveEvent = nextEvents[Math.min(selectedIndex, nextEvents.length - 1)] ?? null;

      setActiveEventId(nextActiveEvent?.id ?? null);
      syncTimelineFilesFromEvents(nextEvents);

      return nextEvents;
    });
  }

  function handleAddMechanicAtPlayhead(
    mechanic: GameplayMechanic,
    options: {
      allowActiveEvent?: boolean;
      allowPlayheadEvent?: boolean;
      draftIfNoEvent?: boolean;
      hitPad?: HitBubblePad;
    } = {},
  ) {
    const capabilities = getActivityAuthoringCapabilities(
      selectedSongActivity?.key ?? selectedSongLaunch?.activityKey,
    );
    if (!capabilities.supportedAuthoredMechanics.includes(mechanic)) {
      setSaveStatus(
        `${studentCopy.mechanics[mechanic]} is generated by the Number Bonds runtime; add a Hit cue instead.`,
      );
      return;
    }
    const allowActiveEvent = options.allowActiveEvent ?? true;
    const allowPlayheadEvent = options.allowPlayheadEvent ?? true;
    const draftIfNoEvent = options.draftIfNoEvent ?? false;
    const mechanicSeconds = currentSongSeconds;
    const mechanicTick = Number(mechanicSeconds.toFixed(3));
    let nextAddedInstanceId: string | null = null;

    setTimelineEvents((current) => {
      const selectedEvent =
        allowActiveEvent && activeEventId
          ? current.find((eventSlot) => eventSlot.id === activeEventId) ?? null
          : null;
      const playheadEvent =
        allowPlayheadEvent ? findTimelineEventAtSeconds(current, mechanicSeconds) : null;
      const targetEvent =
        selectedEvent ??
        playheadEvent ??
        (draftIfNoEvent ? null : makeTimelineEvent(current.length, mechanicTick));
      const baseEvents = selectedEvent || playheadEvent
        ? current
        : targetEvent
          ? [...current, targetEvent].sort(
            (left, right) =>
              timelineTickToSeconds(left.tick) - timelineTickToSeconds(right.tick),
          )
          : current;

      if (!targetEvent) {
        addRtcmDraftMechanic(mechanic, mechanicSeconds, {
          hitPad: options.hitPad,
        });
        return current;
      }

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
          ...(mechanic === "hit" && options.hitPad
            ? {
              hitBubbles: [
                {
                  tokenIndex: 0,
                  positions: [options.hitPad],
                  pads: [options.hitPad],
                },
              ],
            }
            : {}),
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
        `${studentCopy.mechanics[mechanic]} added at ${formatSongTime(mechanicSeconds, isAdvancedMode)}.`,
      );

      return nextEvents;
    });
  }

  function handleAddHitAtPlayhead() {
    handleAddMechanicAtPlayhead("hit");
  }

  function handleRtcmAddHitAtPlayhead(hitPad: HitBubblePad) {
    handleAddMechanicAtPlayhead("hit", {
      allowActiveEvent: false,
      allowPlayheadEvent: true,
      draftIfNoEvent: true,
      hitPad,
    });
  }

  function handleAddSpinAtPlayhead() {
    handleAddMechanicAtPlayhead("spin");
  }

  function handleRtcmStartSpinAtPlayhead() {
    handleStartRtcmHold("spin");
  }

  function handleAddDragAtPlayhead() {
    handleAddMechanicAtPlayhead("drag");
  }

  function handleRtcmStartDragAtPlayhead() {
    handleStartRtcmHold("drag");
  }

  function handleAddRctm2TimelineMarker(
    mechanic: "hit" | "drag",
    point: Rctm2Point,
  ) {
    if (mechanic === "hit") {
      const draftId = addRtcmDraftMechanic("hit", currentSongSeconds);
      setRctm2HitPlacements((current) => ({
        ...current,
        [draftId]: point,
      }));
    }
  }

  function handleBeginRctm2DragMarker(startPoint: Rctm2Point, sourceHitId: string) {
    const draftId = addRtcmDraftMechanic("drag", currentSongSeconds, {
      endSeconds: currentSongSeconds,
    });

    setRctm2DragStartPoints((current) => ({
      ...current,
      [draftId]: startPoint,
    }));
    setRctm2DragSourceHitIds((current) => ({
      ...current,
      [draftId]: sourceHitId,
    }));

    return draftId;
  }

  function handleCompleteRctm2DragMarker(draftId: string, zone: Rctm2BondZone) {
    const endTick = Number(currentSongSeconds.toFixed(3));
    const tokenIndex = zone === "leftBond" ? 0 : 1;
    const sourceHitId = rctm2DragSourceHitIds[draftId];

    setRtcmDraftMechanics((current) =>
      current.map((draft) => {
        if (draft.id !== draftId || draft.mechanic !== "drag") {
          return draft;
        }

        return {
          ...draft,
          endTick: Math.max(draft.tick, endTick),
          dragTargets: [{ tokenIndex, ...(sourceHitId ? { sourceHitId } : {}) }],
        };
      }),
    );
  }

  function handleCancelRctm2DragMarker(draftId: string) {
    setRtcmDraftMechanics((current) =>
      current.filter((draft) => draft.id !== draftId),
    );
    setRctm2DragStartPoints((current) => {
      const next = { ...current };
      delete next[draftId];
      return next;
    });
    setRctm2DragSourceHitIds((current) => {
      const next = { ...current };
      delete next[draftId];
      return next;
    });
  }

  function extractDraftMechanicsFromEvent(eventSlot: TimelineEventSlot) {
    const extractedDrafts: RtcmDraftMechanic[] = [];

    gameplayMechanics.forEach((mechanic) => {
      const count = Math.max(0, eventSlot.counts?.[mechanic] ?? 0);
      const instances = resizeMechanicInstances(
        eventSlot.mechanicInstances?.[mechanic],
        count,
      );

      for (let index = 0; index < count; index += 1) {
        const instance = instances[index];
        const tick = Number((instance.tick ?? eventSlot.tick).toFixed(3));
        const rawEndTick = Number((instance.endTick ?? tick).toFixed(3));

        extractedDrafts.push({
          id: makeId("rtcm"),
          mechanic,
          tick,
          ...(mechanic === "hit" ? {} : { endTick: Math.max(tick, rawEndTick) }),
          hitBubbles: instance.hitBubbles ?? [],
          spinTargets: instance.spinTargets ?? [],
          dragTargets: instance.dragTargets ?? [],
        });
      }
    });

    return extractedDrafts;
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
        setSaveStatus(studentCopy.editor.noMoveToRemove(studentCopy.mechanics[mechanic]));
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
        `${studentCopy.mechanics[mechanic]} removed near ${formatSongTime(targetSeconds)}.`,
      );

      return nextEvents;
    });
  }

  function handleDownloadTimelineFiles() {
    const currentSidecar = sidecarFromTimelineEvents(timelineEvents, true);
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
    setSaveStatus("Lesson files downloaded.");
  }

  useEffect(() => {
    if (mode === "rctm1" || mode === "rctm2") {
      setActiveEventId(null);
    }
  }, [mode]);

  const isTimelineInstructionVisible = centerChoice !== null;
  const showCenterWorkspacePrompt =
    chartFile.trim().length === 0 && sidecar.events.length === 0;
  const isRctm1Mode = mode === "rctm1";
  const isRctm2Mode = mode === "rctm2";
  const rtcmPlayheadEvent = findTimelineEventAtSeconds(
    timelineEvents,
    currentSongSeconds,
  );
  const rtcmDeleteTargetEventId = getRctmDeleteTargetEventId({
    mode,
    activeEventId,
    playheadEventId: rtcmPlayheadEvent?.id ?? null,
    eventIds: timelineEvents.map((eventSlot) => eventSlot.id),
  });
  const dragSources = useMemo(
    () => timelineEvents.flatMap((eventSlot) =>
      (eventSlot.mechanicInstances.hit ?? []).map((instance, index) => ({
        id: instance.id,
        label: `Hit ${index + 1} · ${formatTimelineTime(timelineTickToSeconds(instance.tick ?? eventSlot.tick), isAdvancedMode)}`,
      })),
    ),
    [isAdvancedMode, timelineEvents],
  );
  function handleSelectReadinessEncounter(encounterId: string) {
    const selection = findGuidedEncounterSelection(
      timelineEvents as unknown as AuthoredTimelineEvent[],
      encounterId,
    );
    if (!selection) return;

    setActiveEventId(selection.eventId);
    setSelectedContextMechanicKey(`${selection.mechanic}:${selection.instanceIndex}`);
    setCenterChoice(null);
    seekSong(timelineTickToSeconds(selection.tick));
    setIsReadinessOpen(false);
    const blocker = lessonPublishReadiness.blockers.find((item) => item.encounterId === encounterId);
    const mechanicLabel = selection.mechanic[0].toUpperCase() + selection.mechanic.slice(1);
    setSaveStatus(
      `Editing ${mechanicLabel} ${selection.instanceIndex + 1} on the timeline. ${blocker?.nextAction ?? "Adjust its timing, then check readiness again."}`,
    );
  }
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
        selectedSongTitle={
          metadata?.songTitle?.trim() || uploadedSongName || "Pick a song"
        }
        selectedSongArtist={metadata?.artist?.trim() || "Artist not listed"}
        selectedActivityLabel={
          selectedSongActivity?.label ?? getActivityLabel(defaultSongActivityKey)
        }
        selectedActivityKey={selectedSongActivity?.key ?? null}
        isSaving={isSaving}
        onNavigateHome={() => requestNavigation(() => router.push(navBasePath))}
        onOpenFile={handleOpenFilePicker}
        onLaunch={handleLaunchGame}
        onSave={() => {
          void handlePublishChanges({ showNotice: true });
        }}
        canLaunch={Boolean(selectedSongLaunch) && isLessonLoaded && !loadError && lessonPublishReadiness.ready}
        canPublish={Boolean(selectedSongStorage) && isLessonLoaded && !loadError && lessonPublishReadiness.ready}
        isRctm1Mode={isRctm1Mode}
        isRctm2Mode={isRctm2Mode}
        hideChartmaker={isGuidedStart}
        onToggleRctm1Mode={handleToggleRctm1Mode}
        onToggleRctm2Mode={handleToggleRctm2Mode}
      />
      {needsReadinessCheck && !isGuidedStart && !isRctm1Mode && !isRctm2Mode ? (
        <div
          style={{
            position: "fixed",
            right: "clamp(18px, calc(8vw + 150px), 260px)",
            top: 8,
            width: "min(320px, calc(100vw - 36px))",
            zIndex: 1002,
          }}
        >
          <EncounterReadinessPanel
            readiness={lessonPublishReadiness}
            hasSong={Boolean(selectedSongStorage || selectedSongLaunch)}
            canPublish={Boolean(selectedSongStorage) && isLessonLoaded && !loadError && lessonPublishReadiness.ready}
            canPlay={Boolean(selectedSongLaunch) && isLessonLoaded && !loadError && lessonPublishReadiness.ready}
            onSelectEncounter={handleSelectReadinessEncounter}
            isOpen={isReadinessOpen}
            onToggle={() => setIsReadinessOpen((current) => !current)}
          />
        </div>
      ) : null}

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
        {isGuidedStart ? (
          <GuidedTemplateStart
            encounterCount={timelineEvents.length}
            actionCount={timelineEvents.reduce(
              (total, event) => total + gameplayMechanics.reduce(
                (eventTotal, mechanic) => eventTotal + Math.max(0, event.counts?.[mechanic] ?? 0),
                0,
              ),
              0,
            )}
            onPlayTemplate={() => void handleLaunchGame(true)}
            onChangeEvent={handlePersonalizeStarterEncounter}
            onAddEquation={handleAddToStarterTemplate}
            onUseAdvanced={handleUseAdvanced}
          />
        ) : (
          <>
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
          {isRctm1Mode ? (
            <div style={{ flex: 1, minWidth: 0, height: "100%" }}>
              <RtcmModePanel
                onAddHit={handleRtcmAddHitAtPlayhead}
                onStartHold={(tool) => {
                  if (tool === "spin") {
                    handleRtcmStartSpinAtPlayhead();
                  } else {
                    handleRtcmStartDragAtPlayhead();
                  }
                }}
                onEndHold={handleFinalizeAnyPendingHold}
                onCreateEvent={handleToggleRtcmEventCreation}
                onDeleteEvent={handleDeleteActiveEvent}
                onClear={handleClearRtcmChart}
                isSongPlaying={isSongPlaying}
                pendingRangeMechanic={rtcmPendingHold?.mechanic ?? null}
                eventRangeStartTick={rtcmEventRangeStartTick}
                canDeleteEvent={Boolean(rtcmDeleteTargetEventId)}
                draftedActionCount={rtcmDraftMechanics.length}
              />
            </div>
          ) : isRctm2Mode ? (
            <div style={{ flex: 1, minWidth: 0, height: "100%" }}>
              <Rctm2ModePanel
                onAddHitMarker={(point) => handleAddRctm2TimelineMarker("hit", point)}
                onBeginDragMarker={handleBeginRctm2DragMarker}
                onCompleteDragMarker={handleCompleteRctm2DragMarker}
                onCancelDragMarker={handleCancelRctm2DragMarker}
                onCreateEvent={handleToggleRtcmEventCreation}
                onDeleteEvent={handleDeleteActiveEvent}
                onClear={handleClearRtcmChart}
                eventRangeStartTick={rtcmEventRangeStartTick}
                canDeleteEvent={Boolean(rtcmDeleteTargetEventId)}
                currentSongSeconds={currentSongSeconds}
                isSongPlaying={isSongPlaying}
                events={timelineEvents}
                rtcmDraftMechanics={rtcmDraftMechanics}
                hitPlacements={rctm2HitPlacements}
                dragStartPoints={rctm2DragStartPoints}
                dragSourceHitIds={rctm2DragSourceHitIds}
              />
            </div>
          ) : (
            <>
              {isBuilderPanelOpen ? (
                <div
                  className={styles.editorPanelSurface}
                  style={{
                    flex: `0 0 ${row2DisplayWidths.column1}px`,
                    minWidth: 0,
                    height: "100%",
                    // Demo tutorial step 1: keep the equation builder above the
                    // dimming overlay so its buttons stay clickable.
                    position: "relative",
                    zIndex: tutorialStep === "welcome" ? 1200 : undefined,
                  }}
                >
                  <button
                    type="button"
                    className={styles.editorPanelCloseButton}
                    onClick={() => setIsBuilderPanelOpen(false)}
                    aria-label="Collapse equation builder"
                    title="Collapse equation builder"
                  >
                    ×
                  </button>
                  <LeftEquationBuilderPanel
                    draftTokens={draftTokens}
                    activeEventLabel={centerContextEventIndex >= 0 ? studentCopy.editor.moveGroup(centerContextEventIndex + 1) : null}
                    activeEventEquationText={centerContextEventEquation ? tokensToEquationState(centerContextEventEquation.tokens) : null}
                    onAddToken={handleAppendEquationToken}
                    onClearEquation={handleClearEquationDraft}
                    onSaveEquation={handleSaveEquation}
                    onUseDraftInEvent={handleUseDraftInActiveEvent}
                    tutorialPrompt={
                      showSaveEquationTutorialPrompt
                        ? "Save this equation so you can use it in your lesson."
                        : null
                    }
                    onSkipTutorial={() => setTutorialStep(null)}
                  />
                </div>
              ) : (
                <EditorPanelRail label="Build" onOpen={() => setIsBuilderPanelOpen(true)} />
              )}

              {isBuilderPanelOpen ? (
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
              ) : null}

              <div style={{ flex: "1 1 auto", minWidth: 0, height: "100%" }}>
                <div
                  style={{
                    width: "100%",
                    height: "100%",
                    minHeight: 0,
                    display: "grid",
                    gridTemplateRows: centerContextEvent
                      ? isFocusedGuidedEditor
                        ? "auto minmax(0, 1fr) 0"
                        : "7% 80% 13%"
                      : "0 100% 0",
                    background: row2Column2BackgroundColor,
                    overflow: "hidden",
                  }}
                >
                  <>
                    <div
                      style={{
                        gridRow: 1,
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
                      {shouldShowStarterTemplate ? (
                        <div
                          aria-label="Starting lesson choices"
                          style={{
                            display: "flex",
                            width: "100%",
                            alignItems: "center",
                            gap: 8,
                            flexWrap: "wrap",
                          }}
                        >
                            <span style={{ color: "#CFFF04" }}>{studentCopy.editor.starterLabel}</span>
                          <span style={{ color: "#FFFFFFB3", fontWeight: 700 }}>
                            {studentCopy.editor.starterBody}
                          </span>
                          <button
                            type="button"
                            onClick={handlePersonalizeStarterEncounter}
                            style={{
                              border: "1px solid #CFFF04",
                              borderRadius: 999,
                              background: "rgba(207,255,4,0.12)",
                              color: "#CFFF04",
                              cursor: "pointer",
                              fontFamily: "Space Grotesk, sans-serif",
                              fontSize: 10,
                              fontWeight: 900,
                              padding: "4px 8px",
                            }}
                          >
                            {studentCopy.editor.changeFirstMove}
                          </button>
                          <button
                            type="button"
                            onClick={handleAddToStarterTemplate}
                            style={{
                              border: `1px solid ${subtleBorderColor}`,
                              borderRadius: 999,
                              background: "#252525",
                              color: "#FFFFFF",
                              cursor: "pointer",
                              fontFamily: "Space Grotesk, sans-serif",
                              fontSize: 10,
                              fontWeight: 900,
                              padding: "4px 8px",
                            }}
                          >
                            {studentCopy.editor.addEquation}
                          </button>
                          <button
                            type="button"
                            onClick={handleKeepStarterTemplate}
                            style={{
                              border: "none",
                              background: "transparent",
                              color: "#FFFFFF99",
                              cursor: "pointer",
                              fontFamily: "Space Grotesk, sans-serif",
                              fontSize: 10,
                              fontWeight: 800,
                              padding: "4px 2px",
                            }}
                          >
                            {studentCopy.editor.keepIt}
                          </button>
                        </div>
                      ) : centerContextEvent && centerContextEventIndex >= 0 ? (
                        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                          {isFocusedGuidedEditor ? (
                            <>
                              <span>{studentCopy.editor.moveGroup(centerContextEventIndex + 1)}</span>
                              <span style={{ color: "#FFFFFF99", fontWeight: 700 }}>Choose an action, then set it up below.</span>
                            </>
                          ) : (
                            <>
                              <span>{studentCopy.editor.moveGroup(centerContextEventIndex + 1)}</span>
                              <span>{`Starts at ${formatTimelineTime(getTimelineEventTimeWindowSeconds(centerContextEvent).startSeconds, isAdvancedMode)}`}</span>
                              <span>{`Spins: ${centerContextEvent.counts?.spin ?? 0}`}</span>
                              <span>{`Hits: ${centerContextEvent.counts?.hit ?? 0}`}</span>
                              <span>{`Drags: ${centerContextEvent.counts?.drag ?? 0}`}</span>
                            </>
                          )}
                        </div>
                      ) : null}
                    </div>

                    <div
                      style={{
                        gridRow: 2,
                        minHeight: 0,
                        overflowY: "auto",
                        display: "grid",
                        gridTemplateRows: isFocusedGuidedEditor
                          ? "minmax(0, 1fr)"
                          : selectedGuidedEncounter
                            ? "auto minmax(0, 1fr)"
                            : "minmax(0, 1fr)",
                      }}
                    >
                      {selectedGuidedEncounter && selectedGuidedReadiness ? (
                        <div style={{ display: "grid", gridTemplateRows: "auto minmax(0, 1fr)", gap: 12, minHeight: 0, overflowY: "auto", padding: "clamp(12px, 2vw, 20px)" }}>
                          {isFocusedGuidedEditor ? (
                            <div aria-label="Choose an action" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(132px, 1fr))", gap: 8, width: "min(100%, 760px)", margin: "0 auto" }}>
                              {centerContextMechanicItems.map((item) => {
                                const isSelected = item.key === selectedCenterContextMechanic?.key;
                                const ActionIcon = item.mechanic === "hit"
                                  ? TouchAppRoundedIcon
                                  : item.mechanic === "spin"
                                    ? ReplayRoundedIcon
                                    : SwipeRoundedIcon;
                                return (
                                  <button
                                    key={item.key}
                                    type="button"
                                    onClick={() => {
                                      setSelectedContextMechanicKey(item.key);
                                      seekSong(timelineTickToSeconds(item.startTick));
                                    }}
                                    aria-pressed={isSelected}
                                    aria-label={`Select ${studentCopy.mechanics[item.mechanic]} action ${item.instanceIndex + 1}`}
                                    style={{ minHeight: 66, display: "grid", gridTemplateColumns: "auto 1fr", alignItems: "center", gap: 9, borderRadius: 14, border: `1px solid ${isSelected ? "#CFFF04" : "#42536A"}`, background: isSelected ? "rgba(207,255,4,0.12)" : "#101827", color: isSelected ? "#CFFF04" : "#FFFFFF", cursor: "pointer", padding: "9px 12px", textAlign: "left", fontFamily: "Space Grotesk, sans-serif" }}
                                  >
                                    <ActionIcon aria-hidden="true" fontSize="small" />
                                    <span style={{ display: "grid", gap: 2 }}>
                                      <strong style={{ fontSize: 13 }}>{studentCopy.mechanics[item.mechanic]} action {item.instanceIndex + 1}</strong>
                                      <span style={{ color: isSelected ? "#DFFF70" : "#FFFFFF99", fontSize: 11 }}>{formatTimelineTime(timelineTickToSeconds(item.startTick), isAdvancedMode)}</span>
                                    </span>
                                  </button>
                                );
                              })}
                            </div>
                          ) : null}
                          <GuidedEncounterComposer
                            instance={selectedGuidedEncounter}
                            tokens={selectedGuidedEncounter.equation?.tokens ?? []}
                            readiness={selectedGuidedReadiness}
                            activityKey={selectedSongActivity?.key ?? selectedSongLaunch?.activityKey ?? null}
                            step={selectedGuidedReadiness.issueCodes.includes("equation_required") ? 1 : 2}
                            stepCount={3}
                            dragSources={dragSources}
                            onPatchInstance={handlePatchSelectedGuidedEncounter}
                            onRemove={isFocusedGuidedEditor ? handleRemoveSelectedContextMechanic : undefined}
                          />
                        </div>
                      ) : null}
                      {!isFocusedGuidedEditor ? <div style={{ minHeight: 0, overflow: "hidden" }}>
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
                          selectedHitPad={selectedContextHitPad}
                          onSelectHitPad={
                            selectedCenterContextMechanic?.mechanic === "hit"
                              ? handleSetSelectedContextHitPad
                              : null
                          }
                          equationViewerBlockSize={equationViewerBlockSize}
                          currentSongSeconds={currentSongSeconds}
                          mechanicStartSeconds={selectedContextMechanicTimeWindow.startSeconds}
                          mechanicEndSeconds={selectedContextMechanicTimeWindow.endSeconds}
                          isSongPlaying={isSongPlaying}
                          onQuickAddHit={handleAddHitAtPlayhead}
                          onCreateEquation={handleCreateEquationChoice}
                          onBrowseLibrary={handleBrowsePremadeChoice}
                          showWorkspacePrompt={showCenterWorkspacePrompt}
                          hideHeader={hideEquationHeader}
                        />
                      </div> : null}
                    </div>

                    <div
                      style={{
                        gridRow: 3,
                        display: centerContextEvent && !isFocusedGuidedEditor ? "grid" : "none",
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
                            No move assigned yet.
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
                              {`${studentCopy.mechanics[item.mechanic]} ${item.instanceIndex + 1}`}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </>
                </div>
              </div>

              {isLibraryPanelOpen ? (
                <>
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

                  <div className={styles.editorPanelSurface} style={{ flex: `0 0 ${row2DisplayWidths.column3}px`, minWidth: 0, height: "100%", position: "relative" }}>
                    <button
                      type="button"
                      className={styles.editorPanelCloseButton}
                      onClick={() => setIsLibraryPanelOpen(false)}
                      aria-label="Collapse equation library"
                      title="Collapse equation library"
                    >
                      ×
                    </button>
                    <LibraryPanel
                      activeTab={libraryTab}
                      savedEquations={savedEquations}
                      templateEquations={templateEquations}
                      hiddenSourceEquationIds={hiddenSourceEquationIds}
                      activeEventId={activeEventId}
                      selectedEquationId={selectedEquationId}
                      onTabChange={handleSelectLibraryTab}
                      onSelectEquation={handleSelectLibraryEquation}
                      onAddSelectedEquationToEvent={handleAddSelectedEquationToEvent}
                      onHideSourceEquation={handleHideSourceEquation}
                      onRestoreSourceEquation={handleRestoreSourceEquation}
                      onDeleteMineEquation={handleDeleteMineEquation}
                      shouldScrollLibrary={isTimelineInstructionVisible}
                      tutorialPrompt={
                        tutorialStep === "add"
                          ? "Choose this equation, then add it to encounter 1."
                          : null
                      }
                      onSkipTutorial={() => setTutorialStep(null)}
                    />
                  </div>
                </>
              ) : (
                <EditorPanelRail label="Library" onOpen={() => setIsLibraryPanelOpen(true)} />
              )}

            </>
          )}
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
            activeEventNumber={centerContextEventIndex >= 0 ? centerContextEventIndex + 1 : null}
            activeEventHasEquation={Boolean(centerContextEventEquation)}
            onRewind={handleRewindSong}
            onTogglePlay={handleToggleSongPlayback}
            onFastForward={handleFastForwardSong}
          />
          <EquationTimeline
            events={timelineEvents}
            hideSpinouts={isRctm2Mode}
            activityKey={selectedSongActivity?.key ?? selectedSongLaunch?.activityKey ?? null}
            activeEventId={activeEventId}
            onSelectEvent={handleSelectEvent}
            currentSongSeconds={currentSongSeconds}
            durationSeconds={timelineDurationSeconds}
            waveformPeaks={waveformPeaks}
            onSeek={seekSong}
            onPlayheadDragStart={() => {
              // no-op hook for now; used to align lifecycle with drag-end finalize.
            }}
            onPlayheadDragEnd={handleFinalizeTimelineInteraction}
            onRetimeMechanicMarker={handleRetimeMechanicMarker}
            onRetimeEventEdge={handleRetimeEventEdge}
            audioObjectUrl={audioObjectUrl}
            isAdvancedMode={isAdvancedMode}
          />
        </section>
          </>
        )}
      </main>

      {advancedConfirmOpen ? (
        <div role="dialog" aria-modal="true" aria-labelledby="advanced-chartmaker-title" style={{ position: "fixed", inset: 0, zIndex: 1300, display: "grid", placeItems: "center", padding: 20, background: "rgba(0,0,0,.7)" }} onKeyDown={(event) => { if (event.key === "Escape") setAdvancedConfirmOpen(false); }}>
          <div style={{ width: "min(440px, 92vw)", display: "grid", gap: 14, padding: 22, borderRadius: 16, background: "#182230", color: "#FFFFFF" }}>
            <h2 id="advanced-chartmaker-title" style={{ margin: 0 }}>{studentCopy.editor.advancedToolsTitle}</h2>
            <p style={{ margin: 0, color: "#D1D5DB", lineHeight: 1.45 }}>{studentCopy.editor.advancedToolsBody}</p>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", flexWrap: "wrap" }}>
              <button type="button" onClick={() => setAdvancedConfirmOpen(false)} style={{ border: "1px solid #7A8FA8", background: "transparent", color: "#FFFFFF", borderRadius: 999, padding: "10px 14px", cursor: "pointer" }}>Go back</button>
              <button type="button" onClick={() => { setAdvancedConfirmOpen(false); setGuidedStarted(true); setAdvancedMode(true); }} style={{ border: 0, background: "#CFFF04", color: "#071222", borderRadius: 999, padding: "10px 14px", fontWeight: 800, cursor: "pointer" }}>{studentCopy.editor.openAdvancedTools}</button>
            </div>
          </div>
        </div>
      ) : null}

      {/* <SongFlowDebugger title="Lesson Builder Launch Debugger" /> */}

      {workspaceConflict ? (
        <div role="alertdialog" aria-modal="true" aria-labelledby="workspace-conflict-title" style={{ position: "fixed", inset: 0, zIndex: 1600, display: "grid", placeItems: "center", background: "rgba(0,0,0,0.72)", padding: 20 }}>
          <div style={{ width: "min(440px, 100%)", border: `1px solid ${subtleBorderColor}`, borderRadius: 16, background: "#101827", color: textColor, padding: 22, boxShadow: "0 20px 60px rgba(0,0,0,0.55)" }}>
            <h2 id="workspace-conflict-title" style={{ margin: 0, fontSize: 18, fontWeight: 900 }}>Your lesson changed somewhere else</h2>
            <p style={{ color: "#FFFFFFAA", fontSize: 13, lineHeight: 1.5 }}>Choose the latest saved copy or keep the changes on this device. Nothing will be overwritten without your choice.</p>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button type="button" onClick={handleKeepLocalWorkspace} style={{ border: `1px solid ${subtleBorderColor}`, borderRadius: 9, background: "#252525", color: textColor, padding: "9px 12px", fontWeight: 800, cursor: "pointer" }}>Keep my changes</button>
              <button type="button" onClick={handleReloadLatestWorkspace} style={{ border: 0, borderRadius: 9, background: "#CFFF04", color: "#071222", padding: "9px 12px", fontWeight: 900, cursor: "pointer" }}>Use latest copy</button>
            </div>
          </div>
        </div>
      ) : null}

      <EditorToast message={saveStatus} hasUnsavedChanges={hasUnsavedChanges} />

      <SongFilePickerModal
        isOpen={isFilePickerOpen}
        isLoading={isFilePickerLoading}
        error={filePickerError}
        authors={filePickerAuthors}
        isLoadingAuthors={isFilePickerAuthorsLoading}
        authorName={filePickerAuthorName}
        activityKey={filePickerActivityKey}
        songs={filePickerSongs}
        selectedSongId={filePickerSongId}
        selectedRhythmSourceRevision={filePickerRhythmSourceRevision}
        onAuthorChange={setFilePickerAuthorName}
        onActivityChange={setFilePickerActivityKey}
        onSelectSong={(songId) => {
          setFilePickerSongId(songId);
          setFilePickerRhythmSourceRevision(null);
        }}
        onSelectRhythmSource={(revision) => setFilePickerRhythmSourceRevision(revision || null)}
        onClose={() => setIsFilePickerOpen(false)}
        onLoad={handleLoadSongFromFilePicker}
      />

      {/* Demo tutorial step 1: dim every panel except the equation builder. */}
      {tutorialStep === "welcome" ? (
        <>
          <div
            aria-hidden="true"
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.65)",
              zIndex: 1100,
              pointerEvents: "none",
            }}
          />
          <div
            style={{
              position: "fixed",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              width: "min(420px, 92vw)",
              zIndex: 1300,
              pointerEvents: "auto",
            }}
          >
            <TutorialBubble
              text={"Let’s make an equation. Click the number and symbol buttons on the left to build one."}
              onSkip={() => setTutorialStep(null)}
            />
          </div>
        </>
      ) : null}

      {pendingNavigation ? (
        <UnsavedChangesModal
          isSaving={isSaving}
          onSaveAndLeave={() => {
            void handleSaveAndLeave();
          }}
          onLeaveWithoutSaving={handleLeaveWithoutSaving}
          onStay={() => setPendingNavigation(null)}
        />
      ) : null}

    </div>
  );
}
