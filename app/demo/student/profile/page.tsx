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
          description: "This preview profile keeps your lessons and progress together.",
        },
        {
          title: "Your progress",
          description: "See lessons you have finished and keep learning.",
          href: "/demo/student/progress",
        },
        {
          title: "Make a lesson",
          description: "Pick a song, shape a game experience, and play it.",
          href: "/demo/student/song-choice",
        },
      ]}
    />
  );
}
