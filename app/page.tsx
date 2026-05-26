import Link from "next/link";
// import { redirect } from "next/navigation";
// import { getAuth0 } from "@/lib/auth0";

export default async function HomePage() {
  /*
   * Auth0 login flow temporarily disabled.
   *
   * Restore this block when you want Auth0 login back:
   *
   * const session = await getAuth0().getSession();
   *
   * if (!session?.user) {
   *   redirect("/auth/login?returnTo=/api/post-login");
   * }
   *
   * redirect("/api/post-login");
   */

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#191919",
        color: "#FFFFFF",
        display: "grid",
        placeItems: "center",
        padding: 24,
      }}
    >
      <section
        style={{
          width: "100%",
          maxWidth: 760,
          background: "#2B2B2B",
          border: "1px solid #FFFFFF14",
          borderRadius: 18,
          padding: 36,
          boxSizing: "border-box",
          textAlign: "center",
        }}
      >
        <p
          style={{
            margin: "0 0 10px 0",
            color: "#CFFF04",
            fontSize: 13,
            fontWeight: 700,
            letterSpacing: 1.2,
            textTransform: "uppercase",
          }}
        >
          UltraRapid
        </p>

        <h1
          style={{
            margin: "0 0 14px 0",
            color: "#FFFFFF",
            fontSize: 42,
            lineHeight: 1.05,
            fontWeight: 700,
          }}
        >
          Making the curriculum stick with beat-matching
        </h1>

        <p
          style={{
            margin: "0 auto 28px auto",
            color: "#D1D5DB",
            fontSize: 15,
            lineHeight: "23px",
            maxWidth: 560,
          }}
        >
          Choose a demo dashboard below. No login is required.
        </p>

        <div
          style={{
            display: "flex",
            justifyContent: "center",
            gap: 14,
            flexWrap: "wrap",
          }}
        >
          <Link
            href="/demo/student"
            style={{
              minWidth: 220,
              minHeight: 48,
              background: "#CFFF04",
              color: "#191919",
              border: "1px solid #CFFF04",
              borderRadius: 12,
              padding: "13px 18px",
              boxSizing: "border-box",
              textDecoration: "none",
              fontSize: 14,
              fontWeight: 700,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            Demo Student Dashboard
          </Link>

          <Link
            href="/demo/teacher"
            style={{
              minWidth: 220,
              minHeight: 48,
              background: "#191919",
              color: "#FFFFFF",
              border: "1px solid #FFFFFF14",
              borderRadius: 12,
              padding: "13px 18px",
              boxSizing: "border-box",
              textDecoration: "none",
              fontSize: 14,
              fontWeight: 700,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            Demo Teacher Dashboard
          </Link>
        </div>
      </section>
    </main>
  );
}