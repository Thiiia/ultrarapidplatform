import { redirect } from "next/navigation";
import { getCurrentAppUser } from "@/lib/current-user";
import StudentSubpageShell from "../StudentSubpageShell";

export default async function LessonBuilderPage() {
  const user = await getCurrentAppUser();

  if (!user) {
    redirect("/login");
  }

  if (user.role === "admin") {
    redirect("/admin");
  }

  if (user.role !== "student") {
    redirect("/teacher");
  }

  return (
    <StudentSubpageShell
      title="Lesson Builder"
      cards={[
        {
          title: "Create a Lesson Path",
          description:
            "Select topics, songs, and activities to build a custom learning sequence.",
        },
        {
          title: "Arrange Content",
          description:
            "Choose the order of lessons, quizzes, and practice sessions.",
        },
        {
          title: "Save Your Plan",
          description:
            "Store and reuse custom learning flows for future practice.",
        },
      ]}
    />
  );
}