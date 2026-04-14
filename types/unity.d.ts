export {}

declare global {
  interface UnityInstance {
    SendMessage?: (
      gameObjectName: string,
      methodName: string,
      parameter?: string | number
    ) => void
    Quit?: () => Promise<void>
    SetFullscreen?: (enabled: number) => void
  }

  interface UnityConfig {
    dataUrl: string
    frameworkUrl: string
    codeUrl: string
    streamingAssetsUrl?: string
    companyName?: string
    productName?: string
    productVersion?: string
    devicePixelRatio?: number
  }

  interface Window {
    createUnityInstance?: (
      canvas: HTMLCanvasElement,
      config: UnityConfig,
      onProgress?: (progress: number) => void
    ) => Promise<UnityInstance>
    unityInstance?: UnityInstance
  }
}