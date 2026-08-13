import { describe, expect, it } from "vitest";
import { shouldHandleFeatureDeleteKey } from "../src/lib/editorKeys";

describe("shouldHandleFeatureDeleteKey", () => {
  it("handles Delete and Backspace on the map", () => {
    expect(shouldHandleFeatureDeleteKey({ key: "Delete", target: document.body })).toBe(true);
    expect(shouldHandleFeatureDeleteKey({ key: "Backspace", target: document.body })).toBe(true);
  });

  it("ignores other keys", () => {
    expect(shouldHandleFeatureDeleteKey({ key: "Escape", target: document.body })).toBe(false);
  });

  it("does not steal keys from form fields", () => {
    const input = document.createElement("input");
    const textarea = document.createElement("textarea");
    const select = document.createElement("select");
    expect(shouldHandleFeatureDeleteKey({ key: "Backspace", target: input })).toBe(false);
    expect(shouldHandleFeatureDeleteKey({ key: "Delete", target: textarea })).toBe(false);
    expect(shouldHandleFeatureDeleteKey({ key: "Delete", target: select })).toBe(false);
  });
});
