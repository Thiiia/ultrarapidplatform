declare module "next/navigation" {
  export type NavigateOptions = {
    scroll?: boolean;
  };

  export type PrefetchOptions = {
    onInvalidate?: () => void;
  };

  export type AppRouterInstance = {
    back(): void;
    forward(): void;
    refresh(): void;
    push(href: string, options?: NavigateOptions): void;
    replace(href: string, options?: NavigateOptions): void;
    prefetch(href: string, options?: PrefetchOptions): void;
  };

  export function useRouter(): AppRouterInstance;
}

declare module "wavesurfer.js" {
  export type WaveSurferOptions = {
    container: HTMLElement;
    waveColor?: string;
    progressColor?: string;
    height?: number | "auto";
  };

  export type WaveSurferInstance = {
    load(url: string): void;
    destroy(): void;
  };

  const WaveSurfer: {
    create(options: WaveSurferOptions): WaveSurferInstance;
  };

  export default WaveSurfer;
}

declare module "*.module.css" {
  const classes: Record<string, string>;
  export default classes;
}