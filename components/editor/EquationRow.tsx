"use client"

import { useMemo, useState } from "react"
import { EquationCircle } from "./EquationCircle"

type EquationRowValue = {
  leftA: string
  operatorA: "+" | "-" | "×" | "÷"
  leftB: string
  equals: "="
  right: string
}

type EquationRowProps = {
  value?: Partial<EquationRowValue>
  onChange?: (value: EquationRowValue) => void
  readOnly?: boolean
}

const DEFAULT_VALUE: EquationRowValue = {
  leftA: "x",
  operatorA: "+",
  leftB: "7",
  equals: "=",
  right: "10",
}

const OPERATOR_OPTIONS: Array<EquationRowValue["operatorA"]> = ["+", "-", "×", "÷"]

export function EquationRow({
  value,
  onChange,
  readOnly = false,
}: EquationRowProps) {
  const [state, setState] = useState<EquationRowValue>({
    ...DEFAULT_VALUE,
    ...value,
  })

  const merged = useMemo(
    () => ({
      ...DEFAULT_VALUE,
      ...state,
    }),
    [state]
  )

  const update = <K extends keyof EquationRowValue>(key: K, nextValue: EquationRowValue[K]) => {
    const next = {
      ...merged,
      [key]: nextValue,
    }
    setState(next)
    onChange?.(next)
  }

  return (
    <div className="rounded-2xl border p-6 space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Equation Builder</h2>
        <p className="text-sm text-gray-500">
          Type variables or numbers into the circles to build the equation.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <EquationCircle
          value={merged.leftA}
          onChange={(next) => update("leftA", next)}
          placeholder="x"
          readOnly={readOnly}
        />

        {readOnly ? (
          <span className="text-4xl font-bold">{merged.operatorA}</span>
        ) : (
          <select
            value={merged.operatorA}
            onChange={(e) => update("operatorA", e.target.value as EquationRowValue["operatorA"])}
            className="rounded border px-3 py-2 text-xl font-bold bg-transparent"
          >
            {OPERATOR_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        )}

        <EquationCircle
          value={merged.leftB}
          onChange={(next) => update("leftB", next)}
          placeholder="7"
          readOnly={readOnly}
        />

        <span className="text-4xl font-bold">{merged.equals}</span>

        <EquationCircle
          value={merged.right}
          onChange={(next) => update("right", next)}
          placeholder="10"
          readOnly={readOnly}
        />
      </div>

      <div className="rounded-xl bg-black/5 p-3 text-sm text-gray-600">
        Current equation:{" "}
        <span className="font-medium">
          {merged.leftA} {merged.operatorA} {merged.leftB} {merged.equals} {merged.right}
        </span>
      </div>
    </div>
  )
}