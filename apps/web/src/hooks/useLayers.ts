import { useCallback, useEffect, useRef, useState } from "react";
import type { LayerPreset } from "../types";

function setsEqual(a: Set<string>, b: Set<string>): boolean {
  if (a.size !== b.size) return false;
  for (const v of a) {
    if (!b.has(v)) return false;
  }
  return true;
}

function matchPresetSlug(
  presets: LayerPreset[],
  activeTypes: Set<string>,
): string | null {
  for (const preset of presets) {
    if (setsEqual(activeTypes, new Set(preset.featureTypes))) {
      return preset.slug;
    }
  }
  return null;
}

function initialState(
  presets: LayerPreset[],
  allTypes: readonly string[],
): { activeTypes: Set<string>; activePresetSlug: string | null } {
  const allPreset = presets.find((p) => p.slug === "all");
  if (allPreset) {
    return {
      activeTypes: new Set(allPreset.featureTypes),
      activePresetSlug: "all",
    };
  }
  return {
    activeTypes: new Set(allTypes),
    activePresetSlug: matchPresetSlug(presets, new Set(allTypes)),
  };
}

export function useLayers(
  presets: LayerPreset[],
  allTypes: readonly string[],
) {
  const [activeTypes, setActiveTypes] = useState<Set<string>>(
    () => initialState(presets, allTypes).activeTypes,
  );
  const [activePresetSlug, setActivePresetSlug] = useState<string | null>(
    () => initialState(presets, allTypes).activePresetSlug,
  );

  const prevPresetsLen = useRef(presets.length);
  useEffect(() => {
    // When presets load asynchronously (0 → N), re-apply default "all"
    if (prevPresetsLen.current === 0 && presets.length > 0) {
      const next = initialState(presets, allTypes);
      setActiveTypes(next.activeTypes);
      setActivePresetSlug(next.activePresetSlug);
    }
    prevPresetsLen.current = presets.length;
  }, [presets, allTypes]);

  const applyPreset = useCallback(
    (slug: string) => {
      const preset = presets.find((p) => p.slug === slug);
      if (!preset) return;
      setActiveTypes(new Set(preset.featureTypes));
      setActivePresetSlug(preset.slug);
    },
    [presets],
  );

  const toggleType = useCallback(
    (type: string) => {
      setActiveTypes((prev) => {
        const next = new Set(prev);
        if (next.has(type)) {
          next.delete(type);
        } else {
          next.add(type);
        }
        setActivePresetSlug(matchPresetSlug(presets, next));
        return next;
      });
    },
    [presets],
  );

  return {
    activeTypes,
    activePresetSlug,
    applyPreset,
    toggleType,
  };
}
