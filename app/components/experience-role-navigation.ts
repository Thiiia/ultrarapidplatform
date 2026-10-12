import type { ExperienceRoleNavigationItem } from "@/app/components/ExperienceRoleHeader";
import { studentCopy } from "@/lib/student-copy";

export function getStudentRoleNavigationItems(
  navBasePath = "/student",
): ExperienceRoleNavigationItem[] {
  return [
    {
      label: "Home",
      href: navBasePath,
      icon: "home",
      matchNested: false,
    },
    {
      label: studentCopy.navigation.lessons,
      href: `${navBasePath}/lessons`,
      icon: "lessons",
    },
    {
      label: studentCopy.navigation.builder,
      href: `${navBasePath}/song-choice`,
      icon: "builder",
      activePaths: [`${navBasePath}/lesson-builder`],
    },
    {
      label: studentCopy.navigation.progress,
      href: `${navBasePath}/progress`,
      icon: "progress",
    },
    {
      label: studentCopy.navigation.play,
      href: `${navBasePath}/game`,
      icon: "play",
      matchNested: false,
    },
  ];
}

export function getTeacherRoleNavigationItems(
  navBasePath = "/teacher",
): ExperienceRoleNavigationItem[] {
  return [
    { label: "Home", href: navBasePath, icon: "home", matchNested: false },
    {
      label: "Assignments",
      href: `${navBasePath}/assignments`,
      icon: "assignments",
    },
    { label: "Classes", href: `${navBasePath}/classes`, icon: "classes" },
    { label: "Lessons", href: `${navBasePath}/lessons`, icon: "lessons" },
    {
      label: "Lesson Builder",
      href: `${navBasePath}/song-choice`,
      icon: "builder",
    },
    { label: "Progress", href: `${navBasePath}/progress`, icon: "progress" },
  ];
}
