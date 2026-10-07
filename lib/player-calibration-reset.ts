const DemoCalibrationStoragePrefix = "ultrarapid-demo-calibration-v2:";

export function demoCalibrationStorageKey(installationId: string) {
  return `${DemoCalibrationStoragePrefix}${installationId}`;
}

export async function resetPlayerCalibration(options: {
  isDemoMode: boolean;
  installationId: string;
  storage: Pick<Storage, "removeItem">;
  fetcher: typeof fetch;
}) {
  if (options.isDemoMode) {
    options.storage.removeItem(demoCalibrationStorageKey(options.installationId));
    return;
  }

  const response = await options.fetcher(
    `/api/player-calibration?installationId=${encodeURIComponent(options.installationId)}`,
    { method: "DELETE" },
  );
  if (!response.ok) {
    throw new Error("Calibration reset failed");
  }
}
