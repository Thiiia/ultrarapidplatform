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
  const base = size * 0.6

  if (length <= 1) return base
  if (length === 2) return size * 0.48
  if (length === 3) return size * 0.4
  return size * 0.32
}

export function EquationCircle({
  value = "",
  onChange,
  placeholder = "",
  size = 200,
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
      className="relative shrink-0"
      style={{
        width: `${size}px`,
        height: `${size}px`,
      }}
    >
      <Image
        src={imageSrc}
        alt="Equation circle"
        fill
        className="object-contain pointer-events-none select-none"
      />

      <div className="absolute inset-0 flex items-center justify-center">
        {readOnly ? (
          <span
            className="text-center leading-none select-none"
            style={{
              fontFamily: "var(--font-grandstander)",
              fontWeight: 700,
              fontSize: `${fontSize}px`,
              color: "#FFFFFF",
              width: "78%",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
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
            className="bg-transparent border-none outline-none text-center"
            style={{
              fontFamily: "var(--font-grandstander)",
              fontWeight: 700,
              fontSize: `${fontSize}px`,
              color: "#FFFFFF",
              width: "78%",
              lineHeight: 1,
              caretColor: "#FFFFFF",
            }}
            autoComplete="off"
            spellCheck={false}
          />
        )}
      </div>
    </div>
  )
}