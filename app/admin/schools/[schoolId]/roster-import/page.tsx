import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import RosterImportClient from "./RosterImportClient";
import styles from "./roster-import.module.css";

export const dynamic = "force-dynamic";

export default async function RosterImportPage({
  params,
}: {
  params: Promise<{ schoolId: string }>;
}) {
  const admin = await requireAdmin();
  if (!admin) redirect("/login");

  const { schoolId } = await params;
  const school = await prisma.school.findUnique({
    where: { id: schoolId },
    select: { id: true, name: true, city: true },
  });
  if (!school) notFound();

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <header className={styles.header}>
          <div>
            <Link href="/admin" className={styles.backLink}>Back to admin</Link>
            <h1>Roster import</h1>
            <p>{school.name}{school.city ? ` · ${school.city}` : ""}</p>
          </div>
        </header>
        <RosterImportClient schoolId={school.id} />
      </div>
    </main>
  );
}