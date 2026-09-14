import { notFound, redirect } from "next/navigation";
import { getCurrentAppUser } from "@/lib/current-user";
import { getSongChoices } from "@/lib/song-storage";
import { prisma } from "@/lib/prisma";
import SongChoiceClient from "@/app/student/song-choice/SongChoiceClient";

type PageProps = {
  params: Promise<{
    userId: string;
  }>;
  searchParams: Promise<{
    activity?: string | string[];
  }>;
};

export default async function AdminSongChoicePreviewPage({
  params,
  searchParams,
}: PageProps) {
  const adminUser = await getCurrentAppUser();

  if (!adminUser) {
    redirect("/login");
  }

  if (adminUser.role !== "admin") {
    redirect(`/${adminUser.role}`);
  }

  const { userId } = await params;

  const targetUser = await prisma.user.findUnique({
    where: {
      id: userId,
    },
  });

  if (!targetUser || (targetUser.role !== "student" && targetUser.role !== "teacher")) {
    notFound();
  }

  const query = await searchParams;
  const activityParam = Array.isArray(query.activity)
    ? query.activity[0]
    : query.activity;
  const songs = await getSongChoices(activityParam);

  return (
    <SongChoiceClient
      songs={songs}
      navBasePath={`/admin/users/${targetUser.id}`}
    />
  );
}
export const dynamic = "force-dynamic";
