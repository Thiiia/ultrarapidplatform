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
          description: "Your profile keeps your lessons and progress together.",
        },
        {
          title: "Your progress",
          description: "See lessons you have finished and keep learning.",
          href: "/student/progress",
        },
        {
          title: "Make a lesson",
          description: "Pick a song, shape a game experience, and play it.",
          href: "/student/song-choice",
        },
      ]}
    />
  );
}
export const dynamic = "force-dynamic";
