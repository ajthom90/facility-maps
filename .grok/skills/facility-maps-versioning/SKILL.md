---
name: facility-maps-versioning
description: >
  Decide and apply semantic version bumps (major/minor/patch) for Facility Safety Maps,
  keep package versions in sync, update CHANGELOG, tag releases, and publish GHCR images.
  Use when releasing, versioning, bumping version, tagging, publishing a container,
  cutting a release, or the user asks major vs minor vs patch for this project.
  Triggers: /facility-maps-versioning, "bump version", "release", "semver", "tag v".
---

# Facility Safety Maps — versioning & release

## Source of truth

| Item | Location |
|------|----------|
| **Product version** | Root `package.json` → `"version"` |
| Workspace mirrors | `apps/api/package.json`, `apps/web/package.json` (must match root) |
| Changelog | `CHANGELOG.md` |
| Git tag | `vX.Y.Z` (leading `v`) |
| Container image | `ghcr.io/ajthom90/facility-maps:X.Y.Z` (and `:latest` on release tags) |
| Runtime version | Env `APP_VERSION` (Docker build-arg); `GET /api/health` → `{ version }` |

Always keep root + both workspace packages on the **same** version:

```bash
# After editing root package.json version:
npm run version:sync
npm run version:check   # CI uses this
```

## When to bump MAJOR / MINOR / PATCH

Use **SemVer** relative to people running the **published Docker image** or integrating the **HTTP API**, not relative to internal refactors that change nothing for them.

### MAJOR (`X.0.0`) — breaking for deployers or API consumers

Bump major when an upgrade can break existing deployments or clients without them changing config/data deliberately.

Examples **for this project**:

- Removing or renaming a public API route or response field (`/api/campuses`, floor payload, feature geometry shape)
- Removing or renaming a **feature type** key that may already be stored in the DB (e.g. rename `first_aid` → `firstaid`) without a migration that rewrites rows
- Changing auth/session cookie behavior in a way that forces re-login design changes or breaks reverse proxies (e.g. always requiring HTTPS with no opt-out)
- Dropping env vars that were required/documented (`SESSION_SECRET`, `DATABASE_URL`, …) or changing their meaning incompatibly
- Database migrations that are not safely forward-only for existing Compose volumes (data loss, manual steps required)
- Changing default Compose service names/ports/volume paths in a way that silently orphans data
- Requiring a new major Node/Postgres that old installs cannot meet without a coordinated upgrade

**Not** major: pure internal refactors, dependency bumps that stay compatible, new optional env vars with defaults.

### MINOR (`0.X.0`) — backward-compatible features

Bump minor when users gain capability without breaking existing maps, APIs, or configs.

Examples **for this project**:

- New **feature types** or **layer presets** (seed refresh on container start is designed for this)
- New admin or public endpoints that old clients can ignore
- New optional fields on features/campuses with sensible defaults / nulls
- New i18n locales, UI improvements, new layer filters
- Optional env vars (e.g. new bootstrap flags) that default to previous behavior
- Documented new Docker labels or health fields **added** alongside existing ones

This includes AWAIR catalog growth: new pins/presets are **minor**, not major, as long as old type keys keep working.

### PATCH (`0.0.X`) — fixes and safe maintenance

Bump patch for corrections that do not add user-facing capability sets.

Examples **for this project**:

- Bug fixes (map coordinates, auth lockout, upload validation, seed edge cases)
- Security fixes that do not change the external contract (or only tighten invalid input)
- Dependency updates without intentional feature work
- Docs, README, skill, CI workflow fixes
- Performance improvements with identical API behavior
- Correcting seed/preset lists that were wrong but types already existed

If a “fix” removes a published API field or renames a stored feature type → treat as **major** (or minor only if you ship an automatic data migration and keep compatibility aliases).

## Pre-1.0 note

While the version is `0.y.z`, SemVer still applies within the project:

- `0.y.z` → `0.(y+1).0` for features
- `0.y.z` → `0.y.(z+1)` for fixes
- Prefer jumping to `1.0.0` only when you are ready to call the API + image contract **stable** for external operators

Breaking changes in `0.x` should still be called out as **MAJOR-class** in the changelog (and prefer bumping the `y` component at minimum, or go to `1.0.0` if you want a clear stability signal).

## Release procedure (agent checklist)

When the user asks to release or bump a version:

1. **Classify the change set** since the last git tag / CHANGELOG section using the rules above. If mixed, use the **highest** applicable bump (major > minor > patch).
2. **Confirm with the user** the proposed bump (`patch` / `minor` / `major`) and new version string unless they already specified it.
3. **Update versions**
   - Set root `package.json` `"version"` to `X.Y.Z`
   - Run `npm run version:sync`
   - Run `npm run version:check`
4. **Update `CHANGELOG.md`**
   - Move items from `## [Unreleased]` into `## [X.Y.Z] — YYYY-MM-DD`
   - Use Added / Changed / Fixed / Removed / Security sections as appropriate
   - Leave an empty `## [Unreleased]` section at the top
5. **Commit** on the release branch (usually `main`):

   ```text
   release: vX.Y.Z
   ```

   Include version files + CHANGELOG in the same commit.

6. **Tag and push** (only with user approval for push/tag if not already granted for this task):

   ```bash
   git tag -a "vX.Y.Z" -m "vX.Y.Z"
   git push origin HEAD
   git push origin "vX.Y.Z"
   ```

7. **CI / GHCR**
   - Tag `vX.Y.Z` triggers `.github/workflows/container.yml`
   - Publishes `ghcr.io/ajthom90/facility-maps:X.Y.Z`, `:X.Y`, `:X`, `:latest`
   - `APP_VERSION` build-arg is set to `X.Y.Z` (no leading `v`)
   - Pushes to `main` without a tag also publish `:edge` and `:sha-…` for previews

8. **Verify**
   - GitHub Actions “Container” workflow succeeded
   - `docker pull ghcr.io/ajthom90/facility-maps:X.Y.Z`
   - `curl -s http://localhost:3000/api/health` → `"version":"X.Y.Z"` after run

## Image update behavior (operators)

On **every** container start the app:

1. Runs DB migrations  
2. **Re-seeds system layer presets** (inserts new preset slugs; refreshes known system preset type lists)  
3. Bootstraps admin only if the users table is empty  

So pulling a new image and recreating the container applies catalog/preset updates automatically. Do **not** skip seed on startup.

## What not to do

- Do not bump only `apps/api` or only `apps/web` — always sync from root
- Do not create a tag without updating CHANGELOG and package version first
- Do not use tags without the `v` prefix (`1.2.3` alone is not the project convention)
- Do not treat “rewrote the map UI” as major unless public API or stored data contracts break
- Do not treat “added AED feature type” as major — that is minor

## Quick decision tree

```
Does this break existing API clients, stored feature type keys, env/deploy contracts, or data without a migration?
  YES → MAJOR
  NO → Does this add user-visible capability (types, presets, endpoints, locales, optional fields)?
         YES → MINOR
         NO  → PATCH
```
