export function shouldHandleFeatureDeleteKey(e: {
  key: string;
  target: EventTarget | null;
}): boolean {
  if (e.key !== "Backspace" && e.key !== "Delete") return false;
  const el = e.target;
  if (!(el instanceof HTMLElement)) return true;
  const tag = el.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el.isContentEditable) {
    return false;
  }
  return true;
}
