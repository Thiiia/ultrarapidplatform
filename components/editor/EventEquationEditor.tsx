"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { EquationCircle } from "./EquationCircle"

export type EquationValue = {
  leftA: string
  operatorA: "+" | "-" | "×" | "÷"
  leftB: string
  equals: "="
  right: string
}

type EventEquationEditorProps = {
  value: EquationValue
  onChange: (value: EquationValue) => void
}

const OPERATOR_OPTIONS: Array<EquationValue["operatorA"]> = ["+", "-", "×", "÷"]

export function EventEquationEditor({
  value,
  onChange,
}: EventEquationEditorProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [circleSize, setCircleSize] = useState(36)

  useEffect(() => {
    const element = containerRef.current
    if (!element) return

    const updateSize = () => {
      const width = element.clientWidth
      const next = Math.max(28, Math.min(width * 0.03, 40))
      setCircleSize(next)
    }

    updateSize()

    const observer = new ResizeObserver(() => {
      updateSize()
    })

    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  const operatorFontSize = useMemo(
    () => Math.max(16, Math.min(circleSize * 0.75, 24)),
    [circleSize]
  )

  const equalsFontSize = useMemo(
    () => Math.max(18, Math.min(circleSize * 0.9, 28)),
    [circleSize]
  )

  const update = <K extends keyof EquationValue>(key: K, nextValue: EquationValue[K]) => {
    onChange({
      ...value,
      [key]: nextValue,
    })
  }

  return (
    <div ref={containerRef} className="h-full w-full flex flex-col justify-center gap-4">
      <div>
        <h3 className="text-2xl font-semibold">Event Equation</h3>
        <p className="text-base text-gray-500">
          Edit the equation assigned to the current event.
        </p>
      </div>

      <div className="flex-1 flex items-center justify-center overflow-x-auto">
        <div className="flex flex-nowrap items-center justify-center gap-3 px-4">
          <EquationCircle
            value={value.leftA}
            onChange={(next) => update("leftA", next)}
            placeholder="x"
            size={circleSize}
          />

          <select
            value={value.operatorA}
            onChange={(e) => update("operatorA", e.target.value as EquationValue["operatorA"])}
            className="bg-transparent border-none outline-none appearance-none text-center"
            style={{
              fontFamily: "var(--font-grandstander)",
              fontWeight: 700,
              fontSize: `${operatorFontSize}px`,
              lineHeight: 1,
              padding: 0,
              margin: 0,
            }}
          >
            {OPERATOR_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>

          <EquationCircle
            value={value.leftB}
            onChange={(next) => update("leftB", next)}
            placeholder="2"
            size={circleSize}
          />

          <span
            style={{
              fontFamily: "var(--font-grandstander)",
              fontWeight: 700,
              fontSize: `${equalsFontSize}px`,
              lineHeight: 1,
            }}
          >
            {value.equals}
          </span>

          <EquationCircle
            value={value.right}
            onChange={(next) => update("right", next)}
            placeholder="7"
            size={circleSize}
          />
        </div>
      </div>

      <div className="text-sm text-gray-600">
        Current equation:{" "}
        <span className="font-medium">
          {value.leftA} {value.operatorA} {value.leftB} {value.equals} {value.right}
        </span>
      </div>
    </div>
  )
}