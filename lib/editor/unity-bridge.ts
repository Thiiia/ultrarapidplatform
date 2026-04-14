import { UnityPreviewPayload } from "./types"

const GAME_OBJECT = "WebEditorBridge"

export function sendUnityMessage(method: string, value?: string | number) {
  if (typeof window === "undefined") return false

  const unity = window.unityInstance
  if (!unity?.SendMessage) return false

  unity.SendMessage(GAME_OBJECT, method, value)
  return true
}

export function loadUnityPreview(payload: UnityPreviewPayload) {
  return sendUnityMessage("LoadPreviewJson", JSON.stringify(payload))
}

export function loadUnityChart(chartText: string) {
  return sendUnityMessage("LoadChartText", chartText)
}

export function setUnityPlayheadTick(tick: number) {
  return sendUnityMessage("SetPlayheadTick", tick)
}

export function playUnityPreview() {
  return sendUnityMessage("PlayPreview")
}

export function pauseUnityPreview() {
  return sendUnityMessage("PausePreview")
}