type PlaybackKey = Pick<KeyboardEvent, "code" | "defaultPrevented" | "repeat" | "altKey" | "ctrlKey" | "metaKey" | "shiftKey" | "isComposing">;

/** Focused controls and gestures own their keys before the editor transport. */
export function shouldToggleEditorPlayback(event: PlaybackKey, target: Pick<Element, "closest"> | null): boolean {
  if (event.code !== "Space" || event.defaultPrevented || event.repeat || event.isComposing
      || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return false;
  return !target?.closest('button, a[href], input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="button"], [role="slider"], [role="textbox"], [role="combobox"], [role="spinbutton"], [role="tab"], dialog, [role="dialog"], [data-editor-shortcuts="off"]');
}
