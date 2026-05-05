"use client"

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
  const update = <K extends keyof EquationValue>(key: K, nextValue: EquationValue[K]) => {
    onChange({
      ...value,
      [key]: nextValue,
    })
  }

  return (
    <div className="h-full w-full rounded-2xl border p-8 space-y-6 bg-white">
      <div>
        <h3 className="text-2xl font-semibold">Event Equation</h3>
        <p className="text-base text-gray-500">
          Edit the equation assigned to the current event.
        </p>
      </div>

      <div className="h-[calc(100%-110px)] flex flex-col items-center justify-center gap-8">
        <div className="flex flex-wrap items-center justify-center gap-8">
          <EquationCircle
            value={value.leftA}
            onChange={(next) => update("leftA", next)}
            placeholder="x"
          />

          <select
            value={value.operatorA}
            onChange={(e) => update("operatorA", e.target.value as EquationValue["operatorA"])}
            className="rounded border px-4 py-3 text-4xl font-bold bg-transparent"
            style={{
              fontFamily: "var(--font-grandstander)",
              fontWeight: 700,
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
          />

          <span
            className="text-5xl font-bold"
            style={{
              fontFamily: "var(--font-grandstander)",
              fontWeight: 700,
            }}
          >
            {value.equals}
          </span>

          <EquationCircle
            value={value.right}
            onChange={(next) => update("right", next)}
            placeholder="7"
          />
        </div>

        <div className="rounded-xl bg-black/5 p-4 text-lg text-gray-600">
          Current equation:{" "}
          <span className="font-medium">
            {value.leftA} {value.operatorA} {value.leftB} {value.equals} {value.right}
          </span>
        </div>
      </div>
    </div>
  )
}