export {}

declare global {
  interface UnityInstance {
    SendMessage: (gameObject: string, method: string, value?: string) => void
    Quit?: () => Promise<void>
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