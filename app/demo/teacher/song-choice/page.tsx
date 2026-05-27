import { getSongChoices } from "@/lib/song-storage";
import SongChoiceClient from "@/app/student/song-choice/SongChoiceClient";

export const dynamic = "force-dynamic";

export default async function DemoTeacherSongChoicePage() {
  const songs = await getSongChoices();

  return <SongChoiceClient songs={songs} navBasePath="/demo/teacher" />;
}