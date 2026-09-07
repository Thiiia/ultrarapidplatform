import { redirect } from "next/navigation";
import { getCurrentAppUser } from "@/lib/current-user";
import { getSongChoices } from "@/lib/song-storage";
import SongChoiceClient from "@/app/student/song-choice/SongChoiceClient";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{
    activity?: string | string[];
  }>;
};

export default async function TeacherSongChoicePage({ searchParams }: PageProps) {
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

  const params = await searchParams;
  const activityParam = Array.isArray(params.activity)
    ? params.activity[0]
    : params.activity;
  const songs = await getSongChoices(activityParam, { userId: user.id });

  return (
    <SongChoiceClient
      songs={songs}
      navBasePath="/teacher"
      dashboardType="teacher"
    />
  );
}