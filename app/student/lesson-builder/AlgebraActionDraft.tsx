import { useEffect } from "react";
import ReplayRoundedIcon from "@mui/icons-material/ReplayRounded";
import SwipeRoundedIcon from "@mui/icons-material/SwipeRounded";
import TouchAppRoundedIcon from "@mui/icons-material/TouchAppRounded";
import type { AuthoredEquationToken } from "@/lib/authored-lesson-serialization";
import type { EncounterReadiness, GuidedEncounterInput } from "@/lib/guided-authored-encounter";
import { getEquationDraftIssue } from "@/lib/editor/equation-draft-readiness";
import { GuidedEncounterComposer } from "./GuidedEncounterComposer";
import styles from "./AlgebraStudio.module.css";

type EquationOption = { id: string; tokens: AuthoredEquationToken[] };
type DragSource = { id: string; label: string };

const moves = [
  { mechanic: "hit", label: "Hit", description: "Tap one or two pads on the beat", Icon: TouchAppRoundedIcon },
  { mechanic: "spin", label: "Spin", description: "Rotate around a chosen term", Icon: ReplayRoundedIcon },
  { mechanic: "drag", label: "Drag", description: "Pull a term from an earlier Hit", Icon: SwipeRoundedIcon },
] as const;

export function AlgebraActionDraft({ draft, equations, dragSources, readiness, blockingReason, onPatch, onChooseEquation, onChooseMechanic, onCreateEquation, onCommit, onCancel }: {
  draft: GuidedEncounterInput;
  equations: EquationOption[];
  dragSources: DragSource[];
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
            <span>CREATE A PLAYER MOMENT</span>
            <h2 id="algebra-draft-title">Shape a move on this song</h2>
            <p>Choose a move, its equation and its timing. The preview changes as you build.</p>
          </div>
          <button type="button" className={styles.draftClose} onClick={onCancel} aria-label="Close action setup">×</button>
        </div>
        <div className={styles.draftTopControls}>
          <div className={styles.draftMechanics} role="group" aria-label="Action type">
            {moves.map(({ mechanic, label, description, Icon }) => (
              <button type="button" key={mechanic} aria-pressed={draft.mechanic === mechanic} onClick={() => onChooseMechanic(mechanic)}>
                <Icon aria-hidden="true" fontSize="small" />
                <span><strong>{label}</strong><small>{description}</small></span>
              </button>
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
            dragSources={dragSources}
            showAlgebraSetupProgress
            onPatchInstance={(_, patch) => onPatch(patch)}
            onChooseEquation={() => document.getElementById("algebra-draft-equation")?.focus()}
          />
        </div>
        <div className={styles.draftFooter}>
          <span role="status">{equationIssue ?? (!readiness.ready ? readiness.nextAction : blockingReason ?? "Ready to place on the timeline.")}</span>
          <div>
            <button type="button" onClick={onCancel} className={styles.draftCancel}>Cancel</button>
            <button type="button" onClick={onCommit} disabled={!canAdd} className={styles.draftCommit}>Place on timeline</button>
          </div>
        </div>
      </section>
    </div>
  );
}
