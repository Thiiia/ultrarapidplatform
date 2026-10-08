"use client";

import { useId, type ReactNode } from "react";
import Link from "next/link";
import Image, { type StaticImageData } from "next/image";
import PlayIcon from "@/public/Next_Button.svg";
import styles from "@/app/student/student.module.css";
import type { LearningActivityKey } from "@/lib/learning-activities";

type LearningActivityCardProps = {
  activityKey: LearningActivityKey;
  title: string;
  goal: string;
  description: string;
  icon: StaticImageData;
  actionLabel: string;
  href?: string;
  onAction: () => void;
  selected?: boolean;
};

export default function LearningActivityCard({
  activityKey,
  title,
  goal,
  description,
  icon,
  actionLabel,
  href,
  onAction,
  selected,
}: LearningActivityCardProps) {
  const headingId = useId();
  const goalId = useId();
  const descriptionId = useId();
  const action = (
    <>
      <span>{actionLabel}</span>
      <PlayIcon aria-hidden="true" style={{ width: 18, height: 18, flexShrink: 0 }} />
    </>
  );
  const content = (actionElement: ReactNode) => (
    <>
      <div className={styles.learningActivityArtwork} data-activity={activityKey}>
        <Image
          src={icon}
          alt=""
          aria-hidden="true"
          width={360}
          height={240}
          unoptimized
          priority={activityKey === "number-bonds"}
        />
      </div>

      <div className={styles.learningActivityContent}>
        <h3 id={headingId} className={styles.learningActivityTitle}>
          {title}
        </h3>
        <span id={goalId} className={styles.learningActivityGoal}>{goal}</span>
        <p id={descriptionId} className={styles.learningActivityDescription}>
          {description}
        </p>
        {actionElement}
      </div>
    </>
  );

  if (href) {
    return (
      <Link
        className={styles.learningActivityCard}
        data-activity={activityKey}
        href={href}
        onClick={onAction}
        aria-label={`Play ${title}`}
        aria-describedby={`${goalId} ${descriptionId}`}
      >
        {content(
          <span className={styles.learningActivityAction} aria-hidden="true">
            {action}
          </span>,
        )}
      </Link>
    );
  }

  return (
    <article
      className={styles.learningActivityCard}
      data-activity={activityKey}
      data-selected={selected ? "true" : "false"}
      aria-labelledby={headingId}
    >
      {content(
        <button
          type="button"
          className={styles.learningActivityAction}
          onClick={onAction}
          aria-describedby={`${goalId} ${descriptionId}`}
          aria-pressed={selected}
        >
          {action}
        </button>,
      )}
    </article>
  );
}
