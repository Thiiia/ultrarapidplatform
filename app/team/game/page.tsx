import { notFound, redirect } from "next/navigation";
import GameEmbedPage from "@/app/student/game/GameEmbedPage";
import { getCurrentAppUser } from "@/lib/current-user";
import { createSongLaunchSearchParams } from "@/lib/platform-launch";
import { getSongLaunchPayload } from "@/lib/song-storage";
import { canAccessTeamPreview } from "@/lib/team-preview-access";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type TeamGamePreviewPageProps = {
  searchParams: Promise<{
    songAssetId?: string | string[];
  }>;
};

export default async function TeamGamePreviewPage({
  searchParams,
}: TeamGamePreviewPageProps) {
  const user = await getCurrentAppUser();

  if (!user) {
    redirect("/login");
  }

  if (!canAccessTeamPreview(user)) {
    redirect(user.role === "student" ? "/student" : "/login");
  }

  const requestedSongAssetId = (await searchParams).songAssetId;

  if (typeof requestedSongAssetId !== "string") {
    notFound();
  }

  const launchInput = await getSongLaunchPayload(requestedSongAssetId);

  if (!launchInput) {
    notFound();
  }

  const launchSearch = createSongLaunchSearchParams(launchInput).toString();
  const playHref = `/team/game?${new URLSearchParams({
    songAssetId: requestedSongAssetId,
  }).toString()}`;
  const navBasePath = user.role === "admin" ? "/admin" : "/teacher";

  return (
    <GameEmbedPage
      navBasePath={navBasePath}
      launchSearch={launchSearch}
      playHref={playHref}
    />
  );
}
