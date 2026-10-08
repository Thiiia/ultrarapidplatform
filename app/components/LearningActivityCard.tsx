"use client";

import { useId } from "react";
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
  onAction,
  selected,
}: LearningActivityCardProps) {
  const headingId = useId();
  const descriptionId = useId();

  return (
    <article
      className={styles.learningActivityCard}
      data-activity={activityKey}
      data-selected={selected ? "true" : "false"}
      aria-labelledby={headingId}
    >
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
        <span className={styles.learningActivityGoal}>{goal}</span>
        <h3 id={headingId} className={styles.learningActivityTitle}>
          {title}
        </h3>
        <p id={descriptionId} className={styles.learningActivityDescription}>
          {description}
        </p>
        <button
          type="button"
          className={styles.learningActivityAction}
          onClick={onAction}
          aria-describedby={descriptionId}
          aria-pressed={selected === undefined ? undefined : selected}
        >
          <span>{actionLabel}</span>
          <PlayIcon aria-hidden="true" style={{ width: 18, height: 18, flexShrink: 0 }} />
        </button>
      </div>
    </article>
  );
}
