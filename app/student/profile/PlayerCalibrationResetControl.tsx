"use client";

import { useState } from "react";
import { getOrCreateInstallationId } from "@/lib/platform-player-bridge";
import { resetPlayerCalibration } from "@/lib/player-calibration-reset";

export default function PlayerCalibrationResetControl({ isDemoMode }: { isDemoMode: boolean }) {
  const [isResetting, setIsResetting] = useState(false);
  const [status, setStatus] = useState("");

  async function handleReset() {
    if (isResetting) return;
    setIsResetting(true);
    setStatus("");
    try {
      const installationId = getOrCreateInstallationId(window.localStorage);
      await resetPlayerCalibration({
        isDemoMode,
        installationId,
        storage: window.localStorage,
        fetcher: window.fetch.bind(window),
      });
      setStatus("Calibration was reset. The next time you play, this device will ask you to calibrate again.");
    } catch {
      setStatus("We could not reset this device's calibration. Please try again.");
    } finally {
      setIsResetting(false);
    }
  }

  return (
    <section
      aria-labelledby="player-calibration-title"
      style={{
        width: "100%",
        boxSizing: "border-box",
        marginTop: 20,
        padding: "20px 24px",
        border: "1px solid #FFFFFF24",
        borderRadius: 18,
        background: "#FFFFFF08",
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        gap: 12,
      }}
    >
      <h2 id="player-calibration-title" style={{ margin: 0, fontSize: 18, color: "#FFFFFF" }}>
        Timing calibration
      </h2>
      <p style={{ maxWidth: 680, margin: 0, color: "#FFFFFFC7", lineHeight: 1.5 }}>
        Reset this device&apos;s timing calibration. The game will ask you to calibrate again the next time you play.
      </p>
      <button
        type="button"
        onClick={handleReset}
        disabled={isResetting}
        style={{
          minHeight: 44,
          padding: "0 18px",
          border: "1px solid #C5FF00",
          borderRadius: 999,
          background: "transparent",
          color: "#FFFFFF",
          font: "inherit",
          fontWeight: 600,
          cursor: isResetting ? "wait" : "pointer",
          opacity: isResetting ? 0.7 : 1,
        }}
      >
        {isResetting ? "Resetting…" : "Reset timing calibration"}
      </button>
      <p aria-live="polite" role="status" style={{ minHeight: 22, margin: 0, color: "#FFFFFFC7" }}>
        {status}
      </p>
    </section>
  );
}
