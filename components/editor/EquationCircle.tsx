"use client"

import Image from "next/image"
import { useEffect, useMemo, useState } from "react"

type EquationCircleProps = {
  value?: string
  onChange?: (value: string) => void
  placeholder?: string
  size?: number
  readOnly?: boolean
  imageSrc?: string
}

function getFontSize(value: string, size: number) {
  const length = value.trim().length

  if (length <= 1) return Math.max(14, size * 0.34)
  if (length === 2) return Math.max(12, size * 0.28)
  if (length === 3) return Math.max(10, size * 0.22)
  return Math.max(9, size * 0.18)
}

export function EquationCircle({
  value = "",
  onChange,
  placeholder = "",
  size = 34,
  readOnly = false,
  imageSrc = "/images/equation-circle.png",
}: EquationCircleProps) {
  const [internalValue, setInternalValue] = useState(value)

  useEffect(() => {
    setInternalValue(value)
  }, [value])

  const displayValue = internalValue || placeholder
  const fontSize = useMemo(() => getFontSize(displayValue, size), [displayValue, size])

  const handleChange = (nextValue: string) => {
    const sanitized = nextValue.replace(/\s+/g, "")
    setInternalValue(sanitized)
    onChange?.(sanitized)
  }

  return (
    <div
      style={{
        position: "relative",
        width: `${size}px`,
        height: `${size}px`,
        minWidth: `${size}px`,
        minHeight: `${size}px`,
        flex: "0 0 auto",
      }}
    >
      <Image
        src={imageSrc}
        alt="Equation circle"
        width={size}
        height={size}
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "contain",
          pointerEvents: "none",
          userSelect: "none",
          zIndex: 0,
        }}
      />

      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 2,
        }}
      >
        {readOnly ? (
          <span
            style={{
              fontFamily: "var(--font-grandstander)",
              fontWeight: 700,
              fontSize: `${fontSize}px`,
              color: "#FFFFFF",
              WebkitTextFillColor: "#FFFFFF",
              textShadow: "0 0 3px rgba(0,0,0,0.65)",
              width: "68%",
              textAlign: "center",
              lineHeight: 1,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              display: "block",
            }}
          >
            {displayValue}
          </span>
        ) : (
          <input
            type="text"
            value={internalValue}
            onChange={(e) => handleChange(e.target.value)}
            placeholder={placeholder}
            autoComplete="off"
            spellCheck={false}
            style={{
              display: "block",
              width: "68%",
              border: "none",
              outline: "none",
              background: "transparent",
              textAlign: "center",
              fontFamily: "var(--font-grandstander)",
              fontWeight: 700,
              fontSize: `${fontSize}px`,
              color: "#FFFFFF",
              WebkitTextFillColor: "#FFFFFF",
              textShadow: "0 0 3px rgba(0,0,0,0.65)",
              lineHeight: 1,
              caretColor: "#FFFFFF",
              padding: 0,
              margin: 0,
              position: "relative",
              zIndex: 3,
            }}
          />
        )}
      </div>
    </div>
  )
}