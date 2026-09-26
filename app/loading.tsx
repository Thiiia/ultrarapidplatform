import styles from "./loading.module.css";

export default function Loading() {
  return (
    <main className={styles.screen} aria-busy="true">
      <div className={styles.card} role="status" aria-live="polite">
        <div className={styles.meter} aria-hidden="true"><span /><span /><span /></div>
        <strong>Opening your next page</strong>
        <span>Getting things ready…</span>
      </div>
    </main>
  );
}
