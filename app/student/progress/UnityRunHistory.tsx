import Link from "next/link";
import styles from "./unity-run-history.module.css";
import { summarizeStudentRunFeedback } from "@/lib/student-run-feedback";

export type UnityRunHistoryEntry = {
  launchAttemptId: string;
  activityKey: string;
  songTitle: string | null;
  outcome: string;
  completionVersion: number | null;
  missionSteps: unknown;
  createdAt: Date;
};

function formatActivityName(activityKey: string) {
  if (activityKey === "number-bonds") return "Number Bonds";
  if (activityKey === "early-algebra") return "Early Algebra";
  return activityKey
    .split(/[-_]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function getOutcomeLabel(outcome: string, completionVersion: number | null) {
  if (outcome === "completed" && (completionVersion === 2 || completionVersion === 3)) {
    return { label: "Finished", state: "finished" };
  }
  if (outcome === "completed") return { label: "Saved", state: "saved" };
  if (outcome === "failed") return { label: "Practice run", state: "practice" };
  if (outcome === "abandoned" || outcome === "cancelled") {
    return { label: "Left early", state: "paused" };
  }
  return { label: "Saved play", state: "saved" };
}

const playedDate = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

export default function UnityRunHistory({ runs }: { runs: UnityRunHistoryEntry[] }) {
  return (
    <section className={styles.history} aria-labelledby="student-recent-games-title">
      <div className={styles.heading}>
        <div>
          <p className={styles.eyebrow}>Your game journey</p>
          <h2 id="student-recent-games-title" className={styles.title}>Recent games</h2>
          <p className={styles.description}>
            Look back at what you played and the beats you landed.
          </p>
        </div>
      </div>

      {runs.length === 0 ? (
        <div className={styles.emptyState}>
          <p>Your next game will show up here.</p>
          <Link href="/student">Choose a game</Link>
        </div>
      ) : (
        <ol className={styles.runList}>
          {runs.map((run) => {
            const status = getOutcomeLabel(run.outcome, run.completionVersion);
            const feedback = run.completionVersion === 3
              ? summarizeStudentRunFeedback(run.missionSteps)
              : null;
            const onBeatPercent = feedback
              ? Math.round((feedback.onBeatCount / feedback.totalJudgements) * 100)
              : 0;

            return (
              <li key={run.launchAttemptId}>
                <article className={styles.runCard}>
                  <div className={styles.runHeading}>
                    <div className={styles.runTitleGroup}>
                      <p className={styles.activity}>{formatActivityName(run.activityKey)}</p>
                      <h3 className={styles.songTitle}>{run.songTitle || "Game session"}</h3>
                    </div>
                    <span className={styles.status} data-state={status.state}>
                      {status.label}
                    </span>
                  </div>
                  <time className={styles.date} dateTime={run.createdAt.toISOString()}>
                    {playedDate.format(run.createdAt)}
                  </time>

                  {feedback ? (
                    <div className={styles.feedback}>
                      <div className={styles.feedbackHeading}>
                        <span>On the beat</span>
                        <strong>{feedback.onBeatCount} of {feedback.totalJudgements}</strong>
                      </div>
                      <div
                        className={styles.progressTrack}
                        role="progressbar"
                        aria-label="Moves landed on the beat"
                        aria-valuemin={0}
                        aria-valuemax={feedback.totalJudgements}
                        aria-valuenow={feedback.onBeatCount}
                        aria-valuetext={`${feedback.onBeatCount} of ${feedback.totalJudgements} moves`}
                      >
                        <span className={styles.progressFill} style={{ width: `${onBeatPercent}%` }} />
                      </div>
                      {feedback.nextTryTip ? (
                        <p className={styles.tip}>{feedback.nextTryTip}</p>
                      ) : null}
                    </div>
                  ) : null}
                </article>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
