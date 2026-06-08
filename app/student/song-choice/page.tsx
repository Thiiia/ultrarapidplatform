import { redirect } from "next/navigation";
import { getCurrentAppUser } from "@/lib/current-user";
import { getSongChoices } from "@/lib/song-storage";
import SongChoiceClient from "./SongChoiceClient";

export const dynamic = "force-dynamic";

export default async function StudentSongChoicePage() {
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

  const songs = await getSongChoices();

  return (
    <SongChoiceClient
      songs={songs}
      navBasePath="/student"
      dashboardType="student"
    />
  );
}