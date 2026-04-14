import { GameplayBlockType } from "./types"

export type InspectorField = {
  key: string
  label: string
  type: "number" | "text" | "boolean" | "select"
  options?: string[]
}

export type BlockDefinition = {
  type: GameplayBlockType
  label: string
  hasDuration: boolean
  defaultParams: Record<string, string | number | boolean>
  inspectorFields: InspectorField[]
  unityPreviewType: string
}

export const BLOCK_REGISTRY: Record<GameplayBlockType, BlockDefinition> = {
  obstacle: {
    type: "obstacle",
    label: "Obstacle",
    hasDuration: false,
    defaultParams: { variant: "wall", strength: 1 },
    inspectorFields: [
      { key: "variant", label: "Variant", type: "select", options: ["wall", "spike"] },
      { key: "strength", label: "Strength", type: "number" },
    ],
    unityPreviewType: "Obstacle",
  },
  jump: {
    type: "jump",
    label: "Jump",
    hasDuration: false,
    defaultParams: { height: 1 },
    inspectorFields: [{ key: "height", label: "Height", type: "number" }],
    unityPreviewType: "Jump",
  },
  hold: {
    type: "hold",
    label: "Hold",
    hasDuration: true,
    defaultParams: { reward: 1 },
    inspectorFields: [{ key: "reward", label: "Reward", type: "number" }],
    unityPreviewType: "Hold",
  },
  boost: {
    type: "boost",
    label: "Boost",
    hasDuration: true,
    defaultParams: { speed: 1.2 },
    inspectorFields: [{ key: "speed", label: "Speed", type: "number" }],
    unityPreviewType: "Boost",
  },
  enemy: {
    type: "enemy",
    label: "Enemy",
    hasDuration: false,
    defaultParams: { enemyType: "basic" },
    inspectorFields: [{ key: "enemyType", label: "Enemy Type", type: "text" }],
    unityPreviewType: "Enemy",
  },
  camera: {
    type: "camera",
    label: "Camera",
    hasDuration: true,
    defaultParams: { mode: "zoom", amount: 1 },
    inspectorFields: [
      { key: "mode", label: "Mode", type: "select", options: ["zoom", "pan", "tilt"] },
      { key: "amount", label: "Amount", type: "number" },
    ],
    unityPreviewType: "Camera",
  },
  effect: {
    type: "effect",
    label: "Effect",
    hasDuration: false,
    defaultParams: { effectName: "flash" },
    inspectorFields: [{ key: "effectName", label: "Effect", type: "text" }],
    unityPreviewType: "Effect",
  },
  trigger: {
    type: "trigger",
    label: "Trigger",
    hasDuration: false,
    defaultParams: { eventName: "custom_event" },
    inspectorFields: [{ key: "eventName", label: "Event", type: "text" }],
    unityPreviewType: "Trigger",
  },
}