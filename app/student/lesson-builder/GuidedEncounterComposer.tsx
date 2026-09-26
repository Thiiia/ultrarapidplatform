import type { ChangeEvent, ReactNode } from "react";
import ReplayRoundedIcon from "@mui/icons-material/ReplayRounded";
import SwipeRoundedIcon from "@mui/icons-material/SwipeRounded";
import TouchAppRoundedIcon from "@mui/icons-material/TouchAppRounded";

import { AUTHORED_MAX_REQUIRED_HIT_PADS, isAuthoredEquationOperator } from "@/lib/authored-lesson";
import {
  PLAYER_HEX_AUTHORED_HIT_PAD_LAYOUT_VERSION,
  PLAYER_HEX_AUTHORED_HIT_PAD_PREVIEW_RADIUS_PX,
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

type DragSource = { id: string; label: string };

export type GuidedEncounterComposerProps = {
  instance: GuidedEncounterInput;
  tokens: AuthoredEquationToken[];
  readiness: EncounterReadiness;
  step?: number;
  stepCount?: number;
  showAlgebraSetupProgress?: boolean;
  activityKey?: SongActivityKey | null;
  dragSources?: DragSource[];
  onRemove?: () => void;
  onChooseEquation?: () => void;
  repairFocus?: { code: string; nonce: number } | null;
  onPatchInstance: (
    instanceId: string,
    patch: Partial<GuidedEncounterInput>,
  ) => void;
};

function timeValue(value: number | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? String(value) : "";
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
  onPatchInstance,
}: Pick<GuidedEncounterComposerProps, "instance" | "tokens" | "onPatchInstance"> & { isNumberBonds: boolean }) {
  const bubble = instance.hitBubbles[0];
  const selectedTokenIndex = bubble?.tokenIndex;
  const selectedSlots = new Set(bubble ? resolveAuthoredHitPadTarget(bubble) : []);
  const padLimit = isNumberBonds ? 1 : AUTHORED_MAX_REQUIRED_HIT_PADS;
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
      <TargetPicker instance={instance} tokens={tokens} kind="Target token" displayLabel={studentCopy.mechanics.pickHitTarget} onPatchInstance={onPatchInstance} />
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
        <div className="algebra-composer__fieldLabel">{studentCopy.mechanics.chooseButtons}</div>
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
          <div role="group" aria-label="Choose the player pad for this hit" className="algebra-composer__padBoard">
            {PLAYER_HEX_AUTHORED_HIT_PADS.map(({ pad, label }, slot) => {
              const selected = selectedSlots.has(slot);
              const offset = resolvePlayerHexHitPadPixelOffset(slot, PLAYER_HEX_AUTHORED_HIT_PAD_PREVIEW_RADIUS_PX);
              if (!offset) return null;
              return (
                <button
                  key={pad}
                  type="button"
                  disabled={selectedTokenIndex === undefined || (!selected && selectedSlots.size >= padLimit)}
                  aria-label={`Player pad ${slot + 1}: ${label}`}
                  aria-pressed={selected}
                  title={label}
                  className="algebra-composer__padButton"
                  data-selected={selected ? "true" : undefined}
                  onClick={() => {
                    if (selectedTokenIndex === undefined) return;
                    const nextSlots = selected
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
                  {slot + 1}
                </button>
              );
            })}
            <div aria-hidden="true" className="algebra-composer__padCenter" />
          </div>
        )}
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
}: Pick<GuidedEncounterComposerProps, "instance" | "tokens" | "dragSources" | "onPatchInstance">) {
  return (
    <div className="algebra-composer__dragControls">
      <TargetPicker instance={instance} tokens={tokens} kind="Drag target" displayLabel={studentCopy.mechanics.pickDragTarget} onPatchInstance={onPatchInstance} />
      <label className="algebra-composer__fieldLabel">
        {studentCopy.mechanics.chooseEarlierHit}
        <select
          aria-label={studentCopy.mechanics.chooseEarlierHitLabel}
          data-repair-control="source"
          value={instance.dragTargets[0]?.sourceHitId ?? ""}
          onChange={(event) => {
            const target = instance.dragTargets[0];
            if (!target) return;
            onPatchInstance(instance.id, { dragTargets: [{ ...target, sourceHitId: event.currentTarget.value || undefined }] });
          }}
          className="algebra-composer__field algebra-composer__sourceField"
        >
          <option value="">{studentCopy.mechanics.chooseEarlierHitOption}</option>
          {(dragSources ?? []).map((source) => <option key={source.id} value={source.id}>{source.label}</option>)}
        </select>
      </label>
      <TimingDetails instance={instance} onPatchInstance={onPatchInstance} />
      <div aria-hidden="true" className="algebra-composer__hint">{studentCopy.mechanics.connectEarlierHit}</div>
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
  const control = code === "equation_required" || code === "activity_equation_invalid" || code === "activity_equation_count" ? "equation"
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
  showAlgebraSetupProgress = false,
  dragSources = [],
  onPatchInstance,
  onRemove,
  onChooseEquation,
  repairFocus,
}: GuidedEncounterComposerProps) {
  const isNumberBonds = activityKey === "number-bonds";
  const setupStage = algebraSetupStage(instance, tokens, readiness);
  const selectedTokenIndex = instance.mechanic === "hit"
    ? instance.hitBubbles[0]?.tokenIndex
    : instance.mechanic === "spin"
      ? instance.spinTargets[0]?.tokenIndex
      : instance.dragTargets[0]?.tokenIndex;
  const heading = instance.mechanic === "hit"
    ? (isNumberBonds ? "Note timing" : studentCopy.mechanics.makeHit)
    : instance.mechanic === "spin"
      ? studentCopy.mechanics.makeSpin
      : studentCopy.mechanics.makeDrag;
  let controls: ReactNode;
  if (isNumberBonds) {
    controls = <div className="algebra-composer__numberBondsGuidance">
      <strong>Each note brings one gem into play.</strong>
      <span>The song sets the timing. You can move this note on the timeline to change when its gem appears.</span>
    </div>;
  } else if (!instance.equation || tokens.length === 0) {
    controls = <div className="algebra-composer__emptyEquation">
      {studentCopy.mechanics.chooseEquation}
      {onChooseEquation ? <button type="button" data-repair-control="equation" onClick={onChooseEquation} className="algebra-composer__primaryButton">Choose an equation</button> : null}
    </div>;
  } else if (instance.mechanic === "hit") {
    controls = <HitControls instance={instance} tokens={tokens} isNumberBonds={isNumberBonds} onPatchInstance={onPatchInstance} />;
  } else if (instance.mechanic === "spin") {
    controls = (
      <div className="algebra-composer__spinControls">
        <TargetPicker instance={instance} tokens={tokens} kind="Spin target" displayLabel={studentCopy.mechanics.pickSpinTarget} onPatchInstance={onPatchInstance} />
        <TimingDetails instance={instance} onPatchInstance={onPatchInstance} />
        <div aria-label="Spin cue" className="algebra-composer__cueHint"><ReplayRoundedIcon aria-hidden="true" fontSize="small" />{studentCopy.mechanics.spinCue}</div>
      </div>
    );
  } else {
    controls = <DragControls instance={instance} tokens={tokens} dragSources={dragSources} onPatchInstance={onPatchInstance} />;
  }

  const equationState = tokens.map((token) => token.label).join(" ");
  const timingSummary = instance.mechanic === "hit"
    ? (timeValue(instance.tick) ? `Hit at ${timeValue(instance.tick)}s` : "Hit timing not set")
    : (timeValue(instance.tick) && timeValue(instance.endTick)
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

  return (
    <section
      ref={(section) => focusRepairChoice(section, repairFocus)}
      aria-label={`${heading} composer`}
      className="algebra-composer"
      data-state={readiness.ready ? "ready" : "incomplete"}
      data-setup-stage={showAlgebraSetupProgress ? setupStage : undefined}
    >
      <header className="algebra-composer__header">
        <div>
          <div className="algebra-composer__eyebrow">{isNumberBonds ? "CUE WORKSHOP" : activityKey === "early-algebra" ? "MISSION WORKSHOP" : "ACTION WORKSHOP"}</div>
          <h3 className="algebra-composer__title">{heading}</h3>
        </div>
        <div className="algebra-composer__actions">
          {!isNumberBonds ? (
            <span className="algebra-composer__stepCount">
              {showAlgebraSetupProgress ? `Step ${setupStage} of ${ALGEBRA_SETUP_STEPS.length}` : `Action ${step} of ${stepCount}`}
            </span>
          ) : null}
          {onRemove ? <button type="button" data-repair-control="remove" onClick={onRemove} className="algebra-composer__remove">{isNumberBonds ? "Remove note" : "Remove action"}</button> : null}
        </div>
      </header>
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
        <div className="experience-status" data-status="success" role="status" aria-live="polite">
          {isNumberBonds ? "This note is ready. Press Play mission when you are ready." : studentCopy.editor.readyToPlay}
        </div>
      ) : (
        <div className="experience-status" data-status="warning" role="status" aria-live="polite">{readiness.nextAction}</div>
      )}
      {!isNumberBonds && instance.equation && tokens.length > 0 ? (
        <div className="algebra-composer__preview" data-mechanic={instance.mechanic} role="group" aria-label={`Player cue preview. Equation: ${equationState}`}>
          <div className="algebra-composer__previewCopy">
            <span className="algebra-composer__previewEyebrow">PLAYER VIEW</span>
            <strong>See the move before it goes live</strong>
            <span className="algebra-composer__previewAction" data-mechanic={instance.mechanic} aria-label={`Player action: ${motionCue}`}>
              <MotionIcon className="algebra-composer__previewActionIcon" aria-hidden="true" fontSize="small" />
              <span>{motionCue}</span>
            </span>
            <span className="algebra-composer__previewTarget">
              {selectedTokenIndex === undefined ? "Choose a target in the action controls." : `Target: ${tokens[selectedTokenIndex]?.label ?? "equation token"}`}
            </span>
            <span className="algebra-composer__previewTiming">{timingSummary}</span>
          </div>
          <div className="algebra-composer__equation" aria-hidden="true">
            {tokens.map((token, index) => (
              <span
                key={token.id}
                className="algebra-composer__equationToken"
                data-targeted={selectedTokenIndex === index ? "true" : undefined}
                data-operator={isAuthoredEquationOperator(token.label) ? "true" : undefined}
              >
                {token.label}
              </span>
            ))}
          </div>
        </div>
      ) : null}
      {!isNumberBonds && instance.equation && onChooseEquation ? <button type="button" data-repair-control="equation" onClick={onChooseEquation} className="algebra-composer__changeEquation">Change equation</button> : null}
      {isNumberBonds ? (
        <div className="algebra-composer__numberBondsNote">
          Catch the gem on the beat, then place it in a slot.
        </div>
      ) : null}
      {controls}
    </section>
  );
}
