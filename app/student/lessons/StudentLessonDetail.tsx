import Link from "next/link";
import {
  getMissionActivities,
  getMissionActivityLabel,
} from "@/lib/student-lesson-flow";
import type { StudentLessonDetail as StudentLessonDetailData } from "@/lib/student-dashboard";
import styles from "../student.module.css";

type StudentLessonDetailProps = {
  detail: StudentLessonDetailData;
  navBasePath: "/student" | "/demo/student";
};

export default function StudentLessonDetail({
  detail,
  navBasePath,
}: StudentLessonDetailProps) {
  const activities = getMissionActivities(detail.missionContent);
  const activityLabel = getMissionActivityLabel(detail.missionContent);
  const statusLabel =
    detail.status === "in_progress"
      ? "In progress"
      : detail.status === "complete"
        ? "Completed"
        : "Assigned";
  const dueDate = detail.dueAt ? new Date(detail.dueAt) : null;

  return (
    <article className={styles.studentLessonDetail}>
      <div className={styles.studentLessonDetailTopline}>
        <h3 className={styles.studentLessonDetailTitle}>{detail.title}</h3>
        <span className={styles.studentLessonDetailStatus}>{statusLabel}</span>
      </div>

      {detail.description ? (
        <p className={styles.studentLessonDetailDescription}>{detail.description}</p>
      ) : null}

      <dl className={styles.studentLessonDetailFacts}>
        <div>
          <dt>{detail.kind === "assignment" ? "Assigned by" : "Lesson"}</dt>
          <dd>{detail.teacherName ?? "Self-paced"}</dd>
        </div>
        {detail.className ? (
          <div>
            <dt>Class</dt>
            <dd>{detail.className}</dd>
          </div>
        ) : null}
        {dueDate ? (
          <div>
            <dt>Due</dt>
            <dd>
              <time dateTime={dueDate.toISOString()}>
                {new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(dueDate)}
              </time>
            </dd>
          </div>
        ) : null}
        {activityLabel ? (
          <div>
            <dt>Learning mode</dt>
            <dd>{activityLabel}</dd>
          </div>
        ) : null}
      </dl>

      <section
        className={styles.studentLessonActivities}
        aria-labelledby="lesson-activities-heading"
      >
        <h4 id="lesson-activities-heading">Lesson steps</h4>
        {activities.length > 0 ? (
          <ol>
            {activities.map((activity, index) => (
              <li key={activity.title + "-" + index}>
                <span>{activity.title}</span>
                {activity.detail ? <small>{activity.detail}</small> : null}
              </li>
            ))}
          </ol>
        ) : (
          <p>Your teacher has not added lesson steps yet.</p>
        )}
      </section>

      <aside className={styles.studentLessonUnavailable} role="note">
        <h4>Song lesson not attached yet</h4>
        <p>
          This task does not include a published song revision, so it cannot start
          the assigned chart safely. Ask your teacher to attach the lesson before
          playing.
        </p>
        {!detail.missionPublished ? (
          <p className={styles.studentLessonUnavailableStatus}>
            This mission is not published yet.
          </p>
        ) : null}
      </aside>

      <Link className={styles.studentLessonBackLink} href={navBasePath + "/lessons"}>
        Back to all lessons
      </Link>
    </article>
  );
}
