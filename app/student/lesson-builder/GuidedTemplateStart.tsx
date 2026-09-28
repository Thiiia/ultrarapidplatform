"use client";

import { studentCopy } from "@/lib/student-copy";
import styles from "./GuidedTemplateStart.module.css";
import algebraStyles from "./AlgebraStudio.module.css";

type GuidedTemplateStartProps = {
  songTitle: string;
  encounterCount: number;
  actionCount: number;
  hitCount: number;
  spinCount: number;
  dragCount: number;
  isAlgebraStudio?: boolean;
  onPlayTemplate: () => void;
  onChangeEvent: () => void;
  onAddEquation: () => void;
  onUseAdvanced: () => void;
};

export default function GuidedTemplateStart({ songTitle, encounterCount, actionCount, hitCount, spinCount, dragCount, isAlgebraStudio = false, onPlayTemplate, onChangeEvent, onAddEquation, onUseAdvanced }: GuidedTemplateStartProps) {
  const actions = [
    { name: "Hit", count: hitCount, className: styles.hit },
    { name: "Spin", count: spinCount, className: styles.spin },
    { name: "Drag", count: dragCount, className: styles.drag },
  ];

  return (
    <section aria-labelledby="guided-template-title" className={`${styles.screen} ${isAlgebraStudio ? algebraStyles.guidedStart : ""}`}>
      <div className={styles.panel}>
        <div className={styles.heading}>
          <p className={styles.eyebrow}>{studentCopy.editor.readyToPlay}</p>
          <h1 id="guided-template-title">Your lesson is ready</h1>
          <p>Play it now, or make your own copy and change it first. Your original stays safe.</p>
        </div>

        <div className={styles.preview} aria-label="Lesson preview">
          <div className={styles.previewTop}>
            <div>
              <span className={styles.overline}>Selected song</span>
              <strong className={styles.songTitle}>{songTitle}</strong>
            </div>
            <span className={styles.encounterBadge}>{encounterCount} {encounterCount === 1 ? "encounter group" : "encounter groups"}</span>
          </div>
          <div className={styles.actionList} aria-label="Game actions in this lesson">
            {actions.map((action) => (
              <div className={styles.action} key={action.name}>
                <span className={`${styles.actionIcon} ${action.className}`} aria-hidden="true" />
                <span>{action.name}</span>
                <strong>{action.count}</strong>
              </div>
            ))}
          </div>
          <p className={styles.summary}>{encounterCount} {encounterCount === 1 ? "encounter group" : "encounter groups"} with {actionCount} {actionCount === 1 ? "game action" : "game actions"} are ready for this song.</p>
        </div>

        <div className={styles.explanations}>
          <div className={styles.explanationCard}>
            <strong>Encounter</strong>
            <span>A moment in the song where one or more moves happen.</span>
          </div>
          <div className={styles.explanationCard}>
            <strong>Game action</strong>
            <span>A Hit, Spin, or Drag is an action you set inside an encounter.</span>
          </div>
        </div>

        <button type="button" onClick={onPlayTemplate} className={styles.primary}>Play this lesson</button>
        <div className={styles.editHeading}>Change it first</div>
        <div className={styles.editActions}>
          <button type="button" onClick={onChangeEvent} className={styles.secondary}>Change first encounter</button>
          <button type="button" onClick={onAddEquation} className={styles.secondary}>Add an equation</button>
        </div>
        <button type="button" onClick={onUseAdvanced} className={`${styles.secondary} ${styles.advanced}`}>Open full editor</button>
        <p className={styles.note}>After these encounters, the game can use its own questions if it needs more.</p>
      </div>
    </section>
  );
}
