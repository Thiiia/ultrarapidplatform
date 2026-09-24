import { getSongChoicesForCreation } from "@/lib/song-storage";
import SongChoiceClient from "@/app/student/song-choice/SongChoiceClient";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{
    activity?: string | string[];
  }>;
};

export default async function DemoTeacherSongChoicePage({ searchParams }: PageProps) {
  const params = await searchParams;
  const activityParam = Array.isArray(params.activity)
    ? params.activity[0]
    : params.activity;
  const songs = await getSongChoicesForCreation(activityParam);

  return (
    <SongChoiceClient
      songs={songs}
      navBasePath="/demo/teacher"
      dashboardType="teacher"
    />
  );
}
