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
}: {
  songTitle: string;
  encounterCount: number;
  actionCount: number;
  appearance: AlgebraAppearance;
  onAppearanceChange: (appearance: AlgebraAppearance) => void;
  onAddAction: () => void;
  canAddAction: boolean;
}) {
  return (
    <div className={styles.studioBar} aria-label="Early Algebra studio">
      <div className={styles.studioMark} aria-hidden="true"><span>×</span><span>+</span></div>
      <div className={styles.studioTitle}>
        <span>EARLY ALGEBRA · LESSON STUDIO</span>
        <strong>{songTitle}</strong>
      </div>
      <div className={styles.studioCounts} aria-label="Lesson contents">
        <span><strong>{encounterCount}</strong> {encounterCount === 1 ? "encounter" : "encounters"}</span>
        <span className={styles.countDivider} aria-hidden="true" />
        <span><strong>{actionCount}</strong> {actionCount === 1 ? "action" : "actions"}</span>
      </div>
      <button type="button" className={styles.addAction} onClick={onAddAction} disabled={!canAddAction} title={canAddAction ? "Set up a player action" : "Choose and load a song first"}>+ New action</button>
      <div className={styles.appearance} role="group" aria-label="Editor appearance">
        <span className={styles.appearanceLabel}>LOOK</span>
        <button type="button" aria-pressed={appearance === "glass"} onClick={() => onAppearanceChange("glass")}>Prism</button>
        <button type="button" aria-pressed={appearance === "focus"} onClick={() => onAppearanceChange("focus")}>Focus</button>
      </div>
    </div>
  );
}
