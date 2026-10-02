import styles from "./AlgebraStudio.module.css";

export function AlgebraEmptyState({ hasSong, songTitle, onChooseSong, onCreateEquation, onBrowseLibrary }: {
  hasSong: boolean;
  songTitle: string;
  onChooseSong: () => void;
  onCreateEquation: () => void;
  onBrowseLibrary: () => void;
}) {
  return (
    <section className={styles.empty} aria-labelledby="algebra-empty-title">
      <div className={styles.emptyContent}>
        <span className={styles.emptyEyebrow}>YOUR ALGEBRA STUDIO</span>
        <h1 id="algebra-empty-title">{hasSong ? "Give this song its first equation." : "Start with a song."}</h1>
        {hasSong ? (
          <div className={styles.emptyEquation} aria-hidden="true">
            <span className={styles.emptyEquationTerm}>X</span>
            <span className={styles.emptyEquationOperator}>+</span>
            <span className={styles.emptyEquationTerm}>2</span>
            <span className={`${styles.emptyEquationOperator} ${styles.emptyEquationEquals}`}>=</span>
            <span className={styles.emptyEquationTerm}>7</span>
          </div>
        ) : null}
        <p>{hasSong
          ? `${songTitle} is ready. Make an equation or use one from the library, then shape the moments players will hit.`
          : "Choose the track your lesson will follow. Then build equations and place player actions on its timeline."}</p>
        <div className={styles.emptyActions}>
          {hasSong ? (
            <>
              <button type="button" className={styles.emptyPrimary} onClick={onCreateEquation}>Make an equation</button>
              <button type="button" className={styles.emptySecondary} onClick={onBrowseLibrary}>Browse equations</button>
            </>
          ) : <button type="button" className={styles.emptyPrimary} onClick={onChooseSong}>Choose a song</button>}
        </div>
        <div className={styles.emptySteps} aria-label="Lesson setup">
          <span data-current={!hasSong} data-complete={hasSong}>
            <strong>{hasSong ? "✓" : "1"}</strong> {hasSong ? "Song ready" : "Choose a song"}
          </span>
          <span data-current={hasSong}><strong>2</strong> Add an equation</span>
          <span><strong>3</strong> Set player actions</span>
        </div>
      </div>
    </section>
  );
}
