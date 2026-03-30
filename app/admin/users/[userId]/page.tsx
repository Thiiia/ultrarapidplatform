import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentAppUser } from "@/lib/current-user";
import StudentDashboard from "@/app/student/StudentDashboard";
import TeacherDashboard from "@/app/teacher/TeacherDashboard";

type Props = {
  params: Promise<{
    userId: string;
  }>;
};

export default async function AdminUserDashboardPage({ params }: Props) {
  const currentUser = await getCurrentAppUser();

  if (!currentUser) {
    redirect("/login");
  }

  if (currentUser.role !== "admin") {
    redirect("/student");
  }

  const { userId } = await params;

  const targetUser = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!targetUser) {
    notFound();
  }

  if (targetUser.role === "student") {
    return <StudentDashboard />;
  }

  if (targetUser.role === "teacher") {
    return (
      <TeacherDashboard
        adminViewing
        viewedUserName={targetUser.name}
        viewedUserEmail={targetUser.email}
      />
    );
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#111827",
        color: "#FFFFFF",
        padding: 32,
      }}
    >
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        <h1>Admin User View</h1>
        <p style={{ color: "#D1D5DB" }}>
          Admin dashboard preview is not available through this route.
        </p>
        <a
          href="/admin"
          style={{
            textDecoration: "none",
            background: "#2563EB",
            color: "#FFFFFF",
            padding: "12px 16px",
            borderRadius: 10,
            fontWeight: 600,
            display: "inline-flex",
          }}
        >
          Back to Admin
        </a>
      </div>
    </main>
  );
}