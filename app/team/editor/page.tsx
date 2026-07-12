import TeamEditorClient from "./TeamEditorClient";
import { getSongChoices } from "@/lib/song-storage";

export const dynamic = "force-dynamic";

export default async function TeamEditorPage() {
  const songs = await getSongChoices();

  return <TeamEditorClient songs={songs} />
}
