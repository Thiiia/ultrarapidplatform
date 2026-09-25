type EditorRhythmSource = {
  activityKey: string;
  revision: string;
  chartSha256: string;
  audioSha256: string;
  chart: { signedUrl: string };
};

export type EditorRhythmSourceSongChoice = {
  id: string;
  activityKey: string;
  song: { signedUrl: string };
  sidecar: { signedUrl: string } | null;
  rhythmSources?: EditorRhythmSource[];
};

export function buildEditorRhythmSourceRefreshQuery({
  activityKey,
  authorName,
}: {
  activityKey: string;
  authorName?: string | null;
}): string {
  const query = new URLSearchParams({ context: "editor", activity: activityKey });
  const author = authorName?.trim();
  if (author) query.set("author", author);
  return `/api/song-choice?${query.toString()}`;
}

export function resolveEditorRhythmSourceRefreshUrls(
  songs: readonly EditorRhythmSourceSongChoice[],
  {
    songAssetId,
    targetActivityKey,
    sourceActivityKey,
    sourceRevision,
    sourceChartSha256,
    sourceAudioSha256,
  }: {
    songAssetId: string;
    targetActivityKey: string;
    sourceActivityKey: string;
    sourceRevision: string;
    sourceChartSha256: string;
    sourceAudioSha256: string;
  },
): { audioUrl: string; chartUrl: string; sidecarUrl: string } {
  const song = songs.find(
    (choice) => choice.id === songAssetId && choice.activityKey === targetActivityKey,
  );
  if (!song) {
    throw new Error("The selected Number Bonds song is no longer available. Reload the song list and choose it again.");
  }

  const source = song.rhythmSources?.find(
    (candidate) =>
      candidate.activityKey === sourceActivityKey &&
      candidate.revision === sourceRevision &&
      candidate.chartSha256 === sourceChartSha256 &&
      candidate.audioSha256 === sourceAudioSha256,
  );
  if (!source) {
    throw new Error("The selected rhythm source changed. Choose the rhythm again before editing this lesson.");
  }

  const audioUrl = song.song?.signedUrl?.trim();
  const chartUrl = source.chart?.signedUrl?.trim();
  const sidecarUrl = song.sidecar?.signedUrl?.trim();
  if (!audioUrl || !chartUrl || !sidecarUrl) {
    throw new Error("Lesson refresh did not return complete song, rhythm, and Number Bonds lesson files.");
  }

  return { audioUrl, chartUrl, sidecarUrl };
}
