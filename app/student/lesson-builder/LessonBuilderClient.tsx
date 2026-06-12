"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { ChangeEvent, DragEvent, FC, SVGProps } from "react";
import { useEffect, useMemo, useState } from "react";
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
  equationSlots?: number | null;
  equation_slots?: number | null;
  songAsset?: {
    equationSlots?: number | null;
    equation_slots?: number | null;
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
      new Set(rawPads.flatMap((pad) => {
        const normalizedPad = normalizeHitBubblePad(pad);
        return normalizedPad ? [normalizedPad] : [];
      })),
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
    const events = value.equations.flatMap((equation, equationIndex): SidecarEvent[] => {
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
        const rawInstances: unknown[] = Array.isArray(equation[`${mechanic}s`])
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
    });

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
          instanceIndex:
            normalizeTokenIndex(event.instanceIndex) ?? undefined,
          equationId:
            typeof event.equationId === "string"
              ? event.equationId
              : undefined,
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
    normalizeEquationSlotCount(selectedSong.songAsset?.equation_slots)
  );
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
      const instance = slot.mechanicInstances[mechanicEvent.mechanic]?.[instanceIndex];

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

  if (typeof targetCount === "number") {
    return resizeTimelineEvents(slots, targetCount);
  }

  return slots;
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
    const mechanicEvents = gameplayMechanics.flatMap((mechanic): SidecarEvent[] => {
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
    });

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
            width: 132,
            height: 64,
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
              width: 132,
              height: 64,
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

function isEquationOperator(label: string) {
  return label === "+" || label === "-" || label === "×" || label === "÷" || label === "=";
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

function EmptyEquationBubble({ size = 34 }: { size?: number }) {
  return (
    <span
      aria-hidden="true"
      style={{
        width: size,
        height: size,
        borderRadius: "999px",
        background: "rgba(255, 255, 255, 0.08)",
        border: "2px dashed rgba(255, 255, 255, 0.42)",
        boxSizing: "border-box",
        display: "inline-block",
      }}
    />
  );
}

function HitBubbleChoice({ onSelect }: { onSelect: (pair: HitBubblePair) => void }) {
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
  const [selectedTokenIndex, setSelectedTokenIndex] = useState<number | null>(null);
  const bubbleSize = 28;
  const circleSize = 58;

  if (tokens.length === 0) {
    return <span style={{ color: "#FFFFFF66", fontSize: 12, fontWeight: 700 }}>Empty</span>;
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
        const placement = hitBubbles.find((item) => item.tokenIndex === tokenIndex);

        return (
          <span
            key={token.id}
            style={{
              position: "relative",
              width: circleSize,
              height: circleSize,
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
                    <EmptyEquationBubble size={bubbleSize} />
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
              <EquationCircle label={token.label} draggable={false} size={circleSize} />
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
                <EquationCircle label={token.label} draggable={false} size={circleSize} />
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
      <svg width="150" height="106" viewBox="0 0 150 106" fill="none" style={{ display: "block", overflow: "visible" }}>
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
  const circleSize = 58;

  if (tokens.length === 0) {
    return <span style={{ color: "#FFFFFF66", fontSize: 12, fontWeight: 700 }}>Empty</span>;
  }

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 42, flexWrap: "wrap", padding: 46 }}>
      {tokens.map((token, tokenIndex) => {
        const isOperator = isEquationOperator(token.label);
        const isSpinTarget = targetIndexes.has(tokenIndex);

        return (
          <span key={token.id} style={{ position: "relative", width: circleSize, height: circleSize, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            {!isOperator && isSpinTarget ? <SpinOverlay /> : null}
            {isOperator ? (
              <EquationCircle label={token.label} draggable={false} size={circleSize} />
            ) : (
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onToggleSpinTarget(tokenIndex);
                }}
                title="Click to add or remove spin behavior"
                style={{ position: "relative", zIndex: 5, border: "none", background: "transparent", padding: 0, cursor: "pointer" }}
              >
                <EquationCircle label={token.label} draggable={false} size={circleSize} />
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

function DragArcOverlay({ side }: { side: "left" | "right" }) {
  const isRight = side === "right";
  const bubbleSize = 58;
  const width = 210;
  const height = 150;

  return (
    <span
      aria-hidden="true"
      style={{
        position: "absolute",
        top: "50%",
        [isRight ? "left" : "right"]: bubbleSize * 0.45,
        width,
        height,
        transform: `translateY(-11%) ${isRight ? "" : "scaleX(-1)"}`,
        pointerEvents: "none",
        zIndex: 1,
      }}
    >
      <svg width={width} height={height} viewBox="0 0 210 150" fill="none" style={{ display: "block", overflow: "visible" }}>
        <path
          d="M0 28C31 122 112 142 190 96"
          stroke="rgba(207, 255, 4, 0.34)"
          strokeWidth={bubbleSize}
          strokeLinecap="round"
        />
        <path
          d="M0 28C31 122 112 142 190 96"
          stroke="rgba(255, 255, 255, 0.17)"
          strokeWidth={Math.max(10, bubbleSize * 0.34)}
          strokeLinecap="round"
        />
      </svg>
      <span
        style={{
          position: "absolute",
          left: -bubbleSize / 2,
          top: 28 - bubbleSize / 2,
          width: bubbleSize,
          height: bubbleSize,
          borderRadius: 999,
          border: "2px solid rgba(207, 255, 4, 0.28)",
          boxSizing: "border-box",
        }}
      />
      <span
        style={{
          position: "absolute",
          left: 190 - bubbleSize / 2,
          top: 96 - bubbleSize / 2,
          width: bubbleSize,
          height: bubbleSize,
        }}
      >
        <EmptyEquationBubble size={bubbleSize} />
      </span>
    </span>
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
  const equalsIndex = findEqualsIndex(tokens);
  const circleSize = 58;

  if (tokens.length === 0) {
    return <span style={{ color: "#FFFFFF66", fontSize: 12, fontWeight: 700 }}>Empty</span>;
  }

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 42, flexWrap: "wrap", padding: 46 }}>
      {tokens.map((token, tokenIndex) => {
        const isOperator = isEquationOperator(token.label);
        const isDragTarget = targetIndexes.has(tokenIndex);
        const targetSide = tokenIndex < equalsIndex ? "right" : "left";

        return (
          <span key={token.id} style={{ position: "relative", width: circleSize, height: circleSize, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            {!isOperator && isDragTarget ? <DragArcOverlay side={targetSide} /> : null}
            {isOperator ? (
              <EquationCircle label={token.label} draggable={false} size={circleSize} />
            ) : (
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onToggleDragTarget(tokenIndex);
                }}
                title="Click to add or remove drag behavior"
                style={{ position: "relative", zIndex: 5, border: "none", background: "transparent", padding: 0, cursor: "pointer" }}
              >
                <EquationCircle label={token.label} draggable={false} size={circleSize} />
              </button>
            )}
          </span>
        );
      })}
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
      <div style={{ color: "#FFFFFF80", fontSize: 13, fontWeight: 700, textAlign: "center" }}>
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
        minHeight: 178,
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
          padding: 14,
          display: "grid",
          gridTemplateRows: safeCount > 1 ? "auto 1fr" : "1fr",
          gap: 12,
          minWidth: 0,
        }}
      >
        {safeCount > 1 ? (
          <div
            style={{
              display: "flex",
              gap: 8,
              overflowX: "auto",
            }}
          >
            {Array.from({ length: safeCount }, (_, index) => {
              const isActive = index === activeInstanceIndex;

              return (
                <button
                  key={`${mechanic}-${index}`}
                  type="button"
                  onClick={() => setActiveInstanceIndex(index)}
                  style={{
                    minWidth: 44,
                    minHeight: 30,
                    borderRadius: 999,
                    border: `1px solid ${isActive ? "#CFFF04" : subtleBorderColor}`,
                    background: isActive ? "#CFFF04" : "#252525",
                    color: isActive ? "#000000" : textColor,
                    fontFamily: "Space Grotesk, sans-serif",
                    fontSize: 12,
                    fontWeight: 900,
                    cursor: "pointer",
                  }}
                >
                  {index + 1}
                </button>
              );
            })}
          </div>
        ) : null}

        <div
          style={{
            minHeight: 112,
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
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
          color: textColor,
          fontFamily: "Space Grotesk, sans-serif",
        }}
      >
        <div>
          <div style={{ fontSize: 15, fontWeight: 900 }}>
            Event at tick {eventSlot.tick}
          </div>
          <div style={{ color: "#FFFFFF80", fontSize: 12, fontWeight: 700 }}>
            Drop one equation here. It will be assigned to every mechanic row
            in this event.
          </div>
        </div>
        {assignedEquation ? (
          <EquationPreview tokens={assignedEquation.tokens} circleSize={28} />
        ) : null}
      </div>

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
              minHeight: 180,
              border: `1px dashed ${subtleBorderColor}`,
              borderRadius: 18,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#FFFFFF80",
              fontFamily: "Space Grotesk, sans-serif",
              fontSize: 13,
              fontWeight: 700,
              textAlign: "center",
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
          savedEquations.map((equation, index) => (
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
                minHeight: 58,
                background: "#191919",
                border: `1px solid ${subtleBorderColor}`,
                borderRadius: 10,
                padding: "8px",
                boxSizing: "border-box",
                color: textColor,
                display: "grid",
                gap: 8,
                cursor: "grab",
              }}
              title={tokensToEquationState(equation.tokens)}
            >
              <div
                style={{ color: "#FFFFFF99", fontSize: 11, fontWeight: 900 }}
              >
                Equation {index + 1}
              </div>
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
  ) {
    const nextEvents = timelineEventsFromSidecar(
      nextSidecar,
      equationSlotCount,
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
    setStoreSidecar(sidecarFromTimelineEvents(nextEvents) as StoreSidecarPayload);
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
      const currentPlacement = instance.hitBubbles.find(
        (placement) => placement.tokenIndex === tokenIndex,
      );
      const nextHitBubbles = currentPlacement
        ? instance.hitBubbles.map((placement) =>
            placement.tokenIndex === tokenIndex
              ? { ...placement, positions: pads, pads }
              : placement,
          )
        : [...instance.hitBubbles, { tokenIndex, positions: pads, pads }];

      return {
        ...instance,
        hitBubbles: nextHitBubbles,
      };
    });
  }

  function handleToggleSpinTarget(
    mechanic: GameplayMechanic,
    instanceIndex: number,
    tokenIndex: number,
  ) {
    updateActiveMechanicInstance(mechanic, instanceIndex, (instance) => {
      const hasTarget = instance.spinTargets.some(
        (target) => target.tokenIndex === tokenIndex,
      );

      return {
        ...instance,
        spinTargets: hasTarget
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
    updateActiveMechanicInstance(mechanic, instanceIndex, (instance) => {
      const hasTarget = instance.dragTargets.some(
        (target) => target.tokenIndex === tokenIndex,
      );

      return {
        ...instance,
        dragTargets: hasTarget
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
      const selectedSongEquationSlots =
        getSelectedSongEquationSlotCount(selectedSong);

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