import { redirect } from "next/navigation";
import { getCurrentAppUser } from "@/lib/current-user";
import GameEmbedPage from "@/app/student/game/GameEmbedPage";

export default async function TeacherGamePage() {
  const user = await getCurrentAppUser();

  if (!user) {
    redirect("/login");
  }

  if (user.role === "admin") {
    redirect("/admin");
  }

  if (user.role !== "teacher") {
    redirect("/student");
  }

  return <GameEmbedPage navBasePath="/teacher" />;
}