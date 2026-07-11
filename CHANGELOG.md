# Changelog

## 0.4.0-beta.0

### Breaking

- **Renamed CLI/package from `skm` to `skrun`** — Binary is now `skrun` (`bin/skrun.js`),
  npm package is `@akaiserg/skrun`, config directory moved from `~/.config/skm/` to
  `~/.config/skrun/`, and the config-dir override env var is now `SKRUN_CONFIG_DIR` (was
  `SKM_CONFIG_DIR`). The per-skill tag file inside each skill folder is now `skrun.json`
  (was `skm.json`). There is no automatic migration — users on an existing `skm` install
  must manually move `~/.config/skm/` to `~/.config/skrun/` (and rename any `skm.json` tag
  files to `skrun.json`) or re-import their skills.

### Added

- **OpenCode target support** — `skrun install --target=opencode` installs into
  `.opencode/skills/`, and auto-detection now recognizes an existing `.opencode/` directory
  alongside `.claude/` and `.github/` when fanning out installs with no `--target` specified.

## 0.2.0

### Security

- **Fix command injection in `skm import`** — Replaced `execSync` shell interpolation with `execFileSync` array args for `git clone` and `git --version`. Previously, a malicious repo string could execute arbitrary shell commands.

### Fixed

- **Duplicate installs in registry** — Re-installing a skill to the same target path now replaces the existing registry entry instead of appending a duplicate.
- **Import count accuracy** — `skm import` now reports actual imported vs skipped counts separately (`3 imported, 1 skipped`) instead of counting skipped skills as imported.
- **TTL date comparison** — `skm purge` now compares expiry timestamps numerically (`Date.getTime()`) instead of lexicographic ISO string comparison.
- **`forceRemove` safety guard** — Refuses to delete paths less than 3 levels deep (e.g. `/home`, `/Users/name`), preventing accidental broad deletions.
- **`list --installed` shows stale entries** — Entries whose target path no longer exists are now marked `[missing]`.
- **Temp dir uniqueness** — Import temp dirs now include a random suffix to prevent collisions on rapid successive imports.

### Removed

- Dead `copyDir` manual fallback (Node >= 16.7 guarantees `cpSync`)
- Unused `isSubPath` export from `fsutil.js`
- Unused `statSync` import from `skills.js`

### Added

- `skm list --installed` — Shows all active installs with type, path, TTL expiry, and missing status.
- Version in `cli.js` now reads from `package.json` (single source of truth).
