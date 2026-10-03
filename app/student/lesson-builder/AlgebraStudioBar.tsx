import { useState } from "react";
import styles from "./AlgebraStudio.module.css";

export type AlgebraAppearance = "glass" | "focus";

export function AlgebraStudioBar({
  songTitle,
  encounterCount,
  actionCount,
  appearance,
  onAppearanceChange,
  onAddAction,
  canAddAction,
  onEditFirstEncounter,
  onCreateEquation,
}: {
  songTitle: string;
  encounterCount: number;
  actionCount: number;
  appearance: AlgebraAppearance;
  onAppearanceChange: (appearance: AlgebraAppearance) => void;
  onAddAction: () => void;
  canAddAction: boolean;
  onEditFirstEncounter: () => void;
  onCreateEquation: () => void;
}) {
  const [guideOverride, setGuideOverride] = useState<boolean | null>(null);
  const guideOpen = guideOverride ?? false;

  return (
    <div className={styles.studioBar} aria-label="Early Algebra studio">
      <div className={styles.studioMark} aria-hidden="true"><span>×</span><span>+</span></div>
      <div className={styles.studioTitle}>
        <span>YOUR LESSON</span>
        <strong>{songTitle}</strong>
      </div>
      <div className={styles.studioCounts} aria-label="Lesson contents">
        <span><strong>{encounterCount}</strong> {encounterCount === 1 ? "encounter" : "encounters"}</span>
        <span className={styles.countDivider} aria-hidden="true" />
        <span><strong>{actionCount}</strong> {actionCount === 1 ? "action" : "actions"}</span>
      </div>
      <button type="button" className={styles.addAction} onClick={onAddAction} disabled={!canAddAction} title={canAddAction ? "Set up a player move" : "Choose and load a song first"}>+ Add a move</button>
      <div className={styles.guideWrap}>
        <button type="button" className={styles.guideToggle} aria-expanded={guideOpen} aria-controls="algebra-studio-guide" onClick={() => setGuideOverride(!guideOpen)}>How it works</button>
        {guideOpen ? (
          <div id="algebra-studio-guide" className={styles.guidePopover} role="region" aria-label="Algebra studio guide">
            <strong>Build and play in this studio</strong>
            <p>Use Add a move to place one action precisely, or start an encounter to record several moves while the song plays.</p>
            <ol>
              <li><b>Choose an equation.</b> Its terms become the player targets.</li>
              <li><b>Place a move.</b> Hit selects one or two pads; Spin and Drag use a time window.</li>
              <li><b>Check the timeline.</b> Select a move to adjust it, then use Play above to try the lesson.</li>
            </ol>
            <div className={styles.guideActions}>
              {encounterCount > 0 ? <button type="button" disabled={!canAddAction} onClick={() => { onEditFirstEncounter(); setGuideOverride(false); }}>Edit first encounter</button> : null}
              <button type="button" disabled={!canAddAction} onClick={() => { onCreateEquation(); setGuideOverride(false); }}>Make an equation</button>
            </div>
          </div>
        ) : null}
      </div>
      <div className={styles.appearance} role="group" aria-label="Editor appearance">
        <span className={styles.appearanceLabel}>LOOK</span>
        <button type="button" aria-pressed={appearance === "glass"} onClick={() => onAppearanceChange("glass")}>Prism</button>
        <button type="button" aria-pressed={appearance === "focus"} onClick={() => onAppearanceChange("focus")}>Focus</button>
      </div>
    </div>
  );
}
