import { redirect } from "next/navigation";
import TeamEditorClient from "./TeamEditorClient";
import { getCurrentAppUser } from "@/lib/current-user";
import { getSongChoices } from "@/lib/song-storage";
import { canAccessTeamPreview } from "@/lib/team-preview-access";

export const dynamic = "force-dynamic";

export default async function TeamEditorPage() {
  const user = await getCurrentAppUser();

  if (!user) {
    redirect("/login");
  }

  if (!canAccessTeamPreview(user)) {
    redirect(user.role === "student" ? "/student" : "/login");
  }

  const songs = await getSongChoices();
  const navBasePath = user.role === "admin" ? "/admin" : "/teacher";

  return (
    <TeamEditorClient
      navBasePath={navBasePath}
      songs={songs}
      launchPath="/team/game"
    />
  );
}
