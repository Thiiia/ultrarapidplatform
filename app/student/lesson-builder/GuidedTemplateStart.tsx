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
        <p style={{ margin: 0, color: "#CFFF04", fontWeight: 800, letterSpacing: ".08em", textTransform: "uppercase" }}>Safe to play</p>
        <h1 id="guided-template-title" style={{ margin: 0, fontSize: "clamp(28px, 5vw, 42px)" }}>Your lesson is ready to play</h1>
        <p style={{ margin: 0, color: "#D1D5DB", lineHeight: 1.5 }}>This is a safe starter template. Your changes are a private copy until you publish.</p>
        <p style={{ margin: 0, color: "#FFFFFFB3" }}>{encounterCount} encounter{encounterCount === 1 ? "" : "s"} are ready.</p>
        <button type="button" onClick={onPlayTemplate} style={{ border: 0, borderRadius: 999, background: "#CFFF04", color: "#071222", padding: "14px 20px", fontWeight: 900, cursor: "pointer" }}>Play template</button>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 }}>
          <button type="button" onClick={onChangeEvent} style={secondary}>Change event 1</button>
          <button type="button" onClick={onAddEquation} style={secondary}>Add one equation</button>
        </div>
        <button type="button" onClick={onUseAdvanced} style={{ ...secondary, borderColor: "#CFFF04" }}>Use advanced chartmaker</button>
      </div>
    </section>
  );
}

const secondary = { border: "1px solid #7A8FA8", borderRadius: 12, background: "transparent", color: "#FFFFFF", padding: "12px 10px", fontWeight: 800, cursor: "pointer" };
