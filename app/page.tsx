import Link from "next/link";
import { getStorageSignedUrl } from "@/lib/storage-media";
// import { redirect } from "next/navigation";
// import { getAuth0 } from "@/lib/auth0";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const videoUrl = await getStorageSignedUrl("Videos", "Bars.mp4");

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
    <>
      <main
        style={{
          minHeight: "100vh",
          width: "100vw",
          background:
            "linear-gradient(180deg, #030E14 0%, #000000 100%), linear-gradient(180deg, #082733 0%, #000000 37.5%)",
          backgroundBlendMode: "normal",
          color: "#FFFFFF",
          display: "grid",
          placeItems: "center",
          padding: 0,
          margin: 0,
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
            opacity: 0,
            animation: "landingVideoFadeIn 1100ms ease-out 120ms forwards",
          }}
        >
          <video
            src={videoUrl ?? undefined}
            autoPlay
            muted
            loop
            playsInline
            title="UltraRapid landing background video"
            style={{
              position: "absolute",
              left: "50%",
              bottom: "-25%",
              width: "115vw",
              height: "72vh",
              minWidth: "calc(72vh * 1.7778)",
              minHeight: "72vh",
              transform: "translateX(-50%)",
              objectFit: "cover",
              filter: "brightness(1.15) contrast(1.08) saturate(1.05)",
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
              "linear-gradient(180deg, rgba(3, 14, 20, 0.82) 0%, rgba(0, 0, 0, 0.30) 48%, rgba(0, 0, 0, 0.72) 100%)",
            opacity: 0,
            animation: "landingUiFadeIn 900ms ease-out 300ms forwards",
          }}
        />

        <section
          aria-label="Landing panel"
          style={{
            width: "30vw",
            maxWidth: 520,
            minWidth: 340,
            height: "52vh",
            maxHeight: 500,
            minHeight: 430,
            background: "rgba(255, 255, 255, 0.10)",
            backdropFilter: "blur(8px)",
            border: "1px solid #FFFFFF14",
            borderRadius: 18,
            padding: "42px 28px",
            boxSizing: "border-box",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            position: "relative",
            zIndex: 2,
            opacity: 0,
            transform: "translateY(12px)",
            animation: "landingUiFadeIn 950ms ease-out 450ms forwards",
          }}
        >
          <img
            src="/Logo.svg"
            alt="UltraRapid"
            style={{
              width: 440,
              maxWidth: "118%",
              height: "auto",
              display: "block",
              marginBottom: 34,
            }}
          />

          <p
            style={{
              margin: 0,
              color: "#FFFFFF",
              fontFamily: "Space Grotesk, sans-serif",
              fontSize: 15,
              fontWeight: 700,
              lineHeight: "20px",
              letterSpacing: 0,
              textAlign: "center",
              whiteSpace: "nowrap",
              width: "100%",
              maxWidth: "100%",
              overflow: "hidden",
              textOverflow: "clip",
            }}
          >
            Making the curriculum stick with beat-matching
          </p>

          <div
            style={{
              width: "86%",
              position: "absolute",
              left: "50%",
              bottom: 34,
              transform: "translateX(-50%)",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <Link
              href="/demo/student"
              style={{
                width: "100%",
                minHeight: 58,
                background: "#CFFF04",
                color: "#000000",
                border: "1px solid #CFFF04",
                borderRadius: 12,
                padding: "16px 18px",
                boxSizing: "border-box",
                textDecoration: "none",
                fontSize: 15,
                fontWeight: 700,
                lineHeight: "22px",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                textAlign: "center",
              }}
            >
              UltraRapid Platform Demo
            </Link>
          </div>
        </section>
      </main>

      <style
        dangerouslySetInnerHTML={{
          __html: `
            html,
            body {
              margin: 0;
              padding: 0;
              width: 100%;
              min-height: 100%;
              background: #000000;
              overflow-x: hidden;
            }

            body {
              overscroll-behavior: none;
            }

            @keyframes landingVideoFadeIn {
              from {
                opacity: 0;
              }

              to {
                opacity: 1;
              }
            }

            @keyframes landingUiFadeIn {
              from {
                opacity: 0;
                transform: translateY(12px);
              }

              to {
                opacity: 1;
                transform: translateY(0);
              }
            }
          `,
        }}
      />
    </>
  );
}