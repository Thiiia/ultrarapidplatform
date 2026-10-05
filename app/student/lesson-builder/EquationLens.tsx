import styles from "./EquationLens.module.css";
import Image from "next/image";

type CueMechanic = "hit" | "spin" | "drag";

export function CalibrationGem() {
  return (
    <span className={styles.gem} aria-hidden="true">
      <Image className={styles.gemDefault} src="/assets/experience/gem-default.png" width={324} height={328} alt="" unoptimized />
      <Image className={styles.gemHit} src="/assets/experience/gem-hit.png" width={720} height={433} alt="" unoptimized />
    </span>
  );
}

/** Read-only cue illustration. Timing and judgement remain with the player adapter. */
export function EquationLens({ label, targeted, mechanic, operator }: {
  label: string;
  targeted: boolean;
  mechanic: CueMechanic;
  operator: boolean;
}) {
  if (operator) return <span className={styles.operator}>{label}</span>;

  return (
    <span className={styles.bubble} data-targeted={targeted || undefined} data-mechanic={mechanic}>
      <span className={styles.refraction} />
      <span className={styles.value}>{label}</span>
      {targeted ? (
        <>
          <span className={styles.lens} />
          <svg className={styles.membrane} viewBox="-16 -16 108 108" aria-hidden="true" focusable="false">
            <path className={styles.waterBody} d="M31-9C53-9 71 9 71 31C71 38 68 42 70 46C83 59 76 78 62 78C53 78 49 72 45 68C41 64 37 71 31 71C9 71-9 53-9 31S9-9 31-9Z" />
            <path className={styles.waterLight} d="M-3 24C0 7 14-4 31-4C47-4 59 4 64 16M70 51C79 63 70 74 61 73" />
            <path className={styles.waterEdge} d="M-1 46C7 64 23 69 38 64C44 61 49 66 53 70" />
          </svg>
          <span className={styles.gemCarrier}><CalibrationGem /></span>
        </>
      ) : null}
    </span>
  );
}
