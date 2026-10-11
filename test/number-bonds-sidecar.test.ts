import assert from "node:assert/strict";
import test from "node:test";
import {
  buildEarlyAlgebraEncounterSidecarFilename,
  buildNumberBondsEncounterSidecarFilename,
  earlyAlgebraSidecarPathMatchesSelection,
  getEarlyAlgebraDifficultyFromSidecarPath,
  getNumberBondsDifficultyFromSidecarPath,
  isLegacyEarlyAlgebraSidecarPathForSong,
  isLegacyNumberBondsSidecarPathForSong,
  isLegacySidecarCompanionForChart,
  selectEarlyAlgebraSidecarRevision,
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

test("Early Algebra sidecar identity maps song and difficulty without accepting another activity", () => {
  const filename = buildEarlyAlgebraEncounterSidecarFilename("Garden", "HardSingle");
  assert.equal(filename, "early-algebra-garden-HardSingle.encounters.json");
  assert.equal(getEarlyAlgebraDifficultyFromSidecarPath(`Early_Algebra/revisions/r1/${filename}`, "garden"), "HardSingle");
  assert.equal(getEarlyAlgebraDifficultyFromSidecarPath("Early_Algebra/garden.json", "garden"), null);
  assert.equal(getEarlyAlgebraDifficultyFromSidecarPath("Number_Bonds/number-bonds-garden-HardSingle.encounters.json", "garden"), null);
  assert.equal(earlyAlgebraSidecarPathMatchesSelection({
    sidecarPath: `Early_Algebra/${filename}`,
    songAssetId: "garden",
    rhythmDifficultyKey: "HardSingle",
  }), true);
  assert.equal(isLegacyEarlyAlgebraSidecarPathForSong("Early_Algebra/revisions/r1/garden.encounters.json", "garden"), true);
  assert.equal(isLegacyEarlyAlgebraSidecarPathForSong("Early_Algebra/revisions/r1/another-song.encounters.json", "garden"), false);
});

test("Early Algebra launch selection prefers the exact difficulty and only falls back to a READY legacy revision", () => {
  const legacy = { revision: "legacy", status: "ready", sidecarPath: "Early_Algebra/revisions/legacy/garden.json" };
  const easy = { revision: "easy", status: "ready", sidecarPath: "Early_Algebra/revisions/easy/early-algebra-garden-EasySingle.encounters.json" };
  const hard = { revision: "hard", status: "ready", sidecarPath: "Early_Algebra/revisions/hard/early-algebra-garden-HardSingle.encounters.json" };
  const draftLegacy = { revision: "draft", status: "draft", sidecarPath: "Early_Algebra/revisions/draft/garden.json" };

  assert.equal(selectEarlyAlgebraSidecarRevision([easy, hard], "garden", "HardSingle"), hard);
  assert.equal(selectEarlyAlgebraSidecarRevision([legacy, draftLegacy], "garden", "ExpertSingle", { allowLegacyReadyFallback: true }), legacy);
  assert.equal(selectEarlyAlgebraSidecarRevision([draftLegacy], "garden", "ExpertSingle", { allowLegacyReadyFallback: true }), null);
});

test("Early Algebra accepts READY title-named legacy sidecars only when paired with their chart", () => {
  const publishedPairs = [
    ["garden", "Garden.chart", "Garden.encounters.json"],
    ["geminiqueen", "GEMINI QUEEN.chart", "GEMINI QUEEN.encounters.json"],
    ["grudge", "Oogie Grudge.chart", "Oogie Grudge.encounters.json"],
    ["jazzmaybach", "Melika.chart", "Melika.encounters.json"],
    ["justbecause", "Oogie - just because.chart", "Oogie - just because.encounters.json"],
    ["oneone", "one one.chart", "one one.encounters.json"],
    ["seven", "EF - seven.chart", "EF - seven.encounters.json"],
    ["waves", "Grafix - Waves.chart", "Grafix - Waves.encounters.json"],
  ] as const;

  for (const [songAssetId, chartFile, sidecarFile] of publishedPairs) {
    const revision = {
      revision: `${songAssetId}-legacy`,
      status: "ready",
      chartPath: `dev/Early_Algebra/revisions/${songAssetId}/${chartFile}`,
      sidecarPath: `dev/Early_Algebra/revisions/${songAssetId}/${sidecarFile}`,
    };

    assert.equal(isLegacySidecarCompanionForChart(revision.sidecarPath, revision.chartPath), true, songAssetId);
    for (const rhythmDifficultyKey of difficulties) {
      assert.equal(
        selectEarlyAlgebraSidecarRevision([revision], songAssetId, rhythmDifficultyKey, { allowLegacyReadyFallback: true }),
        revision,
        `${songAssetId} should use its READY chart companion for ${rhythmDifficultyKey}`,
      );
    }
  }

  assert.equal(isLegacySidecarCompanionForChart("Garden.encounters.json", "Another Song.chart"), false);
  assert.equal(isLegacySidecarCompanionForChart("early-algebra-garden-HardSingle.encounters.json", "Garden.chart"), false);
  assert.equal(isLegacySidecarCompanionForChart("Garden.encounters.json", "Garden.txt"), false);
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
