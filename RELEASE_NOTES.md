1.0.0 — first public release.

- pack: scan a DSH profile, resolve engines/slots/locales, build a portable .dshpack (manifest + per-file SHA-256, own zip writer, no dependencies)
- compatibility: 6 rules (slot.unique, engine.range, dep.version, locale.key, version.latest, runtime.platform), each with location / expected / actual
- install: preflight, checksum verification, backup, atomic write, bundled-config backup, downgrade guard, pnpm-lock sync, rollback
- restore: undo an install from its backup (plugin trees, links, package.json, patch layer, configs)
- page: three tabs (pack / compatibility / import), light and dark, en/zh locale
- agent tool: plugin_pack (state / create / inspect / install / restore)
- CLI: scan / create / inspect / verify / install / backups / restore / prune / align
