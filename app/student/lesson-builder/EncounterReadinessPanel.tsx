import type { LessonPublishReadiness } from "@/lib/guided-authored-encounter";

export type EncounterReadinessPanelProps = {
  readiness: LessonPublishReadiness;
  hasSong: boolean;
  canPublish: boolean;
  canPlay: boolean;
  onSelectEncounter: (encounterId: string) => void;
};

export function EncounterReadinessPanel({
  readiness,
  hasSong,
  canPublish,
  canPlay,
  onSelectEncounter,
}: EncounterReadinessPanelProps) {
  const contentReady = readiness.ready;
  const fullyReady = contentReady && hasSong && canPublish && canPlay;
  const statusLabel = !hasSong
    ? "Choose a song"
    : !contentReady
      ? `${readiness.blockers.length} blocker${readiness.blockers.length === 1 ? "" : "s"}`
      : !canPlay
        ? "Play unavailable"
        : !canPublish
          ? "Publish unavailable"
          : "Ready";

  return (
    <aside
      aria-label="Encounter readiness"
      style={{
        position: "sticky",
        bottom: 12,
        zIndex: 10,
        display: "grid",
        gap: 8,
        padding: 12,
        borderRadius: 12,
        border: `1px solid ${fullyReady ? "#CFFF04" : "#FFCB6B"}`,
        background: "#0A1222F5",
        color: "#FFFFFF",
        boxShadow: "0 12px 30px rgba(0,0,0,.3)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
        <strong>Lesson check</strong>
        <span style={{ color: fullyReady ? "#CFFF04" : "#FFCB6B", fontSize: 11, fontWeight: 900 }}>
          {statusLabel}
        </span>
      </div>
      {!hasSong ? (
        <div style={{ color: "#FFFFFFB3", fontSize: 11 }}>
          Choose a song before publishing or playing this lesson.
        </div>
      ) : !contentReady ? (
        <div style={{ display: "grid", gap: 5 }}>
          {readiness.blockers.map((blocker) => (
            <button key={`${blocker.encounterId}-${blocker.code}`} type="button" onClick={() => onSelectEncounter(blocker.encounterId)} style={{ border: 0, background: "transparent", color: "#FFFFFF", padding: "4px 0", textAlign: "left", cursor: "pointer", fontSize: 11, fontWeight: 700 }}>
              {blocker.message} {blocker.nextAction}
            </button>
          ))}
        </div>
      ) : fullyReady ? (
        <div style={{ color: "#FFFFFFB3", fontSize: 11 }}>Publish and Play are available.</div>
      ) : (
        <div style={{ color: "#FFFFFFB3", fontSize: 11 }}>
          {canPublish
            ? "Publishing is available, but Play is waiting for the song files."
            : "Finish loading the selected lesson before publishing."}
        </div>
      )}
    </aside>
  );
}
