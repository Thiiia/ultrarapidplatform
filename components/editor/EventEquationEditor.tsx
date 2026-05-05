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
    <div className="rounded-2xl border p-4 space-y-4 bg-white">
      <div>
        <h3 className="text-lg font-semibold">Event Equation</h3>
        <p className="text-sm text-gray-500">
          Edit the equation assigned to the current event.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <EquationCircle
          value={value.leftA}
          onChange={(next) => update("leftA", next)}
          placeholder="x"
          size={120}
        />

        <select
          value={value.operatorA}
          onChange={(e) => update("operatorA", e.target.value as EquationValue["operatorA"])}
          className="rounded border px-3 py-2 text-2xl font-bold bg-transparent"
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
          size={120}
        />

        <span className="text-4xl font-bold">{value.equals}</span>

        <EquationCircle
          value={value.right}
          onChange={(next) => update("right", next)}
          placeholder="7"
          size={120}
        />
      </div>

      <div className="rounded-xl bg-black/5 p-3 text-sm text-gray-600">
        Current equation:{" "}
        <span className="font-medium">
          {value.leftA} {value.operatorA} {value.leftB} {value.equals} {value.right}
        </span>
      </div>
    </div>
  )
}