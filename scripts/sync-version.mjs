#!/usr/bin/env node
/**
 * Keep workspace package versions aligned with the root package.json version.
 *
 *   node scripts/sync-version.mjs           # write apps/api + apps/web versions
 *   node scripts/sync-version.mjs --check   # exit 1 if out of sync (CI)
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const checkOnly = process.argv.includes("--check");

const rootPkgPath = path.join(root, "package.json");
const rootPkg = JSON.parse(fs.readFileSync(rootPkgPath, "utf8"));
const version = rootPkg.version;
if (!version || typeof version !== "string") {
  console.error("Root package.json is missing a version string");
  process.exit(1);
}

const workspacePkgPaths = [
  path.join(root, "apps/api/package.json"),
  path.join(root, "apps/web/package.json"),
];

let mismatched = false;
for (const pkgPath of workspacePkgPaths) {
  const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
  if (pkg.version !== version) {
    mismatched = true;
    if (checkOnly) {
      console.error(
        `${path.relative(root, pkgPath)} version is ${pkg.version}, expected ${version}`
      );
    } else {
      pkg.version = version;
      fs.writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);
      console.log(`Updated ${path.relative(root, pkgPath)} → ${version}`);
    }
  } else if (!checkOnly) {
    console.log(`OK ${path.relative(root, pkgPath)} @ ${version}`);
  }
}

if (checkOnly) {
  if (mismatched) {
    console.error(
      `Version mismatch. Bump root package.json and run: npm run version:sync`
    );
    process.exit(1);
  }
  console.log(`All package versions are ${version}`);
}
