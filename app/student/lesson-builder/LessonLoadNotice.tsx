import { useLayoutEffect, useState, type RefObject } from "react";
import styles from "./LessonLoadNotice.module.css";

/** Describes the actual package request; never estimates musical or loading progress. */
export function LessonLoadNotice({ songTitle, error, isAlgebraStudio, workspaceRef, onRetry, onChooseSong }: {
  songTitle: string;
  error: string;
  isAlgebraStudio: boolean;
  workspaceRef: RefObject<HTMLElement | null>;
  onRetry: () => void;
  onChooseSong: () => void;
}) {
  const [top, setTop] = useState(isAlgebraStudio ? 128 : 64);
  useLayoutEffect(() => {
    const workspace = workspaceRef.current;
    if (!workspace) return;
    const measure = () => setTop(Math.max(0, workspace.getBoundingClientRect().top));
    measure();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    observer?.observe(workspace);
    // Toolbars can wrap without changing the already measured timeline's size.
    let sibling = workspace.previousElementSibling;
    while (sibling) { observer?.observe(sibling); sibling = sibling.previousElementSibling; }
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [workspaceRef]);

  return <section className={styles.notice} style={{ top }}
    data-state={error ? "error" : "loading"} aria-label="Lesson loading">
    <div className={styles.content}>
      <h1>{error ? "Your lesson could not load." : `Loading ${songTitle || "your lesson"}…`}</h1>
      <p role={error ? "alert" : "status"}>{error || "Getting the audio, chart and player moves ready. Editing becomes available when the lesson has loaded."}</p>
      {error ? <div className={styles.actions}>
        <button type="button" onClick={onRetry}>Try loading again</button>
        <button type="button" className={styles.secondary} onClick={onChooseSong}>Choose another song</button>
      </div> : <p className={styles.hint}>Your saved lesson will appear here.</p>}
    </div>
  </section>;
}
