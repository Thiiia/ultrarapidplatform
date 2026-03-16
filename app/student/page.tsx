import Link from "next/link";
import URIcon from "@/public/URIcon.svg";
import HomeIcon from "@/public/Home.svg";

const topTabs = [
  { label: "My Lessons", href: "/student/lessons" },
  { label: "Lesson Builder", href: "/student/lesson-builder" },
  { label: "Progress", href: "/student/progress" },
];

const utilityTabs = [
  { label: "Notifications", href: "/student/notifications" },
  { label: "Settings", href: "/student/settings" },
  { label: "Profile", href: "/student/profile" },
];

type SectionProps = {
  title: string;
  children?: React.ReactNode;
};

function DashboardSection({ title, children }: SectionProps) {
  return (
    <section
      style={{
        background: "#FFFFFF",
        border: "1px solid #374151",
        borderRadius: 16,
        padding: 20,
      }}
    >
      <h2
        style={{
          margin: "0 0 16px 0",
          fontSize: 22,
          fontWeight: 700,
        }}
      >
        {title}
      </h2>
      {children}
    </section>
  );
}

function PlaceholderCard({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div
      style={{
        background: "#1f2937",
        border: "1px solid #374151",
        borderRadius: 12,
        padding: 16,
      }}
    >
      <h3 style={{ margin: "0 0 8px 0", fontSize: 16 }}>{title}</h3>
      <p style={{ margin: 0, color: "#d1d5db", lineHeight: 1.5 }}>{description}</p>
    </div>
  );
}

export default function StudentPage() {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 20,
      }}
    >
      <section
        style={{
          background: "#FFFFFF",
          border: "none",
          borderBottom: "1px solid #D1D5DC",
          borderRadius: 0,
          padding: 16,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        <div
          style={{
            display: "flex",
            gap: 12,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <URIcon
            aria-label="UltraRapid"
            style={{ width: 145.95, height: 35, display: "block" }}
          />

          <Link
            href="/student"
            aria-label="Home"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 81.77,
              height: 45.5,
              borderRadius: 0,
              border: "none",
              background: "#FFFFFF",
              cursor: "pointer",
          }}
>
            <HomeIcon style={{ width: 81.77, height: 45.5, display: "block" }} />
          </Link>

          {topTabs.map((tab) => (
            <Link
              key={tab.label}
              href={tab.href}
              style={{
                textDecoration: "none",
                padding: "12px 12px",
                borderRadius: 0,
                border: "1px solid #4b5563",
                background: "#FFFFFF",
                color: "#ffffff",
                fontWeight: 600,
              }}
            >
              {tab.label}
            </Link>
          ))}
        </div>

        <div
          style={{
            display: "flex",
            gap: 12,
            flexWrap: "wrap",
            marginLeft: "auto",
          }}
        >
          {utilityTabs.map((tab) => (
            <Link
              key={tab.label}
              href={tab.href}
              style={{
                textDecoration: "none",
                padding: "10px 14px",
                borderRadius: 999,
                border: "1px solid #4b5563",
                background: "#1f2937",
                color: "#ffffff",
                fontWeight: 500,
              }}
            >
              {tab.label}
            </Link>
          ))}
        </div>
      </section>

      <DashboardSection title="Welcome Back">
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "2fr 1fr",
            gap: 16,
          }}
        >
          <PlaceholderCard
            title="Ready for your next lesson?"
            description="Pick up where you left off, continue your current assignment, or explore a new song-based learning challenge."
          />
          <PlaceholderCard
            title="Today at a glance"
            description="3 lessons queued, 1 song recommendation, and 2 activities waiting for review."
          />
        </div>
      </DashboardSection>

      <DashboardSection title="Your Learning Queue">
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
            gap: 16,
          }}
        >
          <PlaceholderCard
            title="Lesson 1: Rhythm Basics"
            description="Continue your current lesson and complete the next checkpoint."
          />
          <PlaceholderCard
            title="Lesson 2: Timing Practice"
            description="Build accuracy with short interactive timing drills."
          />
          <PlaceholderCard
            title="Lesson 3: Chord Flow"
            description="Practice transitions and prepare for your next score submission."
          />
        </div>
      </DashboardSection>

      <DashboardSection title="Learning Insights">
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
            gap: 16,
          }}
        >
          <PlaceholderCard title="Hours Played" description="8.5 hours this week" />
          <PlaceholderCard title="Lessons Completed" description="12 total completed" />
          <PlaceholderCard title="Average Score" description="91%" />
          <PlaceholderCard title="Current Streak" description="5 learning days in a row" />
        </div>
      </DashboardSection>

      <DashboardSection title="Choose a subject">
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
            gap: 16,
          }}
        >
          <PlaceholderCard title="Rhythm" description="Strengthen timing, tempo, and consistency." />
          <PlaceholderCard title="Melody" description="Practice pitch movement and musical phrasing." />
          <PlaceholderCard title="Harmony" description="Explore chord progressions and tonal balance." />
          <PlaceholderCard title="Technique" description="Focus on control, speed, and accuracy." />
        </div>
      </DashboardSection>

      <DashboardSection title="Choose a song">
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
            gap: 16,
          }}
        >
          <PlaceholderCard
            title="Song A"
            description="A beginner-friendly track focused on rhythm recognition."
          />
          <PlaceholderCard
            title="Song B"
            description="A mid-level song with timing and coordination challenges."
          />
          <PlaceholderCard
            title="Song C"
            description="A performance-based practice song with score tracking."
          />
        </div>
      </DashboardSection>

      <DashboardSection title="Recommended for You">
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
            gap: 16,
          }}
        >
          <PlaceholderCard
            title="Recommended Lesson"
            description="Based on your recent scores, try a lesson focused on tempo consistency."
          />
          <PlaceholderCard
            title="Recommended Song"
            description="This song matches your current rhythm skill level and recent progress."
          />
          <PlaceholderCard
            title="Recommended Practice Goal"
            description="Spend 20 minutes on timing drills to improve your next assignment score."
          />
        </div>
      </DashboardSection>
    </div>
  );
}