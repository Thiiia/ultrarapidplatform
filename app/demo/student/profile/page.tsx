import StudentSubpageShell from "@/app/student/StudentSubpageShell";

export const dynamic = "force-dynamic";

export default function DemoStudentProfilePage() {
  return (
    <StudentSubpageShell
      title="Profile"
      navBasePath="/demo/student"
      cards={[
        {
          title: "Demo student",
          description: "This preview profile keeps your lesson-building and player navigation in the demo workspace.",
        },
        {
          title: "Learning progress",
          description: "Review completed runs and return to the current learning path.",
          href: "/demo/student/progress",
        },
        {
          title: "Build a lesson",
          description: "Choose a song, shape a player experience, and launch it in Unity.",
          href: "/demo/student/song-choice",
        },
      ]}
    />
  );
}
