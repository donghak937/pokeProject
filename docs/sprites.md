# Sprite Source Notes

This prototype is prepared for sprite URLs through the optional `spriteUrl` field on each Pokemon record.

## Candidate Sources

- PokeRogue assets: likely useful for pixel-style sprites, but the asset repository uses Creative Commons non-commercial/share-alike terms for many files and has file-level license metadata. Treat it as prototype-only until exact files and attribution requirements are locked.
- PokeAPI sprite URLs: convenient for development, but do not assume the Pokemon artwork itself is freely reusable for a public fan game.

Useful references:

- https://github.com/pagefaultgames/pokerogue-assets
- https://github.com/pagefaultgames/pokerogue

## Current Decision

Use PokeRogue Pokemon sprites for a non-commercial friends-only prototype. The app loads them from the public `beta` branch raw URLs and keeps the integration pluggable through `spriteUrl`.

The PokeRogue Pokemon PNG files are animation sheets, so the UI crops the top-left frame for now instead of trying to run the full animation metadata.

Before shipping publicly:

1. Pick the exact asset source.
2. Record its license and attribution.
3. Avoid monetization unless the asset and IP rights are clearly compatible.
