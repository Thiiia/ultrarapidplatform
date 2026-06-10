
import { create } from "zustand";
import type { ChartProject, GameplayBlock } from "./types";

export type GameplayMechanic = "spin" | "drag" | "hit";

export type HitBubblePosition =
  | "topLeft"
  | "topRight"
  | "left"
  | "right"
  | "bottomLeft"
  | "bottomRight";

export type HitBubblePlacement = {
  tokenIndex?: number;
  tokenId?: string;
  positions?: HitBubblePosition[];
  pads?: HitBubblePosition[];
};

export type SpinTarget = {
  tokenIndex?: number;
  tokenId?: string;
};

export type DragTarget = {
  tokenIndex?: number;
  tokenId?: string;
};

export type SidecarMechanicEvent = {
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

export type SidecarEquationStateEvent = {
  tick: number;
  type: "ALG_EQUATION_STATE";
  equationId: string;
  state: string;
};

export type SidecarEvent = SidecarMechanicEvent | SidecarEquationStateEvent;

export type SidecarPayload =
  | { version: 1; events: SidecarEvent[] }
  | {
      version: 2;
      maxEquationSlots?: number;
      equations: unknown[];
    };

export const emptySidecar: SidecarPayload = {
  version: 2,
  maxEquationSlots: 5,
  equations: [],
};

const hitBubblePositions: HitBubblePosition[] = [
  "topLeft",
  "topRight",
  "left",
  "right",
  "bottomLeft",
  "bottomRight",
];

function cloneProject(project: ChartProject): ChartProject {
  return JSON.parse(JSON.stringify(project));
}

function cloneSidecar(sidecar: SidecarPayload): SidecarPayload {
  return JSON.parse(JSON.stringify(sidecar));
}

function normalizeTick(value: unknown) {
  const tick = Number(value);

  if (!Number.isFinite(tick)) {
    return 0;
  }

  return Math.max(0, Math.round(tick));
}

function normalizeNonNegativeInteger(value: unknown, fallback = 0) {
  const count = Number(value);

  if (!Number.isFinite(count) || count < 0) {
    return fallback;
  }

  return Math.round(count);
}

function normalizeMechanic(value: unknown): GameplayMechanic | null {
  if (value === "spin" || value === "drag" || value === "hit") {
    return value;
  }

  return null;
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
    if (!isObject(placement)) {
      return [];
    }

    const rawPads = Array.isArray(placement.pads)
      ? placement.pads
      : Array.isArray(placement.positions)
        ? placement.positions
        : [];
    const tokenIndex = normalizeNonNegativeInteger(placement.tokenIndex, -1);
    const tokenId = typeof placement.tokenId === "string" ? placement.tokenId : undefined;

    if (tokenIndex < 0 && !tokenId) {
      return [];
    }

    const positions = Array.from(
      new Set(
        rawPads
          .map((position) => normalizeHitBubblePosition(position))
          .filter((position): position is HitBubblePosition =>
            Boolean(position),
          ),
      ),
    );

    if (positions.length === 0) {
      return [];
    }

    return [{ tokenIndex, ...(tokenId ? { tokenId } : {}), positions }];
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

    const tokenIndex = normalizeNonNegativeInteger(target.tokenIndex, -1);
    const tokenId = typeof target.tokenId === "string" ? target.tokenId : undefined;

    if (tokenIndex < 0 && !tokenId) {
      return [];
    }

    return [{ tokenIndex, ...(tokenId ? { tokenId } : {}) } as T];
  });
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function normalizeSidecar(value: unknown): SidecarPayload {
  if (!isObject(value)) {
    return emptySidecar;
  }

  if (Array.isArray(value.equations)) {
    return {
      version: 2,
      maxEquationSlots:
        typeof value.maxEquationSlots === "number" ? value.maxEquationSlots : 5,
      equations: value.equations.slice(0, 5),
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
          ...(Number.isFinite(hits) && hits > 0
            ? { hits: Math.max(1, Math.round(hits)) }
            : {}),
          ...(mechanic === "hit"
            ? { hitBubbles: normalizeHitBubblePlacements(event.hitBubbles) }
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

  return {
    version: 1,
    events: events.sort((left, right) => {
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
    }),
  };
}

type EditorStore = {
  project: ChartProject | null;
  sidecar: SidecarPayload;
  selectedIds: string[];
  setProject: (project: ChartProject) => void;
  updateProject: (updater: (project: ChartProject) => ChartProject) => void;
  setSidecar: (sidecar: SidecarPayload) => void;
  updateSidecar: (updater: (sidecar: SidecarPayload) => SidecarPayload) => void;
  addSidecarEvent: (event: SidecarEvent) => void;
  removeSidecarEventAtIndex: (index: number) => void;
  setSelectedIds: (ids: string[]) => void;
  addBlock: (block: GameplayBlock) => void;
  updateBlock: (
    id: string,
    updater: (block: GameplayBlock) => GameplayBlock,
  ) => void;
  removeSelected: () => void;
};

export const useEditorStore = create<EditorStore>((set) => ({
  project: null,
  sidecar: emptySidecar,
  selectedIds: [],
  setProject: (project) => set({ project, selectedIds: [] }),
  updateProject: (updater) =>
    set((state) => ({
      project: state.project ? updater(cloneProject(state.project)) : null,
    })),
  setSidecar: (sidecar) => set({ sidecar: normalizeSidecar(sidecar) }),
  updateSidecar: (updater) =>
    set((state) => ({
      sidecar: normalizeSidecar(updater(cloneSidecar(state.sidecar))),
    })),
  addSidecarEvent: (event) =>
    set((state) => ({
      sidecar: normalizeSidecar({
        version: 1,
        events: [
          ...(state.sidecar.version === 1 ? state.sidecar.events : []),
          event,
        ],
      }),
    })),
  removeSidecarEventAtIndex: (index) =>
    set((state) => ({
      sidecar: normalizeSidecar({
        version: 1,
        events:
          state.sidecar.version === 1
            ? state.sidecar.events.filter(
                (_, eventIndex) => eventIndex !== index,
              )
            : [],
      }),
    })),
  setSelectedIds: (ids) => set({ selectedIds: ids }),
  addBlock: (block) =>
    set((state) => {
      if (!state.project) return state;
      const project = cloneProject(state.project);
      project.blocks.push(block);
      project.metadata.updatedAt = new Date().toISOString();
      project.metadata.source = "edited";
      project.difficulties.expert.blockIds.push(block.id);
      return { project };
    }),
  updateBlock: (id, updater) =>
    set((state) => {
      if (!state.project) return state;
      const project = cloneProject(state.project);
      project.blocks = project.blocks.map((block) =>
        block.id === id ? updater(block) : block,
      );
      project.metadata.updatedAt = new Date().toISOString();
      project.metadata.source = "edited";
      return { project };
    }),
  removeSelected: () =>
    set((state) => {
      if (!state.project) return state;
      const selected = new Set(state.selectedIds);
      const project = cloneProject(state.project);
      project.blocks = project.blocks.filter((b) => !selected.has(b.id));
      project.notes = project.notes.filter((n) => !selected.has(n.id));
      project.metadata.updatedAt = new Date().toISOString();
      project.metadata.source = "edited";
      return { project, selectedIds: [] };
    }),
}));


