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
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div
        aria-hidden="true"
        style={{
          position: "fixed",
          left: 0,
          right: 0,
          bottom: 0,
          width: "100vw",
          height: "65vh",
          overflow: "hidden",
          zIndex: 0,
          pointerEvents: "none",
          background: "#000000",
        }}
      >
        <iframe
          src="https://player.vimeo.com/video/1154741176?h=bab231ff46&badge=0&autopause=0&player_id=0&app_id=58479&autoplay=1&muted=1&loop=1&background=1"
          allow="autoplay; fullscreen; picture-in-picture; clipboard-write; encrypted-media; web-share"
          referrerPolicy="strict-origin-when-cross-origin"
          title="UltraRapid landing background video"
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            width: "100vw",
            height: "65vh",
            minWidth: "calc(65vh * 1.7778)",
            minHeight: "65vh",
            transform: "translate(-50%, -50%)",
            border: "none",
            objectFit: "cover",
          }}
        />
      </div>

      <div
        aria-hidden="true"
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 1,
          pointerEvents: "none",
          background:
            "linear-gradient(180deg, rgba(3, 14, 20, 0.82) 0%, rgba(0, 0, 0, 0.38) 48%, rgba(0, 0, 0, 0.72) 100%)",
        }}
      />

      <section
        aria-label="Landing panel"
        style={{
          width: "35vw",
          maxWidth: 620,
          minWidth: 360,
          height: "65vh",
          maxHeight: 607,
          minHeight: 520,
          background: "rgba(0, 0, 0, 0.28)",
          backdropFilter: "blur(8px)",
          border: "1px solid #FFFFFF14",
          borderRadius: 18,
          padding: "42px 34px",
          boxSizing: "border-box",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          position: "relative",
          zIndex: 2,
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