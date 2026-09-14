import { notFound, redirect } from "next/navigation";
import { getCurrentAppUser } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";
import LessonBuilderClient from "@/app/student/lesson-builder/LessonBuilderClient";

type PageProps = {
  params: Promise<{
    userId: string;
  }>;
};

export default async function AdminLessonBuilderPreviewPage({
  params,
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

  return (
    <LessonBuilderClient
      navBasePath={`/admin/users/${targetUser.id}`}
    />
  );
}
export const dynamic = "force-dynamic";
