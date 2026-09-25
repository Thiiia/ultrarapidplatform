import type { ChangeEvent, ReactNode } from "react";
import NorthEastRoundedIcon from "@mui/icons-material/NorthEastRounded";
import NorthWestRoundedIcon from "@mui/icons-material/NorthWestRounded";
import SouthEastRoundedIcon from "@mui/icons-material/SouthEastRounded";
import SouthWestRoundedIcon from "@mui/icons-material/SouthWestRounded";
import EastRoundedIcon from "@mui/icons-material/EastRounded";
import ReplayRoundedIcon from "@mui/icons-material/ReplayRounded";
import WestRoundedIcon from "@mui/icons-material/WestRounded";

import { AUTHORED_MAX_REQUIRED_HIT_PADS, isAuthoredEquationOperator } from "@/lib/authored-lesson";
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

const hitPads = [
  { pad: "topLeft", label: "Top left", column: 1, row: 1, Icon: NorthWestRoundedIcon },
  { pad: "topRight", label: "Top right", column: 3, row: 1, Icon: NorthEastRoundedIcon },
  { pad: "left", label: "Left", column: 1, row: 2, Icon: WestRoundedIcon },
  { pad: "right", label: "Right", column: 3, row: 2, Icon: EastRoundedIcon },
  { pad: "bottomLeft", label: "Bottom left", column: 1, row: 3, Icon: SouthWestRoundedIcon },
  { pad: "bottomRight", label: "Bottom right", column: 3, row: 3, Icon: SouthEastRoundedIcon },
] as const;

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
      const current = instance.hitBubbles[0];
      onPatchInstance(instance.id, { hitBubbles: [{
        ...current,
        tokenIndex,
        targetId,
        pads: current?.pads ?? current?.positions ?? [],
      }] });
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
  onPatchInstance,
}: Pick<GuidedEncounterComposerProps, "instance" | "tokens" | "onPatchInstance">) {
  const selectedTokenIndex = instance.hitBubbles[0]?.tokenIndex;
  const selectedPads = instance.hitBubbles[0]?.pads ?? [];
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16, alignItems: "center" }}>
      <TargetPicker instance={instance} tokens={tokens} kind="Target token" displayLabel={studentCopy.mechanics.pickHitTarget} onPatchInstance={onPatchInstance} />
      <div style={{ display: "grid", gap: 7, justifyItems: "center" }}>
        <div style={{ color: "#FFFFFFB3", fontSize: 11, fontWeight: 800 }}>{studentCopy.mechanics.chooseButtons}</div>
        <div role="group" data-repair-control="pad" aria-label="Choose where the hit appears" style={{ display: "grid", gridTemplateColumns: "repeat(3, 42px)", gridTemplateRows: "repeat(3, 42px)", gap: 6, padding: 8, border: "1px solid #FFFFFF14", borderRadius: 14, background: "#0C1422" }}>
          {hitPads.map(({ pad, label, column, row, Icon }) => (
            <button
              key={pad}
              type="button"
              disabled={selectedTokenIndex === undefined || (!selectedPads.includes(pad) && selectedPads.length >= AUTHORED_MAX_REQUIRED_HIT_PADS)}
              aria-label={`Pad ${label}`}
              aria-pressed={selectedPads.includes(pad)}
              title={label}
              onClick={() => {
                if (selectedTokenIndex === undefined) return;
                const pads = selectedPads.includes(pad) && selectedPads.length > 1
                  ? selectedPads.filter((value) => value !== pad)
                  : selectedPads.includes(pad) ? selectedPads : [...selectedPads, pad];
                onPatchInstance(instance.id, { hitBubbles: [{
                  ...instance.hitBubbles[0],
                  tokenIndex: selectedTokenIndex,
                  targetId: tokens[selectedTokenIndex]?.id,
                  pads,
                  positions: pads,
                }] });
              }}
              style={{ gridColumn: column, gridRow: row, display: "grid", placeItems: "center", minWidth: 42, minHeight: 42, borderRadius: 12, border: `1px solid ${selectedPads.includes(pad) ? "#CFFF04" : "#7A8FA8"}`, background: selectedPads.includes(pad) ? "#CFFF04" : "#111B2A", color: selectedPads.includes(pad) ? "#071222" : "#FFFFFF", cursor: selectedTokenIndex === undefined ? "not-allowed" : "pointer", boxShadow: selectedPads.includes(pad) ? "0 0 18px rgba(207,255,4,.3)" : "none" }}
            >
              <Icon aria-hidden="true" fontSize="small" />
            </button>
          ))}
          <div aria-hidden="true" style={{ gridColumn: 2, gridRow: 2, borderRadius: 999, border: "1px solid #2EA7FF", background: "rgba(46,167,255,.12)", boxShadow: "0 0 16px rgba(46,167,255,.16)" }} />
        </div>
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
  if (isNumberBonds) {
    controls = <div style={{ display: "grid", gap: 6, color: "#FFFFFFB3", fontSize: 12 }}>
      <strong style={{ color: "#DFFF70" }}>Each catch cue schedules one unit block.</strong>
      <span>The block panel sets the target whole. This timeline sets when each gem appears; the performance step keeps timing feedback.</span>
    </div>;
  } else if (!instance.equation || tokens.length === 0) {
    controls = <div style={{ display: "grid", gap: 8, justifyItems: "start", color: "#FFFFFFB3", fontSize: 12 }}>
      {studentCopy.mechanics.chooseEquation}
      {onChooseEquation ? <button type="button" data-repair-control="equation" onClick={onChooseEquation} style={{ border: "1px solid #CFFF04", borderRadius: 10, background: "#CFFF04", color: "#071222", padding: "9px 12px", fontWeight: 800, cursor: "pointer" }}>Choose an equation</button> : null}
    </div>;
  } else if (instance.mechanic === "hit") {
    controls = <HitControls instance={instance} tokens={tokens} onPatchInstance={onPatchInstance} />;
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
    <section ref={(section) => focusRepairChoice(section, repairFocus)} aria-label={`${heading} composer`} style={{ display: "grid", gap: 12, width: "min(100%, 760px)", margin: "0 auto", padding: "clamp(12px, 2vw, 18px)", borderRadius: 16, border: "1px solid #7A8FA8", background: "linear-gradient(145deg, #101827, #0C1422)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline" }}>
        <h3 style={{ margin: 0, color: "#FFFFFF", fontSize: 15 }}>{heading}</h3>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ color: "#CFFF04", fontSize: 11, fontWeight: 900 }}>Step {step} of {stepCount}</span>
          {onRemove ? <button type="button" data-repair-control="remove" onClick={onRemove} style={{ border: "1px solid #7A3A3A", borderRadius: 999, background: "transparent", color: "#FFB4B4", cursor: "pointer", fontSize: 11, fontWeight: 800, padding: "4px 8px" }}>Remove action</button> : null}
        </div>
      </div>
      {readiness.ready ? <div style={{ color: "#CFFF04", fontSize: 11, fontWeight: 800 }}>This move is ready. Check the lesson above before playing.</div> : <div role="status" style={{ color: "#FFCB6B", fontSize: 11, fontWeight: 800 }}>{readiness.nextAction}</div>}
      {!isNumberBonds && instance.equation && onChooseEquation ? <button type="button" data-repair-control="equation" onClick={onChooseEquation} style={{ justifySelf: "start", border: "1px solid #7A8FA8", borderRadius: 10, background: "#111B2A", color: "#FFFFFF", padding: "7px 10px", fontSize: 11, fontWeight: 800, cursor: "pointer" }}>Change equation</button> : null}
      {isNumberBonds ? (
        <div style={{ borderRadius: 12, border: "1px solid rgba(207,255,4,.28)", background: "rgba(207,255,4,.07)", color: "#DFFF70", padding: "9px 11px", fontSize: 11, fontWeight: 750, lineHeight: 1.45 }}>
          You place the catch cue. In the game it automatically continues through catch → spinout → drag.
        </div>
      ) : null}
      {controls}
    </section>
  );
}
