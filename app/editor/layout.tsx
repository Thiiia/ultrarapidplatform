"use client";

import React from "react";
import ReactGridLayout, { useContainerWidth } from "react-grid-layout";

export default function MyGrid() {
  const { width, containerRef, mounted } = useContainerWidth();

  const layout = [
    { i: "a", x: 0, y: 0, w: 12, h: .5, static: true },
    { i: "b", x: 0, y: 2, w: 2.5, h: 5 },
    { i: "c", x: 2.5, y: 4, w: 7, h: 3 },
    { i: "d", x: 10, y: 2, w: 2.5, h: 5 },
    { i: "e", x: 2.5, y: 2, w: 7, h: 2 },
  ];

  const gridItemStyle: React.CSSProperties = {
    border: "2px solid #d1d5db",
    borderRadius: 12,
    background: "#ffffff",
    padding: 12,
    boxShadow: "0 2px 6px rgba(0,0,0,0.05)",
  };

  return (
    <div ref={containerRef}>
      {mounted && (
        <ReactGridLayout
          layout={layout}
          width={width}
          cols={12}
          rowHeight={30}
        >
          <div key="a" style={gridItemStyle}>
            Toolbar
          </div>

          <div key="b" style={gridItemStyle}>
            Blocks
          </div>

          <div key="c" style={gridItemStyle}>
            Timeline
          </div>

          <div key="d" style={gridItemStyle}>
            Block Editor
          </div>

          <div key="e" style={gridItemStyle}>
            Frame
          </div>
        </ReactGridLayout>
      )}
    </div>
  );
}
