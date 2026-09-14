import LessonBuilderClient from "@/app/student/lesson-builder/LessonBuilderClient";

export const dynamic = "force-dynamic";

export default function DemoStudentLessonBuilderPage() {
  return <LessonBuilderClient navBasePath="/demo/student" enableWorkspaceSync={false} />;
}
