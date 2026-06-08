import { redirect } from "next/navigation";
import { getCurrentAppUser } from "@/lib/current-user";
import { getSongChoices } from "@/lib/song-storage";
import SongChoiceClient from "@/app/student/song-choice/SongChoiceClient";

export const dynamic = "force-dynamic";

export default async function TeacherSongChoicePage() {
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

  const songs = await getSongChoices();

  return (
    <SongChoiceClient
      songs={songs}
      navBasePath="/teacher"
      dashboardType="teacher"
    />
  );
}