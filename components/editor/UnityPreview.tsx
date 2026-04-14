"use client"

import { useEffect, useRef, useState } from "react"
import { useEditorStore } from "@/lib/editor/editor-store"
import { projectToUnityPreview } from "@/lib/editor/project-to-unity-preview"
import { loadUnityPreview } from "@/lib/editor/unity-bridge"

type UnityPreviewProps = {
  loaderUrl?: string
  dataUrl?: string
  frameworkUrl?: string
  codeUrl?: string
}

function appendUnityLoaderScript(src: string) {
  return new Promise<void>((resolve, reject) => {
    const existing = document.querySelector(`script[data-unity-loader="${src}"]`)
    if (existing) {
      resolve()
      return
    }

    const script = document.createElement("script")
    script.src = src
    script.async = true
    script.dataset.unityLoader = src
    script.onload = () => resolve()
    script.onerror = () => reject(new Error(`Failed to load Unity loader: ${src}`))
    document.body.appendChild(script)
  })
}

export function UnityPreview({
  loaderUrl = "/Build/Build.loader.js",
  dataUrl = "/Build/Build.data",
  frameworkUrl = "/Build/Build.framework.js",
  codeUrl = "/Build/Build.wasm",
}: UnityPreviewProps) {
  const project = useEditorStore((s) => s.project)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const hasInitializedRef = useRef(false)
  const [status, setStatus] = useState("Loading Unity...")
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    let cancelled = false

    async function initUnity() {
      if (hasInitializedRef.current) return
      if (!canvasRef.current) return

      try {
        setStatus("Loading Unity loader...")
        await appendUnityLoaderScript(loaderUrl)

        if (!window.createUnityInstance) {
          throw new Error("Unity loader did not expose createUnityInstance")
        }

        setStatus("Initializing Unity...")
        hasInitializedRef.current = true

        const instance = await window.createUnityInstance(
          canvasRef.current,
          {
            dataUrl,
            frameworkUrl,
            codeUrl,
            streamingAssetsUrl: "StreamingAssets",
            companyName: "Thiiia",
            productName: "Ultrarapid",
            productVersion: "1.0",
          },
          (nextProgress) => {
            if (cancelled) return
            setProgress(nextProgress)
            setStatus(`Loading Unity... ${Math.round(nextProgress * 100)}%`)
          }
        )

        if (cancelled) {
          if (instance.Quit) await instance.Quit()
          return
        }

        window.unityInstance = instance
        setStatus("Unity ready")
      } catch (error) {
        console.error(error)
        setStatus("Failed to load Unity")
      }
    }

    initUnity()

    return () => {
      cancelled = true
    }
  }, [loaderUrl, dataUrl, frameworkUrl, codeUrl])

  useEffect(() => {
    if (!project) return
    if (!window.unityInstance) return

    const timeout = window.setTimeout(() => {
      const payload = projectToUnityPreview(project)
      const sent = loadUnityPreview(payload)
      console.log("Sent Unity preview payload:", sent, payload)
    }, 150)

    return () => window.clearTimeout(timeout)
  }, [project])

  return (
    <div className="rounded-2xl border p-4 space-y-3">
      <div>
        <h2 className="text-lg font-semibold">Gameplay Preview</h2>
        <p className="text-sm text-gray-500">{status}</p>
      </div>

      <div className="aspect-video rounded-xl overflow-hidden border bg-black relative">
        <canvas
          ref={canvasRef}
          id="unity-canvas"
          className="w-full h-full"
        />

        {status !== "Unity ready" ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/50 text-white text-sm gap-3">
            <div>{status}</div>
            <div className="w-2/3 h-2 rounded bg-white/20 overflow-hidden">
              <div
                className="h-full bg-white"
                style={{ width: `${Math.round(progress * 100)}%` }}
              />
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}