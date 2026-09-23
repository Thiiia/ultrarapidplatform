import type { AuthoredLessonDraft } from "@/lib/authored-lesson";

export const NUMBER_BONDS_JAZZ_RHYTHM_SOURCE = {
  songAssetId: "jazzmaybach",
  sourceActivityKey: "early-algebra",
  sourceRevision: "c9587d12-9a90-4509-9b74-5655caa05ea9",
  chartSha256: "3cb1af7802af390f661bd9d242e52c85cf845331c9d4f43e58112b2862e55bc3",
  audioSha256: "0b4eeff6cafe9b8608f541f378183e95fa75357f2ab29a9b62f103bfbbe2eeb5",
} as const;

// These are real ExpertSingle note ticks from the pinned Jazz rhythm source.
// Each gem also needs its spin and drag after the HIT, so reserve roughly eight
// seconds before the next cue rather than only the HIT judgement window.
export const NUMBER_BONDS_JAZZ_PILOT_HIT_TICKS = [7800, 15360, 23040, 30720, 38400] as const;

const HIT_PADS = ["topLeft", "topRight", "bottomRight", "bottomLeft", "left"] as const;

/** A deterministic draft for the first Number Bonds/Jazz pilot publication. */
export function buildNumberBondsJazzPilotDraft(): AuthoredLessonDraft {
  const equationId = "jazz-nb-bond-5";
  const targetId = `${equationId}-token-0`;

  return {
    version: 3,
    mode: "authored",
    songAssetId: NUMBER_BONDS_JAZZ_RHYTHM_SOURCE.songAssetId,
    activityKey: "number-bonds",
    stopAtSeconds: 56,
    equations: [{
      id: equationId,
      state: "5 = 2 + 3",
      tokens: ["5", "=", "2", "+", "3"].map((label, index) => ({
        id: `${equationId}-token-${index}`,
        label,
      })),
    }],
    encounters: NUMBER_BONDS_JAZZ_PILOT_HIT_TICKS.map((tick, index) => ({
      id: `jazz-nb-hit-${index + 1}`,
      eventId: `jazz-nb-event-${index + 1}`,
      type: "hit" as const,
      equationId,
      startTick: tick,
      endTick: tick,
      hitBubbles: [{
        tokenIndex: 0,
        targetId,
        positions: [HIT_PADS[index]],
        pads: [HIT_PADS[index]],
      }],
    })),
  };
}
