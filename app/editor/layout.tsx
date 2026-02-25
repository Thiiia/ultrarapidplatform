"use client";

import React from "react";
import dynamic from "next/dynamic";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";

/* ---- Dynamically import to disable SSR ---- */
const ReactGridLayout = dynamic(() => import("react-grid-layout"), {
  ssr: false,
});

/* ---- SVG Button Component ---- */
type SvgButtonProps = {
  onClick?: () => void;
};

function SvgButton({ onClick }: SvgButtonProps) {
  const maskId = React.useId();

  return (
    <button
      onClick={onClick}
      style={{
        border: "none",
        background: "transparent",
        padding: 0,
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
      }}
    >
      <svg
        width="66"
        height="30"
        viewBox="0 0 66 30"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <mask id={maskId} fill="white">
          <path d="M0 0H65.0469V30H0V0Z" />
        </mask>

        <path d="M0 0H65.0469V30H0V0Z" fill="white" />

        <path
          d="M0 0V-1H-1V0H0ZM65.0469 0H66.0469V-1H65.0469V0ZM65.0469 30V31H66.0469V30H65.0469ZM0 30H-1V31H0V30Z"
          fill="#99A1AF"
          mask={`url(#${maskId})`}
        />

        <path
          d="M43.0469 13.5L46.0469 16.5L49.0469 13.5"
          stroke="#0A0A0A"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}

/* ---- Main Grid Layout ---- */
export default function MyGrid() {
  const [width, setWidth] = React.useState(1200);

  React.useEffect(() => {
    const updateWidth = () => {
      setWidth(window.innerWidth - 40);
    };

    updateWidth();
    window.addEventListener("resize", updateWidth);

    return () => window.removeEventListener("resize", updateWidth);
  }, []);

  const layout = [
    { i: "a", x: 0, y: 0, w: 12, h: 1, static: true },
    { i: "b", x: 0, y: 2, w: 3, h: 5 },
    { i: "c", x: 3, y: 4, w: 7, h: 3 },
    { i: "d", x: 10, y: 2, w: 2, h: 5 },
    { i: "e", x: 3, y: 2, w: 7, h: 2 },
  ];

  const gridItemStyle: React.CSSProperties = {
    border: "2px solid #d1d5db",
    borderRadius: 12,
    background: "#ffffff",
    padding: 12,
    boxShadow: "0 2px 6px rgba(0,0,0,0.05)",
  };

  return (
    <div style={{ padding: 20 }}>
      <ReactGridLayout
        layout={layout}
        width={width}
        cols={12}
        rowHeight={30}
      >
        {/* Toolbar */}
        <div
          key="a"
          style={{
            ...gridItemStyle,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span style={{ fontWeight: 600 }}>Toolbar</span>
          <SvgButton onClick={() => alert("SVG Button Clicked")} />
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
    </div>
  );
}
