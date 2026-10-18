import type { ChangeEvent, ReactNode } from "react";
import ReplayRoundedIcon from "@mui/icons-material/ReplayRounded";
import SwipeRoundedIcon from "@mui/icons-material/SwipeRounded";
import TouchAppRoundedIcon from "@mui/icons-material/TouchAppRounded";

import { AUTHORED_MAX_REQUIRED_HIT_PADS, isAuthoredEquationOperator } from "@/lib/authored-lesson";
import { getNumberBondsWholeTokenIndex } from "@/lib/activity-authoring-capabilities";
import {
  PLAYER_HEX_AUTHORED_HIT_PAD_LAYOUT_VERSION,
  PLAYER_HEX_AUTHORED_HIT_PADS,
  authoredHitPadForSlot,
  authoredHitPadLabelForSlot,
  resolvePlayerHexHitPadPixelOffset,
  resolveAuthoredHitPadSlot,
  resolveAuthoredHitPadTarget,
} from "@/lib/authored-hit-pad-layout";
import { studentCopy } from "@/lib/student-copy";
import type { AuthoredEquationToken } from "@/lib/authored-lesson-serialization";
import type { SongActivityKey } from "@/lib/song-activity-storage";
import type {
  EncounterReadiness,
  GuidedEncounterInput,
} from "@/lib/guided-authored-encounter";
import { retimeGuidedEncounter } from "@/lib/guided-authored-encounter";
import { EquationLens } from "./EquationLens";
import { getRangeChartCueTargets } from "@/lib/editor/chart-cue-navigation";

function RangeChartGuide({ instance, cues, onPatchInstance }: {
  instance: GuidedEncounterInput;
  cues: readonly number[];
  onPatchInstance: GuidedEncounterComposerProps["onPatchInstance"];
}) {
  const targets = getRangeChartCueTargets(cues, instance.tick, instance.endTick);
  return (
    <div className="algebra-composer__rangeChartGuide" role="group" aria-label="Match move timing to chart cues">
      <strong>Match the move to the music</strong>
      <span>Choose chart cues for the start and release. The other edge stays in place.</span>
      {(["start", "end"] as const).map((edge) => {
        const candidate = edge === "start" ? targets.startSeconds : targets.endSeconds;
        const current = edge === "start" ? instance.tick : instance.endTick;
        const aligned = candidate !== null && typeof current === "number" && Math.abs(candidate - current) <= 0.01;
        return (
          <div key={edge}>
            <span>{edge === "start" ? "Start" : "Release"} · {candidate === null ? "Set a valid action window first" : `chart cue ${timeValue(candidate)}s`}</span>
            <button type="button" disabled={candidate === null || aligned} className="algebra-composer__rangeSnap"
              onClick={() => { if (candidate !== null) onPatchInstance(instance.id, retimeGuidedEncounter(instance, edge, candidate)); }}>
              {aligned ? "On cue" : edge === "start" ? "Snap start" : "Snap release"}
            </button>
          </div>
        );
      })}
    </div>
  );
}

type DragSource = { id: string; label: string };

export type GuidedEncounterComposerProps = {
  instance: GuidedEncounterInput;
  tokens: AuthoredEquationToken[];
  readiness: EncounterReadiness;
  step?: number;
  stepCount?: number;
  showAlgebraSetupProgress?: boolean;
  activityKey?: SongActivityKey | null;
  chartHitCues?: readonly { seconds: number }[];
  dragSources?: DragSource[];
  onRemove?: () => void;
  onChooseEquation?: () => void;
  repairFocus?: { code: string; nonce: number } | null;
  studioClasses?: Record<string, string>;
  onPatchInstance: (
    instanceId: string,
    patch: Partial<GuidedEncounterInput>,
  ) => void;
};

function timeValue(value: number | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? value.toFixed(2) : "";
}

function updateTime(
  event: ChangeEvent<HTMLInputElement>,
  onChange: (value: number | undefined) => void,
) {
  const value = event.currentTarget.value;
  onChange(value === "" ? undefined : Number(value));
}

function TimeControls({
  instance,
  onPatchInstance,
}: Pick<GuidedEncounterComposerProps, "instance" | "onPatchInstance">) {
  return (
    <div className="algebra-composer__timeFields">
      <label className="algebra-composer__fieldLabel">
        {studentCopy.mechanics.startTime}
        <input
          aria-label={studentCopy.mechanics.startTime}
          data-repair-control="start"
          type="number"
          min="0"
          step="0.01"
          value={timeValue(instance.tick)}
          onChange={(event) => updateTime(event, (tick) => {
            if (tick === undefined) return;
            onPatchInstance(instance.id, retimeGuidedEncounter(instance, "start", tick));
          })}
          className="algebra-composer__field"
        />
      </label>
      {instance.mechanic !== "hit" && <label className="algebra-composer__fieldLabel">
        {studentCopy.mechanics.endTime}
        <input
          aria-label={studentCopy.mechanics.endTime}
          data-repair-control="end"
          type="number"
          min="0"
          step="0.01"
          value={timeValue(instance.endTick)}
          onChange={(event) => updateTime(event, (endTick) => {
            if (endTick === undefined) return;
            onPatchInstance(instance.id, retimeGuidedEncounter(instance, "end", endTick));
          })}
          className="algebra-composer__field"
        />
      </label>}
    </div>
  );
}

function TimingDetails({
  instance,
  onPatchInstance,
}: Pick<GuidedEncounterComposerProps, "instance" | "onPatchInstance">) {
  return (
    <details data-repair-timing className="algebra-composer__timing">
      <summary>Fine-tune timing</summary>
      <div className="algebra-composer__timePanel">
        <TimeControls instance={instance} onPatchInstance={onPatchInstance} />
      </div>
    </details>
  );
}

function TokenButton({
  token,
  selected,
  label,
  onSelect,
}: {
  token: AuthoredEquationToken;
  selected: boolean;
  label: string;
  onSelect: () => void;
}) {
  const operator = isAuthoredEquationOperator(token.label);
  return (
    <button
      type="button"
      disabled={operator}
      aria-label={operator ? `${token.label} sign` : `${label} ${token.label}`}
      aria-pressed={!operator && selected}
      title={operator ? studentCopy.mechanics.operatorHint : `Choose ${label.toLowerCase()}`}
      onClick={onSelect}
      className="algebra-composer__tokenButton"
      data-selected={selected ? "true" : undefined}
      data-operator={operator ? "true" : undefined}
    >
      {token.label}
    </button>
  );
}

function TargetPicker({
  instance,
  tokens,
  kind,
  displayLabel,
  onPatchInstance,
}: {
  instance: GuidedEncounterInput;
  tokens: AuthoredEquationToken[];
  kind: "Target token" | "Spin target" | "Drag target";
  displayLabel: string;
  onPatchInstance: GuidedEncounterComposerProps["onPatchInstance"];
}) {
  const selected = kind === "Target token"
    ? instance.hitBubbles[0]?.tokenIndex
    : kind === "Spin target"
      ? instance.spinTargets[0]?.tokenIndex
      : instance.dragTargets[0]?.tokenIndex;

  function select(tokenIndex: number) {
    const targetId = tokens[tokenIndex]?.id;
    if (kind === "Target token") {
      const bubble = instance.hitBubbles[0];
      onPatchInstance(instance.id, {
        hitBubbles: [bubble
          ? { ...bubble, tokenIndex, ...(targetId ? { targetId } : {}) }
          : { tokenIndex, ...(targetId ? { targetId } : {}), positions: [], pads: [], padLayoutVersion: PLAYER_HEX_AUTHORED_HIT_PAD_LAYOUT_VERSION }],
      });
    } else if (kind === "Spin target") {
      onPatchInstance(instance.id, { spinTargets: [{ tokenIndex, targetId }] });
    } else {
      const sourceHitId = instance.dragTargets[0]?.sourceHitId;
      onPatchInstance(instance.id, { dragTargets: [{ tokenIndex, targetId, ...(sourceHitId ? { sourceHitId } : {}) }] });
    }
  }

  return (
    <div className="algebra-composer__targetPicker">
      <div className="algebra-composer__targetLabel">{displayLabel}</div>
      <div data-repair-control="target" className="algebra-composer__tokenChoices">
        {tokens.map((token, tokenIndex) => (
          <TokenButton
            key={token.id}
            token={token}
            selected={selected === tokenIndex}
            label={kind === "Target token" ? "what to hit" : kind === "Spin target" ? "what to spin" : "what to drag"}
            onSelect={() => select(tokenIndex)}
          />
        ))}
      </div>
      {tokens.some((token) => isAuthoredEquationOperator(token.label)) ? (
        <div className="algebra-composer__hint">{studentCopy.mechanics.operatorHint}</div>
      ) : null}
    </div>
  );
}

function HitControls({
  instance,
  tokens,
  isNumberBonds,
  numberBondsWholeTokenIndex,
  nearestChartCueSeconds,
  chartCueSourceAvailable,
  onPatchInstance,
}: Pick<GuidedEncounterComposerProps, "instance" | "tokens" | "onPatchInstance"> & {
  isNumberBonds: boolean;
  numberBondsWholeTokenIndex: number | null;
  nearestChartCueSeconds: number | null;
  chartCueSourceAvailable: boolean;
}) {
  const bubble = instance.hitBubbles[0];
  const selectedTokenIndex = isNumberBonds
    ? numberBondsWholeTokenIndex ?? undefined
    : bubble?.tokenIndex;
  const selectedSlots = new Set(bubble ? resolveAuthoredHitPadTarget(bubble) : []);
  const padLimit = isNumberBonds ? 1 : AUTHORED_MAX_REQUIRED_HIT_PADS;
  const wholeToken = numberBondsWholeTokenIndex === null ? null : tokens[numberBondsWholeTokenIndex];
  const wholeTargetNeedsRepair = Boolean(isNumberBonds && wholeToken && (
    bubble?.tokenIndex !== numberBondsWholeTokenIndex ||
    (bubble.targetId != null && wholeToken.id && bubble.targetId !== wholeToken.id)
  ));
  const selectedPadLabels = [...selectedSlots]
    .sort((left, right) => left - right)
    .map((slot) => {
      const label = authoredHitPadLabelForSlot(slot);
      return label ? `Player pad ${slot + 1} · ${label}` : `Player pad ${slot + 1}`;
    });
  const currentSeconds = typeof instance.tick === "number" ? instance.tick : null;
  const chartCueOffsetSeconds = nearestChartCueSeconds !== null && currentSeconds !== null
    ? Math.abs(nearestChartCueSeconds - currentSeconds)
    : null;
  const chartCueIsAligned = chartCueOffsetSeconds !== null && chartCueOffsetSeconds <= 0.01;
  const padInstruction = isNumberBonds
    ? selectedSlots.size === 1
      ? `${selectedPadLabels[0]} is assigned. Choose a different pad to move this Hit in one step.`
      : "Choose the one player pad this gem should use."
    : selectedTokenIndex === undefined
      ? "Choose a term above, then choose where its bubble appears."
      : selectedSlots.size > 0
        ? `${selectedSlots.size} of ${padLimit} pads selected${selectedPadLabels.length ? `: ${selectedPadLabels.join(", ")}` : ""}.`
        : `Choose up to ${padLimit} player pads for ${tokens[selectedTokenIndex]?.label ?? "this term"}.`;
  const legacyPads = bubble && bubble.padLayoutVersion !== 2
    ? [...new Set([...(bubble.pads ?? []), ...(bubble.positions ?? [])])]
    : [];
  const legacyMapping = legacyPads.flatMap((pad) => {
    const slot = resolveAuthoredHitPadSlot(pad, bubble?.padLayoutVersion);
    const label = authoredHitPadLabelForSlot(slot);
    return slot >= 0 && label ? [`${pad} → Player pad ${slot + 1} · ${label}`] : [];
  });

  return (
    <div className="algebra-composer__hitControls">
      {isNumberBonds ? (
        <div data-repair-control="target" className="algebra-composer__numberBondsTarget">
          <span className="algebra-composer__targetLabel">Required Hit target</span>
          {wholeToken ? (
            <div className="algebra-composer__wholeToken" aria-label={`Whole token ${wholeToken.label}`}>
              <span>WHOLE</span>
              <strong>{wholeToken.label}</strong>
            </div>
          ) : (
            <p className="algebra-composer__padInstruction" role="alert">
              This equation has no supported whole token yet, so its player pad cannot be assigned.
            </p>
          )}
          {wholeTargetNeedsRepair && wholeToken ? (
            <button
              type="button"
              className="algebra-composer__secondaryButton"
              onClick={() => onPatchInstance(instance.id, {
                hitBubbles: [bubble
                  ? { ...bubble, tokenIndex: numberBondsWholeTokenIndex!, targetId: wholeToken.id }
                  : {
                    tokenIndex: numberBondsWholeTokenIndex!,
                    targetId: wholeToken.id,
                    positions: [],
                    pads: [],
                    padLayoutVersion: PLAYER_HEX_AUTHORED_HIT_PAD_LAYOUT_VERSION,
                  }],
              })}
            >
              Set the whole as this Hit target
            </button>
          ) : null}
        </div>
      ) : (
        <TargetPicker instance={instance} tokens={tokens} kind="Target token" displayLabel={studentCopy.mechanics.pickHitTarget} onPatchInstance={onPatchInstance} />
      )}
      {isNumberBonds && instance.hitBubbles.length > 1 ? (
        <button
          type="button"
          data-repair-control="single-target"
          onClick={() => onPatchInstance(instance.id, { hitBubbles: bubble ? [bubble] : [] })}
          className="algebra-composer__secondaryButton"
        >
          Keep only the first target
        </button>
      ) : null}
      <div data-repair-control="pad" className="algebra-composer__padPicker">
        <div className="algebra-composer__padHeading">
          <span className="algebra-composer__fieldLabel">{isNumberBonds ? "Choose its player pad" : "Choose player pads"}</span>
          <span className="algebra-composer__padCount" aria-label={`${selectedSlots.size} of ${padLimit} pads selected`}>{selectedSlots.size} / {padLimit}</span>
        </div>
        {legacyMapping.length > 0 ? (
          <div role="status" className="algebra-composer__legacyWarning">
            <span>This saved Hit uses the legacy pad layout. Its slot mapping differs from the player&apos;s named pads.</span>
            <span>{legacyMapping.join(" · ")}</span>
            <button
              type="button"
              onClick={() => {
                if (!bubble) return;
                onPatchInstance(instance.id, {
                  hitBubbles: [{
                    ...bubble,
                    ...(selectedTokenIndex !== undefined && tokens[selectedTokenIndex]?.id ? { targetId: tokens[selectedTokenIndex].id } : {}),
                    positions: [],
                    pads: [],
                    padLayoutVersion: PLAYER_HEX_AUTHORED_HIT_PAD_LAYOUT_VERSION,
                  }],
                });
              }}
              className="algebra-composer__warningButton"
            >
              Reassign using the player pad layout
            </button>
          </div>
        ) : (
          <div
            role="group"
            aria-label={isNumberBonds ? "Choose the single player pad for this Number Bonds Hit" : "Choose player pads for this Hit"}
            className="algebra-composer__padBoard"
          >
            {PLAYER_HEX_AUTHORED_HIT_PADS.map(({ pad, label }, slot) => {
              const selected = selectedSlots.has(slot);
              // Both activities show the same physical player layout, with room
              // between the 44px targets and the term at the centre.
              const offset = resolvePlayerHexHitPadPixelOffset(slot, 70);
              if (!offset) return null;
              return (
                <button
                  key={pad}
                  type="button"
                  disabled={selectedTokenIndex === undefined || (!isNumberBonds && !selected && selectedSlots.size >= padLimit)}
                  aria-label={`Player pad ${slot + 1}: ${label}`}
                  aria-pressed={selected}
                  title={label}
                  className="algebra-composer__padButton"
                  data-selected={selected ? "true" : undefined}
                  onClick={() => {
                    if (selectedTokenIndex === undefined) return;
                    const nextSlots = isNumberBonds
                      ? [slot]
                      : selected
                        ? [...selectedSlots].filter((value) => value !== slot)
                        : [...selectedSlots, slot];
                    const pads = nextSlots
                      .map(authoredHitPadForSlot)
                      .filter((value): value is NonNullable<typeof value> => value !== null);
                    onPatchInstance(instance.id, {
                      hitBubbles: [{
                        ...(bubble ?? {}),
                        tokenIndex: selectedTokenIndex,
                        ...(tokens[selectedTokenIndex]?.id ? { targetId: tokens[selectedTokenIndex].id } : {}),
                        positions: pads,
                        pads,
                        padLayoutVersion: PLAYER_HEX_AUTHORED_HIT_PAD_LAYOUT_VERSION,
                      }],
                    });
                  }}
                  style={{ left: `calc(50% ${offset.dx < 0 ? "-" : "+"} ${Math.abs(offset.dx).toFixed(2)}px)`, top: `calc(50% ${offset.dy < 0 ? "-" : "+"} ${Math.abs(offset.dy).toFixed(2)}px)` }}
                >
                  <span>{slot + 1}</span>
                </button>
              );
            })}
            <div aria-hidden="true" className="algebra-composer__padCenter">
              <span>{isNumberBonds ? "Whole" : "Term"}</span>
              <strong>{selectedTokenIndex === undefined ? "?" : tokens[selectedTokenIndex]?.label ?? "?"}</strong>
            </div>
          </div>
        )}
        <p className="algebra-composer__padInstruction" role="status" aria-live="polite">{padInstruction}</p>
        {chartCueSourceAvailable && nearestChartCueSeconds === null ? (
          <div className="algebra-composer__chartSync" data-aligned="false" role="status">
            <div>
              <strong>Chart sync unavailable</strong>
              <span>No playable notes were found for this song and difficulty.</span>
            </div>
          </div>
        ) : null}
        {nearestChartCueSeconds !== null ? (
          <div className="algebra-composer__chartSync" data-aligned={chartCueIsAligned ? "true" : "false"} role="status" aria-live="polite">
            <div>
              <strong>{chartCueIsAligned ? "On a playable chart cue" : "Nearest playable chart cue"}</strong>
              <span>
                {chartCueIsAligned
                  ? `${timeValue(nearestChartCueSeconds)}s`
                  : `${timeValue(chartCueOffsetSeconds ?? 0)}s away · cue at ${timeValue(nearestChartCueSeconds)}s`}
              </span>
            </div>
            {!chartCueIsAligned ? (
              <button
                type="button"
                className="algebra-composer__secondaryButton"
                onClick={() => onPatchInstance(instance.id, retimeGuidedEncounter(instance, "start", nearestChartCueSeconds))}
              >
                Snap Hit to chart cue
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
      <TimingDetails instance={instance} onPatchInstance={onPatchInstance} />
    </div>
  );
}

function DragControls({
  instance,
  tokens,
  dragSources,
  onPatchInstance,
  requireSource = false,
}: Pick<GuidedEncounterComposerProps, "instance" | "tokens" | "dragSources" | "onPatchInstance"> & { requireSource?: boolean }) {
  return (
    <div className="algebra-composer__dragControls">
      <TargetPicker instance={instance} tokens={tokens} kind="Drag target" displayLabel={studentCopy.mechanics.pickDragTarget} onPatchInstance={onPatchInstance} />
      <label className="algebra-composer__fieldLabel">
        {requireSource ? "Source Hit for this gem" : studentCopy.mechanics.chooseEarlierHit}
        <select
          aria-label={requireSource ? "Source Hit for this gem" : studentCopy.mechanics.chooseEarlierHitLabel}
          data-repair-control="source"
          value={instance.dragTargets[0]?.sourceHitId ?? ""}
          onChange={(event) => {
            const target = instance.dragTargets[0];
            if (!target) return;
            onPatchInstance(instance.id, { dragTargets: [{ ...target, sourceHitId: event.currentTarget.value || undefined }] });
          }}
          className="algebra-composer__field algebra-composer__sourceField"
        >
          <option value="" disabled={requireSource}>{requireSource ? "Choose this gem’s Hit" : studentCopy.mechanics.chooseEarlierHitOption}</option>
          {(dragSources ?? []).map((source) => <option key={source.id} value={source.id}>{source.label}</option>)}
        </select>
      </label>
      <TimingDetails instance={instance} onPatchInstance={onPatchInstance} />
      <div className="algebra-composer__hint">{requireSource ? "Keep this Drag linked to the Hit that catches the same gem." : studentCopy.mechanics.connectEarlierHit}</div>
    </div>
  );
}

const lastRepairFocus = new WeakMap<HTMLElement, number>();

const ALGEBRA_ACTION_REPAIR_CODES = new Set([
  "activity_equation_count",
  "activity_equation_invalid",
  "activity_hit_count",
  "activity_mechanic_unsupported",
  "activity_target_shape",
  "drag_source_not_earlier",
  "drag_source_not_ready",
  "drag_source_required",
  "equation_required",
  "equation_incomplete",
  "hit_pad_required",
  "operator_target",
  "single_target_required",
  "spin_target_required",
  "target_identity_invalid",
  "target_required",
]);

const ALGEBRA_SETUP_STEPS = ["Choose equation", "Set up action", "Tune the moment"] as const;

function algebraSetupStage(instance: GuidedEncounterInput, tokens: AuthoredEquationToken[], readiness: EncounterReadiness) {
  if (!instance.equation || tokens.length === 0) return 1;
  return readiness.issueCodes.some((code) => ALGEBRA_ACTION_REPAIR_CODES.has(code)) ? 2 : 3;
}

function focusRepairChoice(section: HTMLElement | null, repairFocus: GuidedEncounterComposerProps["repairFocus"]) {
  if (!section || !repairFocus || lastRepairFocus.get(section) === repairFocus.nonce) return;
  const code = repairFocus.code;
  const control = code === "equation_required" || code === "equation_incomplete" || code === "activity_equation_invalid" || code === "activity_equation_count" ? "equation"
    : code === "activity_mechanic_unsupported" ? "remove"
    : code === "hit_pad_required" ? "pad"
    : code === "activity_target_shape" && section.querySelector("[data-repair-control='single-target']") ? "single-target"
    : code === "activity_target_shape" ? "target"
    : code === "single_target_required" || code === "target_identity_invalid" ? "target"
    : code === "drag_source_required" || code === "drag_source_not_ready" || code === "drag_source_not_earlier" ? "source"
    : code === "duration_required" ? "end"
    : code === "unsupported_concurrency" || code === "activity_hit_spacing" || code === "hit_timing_invalid" ? "start"
    : "target";
  const timing = section.querySelector<HTMLDetailsElement>("[data-repair-timing]");
  if (timing && (control === "start" || control === "end")) timing.open = true;
  const target = section.querySelector<HTMLElement>(`[data-repair-control="${control}"]`);
  const focusable = target?.matches("button,input,select") ? target : target?.querySelector<HTMLElement>("button:not(:disabled),input,select");
  const reduceMotion = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  lastRepairFocus.set(section, repairFocus.nonce);
  section.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "center" });
  focusable?.focus({ preventScroll: true });
}

export function GuidedEncounterComposer({
  instance,
  tokens,
  readiness,
  step = 1,
  stepCount = 3,
  activityKey = null,
  chartHitCues,
  showAlgebraSetupProgress = false,
  dragSources = [],
  onPatchInstance,
  onRemove,
  onChooseEquation,
  repairFocus,
  studioClasses,
}: GuidedEncounterComposerProps) {
  const isNumberBonds = activityKey === "number-bonds";
  const isAlgebra = activityKey === "early-algebra";
  const usesStudioLayout = (isAlgebra || isNumberBonds) && Boolean(studioClasses?.composer);
  const numberBondsWholeTokenIndex = isNumberBonds
    ? getNumberBondsWholeTokenIndex({ tokens: instance.equation?.tokens ?? tokens })
    : null;
  const setupStage = algebraSetupStage(instance, tokens, readiness);
  const selectedTokenIndex = instance.mechanic === "hit"
    ? (isNumberBonds ? numberBondsWholeTokenIndex ?? undefined : instance.hitBubbles[0]?.tokenIndex)
    : instance.mechanic === "spin"
      ? instance.spinTargets[0]?.tokenIndex
      : instance.dragTargets[0]?.tokenIndex;
  const heading = instance.mechanic === "hit"
    ? (isNumberBonds ? "Hit cue" : studentCopy.mechanics.makeHit)
    : instance.mechanic === "spin"
      ? studentCopy.mechanics.makeSpin
      : studentCopy.mechanics.makeDrag;
  let controls: ReactNode;
  const finiteChartCueTimes = chartHitCues?.map((cue) => cue.seconds).filter((seconds) => Number.isFinite(seconds) && seconds >= 0) ?? [];
  const nearestChartCueSeconds = instance.mechanic === "hit" && typeof instance.tick === "number" && finiteChartCueTimes.length
    ? finiteChartCueTimes.reduce((closest, candidate) =>
      Math.abs(candidate - instance.tick!) < Math.abs(closest - instance.tick!) ? candidate : closest,
    finiteChartCueTimes[0])
    : null;
  if (isNumberBonds && instance.mechanic === "hit") {
    controls = <>
      <div className="algebra-composer__numberBondsGuidance">
        <strong>Each note brings one gem into play.</strong>
        <span>The whole stays the Hit target. Choose its single player pad below; the chart cue keeps the gem on this song&apos;s rhythm.</span>
      </div>
      <HitControls
        instance={instance}
        tokens={tokens}
        isNumberBonds
        numberBondsWholeTokenIndex={numberBondsWholeTokenIndex}
        nearestChartCueSeconds={nearestChartCueSeconds}
        chartCueSourceAvailable={chartHitCues !== undefined}
        onPatchInstance={onPatchInstance}
      />
    </>;
  } else if (!instance.equation || tokens.length === 0) {
    controls = <div className="algebra-composer__emptyEquation">
      {studentCopy.mechanics.chooseEquation}
      {onChooseEquation ? <button type="button" data-repair-control="equation" onClick={onChooseEquation} className="algebra-composer__primaryButton">Choose an equation</button> : null}
    </div>;
  } else if (instance.mechanic === "hit") {
    controls = <HitControls
      instance={instance}
      tokens={tokens}
      isNumberBonds={false}
      numberBondsWholeTokenIndex={null}
      nearestChartCueSeconds={nearestChartCueSeconds}
      chartCueSourceAvailable={chartHitCues !== undefined}
      onPatchInstance={onPatchInstance}
    />;
  } else if (instance.mechanic === "spin") {
    controls = (
      <div className="algebra-composer__spinControls">
        <TargetPicker instance={instance} tokens={tokens} kind="Spin target" displayLabel={studentCopy.mechanics.pickSpinTarget} onPatchInstance={onPatchInstance} />
        <TimingDetails instance={instance} onPatchInstance={onPatchInstance} />
        <div aria-label="Spin cue" className="algebra-composer__cueHint"><ReplayRoundedIcon aria-hidden="true" fontSize="small" />{studentCopy.mechanics.spinCue}</div>
      </div>
    );
  } else {
    controls = <DragControls instance={instance} tokens={tokens} dragSources={dragSources} requireSource={isNumberBonds} onPatchInstance={onPatchInstance} />;
  }

  const equationState = tokens.map((token) => token.label).join(" ");
  const timingSummary = instance.mechanic === "hit"
    ? (typeof instance.tick === "number" ? `Hit at ${timeValue(instance.tick)}s` : "Hit timing not set")
    : (typeof instance.tick === "number" && typeof instance.endTick === "number"
      ? `${timeValue(instance.tick)}–${timeValue(instance.endTick)}s window`
      : "Action window not set");
  const MotionIcon = instance.mechanic === "hit"
    ? TouchAppRoundedIcon
    : instance.mechanic === "spin"
      ? ReplayRoundedIcon
      : SwipeRoundedIcon;
  const motionCue = instance.mechanic === "hit"
    ? "Tap the highlighted pad"
    : instance.mechanic === "spin"
      ? "Spin the hit pads"
      : "Drag the highlighted term";
  const previewPads = instance.mechanic === "hit" && instance.hitBubbles[0]
    ? new Set(resolveAuthoredHitPadTarget(instance.hitBubbles[0]))
    : new Set<number>();
  const previewPadLabels = [...previewPads].sort((left, right) => left - right).map((slot) => slot + 1);
  const dragSourceLabel = instance.mechanic === "drag"
    ? dragSources.find((source) => source.id === instance.dragTargets[0]?.sourceHitId)?.label
    : null;

  return (
    <section
      ref={(section) => focusRepairChoice(section, repairFocus)}
      aria-label={`${heading} composer`}
      data-ur-editor="guided"
      className={`algebra-composer ${usesStudioLayout ? studioClasses?.composer ?? "" : ""}`}
      data-state={readiness.ready ? "ready" : "incomplete"}
      data-mechanic={instance.mechanic}
      data-setup-stage={showAlgebraSetupProgress ? setupStage : undefined}
    >
      <header className="algebra-composer__header">
        <div>
          <h3 className="algebra-composer__title">{heading}</h3>
        </div>
        <div className="algebra-composer__actions">
          {!isNumberBonds ? (
            <span className="algebra-composer__stepCount">
              {showAlgebraSetupProgress
                ? `Step ${setupStage} of ${ALGEBRA_SETUP_STEPS.length}`
                : `Action ${step} of ${stepCount}`}
            </span>
          ) : null}
          {onRemove ? <button type="button" data-repair-control="remove" onClick={onRemove} className="algebra-composer__remove">{isNumberBonds ? "Remove note" : "Remove action"}</button> : null}
        </div>
      </header>
      <div className={usesStudioLayout ? studioClasses?.composerBody : undefined} style={usesStudioLayout ? undefined : { display: "contents" }}>
        <div className={usesStudioLayout ? studioClasses?.composerStage : undefined} style={usesStudioLayout ? undefined : { display: "contents" }}>
      {showAlgebraSetupProgress ? (
        <ol className="algebra-composer__steps" aria-label="Algebra action setup">
          {ALGEBRA_SETUP_STEPS.map((label, index) => {
            const stepNumber = index + 1;
            const state = stepNumber < setupStage ? "complete" : stepNumber === setupStage ? "active" : "upcoming";
            return (
              <li key={label} className="algebra-composer__step" data-state={state}>
                {state === "active" ? <span aria-current="step">{label}</span> : <span>{label}</span>}
              </li>
            );
          })}
        </ol>
      ) : null}
      {readiness.ready ? (
        <div className="experience-status" data-status="success" data-editor-signal="ready" role="status" aria-live="polite">
          {isNumberBonds ? "This action is ready. Check the whole mission before playing." : studentCopy.editor.readyToPlay}
        </div>
      ) : (
        <div className="experience-status" data-status="warning" data-editor-signal="repair" role="status" aria-live="polite">{readiness.nextAction}</div>
      )}
      {(!isNumberBonds || instance.mechanic !== "hit") && instance.equation && tokens.length > 0 ? (
        <div key={`${instance.id}-${instance.mechanic}-${instance.equation.id}`} className="algebra-composer__preview" data-cue-preview data-mechanic={instance.mechanic} role="group" aria-label={`Player cue preview. Equation: ${equationState}`}>
          <div className="algebra-composer__previewCopy">
            <span className="algebra-composer__previewAction" data-mechanic={instance.mechanic} aria-label={`Player action: ${motionCue}`}>
              <MotionIcon className="algebra-composer__previewActionIcon" aria-hidden="true" fontSize="small" />
              <span>{motionCue}</span>
            </span>
            <span className="algebra-composer__previewTarget">
              {instance.mechanic === "hit" ? (
                <>
                  <span>{selectedTokenIndex === undefined ? "Choose a target" : `Equation target ${tokens[selectedTokenIndex]?.label ?? "equation token"}`}</span>
                  <span>{previewPadLabels.length > 0 ? `Player pad${previewPadLabels.length === 1 ? "" : "s"} ${previewPadLabels.join(" + ")}` : "Choose a player pad"}</span>
                </>
              ) : selectedTokenIndex === undefined
                ? "Choose a target in the action controls."
                : `Target: ${tokens[selectedTokenIndex]?.label ?? "equation token"}${dragSourceLabel ? ` · From ${dragSourceLabel}` : ""}`}
            </span>
            <span className="algebra-composer__previewTiming">{timingSummary}</span>
          </div>
          <div className="algebra-composer__equation" aria-hidden="true">
            {tokens.map((token, index) => usesStudioLayout ? (
              <EquationLens
                key={`${token.id}-${selectedTokenIndex === index ? instance.mechanic : "idle"}`}
                label={token.label}
                targeted={selectedTokenIndex === index}
                mechanic={instance.mechanic}
                operator={isAuthoredEquationOperator(token.label)}
              />
            ) : (
              <span
                key={`${token.id}-${selectedTokenIndex === index ? instance.mechanic : "idle"}`}
                className="algebra-composer__equationToken"
                data-mechanic={instance.mechanic}
                data-targeted={selectedTokenIndex === index ? "true" : undefined}
                data-operator={isAuthoredEquationOperator(token.label) ? "true" : undefined}
              >
                {token.label}
                {selectedTokenIndex === index && !isAuthoredEquationOperator(token.label) ? (
                  <span className="algebra-composer__equationOrbit" aria-hidden="true">
                    <span className="algebra-composer__equationSpark" />
                  </span>
                ) : null}
              </span>
            ))}
          </div>
          {usesStudioLayout && instance.mechanic !== "hit" ? (
            <div key={instance.mechanic} className="algebra-composer__gesture" data-mechanic={instance.mechanic} aria-hidden="true">
              {instance.mechanic === "spin" ? (
                <div className="algebra-composer__gestureSpin"><ReplayRoundedIcon aria-hidden="true" /></div>
              ) : (
                <div className="algebra-composer__gestureDrag"><span /><i /><span /></div>
              )}
            </div>
          ) : null}
        </div>
      ) : null}
      {!isNumberBonds && instance.equation && onChooseEquation ? <button type="button" data-repair-control="equation" onClick={onChooseEquation} className="algebra-composer__changeEquation">Change equation</button> : null}
      {isNumberBonds ? (
        <div className="algebra-composer__numberBondsNote">
          {instance.mechanic === "hit" ? "Choose the song cue and player pad for catching this gem." : instance.mechanic === "spin" ? "Turn this gem during its Spin window, then release." : "Drag this gem to its assigned part during this window."}
        </div>
      ) : null}
        </div>
        <div className={usesStudioLayout ? studioClasses?.composerInspector : undefined} style={usesStudioLayout ? undefined : { display: "contents" }}>
          {usesStudioLayout ? (
            <div className={studioClasses?.inspectorHeading}>
              <strong>Set what the player does</strong>
            </div>
          ) : null}
          {controls}
          {instance.mechanic !== "hit" && chartHitCues !== undefined ? <RangeChartGuide instance={instance} cues={finiteChartCueTimes} onPatchInstance={onPatchInstance} /> : null}
        </div>
      </div>
    </section>
  );
}
