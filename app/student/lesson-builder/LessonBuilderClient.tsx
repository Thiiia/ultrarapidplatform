"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ChangeEvent, DragEvent, FC, SVGProps } from "react";
import { useEffect, useMemo, useState } from "react";
import { useEditorStore } from "@/lib/editor/editor-store";
import { chartToProject } from "@/lib/editor/chart-to-project";
import styles from "../student.module.css";

/* Header Icon imports */
import URIcon from "@/public/header_icons/URIcon.svg";
import HomeIcon from "@/public/header_icons/Home.svg";
import HomePressedIcon from "@/public/header_icons/Home_pressed.svg";
import MyLessonsTab from "@/public/header_icons/my_lessons_tab.svg";
import MyLessonsPressedTab from "@/public/header_icons/my_lessons_tab_pressed.svg";
import LessonBuilderTab from "@/public/header_icons/lesson_builder_tab.svg";
import LessonBuilderPressedTab from "@/public/header_icons/lesson_builder_tab_pressed.svg";
import ProgressTab from "@/public/header_icons/progress_tab.svg";
import ProgressPressedTab from "@/public/header_icons/progress_tab_pressed.svg";
import PlayTab from "@/public/header_icons/play_tab.svg";
import PlayPressedTab from "@/public/header_icons/play_tab_pressed.svg";

/* Utility Icon Imports */
import ProfileIcon from "@/public/utility_icons/profile_icon.svg";

type LessonBuilderPayload = {
  chartFile: string;
  analysisMetadata?: {
    songTitle?: string;
    artist?: string;
    bpm?: number;
    durationSeconds?: number;
    uploadedFileName?: string;
  };
  rawResults?: unknown;
};

type SelectedSongPayload = {
  id: string;
  name: string;
  title?: string;
  artist?: string | null;

  song: {
    bucket: string;
    path: string;
    signedUrl: string;
    contentType: string | null;
  };

  chart: {
    bucket: string;
    path: string;
    signedUrl: string;
    contentType: string | null;
  };

  sidecar: {
    bucket: string;
    path: string;
    signedUrl: string;
    contentType: string | null;
  } | null;
};

type EquationToken = {
  id: string;
  label: string;
};

type SavedEquation = {
  id: string;
  tokens: EquationToken[];
};

type TabIcon = FC<SVGProps<SVGSVGElement>>;

type HeaderTab = {
  label: string;
  href: string;
  Icon: TabIcon;
  ActiveIcon: TabIcon;
  width: number;
};

type UtilityTab = {
  label: string;
  href: string;
  Icon: TabIcon;
  width: number;
};

type LessonBuilderClientProps = {
  navBasePath?: string;
};

function getTopTabs(navBasePath = "/student"): HeaderTab[] {
  return [
    {
      label: "Home",
      href: navBasePath,
      Icon: HomeIcon,
      ActiveIcon: HomePressedIcon,
      width: 99,
    },
    {
      label: "My Lessons",
      href: `${navBasePath}/lessons`,
      Icon: MyLessonsTab,
      ActiveIcon: MyLessonsPressedTab,
      width: 139,
    },
    {
      label: "Lesson Builder",
      href: `${navBasePath}/song-choice`,
      Icon: LessonBuilderTab,
      ActiveIcon: LessonBuilderPressedTab,
      width: 159,
    },
    {
      label: "Progress",
      href: `${navBasePath}/progress`,
      Icon: ProgressTab,
      ActiveIcon: ProgressPressedTab,
      width: 120,
    },
    {
      label: "Play",
      href: `${navBasePath}/game`,
      Icon: PlayTab,
      ActiveIcon: PlayPressedTab,
      width: 99,
    },
  ];
}

const utilityTabs: UtilityTab[] = [
  { label: "Profile", href: "/student/profile", Icon: ProfileIcon, width: 134.45 },
];

const pagePanelWidth = "92vw";
const headerBackgroundColor = "#2B2B2B";
const pageBackgroundColor = "#191919";
const subtleBorderColor = "#FFFFFF14";
const textColor = "#FFFFFF";

const equationPalette = [
  "0",
  "1",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "X",
  "+",
  "-",
  "×",
  "÷",
  "=",
];

function makeId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

async function fileFromSignedUrl({
  signedUrl,
  path,
  name,
  contentType,
}: {
  signedUrl: string;
  path: string;
  name: string;
  contentType: string | null;
}) {
  const response = await fetch(signedUrl);

  if (!response.ok) {
    throw new Error(`Unable to load file: ${response.status}`);
  }

  const blob = await response.blob();
  const extension = path.split(".").pop();
  const fileName = extension ? `${name}.${extension}` : name;

  return new File([blob], fileName, {
    type: contentType ?? blob.type,
  });
}

async function textFromSignedUrl(signedUrl: string) {
  const response = await fetch(signedUrl);

  if (!response.ok) {
    throw new Error(`Unable to load text file: ${response.status}`);
  }

  return response.text();
}

async function jsonFromSignedUrl(signedUrl: string) {
  const response = await fetch(signedUrl);

  if (!response.ok) {
    throw new Error(`Unable to load JSON file: ${response.status}`);
  }

  return response.json();
}

function HeaderBar({
  pathname,
  topTabs,
}: {
  pathname: string;
  topTabs: HeaderTab[];
}) {
  return (
    <header
      style={{
        background: headerBackgroundColor,
        width: "100%",
        boxSizing: "border-box",
        height: 70,
        border: "none",
        borderBottom: `1px solid ${subtleBorderColor}`,
        borderRadius: 0,
        display: "flex",
        alignItems: "center",
        overflow: "visible",
      }}
    >
      <div
        style={{
          width: pagePanelWidth,
          height: "100%",
          margin: "0 auto",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 24,
          flexWrap: "nowrap",
          overflow: "visible",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 28,
            flexWrap: "nowrap",
            minWidth: 0,
            overflow: "visible",
          }}
        >
          <div
            style={{
              width: 164,
              height: 35,
              display: "inline-flex",
              alignItems: "center",
              flexShrink: 0,
              overflow: "visible",
            }}
          >
            <URIcon
              aria-label="UltraRapid"
              style={{
                width: 156,
                height: 35,
                display: "block",
                flexShrink: 0,
                overflow: "visible",
              }}
            />
          </div>

          <nav
            aria-label="Student navigation"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              flexWrap: "nowrap",
              minWidth: 0,
              overflow: "visible",
            }}
          >
            {topTabs.map((tab) => {
              const cleanTabHref = tab.href.split("?")[0];
              const isHomeTab = tab.label === "Home";
              const isPlayTab = tab.label === "Play";
              const isLessonBuilderTab = tab.label === "Lesson Builder";

              const lessonBuilderPath = cleanTabHref.replace(
                "/song-choice",
                "/lesson-builder",
              );

              const isActive =
                pathname === cleanTabHref ||
                (isLessonBuilderTab &&
                  (pathname === lessonBuilderPath ||
                    pathname.startsWith(`${lessonBuilderPath}/`))) ||
                (!isHomeTab &&
                  !isPlayTab &&
                  !isLessonBuilderTab &&
                  cleanTabHref !== "/" &&
                  pathname.startsWith(`${cleanTabHref}/`));

              const Icon = isActive ? tab.ActiveIcon : tab.Icon;

              return (
                <Link
                  key={tab.label}
                  href={tab.href}
                  aria-label={tab.label}
                  className={`${styles.headerTabButton} ${
                    isActive ? styles.headerTabButtonActive : ""
                  }`}
                  style={{
                    width: tab.width,
                    height: 45.5,
                    opacity: 1,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Icon
                    style={{
                      width: tab.width,
                      height: 45.5,
                      display: "block",
                    }}
                  />
                </Link>
              );
            })}
          </nav>
        </div>

        <div
          style={{
            display: "flex",
            gap: 6,
            flexWrap: "nowrap",
            marginLeft: "auto",
            alignItems: "center",
            flexShrink: 0,
            overflow: "visible",
          }}
        >
          {utilityTabs.map((tab) => (
            <Link
              key={tab.label}
              href={tab.href}
              aria-label={tab.label}
              className={styles.utilityButton}
              style={{
                width: tab.width,
                height: 38,
              }}
            >
              <tab.Icon
                style={{
                  width: tab.width,
                  height: 38,
                  display: "block",
                }}
              />
            </Link>
          ))}

          <a
            href="/auth/logout"
            aria-label="Log out"
            className={`${styles.utilityButton} ${styles.logoutButton}`}
          >
            Log out
          </a>
        </div>
      </div>
    </header>
  );
}

function EmptyEditorTopPanel() {
  return (
    <section
      aria-label="Lesson builder controls"
      style={{
        width: "100%",
        minHeight: 96,
        background: headerBackgroundColor,
        borderBottom: `1px solid ${subtleBorderColor}`,
        boxSizing: "border-box",
      }}
    />
  );
}

function EquationCircle({
  label,
  draggable = true,
  size = 34,
}: {
  label: string;
  draggable?: boolean;
  size?: number;
}) {
  return (
    <div
      draggable={draggable}
      onDragStart={(event) => {
        if (!draggable) return;

        event.dataTransfer.setData(
          "application/x-equation-token",
          JSON.stringify({ label }),
        );
        event.dataTransfer.effectAllowed = "copy";
      }}
      style={{
        width: size,
        height: size,
        borderRadius: "999px",
        background: "#191919",
        border: "2px solid rgba(255, 255, 255, 0.72)",
        color: "#FFFFFF",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "Grandstander, Space Grotesk, sans-serif",
        fontSize: size >= 60 ? 32 : 16,
        fontWeight: 700,
        lineHeight: 1,
        cursor: draggable ? "grab" : "default",
        userSelect: "none",
        flexShrink: 0,
        textShadow: "0 0 10px rgba(255, 255, 255, 0.25)",
      }}
    >
      {label}
    </div>
  );
}

function EquationDropSlot({
  index,
  onInsertToken,
}: {
  index: number;
  onInsertToken: (index: number, label: string) => void;
}) {
  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();

    const rawToken = event.dataTransfer.getData("application/x-equation-token");

    if (!rawToken) {
      return;
    }

    try {
      const parsed = JSON.parse(rawToken) as { label?: string };

      if (parsed.label) {
        onInsertToken(index, parsed.label);
      }
    } catch (error) {
      console.error("Failed to drop equation token", error);
    }
  }

  return (
    <div
      onDragOver={(event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = "copy";
      }}
      onDrop={handleDrop}
      title="Drop here"
      style={{
        width: 34,
        height: 34,
        borderRadius: "999px",
        background: "#191919",
        border: "2px dashed rgba(255, 255, 255, 0.58)",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}
    />
  );
}

function CustomEquationCircle({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const draggable = value.trim().length > 0;

  return (
    <div
      draggable={draggable}
      onDragStart={(event) => {
        const label = value.trim();

        if (!label) {
          event.preventDefault();
          return;
        }

        event.dataTransfer.setData(
          "application/x-equation-token",
          JSON.stringify({ label }),
        );
        event.dataTransfer.effectAllowed = "copy";
      }}
      style={{
        width: 68,
        height: 68,
        borderRadius: "999px",
        background: "#191919",
        border: "2px dashed rgba(255, 255, 255, 0.72)",
        color: "#FFFFFF",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: draggable ? "grab" : "text",
        flexShrink: 0,
      }}
      title="Click to type a custom number or symbol"
    >
      <input
        value={value}
        onChange={(event: ChangeEvent<HTMLInputElement>) => {
          onChange(event.target.value.slice(0, 3));
        }}
        placeholder=""
        aria-label="Custom equation symbol"
        style={{
          width: 48,
          height: 48,
          border: "none",
          outline: "none",
          background: "transparent",
          color: "#FFFFFF",
          textAlign: "center",
          fontFamily: "Grandstander, Space Grotesk, sans-serif",
          fontSize: 32,
          fontWeight: 700,
          lineHeight: 1,
          textShadow: "0 0 10px rgba(255, 255, 255, 0.25)",
        }}
      />
    </div>
  );
}

function EquationBlocksPanel({
  savedEquations,
  onCreateEquation,
}: {
  savedEquations: SavedEquation[];
  onCreateEquation: () => void;
}) {
  return (
    <section
      style={{
        width: "12.5vw",
        height: "calc(100vh - 166px)",
        minHeight: "calc(100vh - 166px)",
        background: "#2B2B2B",
        color: textColor,
        borderRight: `1px solid ${subtleBorderColor}`,
        boxSizing: "border-box",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          padding: "18px 12px",
          borderBottom: `1px solid ${subtleBorderColor}`,
          color: textColor,
          fontFamily: "Space Grotesk, sans-serif",
          fontSize: 13,
          fontWeight: 700,
          lineHeight: "19.5px",
          letterSpacing: 0,
          textAlign: "center",
        }}
      >
        Equation Blocks
      </div>

      <div
        style={{
          padding: 12,
          borderBottom: `1px solid ${subtleBorderColor}`,
        }}
      >
        <button
          type="button"
          onClick={onCreateEquation}
          style={{
            width: "100%",
            minHeight: 38,
            background: "#CFFF04",
            color: "#000000",
            border: "1px solid #CFFF04",
            borderRadius: 10,
            fontFamily: "Space Grotesk, sans-serif",
            fontSize: 12,
            fontWeight: 700,
            lineHeight: "18px",
            cursor: "pointer",
          }}
        >
          Create Equation
        </button>
      </div>

      <div
        style={{
          padding: 12,
          display: "flex",
          flexDirection: "column",
          gap: 10,
          overflowY: "auto",
        }}
      >
        {savedEquations.map((equation) => (
          <div
            key={equation.id}
            draggable
            onDragStart={(event) => {
              event.dataTransfer.setData(
                "application/x-saved-equation",
                JSON.stringify(equation),
              );
              event.dataTransfer.effectAllowed = "copy";
            }}
            style={{
              width: "100%",
              minHeight: 38,
              background: "#191919",
              border: `1px solid ${subtleBorderColor}`,
              borderRadius: 10,
              padding: "7px 8px",
              boxSizing: "border-box",
              color: textColor,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 4,
              overflow: "hidden",
              cursor: "grab",
            }}
            title={equation.tokens.map((token) => token.label).join(" ")}
          >
            {equation.tokens.slice(0, 6).map((token) => (
              <span
                key={token.id}
                style={{
                  minWidth: 22,
                  height: 22,
                  borderRadius: "999px",
                  background: "#191919",
                  border: "1.5px solid rgba(255, 255, 255, 0.72)",
                  color: "#FFFFFF",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontFamily: "Grandstander, Space Grotesk, sans-serif",
                  fontSize: 13,
                  fontWeight: 700,
                  flexShrink: 0,
                  textShadow: "0 0 8px rgba(255, 255, 255, 0.25)",
                }}
              >
                {token.label}
              </span>
            ))}

            {equation.tokens.length > 6 ? (
              <span
                style={{
                  color: "#FFFFFF99",
                  fontFamily: "Space Grotesk, sans-serif",
                  fontSize: 10,
                  fontWeight: 700,
                  flexShrink: 0,
                }}
              >
                +{equation.tokens.length - 6}
              </span>
            ) : null}
          </div>
        ))}
      </div>
    </section>
  );
}

function WorkspacePanel({
  title,
  width,
  background,
  children,
}: {
  title?: string;
  width: string;
  background: string;
  children?: React.ReactNode;
}) {
  return (
    <section
      style={{
        width,
        height: "calc(100vh - 166px)",
        minHeight: "calc(100vh - 166px)",
        background,
        color: textColor,
        borderRight: `1px solid ${subtleBorderColor}`,
        boxSizing: "border-box",
        overflow: "hidden",
      }}
    >
      {title ? (
        <div
          style={{
            padding: "18px 16px",
            borderBottom: `1px solid ${subtleBorderColor}`,
            color: textColor,
            fontFamily: "Space Grotesk, sans-serif",
            fontSize: 13,
            fontWeight: 700,
            lineHeight: "19.5px",
            letterSpacing: 0,
            textAlign: "left",
          }}
        >
          {title}
        </div>
      ) : null}

      {children}
    </section>
  );
}

function EquationBuilderArea({
  isCreatingEquation,
  draftTokens,
  customTokenLabel,
  onCustomTokenLabelChange,
  onInsertToken,
  onRemoveToken,
  onSaveEquation,
}: {
  isCreatingEquation: boolean;
  draftTokens: EquationToken[];
  customTokenLabel: string;
  onCustomTokenLabelChange: (value: string) => void;
  onInsertToken: (index: number, label: string) => void;
  onRemoveToken: (id: string) => void;
  onSaveEquation: () => void;
}) {
  if (!isCreatingEquation) {
    return (
      <div
        style={{
          flex: 1,
          background: "#191919",
        }}
      />
    );
  }

  return (
    <div
      style={{
        flex: 1,
        background: "#191919",
        boxSizing: "border-box",
        display: "grid",
        gridTemplateRows: "auto 1fr auto",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          minHeight: 100,
          borderBottom: `1px solid ${subtleBorderColor}`,
          display: "flex",
          alignItems: "center",
          gap: 14,
          padding: "0 18px",
          boxSizing: "border-box",
          overflowX: "auto",
          fontFamily: "Space Grotesk, sans-serif",
        }}
      >
        {equationPalette.map((label) => (
          <EquationCircle key={label} label={label} size={68} />
        ))}

        <CustomEquationCircle
          value={customTokenLabel}
          onChange={onCustomTokenLabelChange}
        />
      </div>

      <div
        style={{
          margin: 18,
          border: `1px dashed ${subtleBorderColor}`,
          borderRadius: 18,
          background: "#191919",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxSizing: "border-box",
          overflow: "hidden",
          fontFamily: "Space Grotesk, sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 12,
            flexWrap: "wrap",
            padding: 24,
          }}
        >
          {draftTokens.length === 0 ? (
            <EquationDropSlot index={0} onInsertToken={onInsertToken} />
          ) : (
            <>
              <EquationDropSlot index={0} onInsertToken={onInsertToken} />

              {draftTokens.map((token, index) => (
                <span
                  key={token.id}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 12,
                  }}
                >
                  <button
                    type="button"
                    onClick={() => onRemoveToken(token.id)}
                    title="Click to remove"
                    style={{
                      border: "none",
                      background: "transparent",
                      padding: 0,
                      cursor: "pointer",
                    }}
                  >
                    <EquationCircle label={token.label} draggable={false} size={68} />
                  </button>

                  <EquationDropSlot
                    index={index + 1}
                    onInsertToken={onInsertToken}
                  />
                </span>
              ))}
            </>
          )}
        </div>
      </div>

      <div
        style={{
          minHeight: 70,
          borderTop: `1px solid ${subtleBorderColor}`,
          padding: "14px 18px",
          boxSizing: "border-box",
          display: "flex",
          justifyContent: "flex-end",
          alignItems: "center",
          fontFamily: "Space Grotesk, sans-serif",
        }}
      >
        <button
          type="button"
          disabled={draftTokens.length === 0}
          onClick={onSaveEquation}
          style={{
            minWidth: 150,
            minHeight: 40,
            background: draftTokens.length > 0 ? "#CFFF04" : "#2B2B2B",
            color: draftTokens.length > 0 ? "#000000" : "#FFFFFF80",
            border: `1px solid ${
              draftTokens.length > 0 ? "#CFFF04" : subtleBorderColor
            }`,
            borderRadius: 10,
            fontFamily: "Space Grotesk, sans-serif",
            fontSize: 13,
            fontWeight: 700,
            cursor: draftTokens.length > 0 ? "pointer" : "not-allowed",
          }}
        >
          Save Equation
        </button>
      </div>
    </div>
  );
}

function CenterEditorPanel({
  isCreatingEquation,
  draftTokens,
  customTokenLabel,
  onCustomTokenLabelChange,
  onInsertToken,
  onRemoveToken,
  onSaveEquation,
}: {
  isCreatingEquation: boolean;
  draftTokens: EquationToken[];
  customTokenLabel: string;
  onCustomTokenLabelChange: (value: string) => void;
  onInsertToken: (index: number, label: string) => void;
  onRemoveToken: (id: string) => void;
  onSaveEquation: () => void;
}) {
  const subpanels = ["", "Lyrics", "Strings", "Bass", "Drums"];

  return (
    <section
      style={{
        width: "75vw",
        height: "calc(100vh - 166px)",
        minHeight: "calc(100vh - 166px)",
        background: "#191919",
        color: textColor,
        boxSizing: "border-box",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <EquationBuilderArea
        isCreatingEquation={isCreatingEquation}
        draftTokens={draftTokens}
        customTokenLabel={customTokenLabel}
        onCustomTokenLabelChange={onCustomTokenLabelChange}
        onInsertToken={onInsertToken}
        onRemoveToken={onRemoveToken}
        onSaveEquation={onSaveEquation}
      />

      <div
        style={{
          width: "100%",
          height: "30vh",
          minHeight: "30vh",
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-end",
          flexShrink: 0,
        }}
      >
        {subpanels.map((title, index) => (
          <div
            key={`${title}-${index}`}
            style={{
              width: "100%",
              height: "6vh",
              minHeight: "6vh",
              background: "#2B2B2B",
              borderTop: index === 0 ? `1px solid ${subtleBorderColor}` : "none",
              borderBottom: `1px solid ${subtleBorderColor}`,
              boxSizing: "border-box",
              display: "flex",
              alignItems: "center",
              padding: "0 18px",
              color: textColor,
              fontFamily: "Space Grotesk, sans-serif",
              fontSize: 13,
              fontWeight: 700,
              lineHeight: "19.5px",
              letterSpacing: 0,
              textAlign: "left",
            }}
          >
            {title}
          </div>
        ))}
      </div>
    </section>
  );
}

export default function LessonBuilderClient({
  navBasePath = "/student",
}: LessonBuilderClientProps) {
  const pathname = usePathname();
  const topTabs = useMemo(() => getTopTabs(navBasePath), [navBasePath]);
  const setProject = useEditorStore((s) => s.setProject);

  const [chartFile, setChartFile] = useState("");
  const [metadata, setMetadata] = useState<LessonBuilderPayload["analysisMetadata"]>();
  const [uploadedSongName, setUploadedSongName] = useState("");
  const [uploadedChartName, setUploadedChartName] = useState("");
  const [pendingSongFile, setPendingSongFile] = useState<File | null>(null);

  const [isCreatingEquation, setIsCreatingEquation] = useState(false);
  const [draftTokens, setDraftTokens] = useState<EquationToken[]>([]);
  const [savedEquations, setSavedEquations] = useState<SavedEquation[]>([]);
  const [customTokenLabel, setCustomTokenLabel] = useState("");

  /*
   * Editor display panels are intentionally hidden for the new layout.
   * The state above is kept so selected songs/charts can still hydrate
   * editor data through chartToProject and useEditorStore.
   */

  function handleInsertEquationToken(index: number, label: string) {
    setDraftTokens((current) => {
      const nextToken = {
        id: makeId("token"),
        label,
      };

      const safeIndex = Math.max(0, Math.min(index, current.length));

      return [
        ...current.slice(0, safeIndex),
        nextToken,
        ...current.slice(safeIndex),
      ];
    });
  }

  function handleRemoveEquationToken(id: string) {
    setDraftTokens((current) => current.filter((token) => token.id !== id));
  }

  function handleSaveEquation() {
    if (draftTokens.length === 0) {
      return;
    }

    setSavedEquations((current) => [
      ...current,
      {
        id: makeId("equation"),
        tokens: draftTokens,
      },
    ]);

    setDraftTokens([]);
    setCustomTokenLabel("");
    setIsCreatingEquation(false);
  }

  useEffect(() => {
    const raw = sessionStorage.getItem("ultrarapid_selected_song");

    if (!raw) {
      return;
    }

    try {
      const selectedSong: SelectedSongPayload = JSON.parse(raw);

      setUploadedSongName(selectedSong.name);
      setMetadata((current) => ({
        ...current,
        songTitle: selectedSong.title ?? selectedSong.name,
        artist: selectedSong.artist ?? current?.artist,
        uploadedFileName: selectedSong.song.path,
      }));

      fileFromSignedUrl({
        signedUrl: selectedSong.song.signedUrl,
        path: selectedSong.song.path,
        name: selectedSong.name,
        contentType: selectedSong.song.contentType,
      })
        .then((file) => {
          setPendingSongFile(file);
        })
        .catch((error) => {
          console.error("Failed to load selected song file", error);
        });

      Promise.all([
        textFromSignedUrl(selectedSong.chart.signedUrl),
        selectedSong.sidecar
          ? jsonFromSignedUrl(selectedSong.sidecar.signedUrl)
          : Promise.resolve(null),
      ])
        .then(([nextChartFile, sidecarJson]) => {
          const nextChartName =
            selectedSong.chart.path.split("/").pop() ?? "selected.chart";

          setChartFile(nextChartFile);
          setUploadedChartName(nextChartName);

          const payload: LessonBuilderPayload = {
            chartFile: nextChartFile,
            analysisMetadata: {
              songTitle: selectedSong.title ?? selectedSong.name,
              artist: selectedSong.artist ?? undefined,
              uploadedFileName: selectedSong.song.path,
            },
            rawResults: sidecarJson,
          };

          const project = chartToProject(payload);
          setProject(project);
        })
        .catch((error) => {
          console.error("Failed to load selected chart or sidecar JSON", error);
        });
    } catch (error) {
      console.error("Failed to parse selected song package", error);
    }
  }, [setProject]);

  useEffect(() => {
    const raw = sessionStorage.getItem("ultrarapid_editor_payload");
    if (!raw) return;

    try {
      const payload: LessonBuilderPayload = JSON.parse(raw);

      if (payload?.analysisMetadata) {
        setMetadata(payload.analysisMetadata);
      }

      if (payload?.chartFile) {
        setChartFile(payload.chartFile);

        if (payload.analysisMetadata?.uploadedFileName) {
          setUploadedChartName(payload.analysisMetadata.uploadedFileName);
        }

        const project = chartToProject(payload);
        setProject(project);
      }

      sessionStorage.removeItem("ultrarapid_editor_payload");
    } catch (error) {
      console.error("Failed to hydrate lesson builder payload", error);
    }
  }, [setProject]);

  useEffect(() => {
    if (!pendingSongFile) return;

    /*
     * Song file is loaded and kept in state for editor logic.
     * The previous visible EditorShell file input syncing is disabled
     * while the editor display is being rebuilt.
     */
    console.info("Selected song file loaded for editor:", pendingSongFile.name);
  }, [pendingSongFile]);

  useEffect(() => {
    if (!chartFile.trim()) return;

    console.info("Chart file loaded for editor:", {
      chartName: uploadedChartName,
      songName: uploadedSongName,
      metadata,
    });
  }, [chartFile, uploadedChartName, uploadedSongName, metadata]);

  return (
    <div
      className={styles.studentTypography}
      style={{
        minHeight: "100vh",
        background: pageBackgroundColor,
        color: textColor,
        display: "flex",
        flexDirection: "column",
        overflowX: "hidden",
      }}
    >
      <HeaderBar pathname={pathname} topTabs={topTabs} />

      <EmptyEditorTopPanel />

      <main
        style={{
          width: "100%",
          height: "calc(100vh - 166px)",
          display: "flex",
          alignItems: "stretch",
          background: pageBackgroundColor,
          color: textColor,
          overflow: "hidden",
        }}
      >
        <EquationBlocksPanel
          savedEquations={savedEquations}
          onCreateEquation={() => {
            setDraftTokens([]);
            setCustomTokenLabel("");
            setIsCreatingEquation(true);
          }}
        />

        <CenterEditorPanel
          isCreatingEquation={isCreatingEquation}
          draftTokens={draftTokens}
          customTokenLabel={customTokenLabel}
          onCustomTokenLabelChange={setCustomTokenLabel}
          onInsertToken={handleInsertEquationToken}
          onRemoveToken={handleRemoveEquationToken}
          onSaveEquation={handleSaveEquation}
        />

        <WorkspacePanel
          title="Teacher Feedback"
          width="12.5vw"
          background="#2B2B2B"
        />
      </main>
    </div>
  );
}