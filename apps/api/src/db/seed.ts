import path from "node:path";
import { fileURLToPath } from "node:url";
import { count } from "drizzle-orm";
import { FEATURE_TYPES, PRESET_SEEDS } from "../lib/feature-types.js";
import { createDb, type Db } from "./client.js";
import { campuses, layerPresets } from "./schema.js";

export async function seed(db: Db): Promise<void> {
  const [{ campusCount }] = await db.select({ campusCount: count() }).from(campuses);
  if (campusCount === 0) {
    await db.insert(campuses).values([
      { name: "Mankato", slug: "mankato", sortOrder: 0 },
      { name: "Waseca", slug: "waseca", sortOrder: 1 },
    ]);
    console.log("Seeded campuses: Mankato, Waseca");
  }

  const [{ presetCount }] = await db.select({ presetCount: count() }).from(layerPresets);
  if (presetCount === 0) {
    await db.insert(layerPresets).values(
      PRESET_SEEDS.map((p) => ({
        slug: p.slug,
        sortOrder: p.sortOrder,
        // Store full type list for "all" to avoid special-case ambiguity in DB
        featureTypes:
          p.featureTypes === "*" ? [...FEATURE_TYPES] : [...p.featureTypes],
      }))
    );
    console.log("Seeded layer presets:", PRESET_SEEDS.map((p) => p.slug).join(", "));
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
