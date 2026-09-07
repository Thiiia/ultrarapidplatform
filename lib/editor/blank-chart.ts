// Blank starter chart/sidecar content used whenever a user has not yet authored
// a chart for a given song + activity combination. Mirrors the shape produced by
// projectToChart()/chartToProject() for an empty project so the editor can hydrate it directly.
export const BLANK_CHART_TEXT = `[Song]
{
  Name = "Untitled Song"
  Artist = "Unknown Artist"
  Resolution = "240"
}

[SyncTrack]
{
  0 = B 120000
}

[Events]
{
}

[ExpertSingle]
{
}`;

export const BLANK_SIDECAR_JSON = JSON.stringify(
  { version: 1, events: [] },
  null,
  2,
);
