"use client";

type GuidedTemplateStartProps = {
  encounterCount: number;
  onPlayTemplate: () => void;
  onChangeEvent: () => void;
  onAddEquation: () => void;
  onUseAdvanced: () => void;
};

export default function GuidedTemplateStart({ encounterCount, onPlayTemplate, onChangeEvent, onAddEquation, onUseAdvanced }: GuidedTemplateStartProps) {
  return (
    <section aria-labelledby="guided-template-title" style={{ minHeight: "100%", display: "grid", placeItems: "center", padding: 24, background: "#101820", color: "#FFFFFF" }}>
      <div style={{ width: "min(560px, 100%)", display: "grid", gap: 16, textAlign: "center" }}>
        <p style={{ margin: 0, color: "#CFFF04", fontWeight: 800, letterSpacing: ".08em", textTransform: "uppercase" }}>Ready to play</p>
        <h1 id="guided-template-title" style={{ margin: 0, fontSize: "clamp(28px, 5vw, 42px)" }}>Your starter lesson is ready</h1>
        <p style={{ margin: 0, color: "#D1D5DB", lineHeight: 1.5 }}>Play the prepared lesson, or personalise a copy before you go into the game. The original stays safe.</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 10, textAlign: "left" }}>
          <div style={explanationCard}>
            <strong style={{ color: "#CFFF04" }}>Event</strong>
            <span>An event is a timed moment in the song. Each part inside it is an encounter Unity plays.</span>
          </div>
          <div style={explanationCard}>
            <strong style={{ color: "#CFFF04" }}>Encounter</strong>
            <span>A hit, spin, or drag is one encounter: the playable move you can tune here.</span>
          </div>
        </div>
        <p style={{ margin: 0, color: "#FFFFFFB3" }}>{encounterCount} authored encounter{encounterCount === 1 ? "" : "s"} are ready for this song.</p>
        <p style={{ margin: 0, color: "#FFFFFF99", fontSize: 13, lineHeight: 1.45 }}>After these authored encounters, Unity can continue with its built-in equation bank if the run needs more questions.</p>
        <button type="button" onClick={onPlayTemplate} style={{ border: 0, borderRadius: 999, background: "#CFFF04", color: "#071222", padding: "14px 20px", fontWeight: 900, cursor: "pointer" }}>Play the lesson as-is</button>
        <div style={{ color: "#FFFFFFB3", fontSize: 13, fontWeight: 800 }}>Or change it first</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 }}>
          <button type="button" onClick={onChangeEvent} style={secondary}>Edit first event</button>
          <button type="button" onClick={onAddEquation} style={secondary}>Make an equation</button>
        </div>
        <button type="button" onClick={onUseAdvanced} style={{ ...secondary, borderColor: "#CFFF04" }}>Open all chart tools</button>
      </div>
    </section>
  );
}

const secondary = { border: "1px solid #7A8FA8", borderRadius: 12, background: "transparent", color: "#FFFFFF", padding: "12px 10px", fontWeight: 800, cursor: "pointer" };
const explanationCard = { display: "grid", gap: 4, padding: 12, border: "1px solid #3A506B", borderRadius: 12, background: "#071222", color: "#D1D5DB", fontSize: 13, lineHeight: 1.45 };
