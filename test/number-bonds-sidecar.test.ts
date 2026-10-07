import assert from "node:assert/strict";
import test from "node:test";
import {
  buildNumberBondsEncounterSidecarFilename,
  getNumberBondsDifficultyFromSidecarPath,
  isLegacyNumberBondsSidecarPathForSong,
  selectNumberBondsSidecarRevision,
  type RhythmDifficultyKey,
} from "../lib/number-bonds-sidecar";

const songs = [
  "waves",
  "jazzmaybach",
  "grudge",
  "geminiqueen",
  "justbecause",
  "seven",
  "oneone",
  "garden",
] as const;

const difficulties: RhythmDifficultyKey[] = [
  "EasySingle",
  "MediumSingle",
  "HardSingle",
  "ExpertSingle",
];

test("Number Bonds sidecar basenames map every supported song and difficulty", () => {
  for (const songAssetId of songs) {
    for (const rhythmDifficultyKey of difficulties) {
      const basename = buildNumberBondsEncounterSidecarFilename(songAssetId, rhythmDifficultyKey);
      assert.equal(
        basename,
        `number-bonds-${songAssetId}-${rhythmDifficultyKey}.encounters.json`,
      );
      assert.equal(
        getNumberBondsDifficultyFromSidecarPath(`Charts/NumberBonds/${basename}`, songAssetId),
        rhythmDifficultyKey,
      );
    }
  }
});

test("sidecar identity rejects another song, difficulty spelling, or activity sidecar", () => {
  assert.equal(
    getNumberBondsDifficultyFromSidecarPath(
      "Charts/NumberBonds/number-bonds-waves-HardSingle.encounters.json",
      "jazzmaybach",
    ),
    null,
  );
  assert.equal(
    getNumberBondsDifficultyFromSidecarPath(
      "Charts/NumberBonds/number-bonds-waves-hardsingle.encounters.json",
      "waves",
    ),
    null,
  );
  assert.equal(getNumberBondsDifficultyFromSidecarPath("Early_Algebra/waves.json", "waves"), null);
  assert.throws(() => buildNumberBondsEncounterSidecarFilename("unknown-song", "ExpertSingle"), /Unsupported/);
});

test("launch selection picks the immutable revision whose sidecar matches the selected song and difficulty", () => {
  const newest = { revision: "newest-easy", sidecarPath: "Number_Bonds/revisions/easy/number-bonds-waves-EasySingle.encounters.json" };
  const selected = { revision: "selected-hard", sidecarPath: "Number_Bonds/revisions/hard/number-bonds-waves-HardSingle.encounters.json" };

  assert.equal(selectNumberBondsSidecarRevision([newest, selected], "waves", "HardSingle"), selected);
  assert.equal(selectNumberBondsSidecarRevision([newest], "waves", "HardSingle"), null);
});

test("unpinned launch prefers an exact revision, then allows only a READY generic legacy revision", () => {
  const legacyReady = { revision: "legacy-ready", status: "ready", sidecarPath: "Number_Bonds/revisions/legacy/waves.json" };
  const legacyDraft = { revision: "legacy-draft", status: "draft", sidecarPath: "Number_Bonds/revisions/draft/waves.json" };
  const exact = { revision: "newest-exact", status: "ready", sidecarPath: "Number_Bonds/revisions/exact/number-bonds-waves-HardSingle.encounters.json" };

  assert.equal(selectNumberBondsSidecarRevision(
    [legacyReady, legacyDraft], "waves", "HardSingle", { allowLegacyReadyFallback: true },
  ), legacyReady);
  assert.equal(selectNumberBondsSidecarRevision(
    [legacyReady, exact], "waves", "HardSingle", { allowLegacyReadyFallback: true },
  ), exact);
  assert.equal(selectNumberBondsSidecarRevision(
    [legacyReady], "waves", "HardSingle",
  ), null, "a pinned lookup must not substitute another revision");
  assert.equal(selectNumberBondsSidecarRevision(
    [legacyDraft], "waves", "HardSingle", { allowLegacyReadyFallback: true },
  ), null, "legacy draft rows are not a READY fallback");
  assert.equal(isLegacyNumberBondsSidecarPathForSong("Number_Bonds/revisions/r1/waves.encounters.json", "waves"), true);
  assert.equal(isLegacyNumberBondsSidecarPathForSong("Number_Bonds/revisions/r1/jazzmaybach.json", "waves"), false);
});
