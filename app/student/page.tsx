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
        background:
          "linear-gradient(180deg, #030E14 0%, #000000 100%), linear-gradient(180deg, #082733 0%, #000000 37.5%)",
        backgroundBlendMode: "normal",
        color: "#FFFFFF",
        display: "grid",
        placeItems: "center",
        padding: 24,
        boxSizing: "border-box",
      }}
    >
      <section
        aria-label="Landing panel"
        style={{
          width: "35vw",
          maxWidth: 620,
          minWidth: 360,
          height: "65vh",
          maxHeight: 607,
          minHeight: 520,
          background: "transparent",
          border: "1px solid #FFFFFF14",
          borderRadius: 18,
          padding: "42px 34px",
          boxSizing: "border-box",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
        }}
      >
        <img
          src="/Logo.svg"
          alt="UltraRapid"
          style={{
            width: 220,
            height: "auto",
            display: "block",
            marginBottom: 28,
          }}
        />

        <p
          style={{
            margin: 0,
            color: "#FFFFFF",
            fontFamily: "Space Grotesk, sans-serif",
            fontSize: 15,
            fontWeight: 500,
            lineHeight: "20px",
            letterSpacing: 0,
            textAlign: "center",
            whiteSpace: "nowrap",
            width: "100%",
          }}
        >
          Making the curriculum stick with beat-matching
        </p>

        <div
          style={{
            width: "100%",
            marginTop: "auto",
            display: "flex",
            flexDirection: "column",
            gap: 14,
          }}
        >
          <Link
            href="/demo/student"
            style={{
              width: "100%",
              minHeight: 50,
              background: "#CFFF04",
              color: "#000000",
              border: "1px solid #CFFF04",
              borderRadius: 12,
              padding: "14px 18px",
              boxSizing: "border-box",
              textDecoration: "none",
              fontSize: 14,
              fontWeight: 700,
              lineHeight: "20px",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              textAlign: "center",
            }}
          >
            Demo Student Dashboard
          </Link>

          <Link
            href="/demo/teacher"
            style={{
              width: "100%",
              minHeight: 50,
              background: "#CFFF04",
              color: "#000000",
              border: "1px solid #CFFF04",
              borderRadius: 12,
              padding: "14px 18px",
              boxSizing: "border-box",
              textDecoration: "none",
              fontSize: 14,
              fontWeight: 700,
              lineHeight: "20px",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              textAlign: "center",
            }}
          >
            Demo Teacher Dashboard
          </Link>
        </div>
      </section>
    </main>
  );
}