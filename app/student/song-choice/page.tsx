import { redirect } from "next/navigation";
import { getCurrentAppUser } from "@/lib/current-user";
import { getSongChoices } from "@/lib/song-storage";
import SongChoiceClient from "./SongChoiceClient";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{
    activity?: string | string[];
  }>;
};

export default async function StudentSongChoicePage({ searchParams }: PageProps) {
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

  const params = await searchParams;
  const activityParam = Array.isArray(params.activity)
    ? params.activity[0]
    : params.activity;
  const songs = await getSongChoices(activityParam, user.id);

  return (
    <SongChoiceClient
      songs={songs}
      navBasePath="/student"
      dashboardType="student"
    />
  );
}