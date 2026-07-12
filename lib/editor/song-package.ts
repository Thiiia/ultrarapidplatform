type Fetcher = (url: string) => Promise<Response>;

type SongPackageInput = {
  chartUrl: string;
  sidecarUrl?: string | null;
  audioUrl?: string | null;
};

export type LoadedSongPackage = {
  chartText: string;
  sidecarJson: unknown | null;
  audioBlob: Blob | null;
  audioError: string | null;
};

async function loadTextFile(
  url: string,
  label: string,
  fetcher: Fetcher,
) {
  const response = await fetcher(url);

  if (!response.ok) {
    throw new Error(`Unable to load ${label}: ${response.status}`);
  }

  return response.text();
}

async function loadJsonFile(url: string, fetcher: Fetcher) {
  const response = await fetcher(url);

  if (!response.ok) {
    throw new Error(`Unable to load sidecar JSON: ${response.status}`);
  }

  return response.json();
}

async function loadOptionalAudio(url: string | null | undefined, fetcher: Fetcher) {
  if (!url) {
    return { audioBlob: null, audioError: null };
  }

  try {
    const response = await fetcher(url);

    if (!response.ok) {
      throw new Error(`Unable to load audio file: ${response.status}`);
    }

    return { audioBlob: await response.blob(), audioError: null };
  } catch (error) {
    return {
      audioBlob: null,
      audioError:
        error instanceof Error ? error.message : "Unable to load audio file",
    };
  }
}

export async function loadSongPackageAssets(
  { chartUrl, sidecarUrl, audioUrl }: SongPackageInput,
  fetcher: Fetcher = fetch,
): Promise<LoadedSongPackage> {
  const [chartText, sidecarJson, audio] = await Promise.all([
    loadTextFile(chartUrl, "chart file", fetcher),
    sidecarUrl ? loadJsonFile(sidecarUrl, fetcher) : Promise.resolve(null),
    loadOptionalAudio(audioUrl, fetcher),
  ]);

  return {
    chartText,
    sidecarJson,
    ...audio,
  };
}
