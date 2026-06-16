import TeamEditorClient from "./TeamEditorClient";
import { getSongChoices } from "@/lib/song-storage";

  const songs = await getSongChoices();

export default function TeamEditorPage() {
  return <TeamEditorClient songs={songs} />
}