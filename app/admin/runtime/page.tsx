import Link from "next/link";
import { redirect } from "next/navigation";
import { UnityRuntimeCapabilitiesProvider, UnityRuntimeDiagnosticsPanel } from "@/app/components/UnityRuntimeSupport";
import { getCurrentAppUser } from "@/lib/current-user";

export const dynamic = "force-dynamic";

export default async function AdminRuntimePage() {
  const currentUser = await getCurrentAppUser();

  if (!currentUser) {
    redirect("/login");
  }

  if (currentUser.role !== "admin") {
    redirect(`/${currentUser.role}`);
  }

  return (
    <main style={{ minHeight: "100vh", background: "#111827", color: "#FFFFFF", padding: 32 }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <Link href="/admin" style={{ color: "#D1D5DB", textDecoration: "none" }}>
          ← Back to admin
        </Link>
        <h1 style={{ margin: "24px 0 8px", fontSize: 32 }}>Unity runtime diagnostics</h1>
        <p style={{ margin: "0 0 24px", color: "#9CA3AF", lineHeight: 1.6 }}>
          Technical capability details are visible here for admins. Learner activity cards use simple Play and Coming soon labels.
        </p>
        <section aria-label="Hosted Unity runtime capabilities">
          <UnityRuntimeCapabilitiesProvider>
            <UnityRuntimeDiagnosticsPanel />
          </UnityRuntimeCapabilitiesProvider>
        </section>
      </div>
    </main>
  );
}
