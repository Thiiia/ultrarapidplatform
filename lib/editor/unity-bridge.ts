const GAME_OBJECT = "WebEditorBridge"

export function sendUnityMessage(method: string, value?: string) {
  if (typeof window === "undefined") return false

  const unity = window.unityInstance
  if (!unity?.SendMessage) return false

  if (value === undefined) {
    unity.SendMessage(GAME_OBJECT, method)
  } else {
    unity.SendMessage(GAME_OBJECT, method, value)
  }

  return true
}

export function loadUnityChart(chartText: string) {
  return sendUnityMessage("LoadChartText", chartText)
}

export function startUnityEditorPreview() {
  return sendUnityMessage("StartEditorPreview")
}

export function loadUnityPreview(json: string) {
  return sendUnityMessage("LoadPreviewJson", json)
}

export function setUnityPlayheadTick(tick: number) {
  return sendUnityMessage("SetPlayheadTick", String(tick))
}

export function playUnityPreview() {
  return sendUnityMessage("PlayPreview")
}

export function pauseUnityPreview() {
  return sendUnityMessage("PausePreview")
}