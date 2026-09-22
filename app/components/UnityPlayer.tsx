"use client";

import { useEffect, useRef, useState } from "react";

type UnityPlayerProps = {
  launchPayload?: {
    userId?: string;
    sessionToken?: string;
    levelId?: string;
  };
};

export default function UnityPlayer({ launchPayload }: UnityPlayerProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const unityRef = useRef<UnityInstance | null>(null);
  const launchPayloadRef = useRef(launchPayload);
  const hasStartedRef = useRef(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    launchPayloadRef.current = launchPayload;

    if (unityRef.current && launchPayload) {
      unityRef.current.SendMessage?.(
        "GameManager",
        "ReceiveLaunchPayload",
        JSON.stringify(launchPayload),
      );
    }
  }, [launchPayload]);

  useEffect(() => {
    let cancelled = false;
    let scriptEl: HTMLScriptElement | null = document.querySelector(
      'script[data-unity-loader="true"]'
    );

    async function loadUnity() {
      if (hasStartedRef.current) return;
      hasStartedRef.current = true;

      try {
        setStatus("loading");
        setError(null);

        if (!scriptEl) {
          scriptEl = document.createElement("script");
          scriptEl.src = "/unity/Build/ultrarapid.loader.js";
          scriptEl.async = true;
          scriptEl.dataset.unityLoader = "true";

          await new Promise<void>((resolve, reject) => {
            scriptEl!.onload = () => resolve();
            scriptEl!.onerror = () =>
              reject(new Error(`Could not load Unity loader script at ${scriptEl?.src}`));
            document.body.appendChild(scriptEl!);
          });
        }

        if (!window.createUnityInstance) {
          throw new Error("Unity loader did not expose createUnityInstance().");
        }

        if (!canvasRef.current) {
          throw new Error("Canvas element not found.");
        }

        const instance = await window.createUnityInstance(
          canvasRef.current,
          {
            dataUrl: "/unity/Build/ultrarapid.data.unityweb",
            frameworkUrl: "/unity/Build/ultrarapid.framework.js.unityweb",
            codeUrl: "/unity/Build/ultrarapid.wasm.unityweb",
            streamingAssetsUrl: "/unity/StreamingAssets",
            companyName: "YourCompany",
            productName: "UltraRapid",
            productVersion: "1.0.1",
            devicePixelRatio: window.devicePixelRatio || 1,
            autoSyncPersistentDataPath: true,
          },
          (value: number) => {
            if (!cancelled) setProgress(value);
          }
        );

        if (cancelled) {
          await instance.Quit?.();
          return;
        }

        unityRef.current = instance;
        window.unityInstance = instance;
        setStatus("ready");

        if (launchPayloadRef.current) {
          unityRef.current?.SendMessage?.(
            "GameManager",
            "ReceiveLaunchPayload",
            JSON.stringify(launchPayloadRef.current),
          );
        }
      } catch (err: unknown) {
        if (cancelled) return;

        const message =
          err instanceof Error
            ? err.message
            : typeof err === "string"
              ? err
              : String(err);

        // Ignore cancellation-style aborts caused by teardown/navigation
        if (
          message.includes("AbortError") ||
          message.includes("aborted a request") ||
          message.includes("user aborted")
        ) {
          console.warn("Unity load was aborted during teardown/navigation.");
          return;
        }

        console.error("Unity load error:", err);
        setStatus("error");
        setError(message);
      }
    }

    loadUnity();

    return () => {
      cancelled = true;

      const instance = unityRef.current;
      unityRef.current = null;

      if (window.unityInstance === instance) {
        window.unityInstance = undefined;
      }

      if (instance?.Quit) {
        void instance.Quit();
      }
    };
  }, []);

  const startGame = () => {
    unityRef.current?.SendMessage?.("GameManager", "StartGame", "");
  };

  const openFullscreen = () => {
    unityRef.current?.SetFullscreen?.(1);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded border p-3 text-sm">
        {status === "loading" && <span>Loading Unity: {Math.round(progress * 100)}%</span>}
        {status === "ready" && <span>Unity is ready.</span>}
        {status === "error" && <span>Error: {error}</span>}
        {status === "idle" && <span>Preparing Unity…</span>}
      </div>

      <div className="overflow-hidden rounded-xl border bg-black">
        <canvas
          ref={canvasRef}
          id="unity-canvas"
          width={1280}
          height={720}
          className="block h-auto w-full"
        />
      </div>

      <div className="flex gap-3">
        <button
          type="button"
          onClick={startGame}
          disabled={status !== "ready"}
          className="rounded border px-4 py-2 disabled:opacity-50"
        >
          Start Game
        </button>

        <button
          type="button"
          onClick={openFullscreen}
          disabled={status !== "ready"}
          className="rounded border px-4 py-2 disabled:opacity-50"
        >
          Fullscreen
        </button>
      </div>
    </div>
  );
}
