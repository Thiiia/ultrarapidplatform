"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import type { Layout } from "react-grid-layout";

import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";

export type GridLayoutClientProps = {
  layout: Layout;
  cols: number;
  rowHeight: number;
  children: React.ReactNode;
};

const Grid = dynamic(
  async () => {
    const mod: any = await import("react-grid-layout");

    // Turbopack / ESM safe resolution
    const RGL = mod.default || mod;
    const WidthProvider =
      RGL.WidthProvider || mod.WidthProvider;

    if (typeof WidthProvider !== "function") {
      throw new Error(
        "WidthProvider could not be resolved from react-grid-layout"
      );
    }

    return WidthProvider(RGL);
  },
  { ssr: false }
) as React.ComponentType<any>;

export default function GridLayoutClient({
  layout,
  cols,
  rowHeight,
  children,
}: GridLayoutClientProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <Grid
      layout={layout}
      cols={cols}
      rowHeight={rowHeight}
    >
      {children}
    </Grid>
  );
}