import { useEffect } from "react";
import type { AuthoredEquationToken } from "@/lib/authored-lesson-serialization";
import type { EncounterReadiness, GuidedEncounterInput } from "@/lib/guided-authored-encounter";
import { getEquationDraftIssue } from "@/lib/editor/equation-draft-readiness";
import { GuidedEncounterComposer } from "./GuidedEncounterComposer";
import styles from "./AlgebraStudio.module.css";

type EquationOption = { id: string; tokens: AuthoredEquationToken[] };

export function AlgebraActionDraft({ draft, equations, readiness, blockingReason, onPatch, onChooseEquation, onChooseMechanic, onCreateEquation, onCommit, onCancel }: {
  draft: GuidedEncounterInput;
  equations: EquationOption[];
  readiness: EncounterReadiness;
  blockingReason: string | null;
  onPatch: (patch: Partial<GuidedEncounterInput>) => void;
  onChooseEquation: (equationId: string) => void;
  onChooseMechanic: (mechanic: GuidedEncounterInput["mechanic"]) => void;
  onCreateEquation: () => void;
  onCommit: () => void;
  onCancel: () => void;
}) {
  const equationIssue = draft.equation ? getEquationDraftIssue(draft.equation.tokens) : "Choose an equation first.";
  const canAdd = readiness.ready && !equationIssue && !blockingReason;
  const visibleReadiness = equationIssue || blockingReason
    ? { ...readiness, ready: false, nextAction: equationIssue ?? blockingReason ?? readiness.nextAction }
    : readiness;

  useEffect(() => {
    document.getElementById("algebra-draft-equation")?.focus();
  }, []);

  return (
    <div className={styles.draftBackdrop}>
      <section className={styles.draftDialog} role="dialog" aria-modal="true" aria-labelledby="algebra-draft-title" onKeyDown={(event) => { if (event.key === "Escape") onCancel(); }}>
        <div className={styles.draftHeader}>
          <div>
            <span>NEW PLAYER MOMENT</span>
            <h2 id="algebra-draft-title">Set up the action before placing it</h2>
            <p>Choose what players see and do. The move joins the timeline when it is ready.</p>
          </div>
          <button type="button" className={styles.draftClose} onClick={onCancel} aria-label="Close action setup">×</button>
        </div>
        <div className={styles.draftTopControls}>
          <div className={styles.draftMechanics} role="group" aria-label="Action type">
            {(["hit", "spin", "drag"] as const).map((mechanic) => (
              <button type="button" key={mechanic} aria-pressed={draft.mechanic === mechanic} onClick={() => onChooseMechanic(mechanic)}>{mechanic}</button>
            ))}
          </div>
          <label className={styles.draftEquationLabel}>
            Equation for this action
            <select id="algebra-draft-equation" value={draft.equation?.id ?? ""} onChange={(event) => onChooseEquation(event.currentTarget.value)}>
              <option value="">Choose an equation</option>
              {equations.map((equation) => (
                <option key={equation.id} value={equation.id} disabled={Boolean(getEquationDraftIssue(equation.tokens))}>
                  {equation.tokens.map((token) => token.label).join(" ")}
                </option>
              ))}
            </select>
          </label>
          <button type="button" className={styles.draftCreateEquation} onClick={onCreateEquation}>Make a new equation</button>
        </div>
        <div className={styles.draftComposer}>
          <GuidedEncounterComposer
            instance={draft}
            studioClasses={styles}
            tokens={draft.equation?.tokens ?? []}
            readiness={visibleReadiness}
            activityKey="early-algebra"
            showAlgebraSetupProgress
            onPatchInstance={(_, patch) => onPatch(patch)}
            onChooseEquation={() => document.getElementById("algebra-draft-equation")?.focus()}
          />
        </div>
        <div className={styles.draftFooter}>
          <span role="status">{equationIssue ?? (!readiness.ready ? readiness.nextAction : blockingReason ?? "Ready to place on the timeline.")}</span>
          <div>
            <button type="button" onClick={onCancel} className={styles.draftCancel}>Cancel</button>
            <button type="button" onClick={onCommit} disabled={!canAdd} className={styles.draftCommit}>Add ready action</button>
          </div>
        </div>
      </section>
    </div>
  );
}
