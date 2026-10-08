import type { StaticImageData } from "next/image";
import numberBondsImage from "@/public/numeracy_icons/number_bonds.png";
import earlyAlgebraImage from "@/public/numeracy_icons/early_algebra.png";
import { studentCopy } from "@/lib/student-copy";

export type LearningActivityKey = "number-bonds" | "early-algebra";

export type LearningActivity = {
  key: LearningActivityKey;
  title: string;
  goal: string;
  description: string;
  icon: StaticImageData;
};

/** Platform's student-facing activity catalogue; add learner-ready activities here. */
export const learningActivities: readonly LearningActivity[] = [
  {
    key: "number-bonds",
    title: "Number Bonds",
    goal: studentCopy.dashboard.gameGoals.numberBonds,
    description: studentCopy.dashboard.gameDescriptions.numberBonds,
    icon: numberBondsImage,
  },
  {
    key: "early-algebra",
    title: "Early Algebra",
    goal: studentCopy.dashboard.gameGoals.earlyAlgebra,
    description: studentCopy.dashboard.gameDescriptions.earlyAlgebra,
    icon: earlyAlgebraImage,
  },
];
