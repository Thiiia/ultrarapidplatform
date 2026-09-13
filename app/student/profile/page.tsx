import { redirect } from "next/navigation";
import { getCurrentAppUser } from "@/lib/current-user";
import StudentSubpageShell from "../StudentSubpageShell";

export default async function StudentProfilePage() {
  const user = await getCurrentAppUser();

  if (!user) {
    redirect("/login");
  }

  if (user.role !== "student") {
    redirect(user.role === "admin" ? "/admin" : "/teacher");
  }

  return (
    <StudentSubpageShell
      title="Profile"
      cards={[
        {
          title: user.name?.trim() || "Student",
          description: "Your account is connected to your learning progress and lesson workspace.",
        },
        {
          title: "Learning progress",
          description: "Review completed runs and return to your current learning path.",
          href: "/student/progress",
        },
        {
          title: "Build a lesson",
          description: "Choose a song, shape a player experience, and launch it in Unity.",
          href: "/student/song-choice",
        },
      ]}
    />
  );
}
