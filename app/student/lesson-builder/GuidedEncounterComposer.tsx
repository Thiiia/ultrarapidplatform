import type { ChangeEvent, ReactNode } from "react";

import { isAuthoredEquationOperator } from "@/lib/authored-lesson";
import { studentCopy } from "@/lib/student-copy";
import type { AuthoredEquationToken } from "@/lib/authored-lesson-serialization";
import type {
  EncounterReadiness,
  GuidedEncounterInput,
} from "@/lib/guided-authored-encounter";

type DragSource = { id: string; label: string };

export type GuidedEncounterComposerProps = {
  instance: GuidedEncounterInput;
  tokens: AuthoredEquationToken[];
  readiness: EncounterReadiness;
  step?: number;
  stepCount?: number;
  dragSources?: DragSource[];
  onPatchInstance: (
    instanceId: string,
    patch: Partial<GuidedEncounterInput>,
  ) => void;
};

const hitPads = [
  ["topLeft", "Top left"],
  ["topRight", "Top right"],
  ["left", "Left"],
  ["right", "Right"],
  ["bottomLeft", "Bottom left"],
  ["bottomRight", "Bottom right"],
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
          type="number"
          min="0"
          step="0.01"
          value={timeValue(instance.tick)}
          onChange={(event) => updateTime(event, (tick) => onPatchInstance(instance.id, { tick }))}
          style={{ width: 96, borderRadius: 8, border: "1px solid #7A8FA8", background: "#0C1422", color: "#FFFFFF", padding: "7px 8px" }}
        />
      </label>
      <label style={{ display: "grid", gap: 4, color: "#FFFFFFB3", fontSize: 11, fontWeight: 800 }}>
        {studentCopy.mechanics.endTime}
        <input
          aria-label={studentCopy.mechanics.endTime}
          type="number"
          min="0"
          step="0.01"
          value={timeValue(instance.endTick)}
          onChange={(event) => updateTime(event, (endTick) => onPatchInstance(instance.id, { endTick }))}
          style={{ width: 96, borderRadius: 8, border: "1px solid #7A8FA8", background: "#0C1422", color: "#FFFFFF", padding: "7px 8px" }}
        />
      </label>
    </div>
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
    if (kind === "Target token") {
      const pads = instance.hitBubbles[0]?.pads ?? [];
      onPatchInstance(instance.id, { hitBubbles: [{ tokenIndex, pads }] });
    } else if (kind === "Spin target") {
      onPatchInstance(instance.id, { spinTargets: selected === tokenIndex ? [] : [{ tokenIndex }] });
    } else {
      const sourceHitId = instance.dragTargets[0]?.sourceHitId;
      onPatchInstance(instance.id, { dragTargets: selected === tokenIndex ? [] : [{ tokenIndex, ...(sourceHitId ? { sourceHitId } : {}) }] });
    }
  }

  return (
    <div style={{ display: "grid", gap: 8 }}>
      <div style={{ color: "#CFFF04", fontSize: 12, fontWeight: 900 }}>{displayLabel}</div>
      <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
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
    <div style={{ display: "grid", gap: 12 }}>
      <TargetPicker instance={instance} tokens={tokens} kind="Target token" displayLabel={studentCopy.mechanics.pickHitTarget} onPatchInstance={onPatchInstance} />
      <div style={{ display: "grid", gap: 7 }}>
        <div style={{ color: "#FFFFFFB3", fontSize: 11, fontWeight: 800 }}>{studentCopy.mechanics.chooseButtons}</div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {hitPads.map(([pad, label]) => (
            <button
              key={pad}
              type="button"
              disabled={selectedTokenIndex === undefined}
              aria-label={`Pad ${label}`}
              aria-pressed={selectedPads.includes(pad)}
              onClick={() => {
                if (selectedTokenIndex === undefined) return;
                const pads = selectedPads.includes(pad)
                  ? selectedPads.filter((value) => value !== pad)
                  : [...selectedPads, pad];
                onPatchInstance(instance.id, { hitBubbles: [{ tokenIndex: selectedTokenIndex, pads }] });
              }}
              style={{ borderRadius: 8, border: "1px solid #7A8FA8", background: selectedPads.includes(pad) ? "#CFFF04" : "#111B2A", color: selectedPads.includes(pad) ? "#071222" : "#FFFFFF", padding: "7px 9px", cursor: selectedTokenIndex === undefined ? "not-allowed" : "pointer", fontWeight: 800 }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
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
      <TimeControls instance={instance} onPatchInstance={onPatchInstance} />
      <div aria-hidden="true" style={{ color: "#FFFFFF80", fontSize: 11 }}>{studentCopy.mechanics.connectEarlierHit}</div>
    </div>
  );
}

export function GuidedEncounterComposer({
  instance,
  tokens,
  readiness,
  step = 1,
  stepCount = 3,
  dragSources = [],
  onPatchInstance,
}: GuidedEncounterComposerProps) {
  const heading = instance.mechanic === "hit" ? studentCopy.mechanics.makeHit : instance.mechanic === "spin" ? studentCopy.mechanics.makeSpin : studentCopy.mechanics.makeDrag;
  let controls: ReactNode;
  if (!instance.equation || tokens.length === 0) {
    controls = <div style={{ color: "#FFFFFFB3", fontSize: 12 }}>{studentCopy.mechanics.chooseEquation}</div>;
  } else if (instance.mechanic === "hit") {
    controls = <HitControls instance={instance} tokens={tokens} onPatchInstance={onPatchInstance} />;
  } else if (instance.mechanic === "spin") {
    controls = (
      <div style={{ display: "grid", gap: 12 }}>
        <TargetPicker instance={instance} tokens={tokens} kind="Spin target" displayLabel={studentCopy.mechanics.pickSpinTarget} onPatchInstance={onPatchInstance} />
        <TimeControls instance={instance} onPatchInstance={onPatchInstance} />
        <div aria-label="Spin cue" style={{ color: "#FFFFFF80", fontSize: 11 }}>↻ {studentCopy.mechanics.spinCue}</div>
      </div>
    );
  } else {
    controls = <DragControls instance={instance} tokens={tokens} dragSources={dragSources} onPatchInstance={onPatchInstance} />;
  }

  return (
    <section aria-label={`${heading} composer`} style={{ display: "grid", gap: 12, padding: 14, borderRadius: 14, border: "1px solid #7A8FA8", background: "#101827" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline" }}>
        <h3 style={{ margin: 0, color: "#FFFFFF", fontSize: 15 }}>{heading}</h3>
        <span style={{ color: "#CFFF04", fontSize: 11, fontWeight: 900 }}>Step {step} of {stepCount}</span>
      </div>
      {readiness.ready ? <div style={{ color: "#CFFF04", fontSize: 11, fontWeight: 800 }}>{studentCopy.editor.readyToPlay}</div> : <div role="status" style={{ color: "#FFCB6B", fontSize: 11, fontWeight: 800 }}>{readiness.nextAction}</div>}
      {controls}
    </section>
  );
}
