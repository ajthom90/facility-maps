import path from "node:path";
import { fileURLToPath } from "node:url";
import { eq } from "drizzle-orm";
import { FEATURE_TYPES, PRESET_SEEDS } from "../lib/feature-types.js";
import { createDb, type Db } from "./client.js";
import { layerPresets } from "./schema.js";

function resolveFeatureTypes(
  featureTypes: (typeof PRESET_SEEDS)[number]["featureTypes"]
): string[] {
  return featureTypes === "*" ? [...FEATURE_TYPES] : [...featureTypes];
}

/**
 * Seeds / refreshes system layer presets from PRESET_SEEDS.
 *
 * - Inserts any missing preset slug.
 * - Updates featureTypes + sortOrder for every known system slug so catalog
 *   expansions (new AWAIR types / presets) apply when seed is re-run.
 * - Does not delete admin-only custom presets with other slugs.
 *
 * Note: re-running seed overwrites the feature-type lists on system presets
 * (all, evacuation, fire_response, …). Re-apply local preset customizations
 * after upgrade if you changed them in admin.
 *
 * Campuses, buildings, and floors are created by admins — not preloaded.
 */
export async function seed(db: Db): Promise<void> {
  const existing = await db
    .select({ id: layerPresets.id, slug: layerPresets.slug })
    .from(layerPresets);
  const bySlug = new Map(existing.map((r) => [r.slug, r]));

  const inserted: string[] = [];
  const updated: string[] = [];

  for (const p of PRESET_SEEDS) {
    const featureTypes = resolveFeatureTypes(p.featureTypes);

    if (!bySlug.has(p.slug)) {
      await db.insert(layerPresets).values({
        slug: p.slug,
        sortOrder: p.sortOrder,
        featureTypes,
      });
      inserted.push(p.slug);
      continue;
    }

    await db
      .update(layerPresets)
      .set({ featureTypes, sortOrder: p.sortOrder })
      .where(eq(layerPresets.slug, p.slug));
    updated.push(p.slug);
  }

  if (inserted.length > 0) {
    console.log("Inserted layer presets:", inserted.join(", "));
  }
  if (updated.length > 0) {
    console.log("Refreshed layer presets:", updated.join(", "));
  }
  if (inserted.length === 0 && updated.length === 0) {
    console.log("No layer preset changes");
  }
}

const isMain =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  const db = createDb();
  seed(db)
    .then(async () => {
      console.log("Seed complete");
      process.exit(0);
    })
    .catch((err) => {
      console.error("Seed failed", err);
      process.exit(1);
    });
}
