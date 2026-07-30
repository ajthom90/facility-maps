---
name: release
description: Use when releasing or versioning facility-maps — bumping the version, deciding major vs minor vs patch, updating CHANGELOG.md, tagging, pushing a release, or publishing the GHCR container image.
---

# Releasing Facility Safety Maps

## Source of truth

| Item | Location |
|------|----------|
| Version | Root `package.json` (workspaces `apps/api` + `apps/web` must match — never edit them directly) |
| Changelog | `CHANGELOG.md` (Keep a Changelog: Added / Changed / Fixed / Removed / Security) |
| Git tag | `vX.Y.Z` — annotated, leading `v` required (`v*.*.*` triggers the Container workflow) |
| Image | `ghcr.io/ajthom90/facility-maps:X.Y.Z` + `:X.Y`, `:X`, `:latest` |
| Runtime | `APP_VERSION` build-arg → `GET /api/health` returns `{ version }` |

## Major / minor / patch

Judge against people running the published Docker image or calling the HTTP API — not internal refactors.

```
Breaks existing API clients, stored feature-type keys, env/deploy
contracts, or data without an automatic migration?      → MAJOR
Adds user-visible capability (feature types, presets,
endpoints, locales, optional fields/env with defaults)? → MINOR
Fixes, security tightening, deps, docs, perf, CI        → PATCH
```

- MAJOR examples: remove/rename a public route or response field; rename a stored feature-type key without a data migration; drop or repurpose a documented env var; migrations that lose data or need manual steps; changing Compose volume names (`facility-maps-data`, `facility-maps-config`).
- MINOR examples: new feature types or layer presets (startup seed refresh applies them automatically), new endpoints/locales, new optional env vars defaulting to old behavior.
- PATCH examples: bug/security fixes with the same contract, dependency bumps, docs, workflow fixes.
- Mixed change set → highest wins. Pre-1.0: features bump `0.(y+1).0`, fixes `0.y.(z+1)`; still call out breaking changes as MAJOR-class in the changelog. Go to `1.0.0` only to declare the API + image contract stable.

## Release procedure

1. Classify all changes since the last tag (`git log $(git describe --tags --abbrev=0)..HEAD --oneline`); confirm the bump with the user unless they specified it.
2. Set the new version in root `package.json`, then `npm run version:sync` and `npm run version:check`.
3. `CHANGELOG.md`: move `## [Unreleased]` items into `## [X.Y.Z] — YYYY-MM-DD`; leave an empty `## [Unreleased]` at the top.
4. Verify green: `npm test && npm run build`.
5. Commit version files + changelog together — message is exactly `release: vX.Y.Z` (see `git log` for precedent).
6. Tag and push (push needs user approval if not already granted):
   ```bash
   git tag -a "vX.Y.Z" -m "vX.Y.Z"
   git push origin HEAD
   git push origin "vX.Y.Z"
   ```
7. The tag triggers `.github/workflows/container.yml`: publishes `:X.Y.Z`, `:X.Y`, `:X`, `:latest` with `APP_VERSION=X.Y.Z` (no leading `v`). Plain pushes to `main` publish `:edge` + `:sha-<short>` previews only.
8. Verify: Container workflow green, then `GET /api/health` on a fresh container reports the new version. There is no GitHub Release automation — tag + changelog is the whole ceremony.

Operators upgrade by pulling the new image: every start runs migrations, re-seeds system layer presets, and bootstraps admin only on an empty users table — never skip the seed.

## What not to do

- No lightweight tags, no tags without the `v` prefix, no tag before version+changelog are committed.
- Don't bump `apps/api` or `apps/web` individually — always root + `version:sync`.
- "Rewrote the UI" is not major unless a public contract breaks; "added a feature type" is minor, not major.
