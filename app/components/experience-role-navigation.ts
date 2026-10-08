import type { ExperienceRoleNavigationItem } from "@/app/components/ExperienceRoleHeader";
import { studentCopy } from "@/lib/student-copy";

import HomeIcon from "@/public/header_icons/Home.svg";
import HomePressedIcon from "@/public/header_icons/Home_pressed.svg";
import MyLessonsTab from "@/public/header_icons/my_lessons_tab.svg";
import MyLessonsPressedTab from "@/public/header_icons/my_lessons_tab_pressed.svg";
import LessonBuilderTab from "@/public/header_icons/lesson_builder_tab.svg";
import LessonBuilderPressedTab from "@/public/header_icons/lesson_builder_tab_pressed.svg";
import ProgressTab from "@/public/header_icons/progress_tab.svg";
import ProgressPressedTab from "@/public/header_icons/progress_tab_pressed.svg";
import PlayTab from "@/public/header_icons/play_tab.svg";
import PlayPressedTab from "@/public/header_icons/play_tab_pressed.svg";

export function getStudentRoleNavigationItems(
  navBasePath = "/student",
): ExperienceRoleNavigationItem[] {
  return [
    {
      label: "Home",
      href: navBasePath,
      Icon: HomeIcon,
      ActiveIcon: HomePressedIcon,
      width: 99,
      matchNested: false,
    },
    {
      label: studentCopy.navigation.lessons,
      href: `${navBasePath}/lessons`,
      Icon: MyLessonsTab,
      ActiveIcon: MyLessonsPressedTab,
      width: 139,
    },
    {
      label: studentCopy.navigation.builder,
      href: `${navBasePath}/song-choice`,
      Icon: LessonBuilderTab,
      ActiveIcon: LessonBuilderPressedTab,
      width: 159,
      activePaths: [`${navBasePath}/lesson-builder`],
    },
    {
      label: studentCopy.navigation.progress,
      href: `${navBasePath}/progress`,
      Icon: ProgressTab,
      ActiveIcon: ProgressPressedTab,
      width: 120,
    },
    {
      label: studentCopy.navigation.play,
      href: `${navBasePath}/game`,
      Icon: PlayTab,
      ActiveIcon: PlayPressedTab,
      width: 99,
      matchNested: false,
    },
  ];
}

export function getTeacherRoleNavigationItems(
  navBasePath = "/teacher",
): ExperienceRoleNavigationItem[] {
  return [
    { label: "Home", href: navBasePath, width: 99, matchNested: false },
    {
      label: "Assignments",
      href: `${navBasePath}/assignments`,
      width: 130,
    },
    { label: "Classes", href: `${navBasePath}/classes`, width: 120 },
    { label: "Lessons", href: `${navBasePath}/lessons`, width: 120 },
    {
      label: "Lesson Builder",
      href: `${navBasePath}/song-choice`,
      width: 159,
    },
    { label: "Progress", href: `${navBasePath}/progress`, width: 120 },
  ];
}
