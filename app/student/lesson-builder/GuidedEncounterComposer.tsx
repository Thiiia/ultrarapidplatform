import type { ChangeEvent, ReactNode } from "react";
import ReplayRoundedIcon from "@mui/icons-material/ReplayRounded";

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
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "end" }}>
      <label style={{ display: "grid", gap: 4, color: "#FFFFFFB3", fontSize: 11, fontWeight: 800 }}>
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
          style={{ width: 96, borderRadius: 8, border: "1px solid #7A8FA8", background: "#0C1422", color: "#FFFFFF", padding: "7px 8px" }}
        />
      </label>
      {instance.mechanic !== "hit" && <label style={{ display: "grid", gap: 4, color: "#FFFFFFB3", fontSize: 11, fontWeight: 800 }}>
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
          style={{ width: 96, borderRadius: 8, border: "1px solid #7A8FA8", background: "#0C1422", color: "#FFFFFF", padding: "7px 8px" }}
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
    <details data-repair-timing style={{ color: "#FFFFFFB3", fontSize: 11 }}>
      <summary style={{ cursor: "pointer", fontWeight: 800 }}>Fine-tune timing</summary>
      <div style={{ marginTop: 8 }}>
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
      style={{
        borderRadius: 999,
        border: `1px solid ${selected ? "#CFFF04" : "#7A8FA8"}`,
        background: selected ? "rgba(207,255,4,.16)" : "#111B2A",
        color: operator ? "#FFFFFF66" : "#FFFFFF",
        padding: "8px 12px",
        cursor: operator ? "not-allowed" : "pointer",
        fontWeight: 800,
      }}
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
    <div style={{ display: "grid", gap: 8 }}>
      <div style={{ color: "#CFFF04", fontSize: 12, fontWeight: 900 }}>{displayLabel}</div>
      <div data-repair-control="target" style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
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
        <div style={{ color: "#FFFFFF80", fontSize: 11 }}>{studentCopy.mechanics.operatorHint}</div>
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
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16, alignItems: "center" }}>
      <TargetPicker instance={instance} tokens={tokens} kind="Target token" displayLabel={studentCopy.mechanics.pickHitTarget} onPatchInstance={onPatchInstance} />
      {isNumberBonds && instance.hitBubbles.length > 1 ? (
        <button
          type="button"
          data-repair-control="single-target"
          onClick={() => onPatchInstance(instance.id, { hitBubbles: bubble ? [bubble] : [] })}
          style={{ justifySelf: "start", border: "1px solid #7A8FA8", borderRadius: 9, background: "#111B2A", color: "#FFFFFF", padding: "7px 10px", cursor: "pointer" }}
        >
          Keep only the first target
        </button>
      ) : null}
      <div data-repair-control="pad" style={{ display: "grid", gap: 7, justifyItems: "center" }}>
        <div style={{ color: "#FFFFFFB3", fontSize: 11, fontWeight: 800 }}>{studentCopy.mechanics.chooseButtons}</div>
        {legacyMapping.length > 0 ? (
          <div role="status" style={{ maxWidth: 260, display: "grid", gap: 8, color: "#FFD77A", fontSize: 11, textAlign: "center" }}>
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
              style={{ justifySelf: "center", borderRadius: 8, border: "1px solid #FFD77A", background: "transparent", color: "#FFD77A", padding: "7px 10px", fontWeight: 800, cursor: "pointer" }}
            >
              Reassign using the player pad layout
            </button>
          </div>
        ) : (
          <div role="group" aria-label="Choose the player pad for this hit" style={{ position: "relative", width: 184, height: 152, border: "1px solid #FFFFFF14", borderRadius: 14, background: "#0C1422" }}>
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
                  style={{ position: "absolute", left: `calc(50% ${offset.dx < 0 ? "-" : "+"} ${Math.abs(offset.dx).toFixed(2)}px)`, top: `calc(50% ${offset.dy < 0 ? "-" : "+"} ${Math.abs(offset.dy).toFixed(2)}px)`, transform: "translate(-50%, -50%)", display: "grid", placeItems: "center", width: 38, height: 38, borderRadius: 12, border: `1px solid ${selected ? "#CFFF04" : "#7A8FA8"}`, background: selected ? "#CFFF04" : "#111B2A", color: selected ? "#071222" : "#FFFFFF", cursor: selectedTokenIndex === undefined ? "not-allowed" : "pointer", boxShadow: selected ? "0 0 18px rgba(207,255,4,.3)" : "none", fontSize: 11, fontWeight: 900 }}
                >
                  {slot + 1}
                </button>
              );
            })}
            <div aria-hidden="true" style={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%, -50%)", width: 16, height: 16, borderRadius: 999, border: "1px solid #2EA7FF", background: "rgba(46,167,255,.12)", boxShadow: "0 0 16px rgba(46,167,255,.16)" }} />
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
    <div style={{ display: "grid", gap: 12 }}>
      <TargetPicker instance={instance} tokens={tokens} kind="Drag target" displayLabel={studentCopy.mechanics.pickDragTarget} onPatchInstance={onPatchInstance} />
      <label style={{ display: "grid", gap: 4, color: "#FFFFFFB3", fontSize: 11, fontWeight: 800 }}>
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
          style={{ maxWidth: 260, borderRadius: 8, border: "1px solid #7A8FA8", background: "#0C1422", color: "#FFFFFF", padding: "7px 8px" }}
        >
          <option value="">{studentCopy.mechanics.chooseEarlierHitOption}</option>
          {(dragSources ?? []).map((source) => <option key={source.id} value={source.id}>{source.label}</option>)}
        </select>
      </label>
      <TimingDetails instance={instance} onPatchInstance={onPatchInstance} />
      <div aria-hidden="true" style={{ color: "#FFFFFF80", fontSize: 11 }}>{studentCopy.mechanics.connectEarlierHit}</div>
    </div>
  );
}

const lastRepairFocus = new WeakMap<HTMLElement, number>();

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
  lastRepairFocus.set(section, repairFocus.nonce);
  section.scrollIntoView({ behavior: "smooth", block: "center" });
  focusable?.focus({ preventScroll: true });
}

export function GuidedEncounterComposer({
  instance,
  tokens,
  readiness,
  step = 1,
  stepCount = 3,
  activityKey = null,
  dragSources = [],
  onPatchInstance,
  onRemove,
  onChooseEquation,
  repairFocus,
}: GuidedEncounterComposerProps) {
  const isNumberBonds = activityKey === "number-bonds";
  const heading = instance.mechanic === "hit"
    ? (isNumberBonds ? "Place a catch cue" : studentCopy.mechanics.makeHit)
    : instance.mechanic === "spin"
      ? studentCopy.mechanics.makeSpin
      : studentCopy.mechanics.makeDrag;
  let controls: ReactNode;
  if (!instance.equation || tokens.length === 0) {
    controls = <div style={{ display: "grid", gap: 8, justifyItems: "start", color: "#FFFFFFB3", fontSize: 12 }}>
      {studentCopy.mechanics.chooseEquation}
      {onChooseEquation ? <button type="button" data-repair-control="equation" onClick={onChooseEquation} style={{ border: "1px solid #CFFF04", borderRadius: 10, background: "#CFFF04", color: "#071222", padding: "9px 12px", fontWeight: 800, cursor: "pointer" }}>Choose an equation</button> : null}
    </div>;
  } else if (instance.mechanic === "hit") {
    controls = <HitControls instance={instance} tokens={tokens} isNumberBonds={isNumberBonds} onPatchInstance={onPatchInstance} />;
  } else if (instance.mechanic === "spin") {
    controls = (
      <div style={{ display: "grid", gap: 12 }}>
        <TargetPicker instance={instance} tokens={tokens} kind="Spin target" displayLabel={studentCopy.mechanics.pickSpinTarget} onPatchInstance={onPatchInstance} />
        <TimingDetails instance={instance} onPatchInstance={onPatchInstance} />
        <div aria-label="Spin cue" style={{ display: "flex", alignItems: "center", gap: 5, color: "#FFFFFF80", fontSize: 11 }}><ReplayRoundedIcon aria-hidden="true" fontSize="small" />{studentCopy.mechanics.spinCue}</div>
      </div>
    );
  } else {
    controls = <DragControls instance={instance} tokens={tokens} dragSources={dragSources} onPatchInstance={onPatchInstance} />;
  }

  return (
    <section ref={(section) => focusRepairChoice(section, repairFocus)} aria-label={`${heading} composer`} className="experience-card" data-state={readiness.ready ? "ready" : "incomplete"} style={{ display: "grid", gap: 12, width: "min(100%, 760px)", margin: "0 auto", padding: "clamp(12px, 2vw, 18px)", borderRadius: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline" }}>
        <h3 style={{ margin: 0, color: "#FFFFFF", fontSize: 15 }}>{heading}</h3>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ color: "#CFFF04", fontSize: 11, fontWeight: 900 }}>Step {step} of {stepCount}</span>
          {onRemove ? <button type="button" data-repair-control="remove" onClick={onRemove} style={{ border: "1px solid #7A3A3A", borderRadius: 999, background: "transparent", color: "#FFB4B4", cursor: "pointer", fontSize: 11, fontWeight: 800, padding: "4px 8px" }}>Remove action</button> : null}
        </div>
      </div>
      {readiness.ready ? <div className="experience-status" data-status="success" role="status" aria-live="polite">{studentCopy.editor.readyToPlay}</div> : <div className="experience-status" data-status="warning" role="status" aria-live="polite">{readiness.nextAction}</div>}
      {instance.equation && onChooseEquation ? <button type="button" data-repair-control="equation" onClick={onChooseEquation} style={{ justifySelf: "start", border: "1px solid #7A8FA8", borderRadius: 10, background: "#111B2A", color: "#FFFFFF", padding: "7px 10px", fontSize: 11, fontWeight: 800, cursor: "pointer" }}>Change equation</button> : null}
      {isNumberBonds ? (
        <div style={{ borderRadius: 12, border: "1px solid rgba(207,255,4,.28)", background: "rgba(207,255,4,.07)", color: "#DFFF70", padding: "9px 11px", fontSize: 11, fontWeight: 750, lineHeight: 1.45 }}>
          You place the catch cue. In the game it automatically continues through catch → spinout → drag.
        </div>
      ) : null}
      {controls}
    </section>
  );
}
